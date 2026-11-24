// ========================
// EL-KHETM — Player Hand Dock (Hover Enlarge + Tap-to-Select & Play)
// ========================

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Maximize2, X } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { useSocket } from '../hooks/useSocket';
import { Card as CardComponent } from './Card';
import { CARD_DEFINITIONS, getCardPlayError } from '@el-khetm/shared';
import type { Card, CardType } from '@el-khetm/shared';

const CardZoomOverlay: React.FC<{
  card: Card;
  playError: string | null;
  onPlay: (card: Card) => void;
  onClose: () => void;
}> = ({ card, playError, onPlay, onClose }) => {
  const zDef = CARD_DEFINITIONS[card.cardType];

  return (
    <motion.div
      key="zoom-overlay"
      className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-ink/75 backdrop-blur-sm p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="relative flex flex-col items-center gap-3 w-full max-w-xs"
        initial={{ scale: 0.7, y: 60 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.7, y: 60 }}
        transition={{ type: 'spring', stiffness: 320, damping: 24 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -top-2 -left-2 w-10 h-10 rounded-full bg-manila text-ink flex items-center justify-center border-2 border-ink shadow-retro-sm z-10"
        >
          <X size={20} />
        </button>

        <CardComponent cardType={card.cardType} size="lg" />

        <div className="bg-manila rounded-xl border-2 border-ink shadow-retro p-4 w-full" dir="rtl">
          <p className="font-cairo font-black text-lg text-ink mb-1">{zDef.nameAr}</p>
          <p className="font-cairo text-sm text-ink/80 mb-3">{zDef.descriptionAr}</p>
          <div className="flex items-center justify-between">
            <span
              className={`text-[11px] font-cairo font-bold px-2.5 py-0.5 rounded-full border ${
                zDef.category === 'document'
                  ? 'bg-doc-green/10 text-doc-green border-doc-green/30'
                  : zDef.category === 'prank'
                  ? 'bg-prank-red/10 text-prank-red border-prank-red/30'
                  : 'bg-defense-blue/10 text-defense-blue border-defense-blue/30'
              }`}
            >
              {zDef.category === 'document' ? '📄 مستند' : zDef.category === 'prank' ? '💣 مقلب' : '🛡️ أداة'}
            </span>
            <span className="text-[11px] font-cairo font-bold text-ink/50">×{zDef.quantity} في الدِك</span>
          </div>
        </div>

        {playError ? (
          <div className="w-full text-center bg-manila text-prank-red px-4 py-2.5 rounded-xl border-2 border-prank-red text-sm font-cairo font-bold shadow-retro-sm">
            {playError}
          </div>
        ) : (
          <button
            onClick={() => onPlay(card)}
            className="w-full py-3 bg-doc-green text-white text-base font-cairo font-bold rounded-xl border-2 border-ink shadow-retro active:shadow-none transition-all"
          >
            🎴 العب الكارت
          </button>
        )}
      </motion.div>
    </motion.div>
  );
};

export const PlayerHand: React.FC = () => {
  const { socket } = useSocket();
  const { publicState, privateState, myPlayerId, playCard, endTurn, openModal, setHoveredPreview } = useGameStore();
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [zoomedCard, setZoomedCard] = useState<Card | null>(null);
  const [turnSecondsLeft, setTurnSecondsLeft] = useState<number | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);

  const myId = privateState?.playerId || myPlayerId || '';
  const myPlayer = publicState?.players.find(p => p.id === myId) ?? null;
  const isMyTurn = Boolean(
    publicState && myId && publicState.currentTurnPlayerId === myId && publicState.phase === 'ACTION_PHASE',
  );
  const actionsLeft = publicState?.actionsRemaining ?? 0;
  const medhatActive = publicState?.globalEffects.medhatVacationUntilPlayerId !== null;

  const getPlayError = useCallback((cardType: CardType): string | null => {
    if (!publicState || !myPlayer) return 'جاري التحميل...';
    if (!isMyTurn) return 'مش دورك دلوقتي';
    if (actionsLeft <= 0) return 'خلصت حركاتك';

    const err = getCardPlayError(cardType, myPlayer.file, medhatActive);
    if (err) return err;

    const def = CARD_DEFINITIONS[cardType];
    if (def.targetsOpponent) {
      const opponents = publicState.players.filter(p => p.id !== myId);
      switch (cardType) {
        case 'system_down':
          if (!opponents.some(p => !p.isFrozen)) return 'كل الخصوم متجمدين';
          break;
        case 'come_tomorrow':
        case 'file_lost':
          if (!opponents.some(p => p.file.length > 0)) return 'مفيش خصم عنده ملف';
          break;
        case 'missing_papers':
          if (!opponents.some(p => p.handCount > 0)) return 'مفيش خصم عنده كروت';
          break;
        case 'wasta':
          if (!opponents.some(p => p.file.some(d => !myPlayer.file.includes(d)))) return 'مفيش ورق تسرقه';
          break;
      }
    }
    if (cardType === 'uncle_gamal' && publicState.discardPileCount === 0) return 'الأرشيف فاضي';

    return null;
  }, [publicState, myPlayer, isMyTurn, actionsLeft, medhatActive, myId]);

  useEffect(() => {
    const expiresAt = publicState?.turnExpiresAt;
    if (!isMyTurn || !expiresAt) {
      setTurnSecondsLeft(null);
      return;
    }
    const tick = () => {
      setTurnSecondsLeft(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [isMyTurn, publicState?.turnExpiresAt]);

  useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };
  }, []);

  if (!publicState || !privateState || !myPlayer) return null;

  const handlePointerDown = (card: Card, e: React.PointerEvent) => {
    if (e.pointerType === 'touch') {
      longPressTriggered.current = false;
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      longPressTimer.current = setTimeout(() => {
        longPressTriggered.current = true;
        setZoomedCard(card);
      }, 380);
    }
  };

  const handlePointerUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleMouseHoverStart = (card: Card, e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return;
    setHoveredCardId(card.instanceId);
    const err = getPlayError(card.cardType);
    setHoveredPreview({
      cardType: card.cardType,
      badgeText: 'كارت في إيدك',
      statusText: err ? err : 'جاهز للعب — اضغط للعب',
      isError: Boolean(err),
    });
  };

  const handleMouseHoverEnd = (card: Card, e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return;
    setHoveredCardId(prev => (prev === card.instanceId ? null : prev));
    setHoveredPreview(null);
  };

  const handleCardTap = (card: Card) => {
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }

    if (selectedCardId === card.instanceId) {
      setZoomedCard(card);
    } else {
      setSelectedCardId(card.instanceId);
    }
  };

  const handlePlayCard = (card: Card) => {
    const error = getPlayError(card.cardType);
    if (error) return;

    const def = CARD_DEFINITIONS[card.cardType];
    setHoveredPreview(null);
    setHoveredCardId(null);
    if (def.targetsOpponent || def.targetsDocument) {
      openModal('target', { cardInstanceId: card.instanceId, cardType: card.cardType });
    } else {
      playCard(socket, card.instanceId);
    }
    setZoomedCard(null);
    setSelectedCardId(null);
  };

  const selectedCard = privateState.hand.find(c => c.instanceId === selectedCardId) ?? null;
  const selectedError = selectedCard ? getPlayError(selectedCard.cardType) : null;
  const selectedDef = selectedCard ? CARD_DEFINITIONS[selectedCard.cardType] : null;
  const currentTurnPlayerName =
    publicState.players.find(p => p.id === publicState.currentTurnPlayerId)?.name ?? '';

  return (
    <div className="w-full flex flex-col bg-manila/95 backdrop-blur-sm rounded-xl border-2 border-ink shadow-retro">
      {/* Turn Status Bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-ink/5 border-b border-ink/15 rounded-t-lg">
        <div className="flex items-center gap-2">
          {isMyTurn ? (
            <>
              <div className="w-2.5 h-2.5 rounded-full bg-doc-green animate-pulse" />
              <span className="text-xs sm:text-sm font-cairo font-extrabold text-ink">
                دورك دلوقتي — باقي {actionsLeft} حركة
              </span>
              {turnSecondsLeft !== null && (
                <span
                  className={`text-[11px] font-cairo font-bold px-2 py-0.5 rounded-full border ${
                    turnSecondsLeft <= 8
                      ? 'bg-prank-red text-white border-ink animate-pulse'
                      : 'bg-white text-ink border-ink/30'
                  }`}
                >
                  {turnSecondsLeft} ث
                </span>
              )}
            </>
          ) : (
            <>
              <Clock size={14} className="text-ink/55" />
              <span className="text-xs sm:text-sm font-cairo font-bold text-ink/75">
                دور {currentTurnPlayerName}...
              </span>
            </>
          )}
        </div>
        {isMyTurn && (
          <button
            onClick={() => {
              setSelectedCardId(null);
              setHoveredPreview(null);
              endTurn(socket);
            }}
            className="px-3 py-1 bg-ink text-white text-xs font-cairo font-bold rounded-lg border border-ink shadow-retro-sm hover:bg-ink/90 active:shadow-none transition-all"
          >
            إنهاء الدور
          </button>
        )}
      </div>

      {/* Selected Card Action Strip */}
      <AnimatePresence>
        {selectedCard && selectedDef && !zoomedCard && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-ink/15"
          >
            <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-white/85">
              <div className="flex-1 min-w-0" dir="rtl">
                <p className="text-xs sm:text-sm font-cairo font-extrabold text-ink truncate">{selectedDef.nameAr}</p>
                <p className="text-[11px] font-cairo text-ink/75 truncate">{selectedDef.descriptionAr}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => setZoomedCard(selectedCard)}
                  className="p-1.5 bg-manila text-ink rounded-lg border border-ink/40 hover:bg-ink/10 transition-colors"
                  title="تكبير الكارت"
                >
                  <Maximize2 size={14} />
                </button>
                {selectedError ? (
                  <span className="text-[10px] sm:text-xs font-cairo font-bold bg-prank-red/10 text-prank-red px-2.5 py-1 rounded-lg border border-prank-red/30 whitespace-nowrap">
                    {selectedError}
                  </span>
                ) : (
                  <button
                    onClick={() => handlePlayCard(selectedCard)}
                    className="px-3 py-1 bg-doc-green text-white text-xs font-cairo font-bold rounded-lg border-2 border-ink shadow-retro-sm active:shadow-none transition-all whitespace-nowrap"
                  >
                    العب الكارت
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hand Cards Tray */}
      <div className="w-full overflow-x-auto overflow-y-visible pt-2.5 pb-1.5 px-1.5 scrollbar-thin">
        <div className="flex items-end justify-center gap-1 w-max min-w-full mx-auto">
          {privateState.hand.map((card, i) => {
            const error = getPlayError(card.cardType);
            const isSelected = selectedCardId === card.instanceId;
            const isHovered = hoveredCardId === card.instanceId;
            const fanDeg = (i - (privateState.hand.length - 1) / 2) * 1.4;

            return (
              <motion.div
                key={card.instanceId}
                className="flex-shrink-0 relative"
                animate={{
                  rotate: isSelected || isHovered ? 0 : fanDeg,
                  y: isHovered ? -16 : 0,
                  scale: isHovered ? 1.12 : 1,
                }}
                style={{ zIndex: isHovered ? 30 : isSelected ? 25 : i + 1 }}
                transition={{ type: 'spring', stiffness: 360, damping: 24 }}
                onPointerDown={(e) => handlePointerDown(card, e)}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onPointerEnter={(e) => handleMouseHoverStart(card, e)}
                onPointerLeave={(e) => handleMouseHoverEnd(card, e)}
              >
                <CardComponent
                  cardType={card.cardType}
                  isSelected={isSelected}
                  isDimmed={Boolean(error) && isMyTurn}
                  dimmedReason={error || undefined}
                  onTap={() => handleCardTap(card)}
                  size="md"
                />
              </motion.div>
            );
          })}
          {privateState.hand.length === 0 && (
            <span className="text-sm font-cairo font-bold text-ink/40 py-6">إيدك فاضية</span>
          )}
        </div>
      </div>

      {/* Full-Screen Card Zoom Overlay */}
      <AnimatePresence>
        {zoomedCard && (
          <CardZoomOverlay
            card={zoomedCard}
            playError={getPlayError(zoomedCard.cardType)}
            onPlay={handlePlayCard}
            onClose={() => setZoomedCard(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
