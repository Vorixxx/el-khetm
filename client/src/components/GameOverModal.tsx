// ========================
// EL-KHETM — Game Over Modal (4-Document Showdown, Pinned Action Footer)
// ========================

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, RotateCcw, Home, Sparkles, CheckCircle2 } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { useSocket } from '../hooks/useSocket';
import { getAvatarImage, getAvatarFallback, getCardImage } from '../config/assets';
import { roundToClockTime, getSafeCardDef, CORE_DOCUMENTS } from '@el-khetm/shared';
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
  const winnerNames = winners.map(w => w.name).join(' و ');
  const endClock = publicState ? roundToClockTime(publicState.roundNumber || 1) : '';

  const sortedPlayers = publicState
    ? [...publicState.players].sort((a, b) => {
        const docsDiff = (b.fileSummary?.uniqueDocsCount ?? 0) - (a.fileSummary?.uniqueDocsCount ?? 0);
        if (docsDiff !== 0) return docsDiff;
        return (b.fileSummary?.filledSlotsCount ?? 0) - (a.fileSummary?.filledSlotsCount ?? 0);
      })
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
            className="w-full max-w-md bg-manila rounded-2xl border-2 border-ink shadow-retro-lg p-3.5 max-h-[90dvh] flex flex-col overflow-hidden"
            initial={{ scale: 0.85, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.85, y: 30 }}
            transition={{ type: 'spring', damping: 22 }}
            dir="rtl"
          >
            {/* Header Trophy */}
            <div className="flex-shrink-0 flex flex-col items-center text-center mb-2.5">
              <div
                className={`w-11 h-11 rounded-full flex items-center justify-center mb-1.5 ${
                  isPerfect
                    ? 'bg-wasta-gold/25 border-2 border-wasta-gold'
                    : 'bg-ink/10 border-2 border-ink/30'
                }`}
              >
                {isPerfect ? (
                  <Sparkles className="text-wasta-gold" size={24} />
                ) : (
                  <Clock className="text-ink/75" size={24} />
                )}
              </div>

              <h2 className="font-cairo font-black text-lg text-ink leading-tight">
                {isPerfect
                  ? '🦅 الختم الكامل — ملف مكتمل!'
                  : '⏰ الساعة جت 2 الضهر — كشف الملفات!'}
              </h2>
              <p className="font-cairo font-bold text-xs text-ink/75 mt-0.5">
                الفائز: <span className="text-doc-green font-black">{winnerNames}</span> ({endClock})
              </p>
            </div>

            {/* Scrollable Players Revealed 4-Slot Showdown */}
            <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-0.5 pb-1">
              {sortedPlayers.map((p, rank) => {
                const fs = p.fileSummary;
                const isWinner = publicState.winnerIds?.includes(p.id);
                const docsCollected = fs?.docsCollected ?? [];
                const docCount = fs?.uniqueDocsCount ?? 0;

                return (
                  <div
                    key={p.id}
                    className={`rounded-xl border-2 p-2 bg-white ${
                      isWinner ? 'border-wasta-gold ring-2 ring-wasta-gold/30' : 'border-ink/20'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs font-cairo font-black text-ink/60">#{rank + 1}</span>
                        <div className="w-7 h-7 rounded-full overflow-hidden border border-ink bg-white flex-shrink-0">
                          <img
                            src={getAvatarImage(p.avatarId as AvatarId)}
                            alt={p.name}
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).src = getAvatarFallback(p.name); }}
                          />
                        </div>
                        <span className="font-cairo font-black text-xs sm:text-sm text-ink truncate">
                          {p.name} {isWinner && '🏆'}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-cairo font-black border ${
                          docCount === 4
                            ? 'bg-doc-green text-white border-ink'
                            : isWinner
                            ? 'bg-wasta-gold text-ink border-ink'
                            : 'bg-manila text-ink border-ink/30'
                        }`}
                      >
                        {docCount === 4 ? '🦅 4/4 مكتمل!' : `${docCount} / 4 مستندات`}
                      </span>
                    </div>

                    {/* Revealed 4 Slots */}
                    <div className="flex items-center gap-1 mb-1.5">
                      {p.dossierSlots.map((slot, sIdx) => {
                        const revealedDef = slot.revealedCard ? getSafeCardDef(slot.revealedCard.cardType) : null;
                        return (
                          <div
                            key={sIdx}
                            className="flex-1 flex flex-col items-center bg-manila/60 rounded-lg p-1 border border-ink/15"
                          >
                            {slot.revealedCard && revealedDef ? (
                              <>
                                <img
                                  src={getCardImage(slot.revealedCard.cardType)}
                                  alt={revealedDef.nameAr}
                                  className="w-10 aspect-[3/4] rounded border border-ink object-cover"
                                />
                                <span className="text-[8px] font-cairo font-bold text-ink truncate w-full text-center mt-0.5">
                                  {revealedDef.nameAr}
                                </span>
                              </>
                            ) : (
                              <div className="w-10 aspect-[3/4] rounded border border-dashed border-ink/30 flex items-center justify-center text-[9px] text-ink/45">
                                فاضي
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Checklist of the 4 Official Documents */}
                    <div className="flex flex-wrap gap-1 text-[9px] font-cairo font-bold">
                      {CORE_DOCUMENTS.map(doc => {
                        const has = docsCollected.includes(doc);
                        return (
                          <span
                            key={doc}
                            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded ${
                              has
                                ? 'bg-doc-green/15 text-doc-green border border-doc-green/35'
                                : 'bg-ink/5 text-ink/40 border border-ink/10'
                            }`}
                          >
                            {has && <CheckCircle2 size={9} />}
                            {getSafeCardDef(doc).nameAr}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pinned Bottom Action Buttons (Always visible without scrolling) */}
            <div className="flex-shrink-0 flex gap-2 pt-2.5 mt-1 border-t border-ink/15">
              <button
                onClick={handlePlayAgain}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-doc-green text-white text-sm font-cairo font-bold rounded-xl border-2 border-ink shadow-retro active:shadow-none"
              >
                <RotateCcw size={17} />
                جيم تاني
              </button>
              <button
                onClick={handleGoHome}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white text-ink text-sm font-cairo font-bold rounded-xl border-2 border-ink/40"
              >
                <Home size={17} />
                الرئيسية
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
