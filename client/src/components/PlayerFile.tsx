// ========================
// EL-KHETM — Player Bottom Seat (Highlights + Tampered Memory Warnings + Immunity + Stickers)
// ========================

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Snowflake, MessageSquare, Eye, ShieldAlert, Shield, AlertTriangle } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { useSocket } from '../hooks/useSocket';
import {
  CARD_DEFINITIONS,
  MEME_STICKERS,
  SLOT_LABELS_AR,
  AVATAR_LABELS,
} from '@el-khetm/shared';
import type { AvatarId } from '@el-khetm/shared';
import { getAvatarImage, getAvatarFallback, getStickerImage } from '../config/assets';
import { FlipCard } from './Card';

export const PlayerFile: React.FC = () => {
  const { socket } = useSocket();
  const {
    publicState,
    privateState,
    myPlayerId,
    activeStickers,
    interactionMode,
    setInteractionMode,
    startPeek,
    placeInSlot,
    matchArchive,
    openModal,
  } = useGameStore();

  const [myBubble, setMyBubble] = useState<string | null>(null);

  const myId = privateState?.playerId || myPlayerId || '';
  const lastEvent = publicState?.lastEvent ?? null;
  const mySticker = myId ? activeStickers[myId] : null;
  const stickerMeta = mySticker ? MEME_STICKERS.find(s => s.id === mySticker.stickerId) : null;
  const activePeek = privateState?.activePeek ?? null;
  const activeMultiPeek = privateState?.activeMultiPeek ?? null;
  const mySeenSlots = privateState?.seenSlotsByPlayer?.[myId] ?? [];
  const myTamperedSlots = privateState?.tamperedSlotsByPlayer?.[myId] ?? [];
  const startPeeksRemaining = privateState?.startPeeksRemaining ?? 0;

  useEffect(() => {
    if (!lastEvent || !myId) return;
    let msg: string | null = null;
    if (lastEvent.targetId === myId && lastEvent.bubbleTargetAr) {
      msg = lastEvent.bubbleTargetAr;
    } else if (lastEvent.actorId === myId && lastEvent.bubbleActorAr) {
      msg = lastEvent.bubbleActorAr;
    }
    if (!msg) return;
    setMyBubble(msg);
    const t = setTimeout(() => setMyBubble(null), 3400);
    return () => clearTimeout(t);
  }, [lastEvent?.id, myId]);

  if (!publicState) return null;

  const myPlayer = publicState.players.find(p => p.id === myId);
  if (!myPlayer) return null;

  const isPeekStart = publicState.phase === 'PEEK_START' && startPeeksRemaining > 0;
  const isGameOver = publicState.phase === 'GAME_OVER';
  const isMyTurnAction =
    publicState.phase === 'ACTION_PHASE' && publicState.currentTurnPlayerId === myId;

  const myHighlights = (publicState.recentSlotHighlights ?? []).filter(
    h => h.playerId === myId && h.expiresAt > Date.now(),
  );

  const handleSlotTap = (slotIndex: number, hasCard: boolean) => {
    if (isPeekStart && hasCard && !mySeenSlots.includes(slotIndex)) {
      startPeek(socket, slotIndex);
      return;
    }
    if (!isMyTurnAction || !interactionMode) return;

    if (interactionMode.type === 'place_in_slot') {
      placeInSlot(socket, interactionMode.handCard.instanceId, slotIndex);
      return;
    }
    if (interactionMode.type === 'match_archive') {
      if (!hasCard) return;
      matchArchive(socket, slotIndex);
      return;
    }
    if (interactionMode.type === 'pick_own_slot') {
      if (interactionMode.purpose === 'desk_swap' && !hasCard) return;
      const { card, burnCardInstanceId } = interactionMode;
      setInteractionMode(null);
      openModal('target', {
        cardInstanceId: card.instanceId,
        cardType: card.cardType,
        ownSlotIndex: slotIndex,
        burnCardInstanceId,
      });
    }
  };

  const promptText = interactionMode?.type === 'place_in_slot'
    ? `🗂️ اضغط على خانة (١–٤) عشان تنزّل «${CARD_DEFINITIONS[interactionMode.handCard.cardType].nameAr}» سراً`
    : interactionMode?.type === 'match_archive'
    ? '🎯 اضغط على الخانة اللي فاكر فيها نفس كارت الأرشيف!'
    : interactionMode?.type === 'pick_own_slot'
    ? `🔁 اختار الأول الخانة من ملفك اللي هتستخدمها في «${CARD_DEFINITIONS[interactionMode.card.cardType].nameAr}»`
    : null;

  return (
    <div className="relative w-full flex flex-col items-center gap-[clamp(2px,0.4dvh,5px)] px-2 py-[clamp(3px,0.6dvh,6px)] bg-[#EFE6D2]/92 rounded-2xl border-2 border-ink shadow-retro-sm">
      {/* Compact Sticker tucked neatly above corner */}
      <AnimatePresence>
        {mySticker && (
          <motion.div
            key={`my-sticker-${mySticker.timestamp}`}
            initial={{ opacity: 0, scale: 0.4, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.4 }}
            transition={{ type: 'spring', stiffness: 420, damping: 20 }}
            className="absolute -top-11 left-2 z-30 pointer-events-none bg-white border-2 border-ink rounded-xl shadow-retro-sm px-1.5 py-1 flex items-center gap-1.5"
          >
            <img
              src={getStickerImage(mySticker.stickerId)}
              alt={stickerMeta?.labelAr || 'ميم'}
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg object-contain bg-white"
            />
            {stickerMeta && (
              <span className="text-[10px] font-cairo font-black text-ink whitespace-nowrap">
                {stickerMeta.labelAr}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Speech Bubble */}
      <AnimatePresence>
        {myBubble && !mySticker && (
          <div className="absolute -top-6 inset-x-0 z-30 flex justify-center pointer-events-none">
            <motion.div
              key={myBubble}
              initial={{ opacity: 0, scale: 0.75, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.75 }}
              className="whitespace-nowrap bg-white text-ink text-[10.5px] font-cairo font-black px-3 py-0.5 rounded-full border-2 border-ink shadow-retro-sm"
            >
              {myBubble}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Interactive Slot Action Prompt Banner */}
      <AnimatePresence>
        {promptText && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="w-full flex items-center justify-between gap-2 bg-wasta-gold text-ink px-2.5 py-0.5 rounded-xl border-2 border-ink shadow-sm text-[10.5px] font-cairo font-black"
          >
            <span className="truncate">{promptText}</span>
            {interactionMode && (
              <button
                onClick={() => setInteractionMode(null)}
                className="bg-white px-2 py-0.5 rounded-lg border border-ink text-[9.5px] hover:bg-manila flex-shrink-0"
              >
                إلغاء
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Strip */}
      <div className="w-full flex items-center justify-between text-xs font-cairo font-bold px-0.5 gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full overflow-hidden border border-ink bg-white flex-shrink-0">
            <img
              src={getAvatarImage(myPlayer.avatarId as AvatarId)}
              alt={myPlayer.name}
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).src = getAvatarFallback(myPlayer.name); }}
            />
          </div>
          <span className="text-[11px] sm:text-xs text-ink font-black truncate">
            ملف {myPlayer.name}
          </span>
          <span className="text-[9.5px] font-cairo font-bold text-ink/60 bg-white/75 px-1.5 py-0 rounded-full border border-ink/20">
            {AVATAR_LABELS[myPlayer.avatarId as AvatarId]}
          </span>
          {myPlayer.matchScore !== 0 && (
            <span
              className={`text-[9.5px] px-1.5 rounded-full font-black ${
                myPlayer.matchScore > 0 ? 'bg-doc-green/15 text-doc-green' : 'bg-prank-red/15 text-prank-red'
              }`}
            >
              جرد: {myPlayer.matchScore > 0 ? `+${myPlayer.matchScore}` : myPlayer.matchScore}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {myPlayer.isImmuneThisRound && (
            <span
              className="flex items-center gap-0.5 bg-defense-blue text-white px-1.5 py-0.5 rounded-full text-[9px] font-black"
              title="محصّن ضد المقالب لحد ما ييجي دورك"
            >
              <Shield size={9} />
              محصّن
            </span>
          )}
          {myPlayer.isFrozen && (
            <span className="flex items-center gap-0.5 bg-prank-red text-white px-1.5 py-0.5 rounded-full text-[9px] animate-pulse">
              <Snowflake size={9} />
              متجمد!
            </span>
          )}
          <button
            onClick={() => openModal('stickers')}
            className="flex items-center gap-1 bg-[#FBBF24] text-ink px-2 py-0.5 rounded-full border-2 border-ink shadow-retro-sm active:shadow-none text-[10px] font-cairo font-black hover:bg-[#F59E0B] transition-colors"
          >
            <MessageSquare size={11} />
            <span>استيكر</span>
          </button>
        </div>
      </div>

      {/* Responsive 4-Card Dossier with Tampered & Highlight Indicators */}
      <div className="flex items-center justify-center gap-[clamp(6px,2.2vw,14px)] w-full py-0.5">
        {myPlayer.dossierSlots.map((slot, idx) => {
          const singleMatch = activePeek?.targetPlayerId === myId && activePeek.slotIndex === idx;
          const multiMatch = activeMultiPeek?.find(m => m.targetPlayerId === myId && m.slotIndex === idx);
          const revealedCardType = isGameOver
            ? slot.revealedCard?.cardType
            : singleMatch
            ? activePeek?.card.cardType
            : multiMatch?.card.cardType ?? null;
          const isRevealed = Boolean(revealedCardType);
          const wasSeen = mySeenSlots.includes(idx);
          const wasTampered = myTamperedSlots.includes(idx);
          const slotHighlight = myHighlights.find(h => h.slotIndex === idx);

          const isSlotSelectable = Boolean(
            (isPeekStart && slot.hasCard && !wasSeen) ||
              (isMyTurnAction && interactionMode?.type === 'place_in_slot') ||
              (isMyTurnAction && interactionMode?.type === 'match_archive' && slot.hasCard) ||
              (isMyTurnAction &&
                interactionMode?.type === 'pick_own_slot' &&
                (interactionMode.purpose === 'wasta' ? true : slot.hasCard)),
          );

          const slotSize = 'w-[clamp(52px,15.5vw,72px)] aspect-[3/4]';

          return (
            <motion.div
              key={`my-slot-${idx}`}
              animate={slotHighlight ? { scale: [1, 1.1, 1], rotate: [0, -4, 4, 0] } : {}}
              transition={{ duration: 0.45 }}
              className="flex flex-col items-center gap-0.5 relative"
            >
              {slot.hasCard ? (
                <div className="relative">
                  <FlipCard
                    cardType={revealedCardType}
                    isRevealed={isRevealed}
                    isHighlighted={singleMatch || Boolean(multiMatch) || isSlotSelectable || Boolean(slotHighlight)}
                    sizeClass={slotSize}
                    onClick={
                      isSlotSelectable
                        ? () => handleSlotTap(idx, slot.hasCard)
                        : undefined
                    }
                  >
                    {wasSeen && !isRevealed && !wasTampered && (
                      <span
                        className="absolute bottom-1 left-1 bg-defense-blue/90 text-white rounded-full p-0.5 border border-white z-20"
                        title="سبق وشفت أو نزّلت الكارت ده"
                      >
                        <Eye size={9} />
                      </span>
                    )}
                    {wasTampered && !isRevealed && (
                      <span
                        className="absolute bottom-1 left-1 bg-wasta-gold text-ink rounded-full p-0.5 border border-ink z-20 animate-pulse"
                        title="الخانة دي اتبدلت من وراك!"
                      >
                        <AlertTriangle size={9} />
                      </span>
                    )}
                  </FlipCard>
                  {isSlotSelectable && (
                    <span className="pointer-events-none absolute -top-2 right-0.5 bg-doc-green text-white text-[8.5px] font-cairo font-black px-1.5 rounded-full border border-ink animate-bounce z-30">
                      اختار
                    </span>
                  )}
                  {slotHighlight && !isSlotSelectable && (
                    <span
                      className={`pointer-events-none absolute -top-2 inset-x-0 mx-auto w-max px-1.5 py-0 rounded-full text-[8.5px] font-cairo font-black border border-ink shadow-sm z-30 animate-bounce ${
                        slotHighlight.kind === 'removed'
                          ? 'bg-prank-red text-white'
                          : slotHighlight.kind === 'peeked'
                          ? 'bg-defense-blue text-white'
                          : 'bg-wasta-gold text-ink'
                      }`}
                    >
                      {slotHighlight.labelAr}
                    </span>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  disabled={!isSlotSelectable}
                  onClick={() => isSlotSelectable && handleSlotTap(idx, false)}
                  className={`${slotSize} rounded-lg border-2 border-dashed flex flex-col items-center justify-center p-1 transition-all ${
                    isSlotSelectable
                      ? 'border-wasta-gold bg-wasta-gold/20 ring-2 ring-wasta-gold animate-pulse cursor-pointer'
                      : slotHighlight
                      ? 'border-prank-red bg-prank-red/15 ring-2 ring-prank-red'
                      : 'border-ink/30 bg-white/50 cursor-default'
                  }`}
                >
                  <ShieldAlert size={13} className="text-ink/30 mb-0.5" />
                  <span className="text-[9.5px] font-cairo font-bold text-ink/50">فاضية</span>
                </button>
              )}
              <span className="text-[9.5px] font-cairo font-extrabold text-ink/75">
                {SLOT_LABELS_AR[idx]}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
