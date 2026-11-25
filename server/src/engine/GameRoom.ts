// ========================
// EL-KHETM — Simplified Game Room State Machine (4-Document Secret File Race)
// ========================

import { v4 as uuidv4 } from 'uuid';
import type { Server as SocketServer } from 'socket.io';
import {
  Card,
  CardType,
  GamePhase,
  GameEventNotice,
  PublicGameState,
  PrivateGameState,
  LobbyState,
  PendingReaction,
  PendingArchive,
  PendingTargetDiscard,
  ActivePeekInfo,
  SlotHighlight,
  CardMotionEvent,
  CardMotionLocation,
  SpotlightCardNotice,
  PlayerFileSummary,
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
  CORE_DOCUMENTS,
  hasCompletedAllDocs,
  buildPlayerFileSummary,
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
  public fileSummaries: Record<string, PlayerFileSummary> = {};

  public pendingReaction: PendingReaction | null = null;
  public pendingArchive: PendingArchive | null = null;
  public pendingArchivePlayedCardId: string | null = null;
  public pendingTargetDiscard: PendingTargetDiscard | null = null;

  public recentSlotHighlights: SlotHighlight[] = [];
  public recentCardMotions: CardMotionEvent[] = [];
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
    this.recentCardMotions = [];
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

  private addCardMotions(
    items: Array<{
      from: CardMotionLocation;
      to: CardMotionLocation;
      cardType?: CardType;
      faceDown: boolean;
      labelAr?: string;
      durationMs?: number;
    }>,
  ): void {
    const now = Date.now();
    this.recentCardMotions = this.recentCardMotions.filter(
      m => now - m.createdAt <= GAME_CONSTANTS.CARD_MOTION_TTL_MS,
    );
    for (const item of items) {
      this.recentCardMotions.push({
        id: `cm_${now}_${Math.random().toString(36).slice(2, 7)}`,
        from: item.from,
        to: item.to,
        cardType: item.cardType,
        faceDown: item.faceDown,
        labelAr: item.labelAr,
        durationMs: item.durationMs ?? 820,
        createdAt: now,
      });
    }
    if (this.recentCardMotions.length > 10) {
      this.recentCardMotions = this.recentCardMotions.slice(-10);
    }
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
    this.discardPile = [];
    this.roundNumber = 1;
    this.currentTurnIndex = 0;
    this.actionsRemaining = 0;
    this.globalEffects = { medhatVacationUntilPlayerId: null };
    this.activeMedhatCard = null;
    this.actionLog = [];
    this.lastEvent = null;
    this.eventHistory = [];
    this.winnerIds = null;
    this.winReason = null;
    this.fileSummaries = {};
    this.pendingReaction = null;
    this.pendingArchive = null;
    this.pendingArchivePlayedCardId = null;
    this.pendingTargetDiscard = null;
    this.isAfkTakeover = false;

    for (const p of this.players) {
      p.dossierSlots = [null, null, null, null];
      p.hand = [];
      p.file = [];
      p.isFrozen = false;
      p.frozenCard = null;
      p.isImmuneThisRound = false;
      p.startPeeksRemaining = GAME_CONSTANTS.START_PEEKS_COUNT;
      p.seenSlotsByPlayer = {};
      p.tamperedSlotsByPlayer = {};
      p.botMemory = {};
    }

    // Deal 4 face-down mystery cards into each player's dossier
    for (let s = 0; s < GAME_CONSTANTS.DOSSIER_SLOTS; s++) {
      for (const p of this.players) {
        p.dossierSlots[s] = popDeckCard(this.getState());
      }
    }

    // Guarantee nobody accidentally begins Turn 0 already holding all 4 unique documents
    for (const p of this.players) {
      if (hasCompletedAllDocs(p.dossierSlots)) {
        const nonDocIdx = this.deck.findIndex(c => !isDocumentCard(c.cardType));
        if (nonDocIdx !== -1 && p.dossierSlots[3]) {
          const swappedOut = p.dossierSlots[3];
          p.dossierSlots[3] = this.deck.splice(nonDocIdx, 1)[0];
          this.deck.push(swappedOut);
          shuffleDeck(this.deck);
        }
      }
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

    // Starter discard card in Archive
    const starterArchive = popDeckCard(this.getState());
    if (starterArchive) {
      this.discardPile.push(starterArchive);
    }

    addLogEntry(this.getState(), 'الجيم بدأ! بص على خانتين من ملفك واحفظ أماكنهم!');
    this.transitionTo('PEEK_START');
  }

  // === Instant Win Verification ===

  private checkImmediatePerfectSealWin(): boolean {
    const winners = this.players.filter(p => hasCompletedAllDocs(p.dossierSlots));
    if (winners.length === 0) return false;

    this.winnerIds = winners.map(w => w.id);
    this.winReason = 'PERFECT_SEAL';
    this.fileSummaries = {};
    for (const p of this.players) {
      syncPlayerFile(p);
      this.fileSummaries[p.id] = buildPlayerFileSummary(p.id, p.dossierSlots);
    }

    const names = winners.map(w => w.name).join(' و ');
    addLogEntry(this.getState(), `🦅 ${names} جمّع الـ 4 مستندات الرسمية وختم الملف!`);
    this.recordEvent({
      actorId: winners[0].id,
      actorName: winners[0].name,
      cardType: 'eagle_seal',
      headlineAr: `🦅 الختم الكامل! ${names} كسب الجيم!`,
      explanationAr: `${names} كمّل الـ 4 مستندات الرسمية كاملة في ملفه المقفول وكسب الجيم فوراً!`,
      bubbleActorAr: 'ختمت الملف! 🦅🏆',
    });
    this.emitToastToAll(`🦅 ${names} جمّع الـ 4 مستندات وختم الملف!`, 'success');
    this.transitionTo('GAME_OVER');
    return true;
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
      explanationAr: 'اضغط على خانتين في ملفك عشان تحفظ أماكنهم قبل ما يبدأ اللعب.',
    });
    this.broadcastState();
    this.emitSoundToAll('card_draw');

    this.peekStartTimer = setTimeout(() => {
      if (this.phase === 'PEEK_START') {
        this.peekStartExpiresAt = null;
        for (const k of Object.keys(this.multiPeekExpireTimers)) {
          clearTimeout(this.multiPeekExpireTimers[k]);
          delete this.multiPeekExpireTimers[k];
        }
        this.activeMultiPeeks = {};
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

    const remainingMs = Math.max(
      1500,
      (this.peekStartExpiresAt ?? Date.now() + GAME_CONSTANTS.PEEK_START_TIMER_MS) - Date.now(),
    );
    const existingItems = (this.activeMultiPeeks[player.id]?.items ?? []).map(it => ({
      targetPlayerId: it.targetPlayerId,
      slotIndex: it.slotIndex,
      card: it.card,
    }));
    if (!existingItems.some(it => it.targetPlayerId === player.id && it.slotIndex === slotIndex)) {
      existingItems.push({ targetPlayerId: player.id, slotIndex, card });
    }
    this.setPrivateMultiPeek(player, existingItems, remainingMs);
    this.emitSoundToPlayer(player, 'peek_chime');
    this.broadcastState();
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

    // Anti-spam Round Shield clears when this player's next turn starts
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
    const player = this.currentPlayer;

    if (player.isBot || player.isDisconnected) {
      this.broadcastState();
      this.botTimer = setTimeout(() => {
        if (this.phase !== 'DRAW_PHASE' || this.currentPlayer.id !== player.id) return;
        this.executeDraw(player);
      }, GAME_CONSTANTS.BOT_DRAW_DELAY_MS);
      return;
    }

    this.turnExpiresAt = Date.now() + GAME_CONSTANTS.DRAW_TIMER_MS;
    this.broadcastState();
    this.drawTimer = setTimeout(() => {
      if (this.phase !== 'DRAW_PHASE' || this.currentPlayer.id !== player.id) return;
      this.isAfkTakeover = true;
      this.executeDraw(player);
    }, GAME_CONSTANTS.DRAW_TIMER_MS);
  }

  public handleDrawCard(playerId: string): void {
    if (this.phase !== 'DRAW_PHASE') return;
    if (this.currentPlayer.id !== playerId) return;
    this.clearAllTimers();
    this.executeDraw(this.currentPlayer);
  }

  private executeDraw(player: ServerPlayer): void {
    const state = this.getState();
    const drawn = drawCard(state, player);
    if (drawn) {
      this.addCardMotions([{
        from: { zone: 'deck' },
        to: { zone: 'hand', playerId: player.id },
        faceDown: true,
        labelAr: 'سحب كارت',
        durationMs: 850,
      }]);
    }
    addLogEntry(state, `${player.name} سحب كارت من الكومة`);

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
    this.emitSoundToAll(this.winReason === 'PERFECT_SEAL' ? 'stamp' : 'win_fanfare');
    if (this.winReason === 'PERFECT_SEAL') {
      setTimeout(() => {
        if (this.phase === 'GAME_OVER') {
          this.emitSoundToAll('win_fanfare');
        }
      }, 240);
    }
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
      if (!isDocumentCard(card.cardType)) {
        this.emitError(playerId, 'تقدر تنزّل المستندات الرسمية الـ 4 بس جوه ملفك!');
        return;
      }
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

      this.addSlotHighlights([{ playerId: caster.id, slotIndex, kind: 'swapped', labelAr: '🗂️ نزّلت ورقة' }]);
      const placeMotions: Parameters<GameRoom['addCardMotions']>[0] = [{
        from: { zone: 'hand', playerId: caster.id },
        to: { zone: 'slot', playerId: caster.id, slotIndex },
        faceDown: true,
        labelAr: `🗂️ نزّل في خانة #${slotIndex + 1}`,
        durationMs: 950,
      }];
      if (replaced) {
        placeMotions.push({
          from: { zone: 'slot', playerId: caster.id, slotIndex },
          to: { zone: 'archive' },
          cardType: replaced.cardType,
          faceDown: false,
          labelAr: 'للأرشيف',
          durationMs: 950,
        });
      }
      this.addCardMotions(placeMotions);

      this.actionsRemaining--;
      const replacedText = replaced
        ? `ورمى «${CARD_DEFINITIONS[replaced.cardType].nameAr}» للأرشيف`
        : 'في خانة فاضية';

      addLogEntry(this.getState(), `${caster.name} حط مستند في خانة #${slotIndex + 1} ${replacedText}`);
      this.recordEvent({
        actorId: caster.id,
        actorName: caster.name,
        cardType: replaced ? replaced.cardType : undefined,
        targetSlotIndex: slotIndex,
        headlineAr: `🗂️ ${caster.name} نزّل مستند في خانة #${slotIndex + 1}`,
        explanationAr: `${caster.name} نزّل مستند سراً في الخانة #${slotIndex + 1} ${replacedText}.`,
        bubbleActorAr: `رتّبت خانة #${slotIndex + 1}`,
      });

      this.emitSoundToAll('card_slap');

      if (this.checkImmediatePerfectSealWin()) {
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
    } finally {
      this.isProcessing = false;
    }
  }

  // === Play Action / Prank / Inspection Cards ===

  public handlePlayCard(playerId: string, payload: PlayCardPayload): void {
    const {
      cardInstanceId,
      targetPlayerId: rawTargetId,
      targetSlotIndex,
      ownSlotIndex,
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
      );
      if (!validation.valid) {
        this.emitError(playerId, validation.error || 'مش ممكن تلعب الكارت ده');
        return;
      }

      caster.hand.splice(cardIdx, 1);
      this.addCardMotions([{
        from: { zone: 'hand', playerId: caster.id },
        to: { zone: 'archive' },
        cardType: card.cardType,
        faceDown: false,
        labelAr: def.nameAr,
      }]);

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

      // 4. uncle_gamal
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

      // 5. medhat_vacation / recommendation
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
        if (drawnCount > 0) {
          this.addCardMotions([{
            from: { zone: 'deck' },
            to: { zone: 'hand', playerId: caster.id },
            faceDown: true,
            labelAr: `+${drawnCount} كروت`,
          }]);
        }
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
        this.addCardMotions([{
          from: { zone: 'hand', playerId: target.id },
          to: { zone: 'archive' },
          cardType: 'breakfast_break',
          faceDown: false,
          labelAr: '☕ صد المقلب!',
        }]);
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
          const discMotions: Parameters<GameRoom['addCardMotions']>[0] = [];
          while (target.hand.length > 0) {
            const dc = target.hand.pop()!;
            this.discardPile.push(dc);
            discMotions.push({
              from: { zone: 'hand', playerId: target.id },
              to: { zone: 'archive' },
              cardType: dc.cardType,
              faceDown: false,
              labelAr: '📄 اترمت',
            });
          }
          if (discMotions.length > 0) this.addCardMotions(discMotions);
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
            this.addSlotHighlights([{ playerId: target.id, slotIndex: targetSlotIndex, kind: 'removed', labelAr: '💥 طارت للأرشيف' }]);
            this.addCardMotions([{
              from: { zone: 'slot', playerId: target.id, slotIndex: targetSlotIndex },
              to: { zone: 'archive' },
              cardType: removed?.cardType,
              faceDown: !removed,
              labelAr: `💥 طارت خانة #${targetSlotIndex + 1} للأرشيف`,
              durationMs: 1100,
            }]);
          }
          explanationAr = removed
            ? `${caster.name} رمى خانة #${targetSlotIndex! + 1} («${CARD_DEFINITIONS[removed.cardType].nameAr}») من ${target.name} للأرشيف!`
            : `${caster.name} رمى ورقة من ${target.name} للأرشيف!`;
          bubbleActorAr = 'فوت علينا بكرة! 📆';
          bubbleTargetAr = 'ورقتي طارت! 😭';
          if (target.isBot) this.scheduleBotSticker(target, 'surprised_shock');
          break;
        }

        case 'window_4':
          executeWindow4(state, caster, target);
          this.discardPile.push(cardPlayed);
          this.addCardMotions([
            { from: { zone: 'hand', playerId: caster.id }, to: { zone: 'hand', playerId: target.id }, faceDown: true, labelAr: '🪟 بدّلت الإيد بالكامل', durationMs: 1200 },
            { from: { zone: 'hand', playerId: target.id }, to: { zone: 'hand', playerId: caster.id }, faceDown: true, labelAr: '🪟 إيد جديدة في إيدك', durationMs: 1200 },
          ]);
          explanationAr = `${caster.name} بدّل كل ورق إيده مع ${target.name} (اللي قبله في الدور)!`;
          bubbleActorAr = 'خد شباك 4! 🪟';
          bubbleTargetAr = 'كروتي اتبدلت 😵';
          if (caster.isBot) this.scheduleBotSticker(caster, 'crying_laugh');
          break;

        case 'file_lost': {
          const affected = executeFileLost(state, caster, target);
          this.discardPile.push(cardPlayed);
          if (affected.length > 0) {
            this.addSlotHighlights(
              affected.map(slotIndex => ({ playerId: target.id, slotIndex, kind: 'removed', labelAr: '📁 رجعت للإيد' })),
            );
            this.addCardMotions(affected.map(slotIndex => ({
              from: { zone: 'slot', playerId: target.id, slotIndex },
              to: { zone: 'hand', playerId: target.id },
              faceDown: true,
              labelAr: `📁 طارت خانة #${slotIndex + 1} للإيد`,
              durationMs: 1050,
            })));
          }
          explanationAr = `${caster.name} رجّع ${affected.length} ورقات من ملف ${target.name} لإيده من تاني!`;
          bubbleActorAr = 'ملفك ضاع 📁';
          bubbleTargetAr = 'يا نهار أبيض!! 😱';
          if (target.isBot) this.scheduleBotSticker(target, 'this_is_fine');
          break;
        }

        case 'wasta': {
          this.discardPile.push(cardPlayed);
          if (targetSlotIndex !== undefined && attackerSlotIndex !== undefined) {
            executeWasta(state, caster, target, targetSlotIndex, attackerSlotIndex);
            this.addSlotHighlights([
              { playerId: target.id, slotIndex: targetSlotIndex, kind: 'stolen', labelAr: '🤝 اتسرقت' },
              { playerId: caster.id, slotIndex: attackerSlotIndex, kind: 'swapped', labelAr: '🤝 وصلت' },
            ]);
            this.addCardMotions([{
              from: { zone: 'slot', playerId: target.id, slotIndex: targetSlotIndex },
              to: { zone: 'slot', playerId: caster.id, slotIndex: attackerSlotIndex },
              faceDown: true,
              labelAr: `🤝 اتسرقت #${targetSlotIndex + 1} ← #${attackerSlotIndex + 1}`,
              durationMs: 1150,
            }]);
          }
          explanationAr = `${caster.name} استعمل الواسطة وسرق خانة #${(targetSlotIndex ?? 0) + 1} من ${target.name} لخانته #${(attackerSlotIndex ?? 0) + 1}!`;
          bubbleActorAr = 'عندي واسطة 🤝';
          bubbleTargetAr = 'ورقتي اتسرقت!';
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
            this.addCardMotions([
              {
                from: { zone: 'slot', playerId: caster.id, slotIndex: attackerSlotIndex },
                to: { zone: 'slot', playerId: target.id, slotIndex: targetSlotIndex },
                faceDown: true,
                labelAr: `🔁 تبديل #${attackerSlotIndex + 1} ↔ #${targetSlotIndex + 1}`,
                durationMs: 1200,
              },
              {
                from: { zone: 'slot', playerId: target.id, slotIndex: targetSlotIndex },
                to: { zone: 'slot', playerId: caster.id, slotIndex: attackerSlotIndex },
                faceDown: true,
                labelAr: `🔁 استلام #${targetSlotIndex + 1} ← #${attackerSlotIndex + 1}`,
                durationMs: 1200,
              },
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

      this.pendingReaction = null;
      if (this.checkImmediatePerfectSealWin()) {
        return;
      }
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
    const discMotions: Parameters<GameRoom['addCardMotions']>[0] = [];
    for (const id of cardInstanceIds.slice(0, count)) {
      const idx = target.hand.findIndex(c => c.instanceId === id);
      if (idx !== -1) {
        const dc = target.hand.splice(idx, 1)[0];
        this.discardPile.push(dc);
        discMotions.push({
          from: { zone: 'hand', playerId: target.id },
          to: { zone: 'archive' },
          cardType: dc.cardType,
          faceDown: false,
          labelAr: '📄 اترمت',
        });
        removed++;
      }
    }
    while (removed < count && target.hand.length > 0) {
      const dc = target.hand.pop()!;
      this.discardPile.push(dc);
      discMotions.push({
        from: { zone: 'hand', playerId: target.id },
        to: { zone: 'archive' },
        cardType: dc.cardType,
        faceDown: false,
        labelAr: '📄 اترمت',
      });
      removed++;
    }
    if (discMotions.length > 0) this.addCardMotions(discMotions);

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
      this.addCardMotions([{
        from: { zone: 'archive' },
        to: { zone: 'hand', playerId: player.id },
        cardType: card.cardType,
        faceDown: false,
        labelAr: '👴 من الأرشيف',
      }]);
      const pickedName = CARD_DEFINITIONS[card.cardType].nameAr;
      addLogEntry(this.getState(), `${player.name} أخد «${pickedName}» من الأرشيف!`);
      this.recordEvent({
        actorId: player.id,
        actorName: player.name,
        cardType: 'uncle_gamal',
        headlineAr: `👴 ${player.name} لعب «عم جمال»`,
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
    const excessMotions: Parameters<GameRoom['addCardMotions']>[0] = [];
    for (const id of toRemove) {
      const idx = player.hand.findIndex(c => c.instanceId === id);
      if (idx !== -1) {
        const dc = player.hand.splice(idx, 1)[0];
        this.discardPile.push(dc);
        excessMotions.push({
          from: { zone: 'hand', playerId: player.id },
          to: { zone: 'archive' },
          cardType: dc.cardType,
          faceDown: false,
        });
      }
    }

    while (player.hand.length > GAME_CONSTANTS.MAX_HAND_SIZE) {
      const dc = player.hand.pop()!;
      this.discardPile.push(dc);
      excessMotions.push({
        from: { zone: 'hand', playerId: player.id },
        to: { zone: 'archive' },
        cardType: dc.cardType,
        faceDown: false,
      });
    }
    if (excessMotions.length > 0) this.addCardMotions(excessMotions);

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

    switch (decision.type) {
      case 'place_in_slot':
        if (decision.cardInstanceId !== undefined && decision.slotIndex !== undefined) {
          this.handlePlaceInSlot(bot.id, decision.cardInstanceId, decision.slotIndex);
          return;
        }
        break;
      case 'play_card':
        if (decision.cardInstanceId) {
          this.handlePlayCard(bot.id, {
            cardInstanceId: decision.cardInstanceId,
            targetPlayerId: decision.targetPlayerId,
            targetSlotIndex: decision.targetSlotIndex,
            ownSlotIndex: decision.ownSlotIndex,
            multiTargets: decision.multiTargets,
          });
          return;
        }
        break;
    }

    this.transitionTo('DISCARD_PHASE');
  }

  // === Final Showdown (2:00 PM Timeout — Most Unique Official Documents Wins!) ===

  private calculateFinalShowdown(reason: WinReason): void {
    this.fileSummaries = {};
    for (const p of this.players) {
      syncPlayerFile(p);
      this.fileSummaries[p.id] = buildPlayerFileSummary(p.id, p.dossierSlots);
    }

    const sorted = [...this.players].sort((a, b) => {
      const sa = this.fileSummaries[a.id];
      const sb = this.fileSummaries[b.id];
      if (sb.uniqueDocsCount !== sa.uniqueDocsCount) {
        return sb.uniqueDocsCount - sa.uniqueDocsCount;
      }
      return sb.filledSlotsCount - sa.filledSlotsCount;
    });

    const topDocs = this.fileSummaries[sorted[0].id].uniqueDocsCount;
    const topFilled = this.fileSummaries[sorted[0].id].filledSlotsCount;
    const winners = sorted.filter(p => {
      const s = this.fileSummaries[p.id];
      return s.uniqueDocsCount === topDocs && s.filledSlotsCount === topFilled;
    });

    this.winnerIds = winners.map(w => w.id);
    this.winReason = winners.some(w => this.fileSummaries[w.id].hasCompleteFile) ? 'PERFECT_SEAL' : reason;

    addLogEntry(
      this.getState(),
      `كشف الملفات! الفائز: ${winners.map(w => w.name).join(' و ')} (${topDocs}/4 مستندات)!`,
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
      get discardPile() { return self.discardPile; },
      set discardPile(v: Card[]) { self.discardPile = v; },
      globalEffects: this.globalEffects,
      get activeMedhatCard() { return self.activeMedhatCard; },
      set activeMedhatCard(v: Card | null) { self.activeMedhatCard = v; },
      actionLog: this.actionLog,
    };
  }

  public getTotalCardCount(): number {
    let total = this.deck.length + this.discardPile.length;
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

  public getPublicState(): PublicGameState {
    const now = Date.now();
    const revealAll = this.phase === 'GAME_OVER';

    const validHighlights = this.recentSlotHighlights.filter(h => h.expiresAt > now);
    const validMotions = this.recentCardMotions.filter(
      m => now - m.createdAt <= GAME_CONSTANTS.CARD_MOTION_TTL_MS,
    );
    const validSpotlight =
      this.spotlightCard && this.spotlightCard.expiresAt > now ? { ...this.spotlightCard } : null;

    return {
      roomCode: this.roomCode,
      hostId: this.hostId,
      phase: this.phase,
      roundNumber: this.roundNumber,
      currentTurnPlayerId: this.players[this.currentTurnIndex]?.id ?? '',
      actionsRemaining: this.actionsRemaining,
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
        handCount: p.hand.length,
        file: revealAll
          ? p.dossierSlots
              .filter((c): c is Card => Boolean(c && isDocumentCard(c.cardType)))
              .map(c => c.cardType as (typeof CORE_DOCUMENTS)[number])
          : [],
        fileSummary: revealAll ? this.fileSummaries[p.id] ?? null : null,
      })),
      deckCount: this.deck.length,
      discardPileRecent: this.discardPile.slice(-4),
      discardPileTop: this.discardPile.length > 0 ? this.discardPile[this.discardPile.length - 1] : null,
      discardPileCount: this.discardPile.length,
      globalEffects: { ...this.globalEffects },
      pendingReaction: this.pendingReaction ? { ...this.pendingReaction } : null,
      pendingArchive: this.pendingArchive ? { ...this.pendingArchive } : null,
      pendingTargetDiscard: this.pendingTargetDiscard ? { ...this.pendingTargetDiscard } : null,
      recentSlotHighlights: validHighlights,
      recentCardMotions: validMotions,
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
