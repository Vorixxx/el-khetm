// ========================
// EL-KHETM (الختم) — Bot AI Engine
// Smart heuristic AI for Bots & AFK/Disconnected takeover
// ========================

import {
  Card,
  CardType,
  DocumentCardType,
  GAME_CONSTANTS,
} from '@el-khetm/shared';
import {
  CARD_DEFINITIONS,
  getCardDef,
  isDocumentCard,
  canPlayEagleSeal,
  EAGLE_SEAL_PREREQUISITES,
  CORE_DOCUMENTS,
  CARD_PRIORITY,
  getCardPlayError,
} from '@el-khetm/shared';
import { ServerPlayer, ServerGameState } from './CardEffects';

// === Types ===

export interface BotAction {
  type: 'play_card' | 'end_turn';
  cardInstanceId?: string;
  targetPlayerId?: string;
  targetDocument?: DocumentCardType;
}

export interface BotReactionDecision {
  block: boolean;
}

export interface BotDiscardDecision {
  cardInstanceIds: string[];
}

export interface BotArchiveDecision {
  cardInstanceId: string;
}

// === Helper Functions ===

function getNeededDocs(player: ServerPlayer): DocumentCardType[] {
  return CORE_DOCUMENTS.filter(doc => !player.file.includes(doc));
}

function getNeededCoreDocs(player: ServerPlayer): DocumentCardType[] {
  return EAGLE_SEAL_PREREQUISITES.filter(doc => !player.file.includes(doc));
}

function findCardInHand(hand: Card[], cardType: CardType): Card | undefined {
  return hand.find(c => c.cardType === cardType);
}

function findCardsInHand(hand: Card[], cardType: CardType): Card[] {
  return hand.filter(c => c.cardType === cardType);
}

