// ========================
// EL-KHETM — Opponent Seat Around the Table (9:16 Skrew-Inspired Seating)
// ========================

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Snowflake, WifiOff, Bot } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { getAvatarImage, getAvatarFallback, getCardBack, getCardImage, getStickerImage } from '../config/assets';
import { CORE_DOCUMENTS, CARD_DEFINITIONS, MEME_STICKERS } from '@el-khetm/shared';
import type { AvatarId, PublicPlayer, GameEventNotice } from '@el-khetm/shared';

interface OpponentSeatProps {
  player: PublicPlayer;
  isCurrentTurn: boolean;
  position: 'top' | 'left' | 'right';
  lastEvent: GameEventNotice | null;
}

export const OpponentSeat: React.FC<OpponentSeatProps> = ({
  player,
  isCurrentTurn,
  position,
  lastEvent,
}) => {
  const { setHoveredPreview, activeStickers } = useGameStore();
  const [activeBubble, setActiveBubble] = useState<string | null>(null);
  const activeSticker = activeStickers[player.id] ?? null;

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
    const t = setTimeout(() => setActiveBubble(null), 3500);
    return () => clearTimeout(t);
  }, [lastEvent?.id, player.id]);

  const isSide = position === 'left' || position === 'right';
  const maxVisibleBacks = isSide ? 5 : 6;
  const visibleBackCount = Math.min(player.handCount, maxVisibleBacks);
  const stickerMeta = activeSticker ? MEME_STICKERS.find(s => s.id === activeSticker.stickerId) : null;

  return (
    <div
      className={`relative flex flex-col items-center gap-1 select-none ${
        isSide ? 'w-[78px]' : 'max-w-[290px]'
      }`}
      dir="rtl"
    >
      {/* Meme Sticker Comic Bubble (opens clearly in open space without Framer translate conflicts) */}
      <AnimatePresence>
        {activeSticker && (
          <div
            className={`absolute z-30 pointer-events-none flex ${
              position === 'top'
                ? 'top-full mt-1 inset-x-0 justify-center'
                : position === 'right'
                ? 'bottom-full mb-1 right-0'
                : 'bottom-full mb-1 left-0'
            }`}
          >
            <motion.div
              key={`sticker-${activeSticker.timestamp}`}
              initial={{ opacity: 0, scale: 0.4, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.4 }}
              transition={{ type: 'spring', stiffness: 420, damping: 20 }}
              className="bg-white border-2 border-ink rounded-2xl shadow-retro p-1 flex flex-col items-center"
            >
              <img
                src={getStickerImage(activeSticker.stickerId)}
                alt={stickerMeta?.labelAr || 'ميم'}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-contain bg-white"
              />
              {stickerMeta && (
                <span className="text-[10px] font-cairo font-black text-ink px-1 whitespace-nowrap">
                  {stickerMeta.labelAr}
                </span>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Action Speech Bubble (never truncated or overlapping Deck/Archive) */}
      <AnimatePresence>
        {activeBubble && !activeSticker && (
          <div
            className={`absolute z-30 pointer-events-none flex ${
              position === 'top'
                ? 'top-full mt-1 inset-x-0 justify-center'
                : position === 'right'
                ? 'bottom-full mb-1 right-0'
                : 'bottom-full mb-1 left-0'
            }`}
          >
            <motion.div
              key={activeBubble}
              initial={{ opacity: 0, scale: 0.7, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.7 }}
              className="whitespace-nowrap bg-white text-ink text-[10px] sm:text-[11px] font-cairo font-black px-2.5 py-0.5 rounded-full border-2 border-ink shadow-retro-sm"
            >
              {activeBubble}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Player Avatar + Name Badge (stacked for side seats so full name is never cut to 1 letter) */}
      <motion.div
        animate={player.isFrozen ? { scale: [1, 0.97, 1] } : {}}
        className={`flex items-center px-2 py-1 rounded-xl border-2 transition-all w-full justify-center ${
          isSide ? 'flex-col gap-0.5' : 'gap-1.5'
        } ${
          isCurrentTurn
            ? 'border-doc-green bg-white shadow-retro ring-2 ring-doc-green/45'
            : 'border-ink bg-manila/95 shadow-retro-sm'
        } ${player.isFrozen ? 'ring-2 ring-defense-blue bg-blue-50/90' : ''}`}
      >
        <div className="relative flex-shrink-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden border border-ink bg-white">
            <img
              src={getAvatarImage(player.avatarId as AvatarId)}
              alt={player.name}
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).src = getAvatarFallback(player.name); }}
            />
          </div>
          {isCurrentTurn && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-doc-green border border-white animate-ping" />
          )}
          {player.isFrozen && (
            <span className="absolute -bottom-1 -right-1 bg-defense-blue text-white rounded-full p-0.5 border border-white">
              <Snowflake size={9} />
            </span>
          )}
          {!player.isFrozen && player.isDisconnected && (
            <span className="absolute -bottom-1 -right-1 bg-prank-red text-white rounded-full p-0.5 border border-white">
              <WifiOff size={9} />
            </span>
          )}
          {!player.isFrozen && !player.isDisconnected && player.isBot && (
            <span className="absolute -bottom-1 -right-1 bg-manila border border-ink/50 text-ink rounded-full p-0.5">
              <Bot size={8} />
            </span>
          )}
        </div>

        <div className={`flex flex-col min-w-0 leading-tight ${isSide ? 'w-full items-center text-center' : ''}`}>
          <span className="text-[11px] font-cairo font-extrabold text-ink truncate max-w-full">
            {player.name}
          </span>
          <span className="text-[9.5px] font-cairo font-bold text-ink/70 whitespace-nowrap">
            {player.isFrozen ? '❄️ متجمد' : isCurrentTurn ? 'يلعب الآن' : `${player.file.length}/4`}
          </span>
        </div>
      </motion.div>

      {/* Face-Down Cards + Public File (Top sits side-by-side compactly so it never overlaps Deck) */}
      {isSide ? (
        <>
          <div className="flex flex-col items-center gap-0.5 relative py-0.5" title={`كروت ${player.name}: ${player.handCount}`}>
            {player.handCount > 0 ? (
              <>
                <div className="flex flex-col items-center">
                  {Array.from({ length: visibleBackCount }).map((_, idx) => (
                    <div
                      key={idx}
                      className="w-14 h-9 rounded-md border border-ink shadow-sm overflow-hidden bg-[#5C1221] flex items-center justify-center relative"
                      style={{
                        marginTop: idx === 0 ? 0 : -11,
                        zIndex: idx + 1,
                      }}
                    >
                      <img
                        src={getCardBack()}
                        alt=""
                        className="h-14 w-9 object-cover rotate-90 flex-shrink-0"
                        draggable={false}
                      />
                    </div>
                  ))}
                </div>
                <span className="bg-ink text-white text-[10px] font-cairo font-extrabold px-2 py-0 rounded-full border border-manila shadow-sm">
                  {player.handCount}
                </span>
              </>
            ) : (
              <span className="text-[9.5px] font-cairo font-bold text-ink/65 bg-manila/80 px-2 py-0.5 rounded">0</span>
            )}
          </div>

          <div className="flex items-center justify-center gap-0.5 bg-manila/90 px-1 py-0.5 rounded-md border border-ink/35 shadow-sm">
            {CORE_DOCUMENTS.map(doc => {
              const hasDoc = player.file.includes(doc);
              const docDef = CARD_DEFINITIONS[doc];
              return (
                <div
                  key={doc}
                  onPointerEnter={(e) => {
                    if (e.pointerType !== 'touch' && hasDoc) {
                      setHoveredPreview({
                        cardType: doc,
                        badgeText: `ملف ${player.name}`,
                        statusText: 'ورقة مكشوفة في ملفه',
                        isError: false,
                      });
                    }
                  }}
                  onPointerLeave={() => setHoveredPreview(null)}
                  className={`w-[1.1rem] h-6 rounded border overflow-hidden transition-transform ${
                    hasDoc
                      ? 'border-doc-green bg-white shadow-sm hover:scale-125 cursor-help'
                      : 'border-dashed border-ink/30 bg-white/45'
                  }`}
                  title={`${docDef.nameAr}${hasDoc ? ' ✓' : ' (ناقص)'}`}
                >
                  {hasDoc && (
                    <img
                      src={getCardImage(doc)}
                      alt={docDef.nameAr}
                      className="w-full h-full object-cover"
                      draggable={false}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center gap-2.5 py-0.5">
          {/* Card backs */}
          <div className="flex items-center justify-center relative" title={`كروت ${player.name}: ${player.handCount}`}>
            {player.handCount > 0 ? (
              <div className="flex items-center justify-center" dir="ltr">
                {Array.from({ length: visibleBackCount }).map((_, idx) => (
                  <div
                    key={idx}
                    className="w-9 sm:w-10 aspect-[3/4] rounded border border-ink shadow-sm overflow-hidden bg-[#5C1221] flex-shrink-0"
                    style={{
                      marginLeft: idx === 0 ? 0 : -11,
                      transform: `rotate(${(idx - (visibleBackCount - 1) / 2) * 2.5}deg)`,
                      zIndex: idx + 1,
                    }}
                  >
                    <img
                      src={getCardBack()}
                      alt=""
                      className="w-full h-full object-cover"
                      draggable={false}
                    />
                  </div>
                ))}
                <span className="mr-1 ml-1 bg-ink text-white text-[10px] font-cairo font-extrabold px-1.5 py-0 rounded-full border border-manila shadow-sm z-20">
                  {player.handCount}
                </span>
              </div>
            ) : (
              <span className="text-[10px] font-cairo font-bold text-ink/60 bg-manila/75 px-2 py-0.5 rounded">0 كارت</span>
            )}
          </div>

          {/* 4 Public Docs beside top hand */}
          <div className="flex items-center justify-center gap-1 bg-manila/90 px-1.5 py-1 rounded-lg border border-ink/35 shadow-sm">
            {CORE_DOCUMENTS.map(doc => {
              const hasDoc = player.file.includes(doc);
              const docDef = CARD_DEFINITIONS[doc];
              return (
                <div
                  key={doc}
                  onPointerEnter={(e) => {
                    if (e.pointerType !== 'touch' && hasDoc) {
                      setHoveredPreview({
                        cardType: doc,
                        badgeText: `ملف ${player.name}`,
                        statusText: 'ورقة مكشوفة في ملفه',
                        isError: false,
                      });
                    }
                  }}
                  onPointerLeave={() => setHoveredPreview(null)}
                  className={`w-5 h-7 sm:w-6 sm:h-8 rounded border overflow-hidden transition-transform ${
                    hasDoc
                      ? 'border-doc-green bg-white shadow-sm hover:scale-125 cursor-help'
                      : 'border-dashed border-ink/30 bg-white/45'
                  }`}
                  title={`${docDef.nameAr}${hasDoc ? ' ✓' : ' (ناقص)'}`}
                >
                  {hasDoc && (
                    <img
                      src={getCardImage(doc)}
                      alt={docDef.nameAr}
                      className="w-full h-full object-cover"
                      draggable={false}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
