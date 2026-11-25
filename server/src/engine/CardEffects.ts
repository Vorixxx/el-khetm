// ========================
// EL-KHETM (الختم) — Card Effects Engine (Fair Positional + Anti-Spam Edition)
// ========================

import {
  Card,
  CardType,
  DocumentCardType,
  GlobalEffects,
  GAME_CONSTANTS,
} from '@el-khetm/shared';
import {
  CARD_DEFINITIONS,
  getCardDef,
  isDocumentCard,
  shuffleDeck,
} from '@el-khetm/shared';

// === Internal Player State (server only) ===

export interface ServerPlayer {
  id: string;
  name: string;
  avatarId: string;
  isBot: boolean;
  isDisconnected: boolean;
  isFrozen: boolean;
  frozenCard: Card | null;
  /** Anti-spam shield until this player's next turn starts */
  isImmuneThisRound: boolean;
  /** Closed 4-slot dossier on the table */
  dossierSlots: (Card | null)[];
  startPeeksRemaining: number;
  matchScore: number;
  /** Memory map: targetPlayerId -> set of slot indices this player has seen/placed */
  seenSlotsByPlayer: Record<string, Set<number>>;
  /** Slots previously seen by this player that were tampered behind their back */
  tamperedSlotsByPlayer: Record<string, Set<number>>;
  /** Bot numeric memory: targetPlayerId -> slotIndex -> CardType */
  botMemory: Record<string, Record<number, CardType | null>>;
  file: DocumentCardType[];
  hand: Card[];
  socketId: string | null;
  sessionId: string;
}

export interface ServerGameState {
  players: ServerPlayer[];
  currentTurnIndex: number;
  deck: Card[];
  openMarket: (Card | null)[];
  discardPile: Card[];
  globalEffects: GlobalEffects;
  activeMedhatCard: Card | null;
  actionLog: string[];
}

export function syncPlayerFile(player: ServerPlayer): void {
  player.file = player.dossierSlots
    .filter((c): c is Card => Boolean(c && isDocumentCard(c.cardType)))
    .map(c => c.cardType as DocumentCardType);
}

export function getNextPlayer(state: ServerGameState): ServerPlayer | undefined {
  if (state.players.length < 2) return undefined;
  return state.players[(state.currentTurnIndex + 1) % state.players.length];
}

export function getPrevPlayer(state: ServerGameState): ServerPlayer | undefined {
  if (state.players.length < 2) return undefined;
  return state.players[(state.currentTurnIndex - 1 + state.players.length) % state.players.length];
}

export function markSlotSeen(
  viewer: ServerPlayer,
  targetPlayerId: string,
  slotIndex: number,
  cardType: CardType | null,
): void {
  if (!viewer.seenSlotsByPlayer[targetPlayerId]) {
    viewer.seenSlotsByPlayer[targetPlayerId] = new Set();
  }
  viewer.seenSlotsByPlayer[targetPlayerId].add(slotIndex);
  viewer.tamperedSlotsByPlayer[targetPlayerId]?.delete(slotIndex);

  if (!viewer.botMemory[targetPlayerId]) {
    viewer.botMemory[targetPlayerId] = {};
  }
  viewer.botMemory[targetPlayerId][slotIndex] = cardType;
}

export function clearSlotMemoryAcrossPlayers(
  players: ServerPlayer[],
  targetPlayerId: string,
  slotIndex: number,
  markTamperedForOthers: boolean = false,
): void {
  for (const p of players) {
    const previouslySaw = p.seenSlotsByPlayer[targetPlayerId]?.has(slotIndex) ?? false;
    p.seenSlotsByPlayer[targetPlayerId]?.delete(slotIndex);
    if (markTamperedForOthers && previouslySaw) {
      if (!p.tamperedSlotsByPlayer[targetPlayerId]) {
        p.tamperedSlotsByPlayer[targetPlayerId] = new Set();
      }
      p.tamperedSlotsByPlayer[targetPlayerId].add(slotIndex);
    } else if (!markTamperedForOthers) {
      p.tamperedSlotsByPlayer[targetPlayerId]?.delete(slotIndex);
    }
    if (p.botMemory[targetPlayerId]) {
      delete p.botMemory[targetPlayerId][slotIndex];
    }
  }
}

// === Reshuffle & Draw Logic ===

