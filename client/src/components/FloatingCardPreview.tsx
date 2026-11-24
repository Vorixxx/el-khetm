// ========================
// EL-KHETM — Floating Card Preview (Enlarged Inspector Inside Phone Frame)
// ========================

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CARD_DEFINITIONS } from '@el-khetm/shared';
import { useGameStore } from '../store/useGameStore';
import { Card as CardComponent } from './Card';

export const FloatingCardPreview: React.FC = () => {
  const { hoveredPreview, activeModal } = useGameStore();

  const isVisible = Boolean(hoveredPreview && !activeModal);
  const def = hoveredPreview ? CARD_DEFINITIONS[hoveredPreview.cardType] : null;

  return (
    <AnimatePresence>
      {isVisible && hoveredPreview && def && (
        <div className="absolute bottom-[285px] inset-x-0 z-40 px-3 flex justify-center pointer-events-none">
          <motion.div
            key={hoveredPreview.cardType}
            initial={{ opacity: 0, scale: 0.9, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 8 }}
            transition={{ duration: 0.14 }}
            className="flex items-center gap-3 bg-manila/95 backdrop-blur-md rounded-2xl border-2 border-ink shadow-retro-lg p-3 w-full max-w-[385px]"
            dir="rtl"
          >
            <CardComponent cardType={hoveredPreview.cardType} size="preview" />
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              {hoveredPreview.badgeText && (
                <span className="self-start text-[11px] font-cairo font-extrabold px-2 py-0.5 rounded-full bg-ink text-white">
                  {hoveredPreview.badgeText}
                </span>
              )}
              <p className="font-cairo font-black text-base text-ink">{def.nameAr}</p>
              <p className="font-cairo text-xs text-ink/85 leading-relaxed">{def.descriptionAr}</p>
              {hoveredPreview.statusText && (
                <div
                  className={`text-xs font-cairo font-bold px-2.5 py-1 rounded-lg border mt-1 ${
                    hoveredPreview.isError
                      ? 'bg-prank-red/10 text-prank-red border-prank-red/30'
                      : 'bg-doc-green/10 text-doc-green border-doc-green/30'
                  }`}
                >
                  {hoveredPreview.statusText}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
