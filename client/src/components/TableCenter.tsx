// ========================
// EL-KHETM — Table Center (Giant Draw Deck + Messy Tilted Archive)
// ========================

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Hourglass, Sparkles } from 'lucide-react';
import { getSafeCardDef } from '@el-khetm/shared';
import { useGameStore } from '../store/useGameStore';
import { useSocket } from '../hooks/useSocket';
import { Card as CardComponent } from './Card';

const STACK_ANGLES = [-12, 9, -5, 4];
const STACK_OFFSETS = [
  { x: -4, y: 3 },
  { x: 5, y: -2 },
  { x: -2, y: -3 },
  { x: 0, y: 0 },
];

const WaitingReactionBadge: React.FC<{ targetName: string; expiresAt: number }> = ({
  targetName,
  expiresAt,
}) => {
  const [reactionSecondsLeft, setReactionSecondsLeft] = useState(0);

  useEffect(() => {
    const update = () => {
      setReactionSecondsLeft(Math.max(0, (expiresAt - Date.now()) / 1000));
    };
    update();
    const interval = setInterval(update, 250);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return (
    <motion.div
      key="waiting-reaction"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="flex items-center gap-1 bg-defense-blue text-white px-3 py-1 rounded-full border-2 border-ink shadow-retro-sm text-[11px] font-cairo font-bold text-center"
    >
      <Hourglass size={12} className="animate-spin flex-shrink-0" />
      <span>
        في انتظار {targetName} ({Math.ceil(reactionSecondsLeft)} ث)
      </span>
    </motion.div>
  );
};

export const TableCenter: React.FC = () => {
  const { socket } = useSocket();
  const {
    publicState,
    privateState,
    myPlayerId,
    setHoveredPreview,
    drawCard,
    openModal,
    hiddenArchiveCardIds,
  } = useGameStore();

  const pendingReaction = publicState?.pendingReaction ?? null;
  const myId = privateState?.playerId || myPlayerId;

  if (!publicState) return null;

  const {
    deckCount,
    discardPileRecent,
    discardPileTop,
    discardPileCount,
    globalEffects,
    phase,
    currentTurnPlayerId,
  } = publicState;

  const isMyDrawPhase = phase === 'DRAW_PHASE' && currentTurnPlayerId === myId;
  const isMedhatActive = globalEffects.medhatVacationUntilPlayerId !== null;
  const showWaitingReactionBanner =
    phase === 'PENDING_REACTION' && pendingReaction && pendingReaction.targetId !== myId;

  const recentStack = discardPileRecent && discardPileRecent.length > 0
    ? discardPileRecent
    : discardPileTop
    ? [discardPileTop]
    : [];

  return (
    <div className="w-full flex flex-col items-center justify-center gap-2 px-1 py-1" dir="rtl">
      {/* Draw Prompt Header during YOUR DRAW_PHASE */}
      <AnimatePresence>
        {isMyDrawPhase && (
          <motion.div
            key="draw-prompt"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-doc-green text-white px-3 py-1 rounded-full border-2 border-ink shadow-retro-sm text-[11px] sm:text-xs font-cairo font-black flex items-center gap-1.5 animate-pulse"
          >
            <Sparkles size={12} />
            <span>دورك: اضغط على الكومة واسحب كارت!</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Large Side-by-Side Draw Deck + Messy Stacked Archive Pile */}
      <div className="flex items-center justify-center gap-4 sm:gap-7">
        {/* Draw Deck */}
        <div className="flex flex-col items-center">
          <motion.div
            data-flight-anchor="deck"
            whileTap={isMyDrawPhase ? { scale: 0.93 } : undefined}
            whileHover={isMyDrawPhase ? { scale: 1.05 } : undefined}
            onClick={() => {
              if (isMyDrawPhase) {
                drawCard(socket);
              }
            }}
            className={`relative isolate rounded-xl transition-shadow ${
              isMyDrawPhase
                ? 'ring-[4px] ring-doc-green shadow-[0_0_22px_rgba(21,128,61,0.65)] cursor-pointer'
                : ''
            }`}
          >
            {deckCount > 3 && (
              <div className="absolute top-2 left-2 w-full h-full rounded-xl border-2 border-ink bg-[#3B0B15] -z-10" />
            )}
            {deckCount > 1 && (
              <div className="absolute top-1 left-1 w-full h-full rounded-xl border border-ink bg-[#4A0E1B] -z-10" />
            )}
            <CardComponent cardType="id_copy" isBack size="sm" />
            <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 z-20 bg-ink text-white text-[11px] font-cairo font-black px-2 py-0 rounded-full border border-manila shadow-sm whitespace-nowrap">
              {deckCount}
            </div>
          </motion.div>
          <span
            className={`text-[10.5px] font-cairo font-black px-2.5 py-0.5 rounded-full border mt-3 ${
              isMyDrawPhase
                ? 'bg-doc-green text-white border-ink shadow-sm'
                : 'bg-manila/95 text-ink border-ink/40'
            }`}
          >
            {isMyDrawPhase ? '👆 اسحب كارت' : 'الكومة'}
          </span>
        </div>

        {/* Messy Tilted Discard Archive */}
        <div className="flex flex-col items-center">
          {recentStack.length > 0 && discardPileTop ? (
            <div
              data-flight-anchor="archive"
              className="relative w-[clamp(68px,19vw,104px)] aspect-[3/4] cursor-pointer"
              onPointerEnter={(e) => {
                if (e.pointerType !== 'touch') {
                  setHoveredPreview({
                    cardType: discardPileTop.cardType,
                    badgeText: `الأرشيف (${discardPileCount})`,
                    statusText: getSafeCardDef(discardPileTop.cardType).shortEffectAr,
                  });
                }
              }}
              onPointerLeave={() => setHoveredPreview(null)}
              onClick={() => openModal('card_zoom', { cardType: discardPileTop.cardType })}
            >
              <AnimatePresence initial={false}>
                {recentStack.map((card, i) => {
                  const isTop = i === recentStack.length - 1;
                  const angle = STACK_ANGLES[i % STACK_ANGLES.length];
                  const off = STACK_OFFSETS[i % STACK_OFFSETS.length];
                  const isFlightHidden = Boolean(hiddenArchiveCardIds[card.instanceId]?.length);
                  return (
                    <motion.div
                      key={card.instanceId}
                      initial={false}
                      animate={{
                        scale: isTop ? 1 : 0.96,
                        rotate: angle,
                        x: off.x,
                        y: off.y,
                        opacity: isFlightHidden ? 0 : 1,
                      }}
                      transition={
                        isFlightHidden
                          ? { duration: 0 }
                          : { type: 'spring', stiffness: 420, damping: 28 }
                      }
                      style={{ zIndex: i + 1 }}
                      className="absolute inset-0"
                    >
                      <CardComponent cardType={card.cardType} size="sm" />
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 z-30 bg-ink/95 text-white text-[11px] font-cairo font-black px-2 py-0 rounded-full border border-manila shadow-sm whitespace-nowrap">
                {discardPileCount}
              </div>
            </div>
          ) : (
            <div
              data-flight-anchor="archive"
              className="w-[clamp(68px,19vw,104px)] aspect-[3/4] rounded-xl border-2 border-dashed border-ink/35 bg-manila/60 flex items-center justify-center p-2 text-center"
            >
              <span className="text-[11px] font-cairo font-bold text-ink/60">الأرشيف فاضي</span>
            </div>
          )}
          <span className="text-[10.5px] font-cairo font-black text-ink bg-manila/95 px-2.5 py-0.5 rounded-full border border-ink/40 mt-3">
            الأرشيف
          </span>
        </div>
      </div>

      {/* Waiting Reaction Pill */}
      <AnimatePresence>
        {showWaitingReactionBanner && pendingReaction && (
          <WaitingReactionBadge
            targetName={pendingReaction.targetName}
            expiresAt={pendingReaction.expiresAt}
          />
        )}
      </AnimatePresence>

      {/* Active Medhat Vacation Pill */}
      {isMedhatActive && (
        <div className="bg-prank-red text-white px-2.5 py-0.5 rounded-full border border-ink text-[10px] font-cairo font-bold shadow-sm">
          🏖️ مدحت في إجازة (ممنوع الإمضاء لفة)
        </div>
      )}
    </div>
  );
};
