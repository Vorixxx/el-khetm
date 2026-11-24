// ========================
// EL-KHETM (الختم) — Card Effects Engine
// Pure functions that execute each card's effect on the game state
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
  canPlayEagleSeal,
  shuffleDeck,
  EAGLE_SEAL_PREREQUISITES,
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
  file: DocumentCardType[];
  fileCards: Card[];
  hand: Card[];
  socketId: string | null;
  sessionId: string;
}

export interface ServerGameState {
  players: ServerPlayer[];
  deck: Card[];
  discardPile: Card[];
  globalEffects: GlobalEffects;
  activeMedhatCard: Card | null;
  actionLog: string[];
}

export function syncPlayerFile(player: ServerPlayer): void {
  player.file = player.fileCards.map(c => c.cardType as DocumentCardType);
}

// === Reshuffle Logic ===

/**
 * Before EVERY draw, if deck is empty:
 * keep top of discardPile, shuffle rest into deck.
 * Returns true if reshuffle occurred.
 */
export function reshuffleIfNeeded(state: ServerGameState): boolean {
  if (state.deck.length > 0) return false;
  if (state.discardPile.length <= 1) return false; // Need at least 2 cards (1 to keep on top)

  // Keep the top card of discard pile
  const topCard = state.discardPile.pop()!;
  // Take all remaining discard pile cards into deck (mutate arrays cleanly)
  const recycled = state.discardPile.splice(0, state.discardPile.length);
  state.discardPile.push(topCard);
  state.deck.push(...recycled);
  // Shuffle the new deck
  shuffleDeck(state.deck);

  addLogEntry(state, 'تم تفنيط الأرشيف من جديد!');
  return true;
}

/**
 * Draw a single card from deck into a player's hand.
 * Triggers reshuffle if needed.
 * Returns the drawn card or null if no cards available.
 */
export function drawCard(state: ServerGameState, player: ServerPlayer): Card | null {
  reshuffleIfNeeded(state);
  if (state.deck.length === 0) return null;
  const card = state.deck.pop()!;
  player.hand.push(card);
  return card;
}

/**
 * Draw multiple cards (used by recommendation).
 * Checks reshuffle before EACH draw.
 */
export function drawCards(state: ServerGameState, player: ServerPlayer, count: number): Card[] {
  const drawn: Card[] = [];
  for (let i = 0; i < count; i++) {
    const card = drawCard(state, player);
    if (!card) break; // No more cards available
    drawn.push(card);
  }
  return drawn;
}

// === Action Log ===

export function addLogEntry(state: ServerGameState, message: string): void {
  state.actionLog.push(message);
  if (state.actionLog.length > 5) {
    state.actionLog.shift();
  }
}

// === Card Validation ===

export interface PlayValidation {
  valid: boolean;
  error?: string;
}

/**
 * Validate whether a card can be played in the current state.
 */
