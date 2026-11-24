// ========================
// EL-KHETM (الختم) — 64-Card Deck Generator
// ========================

import { Card, CardDefinition, CardType, DocumentCardType } from './types';

// === Card Definitions ===

export const CARD_DEFINITIONS: Record<CardType, CardDefinition> = {
  // Category A: Core Documents (26 cards)
  id_copy: {
    cardType: 'id_copy',
    category: 'document',
    nameAr: 'صورة البطاقة',
    descriptionAr: 'ورقة أساسية (1 من 4) تنزل في ملفك',
    color: '#15803D',
    quantity: 8,
    triggersReaction: false,
    targetsOpponent: false,
    targetsDocument: false,
    isGlobal: false,
    isReactionOnly: false,
    isSelfTarget: true,
  },
  stamp_duty: {
    cardType: 'stamp_duty',
    category: 'document',
    nameAr: 'الدمغة',
    descriptionAr: 'ورقة أساسية (2 من 4) تنزل في ملفك',
    color: '#15803D',
    quantity: 8,
    triggersReaction: false,
    targetsOpponent: false,
    targetsDocument: false,
    isGlobal: false,
    isReactionOnly: false,
    isSelfTarget: true,
  },
  manager_sign: {
    cardType: 'manager_sign',
    category: 'document',
    nameAr: 'إمضاء المدير',
    descriptionAr: 'ورقة أساسية (3 من 4) تنزل في ملفك',
    color: '#15803D',
    quantity: 6,
    triggersReaction: false,
    targetsOpponent: false,
    targetsDocument: false,
    isGlobal: false,
    isReactionOnly: false,
    isSelfTarget: true,
  },
  eagle_seal: {
    cardType: 'eagle_seal',
    category: 'document',
    nameAr: 'ختم النسر',
    descriptionAr: 'ورقة الفوز! تنزل فقط بعد اكتمال الـ 3 ورقات',
    color: '#15803D',
    quantity: 4,
    triggersReaction: false,
    targetsOpponent: false,
    targetsDocument: false,
    isGlobal: false,
    isReactionOnly: false,
    isSelfTarget: true,
  },

  // Category B: Pranks & Disruption (22 cards)
  system_down: {
    cardType: 'system_down',
    category: 'prank',
    nameAr: 'السيستم واقع',
    descriptionAr: 'جمّد خصم وخلّيه يفوّت دوره الجاي',
    color: '#B91C1C',
    quantity: 5,
    triggersReaction: true,
    targetsOpponent: true,
    targetsDocument: false,
    isGlobal: false,
    isReactionOnly: false,
    isSelfTarget: false,
  },
  come_tomorrow: {
    cardType: 'come_tomorrow',
    category: 'prank',
    nameAr: 'فوت علينا بكرة',
    descriptionAr: 'ارمي ورقة واحدة من ملف أي خصم للأرشيف',
    color: '#B91C1C',
    quantity: 5,
    triggersReaction: true,
    targetsOpponent: true,
    targetsDocument: true,
    isGlobal: false,
    isReactionOnly: false,
    isSelfTarget: false,
  },
  missing_papers: {
    cardType: 'missing_papers',
    category: 'prank',
    nameAr: 'ورقك ناقص',
    descriptionAr: 'خلّي خصم يرمي كارتين عشوائي من إيده',
    color: '#B91C1C',
    quantity: 4,
    triggersReaction: true,
    targetsOpponent: true,
    targetsDocument: false,
    isGlobal: false,
    isReactionOnly: false,
    isSelfTarget: false,
  },
  window_4: {
    cardType: 'window_4',
    category: 'prank',
    nameAr: 'شباك 4',
    descriptionAr: 'بدّل كل الكروت اللي في إيدك مع إيد خصم',
    color: '#B91C1C',
    quantity: 3,
    triggersReaction: true,
    targetsOpponent: true,
    targetsDocument: false,
    isGlobal: false,
    isReactionOnly: false,
    isSelfTarget: false,
  },
  medhat_vacation: {
    cardType: 'medhat_vacation',
    category: 'prank',
    nameAr: 'الأستاذ مدحت في إجازة',
    descriptionAr: 'لمدة لفة كاملة، محدش يقدر ينزل «إمضاء المدير»',
    color: '#B91C1C',
    quantity: 3,
    triggersReaction: false,
    targetsOpponent: false,
    targetsDocument: false,
    isGlobal: true,
    isReactionOnly: false,
    isSelfTarget: false,
  },
  file_lost: {
    cardType: 'file_lost',
    category: 'prank',
    nameAr: 'الملف ضاع',
    descriptionAr: 'رجّع كل الورق اللي في ملف خصم لإيده تاني!',
    color: '#B91C1C',
    quantity: 2,
    triggersReaction: true,
    targetsOpponent: true,
    targetsDocument: false,
    isGlobal: false,
    isReactionOnly: false,
    isSelfTarget: false,
  },

  // Category C: Defense & Wasta (16 cards)
  breakfast_break: {
    cardType: 'breakfast_break',
    category: 'utility',
    nameAr: 'بريك الفطار',
    descriptionAr: 'صد وألغِ أي مقلب أحمر أو «واسطة» عليك',
    color: '#1D4ED8',
    quantity: 6,
    triggersReaction: false,
    targetsOpponent: false,
    targetsDocument: false,
    isGlobal: false,
    isReactionOnly: true,
    isSelfTarget: false,
  },
  wasta: {
    cardType: 'wasta',
    category: 'utility',
    nameAr: 'الواسطة',
    descriptionAr: 'اسرق ورقة جاهزة من ملف خصم وحطها في ملفك',
    color: '#B45309',
    quantity: 3,
    triggersReaction: true,
    targetsOpponent: true,
    targetsDocument: true,
    isGlobal: false,
    isReactionOnly: false,
    isSelfTarget: false,
  },
  recommendation: {
    cardType: 'recommendation',
    category: 'utility',
    nameAr: 'توصية من فوق',
    descriptionAr: 'اسحب 3 كروت زيادة فوراً من كومة السحب',
    color: '#1D4ED8',
    quantity: 4,
    triggersReaction: false,
    targetsOpponent: false,
    targetsDocument: false,
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
    quantity: 3,
    triggersReaction: false,
    targetsOpponent: false,
    targetsDocument: false,
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

/** Generate the full 64-card deck */
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

/** Fisher-Yates shuffle (in place) */
export function shuffleDeck<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Get the definition for a card type */
export function getCardDef(cardType: CardType): CardDefinition {
  return CARD_DEFINITIONS[cardType];
}

/** Check if a card type is a core document */
export function isDocumentCard(cardType: CardType): cardType is DocumentCardType {
  return CARD_DEFINITIONS[cardType].category === 'document';
}

/** Required documents for eagle_seal */
export const EAGLE_SEAL_PREREQUISITES: DocumentCardType[] = ['id_copy', 'stamp_duty', 'manager_sign'];

/** All 4 core documents in order */
export const CORE_DOCUMENTS: DocumentCardType[] = ['id_copy', 'stamp_duty', 'manager_sign', 'eagle_seal'];

/** Check if player can play eagle_seal (has all 3 prerequisites in file) */
export function canPlayEagleSeal(file: DocumentCardType[]): boolean {
  return EAGLE_SEAL_PREREQUISITES.every(doc => file.includes(doc));
}

/** Check if a document is already in a player's file */
export function hasDocumentInFile(file: DocumentCardType[], doc: DocumentCardType): boolean {
  return file.includes(doc);
}

/** Check if a card can be played given the current game state constraints */
export function getCardPlayError(
  cardType: CardType,
  playerFile: DocumentCardType[],
  medhatVacationActive: boolean,
): string | null {
  const def = CARD_DEFINITIONS[cardType];

  if (def.isReactionOnly) {
    return 'الكارت ده بيتلعب كرد فعل بس';
  }

  if (cardType === 'eagle_seal') {
    if (!canPlayEagleSeal(playerFile)) {
      return 'محتاج الـ 3 ورقات الأول';
    }
  }

  if (cardType === 'manager_sign') {
    if (medhatVacationActive) {
      return 'الأستاذ مدحت في إجازة!';
    }
    if (hasDocumentInFile(playerFile, 'manager_sign')) {
      return 'عندك في الملف';
    }
  }

  if (isDocumentCard(cardType) && cardType !== 'eagle_seal' && cardType !== 'manager_sign') {
    if (hasDocumentInFile(playerFile, cardType)) {
      return 'عندك في الملف';
    }
  }

  return null;
}

// === Priority for Bot AI & auto-discard ===

export const CARD_PRIORITY: Record<CardType, number> = {
  eagle_seal: 100,
  id_copy: 80,
  stamp_duty: 80,
  manager_sign: 80,
  file_lost: 60,
  wasta: 55,
  come_tomorrow: 50,
  system_down: 45,
  missing_papers: 40,
  window_4: 35,
  recommendation: 30,
  uncle_gamal: 25,
  medhat_vacation: 20,
  breakfast_break: 70, // High priority to keep for defense
};
