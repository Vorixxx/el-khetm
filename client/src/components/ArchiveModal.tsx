// ========================
// EL-KHETM — Archive Modal (Uncle Gamal)
// ========================

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Archive } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { useSocket } from '../hooks/useSocket';
import { getSafeCardDef } from '@el-khetm/shared';
import { Card as CardComponent } from './Card';

export const ArchiveModal: React.FC = () => {
  const { socket } = useSocket();
  const { publicState, privateState, activeModal, closeModal, pickArchive } = useGameStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(15);

  const isOpen = activeModal === 'archive';
  const archiveCards = privateState?.archiveCards ?? null;
  const pending = publicState?.pendingArchive ?? null;

  useEffect(() => {
    setSelectedId(null);
  }, [isOpen, pending?.expiresAt]);

  useEffect(() => {
    if (!isOpen || !pending) return;
    const update = () => {
      const remaining = Math.max(0, (pending.expiresAt - Date.now()) / 1000);
      setTimeLeft(remaining);
    };
    update();
    const interval = setInterval(update, 250);
    return () => clearInterval(interval);
  }, [isOpen, pending]);

  const canRender = Boolean(isOpen && archiveCards && archiveCards.length > 0);
  const selectedCard = archiveCards?.find(c => c.instanceId === selectedId) ?? null;

  const handleConfirm = () => {
    if (!selectedId) return;
    pickArchive(socket, selectedId);
    closeModal();
  };

  return (
    <AnimatePresence>
      {canRender && archiveCards && (
        <motion.div
          key="archive-modal"
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
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Archive size={20} className="text-defense-blue" />
                <h3 className="font-cairo font-black text-lg text-ink">الأرشيف — اختار كارت</h3>
              </div>
              <span className="text-sm font-cairo font-extrabold bg-white px-2.5 py-0.5 rounded-full border border-ink text-prank-red">
                {Math.ceil(timeLeft)} ث
              </span>
            </div>

            {/* Selected Card Description Preview */}
            {selectedCard && (
              <div className="bg-white rounded-lg border border-ink/25 px-3 py-1.5 mb-2.5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-cairo font-extrabold text-ink">
                    {getSafeCardDef(selectedCard.cardType).nameAr}
                  </p>
                  <p className="text-[11px] font-cairo text-ink/70">
                    {getSafeCardDef(selectedCard.cardType).descriptionAr}
                  </p>
                </div>
              </div>
            )}

            {/* Card Grid */}
            <div className="flex-1 overflow-y-auto grid grid-cols-3 sm:grid-cols-4 gap-2.5 pb-3 pt-2 justify-items-center">
              {archiveCards.map(card => (
                <CardComponent
                  key={card.instanceId}
                  cardType={card.cardType}
                  isSelected={selectedId === card.instanceId}
                  size="sm"
                  onTap={() => setSelectedId(card.instanceId)}
                />
              ))}
            </div>

            {/* Confirm */}
            <button
              onClick={handleConfirm}
              disabled={!selectedCard}
              className="w-full mt-2 px-4 py-3 bg-defense-blue text-white font-cairo font-bold rounded-xl border-2 border-ink shadow-retro active:shadow-none disabled:opacity-40 transition-all"
            >
              {selectedCard
                ? `اختار: ${getSafeCardDef(selectedCard.cardType).nameAr}`
                : 'اختار كارت من الأرشيف'}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
