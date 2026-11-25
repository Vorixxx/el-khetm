// ========================
// EL-KHETM (الختم) — Balanced 64-Card Deck (Positional Targeting + Traps + Anti-Spam)
// ========================

import {
  Card,
  CardDefinition,
  CardType,
  DocumentCardType,
  PlayerScoreBreakdown,
} from './types';

// === Card Definitions ===

export const CARD_DEFINITIONS: Record<CardType, CardDefinition> = {
  // Category A: Core Documents (16 scarce cards)
  id_copy: {
    cardType: 'id_copy',
    category: 'document',
    nameAr: 'صورة البطاقة',
    descriptionAr: 'مستند أساسي (1/4): نزّله سراً في الخانة #1 (+4 ن، +2 لو في مكانه الصح)',
    color: '#15803D',
    quantity: 5,
    filePoints: 4,
    burnCost: 0,
    positionalTarget: null,
    triggersReaction: false,
    targetsOpponent: false,
    targetsSlot: false,
    targetsOwnSlot: true,
    targetsAnySlot: false,
    isGlobal: false,
    isReactionOnly: false,
    isSelfTarget: true,
  },
  stamp_duty: {
    cardType: 'stamp_duty',
    category: 'document',
    nameAr: 'الدمغة',
    descriptionAr: 'مستند أساسي (2/4): نزّله سراً في الخانة #2 (+5 ن، +2 لو في مكانه الصح)',
    color: '#15803D',
    quantity: 5,
    filePoints: 5,
    burnCost: 0,
    positionalTarget: null,
    triggersReaction: false,
    targetsOpponent: false,
    targetsSlot: false,
    targetsOwnSlot: true,
    targetsAnySlot: false,
    isGlobal: false,
    isReactionOnly: false,
    isSelfTarget: true,
  },
  manager_sign: {
    cardType: 'manager_sign',
    category: 'document',
    nameAr: 'إمضاء المدير',
    descriptionAr: 'مستند أساسي (3/4): نزّله سراً في الخانة #3 (+6 ن، +2 لو في مكانه الصح)',
    color: '#15803D',
    quantity: 4,
    filePoints: 6,
    burnCost: 0,
    positionalTarget: null,
    triggersReaction: false,
    targetsOpponent: false,
    targetsSlot: false,
    targetsOwnSlot: true,
    targetsAnySlot: false,
    isGlobal: false,
    isReactionOnly: false,
    isSelfTarget: true,
  },
  eagle_seal: {
    cardType: 'eagle_seal',
    category: 'document',
    nameAr: 'ختم النسر',
    descriptionAr: 'الورقة النادرة (2 بس في الجيم!): نزّلها في الخانة #4 (+10 ن، +2 لو في مكانها)',
    color: '#15803D',
    quantity: 2,
    filePoints: 10,
    burnCost: 0,
    positionalTarget: null,
    triggersReaction: false,
    targetsOpponent: false,
    targetsSlot: false,
    targetsOwnSlot: true,
    targetsAnySlot: false,
    isGlobal: false,
    isReactionOnly: false,
    isSelfTarget: true,
  },

  // Category B: Penalty Traps (6 cards: 4 fake_paper + 2 heavy violation_ticket)
  fake_paper: {
    cardType: 'fake_paper',
    category: 'trap',
    nameAr: 'ورق مضروب',
    descriptionAr: 'عائق (-5 نقط لو فضل في ملفك!): تخلّص منه بالجرد أو ازرعه لخصم بـ «تبديل مكاتب»!',
    color: '#64748B',
    quantity: 4,
    filePoints: -5,
    burnCost: 0,
    positionalTarget: null,
    triggersReaction: false,
    targetsOpponent: false,
    targetsSlot: false,
    targetsOwnSlot: true,
    targetsAnySlot: false,
    isGlobal: false,
    isReactionOnly: false,
    isSelfTarget: false,
  },
  violation_ticket: {
    cardType: 'violation_ticket',
    category: 'trap',
    nameAr: 'محضر مخالفة',
    descriptionAr: 'غرامة تقيلة (-10 نقط في نهاية الجيم!): احرقه كرسوم أو ازرعه في ملف خصم بـ «تبديل مكاتب»!',
    color: '#7F1D1D',
    quantity: 2,
    filePoints: -10,
    burnCost: 0,
    positionalTarget: null,
    triggersReaction: false,
    targetsOpponent: false,
    targetsSlot: false,
    targetsOwnSlot: true,
    targetsAnySlot: false,
    isGlobal: false,
    isReactionOnly: false,
    isSelfTarget: false,
  },

  // Category C: Fair Pranks (Positional Neighbors + Shield-Respecting Targeted)
  system_down: {
    cardType: 'system_down',
    category: 'prank',
    nameAr: 'السيستم واقع',
    descriptionAr: 'يجمّد اللاعب اللي جاي بعدك مباشرة في الدور تلقائياً (من غير تحالف على حد)!',
    color: '#B91C1C',
    quantity: 4,
    filePoints: -3,
    burnCost: 0,
    positionalTarget: 'next',
    triggersReaction: true,
    targetsOpponent: false,
    targetsSlot: false,
    targetsOwnSlot: false,
    targetsAnySlot: false,
    isGlobal: false,
    isReactionOnly: false,
    isSelfTarget: false,
  },
  missing_papers: {
    cardType: 'missing_papers',
    category: 'prank',
    nameAr: 'ورقك ناقص',
    descriptionAr: 'يجبر اللاعب اللي بعدك مباشرة يختار كارتين من إيده ويرميهم للأرشيف!',
    color: '#B91C1C',
    quantity: 3,
    filePoints: -2,
    burnCost: 0,
    positionalTarget: 'next',
    triggersReaction: true,
    targetsOpponent: false,
    targetsSlot: false,
    targetsOwnSlot: false,
    targetsAnySlot: false,
    isGlobal: false,
    isReactionOnly: false,
    isSelfTarget: false,
  },
  window_4: {
    cardType: 'window_4',
    category: 'prank',
    nameAr: 'شباك 4',
    descriptionAr: 'يبدّل كل كروت إيدك تلقائياً مع اللاعب اللي قبلك مباشرة!',
    color: '#B91C1C',
    quantity: 2,
    filePoints: -2,
    burnCost: 0,
    positionalTarget: 'prev',
    triggersReaction: true,
    targetsOpponent: false,
    targetsSlot: false,
    targetsOwnSlot: false,
    targetsAnySlot: false,
    isGlobal: false,
    isReactionOnly: false,
    isSelfTarget: false,
  },
  come_tomorrow: {
    cardType: 'come_tomorrow',
    category: 'prank',
    nameAr: 'فوت علينا بكرة',
    descriptionAr: 'اختار خانة من ملف خصم (غير محصّن) وارميها للأرشيف — بعدها ياخد حصانة لحد دوره!',
    color: '#B91C1C',
    quantity: 4,
    filePoints: -3,
    burnCost: 0,
    positionalTarget: null,
    triggersReaction: true,
    targetsOpponent: true,
    targetsSlot: true,
    targetsOwnSlot: false,
    targetsAnySlot: false,
    isGlobal: false,
    isReactionOnly: false,
    isSelfTarget: false,
  },
  medhat_vacation: {
    cardType: 'medhat_vacation',
    category: 'prank',
    nameAr: 'الأستاذ مدحت في إجازة',
    descriptionAr: 'على الترابيزة كلها: محدش يقدر يحط «إمضاء المدير» لفة كاملة!',
    color: '#B91C1C',
    quantity: 2,
    filePoints: -2,
    burnCost: 0,
    positionalTarget: null,
    triggersReaction: false,
    targetsOpponent: false,
    targetsSlot: false,
    targetsOwnSlot: false,
    targetsAnySlot: false,
    isGlobal: true,
    isReactionOnly: false,
    isSelfTarget: false,
  },
  file_lost: {
    cardType: 'file_lost',
    category: 'prank',
    nameAr: 'الملف ضاع',
    descriptionAr: 'احرق كارت من إيدك عشان ترجّع كل خانات ملف خصم لإيده (ومحصّن بعدها لحد دوره)!',
    color: '#B91C1C',
    quantity: 2,
    filePoints: -4,
    burnCost: 1,
    positionalTarget: null,
    triggersReaction: true,
    targetsOpponent: true,
    targetsSlot: false,
    targetsOwnSlot: false,
    targetsAnySlot: false,
    isGlobal: false,
    isReactionOnly: false,
    isSelfTarget: false,
  },

  // Category D: Defense, Memory & Table Inspection (25 cards)
  breakfast_break: {
    cardType: 'breakfast_break',
    category: 'utility',
    nameAr: 'بريك الفطار',
    descriptionAr: 'صد وألغِ أي مقلب أو «واسطة» أو «تبديل مكاتب» عليك (×5 في الكوتشينة)',
    color: '#1D4ED8',
    quantity: 5,
    filePoints: 1,
    burnCost: 0,
    positionalTarget: null,
    triggersReaction: false,
    targetsOpponent: false,
    targetsSlot: false,
    targetsOwnSlot: false,
    targetsAnySlot: false,
    isGlobal: false,
    isReactionOnly: true,
    isSelfTarget: false,
  },
  wasta: {
    cardType: 'wasta',
    category: 'utility',
    nameAr: 'الواسطة',
    descriptionAr: 'احرق كارت واسرق خانة من خصم غير محصّن لملفك (وبعدها ياخد حصانة لحد دوره)!',
    color: '#B45309',
    quantity: 3,
    filePoints: 1,
    burnCost: 1,
    positionalTarget: null,
    triggersReaction: true,
    targetsOpponent: true,
    targetsSlot: true,
    targetsOwnSlot: true,
    targetsAnySlot: false,
    isGlobal: false,
    isReactionOnly: false,
    isSelfTarget: false,
  },
  drawer_peek: {
    cardType: 'drawer_peek',
    category: 'utility',
    nameAr: 'نظرة في الدرج',
    descriptionAr: 'اكشف سراً أي ورقة مقلوبة في ملفك أو ملف أي خصم لمدة 4 ثواني (ليك لوحدك)!',
    color: '#1D4ED8',
    quantity: 4,
    filePoints: 1,
    burnCost: 0,
    positionalTarget: null,
    triggersReaction: false,
    targetsOpponent: false,
    targetsSlot: false,
    targetsOwnSlot: false,
    targetsAnySlot: true,
    isGlobal: false,
    isReactionOnly: false,
    isSelfTarget: false,
  },
  show_me_all: {
    cardType: 'show_me_all',
    category: 'utility',
    nameAr: 'وريني كده اللي معاك',
    descriptionAr: 'كشف جماعي! اختار خانة من كل لاعب على الترابيزة (معاك إنت كمان) وشوفهم سراً!',
    color: '#1D4ED8',
    quantity: 2,
    filePoints: 1,
    burnCost: 0,
    positionalTarget: 'all',
    triggersReaction: false,
    targetsOpponent: false,
    targetsSlot: false,
    targetsOwnSlot: false,
    targetsAnySlot: false,
    isGlobal: false,
    isReactionOnly: false,
    isSelfTarget: false,
  },
  desk_swap: {
    cardType: 'desk_swap',
    category: 'utility',
    nameAr: 'تبديل مكاتب',
    descriptionAr: 'بدّل خانة من ملفك مع خانة عند خصم سراً (بيدي للخصم حصانة بعده وميتبدلش بسبام)!',
    color: '#1D4ED8',
    quantity: 4,
    filePoints: 1,
    burnCost: 0,
    positionalTarget: null,
    triggersReaction: true,
    targetsOpponent: true,
    targetsSlot: true,
    targetsOwnSlot: true,
    targetsAnySlot: false,
    isGlobal: false,
    isReactionOnly: false,
    isSelfTarget: false,
  },
  dossier_sort: {
    cardType: 'dossier_sort',
    category: 'utility',
    nameAr: 'ترتيب الدوسيه',
    descriptionAr: 'بص على أول 3 كروت في كومة السحب ورتبهم من فوق زي ما تحب!',
    color: '#1D4ED8',
    quantity: 3,
    filePoints: 1,
    burnCost: 0,
    positionalTarget: null,
    triggersReaction: false,
    targetsOpponent: false,
    targetsSlot: false,
    targetsOwnSlot: false,
    targetsAnySlot: false,
    isGlobal: false,
    isReactionOnly: false,
    isSelfTarget: true,
  },
  recommendation: {
    cardType: 'recommendation',
    category: 'utility',
    nameAr: 'توصية من فوق',
    descriptionAr: 'اسحب 3 كروت زيادة فوراً من كومة السحب',
    color: '#1D4ED8',
    quantity: 2,
    filePoints: 1,
    burnCost: 0,
    positionalTarget: null,
    triggersReaction: false,
    targetsOpponent: false,
    targetsSlot: false,
    targetsOwnSlot: false,
    targetsAnySlot: false,
    isGlobal: false,
    isReactionOnly: false,
    isSelfTarget: true,
  },
  uncle_gamal: {
    cardType: 'uncle_gamal',
    category: 'utility',
    nameAr: 'عم جمال (الأرشيف)',
    descriptionAr: 'افتح الأرشيف واختار منه أي كارت تاخده في إيدك',
    color: '#1D4ED8',
    quantity: 2,
    filePoints: 1,
    burnCost: 0,
    positionalTarget: null,
    triggersReaction: false,
    targetsOpponent: false,
    targetsSlot: false,
    targetsOwnSlot: false,
    targetsAnySlot: false,
    isGlobal: false,
    isReactionOnly: false,
    isSelfTarget: true,
  },
};

