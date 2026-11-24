// ========================
// EL-KHETM — Authoritative Game Room State Machine
// ========================

import { v4 as uuidv4 } from 'uuid';
import type { Server as SocketServer } from 'socket.io';
import {
  Card,
  CardType,
  DocumentCardType,
  GamePhase,
  GameEventNotice,
  PublicGameState,
  PrivateGameState,
  LobbyState,
  PendingReaction,
  PendingArchive,
  GlobalEffects,
  WinReason,
  GAME_CONSTANTS,
  BOT_NAMES,
  SoundEffect,
} from '@el-khetm/shared';
import {
  generateDeck,
  shuffleDeck,
  CARD_DEFINITIONS,
  getCardDef,
  isDocumentCard,
} from '@el-khetm/shared';
import {
  ServerPlayer,
  ServerGameState,
  validateCardPlay,
  executeCardEffect,
  drawCard,
  addLogEntry,
} from './CardEffects';
import {
  decideBotAction,
  shouldBlock,
  chooseArchiveCard,
  chooseDiscard,
  getBotTurnDelay,
  getBotReactionDelay,
} from './BotAI';

export class GameRoom {
  public roomCode: string;
  public hostId: string;
  public phase: GamePhase = 'LOBBY';
  public players: ServerPlayer[] = [];
  public deck: Card[] = [];
  public discardPile: Card[] = [];
  public globalEffects: GlobalEffects = { medhatVacationUntilPlayerId: null };
  public activeMedhatCard: Card | null = null;
  public roundNumber: number = 0;
  public currentTurnIndex: number = 0;
  public actionsRemaining: number = 0;
  public actionLog: string[] = [];
  public lastEvent: GameEventNotice | null = null;
  public eventHistory: GameEventNotice[] = [];
  public winnerIds: string[] | null = null;
  public winReason: WinReason = null;
  public pendingReaction: PendingReaction | null = null;
  public pendingArchive: PendingArchive | null = null;
  public pendingArchivePlayedCardId: string | null = null;
  public turnExpiresAt: number | null = null;

  private io: SocketServer;
  private isProcessing: boolean = false;
  private isAfkTakeover: boolean = false;
  private turnTimer: ReturnType<typeof setTimeout> | null = null;
  private reactionTimer: ReturnType<typeof setTimeout> | null = null;
  private archiveTimer: ReturnType<typeof setTimeout> | null = null;
  private discardTimer: ReturnType<typeof setTimeout> | null = null;
  private botTimer: ReturnType<typeof setTimeout> | null = null;
  private frozenTimer: ReturnType<typeof setTimeout> | null = null;
  private turnEndTimer: ReturnType<typeof setTimeout> | null = null;
  private cleanupTimer: ReturnType<typeof setTimeout> | null = null;
  private botUsedNames: Set<string> = new Set();
  private lastActivity: number = Date.now();

  constructor(roomCode: string, hostId: string, io: SocketServer) {
    this.roomCode = roomCode;
    this.hostId = hostId;
    this.io = io;
  }

  // === Timer Management ===

  private clearAllTimers(): void {
    if (this.turnTimer) { clearTimeout(this.turnTimer); this.turnTimer = null; }
    if (this.reactionTimer) { clearTimeout(this.reactionTimer); this.reactionTimer = null; }
    if (this.archiveTimer) { clearTimeout(this.archiveTimer); this.archiveTimer = null; }
    if (this.discardTimer) { clearTimeout(this.discardTimer); this.discardTimer = null; }
    if (this.botTimer) { clearTimeout(this.botTimer); this.botTimer = null; }
    if (this.frozenTimer) { clearTimeout(this.frozenTimer); this.frozenTimer = null; }
    if (this.turnEndTimer) { clearTimeout(this.turnEndTimer); this.turnEndTimer = null; }
    this.turnExpiresAt = null;
  }

  public clearCleanupTimer(): void {
    if (this.cleanupTimer) { clearTimeout(this.cleanupTimer); this.cleanupTimer = null; }
  }

  public destroy(): void {
    this.clearAllTimers();
    this.clearCleanupTimer();
  }

  // === Lobby Management ===

  public addPlayer(id: string, name: string, avatarId: string, sessionId: string, socketId: string): ServerPlayer {
    const player: ServerPlayer = {
      id, name, avatarId, isBot: false,
      isDisconnected: false, isFrozen: false, frozenCard: null,
      file: [], fileCards: [], hand: [],
      socketId, sessionId,
    };
    this.players.push(player);
    this.lastActivity = Date.now();
    return player;
  }

