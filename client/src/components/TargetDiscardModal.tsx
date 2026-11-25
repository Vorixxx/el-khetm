// ========================
// EL-KHETM — Target Discard Choice Modal (ورقك ناقص — اختار كارتين ترميهم)
// ========================

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileMinus } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { useSocket } from '../hooks/useSocket';
import { Card as CardComponent } from './Card';

export const TargetDiscardModal: React.FC = () => {
  const { socket } = useSocket();
  const { publicState, privateState, activeModal, closeModal, targetDiscard } = useGameStore();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [timeLeft, setTimeLeft] = useState(12);

  const isOpen = activeModal === 'target_discard';
  const pending = publicState?.pendingTargetDiscard ?? null;
  const hand = privateState?.hand ?? [];
  const needed = Math.min(pending?.count ?? 2, hand.length);

  useEffect(() => {
    if (isOpen) setSelectedIds(new Set());
  }, [isOpen, pending?.expiresAt]);

  useEffect(() => {
    if (!isOpen || !pending) return;
    const update = () => setTimeLeft(Math.max(0, (pending.expiresAt - Date.now()) / 1000));
    update();
    const id = setInterval(update, 250);
    return () => clearInterval(id);
  }, [isOpen, pending]);

  const toggle = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < needed) next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    if (selectedIds.size < needed) return;
    targetDiscard(socket, Array.from(selectedIds));
    closeModal();
  };

  return (
    <AnimatePresence>
      {isOpen && pending && needed > 0 && (
        <motion.div
          key="target-discard-modal"
          className="absolute inset-0 z-50 flex items-end justify-center bg-ink/60"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="w-full max-w-lg bg-manila rounded-t-2xl sm:rounded-2xl border-2 border-prank-red shadow-retro-lg p-4 pb-6 max-h-[82vh] flex flex-col"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            dir="rtl"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FileMinus size={20} className="text-prank-red" />
                <h3 className="font-cairo font-black text-base text-prank-red">
                  ورقك ناقص! — اختار {needed} كارت ترميهم
                </h3>
              </div>
              <span className="text-xs font-cairo font-black bg-white px-2.5 py-0.5 rounded-full border border-ink text-prank-red">
                {Math.ceil(timeLeft)} ث
              </span>
            </div>

            <p className="text-xs font-cairo font-bold text-ink/75 mb-3">
              {pending.attackerName} ضربك بمقلب «ورقك ناقص» — فكّر بذكاء واختار {needed} كروت تضحي بيهم في الأرشيف:
            </p>

            <div className="flex-1 overflow-y-auto grid grid-cols-3 sm:grid-cols-4 gap-2.5 pb-3 pt-1 justify-items-center">
              {hand.map(card => (
                <CardComponent
                  key={card.instanceId}
                  cardType={card.cardType}
                  isSelected={selectedIds.has(card.instanceId)}
                  size="sm"
                  onTap={() => toggle(card.instanceId)}
                />
              ))}
            </div>

            <button
              onClick={handleConfirm}
              disabled={selectedIds.size < needed}
              className="w-full mt-2 px-4 py-3 bg-prank-red text-white font-cairo font-bold rounded-xl border-2 border-ink shadow-retro active:shadow-none disabled:opacity-40 transition-all"
            >
              تسليم {selectedIds.size}/{needed} كارت للأرشيف
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
