// ========================
// EL-KHETM (الختم) — Strategic Memory Bot AI (Positional + Anti-Spam Aware)
// ========================

import {
  Card,
  CardType,
  DocumentCardType,
  DrawSource,
  GAME_CONSTANTS,
} from '@el-khetm/shared';
import {
  getCardDef,
  isDocumentCard,
  PREFERRED_DOC_SLOT,
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

export interface BotDrawDecision {
  source: DrawSource;
  marketIndex?: number;
}

export interface BotAction {
  type:
    | 'place_in_slot'
    | 'match_archive'
    | 'close_window'
    | 'play_card'
    | 'end_turn';
  cardInstanceId?: string;
  slotIndex?: number;
  ownSlotIndex?: number;
  targetPlayerId?: string;
  targetSlotIndex?: number;
  burnCardInstanceId?: string;
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

function getKnownSlotScoreEstimate(bot: ServerPlayer): { knownCount: number; uniqueDocs: number; traps: number } {
  const mem = bot.botMemory[bot.id] || {};
  const seen = new Set<DocumentCardType>();
  let knownCount = 0;
  let traps = 0;
  for (let i = 0; i < GAME_CONSTANTS.DOSSIER_SLOTS; i++) {
    if (!bot.dossierSlots[i]) continue;
    const known = mem[i];
    if (!known) continue;
    knownCount++;
    if (isDocumentCard(known)) {
      seen.add(known);
    } else if (getCardDef(known).category === 'trap' || getCardDef(known).category === 'prank') {
      traps++;
    }
  }
  return { knownCount, uniqueDocs: seen.size, traps };
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

function isTrapOrBad(type?: CardType | null): boolean {
  if (!type) return false;
  return type === 'fake_paper' || type === 'violation_ticket' || getCardDef(type).category === 'prank';
}

function pickTargetOwnSlotForDoc(bot: ServerPlayer, docType: DocumentCardType): number {
  const mem = bot.botMemory[bot.id] || {};
  const pref = PREFERRED_DOC_SLOT[docType];

  const prefCard = bot.dossierSlots[pref];
  const prefKnown = mem[pref];
  if (!prefCard) return pref;
  if (isTrapOrBad(prefKnown) || !prefKnown || (prefKnown && !isDocumentCard(prefKnown))) {
    return pref;
  }

  for (let i = 0; i < GAME_CONSTANTS.DOSSIER_SLOTS; i++) {
    if (!bot.dossierSlots[i]) return i;
  }

  for (let i = 0; i < GAME_CONSTANTS.DOSSIER_SLOTS; i++) {
    const k = mem[i];
    if (isTrapOrBad(k) || (k && !isDocumentCard(k))) {
      return i;
    }
  }

  const docCounts = new Map<string, number>();
  for (let i = 0; i < GAME_CONSTANTS.DOSSIER_SLOTS; i++) {
    const k = mem[i];
    if (k && isDocumentCard(k)) docCounts.set(k, (docCounts.get(k) || 0) + 1);
  }
  for (let i = 0; i < GAME_CONSTANTS.DOSSIER_SLOTS; i++) {
    const k = mem[i];
    if (k && isDocumentCard(k) && (docCounts.get(k) || 0) > 1) {
      return i;
    }
  }

  for (let i = 0; i < GAME_CONSTANTS.DOSSIER_SLOTS; i++) {
    if (!mem[i]) return i;
  }

  return pref;
}

function pickBurnCard(bot: ServerPlayer, excludeCardId: string, neededDocs: DocumentCardType[]): Card | undefined {
  const candidates = bot.hand.filter(c => c.instanceId !== excludeCardId);
  if (candidates.length === 0) return undefined;

  return [...candidates].sort((a, b) => {
    const score = (c: Card) => {
      if (c.cardType === 'violation_ticket') return -120;
      if (c.cardType === 'fake_paper') return -100;
      if (isDocumentCard(c.cardType) && neededDocs.includes(c.cardType)) return 95;
      if (isDocumentCard(c.cardType)) return 20;
      return CARD_PRIORITY[c.cardType] ?? 30;
    };
    return score(a) - score(b);
  })[0];
}

// === Draw Decision ===

export function decideBotDraw(state: ServerGameState, bot: ServerPlayer): BotDrawDecision {
  const needed = getNeededDocsFromMemory(bot);
  let bestIdx = -1;
  let bestVal = 0;

  state.openMarket.forEach((card, idx) => {
    if (!card) return;
    let val = 0;
    if (isDocumentCard(card.cardType) && needed.includes(card.cardType)) {
      val = card.cardType === 'eagle_seal' ? 120 : 85;
    } else if (
      card.cardType === 'breakfast_break' ||
      card.cardType === 'show_me_all' ||
      card.cardType === 'desk_swap' ||
      card.cardType === 'wasta' ||
      card.cardType === 'drawer_peek'
    ) {
      val = CARD_PRIORITY[card.cardType];
    }
    if (val > bestVal) {
      bestVal = val;
      bestIdx = idx;
    }
  });

  if (bestIdx !== -1 && bestVal >= 62) {
    return { source: 'market', marketIndex: bestIdx };
  }

  return { source: 'deck' };
}

// === Main Action Decision ===

export function decideBotAction(
  state: ServerGameState,
  bot: ServerPlayer,
  roundNumber: number,
  windowClosedByPlayerId: string | null,
  matchedThisTurn: boolean,
): BotAction {
  const medhatActive = state.globalEffects.medhatVacationUntilPlayerId !== null;
  const needed = getNeededDocsFromMemory(bot);
  const fairTargets = getNonImmuneOpponents(state, bot.id).sort((a, b) => scoreOpponentThreat(b) - scoreOpponentThreat(a));
  const allOpps = getAllOpponents(state, bot.id).sort((a, b) => scoreOpponentThreat(b) - scoreOpponentThreat(a));
  const mem = bot.botMemory[bot.id] || {};
  const topDiscard = state.discardPile.length > 0 ? state.discardPile[state.discardPile.length - 1] : null;
  const nextPlayer = getNextPlayer(state);
  const prevPlayer = getPrevPlayer(state);

  // 1. Free Match / Basra if known trap/non-unique matches top of Archive
  if (!matchedThisTurn && topDiscard) {
    for (let i = 0; i < GAME_CONSTANTS.DOSSIER_SLOTS; i++) {
      if (!bot.dossierSlots[i]) continue;
      const known = mem[i];
      if (!known || known !== topDiscard.cardType) continue;
      const isTrapOrExtra =
        isTrapOrBad(known) ||
        !isDocumentCard(known) ||
        bot.hand.some(h => h.cardType === known);
      if (isTrapOrExtra) {
        return { type: 'match_archive', slotIndex: i };
      }
    }
  }

  // 2. Place needed green document from hand into dossier
  for (const docType of ['eagle_seal', 'manager_sign', 'stamp_duty', 'id_copy'] as DocumentCardType[]) {
    if (!needed.includes(docType)) continue;
    const card = bot.hand.find(c => c.cardType === docType);
    if (!card) continue;
    if (docType === 'manager_sign' && medhatActive) continue;
    const targetSlot = pickTargetOwnSlotForDoc(bot, docType);
    return {
      type: 'place_in_slot',
      cardInstanceId: card.instanceId,
      slotIndex: targetSlot,
    };
  }

  // 3. Close Window check
  if (roundNumber >= GAME_CONSTANTS.MIN_ROUND_TO_CLOSE_WINDOW && !windowClosedByPlayerId) {
    const est = getKnownSlotScoreEstimate(bot);
    if (
      (est.uniqueDocs === 4 && est.traps === 0) ||
      (roundNumber >= 6 && est.uniqueDocs >= 3 && est.knownCount === 4 && est.traps === 0) ||
      (roundNumber >= 10 && est.uniqueDocs >= 2 && est.knownCount >= 3 && est.traps === 0 && Math.random() < 0.45)
    ) {
      return { type: 'close_window' };
    }
  }

  // 4. "وريني كده اللي معاك" (show_me_all — table-wide unseen inspect!)
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

  // 5. Peek single slot with drawer_peek
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

  // 6. Blind Desk Swap against non-immune opponent (dump violation_ticket / fake_paper / prank!)
  const deskSwap = bot.hand.find(c => c.cardType === 'desk_swap');
  if (deskSwap && fairTargets.length > 0) {
    let badOwnSlot = -1;
    for (let i = 0; i < GAME_CONSTANTS.DOSSIER_SLOTS; i++) {
      if (!bot.dossierSlots[i]) continue;
      const k = mem[i];
      if (isTrapOrBad(k) || (k && !isDocumentCard(k))) {
        badOwnSlot = i;
        break;
      }
    }
    if (badOwnSlot !== -1) {
      for (const opp of fairTargets) {
        const oppMem = bot.botMemory[opp.id] || {};
        let targetSlot = opp.dossierSlots.findIndex(
          (c, idx) => c !== null && oppMem[idx] && isDocumentCard(oppMem[idx]!),
        );
        if (targetSlot === -1) {
          targetSlot = opp.dossierSlots.findIndex(c => c !== null);
        }
        if (targetSlot !== -1) {
          return {
            type: 'play_card',
            cardInstanceId: deskSwap.instanceId,
            ownSlotIndex: badOwnSlot,
            targetPlayerId: opp.id,
            targetSlotIndex: targetSlot,
          };
        }
      }
    }
  }

  // 7. Positional neighbor attacks (no manual targeting!)
  const systemDown = bot.hand.find(c => c.cardType === 'system_down');
  if (systemDown && nextPlayer && !nextPlayer.isFrozen) {
    return { type: 'play_card', cardInstanceId: systemDown.instanceId };
  }

  const missingPapers = bot.hand.find(c => c.cardType === 'missing_papers');
  if (missingPapers && nextPlayer && nextPlayer.hand.length >= 2) {
    return { type: 'play_card', cardInstanceId: missingPapers.instanceId };
  }

  // 8. Non-immune targeted steals/sabotage on biggest threat
  const topFairThreat = fairTargets[0];
  if (topFairThreat) {
    const wasta = bot.hand.find(c => c.cardType === 'wasta');
    if (wasta) {
      const burn = pickBurnCard(bot, wasta.instanceId, needed);
      const targetSlot = topFairThreat.dossierSlots.findIndex(c => c !== null);
      if (burn && targetSlot !== -1) {
        const ownSlot = pickTargetOwnSlotForDoc(bot, 'stamp_duty');
        return {
          type: 'play_card',
          cardInstanceId: wasta.instanceId,
          targetPlayerId: topFairThreat.id,
          targetSlotIndex: targetSlot,
          ownSlotIndex: ownSlot,
          burnCardInstanceId: burn.instanceId,
        };
      }
    }

    const fileLost = bot.hand.find(c => c.cardType === 'file_lost');
    const filledCount = topFairThreat.dossierSlots.filter(Boolean).length;
    if (fileLost && filledCount >= 3) {
      const burn = pickBurnCard(bot, fileLost.instanceId, needed);
      if (burn) {
        return {
          type: 'play_card',
          cardInstanceId: fileLost.instanceId,
          targetPlayerId: topFairThreat.id,
          burnCardInstanceId: burn.instanceId,
        };
      }
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

  // 9. Previous neighbor window_4 if hand is tiny and prev has more cards
  const window4 = bot.hand.find(c => c.cardType === 'window_4');
  if (window4 && prevPlayer && bot.hand.length <= 2 && prevPlayer.hand.length > bot.hand.length + 1) {
    return { type: 'play_card', cardInstanceId: window4.instanceId };
  }

  // 10. Utilities: dossier_sort, uncle_gamal, recommendation, medhat_vacation
  const sortCard = bot.hand.find(c => c.cardType === 'dossier_sort');
  if (sortCard && state.deck.length >= 2) {
    return { type: 'play_card', cardInstanceId: sortCard.instanceId };
  }

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

  // 11. Trim excess hand if near cap
  if (bot.hand.length >= 5) {
    for (const c of bot.hand) {
      if (getCardPlayError(c.cardType, bot.file, medhatActive, { handCount: bot.hand.length }) !== null) {
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
      if (c.cardType === 'violation_ticket') return -120;
      if (c.cardType === 'fake_paper') return -100;
      if (isDocumentCard(c.cardType) && needed.includes(c.cardType)) return 150;
      if (isDocumentCard(c.cardType)) return 25;
      return CARD_PRIORITY[c.cardType] ?? 20;
    };
    return score(a) - score(b);
  });
  return { cardInstanceIds: scored.slice(0, count).map(c => c.instanceId) };
}

export function chooseSortDeckOrder(bot: ServerPlayer, topCards: Card[]): string[] {
  const needed = getNeededDocsFromMemory(bot);
  const sorted = [...topCards].sort((a, b) => {
    const score = (c: Card) => {
      if (isDocumentCard(c.cardType) && needed.includes(c.cardType)) return 150;
      return CARD_PRIORITY[c.cardType] ?? 20;
    };
    return score(b) - score(a);
  });
  return sorted.map(c => c.instanceId);
}

export function getBotTurnDelay(): number {
  return Math.floor(Math.random() * (GAME_CONSTANTS.BOT_MAX_DELAY_MS - GAME_CONSTANTS.BOT_MIN_DELAY_MS + 1)) +
    GAME_CONSTANTS.BOT_MIN_DELAY_MS;
}

export function getBotReactionDelay(): number {
  return Math.floor(Math.random() * (GAME_CONSTANTS.BOT_REACTION_MAX_MS - GAME_CONSTANTS.BOT_REACTION_MIN_MS + 1)) +
    GAME_CONSTANTS.BOT_REACTION_MIN_MS;
}
