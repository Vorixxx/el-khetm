// ========================
// EL-KHETM — Discard Modal (End of Turn Max 7 Hand Size)
// ========================

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { useSocket } from '../hooks/useSocket';
import { GAME_CONSTANTS } from '@el-khetm/shared';
import { Card as CardComponent } from './Card';

export const DiscardModal: React.FC = () => {
  const { socket } = useSocket();
  const { privateState, activeModal, closeModal, discardCards } = useGameStore();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [timeLeft, setTimeLeft] = useState(18);

  const isOpen = activeModal === 'discard';
  const hand = privateState?.hand ?? [];
  const excess = hand.length - GAME_CONSTANTS.MAX_HAND_SIZE;

  useEffect(() => {
    if (!isOpen) return;
    setSelectedIds(new Set());
    setTimeLeft(18);
    const start = Date.now();
    const interval = setInterval(() => {
      const remaining = Math.max(0, 18 - (Date.now() - start) / 1000);
      setTimeLeft(remaining);
    }, 250);
    return () => clearInterval(interval);
  }, [isOpen]);

  const toggleCard = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < excess) {
        next.add(id);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    if (selectedIds.size < excess) return;
    discardCards(socket, Array.from(selectedIds));
    closeModal();
  };

  return (
    <AnimatePresence>
      {isOpen && excess > 0 && (
        <motion.div
          key="discard-modal"
          className="absolute inset-0 z-50 flex items-end justify-center bg-ink/55"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="w-full max-w-lg bg-manila rounded-t-2xl sm:rounded-2xl border-2 border-ink shadow-retro-lg p-4 pb-6 sm:pb-5 max-h-[82vh] flex flex-col"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            onClick={e => e.stopPropagation()}
            dir="rtl"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Trash2 size={20} className="text-prank-red" />
                <h3 className="font-cairo font-black text-lg text-ink">ارمي {excess} كارت زيادة</h3>
              </div>
              <span className="text-sm font-cairo font-extrabold bg-white px-2.5 py-0.5 rounded-full border border-ink text-prank-red">
                {Math.ceil(timeLeft)} ث
              </span>
            </div>

            <p className="text-xs font-cairo font-bold text-ink/70 mb-3">
              إيدك فيها {hand.length} كارت — الحد الأقصى {GAME_CONSTANTS.MAX_HAND_SIZE}. اختار {excess - selectedIds.size} كمان للرمي في الأرشيف.
            </p>

            {/* Cards */}
            <div className="flex-1 overflow-y-auto grid grid-cols-3 sm:grid-cols-4 gap-2.5 pb-3 pt-2 justify-items-center">
              {hand.map(card => (
                <CardComponent
                  key={card.instanceId}
                  cardType={card.cardType}
                  isSelected={selectedIds.has(card.instanceId)}
                  size="sm"
                  onTap={() => toggleCard(card.instanceId)}
                />
              ))}
            </div>

            {/* Confirm */}
            <button
              onClick={handleConfirm}
              disabled={selectedIds.size < excess}
              className="w-full mt-2 px-4 py-3 bg-prank-red text-white font-cairo font-bold rounded-xl border-2 border-ink shadow-retro active:shadow-none disabled:opacity-40 transition-all"
            >
              ارمي {selectedIds.size}/{excess} كارت
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
