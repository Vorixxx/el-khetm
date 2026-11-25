// ========================
// EL-KHETM — Game Over Modal (Showdown Reveal & Score Breakdown)
// ========================

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Clock, RotateCcw, Home, Sparkles } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { useSocket } from '../hooks/useSocket';
import { getAvatarImage, getAvatarFallback, getCardImage } from '../config/assets';
import { roundToClockTime, CARD_DEFINITIONS } from '@el-khetm/shared';
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
  const isPerfect = publicState?.winReason === 'PERFECT_SEAL';
  const isWindowClosed = publicState?.winReason === 'WINDOW_CLOSED';
  const winnerNames = winners.map(w => w.name).join(' و ');
  const endClock = publicState ? roundToClockTime(publicState.roundNumber || 1) : '';

  const sortedPlayers = publicState
    ? [...publicState.players].sort(
        (a, b) => (b.scoreBreakdown?.totalScore ?? 0) - (a.scoreBreakdown?.totalScore ?? 0),
      )
    : [];

  return (
    <AnimatePresence>
      {isOpen && publicState && (
        <motion.div
          key="gameover-modal"
          className="absolute inset-0 z-50 flex items-center justify-center bg-ink/75 p-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="w-full max-w-md bg-manila rounded-2xl border-2 border-ink shadow-retro-lg p-4 max-h-[90vh] overflow-y-auto"
            initial={{ scale: 0.85, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.85, y: 30 }}
            transition={{ type: 'spring', damping: 22 }}
            dir="rtl"
          >
            {/* Header Trophy */}
            <div className="flex flex-col items-center text-center mb-3">
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center mb-2 ${
                  isPerfect || isWindowClosed
                    ? 'bg-wasta-gold/25 border-2 border-wasta-gold'
                    : 'bg-ink/10 border-2 border-ink/30'
                }`}
              >
                {isPerfect ? (
                  <Sparkles className="text-wasta-gold" size={28} />
                ) : isWindowClosed ? (
                  <Trophy className="text-wasta-gold" size={28} />
                ) : (
                  <Clock className="text-ink/75" size={28} />
                )}
              </div>

              <h2 className="font-cairo font-black text-xl text-ink">
                {isPerfect
                  ? '🦅 ختم مثالي بالترتيب!'
                  : isWindowClosed
                  ? `🚨 كشف الملفات (${publicState.windowClosedPlayerName} قفل الشباك!)`
                  : '⏰ الساعة جت 2 الضهر — كشف الملفات!'}
              </h2>
              <p className="font-cairo font-bold text-xs text-ink/75 mt-1">
                الفائز: <span className="text-doc-green font-black">{winnerNames}</span> ({endClock})
              </p>
            </div>

            {/* Detailed Showdown Table */}
            <div className="space-y-2 mb-4">
              {sortedPlayers.map((p, rank) => {
                const sb = p.scoreBreakdown;
                const isWinner = publicState.winnerIds?.includes(p.id);
                return (
                  <div
                    key={p.id}
                    className={`rounded-xl border-2 p-2.5 bg-white ${
                      isWinner ? 'border-wasta-gold ring-2 ring-wasta-gold/30' : 'border-ink/20'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-cairo font-black text-ink/60">#{rank + 1}</span>
                        <div className="w-8 h-8 rounded-full overflow-hidden border border-ink bg-white flex-shrink-0">
                          <img
                            src={getAvatarImage(p.avatarId as AvatarId)}
                            alt={p.name}
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).src = getAvatarFallback(p.name); }}
                          />
                        </div>
                        <span className="font-cairo font-black text-sm text-ink truncate">
                          {p.name} {isWinner && '🏆'}
                        </span>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-cairo font-black border ${
                          isWinner
                            ? 'bg-doc-green text-white border-ink'
                            : 'bg-manila text-ink border-ink/30'
                        }`}
                      >
                        {sb?.totalScore ?? 0} نقطة
                      </span>
                    </div>

                    {/* Revealed 4 Cards Row */}
                    <div className="flex items-center gap-1.5 mb-2">
                      {p.dossierSlots.map((slot, sIdx) => (
                        <div
                          key={sIdx}
                          className="flex-1 flex flex-col items-center bg-manila/60 rounded-lg p-1 border border-ink/15"
                        >
                          {slot.revealedCard ? (
                            <>
                              <img
                                src={getCardImage(slot.revealedCard.cardType)}
                                alt={CARD_DEFINITIONS[slot.revealedCard.cardType].nameAr}
                                className="w-10 h-14 rounded border border-ink object-cover"
                              />
                              <span className="text-[8.5px] font-cairo font-bold text-ink truncate w-full text-center mt-0.5">
                                {CARD_DEFINITIONS[slot.revealedCard.cardType].nameAr}
                              </span>
                            </>
                          ) : (
                            <div className="w-10 h-14 rounded border border-dashed border-ink/30 flex items-center justify-center text-[9px] text-ink/45">
                              فاضي
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Score Formula Breakdown Badges */}
                    {sb && (
                      <div className="flex flex-wrap gap-1 text-[9.5px] font-cairo font-bold">
                        <span className="bg-doc-green/10 text-doc-green px-1.5 py-0.5 rounded">
                          مستندات: +{sb.docsPoints}
                        </span>
                        {sb.orderBonus > 0 && (
                          <span className="bg-wasta-gold/20 text-ink px-1.5 py-0.5 rounded">
                            ترتيب: +{sb.orderBonus}
                          </span>
                        )}
                        {sb.completeFileBonus > 0 && (
                          <span className="bg-doc-green text-white px-1.5 py-0.5 rounded">
                            ملف كامل: +{sb.completeFileBonus}
                          </span>
                        )}
                        {sb.matchBonus !== 0 && (
                          <span className="bg-defense-blue/15 text-defense-blue px-1.5 py-0.5 rounded">
                            جرد: {sb.matchBonus > 0 ? `+${sb.matchBonus}` : sb.matchBonus}
                          </span>
                        )}
                        {sb.trapPenalty !== 0 && (
                          <span className="bg-prank-red/15 text-prank-red px-1.5 py-0.5 rounded">
                            عوائق/مقالب: {sb.trapPenalty > 0 ? `+${sb.trapPenalty}` : sb.trapPenalty}
                          </span>
                        )}
                        {sb.windowCloseDelta !== 0 && (
                          <span
                            className={`px-1.5 py-0.5 rounded ${
                              sb.windowCloseDelta > 0
                                ? 'bg-wasta-gold text-ink'
                                : 'bg-prank-red text-white'
                            }`}
                          >
                            {sb.windowCloseDelta > 0 ? 'سبق الشباك: +10' : 'قفل على فاضي: -15'}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={handlePlayAgain}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-doc-green text-white font-cairo font-bold rounded-xl border-2 border-ink shadow-retro active:shadow-none"
              >
                <RotateCcw size={18} />
                جيم تاني
              </button>
              <button
                onClick={handleGoHome}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white text-ink font-cairo font-bold rounded-xl border-2 border-ink/40"
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
