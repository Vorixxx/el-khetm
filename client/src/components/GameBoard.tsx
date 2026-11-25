// ========================
// EL-KHETM — Game Board (Circular Table + Spotlight Pop-Out Card + Multi-Peek Strip)
// ========================

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { TopBarHUD } from './TopBarHUD';
import { OpponentSeat } from './OpponentSeat';
import { TableCenter } from './TableCenter';
import { PlayerFile } from './PlayerFile';
import { PlayerHand } from './PlayerHand';
import { FloatingCardPreview } from './FloatingCardPreview';
import { CardFlightLayer } from './CardFlightLayer';
import { Card as CardComponent } from './Card';
import { BACKGROUNDS } from '../config/assets';
import { CARD_DEFINITIONS } from '@el-khetm/shared';
import type { PublicPlayer } from '@el-khetm/shared';

interface SeatAssignment {
  top: PublicPlayer[];
  right: PublicPlayer | null;
  left: PublicPlayer | null;
}

function assignSeats(players: PublicPlayer[], myId: string): SeatAssignment {
  const myIndex = players.findIndex(p => p.id === myId);
  const rotatedOpponents: PublicPlayer[] = [];
  if (myIndex >= 0) {
    for (let offset = 1; offset < players.length; offset++) {
      rotatedOpponents.push(players[(myIndex + offset) % players.length]);
    }
  } else {
    rotatedOpponents.push(...players.filter(p => p.id !== myId));
  }

  const count = rotatedOpponents.length;
  if (count === 0) return { top: [], right: null, left: null };
  if (count === 1) return { top: [rotatedOpponents[0]], right: null, left: null };
  if (count === 2) return { top: [], right: rotatedOpponents[0], left: rotatedOpponents[1] };
  if (count === 3) {
    return {
      right: rotatedOpponents[0],
      top: [rotatedOpponents[1]],
      left: rotatedOpponents[2],
    };
  }
  if (count === 4) {
    return {
      right: rotatedOpponents[0],
      top: [rotatedOpponents[1], rotatedOpponents[2]],
      left: rotatedOpponents[3],
    };
  }
  return {
    right: rotatedOpponents[0],
    top: [rotatedOpponents[1], rotatedOpponents[2], rotatedOpponents[3]],
    left: rotatedOpponents[4],
  };
}

