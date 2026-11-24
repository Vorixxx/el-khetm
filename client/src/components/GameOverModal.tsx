// ========================
// EL-KHETM — Game Over Modal
// ========================

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Clock, RotateCcw, Home } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { useSocket } from '../hooks/useSocket';
import { getAvatarImage, getAvatarFallback } from '../config/assets';
import { roundToClockTime } from '@el-khetm/shared';
import type { AvatarId } from '@el-khetm/shared';

export const GameOverModal: React.FC = () => {
  const { socket } = useSocket();
  const { publicState, activeModal, closeModal, quickPlay, leaveRoom } = useGameStore();

  const isOpen = activeModal === 'gameover';

  const handlePlayAgain = () => {
    closeModal();
    leaveRoom(socket);
    setTimeout(() => quickPlay(socket, 3), 120);
  };

  const handleGoHome = () => {
    closeModal();
    leaveRoom(socket);
  };

  const winners = publicState ? publicState.players.filter(p => publicState.winnerIds?.includes(p.id)) : [];
  const isEagleSeal = publicState?.winReason === 'EAGLE_SEAL';
  const winnerNames = winners.map(w => w.name).join(' و ');
  const endClock = publicState ? roundToClockTime(publicState.roundNumber || 1) : '';

  return (
    <AnimatePresence>
      {isOpen && publicState && (
        <motion.div
          key="gameover-modal"
          className="absolute inset-0 z-50 flex items-center justify-center bg-ink/65 backdrop-blur-[1px] p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="w-full max-w-sm bg-manila rounded-2xl border-2 border-ink shadow-retro-lg p-6"
            initial={{ scale: 0.8, y: 40 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, y: 40 }}
            transition={{ type: 'spring', damping: 22 }}
            dir="rtl"
          >
            {/* Icon */}
            <div className="flex justify-center mb-3">
              <motion.div
                animate={isEagleSeal ? { rotate: [0, -10, 10, 0], scale: [1, 1.2, 1] } : {}}
                transition={{ duration: 0.5, repeat: 2 }}
                className={`w-16 h-16 rounded-full flex items-center justify-center ${
                  isEagleSeal ? 'bg-wasta-gold/20 border-2 border-wasta-gold' : 'bg-ink/10 border-2 border-ink/30'
                }`}
              >
                {isEagleSeal ? (
                  <Trophy className="text-wasta-gold" size={32} />
                ) : (
                  <Clock className="text-ink/70" size={32} />
                )}
              </motion.div>
            </div>

            {/* Title */}
            <h2 className="text-center font-cairo font-black text-2xl text-ink mb-2">
              {isEagleSeal ? '🦅 ختمت!' : '⏰ الساعة جت 2 الضهر!'}
            </h2>

            {/* Verbatim Win Message */}
            <p className="text-center font-cairo font-bold text-sm text-ink/80 mb-4 leading-relaxed">
              {isEagleSeal
                ? `مبروك يا ${winnerNames}! ختمت ورقك ومشيت قبل الزحمة! (${endClock})`
                : `الساعة جت 2 الضهر والموظف قفل الشباك! الفائز بأكبر عدد ورق: ${winnerNames}`
              }
            </p>

            {/* Winners */}
            <div className="flex justify-center gap-3 mb-4">
              {winners.map(w => (
                <div key={w.id} className="flex flex-col items-center gap-1">
                  <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-wasta-gold bg-white">
                    <img
                      src={getAvatarImage(w.avatarId as AvatarId)}
                      alt={w.name}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).src = getAvatarFallback(w.name); }}
                    />
                  </div>
                  <span className="font-cairo font-bold text-sm text-ink">{w.name}</span>
                  <span className="text-[11px] font-cairo text-doc-green font-bold">
                    ملف: {w.file.length}/4
                  </span>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="bg-white rounded-xl border-2 border-ink/20 p-3 mb-4">
              <p className="font-cairo font-bold text-xs text-ink/60 mb-1.5">ملخص اللاعبين</p>
              {publicState.players.map(p => (
                <div key={p.id} className="flex items-center justify-between py-1 border-b border-ink/10 last:border-0">
                  <span className="font-cairo font-bold text-xs text-ink">{p.name}</span>
                  <div className="flex gap-3 text-[11px] font-cairo font-bold text-ink/65">
                    <span>ملف: {p.file.length}/4</span>
                    <span>يد: {p.handCount}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <button
                onClick={handlePlayAgain}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-doc-green text-white font-cairo font-bold rounded-xl border-2 border-ink shadow-retro active:shadow-none active:translate-x-[3px] active:translate-y-[3px] transition-all"
              >
                <RotateCcw size={18} />
                جيم تاني
              </button>
              <button
                onClick={handleGoHome}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white text-ink font-cairo font-bold rounded-xl border-2 border-ink/40 active:bg-ink/5 transition-all"
              >
                <Home size={18} />
                الرجوع للرئيسية
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
