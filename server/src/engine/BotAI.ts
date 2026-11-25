// ========================
// EL-KHETM (الختم) — Simplified Memory Bot AI (4-Document File Race, Zero Points)
// ========================

import {
  Card,
  CardType,
  DocumentCardType,
  GAME_CONSTANTS,
} from '@el-khetm/shared';
import {
  getCardDef,
  isDocumentCard,
  CARD_PRIORITY,
  getCardPlayError,
  CORE_DOCUMENTS,
} from '@el-khetm/shared';
import {
  ServerPlayer,
  ServerGameState,
  getNextPlayer,
  getPrevPlayer,
} from './CardEffects';

export interface BotAction {
  type: 'place_in_slot' | 'play_card' | 'end_turn';
  cardInstanceId?: string;
  slotIndex?: number;
  ownSlotIndex?: number;
  targetPlayerId?: string;
  targetSlotIndex?: number;
  multiTargets?: Record<string, number>;
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

function getKnownUniqueDocs(bot: ServerPlayer): Set<DocumentCardType> {
  const mem = bot.botMemory[bot.id] || {};
  const set = new Set<DocumentCardType>();
  for (let i = 0; i < GAME_CONSTANTS.DOSSIER_SLOTS; i++) {
    if (!bot.dossierSlots[i]) continue;
    const known = mem[i];
    if (known && isDocumentCard(known)) {
      set.add(known);
    }
  }
  return set;
}

function getNeededDocsFromMemory(bot: ServerPlayer): DocumentCardType[] {
  const known = getKnownUniqueDocs(bot);
  return CORE_DOCUMENTS.filter(d => !known.has(d));
}

function getNonImmuneOpponents(state: ServerGameState, botId: string): ServerPlayer[] {
  const list = state.players.filter(p => p.id !== botId && !p.isImmuneThisRound);
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function getAllOpponents(state: ServerGameState, botId: string): ServerPlayer[] {
  const list = state.players.filter(p => p.id !== botId);
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function scoreOpponentThreat(p: ServerPlayer): number {
  const filled = p.dossierSlots.filter(Boolean).length;
  return filled * 12 + p.hand.length * 2 - (p.isFrozen ? 4 : 0);
}

function pickTargetOwnSlotForDoc(bot: ServerPlayer): number {
  const mem = bot.botMemory[bot.id] || {};
  const indices = [0, 1, 2, 3];
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  // 1. Prefer any empty slot unpredictably
  for (const i of indices) {
    if (!bot.dossierSlots[i]) return i;
  }

  // 2. Replace any known non-document card
  for (const i of indices) {
    const k = mem[i];
    if (k && !isDocumentCard(k)) {
      return i;
    }
  }

  // 3. Replace duplicate documents
  const docCounts = new Map<string, number>();
  for (let i = 0; i < GAME_CONSTANTS.DOSSIER_SLOTS; i++) {
    const k = mem[i];
    if (k && isDocumentCard(k)) docCounts.set(k, (docCounts.get(k) || 0) + 1);
  }
  for (const i of indices) {
    const k = mem[i];
    if (k && isDocumentCard(k) && (docCounts.get(k) || 0) > 1) {
      return i;
    }
  }

  // 4. Replace unknown slot rather than risking a known unique document
  for (const i of indices) {
    if (!mem[i]) return i;
  }

  return indices[0];
}

// === Main Action Decision ===

export function decideBotAction(state: ServerGameState, bot: ServerPlayer): BotAction {
  const medhatActive = state.globalEffects.medhatVacationUntilPlayerId !== null;
  const needed = getNeededDocsFromMemory(bot);
  const fairTargets = getNonImmuneOpponents(state, bot.id).sort((a, b) => scoreOpponentThreat(b) - scoreOpponentThreat(a));
  const allOpps = getAllOpponents(state, bot.id).sort((a, b) => scoreOpponentThreat(b) - scoreOpponentThreat(a));
  const mem = bot.botMemory[bot.id] || {};
  const nextPlayer = getNextPlayer(state);
  const prevPlayer = getPrevPlayer(state);

  // 1. Place needed official document from hand into dossier
  for (const docType of ['eagle_seal', 'manager_sign', 'stamp_duty', 'id_copy'] as DocumentCardType[]) {
    if (!needed.includes(docType)) continue;
    const card = bot.hand.find(c => c.cardType === docType);
    if (!card) continue;
    if (docType === 'manager_sign' && medhatActive) continue;
    return {
      type: 'place_in_slot',
      cardInstanceId: card.instanceId,
      slotIndex: pickTargetOwnSlotForDoc(bot),
    };
  }

  // 2. "وريني كده اللي معاك" (table-wide unseen slot inspect)
  const showMeAll = bot.hand.find(c => c.cardType === 'show_me_all');
  if (showMeAll) {
    const multiTargets: Record<string, number> = {};
    for (const p of state.players) {
      const pMem = bot.botMemory[p.id] || {};
      let slotIdx = p.dossierSlots.findIndex((c, idx) => c !== null && !pMem[idx]);
      if (slotIdx === -1) {
        slotIdx = p.dossierSlots.findIndex(c => c !== null);
      }
      if (slotIdx !== -1) {
        multiTargets[p.id] = slotIdx;
      }
    }
    if (Object.keys(multiTargets).length > 0) {
      return {
        type: 'play_card',
        cardInstanceId: showMeAll.instanceId,
        multiTargets,
      };
    }
  }

  // 3. Peek own unknown slot first, else leader's slot
  const peekCard = bot.hand.find(c => c.cardType === 'drawer_peek');
  if (peekCard) {
    for (let i = 0; i < GAME_CONSTANTS.DOSSIER_SLOTS; i++) {
      if (bot.dossierSlots[i] && !mem[i]) {
        return {
          type: 'play_card',
          cardInstanceId: peekCard.instanceId,
          targetPlayerId: bot.id,
          targetSlotIndex: i,
        };
      }
    }
    const leader = allOpps[0];
    if (leader) {
      const idx = leader.dossierSlots.findIndex((c, i) => Boolean(c) && !bot.botMemory[leader.id]?.[i]);
      if (idx !== -1) {
        return {
          type: 'play_card',
          cardInstanceId: peekCard.instanceId,
          targetPlayerId: leader.id,
          targetSlotIndex: idx,
        };
      }
    }
  }

  // 4. Steal / Swap against non-immune opponents
  const topFairThreat = fairTargets[0];
  if (topFairThreat) {
    const wasta = bot.hand.find(c => c.cardType === 'wasta');
    if (wasta) {
      const oppMem = bot.botMemory[topFairThreat.id] || {};
      let targetSlot = topFairThreat.dossierSlots.findIndex(
        (c, idx) => c !== null && oppMem[idx] && isDocumentCard(oppMem[idx]!) && needed.includes(oppMem[idx] as DocumentCardType),
      );
      if (targetSlot === -1) {
        targetSlot = topFairThreat.dossierSlots.findIndex(c => c !== null);
      }
      if (targetSlot !== -1) {
        return {
          type: 'play_card',
          cardInstanceId: wasta.instanceId,
          targetPlayerId: topFairThreat.id,
          targetSlotIndex: targetSlot,
          ownSlotIndex: pickTargetOwnSlotForDoc(bot),
        };
      }
    }

    const deskSwap = bot.hand.find(c => c.cardType === 'desk_swap');
    if (deskSwap) {
      let badOwnSlot = -1;
      const docCounts = new Map<string, number>();
      for (let i = 0; i < GAME_CONSTANTS.DOSSIER_SLOTS; i++) {
        const k = mem[i];
        if (k && isDocumentCard(k)) docCounts.set(k, (docCounts.get(k) || 0) + 1);
      }
      for (let i = 0; i < GAME_CONSTANTS.DOSSIER_SLOTS; i++) {
        if (!bot.dossierSlots[i]) continue;
        const k = mem[i];
        if (k && (!isDocumentCard(k) || (docCounts.get(k) || 0) > 1)) {
          badOwnSlot = i;
          break;
        }
      }
      if (badOwnSlot !== -1) {
        const oppMem = bot.botMemory[topFairThreat.id] || {};
        let targetSlot = topFairThreat.dossierSlots.findIndex(
          (c, idx) => c !== null && oppMem[idx] && isDocumentCard(oppMem[idx]!),
        );
        if (targetSlot === -1) {
          targetSlot = topFairThreat.dossierSlots.findIndex(c => c !== null);
        }
        if (targetSlot !== -1) {
          return {
            type: 'play_card',
            cardInstanceId: deskSwap.instanceId,
            ownSlotIndex: badOwnSlot,
            targetPlayerId: topFairThreat.id,
            targetSlotIndex: targetSlot,
          };
        }
      }
    }

    const filledCount = topFairThreat.dossierSlots.filter(Boolean).length;
    const fileLost = bot.hand.find(c => c.cardType === 'file_lost');
    if (fileLost && filledCount >= 3) {
      return {
        type: 'play_card',
        cardInstanceId: fileLost.instanceId,
        targetPlayerId: topFairThreat.id,
      };
    }

    const comeTomorrow = bot.hand.find(c => c.cardType === 'come_tomorrow');
    if (comeTomorrow && filledCount >= 2) {
      const oppMem = bot.botMemory[topFairThreat.id] || {};
      let targetSlot = topFairThreat.dossierSlots.findIndex(
        (c, idx) => c !== null && oppMem[idx] && isDocumentCard(oppMem[idx]!),
      );
      if (targetSlot === -1) {
        targetSlot = topFairThreat.dossierSlots.findIndex(c => c !== null);
      }
      if (targetSlot !== -1) {
        return {
          type: 'play_card',
          cardInstanceId: comeTomorrow.instanceId,
          targetPlayerId: topFairThreat.id,
          targetSlotIndex: targetSlot,
        };
      }
    }
  }

  // 5. Positional neighbor attacks
  const systemDown = bot.hand.find(c => c.cardType === 'system_down');
  if (systemDown && nextPlayer && !nextPlayer.isFrozen) {
    return { type: 'play_card', cardInstanceId: systemDown.instanceId };
  }

  const missingPapers = bot.hand.find(c => c.cardType === 'missing_papers');
  if (missingPapers && nextPlayer && nextPlayer.hand.length >= 2) {
    return { type: 'play_card', cardInstanceId: missingPapers.instanceId };
  }

  const window4 = bot.hand.find(c => c.cardType === 'window_4');
  if (window4 && prevPlayer && bot.hand.length <= 2 && prevPlayer.hand.length > bot.hand.length + 1) {
    return { type: 'play_card', cardInstanceId: window4.instanceId };
  }

  // 6. Utilities
  const uncleGamal = bot.hand.find(c => c.cardType === 'uncle_gamal');
  if (uncleGamal && state.discardPile.length > 0) {
    const goodInArchive = state.discardPile.some(
      c => (isDocumentCard(c.cardType) && needed.includes(c.cardType)) || c.cardType === 'breakfast_break',
    );
    if (goodInArchive) {
      return { type: 'play_card', cardInstanceId: uncleGamal.instanceId };
    }
  }

  const rec = bot.hand.find(c => c.cardType === 'recommendation');
  if (rec && bot.hand.length <= 4) {
    return { type: 'play_card', cardInstanceId: rec.instanceId };
  }

  const medhat = bot.hand.find(c => c.cardType === 'medhat_vacation');
  if (medhat && !medhatActive) {
    return { type: 'play_card', cardInstanceId: medhat.instanceId };
  }

  // 7. Trim excess hand if near cap
  if (bot.hand.length >= 5) {
    for (const c of bot.hand) {
      if (getCardPlayError(c.cardType, bot.file, medhatActive) !== null) {
        continue;
      }
      const def = getCardDef(c.cardType);
      if (c.cardType === 'breakfast_break' || c.cardType === 'window_4' || c.cardType === 'file_lost' || c.cardType === 'wasta') continue;
      if (!def.targetsOpponent && !def.targetsAnySlot && !def.positionalTarget) {
        if (c.cardType === 'uncle_gamal' && state.discardPile.length === 0) continue;
        return { type: 'play_card', cardInstanceId: c.instanceId };
      }
    }
  }

  return { type: 'end_turn' };
}

export function shouldBlock(bot: ServerPlayer, attackCardType: CardType): BotReactionDecision {
  const hasBB = bot.hand.some(c => c.cardType === 'breakfast_break');
  if (!hasBB) return { block: false };

  if (attackCardType === 'file_lost' || attackCardType === 'wasta' || attackCardType === 'desk_swap' || attackCardType === 'come_tomorrow') {
    return { block: true };
  }
  if (attackCardType === 'system_down' || attackCardType === 'missing_papers') {
    return { block: bot.hand.length >= 3 || getKnownUniqueDocs(bot).size >= 2 };
  }
  return { block: false };
}

export function chooseArchiveCard(bot: ServerPlayer, archiveCards: Card[]): BotArchiveDecision {
  if (archiveCards.length === 0) return { cardInstanceId: '' };
  const needed = getNeededDocsFromMemory(bot);
  const scored = [...archiveCards].sort((a, b) => {
    const score = (c: Card) => {
      if (isDocumentCard(c.cardType) && needed.includes(c.cardType)) return 200;
      return CARD_PRIORITY[c.cardType] ?? 10;
    };
    return score(b) - score(a);
  });
  return { cardInstanceId: scored[0].instanceId };
}

export function chooseDiscard(bot: ServerPlayer, count: number): BotDiscardDecision {
  const needed = getNeededDocsFromMemory(bot);
  const scored = [...bot.hand].sort((a, b) => {
    const score = (c: Card) => {
      if (isDocumentCard(c.cardType) && needed.includes(c.cardType)) return 150;
      if (isDocumentCard(c.cardType)) return 25;
      return CARD_PRIORITY[c.cardType] ?? 20;
    };
    return score(a) - score(b);
  });
  return { cardInstanceIds: scored.slice(0, count).map(c => c.instanceId) };
}

export function getBotTurnDelay(): number {
  return Math.floor(Math.random() * (GAME_CONSTANTS.BOT_MAX_DELAY_MS - GAME_CONSTANTS.BOT_MIN_DELAY_MS + 1)) +
    GAME_CONSTANTS.BOT_MIN_DELAY_MS;
}

export function getBotReactionDelay(): number {
  return Math.floor(Math.random() * (GAME_CONSTANTS.BOT_REACTION_MAX_MS - GAME_CONSTANTS.BOT_REACTION_MIN_MS + 1)) +
    GAME_CONSTANTS.BOT_REACTION_MIN_MS;
}