export function reshuffleIfNeeded(state: ServerGameState): boolean {
  if (state.deck.length > 0) return false;
  if (state.discardPile.length <= 1) return false;

  const topCard = state.discardPile.pop()!;
  const recycled = state.discardPile.splice(0, state.discardPile.length);
  state.discardPile.push(topCard);
  state.deck.push(...recycled);
  shuffleDeck(state.deck);

  addLogEntry(state, 'تم تفنيط الأرشيف من جديد!');
  return true;
}

export function popDeckCard(state: ServerGameState): Card | null {
  reshuffleIfNeeded(state);
  if (state.deck.length === 0) return null;
  return state.deck.pop()!;
}

export function drawCard(state: ServerGameState, player: ServerPlayer): Card | null {
  const card = popDeckCard(state);
  if (!card) return null;
  player.hand.push(card);
  return card;
}

export function drawCards(state: ServerGameState, player: ServerPlayer, count: number): Card[] {
  const drawn: Card[] = [];
  for (let i = 0; i < count; i++) {
    const card = drawCard(state, player);
    if (!card) break;
    drawn.push(card);
  }
  return drawn;
}

export function refillOpenMarket(state: ServerGameState): void {
  for (let i = 0; i < GAME_CONSTANTS.OPEN_MARKET_SIZE; i++) {
    if (!state.openMarket[i]) {
      state.openMarket[i] = popDeckCard(state);
    }
  }
}

// === Action Log ===

export function addLogEntry(state: ServerGameState, message: string): void {
  state.actionLog.push(message);
  if (state.actionLog.length > 6) {
    state.actionLog.shift();
  }
}

// === Card Validation ===

export interface PlayValidation {
  valid: boolean;
  error?: string;
}

export function validateCardPlay(
  state: ServerGameState,
  caster: ServerPlayer,
  card: Card,
  targetPlayerId?: string,
  targetSlotIndex?: number,
  ownSlotIndex?: number,
  burnCardInstanceId?: string,
): PlayValidation {
  const def = getCardDef(card.cardType);

  if (def.isReactionOnly) {
    return { valid: false, error: 'الكارت ده بيتلعب كرد فعل بس' };
  }

  if (def.category === 'trap') {
    return { valid: false, error: 'ورقة عقوبة! بدّلها لخصم بـ «تبديل مكاتب» أو احرقها كـ رسوم' };
  }

  if (isDocumentCard(card.cardType)) {
    return { valid: false, error: 'حط المستند جوه خانة في ملفك' };
  }

  // Burn cost validation
  if (def.burnCost > 0) {
    if (!burnCardInstanceId || burnCardInstanceId === card.instanceId) {
      return { valid: false, error: 'لازم تختار كارت تاني من إيدك تحرقه كـ رسوم' };
    }
    if (!caster.hand.some(c => c.instanceId === burnCardInstanceId)) {
      return { valid: false, error: 'كارت الحرق مش في إيدك' };
    }
  }

  // Fair positional validation
  if (def.positionalTarget === 'next') {
    const next = getNextPlayer(state);
    if (!next || next.id === caster.id) return { valid: false, error: 'مفيش لاعب بعدك' };
    if (card.cardType === 'system_down' && next.isFrozen) {
      return { valid: false, error: `${next.name} (اللي بعدك) متجمد أصلاً` };
    }
    if (card.cardType === 'missing_papers' && next.hand.length === 0) {
      return { valid: false, error: `${next.name} (اللي بعدك) إيده فاضية` };
    }
    return { valid: true };
  }

  if (def.positionalTarget === 'prev') {
    const prev = getPrevPlayer(state);
    if (!prev || prev.id === caster.id) return { valid: false, error: 'مفيش لاعب قبلك' };
    return { valid: true };
  }

  if (card.cardType === 'show_me_all') {
    const anyCardOnTable = state.players.some(p => p.dossierSlots.some(Boolean));
    if (!anyCardOnTable) return { valid: false, error: 'كل الخانات على الترابيزة فاضية' };
    return { valid: true };
  }

  // Any-slot peek (drawer_peek)
  if (def.targetsAnySlot) {
    if (!targetPlayerId) return { valid: false, error: 'اختار اللاعب اللي هتبص في درْجه' };
    const target = state.players.find(p => p.id === targetPlayerId);
    if (!target) return { valid: false, error: 'اللاعب مش موجود' };
    if (targetSlotIndex === undefined || targetSlotIndex < 0 || targetSlotIndex >= GAME_CONSTANTS.DOSSIER_SLOTS) {
      return { valid: false, error: 'اختار رقم الخانة (1-4)' };
    }
    if (!target.dossierSlots[targetSlotIndex]) return { valid: false, error: 'الخانة دي فاضية' };
    return { valid: true };
  }

  // Manually targeted attacks / steals (subject to Anti-Spam Round Immunity!)
  if (def.targetsOpponent) {
    if (!targetPlayerId) return { valid: false, error: 'لازم تختار خصم' };
    const target = state.players.find(p => p.id === targetPlayerId);
    if (!target) return { valid: false, error: 'الخصم مش موجود' };
    if (target.id === caster.id) return { valid: false, error: 'مش ممكن تستهدف نفسك' };
    if (target.isImmuneThisRound) {
      return { valid: false, error: `🛡️ ${target.name} محصّن ضد المقالب لحد ما ييجي دوره!` };
    }

    const validSlot = (idx?: number) =>
      idx !== undefined && idx >= 0 && idx < GAME_CONSTANTS.DOSSIER_SLOTS;

    switch (card.cardType) {
      case 'come_tomorrow':
        if (!validSlot(targetSlotIndex) || !target.dossierSlots[targetSlotIndex!]) {
          return { valid: false, error: 'الخانة دي فاضية' };
        }
        break;

      case 'file_lost': {
        const hasCard = target.dossierSlots.some(Boolean);
        if (!hasCard) {
          return { valid: false, error: 'ملف الخصم فاضي' };
        }
        break;
      }

      case 'wasta':
        if (!validSlot(targetSlotIndex) || !target.dossierSlots[targetSlotIndex!]) {
          return { valid: false, error: 'اختار خانة فيها ورقة من ملف الخصم' };
        }
        if (!validSlot(ownSlotIndex)) {
          return { valid: false, error: 'اختار الخانة في ملفك اللي هتحط فيها الورقة' };
        }
        break;

      case 'desk_swap':
        if (!validSlot(targetSlotIndex) || !target.dossierSlots[targetSlotIndex!]) {
          return { valid: false, error: 'اختار خانة فيها كارت عند الخصم' };
        }
        if (!validSlot(ownSlotIndex) || !caster.dossierSlots[ownSlotIndex!]) {
          return { valid: false, error: 'اختار خانة فيها كارت من ملفك للتبديل' };
        }
        break;
    }
  }

  if (card.cardType === 'uncle_gamal' && state.discardPile.length === 0) {
    return { valid: false, error: 'الأرشيف فاضي' };
  }

  if (card.cardType === 'dossier_sort' && state.deck.length === 0) {
    return { valid: false, error: 'كومة السحب فاضية' };
  }

  return { valid: true };
}

