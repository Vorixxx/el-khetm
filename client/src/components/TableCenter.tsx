// ========================
// EL-KHETM — Table Center (Open Market + Draw Deck + Stacked Tilted Archive)
// ========================

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Hourglass, Sparkles } from 'lucide-react';
import { CARD_DEFINITIONS } from '@el-khetm/shared';
import { useGameStore } from '../store/useGameStore';
import { useSocket } from '../hooks/useSocket';
import { Card as CardComponent } from './Card';
import { getCardImage } from '../config/assets';

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
      className="flex items-center gap-1 bg-defense-blue text-white px-2.5 py-0.5 rounded-full border-2 border-ink shadow-retro-sm text-[10px] font-cairo font-bold text-center"
    >
      <Hourglass size={11} className="animate-spin flex-shrink-0" />
      <span>
        في انتظار {targetName} ({Math.ceil(reactionSecondsLeft)} ث)
      </span>
    </motion.div>
  );
};

export const TableCenter: React.FC = () => {
  const { socket } = useSocket();
  const { publicState, privateState, myPlayerId, setHoveredPreview, drawCard, openModal } = useGameStore();

  const pendingReaction = publicState?.pendingReaction ?? null;
  const myId = privateState?.playerId || myPlayerId;

  if (!publicState) return null;

  const {
    deckCount,
    openMarket,
    discardPileRecent,
    discardPileTop,
    discardPileCount,
    globalEffects,
    lastEvent,
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
    <div className="w-full flex flex-col items-center justify-center gap-[clamp(3px,0.7dvh,7px)] px-0.5 py-0.5" dir="rtl">
      {/* Draw Prompt Header during YOUR DRAW_PHASE */}
      <AnimatePresence>
        {isMyDrawPhase && (
          <motion.div
            key="draw-prompt"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-doc-green text-white px-2.5 py-0.5 rounded-full border-2 border-ink shadow-retro-sm text-[10px] sm:text-[11px] font-cairo font-black flex items-center gap-1 animate-pulse"
          >
            <Sparkles size={11} />
            <span>دورك: اسحب من الشباك أو الكومة!</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Open Market ("شباك الطلبات" — 3 Face-Up Cards) */}
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-[9px] font-cairo font-extrabold text-ink bg-manila/90 px-2 py-0 rounded-full border border-ink/35">
          🪟 شباك الطلبات
        </span>
        <div
          className={`flex items-center justify-center gap-1 sm:gap-1.5 px-1.5 py-1 rounded-xl border-2 transition-all ${
            isMyDrawPhase
              ? 'bg-wasta-gold/20 border-wasta-gold shadow-[0_0_16px_rgba(245,158,11,0.45)]'
              : 'bg-manila/65 border-ink/25'
          }`}
        >
          {openMarket.map((card, idx) =>
            card ? (
              <motion.div
                key={card.instanceId}
                initial={{ scale: 0.78, opacity: 0, y: -8 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                whileHover={{ y: -4, scale: 1.08 }}
                transition={{ type: 'spring', stiffness: 360, damping: 24 }}
                onPointerEnter={(e) => {
                  if (e.pointerType !== 'touch') {
                    setHoveredPreview({
                      cardType: card.cardType,
                      badgeText: 'شباك الطلبات',
                      statusText: isMyDrawPhase ? 'اضغط لسحب الكارت ده!' : 'متاح للسحب في دورك',
                    });
                  }
                }}
                onPointerLeave={() => setHoveredPreview(null)}
                onClick={() => {
                  if (isMyDrawPhase) {
                    drawCard(socket, 'market', idx);
                  } else {
                    openModal('card_zoom', { cardType: card.cardType });
                  }
                }}
                className={`relative cursor-pointer rounded-md ${
                  isMyDrawPhase ? 'ring-2 ring-doc-green ring-offset-1' : ''
                }`}
              >
                <CardComponent cardType={card.cardType} size="xs" />
              </motion.div>
            ) : (
              <div
                key={`empty-mkt-${idx}`}
                className="w-[clamp(34px,9.6vw,44px)] aspect-[3/4] rounded-md border border-dashed border-ink/25 bg-white/30"
              />
            ),
          )}
        </div>
      </div>

      {/* Draw Deck + Messy Stacked Archive Pile */}
      <div className="flex items-center justify-center gap-3 sm:gap-4 pt-0.5">
        {/* Draw Deck */}
        <div className="flex flex-col items-center">
          <motion.div
            whileTap={isMyDrawPhase ? { scale: 0.94 } : undefined}
            onClick={() => {
              if (isMyDrawPhase) {
                drawCard(socket, 'deck');
              }
            }}
            className={`relative isolate rounded-lg transition-shadow ${
              isMyDrawPhase ? 'ring-[3px] ring-doc-green shadow-[0_0_14px_rgba(21,128,61,0.5)] cursor-pointer' : ''
            }`}
          >
            {deckCount > 3 && (
              <div className="absolute top-1.5 left-1.5 w-full h-full rounded-lg border-2 border-ink bg-[#3B0B15] -z-10" />
            )}
            {deckCount > 1 && (
              <div className="absolute top-0.5 left-0.5 w-full h-full rounded-lg border border-ink bg-[#4A0E1B] -z-10" />
            )}
            <CardComponent cardType="id_copy" isBack size="sm" />
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 z-20 bg-ink text-white text-[10px] font-cairo font-extrabold px-1.5 py-0 rounded-full border border-manila shadow-sm whitespace-nowrap">
              {deckCount}
            </div>
          </motion.div>
          <span className="text-[9.5px] font-cairo font-extrabold text-ink bg-manila/95 px-2 py-0 rounded-full border border-ink/40 mt-2">
            {isMyDrawPhase ? '👆 اسحب مقلوب' : 'الكومة'}
          </span>
        </div>

        {/* Messy Tilted Discard Archive */}
        <div className="flex flex-col items-center">
          {recentStack.length > 0 && discardPileTop ? (
            <div
              className="relative w-[clamp(52px,14.5vw,68px)] aspect-[3/4] cursor-pointer"
              onPointerEnter={(e) => {
                if (e.pointerType !== 'touch') {
                  setHoveredPreview({
                    cardType: discardPileTop.cardType,
                    badgeText: `أعلى الأرشيف (${discardPileCount})`,
                    statusText: 'لو عندك زيّه في ملفك اعمل «جرد»!',
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
                  return (
                    <motion.div
                      key={card.instanceId}
                      initial={{ scale: 1.32, rotate: angle - 18, y: -20, opacity: 0.4 }}
                      animate={{
                        scale: isTop ? 1 : 0.96,
                        rotate: angle,
                        x: off.x,
                        y: off.y,
                        opacity: 1,
                      }}
                      transition={{ type: 'spring', stiffness: 360, damping: 22 }}
                      style={{ zIndex: i + 1 }}
                      className="absolute inset-0"
                    >
                      <CardComponent cardType={card.cardType} size="sm" />
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 z-30 bg-ink/95 text-white text-[10px] font-cairo font-extrabold px-1.5 py-0 rounded-full border border-manila shadow-sm whitespace-nowrap">
                {discardPileCount}
              </div>
            </div>
          ) : (
            <div className="w-[clamp(52px,14.5vw,68px)] aspect-[3/4] rounded-lg border-2 border-dashed border-ink/35 bg-manila/60 flex items-center justify-center p-1 text-center">
              <span className="text-[9.5px] font-cairo font-bold text-ink/60">الأرشيف فاضي</span>
            </div>
          )}
          <span className="text-[9.5px] font-cairo font-extrabold text-ink bg-manila/95 px-2 py-0 rounded-full border border-ink/40 mt-2">
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

      {/* Medhat Vacation Global Pill */}
      <AnimatePresence>
        {isMedhatActive && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            onClick={() => openModal('card_zoom', { cardType: 'medhat_vacation' })}
            className="cursor-pointer bg-manila border-2 border-prank-red text-prank-red px-2.5 py-0.5 rounded-full shadow-retro-sm text-[9.5px] font-cairo font-extrabold text-center"
          >
            🏖️ مدحت في إجازة (ممنوع الإمضاء لفة كاملة)
          </motion.div>
        )}
      </AnimatePresence>

      {/* Compact Event Story Card */}
      <AnimatePresence mode="wait">
        {lastEvent && (
          <motion.div
            key={lastEvent.id}
            initial={{ opacity: 0, y: 6, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.94 }}
            transition={{ duration: 0.2 }}
            onClick={() => lastEvent.cardType && openModal('card_zoom', { cardType: lastEvent.cardType })}
            className={`w-full max-w-[260px] cursor-pointer flex items-center gap-1.5 px-2 py-1 rounded-xl border-2 shadow-retro-sm bg-manila/95 ${
              lastEvent.blocked
                ? 'border-defense-blue'
                : lastEvent.isWindowClose
                ? 'border-prank-red ring-2 ring-prank-red/35'
                : lastEvent.isMatchSuccess
                ? 'border-doc-green'
                : 'border-ink/70'
            }`}
          >
            {lastEvent.cardType && (
              <img
                src={getCardImage(lastEvent.cardType)}
                alt={CARD_DEFINITIONS[lastEvent.cardType].nameAr}
                className="w-6 h-8 sm:w-7 sm:h-10 rounded border border-ink object-cover flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0 text-right leading-tight">
              <p className="text-[10px] font-cairo font-black text-ink truncate">
                {lastEvent.headlineAr}
              </p>
              <p className="compact-hide-short text-[9px] font-cairo font-bold text-ink/75 mt-0.5 line-clamp-2">
                {lastEvent.explanationAr}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
