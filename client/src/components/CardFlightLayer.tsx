// ========================
// EL-KHETM — UNO/Jawaker-Grade 60fps Bezier 3D Card Flight Layer
// Zero-ghosting handoff, GPU transforms, 3D Y-axis flips, and synced landing foley
// ========================

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CardMotionEvent, CardMotionLocation, CardType } from '@el-khetm/shared';
import { getSafeCardDef } from '@el-khetm/shared';
import { useGameStore } from '../store/useGameStore';
import {
  getCardBack,
  getCardFallbackSvg,
  getCardImage,
  CARD_BACK_FALLBACK_CSS,
} from '../config/assets';
import { playCardSettle } from '../hooks/useSound';

interface CardFlightLayerProps {
  boardRef: React.RefObject<HTMLDivElement | null>;
}

interface AnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ActiveFlight {
  motion: CardMotionEvent;
  startRect: AnchorRect;
  endRect: AnchorRect;
  ctrlX: number;
  ctrlY: number;
  startRotateY: number;
  endRotateY: number;
  flipStart: number;
  flipEnd: number;
  tiltSign: number;
  targetAngle: number;
  fadeOnOpponentHand: boolean;
  cardType?: CardType;
  startedAt: number;
  durationMs: number;
}

const ARCHIVE_REST_ANGLES = [-6, 5, -3, 2];

