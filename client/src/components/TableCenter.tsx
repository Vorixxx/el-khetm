// ========================
// EL-KHETM — Table Center (Deck, Archive, Global Effects, Event Story Card)
// ========================

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Hourglass, X } from 'lucide-react';
import { CARD_DEFINITIONS } from '@el-khetm/shared';
import type { CardType } from '@el-khetm/shared';
import { useGameStore } from '../store/useGameStore';
import { Card as CardComponent } from './Card';
import { getCardImage } from '../config/assets';

export const TableCenter: React.FC = () => {
  const { publicState, privateState, myPlayerId, setHoveredPreview } = useGameStore();
  const [reactionSecondsLeft, setReactionSecondsLeft] = useState(0);
  const [inspectedCard, setInspectedCard] = useState<CardType | null>(null);

  const pendingReaction = publicState?.pendingReaction ?? null;
  const myId = privateState?.playerId || myPlayerId;

  useEffect(() => {
    if (!pendingReaction) {
      setReactionSecondsLeft(0);
      return;
    }
    const update = () => {
      const rem = Math.max(0, (pendingReaction.expiresAt - Date.now()) / 1000);
      setReactionSecondsLeft(rem);
    };
    update();
    const interval = setInterval(update, 100);
    return () => clearInterval(interval);
  }, [pendingReaction]);

  if (!publicState) return null;

  const { deckCount, discardPileTop, discardPileCount, globalEffects, lastEvent } = publicState;
  const isMedhatActive = globalEffects.medhatVacationUntilPlayerId !== null;
  const showWaitingReactionBanner =
    publicState.phase === 'PENDING_REACTION' &&
    pendingReaction &&
    pendingReaction.targetId !== myId;

  const isMeInvolved = Boolean(
    lastEvent && (lastEvent.targetId === myId || lastEvent.actorId === myId),
  );

  return (
    <div className="w-full flex flex-col items-center justify-center gap-2 px-0.5 py-1">
      {/* Deck & Discard Stacked/Paired Center */}
      <div className="flex items-center justify-center gap-3.5">
        {/* Deck Pile */}
        <div className="flex flex-col items-center gap-0.5">
          <div className="relative isolate">
            {deckCount > 2 && (
              <div className="absolute top-1.5 left-1.5 w-full h-full rounded-lg border-2 border-ink bg-[#3B0B15] -z-10" />
            )}
            <CardComponent cardType="id_copy" isBack size="sm" />
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 z-20 bg-ink text-white text-[11px] font-cairo font-extrabold px-2 py-0 rounded-full border border-manila shadow-sm whitespace-nowrap">
              {deckCount}
            </div>
          </div>
          <span className="text-[11px] font-cairo font-extrabold text-ink bg-manila/95 px-2.5 py-0.5 rounded-full border border-ink/40 mt-2">
            السحب
          </span>
        </div>

        {/* Archive / Discard Pile */}
        <div className="flex flex-col items-center gap-0.5">
          {discardPileTop ? (
            <div
              className="relative group cursor-pointer transition-transform hover:scale-105"
              onPointerEnter={(e) => {
                if (e.pointerType !== 'touch') {
                  setHoveredPreview({
                    cardType: discardPileTop.cardType,
                    badgeText: `أعلى الأرشيف (${discardPileCount})`,
                    statusText: 'آخر كارت اترمى في الأرشيف',
                  });
                }
              }}
              onPointerLeave={() => setHoveredPreview(null)}
              onClick={() => setInspectedCard(discardPileTop.cardType)}
            >
              <CardComponent cardType={discardPileTop.cardType} size="sm" />
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 z-20 bg-ink/95 text-white text-[11px] font-cairo font-extrabold px-2 py-0 rounded-full border border-manila shadow-sm whitespace-nowrap">
                {discardPileCount}
              </div>
            </div>
          ) : (
            <div className="w-20 aspect-[3/4] rounded-lg border-2 border-dashed border-ink/35 bg-manila/60 flex items-center justify-center p-2 text-center">
              <span className="text-[11px] font-cairo font-bold text-ink/60">الأرشيف فاضي</span>
            </div>
          )}
          <span className="text-[11px] font-cairo font-extrabold text-ink bg-manila/95 px-2.5 py-0.5 rounded-full border border-ink/40 mt-2">
            الأرشيف
          </span>
        </div>
      </div>

      {/* Waiting Reaction Banner for Non-Target Players */}
      <AnimatePresence>
        {showWaitingReactionBanner && pendingReaction && (
          <motion.div
            key="waiting-reaction"
            initial={{ opacity: 0, scale: 0.9, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex items-center gap-1.5 bg-defense-blue text-white px-3 py-1 rounded-full border-2 border-ink shadow-retro-sm text-[11px] font-cairo font-bold text-center"
            dir="rtl"
          >
            <Hourglass size={13} className="animate-spin flex-shrink-0" />
            <span>
              في انتظار {pendingReaction.targetName} ({Math.ceil(reactionSecondsLeft)} ث)
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Effect Pill: Medhat Vacation */}
      <AnimatePresence>
        {isMedhatActive && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            onPointerEnter={(e) => {
              if (e.pointerType !== 'touch') {
                setHoveredPreview({
                  cardType: 'medhat_vacation',
                  badgeText: 'تأثير عام على الترابيزة',
                  statusText: 'ممنوع إمضاء المدير لفة كاملة',
                  isError: true,
                });
              }
            }}
            onPointerLeave={() => setHoveredPreview(null)}
            onClick={() => setInspectedCard('medhat_vacation')}
            className="cursor-pointer bg-manila border-2 border-prank-red text-prank-red px-3 py-0.5 rounded-full shadow-retro-sm text-[11px] font-cairo font-extrabold text-center"
          >
            🏖️ مدحت في إجازة (ممنوع الإمضاء)
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live Explained Event Story Card */}
      <AnimatePresence mode="wait">
        {lastEvent && (
          <motion.div
            key={lastEvent.id}
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.95 }}
            transition={{ duration: 0.22 }}
            onClick={() => setInspectedCard(lastEvent.cardType)}
            className={`w-full max-w-[290px] cursor-pointer flex items-center gap-2 px-2.5 py-1.5 rounded-xl border-2 shadow-retro-sm bg-manila/95 ${
              lastEvent.blocked
                ? 'border-defense-blue'
                : lastEvent.targetId === myId
                ? 'border-prank-red ring-2 ring-prank-red/25'
                : isMeInvolved
                ? 'border-doc-green'
                : 'border-ink/70'
            }`}
            dir="rtl"
          >
            <img
              src={getCardImage(lastEvent.cardType)}
              alt={CARD_DEFINITIONS[lastEvent.cardType].nameAr}
              className="w-8 h-11 rounded border border-ink object-cover flex-shrink-0"
            />
            <div className="flex-1 min-w-0 text-right leading-snug">
              <p className="text-[11px] font-cairo font-black text-ink">
                {lastEvent.headlineAr}
              </p>
              <p className="text-[10.5px] font-cairo font-bold text-ink/80 mt-0.5 leading-snug">
                {lastEvent.explanationAr}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tap-to-inspect Modal */}
      <AnimatePresence>
        {inspectedCard && (
          <motion.div
            className="absolute inset-0 z-50 flex items-center justify-center bg-ink/70 backdrop-blur-sm p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setInspectedCard(null)}
          >
            <motion.div
              className="relative flex flex-col items-center gap-3 bg-manila p-5 rounded-2xl border-2 border-ink shadow-retro-lg max-w-xs w-full"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              onClick={e => e.stopPropagation()}
              dir="rtl"
            >
              <button
                onClick={() => setInspectedCard(null)}
                className="absolute top-3 left-3 w-8 h-8 rounded-full bg-white border-2 border-ink flex items-center justify-center"
              >
                <X size={16} />
              </button>
              <CardComponent cardType={inspectedCard} size="lg" />
              <div className="text-center">
                <p className="font-cairo font-black text-base text-ink">{CARD_DEFINITIONS[inspectedCard].nameAr}</p>
                <p className="font-cairo text-xs text-ink/75 mt-1">{CARD_DEFINITIONS[inspectedCard].descriptionAr}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