  public addBot(): ServerPlayer | null {
    if (this.players.length >= GAME_CONSTANTS.MAX_PLAYERS) return null;
    const availableNames = BOT_NAMES.filter(n => !this.botUsedNames.has(n));
    const botName = availableNames.length > 0
      ? availableNames[Math.floor(Math.random() * availableNames.length)]
      : `بوت ${this.players.length}`;
    this.botUsedNames.add(botName);

    const bot: ServerPlayer = {
      id: `bot_${uuidv4().slice(0, 8)}`,
      name: botName,
      avatarId: 'bot',
      isBot: true,
      isDisconnected: false,
      isFrozen: false,
      frozenCard: null,
      file: [],
      fileCards: [],
      hand: [],
      socketId: null,
      sessionId: `bot_session_${uuidv4().slice(0, 8)}`,
    };
    this.players.push(bot);
    return bot;
  }

  public removeBot(botId: string): boolean {
    const idx = this.players.findIndex(p => p.id === botId && p.isBot);
    if (idx === -1) return false;
    const removed = this.players.splice(idx, 1)[0];
    this.botUsedNames.delete(removed.name);
    return true;
  }

  public removePlayer(playerId: string): void {
    const idx = this.players.findIndex(p => p.id === playerId);
    if (idx === -1) return;
    this.players.splice(idx, 1);
    if (this.hostId === playerId && this.phase === 'LOBBY') {
      const nextHuman = this.players.find(p => !p.isBot);
      if (nextHuman) this.hostId = nextHuman.id;
    }
  }

  public findPlayerBySession(sessionId: string): ServerPlayer | undefined {
    return this.players.find(p => p.sessionId === sessionId);
  }

  public findPlayerBySocket(socketId: string): ServerPlayer | undefined {
    return this.players.find(p => p.socketId === socketId);
  }

  public get currentPlayer(): ServerPlayer {
    return this.players[this.currentTurnIndex];
  }

  public get connectedHumanCount(): number {
    return this.players.filter(p => !p.isBot && !p.isDisconnected).length;
  }

  // === Game Start ===

  public startGame(): void {
    if (this.players.length < GAME_CONSTANTS.MIN_PLAYERS) return;

    this.deck = shuffleDeck(generateDeck());
    this.discardPile = [];
    this.roundNumber = 1;
    this.currentTurnIndex = 0;
    this.globalEffects = { medhatVacationUntilPlayerId: null };
    this.activeMedhatCard = null;
    this.actionLog = [];
    this.lastEvent = null;
    this.eventHistory = [];
    this.winnerIds = null;
    this.winReason = null;
    this.pendingReaction = null;
    this.pendingArchive = null;
    this.pendingArchivePlayedCardId = null;
    this.isAfkTakeover = false;

    // Clear player state
    for (const p of this.players) {
      p.file = [];
      p.fileCards = [];
      p.hand = [];
      p.isFrozen = false;
      p.frozenCard = null;
    }

    // Deal starting hands (5 cards per player)
    for (let i = 0; i < GAME_CONSTANTS.STARTING_HAND_SIZE; i++) {
      for (const p of this.players) {
        drawCard(this.getState(), p);
      }
    }

    addLogEntry(this.getState(), 'الجيم بدأ! خلّص ورقك قبل الساعة 2 الضهر!');
    this.transitionTo('TURN_START');
  }

  // === State Machine Transitions ===

  private transitionTo(newPhase: GamePhase): void {
    this.clearAllTimers();
    this.phase = newPhase;
    this.lastActivity = Date.now();

    switch (newPhase) {
      case 'TURN_START':
        this.handleTurnStart();
        break;
      case 'ACTION_PHASE':
        this.handleActionPhase();
        break;
      case 'DISCARD_PHASE':
        this.handleDiscardPhase();
        break;
      case 'TURN_END':
        this.handleTurnEnd();
        break;
      case 'GAME_OVER':
        this.handleGameOver();
        break;
    }
  }

  private handleTurnStart(): void {
    const player = this.currentPlayer;
    this.isAfkTakeover = false;

    // Clear medhat_vacation if it's this player's turn and return card to archive
    if (this.globalEffects.medhatVacationUntilPlayerId === player.id) {
      this.globalEffects.medhatVacationUntilPlayerId = null;
      if (this.activeMedhatCard) {
        this.discardPile.push(this.activeMedhatCard);
        this.activeMedhatCard = null;
      }
    }

    // Check frozen (system_down skips draw & action, moves frozenCard to archive)
    if (player.isFrozen) {
      player.isFrozen = false;
      if (player.frozenCard) {
        this.discardPile.push(player.frozenCard);
        player.frozenCard = null;
      }
      addLogEntry(this.getState(), `السيستم واقع — فات دور ${player.name}!`);
      this.recordEvent({
        actorId: player.id,
        actorName: player.name,
        cardType: 'system_down',
        isFrozenSkip: true,
        headlineAr: `🚫 السيستم واقع — فات دور ${player.name}!`,
        explanationAr: `${player.name} شال كارت «السيستم واقع» من ملفه ورماه الأرشيف، فمش هيسحب ومش هيلعب الدور ده.`,
        bubbleActorAr: 'دوري فات ❄️',
      });
      this.broadcastState();
      this.emitSoundToAll('buzz');
      this.frozenTimer = setTimeout(() => this.transitionTo('TURN_END'), GAME_CONSTANTS.FROZEN_SKIP_DELAY_MS);
      return;
    }

    // Auto-draw 1 card
    drawCard(this.getState(), player);
    this.actionsRemaining = GAME_CONSTANTS.ACTIONS_PER_TURN;

    this.emitSoundToPlayer(player, 'card_draw');

    // Transition to ACTION_PHASE (which broadcasts state & starts timer)
    this.transitionTo('ACTION_PHASE');

    // If bot or disconnected, schedule BotAI after readable pause so turn transition is clearly visible
    if (player.isBot || player.isDisconnected) {
      this.botTimer = setTimeout(() => this.executeBotTurn(), GAME_CONSTANTS.BOT_TURN_START_DELAY_MS);
    }
  }