export function validateCardPlay(
  state: ServerGameState,
  caster: ServerPlayer,
  card: Card,
  targetPlayerId?: string,
  targetDocument?: DocumentCardType,
): PlayValidation {
  const def = getCardDef(card.cardType);

  // Reaction-only cards can't be played proactively
  if (def.isReactionOnly) {
    return { valid: false, error: 'الكارت ده بيتلعب كرد فعل بس' };
  }

  // Document-specific validations
  if (isDocumentCard(card.cardType)) {
    if (card.cardType === 'eagle_seal') {
      if (!canPlayEagleSeal(caster.file)) {
        return { valid: false, error: 'محتاج الـ 3 ورقات الأول' };
      }
    } else if (card.cardType === 'manager_sign') {
      if (state.globalEffects.medhatVacationUntilPlayerId !== null) {
        return { valid: false, error: 'الأستاذ مدحت في إجازة!' };
      }
      if (caster.file.includes('manager_sign')) {
        return { valid: false, error: 'عندك في الملف' };
      }
    } else {
      // id_copy, stamp_duty
      if (caster.file.includes(card.cardType)) {
        return { valid: false, error: 'عندك في الملف' };
      }
    }
  }

  // Target validation for targeted cards
  if (def.targetsOpponent) {
    if (!targetPlayerId) {
      return { valid: false, error: 'لازم تختار خصم' };
    }
    const target = state.players.find(p => p.id === targetPlayerId);
    if (!target) {
      return { valid: false, error: 'الخصم مش موجود' };
    }
    if (target.id === caster.id) {
      return { valid: false, error: 'مش ممكن تستهدف نفسك' };
    }

    // Card-specific target validations
    switch (card.cardType) {
      case 'system_down':
        if (target.isFrozen) {
          return { valid: false, error: 'الخصم ده متجمد أصلاً' };
        }
        break;
      case 'come_tomorrow':
        if (target.file.length === 0) {
          return { valid: false, error: 'الخصم ملفه فاضي' };
        }
        if (!targetDocument) {
          return { valid: false, error: 'لازم تختار ورقة من ملف الخصم' };
        }
        if (!target.file.includes(targetDocument)) {
          return { valid: false, error: 'الورقة مش في ملف الخصم' };
        }
        break;
      case 'missing_papers':
        if (target.hand.length === 0) {
          return { valid: false, error: 'الخصم مفيش في إيده كروت' };
        }
        break;
      case 'file_lost':
        if (target.file.length === 0) {
          return { valid: false, error: 'الخصم ملفه فاضي' };
        }
        break;
      case 'wasta':
        if (target.file.length === 0) {
          return { valid: false, error: 'الخصم ملفه فاضي' };
        }
        if (!targetDocument) {
          return { valid: false, error: 'لازم تختار ورقة من ملف الخصم' };
        }
        if (!target.file.includes(targetDocument)) {
          return { valid: false, error: 'الورقة مش في ملف الخصم' };
        }
        if (caster.file.includes(targetDocument)) {
          return { valid: false, error: 'عندك الورقة دي في ملفك' };
        }
        break;
    }
  }

  // uncle_gamal: discard pile must not be empty
  if (card.cardType === 'uncle_gamal') {
    if (state.discardPile.length === 0) {
      return { valid: false, error: 'الأرشيف فاضي' };
    }
  }

  return { valid: true };
}

// === Card Effect Execution Functions ===

/**
 * Execute system_down: Freeze target player and place system_down card on them
 */
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

/**
 * Execute come_tomorrow: Move 1 specific physical doc Card from target's file to discard pile
 */
export function executeComeTomorrow(
  state: ServerGameState,
  _caster: ServerPlayer,
  target: ServerPlayer,
  targetDoc: DocumentCardType,
): void {
  const docIndex = target.fileCards.findIndex(c => c.cardType === targetDoc);
  if (docIndex === -1) return; // Should not happen after validation
  const [discardedCard] = target.fileCards.splice(docIndex, 1);
  syncPlayerFile(target);
  state.discardPile.push(discardedCard);
  const docDef = CARD_DEFINITIONS[targetDoc];
  addLogEntry(state, `فوت علينا بكرة — ${docDef.nameAr} اتشالت من ملف ${target.name}!`);
}

/**
 * Execute missing_papers: Discard 2 random cards from target's hand
 * Returns number of cards actually discarded.
 */
export function executeMissingPapers(
  state: ServerGameState,
  _caster: ServerPlayer,
  target: ServerPlayer,
): number {
  const discardCount = Math.min(2, target.hand.length);
  for (let i = 0; i < discardCount; i++) {
    const randomIndex = Math.floor(Math.random() * target.hand.length);
    const [discarded] = target.hand.splice(randomIndex, 1);
    state.discardPile.push(discarded);
  }
  addLogEntry(state, `ورقك ناقص — ${target.name} رمى ${discardCount} كارت!`);
  return discardCount;
}

/**
 * Execute window_4: Swap caster's remaining hand with target's entire hand
 * The played window_4 card is already removed from caster's hand before this.
 */
export function executeWindow4(
  state: ServerGameState,
  caster: ServerPlayer,
  target: ServerPlayer,
): void {
  const casterHand = [...caster.hand];
  caster.hand = [...target.hand];
  target.hand = casterHand;
  addLogEntry(state, `شباك 4 — ${caster.name} بدّل كروته مع ${target.name}!`);
}

/**
 * Execute medhat_vacation: Set global block on manager_sign
 * Keeps the physical medhat_vacation card on the table until caster's next turn.
 * If another medhat_vacation was already active, moves the previous card to discardPile.
 */
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
  addLogEntry(state, `الأستاذ مدحت في إجازة — محدش يقدر ينزل إمضاء المدير!`);
}

/**
 * Execute file_lost: Return ALL physical doc cards from target's file to target's hand
 * Returns count of returned docs.
 */
