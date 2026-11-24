// ========================
// EL-KHETM — Card Component (Full 3:4 Illustrated Neo-Retro Card)
// ========================

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import type { CardType } from '@el-khetm/shared';
import { CARD_DEFINITIONS } from '@el-khetm/shared';
import { getCardImage, getCardFallbackSvg, getCardBack, CARD_BACK_FALLBACK_CSS } from '../config/assets';

const CATEGORY_BORDER: Record<string, string> = {
  document: 'border-doc-green',
  prank: 'border-prank-red',
  utility: 'border-defense-blue',
};

interface CardProps {
  cardType: CardType;
  isBack?: boolean;
  isSelected?: boolean;
  isDimmed?: boolean;
  dimmedReason?: string;
  onTap?: () => void;
  size?: 'xs' | 'sm' | 'md' | 'preview' | 'lg';
}

// Calibrated for 420-520px portrait phone layout (fits cleanly beside side seats without overlap)
const SIZE_CLASSES = {
  xs: 'w-11',
  sm: 'w-20',
  md: 'w-[4.75rem]',
  preview: 'w-28',
  lg: 'w-44',
};

export const Card: React.FC<CardProps> = ({
  cardType,
  isBack = false,
  isSelected = false,
  isDimmed = false,
  dimmedReason,
  onTap,
  size = 'md',
}) => {
  const [imgError, setImgError] = useState(false);
  const def = CARD_DEFINITIONS[cardType];
  const borderColor = def ? CATEGORY_BORDER[def.category] : 'border-ink';

  if (isBack) {
    return (
      <motion.div
        className={`${SIZE_CLASSES[size]} aspect-[3/4] rounded-lg border-2 border-ink shadow-retro-sm overflow-hidden cursor-pointer bg-[#5C1221] relative z-10`}
        whileTap={{ scale: 0.95 }}
        onClick={onTap}
      >
        <img
          src={getCardBack()}
          alt="ضهر الكارت"
          className="w-full h-full object-cover"
          draggable={false}
          onError={(e) => {
            const el = e.currentTarget.parentElement;
            if (el) el.setAttribute('style', CARD_BACK_FALLBACK_CSS);
            e.currentTarget.style.display = 'none';
          }}
        />
      </motion.div>
    );
  }

  if (!def) return null;

  const imageSrc = imgError
    ? getCardFallbackSvg(cardType, def.nameAr, def.category)
    : getCardImage(cardType);

  const isGold = cardType === 'wasta';
  const finalBorder = isGold ? 'border-wasta-gold' : borderColor;

  return (
    <motion.div
      className={`
        ${SIZE_CLASSES[size]} aspect-[3/4] rounded-lg border-2 ${finalBorder}
        shadow-retro-sm overflow-hidden bg-manila
        ${isDimmed ? 'opacity-55 grayscale-[65%]' : ''}
        ${isSelected ? 'ring-[3px] ring-ink ring-offset-2 ring-offset-manila' : ''}
        relative z-10 cursor-pointer select-none
      `}
      animate={{
        y: isSelected ? -10 : 0,
        scale: isSelected ? 1.06 : 1,
      }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      onClick={onTap}
      layout
    >
      <img
        src={imageSrc}
        alt={def.nameAr}
        className="w-full h-full object-cover"
        onError={() => setImgError(true)}
        draggable={false}
      />

      {isDimmed && dimmedReason && (
        <div className="absolute inset-0 flex items-center justify-center bg-ink/40 p-1">
          <span className="bg-manila/95 text-ink text-[8px] font-cairo font-extrabold px-1.5 py-0.5 rounded border border-ink shadow-retro-sm text-center leading-tight">
            {dimmedReason}
          </span>
        </div>
      )}
    </motion.div>
  );
};