function getOpponents(state: ServerGameState, botId: string): ServerPlayer[] {
  // Shuffle opponents so ties never always fall on players[0] (the human player)
  const list = state.players.filter(p => p.id !== botId);
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function scoreThreat(p: ServerPlayer): number {
  return p.file.length * 10 + p.hand.length + (p.file.length >= 3 ? 20 : 0) - (p.isFrozen ? 4 : 0);
}

function getPlayableCards(
  hand: Card[],
  playerFile: DocumentCardType[],
  medhatVacationActive: boolean,
): Card[] {
  return hand.filter(c => {
    const error = getCardPlayError(c.cardType, playerFile, medhatVacationActive);
    return error === null;
  });
}

function getThreateningOpponents(state: ServerGameState, botId: string): ServerPlayer[] {
  return getOpponents(state, botId)
    .filter(p => p.file.length >= 2)
    .sort((a, b) => scoreThreat(b) - scoreThreat(a));
}

function randomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// === Main Bot Decision Functions ===

/**
 * Decide what action the bot should take during ACTION_PHASE.
 * Returns a BotAction or null if the bot should end its turn.
 */
export function decideBotAction(
  state: ServerGameState,
  bot: ServerPlayer,
): BotAction {
  const medhatActive = state.globalEffects.medhatVacationUntilPlayerId !== null;
  const playable = getPlayableCards(bot.hand, bot.file, medhatActive);
  const opponents = getOpponents(state, bot.id);

  // If no playable cards, end turn
  if (playable.length === 0) {
    return { type: 'end_turn' };
  }

  // --- Priority 1: Play eagle_seal if eligible ---
  const eagleSeal = playable.find(c => c.cardType === 'eagle_seal');
  if (eagleSeal && canPlayEagleSeal(bot.file)) {
    return {
      type: 'play_card',
      cardInstanceId: eagleSeal.instanceId,
    };
  }

  // --- Priority 2: Play any needed core document ---
  const neededCoreDocs = getNeededCoreDocs(bot);
  for (const neededDoc of neededCoreDocs) {
    const card = playable.find(c => c.cardType === neededDoc);
    if (card) {
      return {
        type: 'play_card',
        cardInstanceId: card.instanceId,
      };
    }
  }

  // --- Priority 3: Hit threatening opponents (prioritize 3/4 leaders, then 2/4 leaders) ---
  const threatening = getThreateningOpponents(state, bot.id);
  const criticalThreat = threatening.find(p => p.file.length >= 3);
  if (criticalThreat) {
    const topThreat = criticalThreat;

    // Try file_lost first (most devastating)
    const fileLost = playable.find(c => c.cardType === 'file_lost');
    if (fileLost && topThreat.file.length > 0) {
      return {
        type: 'play_card',
        cardInstanceId: fileLost.instanceId,
        targetPlayerId: topThreat.id,
      };
    }

    // Try come_tomorrow (remove a specific doc)
    const comeTomorrow = playable.find(c => c.cardType === 'come_tomorrow');
    if (comeTomorrow && topThreat.file.length > 0) {
      const targetDoc = pickBestDocToRemove(topThreat);
      if (targetDoc) {
        return {
          type: 'play_card',
          cardInstanceId: comeTomorrow.instanceId,
          targetPlayerId: topThreat.id,
          targetDocument: targetDoc,
        };
      }
    }

    // Try wasta (steal a doc the bot needs)
    const wasta = playable.find(c => c.cardType === 'wasta');
    if (wasta) {
      const stealTarget = findBestWastaTarget(state, bot);
      if (stealTarget) {
        return {
          type: 'play_card',
          cardInstanceId: wasta.instanceId,
          targetPlayerId: stealTarget.targetPlayerId,
          targetDocument: stealTarget.targetDocument,
        };
      }
    }

    // Try system_down (freeze threatening opponent)
    const systemDown = playable.find(c => c.cardType === 'system_down');
    if (systemDown && !topThreat.isFrozen) {
      return {
        type: 'play_card',
        cardInstanceId: systemDown.instanceId,
        targetPlayerId: topThreat.id,
      };
    }

    // Try missing_papers
    const missingPapers = playable.find(c => c.cardType === 'missing_papers');
    if (missingPapers && topThreat.hand.length > 0) {
      return {
        type: 'play_card',
        cardInstanceId: missingPapers.instanceId,
        targetPlayerId: topThreat.id,
      };
    }
  }

  // --- Priority 4: Utility cards ---
  // Play recommendation if hand <= 4
  const recommendation = playable.find(c => c.cardType === 'recommendation');
  if (recommendation && bot.hand.length <= 4) {
    return {
      type: 'play_card',
      cardInstanceId: recommendation.instanceId,
    };
  }

  // Play uncle_gamal if a needed card is in discard pile
  const uncleGamal = playable.find(c => c.cardType === 'uncle_gamal');
  if (uncleGamal && state.discardPile.length > 0) {
    const neededDocs = getNeededDocs(bot);
    const hasNeededInDiscard = state.discardPile.some(c =>
      neededDocs.includes(c.cardType as DocumentCardType) || c.cardType === 'eagle_seal',
    );
    if (hasNeededInDiscard) {
      return {
        type: 'play_card',
        cardInstanceId: uncleGamal.instanceId,
      };
    }
  }

  // --- Priority 5: Opportunistic attacks on any opponent ---
  // Try window_4 only if bot's hand is small and target has noticeably more cards, and bot doesn't hold eagle_seal
  const window4 = playable.find(c => c.cardType === 'window_4');
  const holdsEagleSeal = bot.hand.some(c => c.cardType === 'eagle_seal');
  if (window4 && !holdsEagleSeal && bot.hand.length <= 3) {
    const targetOpponent = opponents
      .filter(p => p.hand.length > bot.hand.length + 1)
      .sort((a, b) => b.hand.length - a.hand.length)[0];
    if (targetOpponent) {
      return {
        type: 'play_card',
        cardInstanceId: window4.instanceId,
        targetPlayerId: targetOpponent.id,
      };
    }
  }

  // Try wasta on any opponent who has a document bot still needs (even if <3 docs)
  const wastaAny = playable.find(c => c.cardType === 'wasta');
  if (wastaAny) {
    const stealTarget = findBestWastaTarget(state, bot);
    if (stealTarget) {
      return {
        type: 'play_card',
        cardInstanceId: wastaAny.instanceId,
        targetPlayerId: stealTarget.targetPlayerId,
        targetDocument: stealTarget.targetDocument,
      };
    }
  }

  // Try medhat_vacation if an opponent needs manager_sign (or has >= 1 doc)
  const medhat = playable.find(c => c.cardType === 'medhat_vacation');
  if (medhat && !medhatActive) {
    const opponentNeedsManagerSign = opponents.some(
      p => p.file.length >= 1 && !p.file.includes('manager_sign'),
    );
    if (opponentNeedsManagerSign) {
      return {
        type: 'play_card',
        cardInstanceId: medhat.instanceId,
      };
    }
  }

  // --- Fallback: Play useful disruptive cards without hurting self ---
  const expendable = playable.filter(c => {
    if (c.cardType === 'eagle_seal') return false;
    if (c.cardType === 'breakfast_break') return false;
    if (c.cardType === 'window_4') return false;
    // Save strong pranks if nobody is even ahead yet unless bot's hand is getting full
    if (bot.hand.length <= 5) {
      if (c.cardType === 'file_lost' && !opponents.some(p => p.file.length >= 2)) return false;
      if (c.cardType === 'come_tomorrow' && !opponents.some(p => p.file.length >= 2)) return false;
      if (c.cardType === 'system_down' && !opponents.some(p => p.file.length >= 1) && Math.random() < 0.65) return false;
      if (c.cardType === 'missing_papers' && !opponents.some(p => p.hand.length >= 5) && Math.random() < 0.6) return false;
    }
    if (c.cardType === 'file_lost' && bot.hand.length <= GAME_CONSTANTS.MAX_HAND_SIZE) {
      return opponents.some(p => p.file.length >= 2);
    }
    // Only play uncle_gamal if discardPile has useful cards
    if (c.cardType === 'uncle_gamal') {
      const neededDocs = getNeededDocs(bot);
      return state.discardPile.some(d =>
        neededDocs.includes(d.cardType as DocumentCardType) ||
        d.cardType === 'eagle_seal' ||
        d.cardType === 'breakfast_break' ||
        d.cardType === 'wasta' ||
        d.cardType === 'file_lost',
      );
    }
    if (c.cardType === 'recommendation' && bot.hand.length >= GAME_CONSTANTS.MAX_HAND_SIZE) {
      return false;
    }
    return true;
  });

  if (expendable.length > 0) {
    for (const card of expendable) {
      const def = getCardDef(card.cardType);
      if (def.targetsOpponent) {
        const validTarget = findValidTarget(state, bot, card);
        if (validTarget) {
          return {
            type: 'play_card',
            cardInstanceId: card.instanceId,
            targetPlayerId: validTarget.targetPlayerId,
            targetDocument: validTarget.targetDocument,
          };
        }
      } else if (!def.isReactionOnly) {
        return {
          type: 'play_card',
          cardInstanceId: card.instanceId,
        };
      }
    }
  }

  return { type: 'end_turn' };
}

/**
 * Find a valid target for a targeted card.
 */
function findValidTarget(
  state: ServerGameState,
  bot: ServerPlayer,
  card: Card,
): { targetPlayerId: string; targetDocument?: DocumentCardType } | null {
  // getOpponents() already randomizes order, so sorting by threat breaks ties fairly across all players
  const opponents = [...getOpponents(state, bot.id)].sort((a, b) => scoreThreat(b) - scoreThreat(a));

  if (card.cardType === 'missing_papers') {
    const byHand = [...getOpponents(state, bot.id)].sort((a, b) => b.hand.length - a.hand.length);
    const valid = byHand.find(opp => opp.hand.length > 0);
    return valid ? { targetPlayerId: valid.id } : null;
  }

  for (const opp of opponents) {
    switch (card.cardType) {
      case 'system_down':
        if (!opp.isFrozen) {
          return { targetPlayerId: opp.id };
        }
        break;
      case 'come_tomorrow':
        if (opp.file.length > 0) {
          const doc = pickBestDocToRemove(opp);
          if (doc) return { targetPlayerId: opp.id, targetDocument: doc };
        }
        break;
      case 'window_4':
        return { targetPlayerId: opp.id };
      case 'file_lost':
        if (opp.file.length > 0) {
          return { targetPlayerId: opp.id };
        }
        break;
      case 'wasta': {
        const stealable = opp.file.filter(doc => !bot.file.includes(doc));
        if (stealable.length > 0) {
          return { targetPlayerId: opp.id, targetDocument: stealable[0] };
        }
        break;
      }
    }
  }
  return null;
}

/**
 * Pick the best document to remove from an opponent's file.
 * Prioritize eagle_seal prerequisites that are hard to get back.
 */
function pickBestDocToRemove(target: ServerPlayer): DocumentCardType | undefined {
  // Prioritize removing manager_sign (fewer copies in deck: 6 vs 8)
  if (target.file.includes('manager_sign')) return 'manager_sign';
  if (target.file.includes('stamp_duty')) return 'stamp_duty';
  if (target.file.includes('id_copy')) return 'id_copy';
  return target.file[0];
}

/**
 * Find the best target for wasta (steal a doc the bot needs).
 */
function findBestWastaTarget(
  state: ServerGameState,
  bot: ServerPlayer,
): { targetPlayerId: string; targetDocument: DocumentCardType } | null {
  const neededDocs = getNeededCoreDocs(bot);
  const opponents = getOpponents(state, bot.id);

  // First priority: steal a doc the bot needs from the most threatening opponent
  for (const opp of opponents.sort((a, b) => b.file.length - a.file.length)) {
    for (const doc of neededDocs) {
      if (opp.file.includes(doc) && !bot.file.includes(doc)) {
        return { targetPlayerId: opp.id, targetDocument: doc };
      }
    }
  }

  // Fallback: steal any doc from most threatening opponent
  for (const opp of opponents.sort((a, b) => b.file.length - a.file.length)) {
    for (const doc of opp.file) {
      if (!bot.file.includes(doc)) {
        return { targetPlayerId: opp.id, targetDocument: doc };
      }
    }
  }

  return null;
}

// === Reaction Decision ===

/**
 * Decide whether the bot should block an incoming attack with breakfast_break.
 */
export function shouldBlock(
  bot: ServerPlayer,
  attackCardType: CardType,
): BotReactionDecision {
  const hasBreakfastBreak = bot.hand.some(c => c.cardType === 'breakfast_break');
  if (!hasBreakfastBreak) {
    return { block: false };
  }

  // Always block these devastating attacks
  if (attackCardType === 'file_lost' || attackCardType === 'come_tomorrow' || attackCardType === 'wasta') {
    return { block: true };
  }

  // Block system_down or missing_papers if bot has 2+ docs or holds eagle_seal
  if (attackCardType === 'system_down' || attackCardType === 'missing_papers') {
    const hasManyDocs = bot.file.length >= 2;
    const holdsEagleSeal = bot.hand.some(c => c.cardType === 'eagle_seal');
    if (hasManyDocs || holdsEagleSeal) {
      return { block: true };
    }
  }

  // Don't block window_4 if bot's hand is small (might benefit from swap)
  if (attackCardType === 'window_4') {
    if (bot.hand.length >= 4) {
      return { block: true };
    }
  }

  return { block: false };
}

// === Discard Decision ===

/**
 * Choose which cards to discard when hand exceeds 7.
 */
export function chooseDiscard(
  bot: ServerPlayer,
  excessCount: number,
): BotDiscardDecision {
  const neededDocs = getNeededDocs(bot);
  const sortedHand = [...bot.hand].sort((a, b) => {
    // Never discard eagle_seal
    if (a.cardType === 'eagle_seal') return 1;
    if (b.cardType === 'eagle_seal') return -1;

    // Never discard needed docs
    const aNeeded = neededDocs.includes(a.cardType as DocumentCardType);
    const bNeeded = neededDocs.includes(b.cardType as DocumentCardType);
    if (aNeeded && !bNeeded) return 1;
    if (!aNeeded && bNeeded) return -1;

    // Prioritize keeping breakfast_break
    if (a.cardType === 'breakfast_break' && b.cardType !== 'breakfast_break') return 1;
    if (b.cardType === 'breakfast_break' && a.cardType !== 'breakfast_break') return -1;

    // Discard duplicates first (cards the bot already has in file)
    const aInFile = bot.file.includes(a.cardType as DocumentCardType);
    const bInFile = bot.file.includes(b.cardType as DocumentCardType);
    if (aInFile && !bInFile) return -1;
    if (!aInFile && bInFile) return 1;

    // Discard by card priority (lower priority discarded first)
    return (CARD_PRIORITY[a.cardType] || 0) - (CARD_PRIORITY[b.cardType] || 0);
  });

  // Take the first excessCount cards to discard (lowest priority)
  const toDiscard = sortedHand.slice(0, excessCount);
  return {
    cardInstanceIds: toDiscard.map(c => c.instanceId),
  };
}

// === Archive Decision (Uncle Gamal) ===

/**
 * Choose which card to pick from the archive (discard pile).
 */
export function chooseArchiveCard(
  bot: ServerPlayer,
  availableCards: Card[],
): BotArchiveDecision {
  if (availableCards.length === 0) {
    // Shouldn't happen, but safety
    return { cardInstanceId: '' };
  }

  const neededDocs = getNeededDocs(bot);

  // Priority: pick eagle_seal if bot has all prerequisites
  if (canPlayEagleSeal(bot.file)) {
    const eagleSeal = availableCards.find(c => c.cardType === 'eagle_seal');
    if (eagleSeal) {
      return { cardInstanceId: eagleSeal.instanceId };
    }
  }

  // Priority: pick a needed core document
  for (const doc of neededDocs) {
    const card = availableCards.find(c => c.cardType === doc);
    if (card) {
      return { cardInstanceId: card.instanceId };
    }
  }

  // Priority: pick breakfast_break if bot doesn't have one
  if (!bot.hand.some(c => c.cardType === 'breakfast_break')) {
    const bb = availableCards.find(c => c.cardType === 'breakfast_break');
    if (bb) {
      return { cardInstanceId: bb.instanceId };
    }
  }

  // Fallback: pick highest priority card
  const sorted = [...availableCards].sort(
    (a, b) => (CARD_PRIORITY[b.cardType] || 0) - (CARD_PRIORITY[a.cardType] || 0),
  );
  return { cardInstanceId: sorted[0].instanceId };
}

// === Bot Timing ===

/**
 * Get a natural delay for bot turn actions (800-1200ms)
 */
export function getBotTurnDelay(): number {
  return randomDelay(GAME_CONSTANTS.BOT_MIN_DELAY_MS, GAME_CONSTANTS.BOT_MAX_DELAY_MS);
}

/**
 * Get a natural delay for bot reactions (1500-3000ms)
 */
export function getBotReactionDelay(): number {
  return randomDelay(GAME_CONSTANTS.BOT_REACTION_MIN_MS, GAME_CONSTANTS.BOT_REACTION_MAX_MS);
}
