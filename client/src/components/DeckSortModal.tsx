// ========================
// EL-KHETM — Deck Sort Modal (ترتيب الدوسيه - ترتيب أول 3 كروت)
// ========================

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp, ArrowDown, Layers } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { useSocket } from '../hooks/useSocket';
import { CARD_DEFINITIONS } from '@el-khetm/shared';
import type { Card } from '@el-khetm/shared';
import { Card as CardComponent } from './Card';

export const DeckSortModal: React.FC = () => {
  const { socket } = useSocket();
  const { publicState, privateState, activeModal, closeModal, sortDeck } = useGameStore();
  const [ordered, setOrdered] = useState<Card[]>([]);
  const [timeLeft, setTimeLeft] = useState(12);

  const isOpen = activeModal === 'sort';
  const topCards = privateState?.topDeckCards ?? null;
  const pending = publicState?.pendingSort ?? null;

  useEffect(() => {
    if (isOpen && topCards) {
      setOrdered(topCards);
    }
  }, [isOpen, topCards]);

  useEffect(() => {
    if (!isOpen || !pending) return;
    const update = () => setTimeLeft(Math.max(0, (pending.expiresAt - Date.now()) / 1000));
    update();
    const id = setInterval(update, 250);
    return () => clearInterval(id);
  }, [isOpen, pending]);

  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= ordered.length) return;
    const copy = [...ordered];
    [copy[idx], copy[target]] = [copy[target], copy[idx]];
    setOrdered(copy);
  };

  const handleConfirm = () => {
    sortDeck(socket, ordered.map(c => c.instanceId));
    closeModal();
  };

  return (
    <AnimatePresence>
      {isOpen && ordered.length > 0 && (
        <motion.div
          key="sort-modal"
          className="absolute inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="w-full max-w-sm bg-manila rounded-2xl border-2 border-ink shadow-retro-lg p-4 flex flex-col gap-3"
            initial={{ scale: 0.88, y: 24 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.88, y: 24 }}
            dir="rtl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers size={20} className="text-defense-blue" />
                <h3 className="font-cairo font-black text-base text-ink">ترتيب الدوسيه (أول كروت السحب)</h3>
              </div>
              <span className="text-xs font-cairo font-black bg-white px-2.5 py-0.5 rounded-full border border-ink text-prank-red">
                {Math.ceil(timeLeft)} ث
              </span>
            </div>

            <p className="text-xs font-cairo font-bold text-ink/70">
              رقم <strong>1</strong> هو أول كارت هيتسحب الدور الجاي من كومة السحب!
            </p>

            <div className="flex flex-col gap-2">
              {ordered.map((card, idx) => {
                const def = CARD_DEFINITIONS[card.cardType];
                return (
                  <div
                    key={card.instanceId}
                    className={`flex items-center gap-2.5 p-2 rounded-xl border-2 bg-white ${
                      idx === 0 ? 'border-wasta-gold shadow-retro-sm' : 'border-ink/25'
                    }`}
                  >
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center font-cairo font-black text-sm border border-ink flex-shrink-0 ${
                        idx === 0 ? 'bg-wasta-gold text-white' : 'bg-manila text-ink'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <CardComponent cardType={card.cardType} size="xs" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-cairo font-black text-ink truncate">{def.nameAr}</p>
                      <p className="text-[10px] font-cairo text-ink/65 truncate">
                        {idx === 0 ? '⬆️ فوق الكومة (هيتسحب أولاً)' : idx === 1 ? 'التاني في السحب' : 'التالت في السحب'}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => move(idx, -1)}
                        disabled={idx === 0}
                        className="p-1 rounded bg-manila border border-ink/40 disabled:opacity-30"
                        title="اطلع لفوق"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        onClick={() => move(idx, 1)}
                        disabled={idx === ordered.length - 1}
                        className="p-1 rounded bg-manila border border-ink/40 disabled:opacity-30"
                        title="انزل لتحت"
                      >
                        <ArrowDown size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={handleConfirm}
              className="w-full py-2.5 bg-defense-blue text-white font-cairo font-bold rounded-xl border-2 border-ink shadow-retro active:shadow-none transition-all"
            >
              تثبيت الترتيب ✓
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