// === Helpers ===

let instanceCounter = 0;

export function generateInstanceId(): string {
  return `card_${Date.now()}_${++instanceCounter}_${Math.random().toString(36).slice(2, 6)}`;
}

/** Generate the full balanced 64-card deck */
export function generateDeck(): Card[] {
  const deck: Card[] = [];
  for (const def of Object.values(CARD_DEFINITIONS)) {
    for (let i = 0; i < def.quantity; i++) {
      deck.push({
        instanceId: generateInstanceId(),
        cardType: def.cardType,
      });
    }
  }
  return deck;
}

export function shuffleDeck<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function getCardDef(cardType: CardType): CardDefinition {
  return CARD_DEFINITIONS[cardType];
}

export function isDocumentCard(cardType: CardType): cardType is DocumentCardType {
  return CARD_DEFINITIONS[cardType].category === 'document';
}

export const EAGLE_SEAL_PREREQUISITES: DocumentCardType[] = ['id_copy', 'stamp_duty', 'manager_sign'];
export const CORE_DOCUMENTS: DocumentCardType[] = ['id_copy', 'stamp_duty', 'manager_sign', 'eagle_seal'];

export const PREFERRED_DOC_SLOT: Record<DocumentCardType, number> = {
  id_copy: 0,
  stamp_duty: 1,
  manager_sign: 2,
  eagle_seal: 3,
};