  private handleActionPhase(): void {
    this.phase = 'ACTION_PHASE';
    const player = this.currentPlayer;

    if (!player.isBot && !player.isDisconnected && !this.isAfkTakeover) {
      this.scheduleHumanTurnTimer(player);
    }

    this.broadcastState();
  }

  private scheduleHumanTurnTimer(player: ServerPlayer): void {
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.turnExpiresAt = Date.now() + GAME_CONSTANTS.TURN_TIMER_MS;
    this.turnTimer = setTimeout(() => {
      if (this.phase !== 'ACTION_PHASE' || this.currentPlayer.id !== player.id) return;
      this.isAfkTakeover = true;
      this.turnExpiresAt = null;
      addLogEntry(this.getState(), `${player.name} ماردّش — البوت بيلعب بداله!`);
      this.broadcastState();
      this.executeBotTurn();
    }, GAME_CONSTANTS.TURN_TIMER_MS);
  }

  private handleDiscardPhase(): void {
    const player = this.currentPlayer;
    const excess = player.hand.length - GAME_CONSTANTS.MAX_HAND_SIZE;

    if (excess <= 0) {
      this.transitionTo('TURN_END');
      return;
    }

    this.phase = 'DISCARD_PHASE';
    this.broadcastState();

    if (player.isBot || player.isDisconnected || this.isAfkTakeover) {
      const decision = chooseDiscard(player, excess);
      this.botTimer = setTimeout(() => {
        if (this.phase !== 'DISCARD_PHASE' || this.currentPlayer.id !== player.id) return;
        this.executeDiscard(player, decision.cardInstanceIds);
      }, 600);
    } else {
      this.discardTimer = setTimeout(() => {
        if (this.phase !== 'DISCARD_PHASE' || this.currentPlayer.id !== player.id) return;
        const decision = chooseDiscard(player, excess);
        this.executeDiscard(player, decision.cardInstanceIds);
      }, GAME_CONSTANTS.DISCARD_TIMER_MS);
    }
  }

  private handleTurnEnd(): void {
    const prevWasBot = this.players[this.currentTurnIndex]?.isBot ?? false;
    this.currentTurnIndex = (this.currentTurnIndex + 1) % this.players.length;
    if (this.currentTurnIndex === 0) {
      this.roundNumber++;
    }

    if (this.roundNumber > GAME_CONSTANTS.MAX_ROUNDS) {
      this.calculateTieBreaker();
      this.transitionTo('GAME_OVER');
      return;
    }

    const nextIsBot = this.players[this.currentTurnIndex]?.isBot ?? false;
    if (prevWasBot || nextIsBot) {
      // Brief pause between turns so players can clearly follow each bot's move
      this.broadcastState();
      this.turnEndTimer = setTimeout(() => {
        if (this.phase === 'TURN_END') {
          this.transitionTo('TURN_START');
        }
      }, prevWasBot ? GAME_CONSTANTS.BOT_TURN_END_PAUSE_MS : 650);
    } else {
      this.transitionTo('TURN_START');
    }
  }

  private handleGameOver(): void {
    this.phase = 'GAME_OVER';
    this.clearAllTimers();
    this.broadcastState();

    if (this.winReason === 'EAGLE_SEAL') {
      this.emitSoundToAll('win_fanfare');
    } else {
      this.emitSoundToAll('shutter_close');
    }
  }

  // === Action Handlers ===

