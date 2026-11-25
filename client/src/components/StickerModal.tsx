// ========================
// EL-KHETM — Bottom-Sheet Sticker Picker Modal (Cleanly Anchored, Never Overflows Center)
// ========================

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { MEME_STICKERS } from '@el-khetm/shared';
import { useGameStore } from '../store/useGameStore';
import { useSocket } from '../hooks/useSocket';
import { getStickerImage } from '../config/assets';

export const StickerModal: React.FC = () => {
  const { socket } = useSocket();
  const { activeModal, closeModal, sendSticker } = useGameStore();
  const isOpen = activeModal === 'stickers';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="stickers-modal"
          className="absolute inset-0 z-50 flex items-end justify-center bg-ink/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeModal}
        >
          <motion.div
            className="w-full max-w-md bg-manila rounded-t-2xl sm:rounded-2xl border-2 border-ink shadow-retro-lg p-3.5 pb-5 sm:mb-2"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 340 }}
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center justify-between mb-2.5 px-1">
              <span className="text-sm font-cairo font-black text-ink">🎭 ابعت استيكر ميم</span>
              <button onClick={closeModal} className="p-1 rounded-full hover:bg-ink/10">
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {MEME_STICKERS.map(st => (
                <button
                  key={st.id}
                  onClick={() => {
                    sendSticker(socket, st.id);
                    closeModal();
                  }}
                  className="flex flex-col items-center gap-1 p-1.5 rounded-xl border-2 border-ink/20 bg-white hover:border-ink active:scale-95 transition-all"
                >
                  <img
                    src={getStickerImage(st.id)}
                    alt={st.labelAr}
                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg object-contain"
                  />
                  <span className="text-[10px] font-cairo font-bold text-ink truncate w-full text-center">
                    {st.labelAr}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