export const SLOT_LABELS_AR = [
  '١ البطاقة',
  '٢ الدمغة',
  '٣ الإمضاء',
  '٤ الختم',
] as const;

export function canPlayEagleSeal(file: DocumentCardType[]): boolean {
  return EAGLE_SEAL_PREREQUISITES.every(doc => file.includes(doc));
}

export function hasDocumentInFile(file: DocumentCardType[], doc: DocumentCardType): boolean {
  return file.includes(doc);
}

export function getCardPlayError(
  cardType: CardType,
  _playerFile: DocumentCardType[],
  medhatVacationActive: boolean,
  options?: { handCount?: number },
): string | null {
  const def = CARD_DEFINITIONS[cardType];

  if (def.isReactionOnly) {
    return 'الكارت ده بيتلعب كرد فعل بس';
  }

  if (isDocumentCard(cardType)) {
    if (cardType === 'manager_sign' && medhatVacationActive) {
      return 'الأستاذ مدحت في إجازة!';
    }
    return null;
  }

  if (def.category === 'trap') {
    return 'ورقة عقوبة! بدّلها لخصم بـ «تبديل مكاتب» أو احرقها كـ رسوم';
  }

  if (def.burnCost > 0 && (options?.handCount ?? 1) <= def.burnCost) {
    return `محتاج كارت زيادة في إيدك تحرقه كـ رسوم`;
  }

  return null;
}

