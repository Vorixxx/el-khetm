// ========================
// EL-KHETM (الختم) — Simplified 60-Card Deck (4-Document Secret File Race, Zero Points)
// ========================

import {
  Card,
  CardDefinition,
  CardType,
  DocumentCardType,
  PlayerFileSummary,
} from './types';

// === Card Definitions ===

export const CARD_DEFINITIONS: Record<CardType, CardDefinition> = {
  // Category A: The 4 Official Documents Needed to Win (22 cards)
  id_copy: {
    cardType: 'id_copy',
    category: 'document',
    nameAr: 'صورة البطاقة',
    shortEffectAr: 'مستند — نزّله في ملفك',
    descriptionAr: 'واحد من الـ 4 مستندات الرسمية. نزّله سراً في أي خانة من ملفك!',
    color: '#15803D',
    quantity: 6,
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
    shortEffectAr: 'مستند — نزّله في ملفك',
    descriptionAr: 'واحد من الـ 4 مستندات الرسمية. نزّله سراً في أي خانة من ملفك!',
    color: '#15803D',
    quantity: 6,
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
    shortEffectAr: 'مستند — نزّله في ملفك',
    descriptionAr: 'واحد من الـ 4 مستندات الرسمية. نزّله سراً في أي خانة من ملفك!',
    color: '#15803D',
    quantity: 6,
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
    shortEffectAr: 'مستند نادر — يكمل الختم!',
    descriptionAr: 'أهم مستند! جمّعه مع الـ 3 مستندات التانية في ملفك عشان تكسب الجيم فوراً!',
    color: '#15803D',
    quantity: 4,
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

  // Category B: Pranks (17 cards)
  system_down: {
    cardType: 'system_down',
    category: 'prank',
    nameAr: 'السيستم واقع',
    shortEffectAr: 'جمّد اللاعب اللي بعدك',
    descriptionAr: 'يجمّد اللاعب اللي بعدك مباشرة ويفوّت دوره الجاي!',
    color: '#B91C1C',
    quantity: 4,
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
    shortEffectAr: 'اللي بعدك يرمي كارتين',
    descriptionAr: 'يجبر اللاعب اللي بعدك يختار كارتين من إيده ويرميهم في الأرشيف!',
    color: '#B91C1C',
    quantity: 3,
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
    shortEffectAr: 'بدّل إيدك مع اللي قبلك',
    descriptionAr: 'يبدّل كل الكروت اللي في إيدك مع إيد اللاعب اللي قبلك!',
    color: '#B91C1C',
    quantity: 2,
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
    shortEffectAr: 'ارمي خانة من ملف خصم',
    descriptionAr: 'اختار خانة من ملف أي خصم (غير محصّن) وارمي ورقتها في الأرشيف!',
    color: '#B91C1C',
    quantity: 4,
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
    nameAr: 'مدحت في إجازة',
    shortEffectAr: 'منع إمضاء المدير لفة',
    descriptionAr: 'لفة كاملة محدش يقدر ينزّل «إمضاء المدير» في ملفه!',
    color: '#B91C1C',
    quantity: 2,
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
    shortEffectAr: 'رجّع ورق ملف خصم لإيده',
    descriptionAr: 'يرجّع كل الورق اللي في ملف خصم (غير محصّن) لإيده من تاني!',
    color: '#B91C1C',
    quantity: 2,
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

  // Category C: Defense, Peek, Swap & Helper Cards (21 cards)
  breakfast_break: {
    cardType: 'breakfast_break',
    category: 'utility',
    nameAr: 'بريك الفطار',
    shortEffectAr: 'صد أي مقلب أو سرقة',
    descriptionAr: 'صد وألغِ أي مقلب أو واسطة أو تبديل مكاتب يتلعب عليك!',
    color: '#1D4ED8',
    quantity: 5,
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
    shortEffectAr: 'اسرق خانة خصم لملفك',
    descriptionAr: 'اسرق أي خانة من ملف خصم (غير محصّن) وحطها في ملفك سراً!',
    color: '#B45309',
    quantity: 2,
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
    shortEffectAr: 'اكشف أي خانة سراً',
    descriptionAr: 'بص سراً على أي خانة مقلوبة في ملفك أو ملف أي خصم لمدة 6 ثواني!',
    color: '#1D4ED8',
    quantity: 4,
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
    nameAr: 'وريني اللي معاك',
    shortEffectAr: 'اكشف خانة من كل لاعب',
    descriptionAr: 'اختار خانة من كل لاعب على الترابيزة (وملفك كمان) وشوفهم سراً مع بعض!',
    color: '#1D4ED8',
    quantity: 2,
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
    shortEffectAr: 'بدّل خانة عندك مع خصم',
    descriptionAr: 'بدّل خانة مقلوبة من ملفك مع خانة مقلوبة عند خصم سراً!',
    color: '#1D4ED8',
    quantity: 4,
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
  recommendation: {
    cardType: 'recommendation',
    category: 'utility',
    nameAr: 'توصية من فوق',
    shortEffectAr: 'اسحب 3 كروت زيادة',
    descriptionAr: 'اسحب 3 كروت زيادة فوراً من الكومة لإيدك!',
    color: '#1D4ED8',
    quantity: 2,
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
    nameAr: 'عم جمال',
    shortEffectAr: 'خد أي كارت من الأرشيف',
    descriptionAr: 'افتح الأرشيف واختار منه أي كارت اترمى قبل كده وخده لإيدك!',
    color: '#1D4ED8',
    quantity: 2,
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

/** Generate the full balanced 60-card deck */
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

const UNKNOWN_CARD_DEF: CardDefinition = {
  cardType: 'recommendation',
  category: 'utility',
  nameAr: 'ورقة مصلحة',
  shortEffectAr: 'كارت غير متاح',
  descriptionAr: 'الكارت ده من نسخة قديمة أو قيد التحديث.',
  color: '#64748B',
  quantity: 0,
  positionalTarget: null,
  triggersReaction: false,
  targetsOpponent: false,
  targetsSlot: false,
  targetsOwnSlot: false,
  targetsAnySlot: false,
  isGlobal: false,
  isReactionOnly: false,
  isSelfTarget: false,
};

export function getSafeCardDef(cardType?: string | null): CardDefinition {
  if (!cardType) return UNKNOWN_CARD_DEF;
  return (CARD_DEFINITIONS as Record<string, CardDefinition>)[cardType] ?? UNKNOWN_CARD_DEF;
}

export function isDocumentCard(cardType: CardType): cardType is DocumentCardType {
  return CARD_DEFINITIONS[cardType].category === 'document';
}

export const EAGLE_SEAL_PREREQUISITES: DocumentCardType[] = ['id_copy', 'stamp_duty', 'manager_sign'];
export const CORE_DOCUMENTS: DocumentCardType[] = ['id_copy', 'stamp_duty', 'manager_sign', 'eagle_seal'];

export const SLOT_LABELS_AR = [
  'خانة ١',
  'خانة ٢',
  'خانة ٣',
  'خانة ٤',
] as const;

export function getUniqueDocsFromSlots(slots: (Card | null)[]): DocumentCardType[] {
  const seen = new Set<DocumentCardType>();
  for (const card of slots) {
    if (card && isDocumentCard(card.cardType)) {
      seen.add(card.cardType);
    }
  }
  return Array.from(seen);
}

export function hasCompletedAllDocs(slots: (Card | null)[]): boolean {
  const uniqueDocs = getUniqueDocsFromSlots(slots);
  return CORE_DOCUMENTS.every(doc => uniqueDocs.includes(doc));
}

export function buildPlayerFileSummary(playerId: string, slots: (Card | null)[]): PlayerFileSummary {
  const docsCollected = getUniqueDocsFromSlots(slots);
  const filledSlotsCount = slots.filter(Boolean).length;
  return {
    playerId,
    uniqueDocsCount: docsCollected.length,
    filledSlotsCount,
    docsCollected,
    hasCompleteFile: docsCollected.length === CORE_DOCUMENTS.length,
  };
}

export function getCardPlayError(
  cardType: CardType,
  _playerFile: DocumentCardType[],
  medhatVacationActive: boolean,
): string | null {
  const def = CARD_DEFINITIONS[cardType];

  if (def.isReactionOnly) {
    return 'الكارت ده بيتلعب تلقائياً لما حد يضربك بمقلب!';
  }

  if (isDocumentCard(cardType)) {
    if (cardType === 'manager_sign' && medhatVacationActive) {
      return 'الأستاذ مدحت في إجازة!';
    }
    return null;
  }

  return null;
}

export const CARD_PRIORITY: Record<CardType, number> = {
  eagle_seal: 100,
  manager_sign: 88,
  stamp_duty: 84,
  id_copy: 80,
  breakfast_break: 76,
  wasta: 74,
  show_me_all: 72,
  desk_swap: 68,
  drawer_peek: 65,
  file_lost: 60,
  come_tomorrow: 54,
  system_down: 50,
  missing_papers: 44,
  uncle_gamal: 42,
  recommendation: 38,
  window_4: 34,
  medhat_vacation: 28,
};
