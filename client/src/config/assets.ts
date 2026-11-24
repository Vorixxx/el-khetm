// ========================
// EL-KHETM — Centralized Asset Manifest
// ========================

import type { CardType, AvatarId } from '@el-khetm/shared';

// === Base Paths ===
const CARDS_PATH = '/assets/cards';
const AVATARS_PATH = '/assets/avatars';
const BACKGROUNDS_PATH = '/assets/backgrounds';
const BRANDING_PATH = '/assets/branding';
const SOUNDS_PATH = '/assets/sounds';

// === Card Images ===
export const CARD_IMAGES: Record<CardType, string> = {
  id_copy: `${CARDS_PATH}/id_copy.jpg`,
  stamp_duty: `${CARDS_PATH}/stamp_duty.jpg`,
  manager_sign: `${CARDS_PATH}/manager_sign.jpg`,
  eagle_seal: `${CARDS_PATH}/eagle_seal.jpg`,
  system_down: `${CARDS_PATH}/system_down.jpg`,
  come_tomorrow: `${CARDS_PATH}/come_tomorrow.jpg`,
  missing_papers: `${CARDS_PATH}/missing_papers.jpg`,
  window_4: `${CARDS_PATH}/window_4.jpg`,
  medhat_vacation: `${CARDS_PATH}/medhat_vacation.jpg`,
  file_lost: `${CARDS_PATH}/file_lost.jpg`,
  breakfast_break: `${CARDS_PATH}/breakfast_break.jpg`,
  wasta: `${CARDS_PATH}/wasta.jpg`,
  recommendation: `${CARDS_PATH}/recommendation.jpg`,
  uncle_gamal: `${CARDS_PATH}/uncle_gamal.jpg`,
};

export const CARD_BACK = `${CARDS_PATH}/card_back.jpg`;

// === Avatar Images ===
export const AVATAR_IMAGES: Record<AvatarId, string> = {
  student: `${AVATARS_PATH}/avatar_student.png`,
  employee: `${AVATARS_PATH}/avatar_employee.png`,
  manager: `${AVATARS_PATH}/avatar_manager.png`,
  bot: `${AVATARS_PATH}/avatar_bot.png`,
};

// === Backgrounds ===
export const BACKGROUNDS = {
  lobby_mobile: `${BACKGROUNDS_PATH}/lobby_bg_mobile.jpg`,
  lobby_desktop: `${BACKGROUNDS_PATH}/lobby_bg_desktop.jpg`,
  table_mobile: `${BACKGROUNDS_PATH}/table_bg_mobile.jpg`,
  table_desktop: `${BACKGROUNDS_PATH}/table_bg_desktop.jpg`,
};

// === Branding ===
export const BRANDING = {
  logo: `${BRANDING_PATH}/logo.png`,
  appIcon: `${BRANDING_PATH}/app_icon.png`,
};

// === Sounds ===
export const SOUND_FILES = {
  stamp: `${SOUNDS_PATH}/stamp.mp3`,
  card_flip: `${SOUNDS_PATH}/card_flip.mp3`,
  card_draw: `${SOUNDS_PATH}/card_draw.mp3`,
  prank_alarm: `${SOUNDS_PATH}/prank_alarm.mp3`,
  shield_block: `${SOUNDS_PATH}/shield_block.mp3`,
  tick_tock: `${SOUNDS_PATH}/tick_tock.mp3`,
  win_fanfare: `${SOUNDS_PATH}/win_fanfare.mp3`,
  shutter_close: `${SOUNDS_PATH}/shutter_close.mp3`,
  swoosh: `${SOUNDS_PATH}/swoosh.mp3`,
  buzz: `${SOUNDS_PATH}/buzz.mp3`,
};

// === Global Meme Stickers ===
const STICKERS_PATH = '/assets/stickers';

export const STICKER_IMAGES: Record<string, string> = {
  this_is_fine: `${STICKERS_PATH}/this_is_fine.jpg`,
  stonks: `${STICKERS_PATH}/stonks.jpg`,
  surprised_shock: `${STICKERS_PATH}/surprised_shock.jpg`,
  table_cat: `${STICKERS_PATH}/table_cat.svg`,
  crying_laugh: `${STICKERS_PATH}/crying_laugh.svg`,
  big_brain: `${STICKERS_PATH}/big_brain.svg`,
  pain_coffee: `${STICKERS_PATH}/pain_coffee.svg`,
  cool_shades: `${STICKERS_PATH}/cool_shades.svg`,
};

export function getStickerImage(stickerId: string): string {
  return STICKER_IMAGES[stickerId] || `${STICKERS_PATH}/this_is_fine.jpg`;
}

// === Category Colors (for fallback SVGs) ===
const CATEGORY_COLORS: Record<string, string> = {
  document: '#15803D',
  prank: '#B91C1C',
  utility: '#1D4ED8',
};

// === Fallback Helpers ===

/** Get card image with colored SVG fallback */
export function getCardImage(cardType: CardType): string {
  return CARD_IMAGES[cardType];
}

/** Create a fallback SVG data URL for a card */
export function getCardFallbackSvg(cardType: CardType, nameAr: string, category: string): string {
  const color = CATEGORY_COLORS[category] || '#1E293B';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
    <rect width="200" height="200" rx="12" fill="${color}" opacity="0.15"/>
    <rect x="4" y="4" width="192" height="192" rx="10" fill="none" stroke="${color}" stroke-width="3"/>
    <text x="100" y="110" text-anchor="middle" font-family="Cairo,sans-serif" font-size="18" font-weight="700" fill="${color}" direction="rtl">${nameAr}</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Get avatar image with initials-circle fallback */
export function getAvatarImage(avatarId: AvatarId): string {
  return AVATAR_IMAGES[avatarId];
}

/** Create a fallback initials circle SVG */
export function getAvatarFallback(name: string): string {
  const initial = name.charAt(0) || '?';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
    <circle cx="32" cy="32" r="30" fill="#1E293B" opacity="0.15"/>
    <circle cx="32" cy="32" r="30" fill="none" stroke="#1E293B" stroke-width="2"/>
    <text x="32" y="40" text-anchor="middle" font-family="Cairo,sans-serif" font-size="24" font-weight="700" fill="#1E293B">${initial}</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Get background image with manila CSS fallback */
export function getBackground(name: keyof typeof BACKGROUNDS): string {
  return BACKGROUNDS[name];
}

/** Manila background CSS fallback style */
export const MANILA_FALLBACK_BG = 'linear-gradient(135deg, #F4EFE6 0%, #EDE5D8 50%, #F4EFE6 100%)';

/** Get card back image with CSS geometric pattern fallback */
export function getCardBack(): string {
  return CARD_BACK;
}

/** CSS fallback for card back (geometric pattern) */
export const CARD_BACK_FALLBACK_CSS = `
  background: repeating-conic-gradient(#1E293B 0% 25%, #F4EFE6 0% 50%) 50% / 16px 16px;
  border: 2px solid #1E293B;
  border-radius: 8px;
`;
