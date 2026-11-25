// ========================
// EL-KHETM — Game Over Modal (4-Document Showdown, Zero Points)
// ========================

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, RotateCcw, Home, Sparkles, CheckCircle2 } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { useSocket } from '../hooks/useSocket';
import { getAvatarImage, getAvatarFallback, getCardImage } from '../config/assets';
import { roundToClockTime, CARD_DEFINITIONS, CORE_DOCUMENTS } from '@el-khetm/shared';
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
                  isPerfect
                    ? 'bg-wasta-gold/25 border-2 border-wasta-gold'
                    : 'bg-ink/10 border-2 border-ink/30'
                }`}
              >
                {isPerfect ? (
                  <Sparkles className="text-wasta-gold" size={28} />
                ) : (
                  <Clock className="text-ink/75" size={28} />
                )}
              </div>

              <h2 className="font-cairo font-black text-xl text-ink">
                {isPerfect
                  ? '🦅 الختم الكامل — ملف مكتمل!'
                  : '⏰ الساعة جت 2 الضهر — كشف الملفات!'}
              </h2>
              <p className="font-cairo font-bold text-xs text-ink/75 mt-1">
                الفائز: <span className="text-doc-green font-black">{winnerNames}</span> ({endClock})
              </p>
            </div>

            {/* Players Revealed 4-Slot Showdown */}
            <div className="space-y-2.5 mb-4">
              {sortedPlayers.map((p, rank) => {
                const fs = p.fileSummary;
                const isWinner = publicState.winnerIds?.includes(p.id);
                const docsCollected = fs?.docsCollected ?? [];
                const docCount = fs?.uniqueDocsCount ?? 0;

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
                                className="w-11 h-15 rounded border border-ink object-cover"
                              />
                              <span className="text-[8.5px] font-cairo font-bold text-ink truncate w-full text-center mt-0.5">
                                {CARD_DEFINITIONS[slot.revealedCard.cardType].nameAr}
                              </span>
                            </>
                          ) : (
                            <div className="w-11 h-15 rounded border border-dashed border-ink/30 flex items-center justify-center text-[9px] text-ink/45">
                              فاضي
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Checklist of the 4 Official Documents */}
                    <div className="flex flex-wrap gap-1 text-[9.5px] font-cairo font-bold">
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
                            {has && <CheckCircle2 size={10} />}
                            {CARD_DEFINITIONS[doc].nameAr}
                          </span>
                        );
                      })}
                    </div>
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