export function executeFileLost(
  state: ServerGameState,
  _caster: ServerPlayer,
  target: ServerPlayer,
): number {
  const docsReturned = target.fileCards.length;
  for (const returnedCard of target.fileCards) {
    target.hand.push(returnedCard);
  }
  target.fileCards = [];
  syncPlayerFile(target);
  addLogEntry(state, `الملف ضاع — كل ورق ${target.name} (${docsReturned}) رجع لإيده!`);
  return docsReturned;
}

/**
 * Execute wasta: Steal 1 specific physical doc Card from target's file to caster's file
 */
export function executeWasta(
  state: ServerGameState,
  caster: ServerPlayer,
  target: ServerPlayer,
  targetDoc: DocumentCardType,
): void {
  if (caster.file.includes(targetDoc)) return;
  const docIndex = target.fileCards.findIndex(c => c.cardType === targetDoc);
  if (docIndex === -1) return;
  const [stolenCard] = target.fileCards.splice(docIndex, 1);
  syncPlayerFile(target);
  caster.fileCards.push(stolenCard);
  syncPlayerFile(caster);
  const docDef = CARD_DEFINITIONS[targetDoc];
  addLogEntry(state, `واسطة — ${caster.name} سرق ${docDef.nameAr} من ملف ${target.name}!`);
}

/**
 * Execute recommendation: Draw 3 cards (with reshuffle check each draw)
 * Returns count drawn.
 */
export function executeRecommendation(
  state: ServerGameState,
  caster: ServerPlayer,
): number {
  const drawn = drawCards(state, caster, 3);
  addLogEntry(state, `توصية من فوق — ${caster.name} سحب ${drawn.length} كروت!`);
  return drawn.length;
}

/**
 * Execute document placement: Place physical document Card in caster's file
 */
export function executeDocumentPlacement(
  state: ServerGameState,
  caster: ServerPlayer,
  card: Card,
): boolean {
  const docType = card.cardType as DocumentCardType;
  caster.fileCards.push(card);
  syncPlayerFile(caster);
  const docDef = CARD_DEFINITIONS[docType];
  addLogEntry(state, `${caster.name} نزّل ${docDef.nameAr} في ملفه!`);

  // Check for eagle_seal instant win
  if (docType === 'eagle_seal') {
    addLogEntry(state, `مبروك يا ${caster.name}! ختمت ورقك ومشيت قبل الزحمة!`);
    return true; // Signal win
  }
  return false;
}

/**
 * Execute a card effect based on its type.
 * Returns true if the game should end (eagle_seal win).
 */
export function executeCardEffect(
  state: ServerGameState,
  caster: ServerPlayer,
  card: Card,
  targetPlayerId?: string,
  targetDocument?: DocumentCardType,
): boolean {
  const target = targetPlayerId
    ? state.players.find(p => p.id === targetPlayerId)
    : undefined;

  switch (card.cardType) {
    case 'system_down':
      if (target) executeSystemDown(state, caster, target, card);
      break;
    case 'come_tomorrow':
      if (target && targetDocument) executeComeTomorrow(state, caster, target, targetDocument);
      break;
    case 'missing_papers':
      if (target) executeMissingPapers(state, caster, target);
      break;
    case 'window_4':
      if (target) executeWindow4(state, caster, target);
      break;
    case 'medhat_vacation':
      executeMedhatVacation(state, caster, card);
      break;
    case 'file_lost':
      if (target) executeFileLost(state, caster, target);
      break;
    case 'wasta':
      if (target && targetDocument) executeWasta(state, caster, target, targetDocument);
      break;
    case 'recommendation':
      executeRecommendation(state, caster);
      break;
    // Documents
    case 'id_copy':
    case 'stamp_duty':
    case 'manager_sign':
    case 'eagle_seal':
      return executeDocumentPlacement(state, caster, card);
    // uncle_gamal is handled separately (PENDING_ARCHIVE phase)
    // breakfast_break is reaction-only
    default:
      break;
  }
  return false;
}

/**
 * Check if playing wasta would result in a win
 * (caster gets the doc that completes their prerequisites + they have eagle_seal in hand)
 */
export function checkWastaWin(
  caster: ServerPlayer,
  targetDoc: DocumentCardType,
): boolean {
  // After wasta, caster would have targetDoc in file
  const futureFile = [...caster.file, targetDoc];
  // Check if caster has eagle_seal in hand and would have all prerequisites
  const hasEagleSealInHand = caster.hand.some(c => c.cardType === 'eagle_seal');
  if (!hasEagleSealInHand) return false;
  return EAGLE_SEAL_PREREQUISITES.every(doc => futureFile.includes(doc));
}