export const GameBoard: React.FC = () => {
  const { publicState, privateState, myPlayerId } = useGameStore();
  const [shieldFlash, setShieldFlash] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);

  const lastEvent = publicState?.lastEvent ?? null;
  useEffect(() => {
    if (lastEvent?.blocked) {
      setShieldFlash(true);
      const t = setTimeout(() => setShieldFlash(false), 750);
      return () => clearTimeout(t);
    }
  }, [lastEvent?.id, lastEvent?.blocked]);

  if (!publicState) return null;

  const myId = privateState?.playerId || myPlayerId || '';
  const seats = assignSeats(publicState.players, myId);
  const startPeeksLeft = privateState?.startPeeksRemaining ?? 0;

  return (
    <div
      ref={boardRef}
      className="h-full w-full flex flex-col justify-between overflow-hidden relative"
      style={{
        backgroundImage: `radial-gradient(ellipse at center, rgba(244,239,230,0.06) 35%, rgba(20,14,10,0.34) 100%), url('${BACKGROUNDS.table_mobile}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundColor: '#EBDCC0',
      }}
      dir="rtl"
    >
      {/* Glowing Circular Table Arena Ring */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-0">
        <div className="w-[88%] max-w-[540px] aspect-square -translate-y-4 rounded-full border-[3px] border-wasta-gold/65 shadow-[0_0_32px_rgba(245,158,11,0.3),inset_0_0_28px_rgba(30,41,59,0.16)] bg-ink/[0.04] relative">
          <div className="absolute inset-2.5 rounded-full border border-dashed border-ink/20" />
          <span className="compact-hide-short absolute -top-2.5 left-1/2 -translate-x-1/2 bg-manila/95 text-[9px] font-cairo font-extrabold text-ink px-2 py-0 rounded-full border border-wasta-gold/70 shadow-sm">
            ↻ اتجاه اللعب
          </span>
          <span className="compact-hide-short absolute -bottom-2.5 left-1/2 -translate-x-1/2 bg-manila/95 text-[9px] font-cairo font-extrabold text-ink px-2 py-0 rounded-full border border-wasta-gold/70 shadow-sm">
            اتجاه اللعب ↺
          </span>
        </div>
      </div>

      {/* Shield Flash */}
      <AnimatePresence>
        {shieldFlash && (
          <motion.div
            key="shield-flash"
            initial={{ opacity: 0.7, scale: 0.8 }}
            animate={{ opacity: 0, scale: 1.45 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center"
          >
            <div className="w-56 h-56 rounded-full border-8 border-defense-blue/75 bg-defense-blue/15" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top HUD */}
      <TopBarHUD />

      {/* Urgent Global Status Strip */}
      <AnimatePresence>
        {publicState.phase === 'PEEK_START' && (
          <PeekStartBanner
            startPeeksLeft={startPeeksLeft}
            peekStartExpiresAt={publicState.peekStartExpiresAt}
          />
        )}
      </AnimatePresence>

      {/* Top Opponent Seat(s) */}
      {seats.top.length > 0 && (
        <div className="flex-shrink-0 flex items-start justify-center gap-2 px-2 pt-0.5 z-10">
          {seats.top.map(opp => (
            <OpponentSeat
              key={opp.id}
              player={opp}
              position="top"
              isCurrentTurn={publicState.currentTurnPlayerId === opp.id}
              turnExpiresAt={publicState.turnExpiresAt}
              lastEvent={lastEvent}
            />
          ))}
        </div>
      )}

      {/* Middle Ring */}
      <div className="flex-1 min-h-0 w-full flex items-center justify-between gap-1 sm:gap-3 px-1 sm:px-4 z-10">
        <div className="flex-shrink-0 flex items-center justify-center">
          {seats.right && (
            <OpponentSeat
              player={seats.right}
              position="right"
              isCurrentTurn={publicState.currentTurnPlayerId === seats.right.id}
              turnExpiresAt={publicState.turnExpiresAt}
              lastEvent={lastEvent}
            />
          )}
        </div>

        <div className="flex-1 min-w-0 flex items-center justify-center">
          <TableCenter />
        </div>

        <div className="flex-shrink-0 flex items-center justify-center">
          {seats.left && (
            <OpponentSeat
              player={seats.left}
              position="left"
              isCurrentTurn={publicState.currentTurnPlayerId === seats.left.id}
              turnExpiresAt={publicState.turnExpiresAt}
              lastEvent={lastEvent}
            />
          )}
        </div>
      </div>

      {/* Bottom Seat */}
      <div className="flex-shrink-0 px-1.5 sm:px-2 pb-1 z-20">
        <PlayerFile />
      </div>

      {/* Bottom Hand */}
      <div className="flex-shrink-0 z-20 pb-1.5 px-1.5">
        <PlayerHand />
      </div>

      {/* Animated Card Flights Across Table */}
      <CardFlightLayer boardRef={boardRef} />

      {/* Center Pop-Out Spotlight Card */}
      <SpotlightCardOverlay />

      {/* Secret Peek Notification Pills */}
      <PeekSecretBanner />

      {/* Desktop Hover Preview */}
      <FloatingCardPreview />
    </div>
  );
};

const PeekStartBanner: React.FC<{ startPeeksLeft: number; peekStartExpiresAt: number | null }> = ({
  startPeeksLeft,
  peekStartExpiresAt,
}) => {
  const [peekSecondsLeft, setPeekSecondsLeft] = useState(0);

  useEffect(() => {
    if (!peekStartExpiresAt) {
      setPeekSecondsLeft(0);
      return;
    }
    const tick = () => setPeekSecondsLeft(Math.max(0, Math.ceil((peekStartExpiresAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [peekStartExpiresAt]);

  return (
    <motion.div
      key="peek-start-banner"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="mx-3 mb-0.5 z-20 flex items-center justify-between bg-defense-blue text-white px-3 py-1 rounded-full border-2 border-ink shadow-retro-sm text-[11px] sm:text-xs font-cairo font-extrabold"
    >
      <span className="flex items-center gap-1.5">
        <Eye size={13} className="animate-pulse" />
        {startPeeksLeft > 0
          ? `نظرة البداية: اضغط على ${startPeeksLeft} خانات في ملفك تحت واحفظهم!`
          : 'تمام! احفظ ورقك، الجيم هيبدأ حالاً...'}
      </span>
      <span className="bg-white text-ink px-2 py-0 rounded-full text-[10.5px] font-black">
        {peekSecondsLeft} ث
      </span>
    </motion.div>
  );
};

const SpotlightCardOverlay: React.FC = () => {
  const { publicState, activeModal } = useGameStore();
  const [visible, setVisible] = useState(false);
  const spotlight = publicState?.spotlightCard ?? null;

  useEffect(() => {
    if (!spotlight || spotlight.expiresAt <= Date.now()) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const ms = Math.max(0, spotlight.expiresAt - Date.now());
    const t = setTimeout(() => setVisible(false), ms);
    return () => clearTimeout(t);
  }, [spotlight?.id]);

  if (!spotlight || !visible || activeModal === 'reaction' || activeModal === 'gameover') {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        key={spotlight.id}
        initial={{ opacity: 0, scale: 0.55, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.65, y: -12 }}
        transition={{ type: 'spring', stiffness: 360, damping: 22 }}
        className="pointer-events-none absolute inset-x-0 top-[33%] z-30 flex flex-col items-center justify-center px-4"
        dir="rtl"
      >
        <div className="bg-ink/90 text-white rounded-2xl border-2 border-wasta-gold shadow-[0_12px_32px_rgba(0,0,0,0.45)] p-2.5 flex items-center gap-2.5 max-w-[290px]">
          <CardComponent cardType={spotlight.cardType} size="xs" />
          <div className="flex-1 min-w-0">
            <p className="font-cairo font-black text-xs text-wasta-gold truncate">
              {spotlight.headlineAr}
            </p>
            <p className="font-cairo font-bold text-[10.5px] text-white/90 leading-snug mt-0.5 line-clamp-2">
              {spotlight.subtitleAr}
            </p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

const PeekSecretBanner: React.FC = () => {
  const { privateState, publicState } = useGameStore();
  const activePeek = privateState?.activePeek ?? null;
  const activeMultiPeek = privateState?.activeMultiPeek ?? null;
  const [rem, setRem] = useState(0);

  useEffect(() => {
    const exp = activeMultiPeek?.[0]?.expiresAt ?? activePeek?.expiresAt;
    if (!exp) {
      setRem(0);
      return;
    }
    const tick = () => setRem(Math.max(0, Math.ceil((exp - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [activePeek, activeMultiPeek]);

  if (rem <= 0 || !publicState || publicState.phase === 'PEEK_START') return null;

  if (activeMultiPeek && activeMultiPeek.length > 0) {
    return (
      <AnimatePresence>
        <motion.div
          key="multi-peek-banner"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          className="absolute bottom-[clamp(270px,40dvh,360px)] inset-x-0 z-40 flex justify-center pointer-events-none px-3"
          dir="rtl"
        >
          <div className="bg-ink/95 text-white px-3 py-2 rounded-2xl border-2 border-wasta-gold shadow-retro-lg flex flex-col gap-1.5 max-w-[380px]">
            <div className="flex items-center justify-between gap-2 text-[11px] font-cairo font-black text-wasta-gold">
              <span>👀 وريني كده اللي معاك (تفتيش سري)</span>
              <span className="bg-white/20 text-white px-1.5 rounded-full text-[10px]">{rem}ث</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {activeMultiPeek.map(item => {
                const owner = publicState.players.find(p => p.id === item.targetPlayerId);
                return (
                  <div
                    key={`${item.targetPlayerId}-${item.slotIndex}`}
                    className="bg-white/10 px-2 py-1 rounded-xl border border-white/20 flex items-center gap-1.5"
                  >
                    <CardComponent cardType={item.card.cardType} size="xs" />
                    <div className="min-w-0 flex-1 text-[10px] font-cairo leading-tight">
                      <p className="text-white/80 font-bold truncate">
                        {owner?.id === privateState?.playerId ? 'ملفك' : owner?.name} (خانة {item.slotIndex + 1})
                      </p>
                      <p className="text-wasta-gold font-black truncate">
                        {CARD_DEFINITIONS[item.card.cardType].nameAr}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  if (!activePeek) return null;
  const owner = publicState.players.find(p => p.id === activePeek.targetPlayerId);
  const cardDef = CARD_DEFINITIONS[activePeek.card.cardType];

  return (
    <AnimatePresence>
      <motion.div
        key={`peek-banner-${activePeek.targetPlayerId}-${activePeek.slotIndex}`}
        initial={{ opacity: 0, y: 12, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12 }}
        className="absolute bottom-[clamp(270px,40dvh,360px)] inset-x-0 z-40 flex justify-center pointer-events-none px-4"
        dir="rtl"
      >
        <div className="bg-ink text-white px-3 py-2 rounded-2xl border-2 border-wasta-gold shadow-retro-lg flex items-center gap-2.5 text-xs font-cairo font-bold">
          <CardComponent cardType={activePeek.card.cardType} size="xs" />
          <div className="flex flex-col leading-tight">
            <span className="text-[10.5px] text-white/80">
              👁️ {owner?.id === privateState?.playerId ? 'ملفك' : owner?.name} — خانة {activePeek.slotIndex + 1}
            </span>
            <span className="text-sm text-wasta-gold font-black">{cardDef.nameAr}</span>
          </div>
          <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px] mr-1">{rem}ث</span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
