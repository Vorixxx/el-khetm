// ========================
// EL-KHETM — Dramatic GPU Card Flight & Landing Impact Layer
// ========================

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { CardMotionEvent, CardMotionLocation, CardType } from '@el-khetm/shared';
import { useGameStore } from '../store/useGameStore';
import { Card as CardComponent } from './Card';

interface ActiveFlight {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  arcLift: number;
  peakScale: number;
  cardType: CardType;
  faceDown: boolean;
  labelAr?: string;
  tone: 'gold' | 'green' | 'red';
  durationSec: number;
}

interface LandingPulse {
  id: string;
  x: number;
  y: number;
  tone: 'gold' | 'green' | 'red';
}

function locationToAnchorKey(loc: CardMotionLocation): string[] {
  switch (loc.zone) {
    case 'deck':
      return ['deck'];
    case 'archive':
      return ['archive'];
    case 'hand':
      return [`hand-${loc.playerId}`];
    case 'slot':
      return [`slot-${loc.playerId}-${loc.slotIndex}`, `hand-${loc.playerId}`];
  }
}

function resolveAnchorCenter(
  rootEl: HTMLElement,
  loc: CardMotionLocation,
): { x: number; y: number } | null {
  const rootRect = rootEl.getBoundingClientRect();
  for (const key of locationToAnchorKey(loc)) {
    const el = rootEl.querySelector<HTMLElement>(`[data-flight-anchor="${key}"]`);
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        return {
          x: r.left - rootRect.left + r.width / 2,
          y: r.top - rootRect.top + r.height / 2,
        };
      }
    }
  }
  return { x: rootRect.width / 2, y: rootRect.height / 2 };
}

function classifyMotionTone(m: CardMotionEvent): 'gold' | 'green' | 'red' {
  if (m.from.zone === 'slot' && m.to.zone === 'slot') return 'gold';
  if (m.to.zone === 'archive' && m.from.zone === 'slot') return 'red';
  if (m.to.zone === 'hand' && m.from.zone === 'deck') return 'green';
  if (m.to.zone === 'slot') return 'green';
  return 'gold';
}