// === Card Effect Executions ===

export function executeSystemDown(
  state: ServerGameState,
  _caster: ServerPlayer,
  target: ServerPlayer,
  card: Card,
): void {
  target.isFrozen = true;
  target.frozenCard = card;
  addLogEntry(state, `السيستم واقع — ${target.name} هيفوّت دوره!`);
}

export function executeComeTomorrow(
  state: ServerGameState,
  _caster: ServerPlayer,
  target: ServerPlayer,
  targetSlotIndex: number,
): Card | null {
  const removed = target.dossierSlots[targetSlotIndex];
  if (!removed) return null;
  target.dossierSlots[targetSlotIndex] = null;
  clearSlotMemoryAcrossPlayers(state.players, target.id, targetSlotIndex, true);
  syncPlayerFile(target);
  state.discardPile.push(removed);
  target.isImmuneThisRound = true;
  addLogEntry(
    state,
    `فوت علينا بكرة — خانة #${targetSlotIndex + 1} عند ${target.name} (${CARD_DEFINITIONS[removed.cardType].nameAr}) راحت الأرشيف!`,
  );
  return removed;
}

export function executeWindow4(
  state: ServerGameState,
  caster: ServerPlayer,
  target: ServerPlayer,
): void {
  const casterHand = [...caster.hand];
  caster.hand = [...target.hand];
  target.hand = casterHand;
  addLogEntry(state, `شباك 4 — ${caster.name} بدّل كروت إيده مع ${target.name} (اللي قبله)!`);
}

export function executeMedhatVacation(
  state: ServerGameState,
  caster: ServerPlayer,
  card: Card,
): void {
  if (state.activeMedhatCard) {
    state.discardPile.push(state.activeMedhatCard);
  }
  state.activeMedhatCard = card;
  state.globalEffects.medhatVacationUntilPlayerId = caster.id;
  addLogEntry(state, `الأستاذ مدحت في إجازة — ممنوع تنزيل إمضاء المدير لفة كاملة!`);
}

