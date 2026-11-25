// ========================
// EL-KHETM — Authoritative Game Room State Machine
// ========================

import { v4 as uuidv4 } from 'uuid';
import type { Server as SocketServer } from 'socket.io';
import {
  Card,
  CardType,
  DrawSource,
  GamePhase,
  GameEventNotice,
  PublicGameState,
  PrivateGameState,
  LobbyState,
  PendingReaction,
  PendingArchive,
  PendingDeckSort,
  PendingTargetDiscard,
  ActivePeekInfo,
  SlotHighlight,
  SpotlightCardNotice,
  PlayerScoreBreakdown,
  GlobalEffects,
  WinReason,
  PlayCardPayload,
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
  calculatePlayerScore,
  CORE_DOCUMENTS,
} from '@el-khetm/shared';
import {
  ServerPlayer,
  ServerGameState,
  syncPlayerFile,
  getNextPlayer,
  getPrevPlayer,
  markSlotSeen,
  clearSlotMemoryAcrossPlayers,
  validateCardPlay,
  popDeckCard,
  drawCard,
  refillOpenMarket,
  addLogEntry,
  executeSystemDown,
  executeComeTomorrow,
  executeWindow4,
  executeMedhatVacation,
  executeFileLost,
  executeWasta,
  executeDeskSwap,
  executeRecommendation,
} from './CardEffects';
import {
  decideBotDraw,
  decideBotAction,
  shouldBlock,
  chooseArchiveCard,
  chooseDiscard,
  chooseSortDeckOrder,
  getBotTurnDelay,
  getBotReactionDelay,
} from './BotAI';

export class GameRoom {
  public roomCode: string;
  public hostId: string;
  public phase: GamePhase = 'LOBBY';
  public players: ServerPlayer[] = [];
  public deck: Card[] = [];
  public openMarket: (Card | null)[] = [null, null, null];
  public discardPile: Card[] = [];
  public globalEffects: GlobalEffects = { medhatVacationUntilPlayerId: null };
  public activeMedhatCard: Card | null = null;
  public roundNumber: number = 0;
  public currentTurnIndex: number = 0;
  public actionsRemaining: number = 0;
  public matchedThisTurn: boolean = false;
  public actionLog: string[] = [];
  public lastEvent: GameEventNotice | null = null;
  public eventHistory: GameEventNotice[] = [];
  public winnerIds: string[] | null = null;
  public winReason: WinReason = null;
  public scoreBreakdowns: Record<string, PlayerScoreBreakdown> = {};

  public pendingReaction: PendingReaction | null = null;
  public pendingArchive: PendingArchive | null = null;
  public pendingArchivePlayedCardId: string | null = null;
  public pendingSort: PendingDeckSort | null = null;
  public pendingSortCards: Card[] = [];
  public pendingTargetDiscard: PendingTargetDiscard | null = null;

  public windowClosedByPlayerId: string | null = null;
  public finalTurnQueueIds: string[] = [];

  public recentSlotHighlights: SlotHighlight[] = [];
  public spotlightCard: SpotlightCardNotice | null = null;

  public turnExpiresAt: number | null = null;
  public peekStartExpiresAt: number | null = null;
  private activePeeks: Record<string, ActivePeekInfo> = {};
  private activeMultiPeeks: Record<string, { items: ActivePeekInfo[]; expiresAt: number }> = {};
  private peekExpireTimers: Record<string, ReturnType<typeof setTimeout>> = {};
  private multiPeekExpireTimers: Record<string, ReturnType<typeof setTimeout>> = {};
  private highlightPruneTimer: ReturnType<typeof setTimeout> | null = null;
  private spotlightExpireTimer: ReturnType<typeof setTimeout> | null = null;

