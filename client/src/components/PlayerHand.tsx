// ========================
// EL-KHETM — Player Hand Dock (Fanned Overlap Without Horizontal Scroll + Fair Validation)
// ========================

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  Crosshair,
  DoorClosed,
  Flame,
} from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { useSocket } from '../hooks/useSocket';
import { Card as CardComponent } from './Card';
import {
  CARD_DEFINITIONS,
  getCardPlayError,
  isDocumentCard,
  GAME_CONSTANTS,
} from '@el-khetm/shared';
import type { Card, CardType } from '@el-khetm/shared';

const HandTurnTimer: React.FC<{ expiresAt: number | null }> = ({ expiresAt }) => {
  const [turnSecondsLeft, setTurnSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!expiresAt) {
      setTurnSecondsLeft(null);
      return;
    }
    const tick = () => setTurnSecondsLeft(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
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
      {turnSecondsLeft}ث
    </span>
  );
};

export const PlayerHand: React.FC = () => {
  const { socket } = useSocket();
  const {
    publicState,
    privateState,
    myPlayerId,
    playCard,
    endTurn,
    openModal,
    setHoveredPreview,
    interactionMode,
    setInteractionMode,
    closeWindow,
  } = useGameStore();

  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [confirmCloseWindow, setConfirmCloseWindow] = useState(false);

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
    setConfirmCloseWindow(false);
  }, [publicState?.phase, publicState?.currentTurnPlayerId]);

  const getPlayError = useCallback((cardType: CardType): string | null => {
    if (!publicState || !myPlayer || !privateState) return 'جاري التحميل...';
    if (publicState.phase === 'PEEK_START') return 'احفظ ورقك الأول!';
    if (isMyDraw) return 'اسحب كارت الأول!';
    if (!isMyTurn) return 'مش دورك دلوقتي';
    if (actionsLeft <= 0) return 'خلصت حركاتك';

    const err = getCardPlayError(cardType, myPlayer.file, medhatActive, {
      handCount: privateState.hand.length,
    });
    if (err) return err;

    const def = CARD_DEFINITIONS[cardType];
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
            return 'مفيش خانة متاحة عند خصم غير محصّن';
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
    if (cardType === 'dossier_sort' && publicState.deckCount === 0) return 'كومة السحب فاضية';

    return null;
  }, [publicState, myPlayer, privateState, isMyTurn, isMyDraw, actionsLeft, medhatActive, myId]);

  if (!publicState || !privateState || !myPlayer) return null;

  const canPlaceCardInSlot = (card: Card): boolean => {
    if (!isMyTurn || actionsLeft <= 0) return false;
    if (card.cardType === 'manager_sign' && medhatActive) {
      return false;
    }
    return true;
  };

  const handleCardTap = (card: Card) => {
    if (interactionMode?.type === 'burn_card') {
      if (card.instanceId === interactionMode.card.instanceId) return;
      const actionCard = interactionMode.card;
      setInteractionMode(null);
      const def = CARD_DEFINITIONS[actionCard.cardType];
      if (actionCard.cardType === 'desk_swap' || actionCard.cardType === 'wasta') {
        setInteractionMode({
          type: 'pick_own_slot',
          card: actionCard,
          purpose: actionCard.cardType,
          burnCardInstanceId: card.instanceId,
        });
      } else if (def.targetsOpponent || def.targetsAnySlot || actionCard.cardType === 'show_me_all') {
        openModal('target', {
          cardInstanceId: actionCard.instanceId,
          cardType: actionCard.cardType,
          burnCardInstanceId: card.instanceId,
        });
      } else {
        playCard(socket, { cardInstanceId: actionCard.instanceId, burnCardInstanceId: card.instanceId });
      }
      return;
    }

    setHoveredPreview(null);
    setHoveredCardId(null);
    openModal('card_zoom', { handCard: card });
  };

  const currentTurnPlayerName =
    publicState.players.find(p => p.id === publicState.currentTurnPlayerId)?.name ?? '';

  const canMatch =
    isMyTurn && !publicState.matchedThisTurn && publicState.discardPileCount > 0 && myPlayer.filledSlotCount > 0;
  const canCloseWindow =
    isMyTurn &&
    publicState.roundNumber >= GAME_CONSTANTS.MIN_ROUND_TO_CLOSE_WINDOW &&
    publicState.windowClosedByPlayerId === null;

  // Dynamic overlapping card fan margin so all 1-7 cards are visible simultaneously without horizontal scroll
  const handCount = privateState.hand.length;
  const overlapClass =
    handCount <= 4
      ? 'ml-1.5 first:ml-0'
      : handCount === 5
      ? '-ml-2 first:ml-0'
      : handCount === 6
      ? '-ml-3.5 first:ml-0'
      : '-ml-5 first:ml-0';

  return (
    <div className="w-full flex flex-col bg-manila/95 rounded-xl border-2 border-ink shadow-retro" dir="rtl">
      {/* Turn Status + Quick Controls */}
      <div className="flex flex-wrap items-center justify-between gap-1 px-2 py-1 bg-ink/5 border-b border-ink/15 rounded-t-lg">
        <div className="flex items-center gap-1.5 min-w-0">
          {isMyTurn || isMyDraw ? (
            <>
              <div className="w-2 h-2 rounded-full bg-doc-green animate-pulse flex-shrink-0" />
              <span className="text-[10.5px] sm:text-xs font-cairo font-extrabold text-ink truncate">
                {isMyDraw ? 'دورك: اسحب كارت' : `دورك — ${actionsLeft} حركة`}
              </span>
              <HandTurnTimer expiresAt={publicState.turnExpiresAt} />
            </>
          ) : (
            <>
              <Clock size={12} className="text-ink/55 flex-shrink-0" />
              <span className="text-[10.5px] font-cairo font-bold text-ink/75 truncate">
                {publicState.phase === 'PEEK_START' ? 'نظرة البداية...' : `دور ${currentTurnPlayerName}`}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {canMatch && (
            <button
              onClick={() => setInteractionMode({ type: 'match_archive' })}
              className="flex items-center gap-0.5 px-1.5 sm:px-2 py-0.5 bg-defense-blue text-white text-[10px] font-cairo font-black rounded-lg border border-ink shadow-retro-sm active:shadow-none"
            >
              <Crosshair size={10} />
              <span>جرد</span>
            </button>
          )}

          {canCloseWindow && !confirmCloseWindow && (
            <button
              onClick={() => setConfirmCloseWindow(true)}
              className="flex items-center gap-0.5 px-1.5 sm:px-2 py-0.5 bg-prank-red text-white text-[10px] font-cairo font-black rounded-lg border border-ink shadow-retro-sm"
            >
              <DoorClosed size={10} />
              <span>قفل الشباك!</span>
            </button>
          )}

          {canCloseWindow && confirmCloseWindow && (
            <div className="flex items-center gap-1 bg-prank-red/15 px-1.5 py-0.5 rounded-lg border border-prank-red">
              <button
                onClick={() => {
                  setConfirmCloseWindow(false);
                  closeWindow(socket);
                }}
                className="px-1.5 py-0 bg-prank-red text-white text-[9.5px] font-cairo font-black rounded"
              >
                أكد القفل!
              </button>
              <button
                onClick={() => setConfirmCloseWindow(false)}
                className="px-1 py-0 bg-white text-ink text-[9.5px] font-cairo font-bold rounded border border-ink/30"
              >
                لأ
              </button>
            </div>
          )}

          {isMyTurn && (
            <button
              onClick={() => {
                setHoveredPreview(null);
                endTurn(socket);
              }}
              className="px-2 py-0.5 bg-ink text-white text-[10px] font-cairo font-bold rounded-lg border border-ink"
            >
              إنهاء
            </button>
          )}
        </div>
      </div>

      {/* Burn Cost Banner */}
      <AnimatePresence>
        {interactionMode?.type === 'burn_card' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex items-center justify-between px-3 py-1 bg-prank-red text-white text-[10.5px] font-cairo font-black"
          >
            <span className="flex items-center gap-1 truncate">
              <Flame size={12} />
              اختار كارت تاني من إيدك تحرقه كـ رسوم لـ «{CARD_DEFINITIONS[interactionMode.card.cardType].nameAr}»
            </span>
            <button
              onClick={() => setInteractionMode(null)}
              className="bg-white text-ink px-2 py-0.5 rounded border border-ink text-[9.5px] flex-shrink-0"
            >
              إلغاء
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fanned Overlapping Hand Cards Tray (All 1-7 cards visible together!) */}
      <div className="w-full overflow-visible pt-2 pb-1.5 px-2">
        <div className="flex items-end justify-center w-full" dir="ltr">
          {privateState.hand.map((card, i) => {
            const isDoc = isDocumentCard(card.cardType);
            const error = isDoc ? (canPlaceCardInSlot(card) ? null : 'مش متاح') : getPlayError(card.cardType);
            const isBurnSource =
              interactionMode?.type === 'burn_card' && interactionMode.card.instanceId === card.instanceId;
            const isBurnCandidate =
              interactionMode?.type === 'burn_card' && interactionMode.card.instanceId !== card.instanceId;
            const isHovered = hoveredCardId === card.instanceId;
            const fanDeg = (i - (handCount - 1) / 2) * (handCount > 5 ? 2.2 : 1.6);

            return (
              <motion.div
                key={card.instanceId}
                className={`flex-shrink-0 relative ${overlapClass}`}
                animate={{
                  rotate: isHovered || isBurnSource ? 0 : fanDeg,
                  y: isHovered ? -12 : isBurnCandidate ? -6 : Math.abs(i - (handCount - 1) / 2) * 1.4,
                  scale: isHovered ? 1.12 : 1,
                }}
                style={{ zIndex: isHovered ? 35 : isBurnSource ? 30 : i + 1 }}
                transition={{ type: 'spring', stiffness: 360, damping: 24 }}
                onPointerEnter={(e) => {
                  if (e.pointerType === 'touch') return;
                  setHoveredCardId(card.instanceId);
                  setHoveredPreview({
                    cardType: card.cardType,
                    badgeText: isDoc ? 'مستند لملفك' : 'كارت في إيدك',
                    statusText: isBurnCandidate
                      ? '🔥 اضغط لحرق الكارت ده كـ رسوم'
                      : error
                      ? error
                      : 'اضغط لمعاينة ولعب الكارت',
                    isError: Boolean(error) && !isBurnCandidate,
                  });
                }}
                onPointerLeave={(e) => {
                  if (e.pointerType === 'touch') return;
                  setHoveredCardId(prev => (prev === card.instanceId ? null : prev));
                  setHoveredPreview(null);
                }}
              >
                <CardComponent
                  cardType={card.cardType}
                  isSelected={isBurnSource}
                  isDimmed={(Boolean(error) && isMyTurn && !isBurnCandidate) || isBurnSource}
                  dimmedReason={isBurnSource ? 'المختار' : error || undefined}
                  onTap={() => handleCardTap(card)}
                  size="md"
                  className={isBurnCandidate ? 'ring-2 ring-prank-red animate-pulse' : ''}
                />
              </motion.div>
            );
          })}
          {privateState.hand.length === 0 && (
            <span className="text-xs font-cairo font-bold text-ink/40 py-4" dir="rtl">إيدك فاضية</span>
          )}
        </div>
      </div>
    </div>
  );
};
