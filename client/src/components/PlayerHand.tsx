// ========================
// EL-KHETM — Large Readable Player Hand Dock (Uncovered Giant Cards + Crisp Captions)
// ========================

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { useSocket } from '../hooks/useSocket';
import { Card as CardComponent } from './Card';
import {
  getSafeCardDef,
  getCardPlayError,
  isDocumentCard,
} from '@el-khetm/shared';
import type { Card, CardType } from '@el-khetm/shared';

const HandTurnTimer: React.FC<{ expiresAt: number | null }> = ({ expiresAt }) => {
  const [turnSecondsLeft, setTurnSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!expiresAt) {
      setTurnSecondsLeft(null);
      return;
    }
    const tick = () => {
      setTurnSecondsLeft(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    };
    tick();
    const id = setInterval(tick, 350);
    return () => clearInterval(id);
  }, [expiresAt]);

  if (turnSecondsLeft === null) return null;

  return (
    <span
      className={`text-[10px] font-cairo font-black px-1.5 py-0 rounded-full border ${
        turnSecondsLeft <= 7
          ? 'bg-prank-red text-white border-ink animate-pulse'
          : 'bg-white text-ink border-ink/30'
      }`}
    >
      {turnSecondsLeft} ث
    </span>
  );
};

export const PlayerHand: React.FC = () => {
  const { socket } = useSocket();
  const {
    publicState,
    privateState,
    myPlayerId,
    endTurn,
    openModal,
    setHoveredPreview,
    interactionMode,
    hiddenHandCardIds,
  } = useGameStore();

  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [newlyAddedIds, setNewlyAddedIds] = useState<Set<string>>(() => new Set());
  const seenHandIdsRef = useRef<Set<string> | null>(null);
  const newCardTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const myId = privateState?.playerId || myPlayerId || '';
  const myPlayer = publicState?.players.find(p => p.id === myId) ?? null;
  const isMyTurn = Boolean(
    publicState && myId && publicState.currentTurnPlayerId === myId && publicState.phase === 'ACTION_PHASE',
  );
  const isMyDraw = Boolean(
    publicState && myId && publicState.currentTurnPlayerId === myId && publicState.phase === 'DRAW_PHASE',
  );
  const actionsLeft = publicState?.actionsRemaining ?? 0;
  const medhatActive = publicState?.globalEffects.medhatVacationUntilPlayerId !== null;

  useEffect(() => {
    const currentIds = (privateState?.hand ?? []).map(c => c.instanceId);
    if (!privateState || currentIds.length === 0) {
      if (!privateState) {
        seenHandIdsRef.current = null;
      }
      return;
    }

    const prevSeen = seenHandIdsRef.current;
    if (
      !prevSeen ||
      (publicState?.phase === 'PEEK_START' &&
        publicState?.roundNumber === 1 &&
        currentIds.every(id => !prevSeen.has(id)))
    ) {
      seenHandIdsRef.current = new Set(currentIds);
      return;
    }

    const added = currentIds.filter(id => !prevSeen.has(id));
    for (const id of currentIds) {
      prevSeen.add(id);
    }

    if (added.length > 0) {
      setNewlyAddedIds(prev => {
        const next = new Set(prev);
        for (const id of added) next.add(id);
        return next;
      });
      for (const id of added) {
        const existingTimer = newCardTimersRef.current.get(id);
        if (existingTimer) clearTimeout(existingTimer);
        const timer = setTimeout(() => {
          newCardTimersRef.current.delete(id);
          setNewlyAddedIds(prev => {
            if (!prev.has(id)) return prev;
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }, 2400);
        newCardTimersRef.current.set(id, timer);
      }
    }
  }, [privateState, publicState?.phase, publicState?.roundNumber]);

  useEffect(() => {
    const timers = newCardTimersRef.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  const getPlayError = useCallback((cardType: CardType): string | null => {
    if (!publicState || !myPlayer || !privateState) return 'جاري التحميل...';
    if (publicState.phase === 'PEEK_START') return 'احفظ ورقك الأول!';
    if (isMyDraw) return 'اسحب كارت الأول!';
    if (!isMyTurn) return 'مش دورك دلوقتي';
    if (actionsLeft <= 0) return 'خلصت حركاتك';

    const err = getCardPlayError(cardType, myPlayer.file, medhatActive);
    if (err) return err;

    const def = getSafeCardDef(cardType);
    const myIndex = publicState.players.findIndex(p => p.id === myId);
    const nextPlayer = myIndex >= 0 ? publicState.players[(myIndex + 1) % publicState.players.length] : null;
    const prevPlayer = myIndex >= 0 ? publicState.players[(myIndex - 1 + publicState.players.length) % publicState.players.length] : null;
    const fairOpponents = publicState.players.filter(p => p.id !== myId && !p.isImmuneThisRound);

    if (def.positionalTarget === 'next') {
      if (!nextPlayer || nextPlayer.id === myId) return 'مفيش لاعب بعدك';
      if (cardType === 'system_down' && nextPlayer.isFrozen) return `${nextPlayer.name} متجمد أصلاً`;
      if (cardType === 'missing_papers' && nextPlayer.handCount === 0) return `${nextPlayer.name} إيده فاضية`;
    } else if (def.positionalTarget === 'prev') {
      if (!prevPlayer || prevPlayer.id === myId) return 'مفيش لاعب قبلك';
    }

    if (def.targetsOpponent) {
      if (fairOpponents.length === 0) return 'الخصوم محصّنين اللفة دي 🛡️';
      switch (cardType) {
        case 'come_tomorrow':
        case 'file_lost':
        case 'wasta':
          if (!fairOpponents.some(p => p.dossierSlots.some(s => s.hasCard))) {
            return 'مفيش خانة عند خصم غير محصّن';
          }
          break;
        case 'desk_swap':
          if (!myPlayer.dossierSlots.some(s => s.hasCard)) return 'ملفك فاضي';
          if (!fairOpponents.some(p => p.dossierSlots.some(s => s.hasCard))) {
            return 'مفيش خانة متاحة للتبديل';
          }
          break;
      }
    }

    if ((cardType === 'drawer_peek' || cardType === 'show_me_all') &&
      !publicState.players.some(p => p.dossierSlots.some(s => s.hasCard))) {
      return 'كل الخانات فاضية';
    }
    if (cardType === 'uncle_gamal' && publicState.discardPileCount === 0) return 'الأرشيف فاضي';

    return null;
  }, [publicState, myPlayer, privateState, isMyTurn, isMyDraw, actionsLeft, medhatActive, myId]);

  if (!publicState || !privateState || !myPlayer) return null;

  const canPlaceCardInSlot = (card: Card): boolean => {
    if (!isMyTurn || actionsLeft <= 0) return false;
    if (!isDocumentCard(card.cardType)) return false;
    if (card.cardType === 'manager_sign' && medhatActive) return false;
    return true;
  };

  const handleCardTap = (card: Card) => {
    setHoveredPreview(null);
    setHoveredCardId(null);
    openModal('card_zoom', { handCard: card });
  };

  const currentTurnPlayerName =
    publicState.players.find(p => p.id === publicState.currentTurnPlayerId)?.name ?? '';

  return (
    <div className="w-full flex flex-col bg-manila/95 rounded-2xl border-2 border-ink shadow-retro" dir="rtl">
      {/* Turn Status + End Turn Control */}
      <div className="flex items-center justify-between gap-2 px-2.5 py-1 bg-ink/5 border-b border-ink/15 rounded-t-xl">
        <div className="flex items-center gap-1.5 min-w-0">
          {isMyTurn || isMyDraw ? (
            <>
              <div className="w-2.5 h-2.5 rounded-full bg-doc-green animate-pulse flex-shrink-0" />
              <span className="text-[11px] sm:text-xs font-cairo font-black text-ink truncate">
                {isMyDraw ? 'دورك: اسحب كارت من الكومة' : `دورك — متاح ${actionsLeft} حركة`}
              </span>
              <HandTurnTimer expiresAt={publicState.turnExpiresAt} />
            </>
          ) : (
            <>
              <Clock size={12} className="text-ink/55 flex-shrink-0" />
              <span className="text-[11px] font-cairo font-bold text-ink/75 truncate">
                {publicState.phase === 'PEEK_START' ? 'نظرة البداية — احفظ خانتين...' : `دور ${currentTurnPlayerName}`}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {privateState.hand.length > 3 && (
            <span className="text-[9.5px] font-cairo font-bold text-ink/60">
              ({privateState.hand.length} كروت ↔)
            </span>
          )}
          {isMyTurn && (
            <button
              onClick={() => {
                setHoveredPreview(null);
                endTurn(socket);
              }}
              className="px-2.5 py-0.5 bg-ink text-white text-[10.5px] font-cairo font-black rounded-lg border border-ink shadow-sm"
            >
              إنهاء الدور
            </button>
          )}
        </div>
      </div>

      {/* Giant Uncovered Scrollable Cards Tray (100% readable captions + big art!) */}
      <div className="w-full overflow-x-auto overflow-y-hidden pt-4 pb-1.5 px-2.5" data-flight-anchor={`hand-${myId}`}>
        <div className="w-max min-w-full flex items-end justify-center gap-2">
          <AnimatePresence>
            {privateState.hand.map((card, i) => {
              const def = getSafeCardDef(card.cardType);
              const isDoc = isDocumentCard(card.cardType);
              const error = isDoc ? (canPlaceCardInSlot(card) ? null : (medhatActive && card.cardType === 'manager_sign' ? 'مدحت في إجازة' : null)) : getPlayError(card.cardType);
              const isSelected = interactionMode?.type === 'place_in_slot' && interactionMode.handCard.instanceId === card.instanceId;
              const isNewlyAdded = newlyAddedIds.has(card.instanceId);
              const isHovered = hoveredCardId === card.instanceId;
              const isFlightHidden = Boolean(hiddenHandCardIds[card.instanceId]?.length);

              const badgeColor =
                def.category === 'document'
                  ? 'bg-doc-green/12 text-doc-green border-doc-green/35'
                  : def.category === 'prank'
                  ? 'bg-prank-red/12 text-prank-red border-prank-red/35'
                  : card.cardType === 'wasta'
                  ? 'bg-wasta-gold/20 text-ink border-wasta-gold'
                  : 'bg-defense-blue/12 text-defense-blue border-defense-blue/35';

              return (
                <motion.div
                  key={card.instanceId}
                  className="flex-shrink-0 relative flex flex-col items-center w-[clamp(88px,24vw,116px)]"
                  initial={{ opacity: 0, y: 0, scale: 1 }}
                  animate={{
                    opacity: isFlightHidden ? 0 : 1,
                    y: isHovered ? -8 : isNewlyAdded && !isFlightHidden ? -5 : 0,
                    scale: isHovered ? 1.05 : 1,
                  }}
                  exit={{ opacity: 0, transition: { duration: 0.05 } }}
                  style={{
                    zIndex: isHovered ? 35 : isNewlyAdded ? 25 : i + 1,
                    pointerEvents: isFlightHidden ? 'none' : 'auto',
                  }}
                  transition={
                    isFlightHidden
                      ? { duration: 0 }
                      : { type: 'spring', stiffness: 380, damping: 26 }
                  }
                  onPointerEnter={(e) => {
                    if (e.pointerType === 'touch') return;
                    setHoveredCardId(card.instanceId);
                    setHoveredPreview({
                      cardType: card.cardType,
                      badgeText: isDoc ? 'مستند لملفك' : 'كارت أكشن',
                      statusText: error ?? def.shortEffectAr,
                      isError: Boolean(error) && isMyTurn,
                    });
                  }}
                  onPointerLeave={(e) => {
                    if (e.pointerType === 'touch') return;
                    setHoveredCardId(prev => (prev === card.instanceId ? null : prev));
                    setHoveredPreview(null);
                  }}
                >
                  {isNewlyAdded && !isSelected && !isFlightHidden && (
                    <span
                      className="pointer-events-none absolute -top-3 right-1/2 translate-x-1/2 z-40 rounded-full bg-emerald-600 px-2 py-0.5 text-[9.5px] font-black font-cairo text-white shadow-md ring-1 ring-white whitespace-nowrap animate-bounce"
                      dir="rtl"
                    >
                      جديد ✨
                    </span>
                  )}
                  <div className="w-full relative" data-flight-anchor={`hand-card-${card.instanceId}`}>
                    <CardComponent
                      cardType={card.cardType}
                      isSelected={isSelected}
                      isDimmed={Boolean(error) && isMyTurn && !def.isReactionOnly}
                      dimmedReason={error || undefined}
                      onTap={() => handleCardTap(card)}
                      size="hand"
                      className={`!w-full ${
                        isNewlyAdded && !isFlightHidden ? 'ring-2 ring-emerald-500 shadow-[0_0_14px_rgba(16,185,129,0.55)]' : ''
                      }`}
                    />
                  </div>
                  {/* Crisp High-Contrast Arabic Name & Action Label Below Each Card */}
                  <button
                    type="button"
                    onClick={() => handleCardTap(card)}
                    className={`w-full mt-1 rounded-lg border px-1 py-0.5 text-center leading-tight shadow-sm ${badgeColor} bg-white/95`}
                  >
                    <p className="text-[10px] sm:text-[11px] font-cairo font-black text-ink truncate">
                      {def.nameAr}
                    </p>
                    <p className="text-[8.5px] sm:text-[9.5px] font-cairo font-bold truncate opacity-90">
                      {def.shortEffectAr}
                    </p>
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {privateState.hand.length === 0 && (
            <span className="text-xs font-cairo font-bold text-ink/50 py-5" dir="rtl">إيدك فاضية</span>
          )}
        </div>
      </div>
    </div>
  );
};
