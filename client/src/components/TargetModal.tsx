// ========================
// EL-KHETM — Target Selection Modal (Supports Immunity Shield + Multi-Player "وريني كده اللي معاك")
// ========================

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Eye, Shield } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { useSocket } from '../hooks/useSocket';
import { CARD_DEFINITIONS, SLOT_LABELS_AR } from '@el-khetm/shared';
import type { AvatarId, CardType } from '@el-khetm/shared';
import { getAvatarImage, getAvatarFallback, getCardBack } from '../config/assets';

export const TargetModal: React.FC = () => {
  const { socket } = useSocket();
  const { publicState, privateState, myPlayerId, activeModal, modalData, closeModal, playCard } = useGameStore();
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [multiSelections, setMultiSelections] = useState<Record<string, number>>({});

  const isOpen = activeModal === 'target';
  const { cardInstanceId, cardType, ownSlotIndex } = modalData;
  const myId = privateState?.playerId || myPlayerId || '';
  const isShowMeAll = cardType === 'show_me_all';

  useEffect(() => {
    setSelectedTarget(null);
    if (isOpen && isShowMeAll && publicState) {
      // Pre-select first unseen filled slot per player for super smooth 1-tap or customizable inspect
      const defaults: Record<string, number> = {};
      for (const p of publicState.players) {
        const seen = privateState?.seenSlotsByPlayer?.[p.id] ?? [];
        let idx = p.dossierSlots.findIndex((s, i) => s.hasCard && !seen.includes(i));
        if (idx === -1) idx = p.dossierSlots.findIndex(s => s.hasCard);
        if (idx !== -1) defaults[p.id] = idx;
      }
      setMultiSelections(defaults);
    } else {
      setMultiSelections({});
    }
  }, [isOpen, cardInstanceId, isShowMeAll]);

  const def = cardType ? CARD_DEFINITIONS[cardType as CardType] : null;
  const canRender = Boolean(isOpen && publicState && cardInstanceId && cardType && def);

  const needsSlot = Boolean(def && (def.targetsSlot || def.targetsAnySlot));
  const includeSelf = Boolean(def?.targetsAnySlot);

  const candidates = canRender && publicState
    ? publicState.players.filter(p => {
        if (!includeSelf && p.id === myId) return false;
        switch (cardType) {
          case 'come_tomorrow':
          case 'wasta':
          case 'file_lost':
          case 'desk_swap':
          case 'drawer_peek':
            return p.dossierSlots.some(s => s.hasCard);
          default:
            return true;
        }
      })
    : [];

  const targetPlayer = candidates.find(p => p.id === selectedTarget) ?? null;

  const handleClose = () => {
    setSelectedTarget(null);
    closeModal();
  };

  return (
    <AnimatePresence>
      {canRender && def && cardInstanceId && (
        <motion.div
          key="target-modal"
          className="absolute inset-0 z-50 flex items-end justify-center bg-ink/60"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
        >
          <motion.div
            className="w-full max-w-md bg-manila rounded-t-2xl sm:rounded-2xl border-2 border-ink shadow-retro-lg p-4 pb-6 sm:pb-5 max-h-[84vh] overflow-y-auto"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            onClick={e => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="font-cairo font-black text-base sm:text-lg text-ink">
                {isShowMeAll
                  ? '👀 وريني كده اللي معاك — اختار خانة لكل لاعب'
                  : targetPlayer && needsSlot
                  ? `اختر الخانة عند ${targetPlayer.id === myId ? 'ملفك' : targetPlayer.name}`
                  : 'اختر اللاعب المستهدف'}
              </h3>
              <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-ink/10">
                <X size={20} />
              </button>
            </div>

            <div className="bg-white rounded-lg border-2 border-ink/20 px-3 py-2 mb-3">
              <span className="text-sm font-cairo font-extrabold" style={{ color: def.color }}>
                {def.nameAr}
              </span>
              <span className="text-xs font-cairo text-ink/70 mr-2">{def.descriptionAr}</span>
            </div>

            {/* Special Table-Wide Inspection View for "وريني كده اللي معاك" */}
            {isShowMeAll && publicState && (
              <div className="flex flex-col gap-2.5">
                {publicState.players.map(p => {
                  const chosen = multiSelections[p.id];
                  return (
                    <div key={p.id} className="flex items-center justify-between gap-2 bg-white p-2.5 rounded-xl border border-ink/25">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-full overflow-hidden border border-ink flex-shrink-0">
                          <img
                            src={getAvatarImage(p.avatarId as AvatarId)}
                            alt={p.name}
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).src = getAvatarFallback(p.name); }}
                          />
                        </div>
                        <span className="text-xs font-cairo font-black text-ink truncate">
                          {p.name} {p.id === myId && '(أنت)'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {p.dossierSlots.map((slot, idx) => (
                          <button
                            key={idx}
                            disabled={!slot.hasCard}
                            onClick={() => setMultiSelections(prev => ({ ...prev, [p.id]: idx }))}
                            className={`w-8 h-9 rounded-lg border-2 font-cairo font-black text-xs transition-all ${
                              !slot.hasCard
                                ? 'opacity-25 border-ink/20 bg-manila cursor-not-allowed'
                                : chosen === idx
                                ? 'border-wasta-gold bg-defense-blue text-white shadow-sm scale-105'
                                : 'border-ink/30 bg-manila text-ink hover:border-ink'
                            }`}
                          >
                            {idx + 1}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
                <button
                  onClick={() => {
                    playCard(socket, {
                      cardInstanceId,
                      multiTargets: multiSelections,
                    });
                    handleClose();
                  }}
                  className="w-full py-2.5 bg-defense-blue text-white font-cairo font-bold rounded-xl border-2 border-ink shadow-retro active:shadow-none"
                >
                  👀 اكشف الخانات المختارة للكل سراً!
                </button>
              </div>
            )}

            {/* Step 1: Pick Player */}
            {!isShowMeAll && (!targetPlayer || !needsSlot) && (
              <div className="flex flex-col gap-2">
                {candidates.length === 0 && (
                  <p className="text-sm font-cairo font-bold text-ink/60 text-center py-4">
                    مفيش هدف متاح حالياً للكارت ده
                  </p>
                )}
                {candidates.map(cand => {
                  const isMe = cand.id === myId;
                  const isImmune = Boolean(def.targetsOpponent && cand.isImmuneThisRound);
                  const seenCount = privateState?.seenSlotsByPlayer?.[cand.id]?.length ?? 0;
                  return (
                    <button
                      key={cand.id}
                      disabled={isImmune}
                      onClick={() => {
                        if (isImmune) return;
                        if (!needsSlot) {
                          playCard(socket, {
                            cardInstanceId,
                            targetPlayerId: cand.id,
                            ownSlotIndex,
                          });
                          handleClose();
                        } else {
                          setSelectedTarget(cand.id);
                        }
                      }}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                        isImmune
                          ? 'opacity-45 border-defense-blue/30 bg-white/50 cursor-not-allowed'
                          : 'border-ink/25 bg-white/95 hover:border-ink active:scale-[0.98]'
                      }`}
                    >
                      <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-ink bg-white flex-shrink-0">
                        <img
                          src={getAvatarImage(cand.avatarId as AvatarId)}
                          alt={cand.name}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).src = getAvatarFallback(cand.name); }}
                        />
                      </div>
                      <div className="flex-1 text-right">
                        <p className="font-cairo font-extrabold text-ink flex items-center gap-1.5">
                          <span>{cand.name}</span>
                          {isMe && <span className="text-xs text-defense-blue">(ملفك أنت)</span>}
                          {isImmune && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] bg-defense-blue text-white px-1.5 py-0.5 rounded-full">
                              <Shield size={10} /> محصّن اللفة دي
                            </span>
                          )}
                        </p>
                        <p className="text-xs font-cairo text-ink/65">
                          خانات مليانة: {cand.filledSlotCount}/4 · إيد: {cand.handCount}
                          {seenCount > 0 ? ` · 👁️ شفت ${seenCount}` : ''}
                          {cand.isFrozen ? ' · ❄️ متجمد' : ''}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Step 2: Pick Slot #1..#4 */}
            {!isShowMeAll && targetPlayer && needsSlot && (
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => setSelectedTarget(null)}
                  className="text-xs font-cairo font-bold text-defense-blue underline self-start"
                >
                  ← رجوع لاختيار اللاعب ({targetPlayer.name})
                </button>

                <div className="grid grid-cols-4 gap-2">
                  {targetPlayer.dossierSlots.map((slot, idx) => {
                    const disabled = !slot.hasCard;
                    const wasSeen = privateState?.seenSlotsByPlayer?.[targetPlayer.id]?.includes(idx);

                    return (
                      <button
                        key={idx}
                        disabled={disabled}
                        onClick={() => {
                          if (disabled) return;
                          playCard(socket, {
                            cardInstanceId,
                            targetPlayerId: targetPlayer.id,
                            targetSlotIndex: idx,
                            ownSlotIndex,
                          });
                          handleClose();
                        }}
                        className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all ${
                          disabled
                            ? 'opacity-40 border-ink/20 bg-white/50 cursor-not-allowed'
                            : 'border-ink bg-white hover:border-wasta-gold shadow-retro-sm active:scale-95'
                        }`}
                      >
                        <div className="w-12 aspect-[3/4] rounded-md border border-ink overflow-hidden bg-[#5C1221] relative flex items-center justify-center">
                          {slot.hasCard ? (
                            <img src={getCardBack()} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[10px] font-cairo text-white/60">فاضي</span>
                          )}
                          {wasSeen && (
                            <span className="absolute top-0.5 left-0.5 bg-defense-blue text-white rounded-full p-0.5">
                              <Eye size={10} />
                            </span>
                          )}
                        </div>
                        <span className="text-[10.5px] font-cairo font-black text-ink">
                          {SLOT_LABELS_AR[idx]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
