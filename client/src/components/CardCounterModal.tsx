// ========================
// EL-KHETM — Card Counter Modal (عدّاد الأرشيف لتحليل الكروت المتبقية)
// ========================

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, X } from 'lucide-react';
import { CARD_DEFINITIONS, COUNTABLE_KEY_CARDS } from '@el-khetm/shared';
import { useGameStore } from '../store/useGameStore';
import { getCardImage } from '../config/assets';

export const CardCounterModal: React.FC = () => {
  const { publicState, activeModal, closeModal } = useGameStore();
  const isOpen = activeModal === 'card_counter';
  const counts = publicState?.archiveTypeCounts ?? {};

  return (
    <AnimatePresence>
      {isOpen && publicState && (
        <motion.div
          key="card-counter-modal"
          className="absolute inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeModal}
        >
          <motion.div
            className="w-full max-w-md bg-manila rounded-2xl border-2 border-ink shadow-retro-lg max-h-[82vh] flex flex-col overflow-hidden"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={e => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b-2 border-ink/15 bg-white/70">
              <div className="flex items-center gap-2">
                <BarChart3 size={18} className="text-defense-blue" />
                <h3 className="font-cairo font-black text-base text-ink">عدّاد الكروت (تحليل الأرشيف)</h3>
              </div>
              <button onClick={closeModal} className="p-1 rounded-lg hover:bg-ink/10">
                <X size={18} />
              </button>
            </div>

            <div className="px-4 py-2 bg-ink/5 text-[11px] font-cairo font-bold text-ink/75 border-b border-ink/10">
              شوف كام كارت اتحرق في الأرشيف عشان تحسب إيه اللي لسه مستخبي عند خصومك أو في الكومة!
            </div>

            <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-2">
              {COUNTABLE_KEY_CARDS.map(ct => {
                const def = CARD_DEFINITIONS[ct];
                const inArchive = counts[ct] ?? 0;
                const remainingOut = Math.max(0, def.quantity - inArchive);
                return (
                  <div
                    key={ct}
                    className="flex items-center gap-2 p-2 rounded-xl border-2 border-ink/20 bg-white shadow-sm"
                  >
                    <img
                      src={getCardImage(ct)}
                      alt={def.nameAr}
                      className="w-9 h-12 rounded border border-ink object-cover flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-cairo font-extrabold text-[11px] text-ink truncate">{def.nameAr}</p>
                      <div className="flex items-center gap-1.5 mt-1 text-[10px] font-cairo font-bold">
                        <span className="bg-ink/10 text-ink px-1.5 py-0.5 rounded">
                          أرشيف: {inArchive}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded ${
                            remainingOut === 0
                              ? 'bg-prank-red/15 text-prank-red'
                              : 'bg-doc-green/15 text-doc-green'
                          }`}
                        >
                          برا: {remainingOut}/{def.quantity}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