export const CardFlightLayer: React.FC<{ boardRef: React.RefObject<HTMLDivElement | null> }> = ({
  boardRef,
}) => {
  const recentCardMotions = useGameStore(s => s.publicState?.recentCardMotions);
  const seenMotionIds = useRef<Set<string>>(new Set());
  const [flights, setFlights] = useState<ActiveFlight[]>([]);
  const [pulses, setPulses] = useState<LandingPulse[]>([]);

  useEffect(() => {
    const rootEl = boardRef.current;
    if (!rootEl || !recentCardMotions || recentCardMotions.length === 0) return;

    const now = Date.now();
    const newMotions: CardMotionEvent[] = [];
    for (const m of recentCardMotions) {
      if (seenMotionIds.current.has(m.id)) continue;
      seenMotionIds.current.add(m.id);
      if (now - m.createdAt <= 3400) {
        newMotions.push(m);
      }
    }

    if (seenMotionIds.current.size > 120) {
      seenMotionIds.current = new Set(recentCardMotions.map(m => m.id));
    }

    if (newMotions.length === 0) return;

    const launched: ActiveFlight[] = [];
    newMotions.forEach((m, idx) => {
      const fromPt = resolveAnchorCenter(rootEl, m.from);
      const toPt = resolveAnchorCenter(rootEl, m.to);
      if (!fromPt || !toPt) return;

      const isSwapOrSteal =
        (m.from.zone === 'slot' && m.to.zone === 'slot') ||
        (m.from.zone === 'hand' && m.to.zone === 'hand');

      const dx = toPt.x - fromPt.x;
      const dy = toPt.y - fromPt.y;
      // Crossing opposing arcs when 2 cards swap simultaneously!
      const baseLift = Math.abs(dx) > Math.abs(dy) ? 54 : 36;
      const arcLift = isSwapOrSteal ? (idx % 2 === 0 ? -baseLift : baseLift * 0.78) : -32;
      const durationSec = Math.max(
        0.65,
        Math.min(1.3, (m.durationMs || (isSwapOrSteal ? 1150 : 880)) / 1000),
      );

      launched.push({
        id: m.id,
        startX: fromPt.x,
        startY: fromPt.y,
        endX: toPt.x,
        endY: toPt.y,
        arcLift,
        peakScale: isSwapOrSteal ? 1.38 : 1.24,
        cardType: m.cardType ?? 'id_copy',
        faceDown: m.faceDown || !m.cardType,
        labelAr: m.labelAr,
        tone: classifyMotionTone(m),
        durationSec,
      });
    });

    if (launched.length === 0) return;

    setFlights(prev => [...prev.slice(-6), ...launched]);

    launched.forEach(fl => {
      const ms = Math.round(fl.durationSec * 1000);
      setTimeout(() => {
        setPulses(prev => [
          ...prev.slice(-5),
          { id: `pulse_${fl.id}`, x: fl.endX, y: fl.endY, tone: fl.tone },
        ]);
        setTimeout(() => {
          setPulses(prev => prev.filter(p => p.id !== `pulse_${fl.id}`));
        }, 550);
      }, Math.max(120, ms - 120));

      setTimeout(() => {
        setFlights(prev => prev.filter(item => item.id !== fl.id));
      }, ms + 160);
    });
  }, [recentCardMotions, boardRef]);

  return (
    <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden">
      {/* Landing Impact Ripples */}
      <AnimatePresence>
        {pulses.map(p => (
          <motion.div
            key={p.id}
            initial={{ x: p.x - 24, y: p.y - 24, scale: 0.45, opacity: 0.9 }}
            animate={{ scale: 2.1, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            style={{ willChange: 'transform, opacity' }}
            className={`absolute top-0 left-0 w-12 h-12 rounded-full border-[3px] ${
              p.tone === 'gold'
                ? 'border-wasta-gold bg-wasta-gold/25'
                : p.tone === 'red'
                ? 'border-prank-red bg-prank-red/25'
                : 'border-doc-green bg-doc-green/25'
            }`}
          />
        ))}
      </AnimatePresence>

      {/* Flying Cards */}
      <AnimatePresence>
        {flights.map(fl => {
          const midX = (fl.startX + fl.endX) / 2;
          const midY = (fl.startY + fl.endY) / 2 + fl.arcLift;
          const ringClass =
            fl.tone === 'gold'
              ? 'ring-[3px] ring-wasta-gold shadow-[0_14px_28px_rgba(245,158,11,0.55)]'
              : fl.tone === 'red'
              ? 'ring-[3px] ring-prank-red shadow-[0_14px_28px_rgba(185,28,28,0.5)]'
              : 'ring-[3px] ring-doc-green shadow-[0_14px_28px_rgba(21,128,61,0.5)]';

          return (
            <motion.div
              key={fl.id}
              initial={{
                x: fl.startX - 34,
                y: fl.startY - 45,
                scale: 0.82,
                opacity: 0.95,
                rotate: -12,
              }}
              animate={{
                x: [fl.startX - 34, midX - 34, fl.endX - 34],
                y: [fl.startY - 45, midY - 45, fl.endY - 45],
                scale: [0.82, fl.peakScale, 0.92],
                opacity: [0.95, 1, 0.94],
                rotate: [-12, 8, 0],
              }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: fl.durationSec, ease: 'easeInOut' }}
              style={{ willChange: 'transform, opacity' }}
              className="absolute top-0 left-0 flex flex-col items-center"
            >
              <div className={`${ringClass} rounded-lg bg-manila`}>
                <CardComponent cardType={fl.cardType} isBack={fl.faceDown} size="sm" className="!w-[68px]" />
              </div>
              {fl.labelAr && (
                <span className="mt-1 bg-ink text-wasta-gold text-[10px] font-cairo font-black px-2 py-0.5 rounded-full border border-wasta-gold shadow-md whitespace-nowrap">
                  {fl.labelAr}
                </span>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