  public handlePlayCard(
    playerId: string,
    cardInstanceId: string,
    targetPlayerId?: string,
    targetDocument?: DocumentCardType,
  ): void {
    if (this.isProcessing) return;
    if (this.phase !== 'ACTION_PHASE') return;
    if (this.currentPlayer.id !== playerId) return;
    if (this.actionsRemaining <= 0) return;

    this.isProcessing = true;
    try {
      const caster = this.currentPlayer;
      const cardIdx = caster.hand.findIndex(c => c.instanceId === cardInstanceId);
      if (cardIdx === -1) {
        this.emitError(playerId, 'الكارت مش في إيدك');
        return;
      }
      const card = caster.hand[cardIdx];
      const state = this.getState();

      // Validate
      const validation = validateCardPlay(state, caster, card, targetPlayerId, targetDocument);
      if (!validation.valid) {
        this.emitError(playerId, validation.error || 'مش ممكن تلعب الكارت ده');
        return;
      }

      const def = getCardDef(card.cardType);

      // Remove card from hand
      caster.hand.splice(cardIdx, 1);

      // Branch based on card type
      if (def.triggersReaction && targetPlayerId) {
        // Targeted prank or wasta → PENDING_REACTION (keep card in pendingReaction until resolved)
        this.clearAllTimers();

        const target = this.players.find(p => p.id === targetPlayerId)!;
        this.pendingReaction = {
          attackerId: caster.id,
          attackerName: caster.name,
          targetId: target.id,
          targetName: target.name,
          cardPlayed: card,
          targetDoc: targetDocument,
          expiresAt: Date.now() + GAME_CONSTANTS.REACTION_TIMER_MS,
        };
        this.phase = 'PENDING_REACTION';
        this.broadcastState();
        this.emitSoundToAll('prank_alarm');

        // Handle bot/disconnected reaction
        if (target.isBot || target.isDisconnected) {
          const reactionDelay = getBotReactionDelay();
          this.reactionTimer = setTimeout(() => {
            const decision = shouldBlock(target, card.cardType);
            this.handleReaction(target.id, decision.block);
          }, reactionDelay);
        } else {
          // 5-second timer for human (strict anti-leak full window)
          this.reactionTimer = setTimeout(() => {
            this.handleReaction(target.id, false);
          }, GAME_CONSTANTS.REACTION_TIMER_MS);
        }

      } else if (card.cardType === 'uncle_gamal') {
        // Uncle Gamal → PENDING_ARCHIVE
        this.discardPile.push(card);
        this.pendingArchivePlayedCardId = card.instanceId;
        this.clearAllTimers();

        // Exclude the played uncle_gamal itself
        const selectableCards = this.discardPile.filter(c => c.instanceId !== card.instanceId);

        this.pendingArchive = {
          playerId: caster.id,
          expiresAt: Date.now() + GAME_CONSTANTS.ARCHIVE_TIMER_MS,
        };
        this.phase = 'PENDING_ARCHIVE';

        this.emitPrivateState(caster, selectableCards);
        this.broadcastPublicState();

        if (caster.isBot || caster.isDisconnected || this.isAfkTakeover) {
          const archiveDecision = chooseArchiveCard(caster, selectableCards);
          this.botTimer = setTimeout(
            () => this.handlePickArchive(caster.id, archiveDecision.cardInstanceId),
            getBotTurnDelay(),
          );
        } else {
          this.archiveTimer = setTimeout(() => {
            const archiveDecision = chooseArchiveCard(caster, selectableCards);
            this.handlePickArchive(caster.id, archiveDecision.cardInstanceId);
          }, GAME_CONSTANTS.ARCHIVE_TIMER_MS);
        }

      } else {
        // Immediate effect: documents, medhat_vacation, recommendation
        const handBefore = caster.hand.length;
        const isWin = executeCardEffect(this.getState(), caster, card, targetPlayerId, targetDocument);

        // Card destination strictly follows physical card rules:
        // - Documents stay in caster.fileCards (handled inside executeCardEffect)
        // - medhat_vacation stays in this.activeMedhatCard until cleared next round
        // - recommendation goes to discardPile
        if (!isDocumentCard(card.cardType) && card.cardType !== 'medhat_vacation') {
          this.discardPile.push(card);
        }

        this.actionsRemaining--;

        if (card.cardType === 'medhat_vacation') {
          this.recordEvent({
            actorId: caster.id,
            actorName: caster.name,
            cardType: 'medhat_vacation',
            headlineAr: `🏖️ ${caster.name} لعب «الأستاذ مدحت في إجازة»`,
            explanationAr: `لمدة لفة كاملة، محدش يقدر ينزّل «إمضاء المدير» لحد ما اللفة ترجع لـ ${caster.name}!`,
            bubbleActorAr: 'مدحت في إجازة 🏖️',
          });
          this.emitSoundToAll('buzz');
          this.emitToastToAll('🏖️ الأستاذ مدحت في إجازة — ممنوع إمضاء المدير لفة كاملة!', 'warning');
        } else if (isDocumentCard(card.cardType)) {
          const docDef = CARD_DEFINITIONS[card.cardType];
          this.recordEvent({
            actorId: caster.id,
            actorName: caster.name,
            cardType: card.cardType,
            headlineAr:
              card.cardType === 'eagle_seal'
                ? `🦅 ${caster.name} نزّل «ختم النسر» وقال: ختمت!`
                : `📄 ${caster.name} نزّل «${docDef.nameAr}»`,
            explanationAr:
              card.cardType === 'eagle_seal'
                ? `مبروك! ${caster.name} كمّل الـ 4 أوراق في ملفه وكسب الجيم فوراً!`
                : `${caster.name} حط «${docDef.nameAr}» مكشوفة في ملفه (${caster.file.length}/4).`,
            bubbleActorAr: card.cardType === 'eagle_seal' ? 'ختمت! 🦅' : `نزّلت ${docDef.nameAr}`,
          });
          this.emitSoundToAll('stamp');
        } else {
          // recommendation
          const drawnCount = Math.max(0, caster.hand.length - handBefore);
          this.recordEvent({
            actorId: caster.id,
            actorName: caster.name,
            cardType: 'recommendation',
            headlineAr: `📨 ${caster.name} لعب «توصية من فوق»`,
            explanationAr: `${caster.name} سحب ${drawnCount} كروت زيادة من كومة السحب لإيده فوراً!`,
            bubbleActorAr: `سحبت ${drawnCount} كروت 📨`,
          });
          this.emitSoundToAll('card_flip');
        }

        if (isWin) {
          this.winnerIds = [caster.id];
          this.winReason = 'EAGLE_SEAL';
          this.transitionTo('GAME_OVER');
          return;
        }

        if (this.actionsRemaining <= 0) {
          this.transitionTo('DISCARD_PHASE');
        } else {
          this.broadcastState();
          if (caster.isBot || caster.isDisconnected || this.isAfkTakeover) {
            this.botTimer = setTimeout(() => this.executeBotTurn(), getBotTurnDelay());
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  public handleEndTurn(playerId: string): void {
    if (this.phase !== 'ACTION_PHASE') return;
    if (this.currentPlayer.id !== playerId) return;
    this.transitionTo('DISCARD_PHASE');
  }

  public handleReaction(targetId: string, block: boolean): void {
    if (this.phase !== 'PENDING_REACTION') return;
    if (!this.pendingReaction) return;
    if (this.pendingReaction.targetId !== targetId) return;

    this.clearAllTimers();
    const { attackerId, cardPlayed, targetDoc } = this.pendingReaction;
    const caster = this.players.find(p => p.id === attackerId)!;
    const target = this.players.find(p => p.id === targetId)!;
    const attackDef = CARD_DEFINITIONS[cardPlayed.cardType];

    if (block) {
      // Validate breakfast_break in hand
      const bbIdx = target.hand.findIndex(c => c.cardType === 'breakfast_break');
      if (bbIdx === -1) {
        block = false;
      } else {
        const bb = target.hand.splice(bbIdx, 1)[0];
        this.discardPile.push(cardPlayed);
        this.discardPile.push(bb);
        addLogEntry(this.getState(), `${target.name} صد المقلب بـ بريك الفطار!`);
        this.recordEvent({
          actorId: caster.id,
          actorName: caster.name,
          targetId: target.id,
          targetName: target.name,
          cardType: cardPlayed.cardType,
          targetDoc,
          blocked: true,
          headlineAr: `🛡️ ${target.name} صد «${attackDef.nameAr}» بـ بريك الفطار!`,
          explanationAr: `${caster.name} رمى «${attackDef.nameAr}» على ${target.name}، بس ${target.name} خبط «بريك الفطار» ولغى المقلب والكارتين راحوا الأرشيف!`,
          bubbleActorAr: 'المقلب اتصد!',
          bubbleTargetAr: 'بريك فطار يا باشا ☕🛡️',
        });
        this.emitSoundToAll('shield_block');
        this.emitToastToAll(`🛡️ ${target.name} صد «${attackDef.nameAr}» بـ بريك الفطار!`, 'info');
        if (target.isBot && Math.random() < 0.55) {
          const stickerId = Math.random() < 0.5 ? 'cool_shades' : 'big_brain';
          setTimeout(() => this.handleSendSticker(target.id, stickerId), 450);
        }
      }
    }

    if (!block) {
      const targetHandBefore = target.hand.length;
      const targetFileBefore = target.fileCards.length;
      executeCardEffect(this.getState(), caster, cardPlayed, targetId, targetDoc);
      // system_down stays on target.frozenCard until target unfreezes next turn; all other pranks/wasta go to discardPile
      if (cardPlayed.cardType !== 'system_down') {
        this.discardPile.push(cardPlayed);
      }

      const docName = targetDoc ? CARD_DEFINITIONS[targetDoc].nameAr : '';
      let explanationAr = `${caster.name} نفّذ «${attackDef.nameAr}» على ${target.name}.`;
      let bubbleActorAr = `${attackDef.nameAr}!`;
      let bubbleTargetAr = 'يا ساتر!';

      switch (cardPlayed.cardType) {
        case 'system_down':
          explanationAr = `${caster.name} حط «السيستم واقع» على ${target.name} — ${target.name} اتجمّد وهيفوّت دوره الجاي!`;
          bubbleActorAr = `السيستم وقع عند ${target.name}!`;
          bubbleTargetAr = 'اتجمّدت ❄️';
          break;
        case 'come_tomorrow':
          explanationAr = `${caster.name} شال ورقة «${docName}» من ملف ${target.name} ورماها في الأرشيف!`;
          bubbleActorAr = `فوت علينا بكرة!`;
          bubbleTargetAr = `طارت ${docName} 🚪`;
          break;
        case 'missing_papers': {
          const lost = Math.max(0, targetHandBefore - target.hand.length);
          explanationAr = `${caster.name} سحب ${lost} كارت عشوائي من إيد ${target.name} ورماهم في الأرشيف!`;
          bubbleActorAr = `ورقك ناقص!`;
          bubbleTargetAr = `طار مني ${lost} كارت 📄`;
          break;
        }
        case 'window_4':
          explanationAr = `${caster.name} بدّل كل الكروت اللي في إيده مع كل الكروت اللي في إيد ${target.name}!`;
          bubbleActorAr = `بدّلنا الإيد 🪟`;
          bubbleTargetAr = `كروتي اتبدّلت!`;
          break;
        case 'file_lost':
          explanationAr = `ضربة قوية! كل ورق ${target.name} (${targetFileBefore} ورقات) رجع لإيده وملفه رجع فاضي!`;
          bubbleActorAr = `ملفك ضاع 💥`;
          bubbleTargetAr = `ملفي رجع إيدي!`;
          break;
        case 'wasta':
          explanationAr = `بالواسطة! ${caster.name} سرق «${docName}» من ملف ${target.name} وحطها في ملفه على طول!`;
          bubbleActorAr = `أخدت ${docName} 🤝`;
          bubbleTargetAr = `اتسرقت ${docName}!`;
          break;
      }

      this.recordEvent({
        actorId: caster.id,
        actorName: caster.name,
        targetId: target.id,
        targetName: target.name,
        cardType: cardPlayed.cardType,
        targetDoc,
        blocked: false,
        headlineAr: `💣 ${caster.name} رمى «${attackDef.nameAr}» على ${target.name}`,
        explanationAr,
        bubbleActorAr,
        bubbleTargetAr,
      });

      this.emitSoundToAll('swoosh');
      if (cardPlayed.cardType === 'file_lost') {
        this.emitToastToAll(`📁 الملف ضاع! ورق ${target.name} رجع لإيده!`, 'danger');
        if (target.isBot) {
          setTimeout(() => this.handleSendSticker(target.id, Math.random() < 0.5 ? 'this_is_fine' : 'pain_coffee'), 450);
        }
      } else if (cardPlayed.cardType === 'wasta' && targetDoc) {
        this.emitToastToAll(`🤝 ${caster.name} سرق «${docName}» من ${target.name}!`, 'warning');
        if (caster.isBot && Math.random() < 0.5) {
          setTimeout(() => this.handleSendSticker(caster.id, 'stonks'), 450);
        }
      } else if (target.isBot && Math.random() < 0.35) {
        const reactPool = ['surprised_shock', 'table_cat', 'pain_coffee'];
        setTimeout(() => this.handleSendSticker(target.id, reactPool[Math.floor(Math.random() * reactPool.length)]), 450);
      }
    }

    this.actionsRemaining--;
    this.pendingReaction = null;

    if (this.actionsRemaining <= 0) {
      this.transitionTo('DISCARD_PHASE');
    } else {
      this.phase = 'ACTION_PHASE';
      if (caster.isBot || caster.isDisconnected || this.isAfkTakeover) {
        this.broadcastState();
        this.botTimer = setTimeout(() => this.executeBotTurn(), getBotTurnDelay());
      } else {
        this.scheduleHumanTurnTimer(caster);
        this.broadcastState();
      }
    }
  }

  public handlePickArchive(playerId: string, cardInstanceId: string): void {
    if (this.phase !== 'PENDING_ARCHIVE') return;
    if (!this.pendingArchive) return;
    if (this.pendingArchive.playerId !== playerId) return;
    if (cardInstanceId && cardInstanceId === this.pendingArchivePlayedCardId) {
      this.emitError(playerId, 'مينفعش تسحب كارت عم جمال نفسه!');
      return;
    }

    this.clearAllTimers();
    const player = this.players.find(p => p.id === playerId)!;

    const cardIdx = this.discardPile.findIndex(
      c => c.instanceId === cardInstanceId && c.instanceId !== this.pendingArchivePlayedCardId,
    );
    if (cardIdx !== -1) {
      const card = this.discardPile.splice(cardIdx, 1)[0];
      player.hand.push(card);
      const pickedName = CARD_DEFINITIONS[card.cardType].nameAr;
      addLogEntry(this.getState(), `${player.name} أخد «${pickedName}» من الأرشيف!`);
      this.recordEvent({
        actorId: player.id,
        actorName: player.name,
        cardType: 'uncle_gamal',
        headlineAr: `👴 ${player.name} لعب «عم جمال (الأرشيف)»`,
        explanationAr: `${player.name} فرّ الأرشيف المكشوف وسحب منه «${pickedName}» لإيده!`,
        bubbleActorAr: `أخدت ${pickedName} 👴`,
      });
    }

    this.actionsRemaining--;
    this.pendingArchive = null;
    this.pendingArchivePlayedCardId = null;

    if (this.actionsRemaining <= 0) {
      this.transitionTo('DISCARD_PHASE');
    } else {
      this.phase = 'ACTION_PHASE';
      if (player.isBot || player.isDisconnected || this.isAfkTakeover) {
        this.broadcastState();
        this.botTimer = setTimeout(() => this.executeBotTurn(), getBotTurnDelay());
      } else {
        this.scheduleHumanTurnTimer(player);
        this.broadcastState();
      }
    }
  }

  public executeDiscard(player: ServerPlayer, cardInstanceIds: string[]): void {
    const excess = player.hand.length - GAME_CONSTANTS.MAX_HAND_SIZE;
    if (excess <= 0) {
      this.transitionTo('TURN_END');
      return;
    }

    const toRemove = cardInstanceIds.slice(0, excess);
    for (const id of toRemove) {
      const idx = player.hand.findIndex(c => c.instanceId === id);
      if (idx !== -1) {
        const card = player.hand.splice(idx, 1)[0];
        this.discardPile.push(card);
      }
    }

    // Safety net: if invalid/duplicate IDs were sent and excess still > 0, discard from end
    while (player.hand.length > GAME_CONSTANTS.MAX_HAND_SIZE) {
      const card = player.hand.pop()!;
      this.discardPile.push(card);
    }

    this.transitionTo('TURN_END');
  }

  public handleDiscardCards(playerId: string, cardInstanceIds: string[]): void {
    if (this.phase !== 'DISCARD_PHASE') return;
    if (this.currentPlayer.id !== playerId) return;

    this.clearAllTimers();
    this.executeDiscard(this.currentPlayer, cardInstanceIds);
  }

  // === Bot Turn Execution ===

  private executeBotTurn(): void {
    if (this.phase !== 'ACTION_PHASE') return;
    if (this.actionsRemaining <= 0) {
      this.transitionTo('DISCARD_PHASE');
      return;
    }

    const bot = this.currentPlayer;
    const decision = decideBotAction(this.getState(), bot);

    if (decision.type === 'end_turn') {
      this.transitionTo('DISCARD_PHASE');
    } else if (decision.cardInstanceId) {
      this.handlePlayCard(
        bot.id,
        decision.cardInstanceId,
        decision.targetPlayerId,
        decision.targetDocument,
      );
    } else {
      this.transitionTo('DISCARD_PHASE');
    }
  }

  // === Tie-Breaker ===

  private calculateTieBreaker(): void {
    addLogEntry(this.getState(), 'الساعة جت 2 الضهر — الموظف مشي!');

    const sorted = [...this.players].sort((a, b) => {
      if (b.file.length !== a.file.length) return b.file.length - a.file.length;
      if (b.hand.length !== a.hand.length) return b.hand.length - a.hand.length;
      return 0;
    });

    const topFile = sorted[0].file.length;
    const topHand = sorted[0].hand.length;
    const winners = sorted.filter(p => p.file.length === topFile && p.hand.length === topHand);

    this.winnerIds = winners.map(p => p.id);
    this.winReason = 'TWO_PM_TIMEOUT';
  }

  // === Disconnect / Reconnect ===

  public handleDisconnect(socketId: string): void {
    const player = this.players.find(p => p.socketId === socketId);
    if (!player || player.isBot) return;

    player.isDisconnected = true;
    player.socketId = null;
    this.broadcastState();

    // Check if all humans disconnected
    if (this.connectedHumanCount === 0 && this.phase !== 'LOBBY') {
      this.cleanupTimer = setTimeout(() => {
        // Cleaned up by RoomManager periodic check
      }, GAME_CONSTANTS.ROOM_CLEANUP_TIMEOUT_MS);
    }
  }

  public handleReconnect(sessionId: string, newSocketId: string): ServerPlayer | null {
    const player = this.findPlayerBySession(sessionId);
    if (!player) return null;

    player.socketId = newSocketId;
    player.isDisconnected = false;
    this.clearCleanupTimer();
    this.broadcastState();

    return player;
  }

  // === State Broadcasting ===

  private getState(): ServerGameState {
    const self = this;
    return {
      players: this.players,
      get deck() { return self.deck; },
      set deck(v: Card[]) { self.deck = v; },
      get discardPile() { return self.discardPile; },
      set discardPile(v: Card[]) { self.discardPile = v; },
      globalEffects: this.globalEffects,
      get activeMedhatCard() { return self.activeMedhatCard; },
      set activeMedhatCard(v: Card | null) { self.activeMedhatCard = v; },
      actionLog: this.actionLog,
    };
  }

  /** Total physical cards currently in play (must always equal 64 once started) */
  public getTotalCardCount(): number {
    let total = this.deck.length + this.discardPile.length;
    if (this.activeMedhatCard) total += 1;
    if (this.pendingReaction) total += 1;
    for (const p of this.players) {
      total += p.hand.length + p.fileCards.length + (p.frozenCard ? 1 : 0);
    }
    return total;
  }

  public getPublicState(): PublicGameState {
    return {
      roomCode: this.roomCode,
      hostId: this.hostId,
      phase: this.phase,
      roundNumber: this.roundNumber,
      currentTurnPlayerId: this.players[this.currentTurnIndex]?.id ?? '',
      actionsRemaining: this.actionsRemaining,
      turnExpiresAt: this.turnExpiresAt,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        avatarId: p.avatarId,
        isBot: p.isBot,
        isDisconnected: p.isDisconnected,
        isFrozen: p.isFrozen,
        file: [...p.file],
        handCount: p.hand.length,
      })),
      deckCount: this.deck.length,
      discardPileTop: this.discardPile.length > 0 ? this.discardPile[this.discardPile.length - 1] : null,
      discardPileCount: this.discardPile.length,
      globalEffects: { ...this.globalEffects },
      pendingReaction: this.pendingReaction ? { ...this.pendingReaction } : null,
      pendingArchive: this.pendingArchive ? { ...this.pendingArchive } : null,
      actionLog: [...this.actionLog],
      lastEvent: this.lastEvent ? { ...this.lastEvent } : null,
      eventHistory: [...this.eventHistory],
      winnerIds: this.winnerIds,
      winReason: this.winReason,
    };
  }

  private recordEvent(ev: Omit<GameEventNotice, 'id' | 'timestamp'>): void {
    const notice: GameEventNotice = {
      ...ev,
      id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
    };
    this.lastEvent = notice;
    this.eventHistory.push(notice);
    if (this.eventHistory.length > 12) {
      this.eventHistory.shift();
    }
  }

  public getLobbyState(): LobbyState {
    return {
      roomCode: this.roomCode,
      hostId: this.hostId,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        avatarId: p.avatarId,
        isBot: p.isBot,
        isReady: true,
      })),
      maxPlayers: GAME_CONSTANTS.MAX_PLAYERS,
    };
  }

  private getPrivateState(player: ServerPlayer, archiveCards?: Card[]): PrivateGameState {
    return {
      playerId: player.id,
      hand: [...player.hand],
      archiveCards: archiveCards ?? null,
    };
  }

  public broadcastPublicState(): void {
    this.io.to(this.roomCode).emit('game:public_state', this.getPublicState());
  }

  private emitPrivateState(player: ServerPlayer, archiveCards?: Card[]): void {
    if (player.socketId) {
      this.io.to(player.socketId).emit('game:private_state', this.getPrivateState(player, archiveCards));
    }
  }

  public broadcastState(): void {
    this.broadcastPublicState();
    for (const p of this.players) {
      if (p.socketId) {
        const archive = (this.phase === 'PENDING_ARCHIVE' && this.pendingArchive?.playerId === p.id)
          ? this.discardPile.filter(c => c.instanceId !== this.pendingArchivePlayedCardId)
          : undefined;
        this.emitPrivateState(p, archive);
      }
    }
  }

  public broadcastLobbyState(): void {
    this.io.to(this.roomCode).emit('lobby:state', this.getLobbyState());
  }

  private emitError(playerId: string, message: string): void {
    const player = this.players.find(p => p.id === playerId);
    if (player?.socketId) {
      this.io.to(player.socketId).emit('room:error', { message });
    }
  }

  private emitSoundToAll(sound: SoundEffect): void {
    this.io.to(this.roomCode).emit('game:sound', { sound });
  }

  private emitSoundToPlayer(player: ServerPlayer, sound: SoundEffect): void {
    if (player.socketId) {
      this.io.to(player.socketId).emit('game:sound', { sound });
    }
  }

  private emitToastToAll(message: string, type: 'info' | 'success' | 'warning' | 'danger'): void {
    this.io.to(this.roomCode).emit('game:toast', { message, type });
  }

  public handleSendSticker(playerId: string, stickerId: string): void {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return;
    this.io.to(this.roomCode).emit('game:sticker', {
      playerId: player.id,
      playerName: player.name,
      stickerId,
      timestamp: Date.now(),
    });
  }

  public get isEmpty(): boolean {
    return this.players.filter(p => !p.isBot).length === 0;
  }

  public get shouldCleanup(): boolean {
    if (this.phase === 'LOBBY' && this.isEmpty) return true;
    if (this.phase !== 'LOBBY' && this.connectedHumanCount === 0) {
      return Date.now() - this.lastActivity > GAME_CONSTANTS.ROOM_CLEANUP_TIMEOUT_MS;
    }
    return false;
  }
}
