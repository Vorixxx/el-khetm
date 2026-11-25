// ========================
// EL-KHETM — Opponent Seat Around the Circular Table (Highlights + Anti-Spam Shield + Multi-Peek)
// ========================

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Snowflake, WifiOff, Bot, Eye, Shield, AlertTriangle } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { getAvatarImage, getAvatarFallback, getStickerImage } from '../config/assets';
import { MEME_STICKERS, AVATAR_LABELS } from '@el-khetm/shared';
import type { AvatarId, PublicPlayer, GameEventNotice } from '@el-khetm/shared';
import { FlipCard } from './Card';

interface OpponentSeatProps {
  player: PublicPlayer;
  isCurrentTurn: boolean;
  turnExpiresAt: number | null;
  position: 'top' | 'left' | 'right';
  lastEvent: GameEventNotice | null;
}

const TurnTimerPill: React.FC<{ expiresAt: number | null }> = ({ expiresAt }) => {
  const [turnSec, setTurnSec] = useState<number | null>(null);

  useEffect(() => {
    if (!expiresAt) {
      setTurnSec(null);
      return;
    }
    const tick = () => setTurnSec(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 350);
    return () => clearInterval(id);
  }, [expiresAt]);

  return (
    <span className="absolute -top-1.5 -right-1.5 bg-ink text-wasta-gold text-[8.5px] font-cairo font-black px-1 rounded-full border border-wasta-gold shadow-sm">
      {turnSec !== null ? turnSec : '●'}
    </span>
  );
};

