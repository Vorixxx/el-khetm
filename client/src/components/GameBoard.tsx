// ========================
// EL-KHETM — Game Board (9:16 Portrait Card Table Around Parchment Desk)
// ========================

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/useGameStore';
import { TopBarHUD } from './TopBarHUD';
import { OpponentSeat } from './OpponentSeat';
import { TableCenter } from './TableCenter';
import { PlayerFile } from './PlayerFile';
import { PlayerHand } from './PlayerHand';
import { FloatingCardPreview } from './FloatingCardPreview';
import { BACKGROUNDS } from '../config/assets';
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

  return (
    <div
      className="h-full w-full flex flex-col justify-between overflow-hidden relative"
      style={{
        backgroundImage: `radial-gradient(ellipse at center, rgba(244,239,230,0.03) 40%, rgba(30,41,59,0.20) 100%), url('${BACKGROUNDS.table_mobile}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundColor: '#EBDCC0',
      }}
      dir="rtl"
    >
      {/* Subtle turn-flow chevrons around table corners */}
      <div className="pointer-events-none select-none absolute top-[17%] right-3 text-wasta-gold/75 font-black text-sm rotate-[-40deg]">
        ‹‹‹
      </div>
      <div className="pointer-events-none select-none absolute top-[17%] left-3 text-wasta-gold/75 font-black text-sm rotate-[40deg]">
        ‹‹‹
      </div>
      <div className="pointer-events-none select-none absolute bottom-[37%] right-3 text-wasta-gold/75 font-black text-sm rotate-[40deg]">
        ›››
      </div>
      <div className="pointer-events-none select-none absolute bottom-[37%] left-3 text-wasta-gold/75 font-black text-sm rotate-[-40deg]">
        ›››
      </div>

      {/* Blue shield ripple flash on breakfast_break */}
      <AnimatePresence>
        {shieldFlash && (
          <motion.div
            key="shield-flash"
            initial={{ opacity: 0.65, scale: 0.85 }}
            animate={{ opacity: 0, scale: 1.4 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center"
          >
            <div className="w-56 h-56 rounded-full border-8 border-defense-blue/70 bg-defense-blue/15" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Corner HUD */}
      <TopBarHUD />

      {/* Top Opponent Seat(s) */}
      {seats.top.length > 0 && (
        <div className="flex-shrink-0 flex items-start justify-center gap-2 px-2 pt-0.5 z-10">
          {seats.top.map(opp => (
            <OpponentSeat
              key={opp.id}
              player={opp}
              position="top"
              isCurrentTurn={publicState.currentTurnPlayerId === opp.id}
              lastEvent={lastEvent}
            />
          ))}
        </div>
      )}

      {/* Middle Tabletop Ring: Right Seat | Center Table | Left Seat */}
      <div className="flex-1 min-h-0 w-full flex items-center justify-between gap-1 sm:gap-4 px-1.5 sm:px-6 z-10">
        <div className="flex-shrink-0 flex items-center justify-center">
          {seats.right && (
            <OpponentSeat
              player={seats.right}
              position="right"
              isCurrentTurn={publicState.currentTurnPlayerId === seats.right.id}
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
              lastEvent={lastEvent}
            />
          )}
        </div>
      </div>

      {/* Bottom: Player's File & Sticker Trigger */}
      <div className="flex-shrink-0 px-2 pb-1 z-20">
        <PlayerFile />
      </div>

      {/* Bottom: Player's Hand */}
      <div className="flex-shrink-0 z-20 pb-1.5 px-1.5">
        <PlayerHand />
      </div>

      {/* Non-Blocking Hover Preview HUD */}
      <FloatingCardPreview />
    </div>
  );
};