const CATEGORY_BORDER: Record<string, string> = {
  document: 'border-doc-green',
  prank: 'border-prank-red',
  utility: 'border-defense-blue',
};

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / Math.max(0.0001, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

// Fast cubic-bezier(0.22, 1, 0.36, 1) evaluator (snappy launch, velvety cushion)
function easeOutQuinticBezier(x: number): number {
  const cx = 3 * 0.22;
  const bx = 3 * (0.36 - 0.22) - cx;
  const ax = 1 - cx - bx;

  const cy = 3 * 1.0;
  const by = 3 * (1.0 - 1.0) - cy;
  const ay = 1 - cy - by;

  let t = clamp(x, 0, 1);
  for (let i = 0; i < 4; i++) {
    const xt = ((ax * t + bx) * t + cx) * t - x;
    const dxt = (3 * ax * t + 2 * bx) * t + cx;
    if (Math.abs(xt) < 1e-4 || Math.abs(dxt) < 1e-5) break;
    t = clamp(t - xt / dxt, 0, 1);
  }
  return ((ay * t + by) * t + cy) * t;
}

function collectAnchors(board: HTMLDivElement): Map<string, AnchorRect> {
  const boardRect = board.getBoundingClientRect();
  const map = new Map<string, AnchorRect>();
  const elements = board.querySelectorAll<HTMLElement>('[data-flight-anchor]');
  elements.forEach((el) => {
    const key = el.getAttribute('data-flight-anchor');
    if (!key) return;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    map.set(key, {
      x: r.left - boardRect.left,
      y: r.top - boardRect.top,
      width: r.width,
      height: r.height,
    });
  });
  return map;
}

function resolveAnchorRect(
  loc: CardMotionLocation,
  liveRects: Map<string, AnchorRect>,
  prevRects: Map<string, AnchorRect>,
  boardW: number,
  myId: string,
  preferPrev: boolean,
): AnchorRect | null {
  const pick = (key: string): AnchorRect | undefined =>
    preferPrev
      ? prevRects.get(key) ?? liveRects.get(key)
      : liveRects.get(key) ?? prevRects.get(key);

  if (loc.zone === 'deck') {
    return pick('deck') ?? null;
  }
  if (loc.zone === 'archive') {
    return pick('archive') ?? null;
  }
  if (loc.zone === 'slot') {
    return pick(`slot-${loc.playerId}-${loc.slotIndex}`) ?? null;
  }
  if (loc.zone === 'hand') {
    if (loc.cardInstanceId && loc.playerId === myId) {
      const cardRect = pick(`hand-card-${loc.cardInstanceId}`);
      if (cardRect) {
        const clampedX = clamp(cardRect.x, 8, Math.max(8, boardW - cardRect.width - 8));
        return { ...cardRect, x: clampedX };
      }
    }
    const container = pick(`hand-${loc.playerId}`);
    if (!container) return null;

    if (loc.playerId === myId) {
      const w = 96;
      const h = 128;
      return {
        x: container.x + container.width / 2 - w / 2,
        y: container.y + Math.min(20, Math.max(8, (container.height - h) * 0.25)),
        width: w,
        height: h,
      };
    }
    const w = 42;
    const h = 56;
    return {
      x: container.x + container.width / 2 - w / 2,
      y: container.y + container.height / 2 - h / 2,
      width: w,
      height: h,
    };
  }
  return null;
}

interface FlightCardFaceProps {
  cardType?: CardType;
}

const FlightCardFaces: React.FC<FlightCardFaceProps> = React.memo(({ cardType }) => {
  const [imgErr, setImgErr] = useState(false);
  const def = cardType ? getSafeCardDef(cardType) : null;
  const frontSrc = cardType && def
    ? (imgErr ? getCardFallbackSvg(cardType, def.nameAr, def.category) : getCardImage(cardType))
    : '';
  const frontBorder = cardType === 'wasta'
    ? 'border-wasta-gold'
    : def
    ? CATEGORY_BORDER[def.category] || 'border-ink'
    : 'border-ink';

  return (
    <>
      {/* Front Face (rotateY 0deg) */}
      <div
        style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
        className={`absolute inset-0 rounded-lg border-2 ${frontBorder} bg-manila overflow-hidden`}
      >
        {cardType && (
          <img
            src={frontSrc}
            alt={def?.nameAr || 'كارت'}
            className="w-full h-full object-cover"
            decoding="async"
            draggable={false}
            onError={() => setImgErr(true)}
          />
        )}
      </div>

      {/* Back Face (rotateY 180deg) */}
      <div
        style={{
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          transform: 'rotateY(180deg)',
        }}
        className="absolute inset-0 rounded-lg border-2 border-ink bg-[#5C1221] overflow-hidden flex items-center justify-center"
      >
        <img
          src={getCardBack()}
          alt="ضهر الكارت"
          className="w-full h-full object-cover"
          decoding="async"
          draggable={false}
          onError={(e) => {
            const el = e.currentTarget.parentElement;
            if (el) el.setAttribute('style', CARD_BACK_FALLBACK_CSS);
            e.currentTarget.style.display = 'none';
          }}
        />
      </div>
    </>
  );
});

export const CardFlightLayer: React.FC<CardFlightLayerProps> = ({ boardRef }) => {
  const publicState = useGameStore(s => s.publicState);
  const privateState = useGameStore(s => s.privateState);
  const myPlayerId = useGameStore(s => s.myPlayerId);
  const revealFlightTarget = useGameStore(s => s.revealFlightTarget);

  const [activeFlights, setActiveFlights] = useState<ActiveFlight[]>([]);
  const flightsRef = useRef<ActiveFlight[]>([]);
  const seenMotionIdsRef = useRef<Set<string>>(new Set());
  const prevRectsRef = useRef<Map<string, AnchorRect>>(new Map());
  const cachedCardTypesRef = useRef<Map<string, CardType>>(new Map());
  const outerDomRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const innerDomRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const recentMotions = publicState?.recentCardMotions ?? [];
  const myId = privateState?.playerId || myPlayerId || '';

  // Keep local cardType lookup cache up-to-date before hand/archive drops cards
  useLayoutEffect(() => {
    const cache = cachedCardTypesRef.current;
    for (const c of privateState?.hand ?? []) {
      cache.set(c.instanceId, c.cardType);
    }
    for (const c of publicState?.discardPileRecent ?? []) {
      cache.set(c.instanceId, c.cardType);
    }
    if (cache.size > 160) {
      const keep = Array.from(cache.entries()).slice(-90);
      cache.clear();
      for (const [k, v] of keep) cache.set(k, v);
    }
  }, [privateState?.hand, publicState?.discardPileRecent]);

  // Measure anchors BEFORE paint so departure/destination rects match frame-perfectly
  useLayoutEffect(() => {
    const boardEl = boardRef.current;
    if (!boardEl) return;

    const liveRects = collectAnchors(boardEl);
    const prevRects = prevRectsRef.current;
    const boardW = boardEl.clientWidth || 380;

    if (recentMotions.length > 0) {
      const nowWall = Date.now();
      const nowPerf = performance.now();
      const newlySpawned: ActiveFlight[] = [];

      for (const m of recentMotions) {
        if (seenMotionIdsRef.current.has(m.id)) continue;
        seenMotionIdsRef.current.add(m.id);

        const maxAge = (m.delayMs ?? 0) + (m.durationMs ?? 480) + 1200;
        if (nowWall - m.createdAt > maxAge) {
          revealFlightTarget(m.id);
          continue;
        }

        const preferPrevFrom = m.from.zone === 'hand';
        const fromRect = resolveAnchorRect(m.from, liveRects, prevRects, boardW, myId, preferPrevFrom);
        const toRect = resolveAnchorRect(m.to, liveRects, prevRects, boardW, myId, false);

        if (!fromRect || !toRect) {
          revealFlightTarget(m.id);
          continue;
        }

        // Resolve cardType from wire or local player's hand cache
        let resolvedType: CardType | undefined = m.cardType;
        if (!resolvedType && m.to.zone === 'hand' && m.to.playerId === myId && m.to.cardInstanceId) {
          const toCardId = m.to.cardInstanceId;
          resolvedType =
            privateState?.hand.find(c => c.instanceId === toCardId)?.cardType ??
            cachedCardTypesRef.current.get(toCardId);
        }
        if (!resolvedType && m.from.zone === 'hand' && m.from.playerId === myId && m.from.cardInstanceId) {
          resolvedType = cachedCardTypesRef.current.get(m.from.cardInstanceId);
        }

        const startFaceDown =
          !resolvedType ||
          m.from.zone === 'deck' ||
          m.from.zone === 'slot' ||
          (m.from.zone === 'hand' && m.from.playerId !== myId);

        const endFaceDown =
          !resolvedType ||
          m.to.zone === 'slot' ||
          m.to.zone === 'deck' ||
          (m.to.zone === 'archive' ? m.faceDown : false) ||
          (m.to.zone === 'hand' && m.to.playerId !== myId);

        const startCx = fromRect.x + fromRect.width / 2;
        const startCy = fromRect.y + fromRect.height / 2;
        const endCx = toRect.x + toRect.width / 2;
        const endCy = toRect.y + toRect.height / 2;

        const dx = endCx - startCx;
        const dy = endCy - startCy;
        const dist = Math.hypot(dx, dy);

        const arcLift = clamp(dist * 0.24, 24, 92);
        const perpX = dist > 8 ? (-dy / dist) * clamp(dist * 0.08, 0, 24) : 0;
        const ctrlX = (startCx + endCx) / 2 + perpX;
        const ctrlY = (startCy + endCy) / 2 - arcLift;

        const tiltSign = dx >= 0 ? 1 : -1;
        const targetAngle =
          m.to.zone === 'archive'
            ? ARCHIVE_REST_ANGLES[Math.abs(Math.round(nowPerf)) % ARCHIVE_REST_ANGLES.length]
            : 0;

        newlySpawned.push({
          motion: m,
          startRect: fromRect,
          endRect: toRect,
          ctrlX,
          ctrlY,
          startRotateY: startFaceDown ? 180 : 0,
          endRotateY: endFaceDown ? 180 : 0,
          flipStart: startFaceDown && !endFaceDown ? 0.18 : 0.26,
          flipEnd: startFaceDown && !endFaceDown ? 0.72 : 0.76,
          tiltSign,
          targetAngle,
          fadeOnOpponentHand: m.to.zone === 'hand' && m.to.playerId !== myId,
          cardType: resolvedType,
          startedAt: nowPerf + (m.delayMs ?? 0),
          durationMs: clamp(m.durationMs ?? 480, 320, 900),
        });
      }

      if (seenMotionIdsRef.current.size > 140) {
        const recent = Array.from(seenMotionIdsRef.current).slice(-70);
        seenMotionIdsRef.current.clear();
        for (const id of recent) seenMotionIdsRef.current.add(id);
      }

      if (newlySpawned.length > 0) {
        flightsRef.current = [...flightsRef.current, ...newlySpawned];
        setActiveFlights(flightsRef.current);
      }
    }

    prevRectsRef.current = liveRects;
  }, [recentMotions, privateState?.hand, publicState?.discardPileRecent, myId, boardRef, revealFlightTarget]);

  // Single unified 60-120fps rAF loop mutating transforms directly on GPU
  const hasActiveFlights = activeFlights.length > 0;
  useEffect(() => {
    if (!hasActiveFlights) return;

    let rafId = 0;

    const frame = (now: number) => {
      const completed: ActiveFlight[] = [];

      for (const f of flightsRef.current) {
        const outer = outerDomRefs.current.get(f.motion.id);
        const inner = innerDomRefs.current.get(f.motion.id);

        if (now < f.startedAt) {
          if (outer) outer.style.opacity = '0';
          continue;
        }

        const rawT = clamp((now - f.startedAt) / f.durationMs, 0, 1);
        const eased = easeOutQuinticBezier(rawT);

        const startCx = f.startRect.x + f.startRect.width / 2;
        const startCy = f.startRect.y + f.startRect.height / 2;
        const endCx = f.endRect.x + f.endRect.width / 2;
        const endCy = f.endRect.y + f.endRect.height / 2;

        // Quadratic Bezier curve B(t) = (1-t)^2 P0 + 2(1-t)t P1 + t^2 P2
        const inv = 1 - eased;
        const cx = inv * inv * startCx + 2 * inv * eased * f.ctrlX + eased * eased * endCx;
        const cy = inv * inv * startCy + 2 * inv * eased * f.ctrlY + eased * eased * endCy;

        // Morph cleanly from exact departure rect -> exact destination rect + slight arc elevation zoom
        const baseScaleX = f.startRect.width / Math.max(1, f.endRect.width);
        const baseScaleY = f.startRect.height / Math.max(1, f.endRect.height);
        const liftEnvelope = Math.sin(rawT * Math.PI);
        const elevationZoom = 1 + liftEnvelope * 0.13;
        const scaleX = lerp(baseScaleX, 1, eased) * elevationZoom;
        const scaleY = lerp(baseScaleY, 1, eased) * elevationZoom;

        const flightTilt = liftEnvelope * 11 * f.tiltSign + lerp(0, f.targetAngle, eased);

        const flipProgress =
          f.startRotateY !== f.endRotateY
            ? smoothstep(f.flipStart, f.flipEnd, rawT)
            : 0;
        const rotateY = lerp(f.startRotateY, f.endRotateY, flipProgress);

        // Soft disappear only if landing into an opaque opponent nameplate badge
        const opacity = f.fadeOnOpponentHand
          ? rawT > 0.78
            ? 1 - (rawT - 0.78) / 0.22
            : 1
          : 1;

        if (outer) {
          const tx = cx - f.endRect.width / 2;
          const ty = cy - f.endRect.height / 2;
          outer.style.opacity = String(opacity);
          outer.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${scaleX.toFixed(4)}, ${scaleY.toFixed(4)})`;
        }

        if (inner) {
          inner.style.transform = `rotateZ(${flightTilt.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`;
          const shadowY = 4 + liftEnvelope * 20;
          const shadowBlur = 8 + liftEnvelope * 22;
          const shadowAlpha = 0.2 + liftEnvelope * 0.26;
          inner.style.boxShadow = `0 ${shadowY.toFixed(1)}px ${shadowBlur.toFixed(1)}px rgba(24, 18, 12, ${shadowAlpha.toFixed(2)})`;
        }

        if (rawT >= 1) {
          completed.push(f);
        }
      }

      if (completed.length > 0) {
        const doneIds = new Set(completed.map(c => c.motion.id));
        flightsRef.current = flightsRef.current.filter(f => !doneIds.has(f.motion.id));

        for (const done of completed) {
          revealFlightTarget(done.motion.id);
          const settleKind =
            done.motion.to.zone === 'hand' && done.motion.to.playerId === myId
              ? 'hand'
              : 'felt';
          playCardSettle(settleKind);
        }

        setActiveFlights([...flightsRef.current]);
      }

      if (flightsRef.current.length > 0) {
        rafId = requestAnimationFrame(frame);
      }
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [hasActiveFlights, myId, revealFlightTarget]);

  // Safety reveal if layer unmounts cleanly
  useEffect(() => {
    return () => {
      for (const f of flightsRef.current) {
        revealFlightTarget(f.motion.id);
      }
      flightsRef.current = [];
    };
  }, [revealFlightTarget]);

  if (activeFlights.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-40">
      {activeFlights.map((f) => (
        <div
          key={f.motion.id}
          ref={(el) => {
            if (el) outerDomRefs.current.set(f.motion.id, el);
            else outerDomRefs.current.delete(f.motion.id);
          }}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: f.endRect.width,
            height: f.endRect.height,
            transformOrigin: 'center center',
            perspective: '1000px',
            willChange: 'transform, opacity',
            opacity: 0,
          }}
        >
          <div
            ref={(el) => {
              if (el) innerDomRefs.current.set(f.motion.id, el);
              else innerDomRefs.current.delete(f.motion.id);
            }}
            style={{
              width: '100%',
              height: '100%',
              transformStyle: 'preserve-3d',
              willChange: 'transform, box-shadow',
              borderRadius: '0.5rem',
            }}
            className="relative"
          >
            <FlightCardFaces cardType={f.cardType} />
          </div>
        </div>
      ))}
    </div>
  );
};