export function executeFileLost(
  state: ServerGameState,
  _caster: ServerPlayer,
  target: ServerPlayer,
): number[] {
  const affectedSlots: number[] = [];
  for (let i = 0; i < GAME_CONSTANTS.DOSSIER_SLOTS; i++) {
    const slotCard = target.dossierSlots[i];
    if (slotCard) {
      target.hand.push(slotCard);
      target.dossierSlots[i] = null;
      clearSlotMemoryAcrossPlayers(state.players, target.id, i, true);
      affectedSlots.push(i);
    }
  }
  syncPlayerFile(target);
  if (affectedSlots.length > 0) {
    target.isImmuneThisRound = true;
  }
  addLogEntry(state, `الملف ضاع — ${affectedSlots.length} ورقات من ملف ${target.name} رجعوا لإيده!`);
  return affectedSlots;
}

export function executeWasta(
  state: ServerGameState,
  caster: ServerPlayer,
  target: ServerPlayer,
  targetSlotIndex: number,
  casterSlotIndex: number,
): Card | null {
  const stolen = target.dossierSlots[targetSlotIndex];
  if (!stolen) return null;

  target.dossierSlots[targetSlotIndex] = null;
  clearSlotMemoryAcrossPlayers(state.players, target.id, targetSlotIndex, true);
  syncPlayerFile(target);
  target.isImmuneThisRound = true;

  const replaced = caster.dossierSlots[casterSlotIndex];
  if (replaced) {
    state.discardPile.push(replaced);
  }
  caster.dossierSlots[casterSlotIndex] = stolen;
  clearSlotMemoryAcrossPlayers(state.players, caster.id, casterSlotIndex, false);
  markSlotSeen(caster, caster.id, casterSlotIndex, stolen.cardType);
  syncPlayerFile(caster);

  addLogEntry(
    state,
    `واسطة — ${caster.name} سرق خانة #${targetSlotIndex + 1} من ${target.name} وحطها في خانته #${casterSlotIndex + 1}!`,
  );
  return stolen;
}

export function executeDeskSwap(
  state: ServerGameState,
  caster: ServerPlayer,
  target: ServerPlayer,
  casterSlotIndex: number,
  targetSlotIndex: number,
): void {
  const casterCard = caster.dossierSlots[casterSlotIndex];
  const targetCard = target.dossierSlots[targetSlotIndex];
  if (!casterCard || !targetCard) return;

  const casterKnownOfTarget = caster.botMemory[target.id]?.[targetSlotIndex] ?? null;
  const casterKnownOfOwn = caster.botMemory[caster.id]?.[casterSlotIndex] ?? null;

  caster.dossierSlots[casterSlotIndex] = targetCard;
  target.dossierSlots[targetSlotIndex] = casterCard;

  // Mark tampered for anyone who had seen these slots (especially target losing their known slot!)
  clearSlotMemoryAcrossPlayers(state.players, caster.id, casterSlotIndex, true);
  clearSlotMemoryAcrossPlayers(state.players, target.id, targetSlotIndex, true);

  // Restore caster's accurate memory of what they just swapped
  caster.tamperedSlotsByPlayer[caster.id]?.delete(casterSlotIndex);
  caster.tamperedSlotsByPlayer[target.id]?.delete(targetSlotIndex);
  if (casterKnownOfTarget) {
    markSlotSeen(caster, caster.id, casterSlotIndex, targetCard.cardType);
  }
  if (casterKnownOfOwn) {
    markSlotSeen(caster, target.id, targetSlotIndex, casterCard.cardType);
  }

  target.isImmuneThisRound = true;
  syncPlayerFile(caster);
  syncPlayerFile(target);

  addLogEntry(
    state,
    `تبديل مكاتب — ${caster.name} (خانة #${casterSlotIndex + 1}) بدّل سراً مع ${target.name} (خانة #${targetSlotIndex + 1})!`,
  );
}

export function executeRecommendation(
  state: ServerGameState,
  caster: ServerPlayer,
): number {
  const drawn = drawCards(state, caster, 3);
  addLogEntry(state, `توصية من فوق — ${caster.name} سحب ${drawn.length} كروت!`);
  return drawn.length;
}