  private io: SocketServer;
  private isProcessing: boolean = false;
  private isAfkTakeover: boolean = false;
  private peekStartTimer: ReturnType<typeof setTimeout> | null = null;
  private drawTimer: ReturnType<typeof setTimeout> | null = null;
  private turnTimer: ReturnType<typeof setTimeout> | null = null;
  private reactionTimer: ReturnType<typeof setTimeout> | null = null;
  private archiveTimer: ReturnType<typeof setTimeout> | null = null;
  private sortTimer: ReturnType<typeof setTimeout> | null = null;
  private targetDiscardTimer: ReturnType<typeof setTimeout> | null = null;
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
    if (this.peekStartTimer) { clearTimeout(this.peekStartTimer); this.peekStartTimer = null; }
    if (this.drawTimer) { clearTimeout(this.drawTimer); this.drawTimer = null; }
    if (this.turnTimer) { clearTimeout(this.turnTimer); this.turnTimer = null; }
    if (this.reactionTimer) { clearTimeout(this.reactionTimer); this.reactionTimer = null; }
    if (this.archiveTimer) { clearTimeout(this.archiveTimer); this.archiveTimer = null; }
    if (this.sortTimer) { clearTimeout(this.sortTimer); this.sortTimer = null; }
    if (this.targetDiscardTimer) { clearTimeout(this.targetDiscardTimer); this.targetDiscardTimer = null; }
    if (this.discardTimer) { clearTimeout(this.discardTimer); this.discardTimer = null; }
    if (this.botTimer) { clearTimeout(this.botTimer); this.botTimer = null; }
    if (this.frozenTimer) { clearTimeout(this.frozenTimer); this.frozenTimer = null; }
    if (this.turnEndTimer) { clearTimeout(this.turnEndTimer); this.turnEndTimer = null; }
    this.turnExpiresAt = null;
  }

  private clearVisualEffectTimers(): void {
    for (const k of Object.keys(this.peekExpireTimers)) {
      clearTimeout(this.peekExpireTimers[k]);
      delete this.peekExpireTimers[k];
    }
    for (const k of Object.keys(this.multiPeekExpireTimers)) {
      clearTimeout(this.multiPeekExpireTimers[k]);
      delete this.multiPeekExpireTimers[k];
    }
    if (this.highlightPruneTimer) { clearTimeout(this.highlightPruneTimer); this.highlightPruneTimer = null; }
    if (this.spotlightExpireTimer) { clearTimeout(this.spotlightExpireTimer); this.spotlightExpireTimer = null; }
    this.activePeeks = {};
    this.activeMultiPeeks = {};
    this.recentSlotHighlights = [];
    this.spotlightCard = null;
  }

  public clearCleanupTimer(): void {
    if (this.cleanupTimer) { clearTimeout(this.cleanupTimer); this.cleanupTimer = null; }
  }

  public destroy(): void {
    this.clearAllTimers();
    this.clearVisualEffectTimers();
    this.clearCleanupTimer();
  }

  // === Visual Slot Highlights & Spotlight Helpers ===

  private addSlotHighlights(
    items: Array<{ playerId: string; slotIndex: number; kind: SlotHighlight['kind']; labelAr: string }>,
  ): void {
    const now = Date.now();
    const expiresAt = now + GAME_CONSTANTS.SLOT_HIGHLIGHT_DURATION_MS;
    this.recentSlotHighlights = this.recentSlotHighlights.filter(h => h.expiresAt > now);
    for (const item of items) {
      this.recentSlotHighlights.push({
        id: `hl_${now}_${Math.random().toString(36).slice(2, 6)}`,
        playerId: item.playerId,
        slotIndex: item.slotIndex,
        kind: item.kind,
        labelAr: item.labelAr,
        expiresAt,
      });
    }
    if (this.highlightPruneTimer) clearTimeout(this.highlightPruneTimer);
    this.highlightPruneTimer = setTimeout(() => {
      const t = Date.now();
      this.recentSlotHighlights = this.recentSlotHighlights.filter(h => h.expiresAt > t);
      if (this.phase !== 'LOBBY') this.broadcastPublicState();
    }, GAME_CONSTANTS.SLOT_HIGHLIGHT_DURATION_MS + 50);
  }

  private setSpotlight(
    cardType: CardType,
    headlineAr: string,
    subtitleAr: string,
    actorName: string,
    targetName?: string,
  ): void {
    const expiresAt = Date.now() + GAME_CONSTANTS.SPOTLIGHT_DURATION_MS;
    this.spotlightCard = {
      id: `spot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      cardType,
      headlineAr,
      subtitleAr,
      actorName,
      targetName,
      expiresAt,
    };
    if (this.spotlightExpireTimer) clearTimeout(this.spotlightExpireTimer);
    this.spotlightExpireTimer = setTimeout(() => {
      if (this.spotlightCard && this.spotlightCard.expiresAt <= Date.now()) {
        this.spotlightCard = null;
        if (this.phase !== 'LOBBY') this.broadcastPublicState();
      }
    }, GAME_CONSTANTS.SPOTLIGHT_DURATION_MS + 50);
  }

  private scheduleBotSticker(bot: ServerPlayer, stickerId: string, delayMs: number = 450): void {
    if (!bot.isBot) return;
    setTimeout(() => this.handleSendSticker(bot.id, stickerId), delayMs);
  }

  // === Lobby Management ===

  private makeEmptyPlayerBase(
    id: string,
    name: string,
    avatarId: string,
    isBot: boolean,
    socketId: string | null,
    sessionId: string,
  ): ServerPlayer {
    return {
      id,
      name,
      avatarId,
      isBot,
      isDisconnected: false,
      isFrozen: false,
      frozenCard: null,
      isImmuneThisRound: false,
      dossierSlots: [null, null, null, null],
      startPeeksRemaining: GAME_CONSTANTS.START_PEEKS_COUNT,
      matchScore: 0,
      seenSlotsByPlayer: {},
      tamperedSlotsByPlayer: {},
      botMemory: {},
      file: [],
      hand: [],
      socketId,
      sessionId,
    };
  }

  public addPlayer(id: string, name: string, avatarId: string, sessionId: string, socketId: string): ServerPlayer {
    const player = this.makeEmptyPlayerBase(id, name, avatarId, false, socketId, sessionId);
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

    const bot = this.makeEmptyPlayerBase(
      `bot_${uuidv4().slice(0, 8)}`,
      botName,
      'bot',
      true,
      null,
      `bot_session_${uuidv4().slice(0, 8)}`,
    );
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

    this.clearAllTimers();
    this.clearVisualEffectTimers();

    this.deck = shuffleDeck(generateDeck());
    this.openMarket = [null, null, null];
    this.discardPile = [];
    this.roundNumber = 1;
    this.currentTurnIndex = 0;
    this.actionsRemaining = 0;
    this.matchedThisTurn = false;
    this.globalEffects = { medhatVacationUntilPlayerId: null };
    this.activeMedhatCard = null;
    this.actionLog = [];
    this.lastEvent = null;
    this.eventHistory = [];
    this.winnerIds = null;
    this.winReason = null;
    this.scoreBreakdowns = {};
    this.pendingReaction = null;
    this.pendingArchive = null;
    this.pendingArchivePlayedCardId = null;
    this.pendingSort = null;
    this.pendingSortCards = [];
    this.pendingTargetDiscard = null;
    this.windowClosedByPlayerId = null;
    this.finalTurnQueueIds = [];
    this.isAfkTakeover = false;

    for (const p of this.players) {
      p.dossierSlots = [null, null, null, null];
      p.hand = [];
      p.file = [];
      p.isFrozen = false;
      p.frozenCard = null;
      p.isImmuneThisRound = false;
      p.startPeeksRemaining = GAME_CONSTANTS.START_PEEKS_COUNT;
      p.matchScore = 0;
      p.seenSlotsByPlayer = {};
      p.tamperedSlotsByPlayer = {};
      p.botMemory = {};
    }

    // Deal 4 face-down cards into each player's dossier
    for (let s = 0; s < GAME_CONSTANTS.DOSSIER_SLOTS; s++) {
      for (const p of this.players) {
        p.dossierSlots[s] = popDeckCard(this.getState());
      }
    }
    for (const p of this.players) {
      syncPlayerFile(p);
      if (p.isBot) {
        for (let s = 0; s < 2; s++) {
          const c = p.dossierSlots[s];
          if (c) markSlotSeen(p, p.id, s, c.cardType);
        }
        p.startPeeksRemaining = 0;
      }
    }

    // Deal 3 starting hand cards
    for (let i = 0; i < GAME_CONSTANTS.STARTING_HAND_SIZE; i++) {
      for (const p of this.players) {
        drawCard(this.getState(), p);
      }
    }

    // Populate Open Market & initial Archive card
    refillOpenMarket(this.getState());
    const starterArchive = popDeckCard(this.getState());
    if (starterArchive) {
      this.discardPile.push(starterArchive);
    }

    addLogEntry(this.getState(), 'الجيم بدأ! بص بسرعة على ورقك واحفظ أماكنه!');
    this.transitionTo('PEEK_START');
  }

  // === State Machine Transitions ===

  private transitionTo(newPhase: GamePhase): void {
    this.clearAllTimers();
    this.phase = newPhase;
    this.lastActivity = Date.now();

    switch (newPhase) {
      case 'PEEK_START':
        this.handlePeekStartPhase();
        break;
      case 'TURN_START':
        this.handleTurnStart();
        break;
      case 'DRAW_PHASE':
        this.handleDrawPhase();
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

  private handlePeekStartPhase(): void {
    this.peekStartExpiresAt = Date.now() + GAME_CONSTANTS.PEEK_START_TIMER_MS;
    this.recordEvent({
      actorId: this.players[0].id,
      actorName: 'الكل',
      headlineAr: '👁️ نظرة البداية!',
      explanationAr: 'كل لاعب يضغط على خانتين في ملفه (الطالب يشوف 3!) عشان يحفظ أماكنهم قبل ما يبدأ اللعب.',
    });
    this.broadcastState();
    this.emitSoundToAll('card_draw');

    this.peekStartTimer = setTimeout(() => {
      if (this.phase === 'PEEK_START') {
        this.peekStartExpiresAt = null;
        this.transitionTo('TURN_START');
      }
    }, GAME_CONSTANTS.PEEK_START_TIMER_MS);
  }

  public handleStartPeek(playerId: string, slotIndex: number): void {
    if (this.phase !== 'PEEK_START') return;
    if (slotIndex < 0 || slotIndex >= GAME_CONSTANTS.DOSSIER_SLOTS) return;
    const player = this.players.find(p => p.id === playerId);
    if (!player) return;
    if (player.startPeeksRemaining <= 0) {
      this.emitError(playerId, 'خلصت نظرات البداية بتاعتك');
      return;
    }
    const card = player.dossierSlots[slotIndex];
    if (!card) return;
    if (player.seenSlotsByPlayer[player.id]?.has(slotIndex)) {
      this.emitError(playerId, 'إنت شفت الخانة دي خلاص — اختار خانة تانية');
      return;
    }

    player.startPeeksRemaining--;
    markSlotSeen(player, player.id, slotIndex, card.cardType);
    this.setPrivatePeek(player, player.id, slotIndex, card, 3800);
    this.emitSoundToPlayer(player, 'peek_chime');
    this.broadcastState();

    const allHumansDone = this.players
      .filter(p => !p.isBot && !p.isDisconnected)
      .every(p => p.startPeeksRemaining <= 0);
    if (allHumansDone && this.peekStartTimer) {
      clearTimeout(this.peekStartTimer);
      this.peekStartTimer = setTimeout(() => {
        if (this.phase === 'PEEK_START') {
          this.peekStartExpiresAt = null;
          this.transitionTo('TURN_START');
        }
      }, 2800);
    }
  }

  private setPrivatePeek(
    viewer: ServerPlayer,
    targetPlayerId: string,
    slotIndex: number,
    card: Card,
    durationMs: number = GAME_CONSTANTS.ACTIVE_PEEK_DURATION_MS,
  ): void {
    if (this.peekExpireTimers[viewer.id]) {
      clearTimeout(this.peekExpireTimers[viewer.id]);
    }
    const expiresAt = Date.now() + durationMs;
    this.activePeeks[viewer.id] = { targetPlayerId, slotIndex, card, expiresAt };
    this.peekExpireTimers[viewer.id] = setTimeout(() => {
      if (this.activePeeks[viewer.id]?.expiresAt === expiresAt) {
        delete this.activePeeks[viewer.id];
        delete this.peekExpireTimers[viewer.id];
        this.emitPrivateState(viewer);
      }
    }, durationMs);
  }

  private setPrivateMultiPeek(
    viewer: ServerPlayer,
    items: Array<{ targetPlayerId: string; slotIndex: number; card: Card }>,
    durationMs: number = GAME_CONSTANTS.MULTI_PEEK_DURATION_MS,
  ): void {
    if (this.multiPeekExpireTimers[viewer.id]) {
      clearTimeout(this.multiPeekExpireTimers[viewer.id]);
    }
    const expiresAt = Date.now() + durationMs;
    this.activeMultiPeeks[viewer.id] = {
      items: items.map(it => ({ ...it, expiresAt })),
      expiresAt,
    };
    this.multiPeekExpireTimers[viewer.id] = setTimeout(() => {
      if (this.activeMultiPeeks[viewer.id]?.expiresAt === expiresAt) {
        delete this.activeMultiPeeks[viewer.id];
        delete this.multiPeekExpireTimers[viewer.id];
        this.emitPrivateState(viewer);
      }
    }, durationMs);
  }

  private handleTurnStart(): void {
    this.peekStartExpiresAt = null;
    const player = this.currentPlayer;
    this.isAfkTakeover = false;
    this.matchedThisTurn = false;

    // Anti-spam Round Shield clears when it becomes this player's turn again!
    player.isImmuneThisRound = false;

    if (this.globalEffects.medhatVacationUntilPlayerId === player.id) {
      this.globalEffects.medhatVacationUntilPlayerId = null;
      if (this.activeMedhatCard) {
        this.discardPile.push(this.activeMedhatCard);
        this.activeMedhatCard = null;
      }
    }

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
        explanationAr: `${player.name} متجمّد الدور ده ومش هيسحب ولا يلعب.`,
        bubbleActorAr: 'دوري فات ❄️',
      });
      this.broadcastState();
      this.emitSoundToAll('buzz');
      this.frozenTimer = setTimeout(() => this.transitionTo('TURN_END'), GAME_CONSTANTS.FROZEN_SKIP_DELAY_MS);
      return;
    }

    this.transitionTo('DRAW_PHASE');
  }

  private handleDrawPhase(): void {
    this.phase = 'DRAW_PHASE';
    refillOpenMarket(this.getState());
    const player = this.currentPlayer;

    if (player.isBot || player.isDisconnected) {
      this.broadcastState();
      this.botTimer = setTimeout(() => {
        if (this.phase !== 'DRAW_PHASE' || this.currentPlayer.id !== player.id) return;
        const drawDecision = decideBotDraw(this.getState(), player);
        this.executeDraw(player, drawDecision.source, drawDecision.marketIndex);
      }, GAME_CONSTANTS.BOT_DRAW_DELAY_MS);
      return;
    }

    this.turnExpiresAt = Date.now() + GAME_CONSTANTS.DRAW_TIMER_MS;
    this.broadcastState();
    this.drawTimer = setTimeout(() => {
      if (this.phase !== 'DRAW_PHASE' || this.currentPlayer.id !== player.id) return;
      this.isAfkTakeover = true;
      this.executeDraw(player, 'deck');
    }, GAME_CONSTANTS.DRAW_TIMER_MS);
  }

  public handleDrawCard(playerId: string, source: DrawSource, marketIndex?: number): void {
    if (this.phase !== 'DRAW_PHASE') return;
    if (this.currentPlayer.id !== playerId) return;
    this.clearAllTimers();
    this.executeDraw(this.currentPlayer, source, marketIndex);
  }

  private executeDraw(player: ServerPlayer, source: DrawSource, marketIndex?: number): void {
    const state = this.getState();
    let drawn: Card | null = null;

    if (source === 'market' && marketIndex !== undefined && marketIndex >= 0 && marketIndex < GAME_CONSTANTS.OPEN_MARKET_SIZE) {
      const marketCard = this.openMarket[marketIndex];
      if (marketCard) {
        this.openMarket[marketIndex] = null;
        player.hand.push(marketCard);
        drawn = marketCard;
        refillOpenMarket(state);
        const cardName = CARD_DEFINITIONS[marketCard.cardType].nameAr;
        addLogEntry(state, `${player.name} سحب «${cardName}» من شباك الطلبات!`);
        this.recordEvent({
          actorId: player.id,
          actorName: player.name,
          cardType: marketCard.cardType,
          headlineAr: `🪟 ${player.name} سحب «${cardName}» من شباك الطلبات`,
          explanationAr: `${player.name} اختار «${cardName}» المكشوف من الشباك!`,
          bubbleActorAr: `أخدت ${cardName}`,
        });
      }
    }

    if (!drawn) {
      drawn = drawCard(state, player);
      addLogEntry(state, `${player.name} سحب كارت من الكومة`);
    }

    this.actionsRemaining = GAME_CONSTANTS.ACTIONS_PER_TURN;
    this.emitSoundToAll('card_draw');
    this.transitionTo('ACTION_PHASE');

    if (player.isBot || player.isDisconnected || this.isAfkTakeover) {
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
      }, 650);
    } else {
      this.discardTimer = setTimeout(() => {
        if (this.phase !== 'DISCARD_PHASE' || this.currentPlayer.id !== player.id) return;
        const decision = chooseDiscard(player, excess);
        this.executeDiscard(player, decision.cardInstanceIds);
      }, GAME_CONSTANTS.DISCARD_TIMER_MS);
    }
  }

  private handleTurnEnd(): void {
    if (this.windowClosedByPlayerId !== null) {
      if (this.finalTurnQueueIds.length === 0) {
        this.calculateFinalShowdown('WINDOW_CLOSED');
        this.transitionTo('GAME_OVER');
        return;
      }
      const nextId = this.finalTurnQueueIds.shift()!;
      const nextIdx = this.players.findIndex(p => p.id === nextId);
      if (nextIdx === -1) {
        this.calculateFinalShowdown('WINDOW_CLOSED');
        this.transitionTo('GAME_OVER');
        return;
      }
      const prevWasBot = this.players[this.currentTurnIndex]?.isBot ?? false;
      this.currentTurnIndex = nextIdx;
      const nextIsBot = this.players[this.currentTurnIndex]?.isBot ?? false;
      if (prevWasBot || nextIsBot) {
        this.broadcastState();
        this.turnEndTimer = setTimeout(() => {
          if (this.phase === 'TURN_END') this.transitionTo('TURN_START');
        }, prevWasBot ? GAME_CONSTANTS.BOT_TURN_END_PAUSE_MS : 650);
      } else {
        this.transitionTo('TURN_START');
      }
      return;
    }

    const prevWasBot = this.players[this.currentTurnIndex]?.isBot ?? false;
    this.currentTurnIndex = (this.currentTurnIndex + 1) % this.players.length;
    if (this.currentTurnIndex === 0) {
      this.roundNumber++;
    }

    if (this.roundNumber > GAME_CONSTANTS.MAX_ROUNDS) {
      this.calculateFinalShowdown('TWO_PM_TIMEOUT');
      this.transitionTo('GAME_OVER');
      return;
    }

    const nextIsBot = this.players[this.currentTurnIndex]?.isBot ?? false;
    if (prevWasBot || nextIsBot) {
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
    this.spotlightCard = null;
    this.broadcastState();
    this.emitSoundToAll('win_fanfare');
  }

  // === Game Actions ===

  public handlePlaceInSlot(playerId: string, cardInstanceId: string, slotIndex: number): void {
    if (this.isProcessing) return;
    if (this.phase !== 'ACTION_PHASE') return;
    if (this.currentPlayer.id !== playerId) return;
    if (this.actionsRemaining <= 0) return;
    if (slotIndex < 0 || slotIndex >= GAME_CONSTANTS.DOSSIER_SLOTS) return;

    this.isProcessing = true;
    try {
      const caster = this.currentPlayer;
      const cardIdx = caster.hand.findIndex(c => c.instanceId === cardInstanceId);
      if (cardIdx === -1) {
        this.emitError(playerId, 'الكارت مش في إيدك');
        return;
      }
      const card = caster.hand[cardIdx];
      const medhatActive = this.globalEffects.medhatVacationUntilPlayerId !== null;
      if (card.cardType === 'manager_sign' && medhatActive) {
        this.emitError(playerId, '🏖️ الأستاذ مدحت في إجازة — ممنوع تنزيل إمضاء المدير لفة كاملة!');
        return;
      }

      caster.hand.splice(cardIdx, 1);
      const replaced = caster.dossierSlots[slotIndex];
      if (replaced) {
        this.discardPile.push(replaced);
      }
      caster.dossierSlots[slotIndex] = card;
      clearSlotMemoryAcrossPlayers(this.players, caster.id, slotIndex, false);
      markSlotSeen(caster, caster.id, slotIndex, card.cardType);
      syncPlayerFile(caster);

      this.addSlotHighlights([{ playerId: caster.id, slotIndex, kind: 'swapped', labelAr: '🗂️ اتبدلت' }]);

      this.actionsRemaining--;
      const replacedText = replaced
        ? `ورمى «${CARD_DEFINITIONS[replaced.cardType].nameAr}» للأرشيف`
        : 'في خانة فاضية';

      addLogEntry(this.getState(), `${caster.name} حط كارت في خانة #${slotIndex + 1} ${replacedText}`);
      this.recordEvent({
        actorId: caster.id,
        actorName: caster.name,
        cardType: replaced ? replaced.cardType : undefined,
        targetSlotIndex: slotIndex,
        headlineAr: `🗂️ ${caster.name} بدّل خانة #${slotIndex + 1} في ملفه`,
        explanationAr: `${caster.name} نزّل كارت مقلوب في الخانة #${slotIndex + 1} ${replacedText}.`,
        bubbleActorAr: `رتّبت خانة #${slotIndex + 1}`,
      });

      this.emitSoundToAll('card_slap');

      if (this.actionsRemaining <= 0) {
        this.transitionTo('DISCARD_PHASE');
      } else {
        this.broadcastState();
        if (caster.isBot || caster.isDisconnected || this.isAfkTakeover) {
          this.botTimer = setTimeout(() => this.executeBotTurn(), getBotTurnDelay());
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  public handleMatchArchive(playerId: string, slotIndex: number): void {
    if (this.isProcessing) return;
    if (this.phase !== 'ACTION_PHASE') return;
    if (this.currentPlayer.id !== playerId) return;
    if (this.matchedThisTurn) {
      this.emitError(playerId, 'جربت الجرد مرة خلاص في الدور ده');
      return;
    }
    if (this.discardPile.length === 0) {
      this.emitError(playerId, 'الأرشيف فاضي');
      return;
    }
    if (slotIndex < 0 || slotIndex >= GAME_CONSTANTS.DOSSIER_SLOTS) return;

    this.isProcessing = true;
    try {
      const caster = this.currentPlayer;
      const slotCard = caster.dossierSlots[slotIndex];
      if (!slotCard) {
        this.emitError(playerId, 'الخانة دي فاضية');
        return;
      }

      this.matchedThisTurn = true;
      const archiveTop = this.discardPile[this.discardPile.length - 1];

      if (slotCard.cardType === archiveTop.cardType) {
        caster.dossierSlots[slotIndex] = null;
        clearSlotMemoryAcrossPlayers(this.players, caster.id, slotIndex, false);
        syncPlayerFile(caster);
        this.discardPile.push(slotCard);
        caster.matchScore += 2;

        this.addSlotHighlights([{ playerId: caster.id, slotIndex, kind: 'removed', labelAr: '🎯 جرد صح' }]);
        const nameAr = CARD_DEFINITIONS[slotCard.cardType].nameAr;
        addLogEntry(this.getState(), `🎯 جرد صحيح! ${caster.name} طابق «${nameAr}» من خانة #${slotIndex + 1} (+2 نقط)!`);
        this.recordEvent({
          actorId: caster.id,
          actorName: caster.name,
          cardType: slotCard.cardType,
          targetSlotIndex: slotIndex,
          isMatchSuccess: true,
          headlineAr: `🎯 جرد صحيح! ${caster.name} طابق «${nameAr}»!`,
          explanationAr: `${caster.name} رمى «${nameAr}» من خانته #${slotIndex + 1} على الأرشيف مجاناً وكسب +2 نقطة!`,
          bubbleActorAr: 'بصرة وجرد صح! 🎯',
        });
        this.setSpotlight(slotCard.cardType, `🎯 جرد صح من ${caster.name}!`, `طابق «${nameAr}» (+2 نقط)`, caster.name);
        if (caster.isBot) this.scheduleBotSticker(caster, 'big_brain');
        this.emitSoundToAll('card_match');
        this.emitToastToAll(`🎯 جرد صح من ${caster.name}! (+2 نقط)`, 'success');
        this.broadcastState();

        if (caster.isBot || caster.isDisconnected || this.isAfkTakeover) {
          this.botTimer = setTimeout(() => this.executeBotTurn(), getBotTurnDelay());
        }
      } else {
        caster.matchScore -= 2;
        drawCard(this.getState(), caster);
        this.actionsRemaining = Math.max(0, this.actionsRemaining - 1);
        this.setPrivatePeek(caster, caster.id, slotIndex, slotCard, 2500);
        markSlotSeen(caster, caster.id, slotIndex, slotCard.cardType);
        this.addSlotHighlights([{ playerId: caster.id, slotIndex, kind: 'removed', labelAr: '❌ جرد غلط' }]);

        const actualName = CARD_DEFINITIONS[slotCard.cardType].nameAr;
        addLogEntry(this.getState(), `❌ جرد غلط! خانة #${slotIndex + 1} عند ${caster.name} طلع فيها «${actualName}» (-2 نقط)!`);
        this.recordEvent({
          actorId: caster.id,
          actorName: caster.name,
          cardType: slotCard.cardType,
          targetSlotIndex: slotIndex,
          headlineAr: `❌ جرد غلط من ${caster.name}!`,
          explanationAr: `${caster.name} افتكر خانته #${slotIndex + 1} مطابقة للأرشيف بس طلع فيها «${actualName}»!`,
          bubbleActorAr: 'نسيت المكان 😅',
        });
        if (caster.isBot) this.scheduleBotSticker(caster, 'surprised_shock');
        this.emitSoundToAll('buzz');
        this.emitToastToAll(`❌ جرد غلط من ${caster.name} — سحب كارت عقوبة!`, 'danger');

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

  public handleCloseWindow(playerId: string): void {
    if (this.phase !== 'ACTION_PHASE') return;
    if (this.currentPlayer.id !== playerId) return;
    if (this.roundNumber < GAME_CONSTANTS.MIN_ROUND_TO_CLOSE_WINDOW) {
      this.emitError(playerId, `قفل الشباك بيتفتح من الجولة ${GAME_CONSTANTS.MIN_ROUND_TO_CLOSE_WINDOW}`);
      return;
    }
    if (this.windowClosedByPlayerId !== null) {
      this.emitError(playerId, 'الشباك اتقفل خلاص — دي الجولة الأخيرة!');
      return;
    }

    const closer = this.currentPlayer;
    this.windowClosedByPlayerId = closer.id;

    const queue: string[] = [];
    for (let offset = 1; offset < this.players.length; offset++) {
      const p = this.players[(this.currentTurnIndex + offset) % this.players.length];
      queue.push(p.id);
    }
    this.finalTurnQueueIds = queue;

    addLogEntry(this.getState(), `🚨 ${closer.name} قفل الشباك! جولة أخيرة للجميع!`);
    this.recordEvent({
      actorId: closer.id,
      actorName: closer.name,
      isWindowClose: true,
      headlineAr: `🚨 ${closer.name} نادى: قفل الشباك!`,
      explanationAr: `${closer.name} بيتحدى الكل إن ملفه الأعلى! باقي دور واحد أخير لكل لاعب قبل كشف الملفات!`,
      bubbleActorAr: 'قفل الشباك! 🚨',
    });
    if (closer.isBot) this.scheduleBotSticker(closer, 'cool_shades', 350);
    this.emitSoundToAll('shutter_close');
    this.emitToastToAll(`🚨 ${closer.name} قفل الشباك! باقي دور واحد أخير لكل لاعب!`, 'danger');

    this.transitionTo('DISCARD_PHASE');
  }

  // === Play Action / Prank / Inspection Cards ===

  public handlePlayCard(playerId: string, payload: PlayCardPayload): void {
    const {
      cardInstanceId,
      targetPlayerId: rawTargetId,
      targetSlotIndex,
      ownSlotIndex,
      burnCardInstanceId,
      multiTargets,
    } = payload;
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
      const def = getCardDef(card.cardType);
      const state = this.getState();

      // Resolve positional target automatically if card has positionalTarget
      let resolvedTargetId = rawTargetId;
      if (def.positionalTarget === 'next') {
        resolvedTargetId = getNextPlayer(state)?.id;
      } else if (def.positionalTarget === 'prev') {
        resolvedTargetId = getPrevPlayer(state)?.id;
      }

      const validation = validateCardPlay(
        state,
        caster,
        card,
        resolvedTargetId,
        targetSlotIndex,
        ownSlotIndex,
        burnCardInstanceId,
      );
      if (!validation.valid) {
        this.emitError(playerId, validation.error || 'مش ممكن تلعب الكارت ده');
        return;
      }

      caster.hand.splice(cardIdx, 1);

      if (def.burnCost > 0 && burnCardInstanceId) {
        const burnIdx = caster.hand.findIndex(c => c.instanceId === burnCardInstanceId);
        if (burnIdx !== -1) {
          this.discardPile.push(caster.hand.splice(burnIdx, 1)[0]);
        }
      }

      // 1. Reaction-capable Pranks, Wasta, Desk Swap
      if (def.triggersReaction && resolvedTargetId) {
        this.clearAllTimers();
        const target = this.players.find(p => p.id === resolvedTargetId)!;
        this.pendingReaction = {
          attackerId: caster.id,
          attackerName: caster.name,
          targetId: target.id,
          targetName: target.name,
          cardPlayed: card,
          targetSlotIndex,
          attackerSlotIndex: ownSlotIndex,
          expiresAt: Date.now() + GAME_CONSTANTS.REACTION_TIMER_MS,
        };
        this.phase = 'PENDING_REACTION';
        this.setSpotlight(
          card.cardType,
          `${caster.name} رمى «${def.nameAr}»!`,
          `على ${target.name}${targetSlotIndex !== undefined ? ` (خانة #${targetSlotIndex + 1})` : ''}`,
          caster.name,
          target.name,
        );
        this.broadcastState();
        this.emitSoundToAll('prank_alarm');

        if (target.isBot || target.isDisconnected) {
          const reactionDelay = getBotReactionDelay();
          this.reactionTimer = setTimeout(() => {
            const decision = shouldBlock(target, card.cardType);
            this.handleReaction(target.id, decision.block);
          }, reactionDelay);
        } else {
          this.reactionTimer = setTimeout(() => {
            this.handleReaction(target.id, false);
          }, GAME_CONSTANTS.REACTION_TIMER_MS);
        }
        return;
      }

      // 2. "وريني كده اللي معاك" (show_me_all — table-wide multi peek!)
      if (card.cardType === 'show_me_all') {
        this.discardPile.push(card);
        const peekItems: Array<{ targetPlayerId: string; slotIndex: number; card: Card }> = [];
        const highlights: Array<{ playerId: string; slotIndex: number; kind: SlotHighlight['kind']; labelAr: string }> = [];

        for (const p of this.players) {
          let chosenIdx = multiTargets?.[p.id];
          if (
            chosenIdx === undefined ||
            chosenIdx < 0 ||
            chosenIdx >= GAME_CONSTANTS.DOSSIER_SLOTS ||
            !p.dossierSlots[chosenIdx]
          ) {
            chosenIdx = p.dossierSlots.findIndex(Boolean);
          }
          if (chosenIdx !== -1 && p.dossierSlots[chosenIdx]) {
            const c = p.dossierSlots[chosenIdx]!;
            markSlotSeen(caster, p.id, chosenIdx, c.cardType);
            peekItems.push({ targetPlayerId: p.id, slotIndex: chosenIdx, card: c });
            highlights.push({ playerId: p.id, slotIndex: chosenIdx, kind: 'peeked', labelAr: '👀 اتبصت' });
          }
        }

        if (highlights.length > 0) this.addSlotHighlights(highlights);
        if (peekItems.length > 0) this.setPrivateMultiPeek(caster, peekItems);

        this.actionsRemaining--;
        this.recordEvent({
          actorId: caster.id,
          actorName: caster.name,
          cardType: 'show_me_all',
          headlineAr: `👀 ${caster.name} لعب «وريني كده اللي معاك»!`,
          explanationAr: `${caster.name} عمل تفتيش عام وبص سراً على خانة من كل لاعب على الترابيزة!`,
          bubbleActorAr: 'وريني اللي معاك! 👀',
        });
        this.setSpotlight(
          'show_me_all',
          `👀 تفتيش: وريني كده اللي معاك!`,
          `${caster.name} كشف خانة من كل لاعب على الترابيزة!`,
          caster.name,
        );
        if (caster.isBot) this.scheduleBotSticker(caster, 'big_brain');
        this.emitSoundToAll('peek_chime');
        this.advanceAfterAction(caster);
        return;
      }

      // 3. drawer_peek
      if (card.cardType === 'drawer_peek' && resolvedTargetId && targetSlotIndex !== undefined) {
        const target = this.players.find(p => p.id === resolvedTargetId)!;
        const slotCard = target.dossierSlots[targetSlotIndex]!;
        this.discardPile.push(card);
        markSlotSeen(caster, target.id, targetSlotIndex, slotCard.cardType);
        this.setPrivatePeek(caster, target.id, targetSlotIndex, slotCard);
        this.addSlotHighlights([{ playerId: target.id, slotIndex: targetSlotIndex, kind: 'peeked', labelAr: '🔍 اتبصت' }]);
        this.actionsRemaining--;

        const targetDesc = target.id === caster.id ? 'ملفه الشخصي' : `ملف ${target.name}`;
        this.recordEvent({
          actorId: caster.id,
          actorName: caster.name,
          targetId: target.id !== caster.id ? target.id : undefined,
          targetName: target.id !== caster.id ? target.name : undefined,
          cardType: 'drawer_peek',
          targetSlotIndex,
          headlineAr: `🔍 ${caster.name} بص في «نظرة في الدرج»`,
          explanationAr: `${caster.name} كشف سراً خانة #${targetSlotIndex + 1} من ${targetDesc}!`,
          bubbleActorAr: `بصّيت في الخانة #${targetSlotIndex + 1} 🔍`,
        });
        this.setSpotlight(
          'drawer_peek',
          `🔍 نظرة في الدرج`,
          `${caster.name} بص سراً في خانة #${targetSlotIndex + 1} عند ${target.id === caster.id ? 'ملفه' : target.name}`,
          caster.name,
          target.id !== caster.id ? target.name : undefined,
        );
        this.emitSoundToAll('peek_chime');
        this.advanceAfterAction(caster);
        return;
      }

      // 4. dossier_sort
      if (card.cardType === 'dossier_sort') {
        this.discardPile.push(card);
        this.clearAllTimers();
        const count = Math.min(3, this.deck.length);
        const topSlice = this.deck.splice(this.deck.length - count, count).reverse();
        this.pendingSortCards = topSlice;
        this.pendingSort = {
          playerId: caster.id,
          expiresAt: Date.now() + GAME_CONSTANTS.SORT_TIMER_MS,
        };
        this.phase = 'PENDING_SORT';
        this.emitSoundToAll('card_flip');
        this.broadcastState();

        if (caster.isBot || caster.isDisconnected || this.isAfkTakeover) {
          const orderedIds = chooseSortDeckOrder(caster, topSlice);
          this.botTimer = setTimeout(
            () => this.handleSortDeck(caster.id, orderedIds),
            getBotTurnDelay(),
          );
        } else {
          this.sortTimer = setTimeout(() => {
            this.handleSortDeck(caster.id, topSlice.map(c => c.instanceId));
          }, GAME_CONSTANTS.SORT_TIMER_MS);
        }
        return;
      }

      // 5. uncle_gamal
      if (card.cardType === 'uncle_gamal') {
        this.discardPile.push(card);
        this.pendingArchivePlayedCardId = card.instanceId;
        this.clearAllTimers();
        const selectableCards = this.discardPile.filter(c => c.instanceId !== card.instanceId);
        this.pendingArchive = {
          playerId: caster.id,
          expiresAt: Date.now() + GAME_CONSTANTS.ARCHIVE_TIMER_MS,
        };
        this.phase = 'PENDING_ARCHIVE';
        this.broadcastState();

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
        return;
      }

      // 6. medhat_vacation / recommendation
      if (card.cardType === 'medhat_vacation') {
        executeMedhatVacation(state, caster, card);
        this.actionsRemaining--;
        this.recordEvent({
          actorId: caster.id,
          actorName: caster.name,
          cardType: 'medhat_vacation',
          headlineAr: `🏖️ ${caster.name} لعب «الأستاذ مدحت في إجازة»`,
          explanationAr: `لفة كاملة محدش يقدر ينزّل «إمضاء المدير» في ملفه!`,
          bubbleActorAr: 'مدحت في إجازة 🏖️',
        });
        this.setSpotlight('medhat_vacation', '🏖️ الأستاذ مدحت في إجازة!', 'ممنوع تنزيل إمضاء المدير لفة كاملة', caster.name);
        this.emitSoundToAll('buzz');
        this.emitToastToAll('🏖️ الأستاذ مدحت في إجازة لفة كاملة!', 'warning');
        this.advanceAfterAction(caster);
        return;
      }

      if (card.cardType === 'recommendation') {
        const handBefore = caster.hand.length;
        executeRecommendation(state, caster);
        this.discardPile.push(card);
        this.actionsRemaining--;
        const drawnCount = Math.max(0, caster.hand.length - handBefore);
        this.recordEvent({
          actorId: caster.id,
          actorName: caster.name,
          cardType: 'recommendation',
          headlineAr: `📨 ${caster.name} لعب «توصية من فوق»`,
          explanationAr: `${caster.name} سحب ${drawnCount} كروت زيادة لإيده!`,
          bubbleActorAr: `سحبت ${drawnCount} كروت 📨`,
        });
        this.emitSoundToAll('card_draw');
        this.advanceAfterAction(caster);
        return;
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private advanceAfterAction(caster: ServerPlayer): void {
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

  public handleEndTurn(playerId: string): void {
    if (this.phase !== 'ACTION_PHASE') return;
    if (this.currentPlayer.id !== playerId) return;
    this.transitionTo('DISCARD_PHASE');
  }

  // === Reaction Resolution ===

  public handleReaction(targetId: string, block: boolean): void {
    if (this.phase !== 'PENDING_REACTION') return;
    if (!this.pendingReaction) return;
    if (this.pendingReaction.targetId !== targetId) return;

    this.clearAllTimers();
    const { attackerId, cardPlayed, targetSlotIndex, attackerSlotIndex } = this.pendingReaction;
    const caster = this.players.find(p => p.id === attackerId)!;
    const target = this.players.find(p => p.id === targetId)!;
    const attackDef = CARD_DEFINITIONS[cardPlayed.cardType];

    if (block) {
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
          blocked: true,
          headlineAr: `🛡️ ${target.name} صد «${attackDef.nameAr}» بـ بريك الفطار!`,
          explanationAr: `${caster.name} حاول يلعب «${attackDef.nameAr}» على ${target.name}، بس اتصد واتلغى!`,
          bubbleActorAr: 'المقلب اتصد!',
          bubbleTargetAr: 'بريك فطار يا باشا ☕🛡️',
        });
        this.setSpotlight('breakfast_break', `🛡️ ${target.name} صد الضربة!`, `ألغى «${attackDef.nameAr}» بـ بريك الفطار`, target.name, caster.name);
        if (target.isBot) this.scheduleBotSticker(target, Math.random() < 0.5 ? 'cool_shades' : 'big_brain');
        this.emitSoundToAll('shield_block');
        this.emitToastToAll(`🛡️ ${target.name} صد «${attackDef.nameAr}»!`, 'info');
      }
    }

    if (!block) {
      if (cardPlayed.cardType === 'missing_papers') {
        this.discardPile.push(cardPlayed);
        this.pendingReaction = null;

        if (target.hand.length <= 2) {
          const discardedCount = target.hand.length;
          while (target.hand.length > 0) {
            this.discardPile.push(target.hand.pop()!);
          }
          this.recordEvent({
            actorId: caster.id,
            actorName: caster.name,
            targetId: target.id,
            targetName: target.name,
            cardType: 'missing_papers',
            headlineAr: `📄 ${caster.name} ضرب ${target.name} (اللي بعده) بـ «ورقك ناقص»`,
            explanationAr: `${target.name} رمى كل الكروت اللي في إيده (${discardedCount}) في الأرشيف!`,
            bubbleActorAr: 'ورقك ناقص!',
            bubbleTargetAr: 'كروتي راحت 📄',
          });
          if (target.isBot) this.scheduleBotSticker(target, 'pain_coffee');
          this.emitSoundToAll('swoosh');
          this.actionsRemaining--;
          this.advanceAfterAction(caster);
          return;
        }

        this.pendingTargetDiscard = {
          attackerId: caster.id,
          attackerName: caster.name,
          targetId: target.id,
          count: 2,
          expiresAt: Date.now() + GAME_CONSTANTS.TARGET_DISCARD_TIMER_MS,
        };
        this.phase = 'PENDING_TARGET_DISCARD';
        this.emitSoundToAll('swoosh');
        this.broadcastState();

        if (target.isBot || target.isDisconnected) {
          const decision = chooseDiscard(target, 2);
          this.botTimer = setTimeout(
            () => this.handleTargetDiscard(target.id, decision.cardInstanceIds),
            1200,
          );
        } else {
          this.targetDiscardTimer = setTimeout(() => {
            const decision = chooseDiscard(target, 2);
            this.handleTargetDiscard(target.id, decision.cardInstanceIds);
          }, GAME_CONSTANTS.TARGET_DISCARD_TIMER_MS);
        }
        return;
      }

      const state = this.getState();
      let explanationAr = `${caster.name} نفّذ «${attackDef.nameAr}» على ${target.name}.`;
      let bubbleActorAr = `${attackDef.nameAr}!`;
      let bubbleTargetAr = 'يا ساتر!';

      switch (cardPlayed.cardType) {
        case 'system_down':
          executeSystemDown(state, caster, target, cardPlayed);
          explanationAr = `${caster.name} جمّد ${target.name} (اللي بعده في الدور) — هيفوّت دوره الجاي!`;
          bubbleActorAr = `السيستم وقع عند ${target.name}!`;
          bubbleTargetAr = 'اتجمّدت ❄️';
          if (target.isBot) this.scheduleBotSticker(target, 'table_cat');
          break;

        case 'come_tomorrow': {
          const removed = targetSlotIndex !== undefined
            ? executeComeTomorrow(state, caster, target, targetSlotIndex)
            : null;
          this.discardPile.push(cardPlayed);
          if (targetSlotIndex !== undefined) {
            this.addSlotHighlights([{ playerId: target.id, slotIndex: targetSlotIndex, kind: 'removed', labelAr: '💥 اتشالت' }]);
          }
          const remName = removed ? CARD_DEFINITIONS[removed.cardType].nameAr : 'ورقة';
          explanationAr = `${caster.name} رمى خانة #${(targetSlotIndex ?? 0) + 1} («${remName}») من ملف ${target.name} — وخد حصانة للفة!`;
          bubbleActorAr = 'فوت علينا بكرة!';
          bubbleTargetAr = `طارت ${remName} 🚪`;
          if (target.isBot) this.scheduleBotSticker(target, 'surprised_shock');
          break;
        }

        case 'window_4':
          executeWindow4(state, caster, target);
          this.discardPile.push(cardPlayed);
          explanationAr = `${caster.name} بدّل كل كروت إيده مع ${target.name} (اللي قبله)!`;
          bubbleActorAr = 'بدّلنا الإيد 🪟';
          bubbleTargetAr = 'كروتي اتبدّلت!';
          break;

        case 'file_lost': {
          const affected = executeFileLost(state, caster, target);
          this.discardPile.push(cardPlayed);
          this.addSlotHighlights(affected.map(slotIndex => ({
            playerId: target.id,
            slotIndex,
            kind: 'removed' as const,
            labelAr: '📁 رجعت',
          })));
          explanationAr = `ضربة قوية! ${affected.length} ورقات من ملف ${target.name} رجعوا لإيده وخد حصانة للفة!`;
          bubbleActorAr = 'ملفك ضاع 💥';
          bubbleTargetAr = 'ملفي رجع إيدي!';
          if (target.isBot) this.scheduleBotSticker(target, 'this_is_fine');
          break;
        }

        case 'wasta': {
          if (targetSlotIndex !== undefined && attackerSlotIndex !== undefined) {
            const stolen = executeWasta(state, caster, target, targetSlotIndex, attackerSlotIndex);
            if (stolen) {
              this.setPrivatePeek(caster, caster.id, attackerSlotIndex, stolen, 3500);
            }
            this.addSlotHighlights([
              { playerId: target.id, slotIndex: targetSlotIndex, kind: 'stolen', labelAr: '🤝 اتسرقت' },
              { playerId: caster.id, slotIndex: attackerSlotIndex, kind: 'stolen', labelAr: '🤝 اتحطت' },
            ]);
          }
          this.discardPile.push(cardPlayed);
          explanationAr = `بالواسطة! ${caster.name} سرق خانة #${(targetSlotIndex ?? 0) + 1} من ${target.name} وحطها في خانته #${(attackerSlotIndex ?? 0) + 1}!`;
          bubbleActorAr = 'سرقة بالواسطة 🤝';
          bubbleTargetAr = 'ملفي اتسرق!';
          if (caster.isBot) this.scheduleBotSticker(caster, 'stonks');
          break;
        }

        case 'desk_swap': {
          if (attackerSlotIndex !== undefined && targetSlotIndex !== undefined) {
            executeDeskSwap(state, caster, target, attackerSlotIndex, targetSlotIndex);
            this.addSlotHighlights([
              { playerId: caster.id, slotIndex: attackerSlotIndex, kind: 'swapped', labelAr: '🔁 اتبدلت' },
              { playerId: target.id, slotIndex: targetSlotIndex, kind: 'swapped', labelAr: '🔁 اتبدلت' },
            ]);
          }
          this.discardPile.push(cardPlayed);
          explanationAr = `${caster.name} بدّل خانته #${(attackerSlotIndex ?? 0) + 1} سراً مع خانة #${(targetSlotIndex ?? 0) + 1} عند ${target.name}!`;
          bubbleActorAr = 'خد وهات 🔁';
          bubbleTargetAr = 'خانتي اتبدلت!';
          break;
        }
      }

      this.setSpotlight(cardPlayed.cardType, `💥 ${attackDef.nameAr}!`, explanationAr, caster.name, target.name);
      this.recordEvent({
        actorId: caster.id,
        actorName: caster.name,
        targetId: target.id,
        targetName: target.name,
        cardType: cardPlayed.cardType,
        targetSlotIndex,
        blocked: false,
        headlineAr: `💣 ${caster.name} نفّذ «${attackDef.nameAr}» على ${target.name}`,
        explanationAr,
        bubbleActorAr,
        bubbleTargetAr,
      });

      this.emitSoundToAll('swoosh');
    }

    this.actionsRemaining--;
    this.pendingReaction = null;
    this.advanceAfterAction(caster);
  }

  // === Target Discard Choice ===

  public handleTargetDiscard(playerId: string, cardInstanceIds: string[]): void {
    if (this.phase !== 'PENDING_TARGET_DISCARD') return;
    if (!this.pendingTargetDiscard) return;
    if (this.pendingTargetDiscard.targetId !== playerId) return;

    this.clearAllTimers();
    const { attackerId, attackerName, count } = this.pendingTargetDiscard;
    const caster = this.players.find(p => p.id === attackerId)!;
    const target = this.players.find(p => p.id === playerId)!;

    let removed = 0;
    for (const id of cardInstanceIds.slice(0, count)) {
      const idx = target.hand.findIndex(c => c.instanceId === id);
      if (idx !== -1) {
        this.discardPile.push(target.hand.splice(idx, 1)[0]);
        removed++;
      }
    }
    while (removed < count && target.hand.length > 0) {
      this.discardPile.push(target.hand.pop()!);
      removed++;
    }

    this.recordEvent({
      actorId: attackerId,
      actorName: attackerName,
      targetId: target.id,
      targetName: target.name,
      cardType: 'missing_papers',
      headlineAr: `📄 ${target.name} سلّم ${removed} كروت لـ «ورقك ناقص»`,
      explanationAr: `${target.name} اختار ${removed} كارت من إيده ورماهم في الأرشيف بسبب ${attackerName}.`,
      bubbleActorAr: 'ورقك ناقص!',
      bubbleTargetAr: `رميت ${removed} كروت`,
    });

    this.pendingTargetDiscard = null;
    this.actionsRemaining--;
    this.emitSoundToAll('card_slap');
    this.advanceAfterAction(caster);
  }

  // === Deck Top-3 Sort ===

  public handleSortDeck(playerId: string, orderedInstanceIds: string[]): void {
    if (this.phase !== 'PENDING_SORT') return;
    if (!this.pendingSort || this.pendingSort.playerId !== playerId) return;

    this.clearAllTimers();
    const player = this.players.find(p => p.id === playerId)!;

    const remaining = [...this.pendingSortCards];
    const reorderedTopFirst: Card[] = [];
    for (const id of orderedInstanceIds) {
      const idx = remaining.findIndex(c => c.instanceId === id);
      if (idx !== -1) {
        reorderedTopFirst.push(remaining.splice(idx, 1)[0]);
      }
    }
    reorderedTopFirst.push(...remaining);

    this.deck.push(...reorderedTopFirst.reverse());
    this.pendingSortCards = [];
    this.pendingSort = null;
    this.actionsRemaining--;

    this.recordEvent({
      actorId: player.id,
      actorName: player.name,
      cardType: 'dossier_sort',
      headlineAr: `📑 ${player.name} رتّب الدوسيه!`,
      explanationAr: `${player.name} بص على أول كروت في الكومة ورتّب ترتيب السحب!`,
      bubbleActorAr: 'رتّبت الكومة 😉',
    });
    this.emitSoundToAll('card_flip');
    this.advanceAfterAction(player);
  }

  // === Archive Pick ===

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
        explanationAr: `${player.name} سحب «${pickedName}» من الأرشيف لإيده!`,
        bubbleActorAr: `أخدت ${pickedName} 👴`,
      });
    }

    this.actionsRemaining--;
    this.pendingArchive = null;
    this.pendingArchivePlayedCardId = null;
    this.emitSoundToAll('card_draw');
    this.advanceAfterAction(player);
  }

  // === Hand Limit Discard ===

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
        this.discardPile.push(player.hand.splice(idx, 1)[0]);
      }
    }

    while (player.hand.length > GAME_CONSTANTS.MAX_HAND_SIZE) {
      this.discardPile.push(player.hand.pop()!);
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
    const decision = decideBotAction(
      this.getState(),
      bot,
      this.roundNumber,
      this.windowClosedByPlayerId,
      this.matchedThisTurn,
    );

    switch (decision.type) {
      case 'place_in_slot':
        if (decision.cardInstanceId !== undefined && decision.slotIndex !== undefined) {
          this.handlePlaceInSlot(bot.id, decision.cardInstanceId, decision.slotIndex);
          return;
        }
        break;
      case 'match_archive':
        if (decision.slotIndex !== undefined) {
          this.handleMatchArchive(bot.id, decision.slotIndex);
          return;
        }
        break;
      case 'close_window':
        this.handleCloseWindow(bot.id);
        return;
      case 'play_card':
        if (decision.cardInstanceId) {
          this.handlePlayCard(bot.id, {
            cardInstanceId: decision.cardInstanceId,
            targetPlayerId: decision.targetPlayerId,
            targetSlotIndex: decision.targetSlotIndex,
            ownSlotIndex: decision.ownSlotIndex,
            burnCardInstanceId: decision.burnCardInstanceId,
            multiTargets: decision.multiTargets,
          });
          return;
        }
        break;
    }

    this.transitionTo('DISCARD_PHASE');
  }

  // === Final Showdown & Scoring ===

  private calculateFinalShowdown(reason: WinReason): void {
    for (const p of this.players) {
      syncPlayerFile(p);
    }

    const baseBreakdowns = new Map<string, PlayerScoreBreakdown>();
    for (const p of this.players) {
      baseBreakdowns.set(
        p.id,
        calculatePlayerScore(p.id, p.dossierSlots, p.matchScore, null, false),
      );
    }

    let isCloserStrictlyHighest = false;
    if (this.windowClosedByPlayerId) {
      const closerBase = baseBreakdowns.get(this.windowClosedByPlayerId)?.totalScore ?? 0;
      isCloserStrictlyHighest = this.players.every(
        p => p.id === this.windowClosedByPlayerId || (baseBreakdowns.get(p.id)?.totalScore ?? 0) < closerBase,
      );
    }

    this.scoreBreakdowns = {};
    for (const p of this.players) {
      this.scoreBreakdowns[p.id] = calculatePlayerScore(
        p.id,
        p.dossierSlots,
        p.matchScore,
        this.windowClosedByPlayerId,
        isCloserStrictlyHighest,
      );
    }

    const sorted = [...this.players].sort((a, b) => {
      return this.scoreBreakdowns[b.id].totalScore - this.scoreBreakdowns[a.id].totalScore;
    });

    const topScore = this.scoreBreakdowns[sorted[0].id].totalScore;
    const winners = sorted.filter(p => this.scoreBreakdowns[p.id].totalScore === topScore);
    this.winnerIds = winners.map(w => w.id);

    const anyPerfect = winners.some(w => this.scoreBreakdowns[w.id].hasPerfectFile);
    this.winReason = anyPerfect ? 'PERFECT_SEAL' : reason;

    addLogEntry(
      this.getState(),
      `كشف الملفات! الفائز: ${winners.map(w => w.name).join(' و ')} (${topScore} نقطة)!`,
    );
  }

  // === Disconnect / Reconnect ===

  public handleDisconnect(socketId: string): void {
    const player = this.players.find(p => p.socketId === socketId);
    if (!player || player.isBot) return;

    player.isDisconnected = true;
    player.socketId = null;
    this.broadcastState();

    if (this.connectedHumanCount === 0 && this.phase !== 'LOBBY') {
      this.cleanupTimer = setTimeout(() => {}, GAME_CONSTANTS.ROOM_CLEANUP_TIMEOUT_MS);
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
      currentTurnIndex: this.currentTurnIndex,
      get deck() { return self.deck; },
      set deck(v: Card[]) { self.deck = v; },
      openMarket: this.openMarket,
      get discardPile() { return self.discardPile; },
      set discardPile(v: Card[]) { self.discardPile = v; },
      globalEffects: this.globalEffects,
      get activeMedhatCard() { return self.activeMedhatCard; },
      set activeMedhatCard(v: Card | null) { self.activeMedhatCard = v; },
      actionLog: this.actionLog,
    };
  }

  public getTotalCardCount(): number {
    let total = this.deck.length + this.discardPile.length + this.pendingSortCards.length;
    for (const m of this.openMarket) {
      if (m) total += 1;
    }
    if (this.activeMedhatCard) total += 1;
    if (this.pendingReaction) total += 1;
    for (const p of this.players) {
      total += p.hand.length + (p.frozenCard ? 1 : 0);
      for (const s of p.dossierSlots) {
        if (s) total += 1;
      }
    }
    return total;
  }

  private getArchiveTypeCounts(): Partial<Record<CardType, number>> {
    const counts: Partial<Record<CardType, number>> = {};
    for (const c of this.discardPile) {
      counts[c.cardType] = (counts[c.cardType] || 0) + 1;
    }
    return counts;
  }

  public getPublicState(): PublicGameState {
    const now = Date.now();
    const revealAll = this.phase === 'GAME_OVER';
    const closerPlayer = this.windowClosedByPlayerId
      ? this.players.find(p => p.id === this.windowClosedByPlayerId)
      : null;

    const validHighlights = this.recentSlotHighlights.filter(h => h.expiresAt > now);
    const validSpotlight =
      this.spotlightCard && this.spotlightCard.expiresAt > now ? { ...this.spotlightCard } : null;

    return {
      roomCode: this.roomCode,
      hostId: this.hostId,
      phase: this.phase,
      roundNumber: this.roundNumber,
      currentTurnPlayerId: this.players[this.currentTurnIndex]?.id ?? '',
      actionsRemaining: this.actionsRemaining,
      matchedThisTurn: this.matchedThisTurn,
      turnExpiresAt: this.turnExpiresAt,
      peekStartExpiresAt: this.peekStartExpiresAt,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        avatarId: p.avatarId,
        isBot: p.isBot,
        isDisconnected: p.isDisconnected,
        isFrozen: p.isFrozen,
        isImmuneThisRound: p.isImmuneThisRound,
        dossierSlots: p.dossierSlots.map((card, idx) => ({
          slotIndex: idx,
          hasCard: card !== null,
          revealedCard: revealAll && card ? card : null,
        })),
        filledSlotCount: p.dossierSlots.filter(Boolean).length,
        matchScore: p.matchScore,
        handCount: p.hand.length,
        file: revealAll
          ? p.dossierSlots
              .filter((c): c is Card => Boolean(c && isDocumentCard(c.cardType)))
              .map(c => c.cardType as (typeof CORE_DOCUMENTS)[number])
          : [],
        scoreBreakdown: revealAll ? this.scoreBreakdowns[p.id] ?? null : null,
      })),
      deckCount: this.deck.length,
      openMarket: [...this.openMarket],
      discardPileRecent: this.discardPile.slice(-4),
      discardPileTop: this.discardPile.length > 0 ? this.discardPile[this.discardPile.length - 1] : null,
      discardPileCount: this.discardPile.length,
      archiveTypeCounts: this.getArchiveTypeCounts(),
      globalEffects: { ...this.globalEffects },
      pendingReaction: this.pendingReaction ? { ...this.pendingReaction } : null,
      pendingArchive: this.pendingArchive ? { ...this.pendingArchive } : null,
      pendingSort: this.pendingSort ? { ...this.pendingSort } : null,
      pendingTargetDiscard: this.pendingTargetDiscard ? { ...this.pendingTargetDiscard } : null,
      windowClosedByPlayerId: this.windowClosedByPlayerId,
      windowClosedPlayerName: closerPlayer?.name ?? null,
      finalTurnQueueIds: [...this.finalTurnQueueIds],
      recentSlotHighlights: validHighlights,
      spotlightCard: validSpotlight,
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
    if (this.eventHistory.length > 15) {
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
    const now = Date.now();
    const seenMap: Record<string, number[]> = {};
    for (const [targetId, set] of Object.entries(player.seenSlotsByPlayer)) {
      seenMap[targetId] = Array.from(set);
    }

    const tamperedMap: Record<string, number[]> = {};
    for (const [targetId, set] of Object.entries(player.tamperedSlotsByPlayer)) {
      tamperedMap[targetId] = Array.from(set);
    }

    const activePeek = this.activePeeks[player.id];
    const validPeek = activePeek && activePeek.expiresAt > now ? activePeek : null;

    const multiPeek = this.activeMultiPeeks[player.id];
    const validMultiPeek = multiPeek && multiPeek.expiresAt > now ? multiPeek.items : null;

    return {
      playerId: player.id,
      hand: [...player.hand],
      archiveCards: archiveCards ?? null,
      topDeckCards:
        this.phase === 'PENDING_SORT' && this.pendingSort?.playerId === player.id
          ? [...this.pendingSortCards]
          : null,
      startPeeksRemaining: player.startPeeksRemaining,
      seenSlotsByPlayer: seenMap,
      tamperedSlotsByPlayer: tamperedMap,
      activePeek: validPeek,
      activeMultiPeek: validMultiPeek,
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
