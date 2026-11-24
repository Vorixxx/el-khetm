// ========================
// EL-KHETM — Reaction Modal (Strict 5-Second Anti-Leak Window)
// ========================

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, AlertTriangle } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { useSocket } from '../hooks/useSocket';
import { CARD_DEFINITIONS } from '@el-khetm/shared';
import { Card as CardComponent } from './Card';

export const ReactionModal: React.FC = () => {
  const { socket } = useSocket();
  const { publicState, privateState, myPlayerId, activeModal, closeModal, react: reactAction } = useGameStore();
  const [timeLeft, setTimeLeft] = useState(5);

  const isOpen = activeModal === 'reaction';
  const reaction = publicState?.pendingReaction ?? null;
  const myId = privateState?.playerId || myPlayerId;
  const isTarget = Boolean(reaction && myId && reaction.targetId === myId);
  const hasBreakfastBreak = privateState?.hand.some(c => c.cardType === 'breakfast_break') ?? false;

  useEffect(() => {
    if (!isOpen || !reaction) return;
    const expire = reaction.expiresAt;
    const update = () => {
      const remaining = Math.max(0, (expire - Date.now()) / 1000);
      setTimeLeft(remaining);
    };
    update();
    const interval = setInterval(update, 50);
    return () => clearInterval(interval);
  }, [isOpen, reaction]);

  const handleBlock = () => {
    reactAction(socket, true);
    closeModal();
  };

  const handlePass = () => {
    reactAction(socket, false);
    closeModal();
  };

  const cardDef = reaction ? CARD_DEFINITIONS[reaction.cardPlayed.cardType] : null;
  const targetDocDef = reaction?.targetDoc ? CARD_DEFINITIONS[reaction.targetDoc] : null;

  return (
    <AnimatePresence>
      {isOpen && reaction && isTarget && cardDef && (
        <motion.div
          key="reaction-modal"
          className="absolute inset-0 z-50 flex items-center justify-center bg-ink/60 backdrop-blur-[1px] p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Screen shake */}
          <motion.div
            className="w-full max-w-sm"
            animate={{ x: [-8, 8, -6, 6, 0] }}
            transition={{ duration: 0.4 }}
          >
            <div className="bg-manila rounded-2xl border-2 border-prank-red shadow-retro-lg p-5" dir="rtl">
              {/* Alert Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="text-prank-red" size={24} />
                  <h3 className="font-cairo font-black text-xl text-prank-red">الحق نفسك!</h3>
                </div>
                {/* Timer Ring */}
                <div className="relative w-12 h-12">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <circle cx="18" cy="18" r="16" fill="none" stroke="#1E293B18" strokeWidth="3" />
                    <circle
                      cx="18" cy="18" r="16" fill="none"
                      stroke={timeLeft < 2 ? '#B91C1C' : '#1D4ED8'}
                      strokeWidth="3"
                      strokeDasharray={`${(timeLeft / 5) * 100.5} 100.5`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-base font-cairo font-black text-ink">
                    {Math.ceil(timeLeft)}
                  </span>
                </div>
              </div>

              {/* Attack Info + Card Preview */}
              <div className="flex items-center gap-3 bg-white/80 rounded-xl border border-ink/20 p-3 mb-4">
                <CardComponent cardType={reaction.cardPlayed.cardType} size="sm" />
                <div className="flex-1 text-right">
                  <p className="font-cairo font-extrabold text-ink text-sm">
                    {reaction.attackerName} رمى عليك «{cardDef.nameAr}»
                  </p>
                  <p className="font-cairo text-xs text-ink/70 mt-1">{cardDef.descriptionAr}</p>
                  {targetDocDef && (
                    <span className="inline-block mt-1.5 text-[11px] font-cairo font-bold bg-prank-red/10 text-prank-red border border-prank-red/30 px-2 py-0.5 rounded">
                      الهدف: «{targetDocDef.nameAr}»
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2.5">
                {hasBreakfastBreak ? (
                  <button
                    onClick={handleBlock}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-defense-blue text-white font-cairo font-bold rounded-xl border-2 border-ink shadow-retro active:shadow-none active:translate-x-[3px] active:translate-y-[3px] transition-all"
                  >
                    <Shield size={20} />
                    صد المقلب (بريك الفطار)
                  </button>
                ) : (
                  <button
                    disabled
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-ink/10 text-ink/45 font-cairo font-bold rounded-xl border-2 border-ink/20 cursor-not-allowed"
                  >
                    <Shield size={20} />
                    معكش بريك فطار
                  </button>
                )}

                <button
                  onClick={handlePass}
                  className="w-full px-4 py-2.5 bg-white text-ink font-cairo font-bold rounded-xl border-2 border-ink/40 hover:bg-ink/5 active:bg-ink/10 transition-all"
                >
                  عدّيها
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
