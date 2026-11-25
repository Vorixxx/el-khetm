// ========================
// EL-KHETM — Centralized Asset Manifest
// ========================

import type { CardType, AvatarId } from '@el-khetm/shared';

const CARDS_PATH = '/assets/cards';
const AVATARS_PATH = '/assets/avatars';
const BACKGROUNDS_PATH = '/assets/backgrounds';
const BRANDING_PATH = '/assets/branding';

// === Card Images ===
export const CARD_IMAGES: Record<CardType, string> = {
  id_copy: `${CARDS_PATH}/id_copy.webp`,
  stamp_duty: `${CARDS_PATH}/stamp_duty.webp`,
  manager_sign: `${CARDS_PATH}/manager_sign.webp`,
  eagle_seal: `${CARDS_PATH}/eagle_seal.webp`,
  system_down: `${CARDS_PATH}/system_down.webp`,
  come_tomorrow: `${CARDS_PATH}/come_tomorrow.webp`,
  missing_papers: `${CARDS_PATH}/missing_papers.webp`,
  window_4: `${CARDS_PATH}/window_4.webp`,
  medhat_vacation: `${CARDS_PATH}/medhat_vacation.webp`,
  file_lost: `${CARDS_PATH}/file_lost.webp`,
  breakfast_break: `${CARDS_PATH}/breakfast_break.webp`,
  wasta: `${CARDS_PATH}/wasta.webp`,
  drawer_peek: `${CARDS_PATH}/drawer_peek.webp`,
  show_me_all: `${CARDS_PATH}/show_me_all.svg`,
  desk_swap: `${CARDS_PATH}/desk_swap.svg`,
  recommendation: `${CARDS_PATH}/recommendation.webp`,
  uncle_gamal: `${CARDS_PATH}/uncle_gamal.webp`,
};

export const CARD_BACK = `${CARDS_PATH}/card_back.webp`;

// === Avatar Images ===
export const AVATAR_IMAGES: Record<AvatarId, string> = {
  student: `${AVATARS_PATH}/avatar_student.webp`,
  employee: `${AVATARS_PATH}/avatar_employee.webp`,
  manager: `${AVATARS_PATH}/avatar_manager.webp`,
  bot: `${AVATARS_PATH}/avatar_bot.webp`,
};

// === Backgrounds ===
export const BACKGROUNDS = {
  lobby_mobile: `${BACKGROUNDS_PATH}/lobby_bg_mobile.webp`,
  table_mobile: `${BACKGROUNDS_PATH}/table_bg_mobile.webp`,
};

// === Branding ===
export const BRANDING = {
  logo: `${BRANDING_PATH}/logo.webp`,
  appIcon: `${BRANDING_PATH}/app_icon.png`,
};

// === Global Meme Stickers ===
const STICKERS_PATH = '/assets/stickers';

export const STICKER_IMAGES: Record<string, string> = {
  this_is_fine: `${STICKERS_PATH}/this_is_fine.webp`,
  stonks: `${STICKERS_PATH}/stonks.webp`,
  surprised_shock: `${STICKERS_PATH}/surprised_shock.webp`,
  table_cat: `${STICKERS_PATH}/table_cat.svg`,
  crying_laugh: `${STICKERS_PATH}/crying_laugh.svg`,
  big_brain: `${STICKERS_PATH}/big_brain.svg`,
  pain_coffee: `${STICKERS_PATH}/pain_coffee.svg`,
  cool_shades: `${STICKERS_PATH}/cool_shades.svg`,
};

export function getStickerImage(stickerId: string): string {
  return STICKER_IMAGES[stickerId] || `${STICKERS_PATH}/this_is_fine.webp`;
}

// === Category Colors ===
const CATEGORY_COLORS: Record<string, string> = {
  document: '#15803D',
  prank: '#B91C1C',
  utility: '#1D4ED8',
};

export function getCardImage(cardType: CardType): string {
  return CARD_IMAGES[cardType] || getCardFallbackSvg(cardType, String(cardType), 'utility');
}

export function getCardFallbackSvg(_cardType: CardType, nameAr: string, category: string): string {
  const color = CATEGORY_COLORS[category] || '#1E293B';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
    <rect width="200" height="200" rx="12" fill="${color}" opacity="0.15"/>
    <rect x="4" y="4" width="192" height="192" rx="10" fill="none" stroke="${color}" stroke-width="3"/>
    <text x="100" y="110" text-anchor="middle" font-family="Cairo,sans-serif" font-size="18" font-weight="700" fill="${color}" direction="rtl">${nameAr}</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function getAvatarImage(avatarId: AvatarId): string {
  return AVATAR_IMAGES[avatarId];
}

export function getAvatarFallback(name: string): string {
  const initial = name.charAt(0) || '?';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
    <circle cx="32" cy="32" r="30" fill="#1E293B" opacity="0.15"/>
    <circle cx="32" cy="32" r="30" fill="none" stroke="#1E293B" stroke-width="2"/>
    <text x="32" y="40" text-anchor="middle" font-family="Cairo,sans-serif" font-size="24" font-weight="700" fill="#1E293B">${initial}</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function getBackground(name: keyof typeof BACKGROUNDS): string {
  return BACKGROUNDS[name];
}

export function getCardBack(): string {
  return CARD_BACK;
}

let preloaded = false;
export function preloadGameAssets(): void {
  if (preloaded || typeof window === 'undefined') return;
  preloaded = true;
  const urls = [
    CARD_BACK,
    BACKGROUNDS.table_mobile,
    ...Object.values(AVATAR_IMAGES),
    ...Object.values(CARD_IMAGES),
    ...Object.values(STICKER_IMAGES),
  ];
  // Stagger preloading slightly across frames so initial paint stays instant
  let idx = 0;
  const batch = () => {
    const end = Math.min(idx + 5, urls.length);
    for (; idx < end; idx++) {
      const img = new Image();
      img.decoding = 'async';
      img.src = urls[idx];
    }
    if (idx < urls.length) {
      setTimeout(batch, 120);
    }
  };
  setTimeout(batch, 350);
}

export const CARD_BACK_FALLBACK_CSS = `
  background: repeating-conic-gradient(#1E293B 0% 25%, #F4EFE6 0% 50%) 50% / 16px 16px;
  border: 2px solid #1E293B;
  border-radius: 8px;
`;