export const OpponentSeat: React.FC<OpponentSeatProps> = React.memo(({
  player,
  isCurrentTurn,
  turnExpiresAt,
  position,
  lastEvent,
}) => {
  const activeSticker = useGameStore(s => s.activeStickers[player.id] ?? null);
  const privateState = useGameStore(s => s.privateState);
  const phase = useGameStore(s => s.publicState?.phase);
  const windowClosedByPlayerId = useGameStore(s => s.publicState?.windowClosedByPlayerId);
  const recentSlotHighlights = useGameStore(s => s.publicState?.recentSlotHighlights);
  const [activeBubble, setActiveBubble] = useState<string | null>(null);

  const activePeek = privateState?.activePeek ?? null;
  const activeMultiPeek = privateState?.activeMultiPeek ?? null;
  const seenList = privateState?.seenSlotsByPlayer?.[player.id] ?? [];
  const tamperedList = privateState?.tamperedSlotsByPlayer?.[player.id] ?? [];
  const isGameOver = phase === 'GAME_OVER';
  const highlights = (recentSlotHighlights ?? []).filter(
    h => h.playerId === player.id && h.expiresAt > Date.now(),
  );

  useEffect(() => {
    if (!lastEvent) return;
    let msg: string | null = null;
    if (lastEvent.targetId === player.id && lastEvent.bubbleTargetAr) {
      msg = lastEvent.bubbleTargetAr;
    } else if (lastEvent.actorId === player.id && lastEvent.bubbleActorAr) {
      msg = lastEvent.bubbleActorAr;
    }
    if (!msg) return;
    setActiveBubble(msg);
    const t = setTimeout(() => setActiveBubble(null), 3400);
    return () => clearTimeout(t);
  }, [lastEvent?.id, player.id]);

  const isSide = position === 'left' || position === 'right';
  const stickerMeta = activeSticker ? MEME_STICKERS.find(s => s.id === activeSticker.stickerId) : null;
  const isCloser = windowClosedByPlayerId === player.id;

  return (
    <div
      className={`relative flex flex-col items-center gap-0.5 select-none ${
        isSide ? 'w-[clamp(58px,16.5vw,82px)]' : 'max-w-[290px]'
      }`}
      dir="rtl"
    >
      {/* Compact Sticker Badge anchored cleanly at avatar corner */}
      <AnimatePresence>
        {activeSticker && (
          <div
            className={`absolute z-30 pointer-events-none flex ${
              position === 'top'
                ? 'top-0 -left-12 sm:-left-14'
                : position === 'right'
                ? '-top-3 right-0'
                : '-top-3 left-0'
            }`}
          >
            <motion.div
              key={`sticker-${activeSticker.timestamp}`}
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.4 }}
              transition={{ type: 'spring', stiffness: 420, damping: 20 }}
              className="bg-white border-2 border-ink rounded-xl shadow-retro-sm p-1 flex flex-col items-center"
            >
              <img
                src={getStickerImage(activeSticker.stickerId)}
                alt={stickerMeta?.labelAr || 'ميم'}
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-lg object-contain bg-white"
              />
              {stickerMeta && (
                <span className="text-[8.5px] font-cairo font-black text-ink px-0.5 whitespace-nowrap leading-tight">
                  {stickerMeta.labelAr}
                </span>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Action Speech Bubble */}
      <AnimatePresence>
        {activeBubble && !activeSticker && (
          <div
            className={`absolute z-30 pointer-events-none flex ${
              position === 'top'
                ? 'top-full mt-0.5 inset-x-0 justify-center'
                : position === 'right'
                ? 'bottom-full mb-0.5 right-0'
                : 'bottom-full mb-0.5 left-0'
            }`}
          >
            <motion.div
              key={activeBubble}
              initial={{ opacity: 0, scale: 0.7, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.7 }}
              className="whitespace-nowrap bg-white text-ink text-[9.5px] font-cairo font-black px-2 py-0.5 rounded-full border-2 border-ink shadow-retro-sm"
            >
              {activeBubble}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Avatar + Name + Turn / Immunity Badge */}
      <motion.div
        animate={player.isFrozen ? { scale: [1, 0.96, 1] } : {}}
        className={`flex items-center px-1.5 py-0.5 rounded-xl border-2 transition-all w-full justify-center ${
          isSide ? 'flex-col gap-0.5' : 'gap-1.5'
        } ${
          isCurrentTurn
            ? 'border-wasta-gold bg-white shadow-retro ring-2 ring-wasta-gold/55'
            : isCloser
            ? 'border-prank-red bg-white shadow-retro-sm ring-2 ring-prank-red/35'
            : player.isImmuneThisRound
            ? 'border-defense-blue bg-blue-50/90 shadow-retro-sm'
            : 'border-ink bg-manila/95 shadow-retro-sm'
        } ${player.isFrozen ? 'ring-2 ring-defense-blue bg-blue-50/90' : ''}`}
      >
        <div className="relative flex-shrink-0">
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full overflow-hidden border border-ink bg-white">
            <img
              src={getAvatarImage(player.avatarId as AvatarId)}
              alt={player.name}
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).src = getAvatarFallback(player.name); }}
            />
          </div>
          {isCurrentTurn && <TurnTimerPill expiresAt={turnExpiresAt} />}
          {player.isImmuneThisRound && !isCurrentTurn && (
            <span
              className="absolute -top-1.5 -left-1.5 bg-defense-blue text-white rounded-full p-0.5 border border-white shadow-sm"
              title="محصّن من المقالب لحد ما ييجي دوره"
            >
              <Shield size={8} />
            </span>
          )}
          {player.isFrozen && (
            <span className="absolute -bottom-1 -right-1 bg-defense-blue text-white rounded-full p-0.5 border border-white">
              <Snowflake size={8} />
            </span>
          )}
          {!player.isFrozen && player.isDisconnected && (
            <span className="absolute -bottom-1 -right-1 bg-prank-red text-white rounded-full p-0.5 border border-white">
              <WifiOff size={8} />
            </span>
          )}
          {!player.isFrozen && !player.isDisconnected && player.isBot && (
            <span className="absolute -bottom-1 -right-1 bg-manila border border-ink/50 text-ink rounded-full p-0.5">
              <Bot size={7} />
            </span>
          )}
        </div>

        <div className={`flex flex-col min-w-0 leading-tight ${isSide ? 'w-full items-center text-center' : ''}`}>
          <span className="text-[10px] font-cairo font-extrabold text-ink truncate max-w-full">
            {player.name}
          </span>
          <div className="flex items-center gap-0.5 text-[8.5px] font-cairo font-bold text-ink/70 whitespace-nowrap">
            <span>🃏{player.handCount}</span>
            <span>·</span>
            <span>
              {isCloser
                ? '🚨قفل'
                : player.isFrozen
                ? '❄️'
                : player.isImmuneThisRound
                ? '🛡️محصّن'
                : AVATAR_LABELS[player.avatarId as AvatarId] || 'لاعب'}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Responsive 4-Card Dossier with Live Change Highlights */}
      <div
        className={
          isSide
            ? 'flex flex-col items-center gap-[clamp(2px,0.4dvh,4px)] py-0.5'
            : 'flex items-center justify-center gap-1 py-0.5'
        }
      >
        {player.dossierSlots.map((slot, idx) => {
          const singleMatch = activePeek?.targetPlayerId === player.id && activePeek.slotIndex === idx;
          const multiMatch = activeMultiPeek?.find(m => m.targetPlayerId === player.id && m.slotIndex === idx);
          const revealedCardType = isGameOver
            ? slot.revealedCard?.cardType
            : singleMatch
            ? activePeek?.card.cardType
            : multiMatch?.card.cardType ?? null;
          const isRevealed = Boolean(revealedCardType);
          const wasSeenByMe = seenList.includes(idx);
          const wasTampered = tamperedList.includes(idx);
          const slotHighlight = highlights.find(h => h.slotIndex === idx);

          const slotClass = isSide
            ? 'w-[clamp(42px,12.5vw,56px)] h-[clamp(28px,4.1dvh,38px)]'
            : 'w-[clamp(36px,10.5vw,48px)] aspect-[3/4]';

          return (
            <motion.div
              key={`slot-${idx}`}
              animate={slotHighlight ? { scale: [1, 1.14, 1], rotate: [0, -5, 5, 0] } : {}}
              transition={{ duration: 0.45 }}
              className="relative"
            >
              {!slot.hasCard ? (
                <div
                  className={`${slotClass} rounded-md border border-dashed ${
                    slotHighlight ? 'border-prank-red bg-prank-red/20 ring-2 ring-prank-red' : 'border-ink/30 bg-manila/40'
                  } flex items-center justify-center`}
                >
                  <span className="text-[8px] font-cairo font-bold text-ink/40">#{idx + 1}</span>
                </div>
              ) : (
                <FlipCard
                  cardType={revealedCardType}
                  isRevealed={isRevealed}
                  horizontalSide={isSide}
                  isHighlighted={singleMatch || Boolean(multiMatch) || Boolean(slotHighlight)}
                  sizeClass={slotClass}
                >
                  <span className="absolute top-0.5 right-0.5 bg-ink/80 text-white text-[7.5px] font-cairo font-black px-1 rounded pointer-events-none z-20">
                    {idx + 1}
                  </span>
                  {wasSeenByMe && !isRevealed && !wasTampered && (
                    <span
                      className="absolute bottom-0.5 left-0.5 bg-defense-blue text-white rounded-full p-0.5 border border-white z-20"
                      title="سبق وشفت الخانة دي"
                    >
                      <Eye size={7} />
                    </span>
                  )}
                  {wasTampered && !isRevealed && (
                    <span
                      className="absolute bottom-0.5 left-0.5 bg-wasta-gold text-ink rounded-full p-0.5 border border-ink z-20"
                      title="اتبدلت — مش نفس الورقة القديمة!"
                    >
                      <AlertTriangle size={7} />
                    </span>
                  )}
                </FlipCard>
              )}

              {/* Live Highlight Label Pill (🔁 اتبدلت / 🤝 اتسرقت / 💥 اتشالت) */}
              {slotHighlight && (
                <span
                  className={`pointer-events-none absolute -top-2 inset-x-0 mx-auto w-max px-1 py-0 rounded-full text-[7.5px] font-cairo font-black border border-ink shadow-sm z-30 animate-bounce ${
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
            </motion.div>
          );
        })}
      </div>
    </div>
  );
});