export function calculatePlayerScore(
  playerId: string,
  slots: (Card | null)[],
  matchScore: number,
  closedByPlayerId: string | null,
  isStrictlyHighestBase: boolean,
): PlayerScoreBreakdown {
  const seenDocs = new Set<DocumentCardType>();
  let docsPoints = 0;
  let orderBonus = 0;
  let trapPenalty = 0;

  slots.forEach((card, slotIndex) => {
    if (!card) return;
    const def = CARD_DEFINITIONS[card.cardType];
    if (isDocumentCard(card.cardType)) {
      if (!seenDocs.has(card.cardType)) {
        seenDocs.add(card.cardType);
        docsPoints += def.filePoints;
        if (PREFERRED_DOC_SLOT[card.cardType] === slotIndex) {
          orderBonus += 2;
        }
      }
    } else {
      trapPenalty += def.filePoints;
    }
  });

  const hasAllDocs = CORE_DOCUMENTS.every(d => seenDocs.has(d));
  const completeFileBonus = hasAllDocs ? 25 : 0;
  const perfectOrder =
    hasAllDocs &&
    slots[0]?.cardType === 'id_copy' &&
    slots[1]?.cardType === 'stamp_duty' &&
    slots[2]?.cardType === 'manager_sign' &&
    slots[3]?.cardType === 'eagle_seal';

  const extraPerfectBonus = perfectOrder ? 10 : 0;

  let windowCloseDelta = 0;
  if (closedByPlayerId === playerId) {
    windowCloseDelta = isStrictlyHighestBase ? 10 : -15;
  }

  const totalScore =
    docsPoints +
    orderBonus +
    completeFileBonus +
    extraPerfectBonus +
    trapPenalty +
    matchScore +
    windowCloseDelta;

  return {
    playerId,
    uniqueDocsCount: seenDocs.size,
    docsPoints,
    orderBonus: orderBonus + extraPerfectBonus,
    completeFileBonus,
    trapPenalty,
    matchBonus: matchScore,
    windowCloseDelta,
    totalScore,
    hasPerfectFile: perfectOrder,
  };
}

export const CARD_PRIORITY: Record<CardType, number> = {
  eagle_seal: 100,
  manager_sign: 86,
  stamp_duty: 82,
  id_copy: 78,
  breakfast_break: 75,
  show_me_all: 72,
  desk_swap: 68,
  drawer_peek: 65,
  wasta: 62,
  file_lost: 58,
  dossier_sort: 54,
  come_tomorrow: 50,
  system_down: 46,
  missing_papers: 42,
  uncle_gamal: 40,
  recommendation: 36,
  window_4: 34,
  medhat_vacation: 28,
  fake_paper: 5,
  violation_ticket: 1, // Even worse penalty (-10), highest priority to dump/burn!
};

export const COUNTABLE_KEY_CARDS: CardType[] = [
  'eagle_seal',
  'manager_sign',
  'stamp_duty',
  'id_copy',
  'breakfast_break',
  'show_me_all',
  'desk_swap',
  'drawer_peek',
  'wasta',
  'file_lost',
  'violation_ticket',
  'fake_paper',
];
