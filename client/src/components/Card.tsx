// ========================
// EL-KHETM — Card & 3D FlipCard Component
// ========================

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import type { CardType } from '@el-khetm/shared';
import { CARD_DEFINITIONS } from '@el-khetm/shared';
import { getCardImage, getCardFallbackSvg, getCardBack, CARD_BACK_FALLBACK_CSS } from '../config/assets';

const CATEGORY_BORDER: Record<string, string> = {
  document: 'border-doc-green',
  trap: 'border-ink',
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
  size?: 'xs' | 'sm' | 'md' | 'slot' | 'opp' | 'preview' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<CardProps['size']>, string> = {
  xs: 'w-[clamp(34px,9.6vw,44px)]',
  opp: 'w-[clamp(36px,10.5vw,50px)]',
  sm: 'w-[clamp(52px,14.5vw,68px)]',
  md: 'w-[clamp(48px,14vw,66px)]',
  slot: 'w-[clamp(52px,15.5vw,74px)]',
  preview: 'w-[clamp(90px,24vw,112px)]',
  lg: 'w-[clamp(132px,38vw,176px)]',
};

export const Card = React.memo<CardProps>(({
  cardType,
  isBack = false,
  isSelected = false,
  isDimmed = false,
  dimmedReason,
  onTap,
  size = 'md',
  className = '',
}) => {
  const [imgError, setImgError] = useState(false);
  const def = CARD_DEFINITIONS[cardType];
  const borderColor = def ? CATEGORY_BORDER[def.category] : 'border-ink';

  if (isBack) {
    return (
      <motion.div
        className={`${SIZE_CLASSES[size]} aspect-[3/4] rounded-lg border-2 border-ink shadow-retro-sm overflow-hidden cursor-pointer bg-[#5C1221] relative z-10 ${className}`}
        whileTap={{ scale: 0.94 }}
        onClick={onTap}
      >
        <img
          src={getCardBack()}
          alt="ضهر الكارت"
          className="w-full h-full object-cover"
          decoding="async"
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
        ${isDimmed ? 'opacity-60 grayscale-[55%]' : ''}
        ${isSelected ? 'ring-[3px] ring-wasta-gold ring-offset-2 ring-offset-manila' : ''}
        relative z-10 cursor-pointer select-none ${className}
      `}
      animate={{
        y: isSelected ? -10 : 0,
        scale: isSelected ? 1.06 : 1,
      }}
      whileTap={{ scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      onClick={onTap}
    >
      <img
        src={imageSrc}
        alt={def.nameAr}
        className="w-full h-full object-cover"
        decoding="async"
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
});

// === 3D Flip Card (Face-Down / Face-Up Y-Axis Reveal) ===

interface FlipCardProps {
  cardType?: CardType | null;
  isRevealed: boolean;
  sizeClass?: string;
  horizontalSide?: boolean;
  isHighlighted?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
}

export const FlipCard: React.FC<FlipCardProps> = ({
  cardType,
  isRevealed,
  sizeClass = 'w-[4.1rem] sm:w-[4.65rem] aspect-[3/4]',
  horizontalSide = false,
  isHighlighted = false,
  onClick,
  children,
}) => {
  const [imgErr, setImgErr] = useState(false);
  const def = cardType ? CARD_DEFINITIONS[cardType] : null;
  const frontSrc = cardType && def
    ? (imgErr ? getCardFallbackSvg(cardType, def.nameAr, def.category) : getCardImage(cardType))
    : '';
  const frontBorder = cardType === 'wasta'
    ? 'border-wasta-gold'
    : def
    ? CATEGORY_BORDER[def.category] || 'border-ink'
    : 'border-ink';

  return (
    <motion.div
      onClick={onClick}
      whileTap={onClick ? { scale: 0.94 } : undefined}
      style={{ perspective: 900 }}
      className={`relative ${sizeClass} select-none ${onClick ? 'cursor-pointer' : ''}`}
    >
      <motion.div
        animate={{ rotateY: isRevealed && cardType ? 0 : 180 }}
        transition={{ type: 'spring', stiffness: 320, damping: 24 }}
        style={{ transformStyle: 'preserve-3d', willChange: 'transform' }}
        className={`relative w-full h-full rounded-lg ${
          isHighlighted ? 'ring-[3px] ring-wasta-gold shadow-[0_0_16px_rgba(245,158,11,0.65)]' : ''
        }`}
      >
        {/* Front Face (rotateY 0) */}
        <div
          style={{ backfaceVisibility: 'hidden' }}
          className={`absolute inset-0 rounded-lg border-2 ${frontBorder} bg-manila overflow-hidden shadow-retro-sm`}
        >
          {cardType && (
            <img
              src={frontSrc}
              alt={def?.nameAr || 'كارت'}
              className="w-full h-full object-cover"
              decoding="async"
              onError={() => setImgErr(true)}
              draggable={false}
            />
          )}
        </div>

        {/* Back Face (rotateY 180) */}
        <div
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          className="absolute inset-0 rounded-lg border-2 border-ink bg-[#5C1221] overflow-hidden shadow-retro-sm flex items-center justify-center"
        >
          <img
            src={getCardBack()}
            alt="ضهر الكارت"
            className={horizontalSide ? 'h-full w-full object-cover rotate-90 scale-125' : 'w-full h-full object-cover'}
            decoding="async"
            draggable={false}
          />
        </div>
      </motion.div>
      {children}
    </motion.div>
  );
};
