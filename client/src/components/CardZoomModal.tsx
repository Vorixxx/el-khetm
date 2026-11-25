// ========================
// EL-KHETM — Card Zoom & One-Tap Action Modal (Simplified Rules)
// ========================

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { CARD_DEFINITIONS, getCardPlayError, isDocumentCard } from '@el-khetm/shared';
import type { Card, CardType } from '@el-khetm/shared';
import { useGameStore } from '../store/useGameStore';
import { useSocket } from '../hooks/useSocket';
import { Card as CardComponent } from './Card';

export const CardZoomModal: React.FC = () => {
  const { socket } = useSocket();
  const {
    activeModal,
    modalData,
    closeModal,
    publicState,
    privateState,
    myPlayerId,
    setInteractionMode,
    playCard,
    openModal,
  } = useGameStore();

  const isOpen = activeModal === 'card_zoom';
  const handCard: Card | null = modalData.handCard ?? null;
  const cardType: CardType | undefined = handCard?.cardType ?? (modalData.cardType as CardType | undefined);
  const def = cardType ? CARD_DEFINITIONS[cardType] : null;

  if (!isOpen || !cardType || !def) {
    return <AnimatePresence>{null}</AnimatePresence>;
  }

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
  const isDoc = isDocumentCard(cardType);

  const getHandCardError = (): string | null => {
    if (!handCard || !publicState || !myPlayer || !privateState) return null;
    if (publicState.phase === 'PEEK_START') return 'احفظ ورقك الأول!';
    if (isMyDraw) return 'اسحب كارت الأول من الكومة!';
    if (!isMyTurn) return 'مش دورك دلوقتي';
    if (actionsLeft <= 0) return 'خلصت حركاتك';

    const err = getCardPlayError(cardType, myPlayer.file, medhatActive);
    if (err) return err;

    const myIdx = publicState.players.findIndex(p => p.id === myId);
    const nextP = myIdx >= 0 ? publicState.players[(myIdx + 1) % publicState.players.length] : null;
    const prevP = myIdx >= 0 ? publicState.players[(myIdx - 1 + publicState.players.length) % publicState.players.length] : null;
    const fairOpponents = publicState.players.filter(p => p.id !== myId && !p.isImmuneThisRound);

    if (def.positionalTarget === 'next') {
      if (!nextP || nextP.id === myId) return 'مفيش لاعب بعدك';
      if (cardType === 'system_down' && nextP.isFrozen) return `${nextP.name} (اللي بعدك) متجمد أصلاً`;
      if (cardType === 'missing_papers' && nextP.handCount === 0) return `${nextP.name} (اللي بعدك) إيده فاضية`;
    } else if (def.positionalTarget === 'prev') {
      if (!prevP || prevP.id === myId) return 'مفيش لاعب قبلك';
    }

    if (def.targetsOpponent) {
      if (fairOpponents.length === 0) return 'كل الخصوم محصّنين اللفة دي 🛡️';
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
    return null;
  };

  const playError = handCard ? getHandCardError() : null;

  const handlePlace = () => {
    if (!handCard || playError) return;
    closeModal();
    setInteractionMode({ type: 'place_in_slot', handCard });
  };

  const handlePlay = () => {
    if (!handCard || playError) return;
    closeModal();
    if (cardType === 'desk_swap' || cardType === 'wasta') {
      setInteractionMode({ type: 'pick_own_slot', card: handCard, purpose: cardType });
      return;
    }
    if (def.targetsOpponent || def.targetsAnySlot || cardType === 'show_me_all') {
      openModal('target', { cardInstanceId: handCard.instanceId, cardType });
      return;
    }
    playCard(socket, { cardInstanceId: handCard.instanceId });
  };

  return (
    <AnimatePresence>
      <motion.div
        key="card-zoom-root"
        className="absolute inset-0 z-50 flex items-center justify-center bg-ink/75 p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={closeModal}
      >
        <motion.div
          className="relative flex flex-col items-center gap-2.5 w-full max-w-[320px] max-h-[90dvh] overflow-y-auto py-1"
          initial={{ scale: 0.78, y: 24 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.78, y: 24 }}
          transition={{ type: 'spring', stiffness: 360, damping: 26 }}
          onClick={(e) => e.stopPropagation()}
          dir="rtl"
        >
          <button
            onClick={closeModal}
            className="self-start w-9 h-9 rounded-full bg-manila text-ink flex items-center justify-center border-2 border-ink shadow-retro-sm"
            aria-label="إغلاق"
          >
            <X size={18} />
          </button>

          <CardComponent cardType={cardType} size="lg" className="!w-[clamp(140px,38vw,184px)]" />

          <div className="bg-manila rounded-xl border-2 border-ink shadow-retro p-3.5 w-full">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="font-cairo font-black text-base sm:text-lg text-ink">{def.nameAr}</p>
              <span className="text-[10.5px] font-cairo font-bold px-2 py-0.5 rounded-full border border-ink/25 bg-white whitespace-nowrap">
                ×{def.quantity}
              </span>
            </div>
            <p className="font-cairo text-xs sm:text-sm text-ink/85 leading-relaxed mb-2">{def.descriptionAr}</p>
            <div className="flex flex-wrap gap-1">
              <span className="inline-block text-[10.5px] font-cairo font-bold px-2 py-0.5 rounded-full border border-ink/20 bg-white/80">
                {def.category === 'document'
                  ? '📄 مستند رسمي للملف'
                  : def.category === 'prank'
                  ? '💣 مقلب'
                  : '🛡️ ذكاء وحماية'}
              </span>
              {def.positionalTarget === 'next' && (
                <span className="text-[10.5px] font-cairo font-bold px-2 py-0.5 rounded-full bg-prank-red/10 text-prank-red border border-prank-red/30">
                  👉 يضرب اللي بعدك مباشرة
                </span>
              )}
              {def.positionalTarget === 'prev' && (
                <span className="text-[10.5px] font-cairo font-bold px-2 py-0.5 rounded-full bg-prank-red/10 text-prank-red border border-prank-red/30">
                  👈 يبدّل مع اللي قبلك مباشرة
                </span>
              )}
              {def.positionalTarget === 'all' && (
                <span className="text-[10.5px] font-cairo font-bold px-2 py-0.5 rounded-full bg-defense-blue/10 text-defense-blue border border-defense-blue/30">
                  👀 تفتيش على الكل
                </span>
              )}
            </div>
          </div>

          {handCard && (
            <div className="w-full flex flex-col gap-2">
              {playError ? (
                <div className="w-full text-center bg-manila text-prank-red px-3 py-2 rounded-xl border-2 border-prank-red text-xs font-cairo font-bold">
                  {playError}
                </div>
              ) : isDoc ? (
                <button
                  onClick={handlePlace}
                  className="w-full py-3 bg-doc-green text-white text-sm sm:text-base font-cairo font-black rounded-xl border-2 border-ink shadow-retro active:shadow-none"
                >
                  🗂️ نزّل في خانة من ملفك
                </button>
              ) : (
                <button
                  onClick={handlePlay}
                  className="w-full py-3 bg-defense-blue text-white text-sm sm:text-base font-cairo font-black rounded-xl border-2 border-ink shadow-retro active:shadow-none"
                >
                  ⚡ العب الكارت دلوقتي
                </button>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
