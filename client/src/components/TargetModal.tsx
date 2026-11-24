// ========================
// EL-KHETM — Target Selection Modal (Bottom Sheet)
// ========================

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { useSocket } from '../hooks/useSocket';
import { CARD_DEFINITIONS } from '@el-khetm/shared';
import type { AvatarId, DocumentCardType } from '@el-khetm/shared';
import { getAvatarImage, getAvatarFallback, getCardImage, getCardFallbackSvg } from '../config/assets';

export const TargetModal: React.FC = () => {
  const { socket } = useSocket();
  const { publicState, privateState, myPlayerId, activeModal, modalData, closeModal, playCard } = useGameStore();
  // Hooks MUST stay before any early return
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);

  const isOpen = activeModal === 'target';
  const { cardInstanceId, cardType } = modalData;

  useEffect(() => {
    setSelectedTarget(null);
  }, [isOpen, cardInstanceId]);

  const def = cardType ? CARD_DEFINITIONS[cardType as keyof typeof CARD_DEFINITIONS] : null;
  const canRender = Boolean(isOpen && publicState && cardInstanceId && cardType && def);

  const myId = privateState?.playerId || myPlayerId || '';
  const myPlayer = publicState?.players.find(p => p.id === myId);
  const needsDoc = cardType === 'come_tomorrow' || cardType === 'wasta';

  // Filter valid targets
  const opponents = canRender && publicState
    ? publicState.players.filter(p => {
        if (p.id === myId) return false;
        switch (cardType) {
          case 'system_down': return !p.isFrozen;
          case 'come_tomorrow': return p.file.length > 0;
          case 'missing_papers': return p.handCount > 0;
          case 'file_lost': return p.file.length > 0;
          case 'wasta': return p.file.some(d => !myPlayer?.file.includes(d));
          default: return true;
        }
      })
    : [];

  const targetPlayer = opponents.find(p => p.id === selectedTarget) ?? null;

  const handleClose = () => {
    setSelectedTarget(null);
    closeModal();
  };

  return (
    <AnimatePresence>
      {canRender && def && cardInstanceId && (
        <motion.div
          key="target-modal"
          className="absolute inset-0 z-50 flex items-end justify-center bg-ink/50 backdrop-blur-[1px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
        >
          <motion.div
            className="w-full max-w-md bg-manila rounded-t-2xl sm:rounded-2xl border-2 border-ink shadow-retro-lg p-4 pb-6 sm:pb-5 max-h-[80vh] overflow-y-auto"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            onClick={e => e.stopPropagation()}
            dir="rtl"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-cairo font-black text-lg text-ink">
                {targetPlayer && needsDoc ? 'اختر الورقة من ملفه' : 'اختر الخصم'}
              </h3>
              <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-ink/10 active:bg-ink/15">
                <X size={20} />
              </button>
            </div>

            {/* Card Info */}
            <div className="bg-white rounded-lg border-2 border-ink/20 px-3 py-2 mb-3">
              <span className="text-sm font-cairo font-extrabold" style={{ color: def.color }}>
                {def.nameAr}
              </span>
              <span className="text-xs font-cairo text-ink/70 mr-2">{def.descriptionAr}</span>
            </div>

            {/* Step 1: Select Opponent */}
            {(!targetPlayer || !needsDoc) && (
              <div className="flex flex-col gap-2">
                {opponents.length === 0 && (
                  <p className="text-sm font-cairo font-bold text-ink/60 text-center py-4">
                    مفيش خصم متاح للعب الكارت ده عليه
                  </p>
                )}
                {opponents.map(opp => (
                  <button
                    key={opp.id}
                    onClick={() => {
                      if (!needsDoc) {
                        playCard(socket, cardInstanceId, opp.id);
                        handleClose();
                      } else {
                        setSelectedTarget(opp.id);
                      }
                    }}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all hover:border-ink active:scale-[0.98] ${
                      selectedTarget === opp.id
                        ? 'border-ink bg-white shadow-retro-sm'
                        : 'border-ink/25 bg-white/90'
                    }`}
                  >
                    <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-ink bg-white flex-shrink-0">
                      <img
                        src={getAvatarImage(opp.avatarId as AvatarId)}
                        alt={opp.name}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).src = getAvatarFallback(opp.name); }}
                      />
                    </div>
                    <div className="flex-1 text-right">
                      <p className="font-cairo font-extrabold text-ink">{opp.name}</p>
                      <p className="text-xs font-cairo text-ink/65">
                        ملف: {opp.file.length}/4 · إيد: {opp.handCount}
                        {opp.isFrozen ? ' · ❄️ متجمد' : ''}
                      </p>
                    </div>
                    {/* Show doc badges if relevant */}
                    {opp.file.length > 0 && (
                      <div className="flex gap-1">
                        {opp.file.map((doc) => (
                          <span
                            key={doc}
                            className="text-[10px] font-cairo font-bold bg-doc-green/15 text-doc-green border border-doc-green/40 px-1.5 py-0.5 rounded"
                          >
                            {CARD_DEFINITIONS[doc].nameAr.split(' ')[0]}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Step 2: Select Document (for come_tomorrow / wasta) */}
            {targetPlayer && needsDoc && (
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setSelectedTarget(null)}
                  className="text-xs font-cairo font-bold text-defense-blue underline self-start mb-1"
                >
                  ← رجوع لاختيار الخصم ({targetPlayer.name})
                </button>
                {targetPlayer.file.map((doc: DocumentCardType) => {
                  const docDef = CARD_DEFINITIONS[doc];
                  const disabled = cardType === 'wasta' && Boolean(myPlayer?.file.includes(doc));
                  return (
                    <button
                      key={doc}
                      onClick={() => {
                        if (disabled) return;
                        playCard(socket, cardInstanceId, targetPlayer.id, doc);
                        handleClose();
                      }}
                      disabled={disabled}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border-2 transition-all ${
                        disabled
                          ? 'opacity-40 border-ink/15 bg-white/50 cursor-not-allowed'
                          : 'border-doc-green bg-white hover:shadow-retro-sm active:scale-[0.98]'
                      }`}
                    >
                      <div className="w-11 h-14 rounded-lg border-2 border-doc-green overflow-hidden bg-white flex-shrink-0">
                        <img
                          src={getCardImage(doc)}
                          alt={docDef.nameAr}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = getCardFallbackSvg(doc, docDef.nameAr, 'document');
                          }}
                        />
                      </div>
                      <div className="flex-1 text-right">
                        <p className="font-cairo font-extrabold text-ink">{docDef.nameAr}</p>
                        <p className="text-[11px] font-cairo text-ink/60">{docDef.descriptionAr}</p>
                      </div>
                      {disabled && (
                        <span className="text-[11px] font-cairo font-bold text-prank-red">عندك في ملفك</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
