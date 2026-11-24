// ========================
// EL-KHETM — Player File (Bottom Seat Dossier + Meme Sticker Picker & Comic Bubble)
// ========================

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderOpen, Snowflake, X, MessageSquare } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { useSocket } from '../hooks/useSocket';
import { CORE_DOCUMENTS, CARD_DEFINITIONS, MEME_STICKERS } from '@el-khetm/shared';
import type { AvatarId, DocumentCardType } from '@el-khetm/shared';
import { getCardImage, getCardFallbackSvg, getAvatarImage, getAvatarFallback, getStickerImage } from '../config/assets';
import { Card as CardComponent } from './Card';

const DOC_LABELS: Record<DocumentCardType, string> = {
  id_copy: 'البطاقة',
  stamp_duty: 'الدمغة',
  manager_sign: 'الإمضاء',
  eagle_seal: 'الختم',
};

export const PlayerFile: React.FC = () => {
  const { socket } = useSocket();
  const { publicState, privateState, myPlayerId, setHoveredPreview, activeStickers, sendSticker } = useGameStore();
  const [inspectedDoc, setInspectedDoc] = useState<DocumentCardType | null>(null);
  const [myBubble, setMyBubble] = useState<string | null>(null);
  const [showStickerPicker, setShowStickerPicker] = useState(false);

  const myId = privateState?.playerId || myPlayerId || '';
  const lastEvent = publicState?.lastEvent ?? null;
  const mySticker = myId ? activeStickers[myId] : null;
  const stickerMeta = mySticker ? MEME_STICKERS.find(s => s.id === mySticker.stickerId) : null;

  useEffect(() => {
    if (!lastEvent || !myId) return;
    let msg: string | null = null;
    if (lastEvent.targetId === myId && lastEvent.bubbleTargetAr) {
      msg = lastEvent.bubbleTargetAr;
    } else if (lastEvent.actorId === myId && lastEvent.bubbleActorAr) {
      msg = lastEvent.bubbleActorAr;
    }
    if (!msg) return;
    setMyBubble(msg);
    const t = setTimeout(() => setMyBubble(null), 3500);
    return () => clearTimeout(t);
  }, [lastEvent?.id, myId]);

  if (!publicState) return null;

  const myPlayer = publicState.players.find(p => p.id === myId);
  if (!myPlayer) return null;

  const handleHoverEnter = (doc: DocumentCardType, isFilled: boolean, e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return;
    setHoveredPreview({
      cardType: doc,
      badgeText: isFilled ? 'في ملفك الشخصي ✓' : 'ورقة مطلوبة للملف',
      statusText: isFilled ? 'مستند مكتمل في ملفك!' : 'محتاج تنزّل الورقة دي في ملفك',
      isError: !isFilled,
    });
  };

  return (
    <>
      <div className="relative w-full flex flex-col items-center gap-1 px-2.5 py-1.5 bg-[#EFE6D2]/95 backdrop-blur-sm rounded-xl border-2 border-ink shadow-retro-sm">
        {/* Comic Meme Sticker Bubble */}
        <AnimatePresence>
          {mySticker && (
            <motion.div
              key={`my-sticker-${mySticker.timestamp}`}
              initial={{ opacity: 0, scale: 0.4, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.4 }}
              transition={{ type: 'spring', stiffness: 420, damping: 20 }}
              className="absolute bottom-full mb-1.5 right-3 z-30 pointer-events-none bg-white border-2 border-ink rounded-2xl shadow-retro p-1.5 flex flex-col items-center"
            >
              <img
                src={getStickerImage(mySticker.stickerId)}
                alt={stickerMeta?.labelAr || 'ميم'}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-contain bg-white"
              />
              {stickerMeta && (
                <span className="text-xs font-cairo font-black text-ink px-1">
                  {stickerMeta.labelAr}
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action speech bubble */}
        <AnimatePresence>
          {myBubble && !mySticker && (
            <div className="absolute -top-7 inset-x-0 z-30 flex justify-center pointer-events-none">
              <motion.div
                key={myBubble}
                initial={{ opacity: 0, scale: 0.75, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.75 }}
                className="whitespace-nowrap bg-white text-ink text-xs font-cairo font-black px-3 py-0.5 rounded-full border-2 border-ink shadow-retro-sm"
              >
                {myBubble}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Global Meme Sticker Picker Popover */}
        <AnimatePresence>
          {showStickerPicker && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.95 }}
              className="absolute bottom-full mb-2 left-0 right-0 z-40 bg-manila rounded-2xl border-2 border-ink shadow-retro-lg p-2.5"
              dir="rtl"
            >
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-xs sm:text-sm font-cairo font-black text-ink">🎭 استيكرات ميمز عالمية</span>
                <button
                  onClick={() => setShowStickerPicker(false)}
                  className="p-0.5 rounded-full hover:bg-ink/10"
                >
                  <X size={17} />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {MEME_STICKERS.map(st => (
                  <button
                    key={st.id}
                    onClick={() => {
                      sendSticker(socket, st.id);
                      setShowStickerPicker(false);
                    }}
                    className="flex flex-col items-center gap-0.5 p-1 rounded-xl border-2 border-ink/20 bg-white hover:border-ink hover:shadow-retro-sm active:scale-95 transition-all"
                  >
                    <img
                      src={getStickerImage(st.id)}
                      alt={st.labelAr}
                      className="w-14 h-14 rounded-lg object-contain"
                    />
                    <span className="text-[10px] font-cairo font-bold text-ink truncate w-full text-center">
                      {st.labelAr}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top Row: Avatar + Name + Dossier Progress + Sticker Chat Button */}
        <div className="w-full flex items-center justify-between text-xs font-cairo font-bold px-0.5">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full overflow-hidden border border-ink bg-white flex-shrink-0">
              <img
                src={getAvatarImage(myPlayer.avatarId as AvatarId)}
                alt={myPlayer.name}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = getAvatarFallback(myPlayer.name); }}
              />
            </div>
            <FolderOpen size={14} className="text-doc-green" />
            <span className="text-ink font-extrabold">
              ملف {myPlayer.name} ({myPlayer.file.length}/4)
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {myPlayer.isFrozen && (
              <span className="flex items-center gap-1 bg-defense-blue text-white px-2 py-0.5 rounded-full text-[10px] animate-pulse">
                <Snowflake size={11} />
                متجمد!
              </span>
            )}
            <button
              onClick={() => setShowStickerPicker(v => !v)}
              className="flex items-center gap-1 bg-[#FBBF24] text-ink px-2.5 py-0.5 rounded-full border-2 border-ink shadow-retro-sm active:shadow-none text-[11px] font-cairo font-black hover:bg-[#F59E0B] transition-colors"
              title="ابعت استيكر ميم"
            >
              <MessageSquare size={12} />
              <span>استيكر</span>
            </button>
          </div>
        </div>

        {/* 4 Document Slots (Big clear 3:4 Card Proportions) */}
        <div className="flex items-center justify-center gap-2.5 sm:gap-3.5 w-full">
          {CORE_DOCUMENTS.map(doc => {
            const isFilled = myPlayer.file.includes(doc);
            return (
              <DocSlot
                key={doc}
                docType={doc}
                isFilled={isFilled}
                onPointerEnter={(e) => handleHoverEnter(doc, isFilled, e)}
                onPointerLeave={() => setHoveredPreview(null)}
                onClick={() => setInspectedDoc(doc)}
              />
            );
          })}
        </div>
      </div>

      {/* Tap-to-Zoom Doc Inspector */}
      <AnimatePresence>
        {inspectedDoc && (
          <motion.div
            className="absolute inset-0 z-50 flex items-center justify-center bg-ink/70 backdrop-blur-sm p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setInspectedDoc(null)}
          >
            <motion.div
              className="relative flex flex-col items-center gap-3 bg-manila p-5 rounded-2xl border-2 border-ink shadow-retro-lg max-w-xs w-full"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              onClick={e => e.stopPropagation()}
              dir="rtl"
            >
              <button
                onClick={() => setInspectedDoc(null)}
                className="absolute top-3 left-3 w-8 h-8 rounded-full bg-white border-2 border-ink flex items-center justify-center"
              >
                <X size={16} />
              </button>
              <span
                className={`text-xs font-cairo font-bold px-3 py-0.5 rounded-full border ${
                  myPlayer.file.includes(inspectedDoc)
                    ? 'bg-doc-green text-white border-ink'
                    : 'bg-white text-ink/70 border-ink/30'
                }`}
              >
                {myPlayer.file.includes(inspectedDoc) ? '✓ موجود في ملفك' : 'لسه ناقص من ملفك'}
              </span>
              <CardComponent cardType={inspectedDoc} size="lg" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

const DocSlot: React.FC<{
  docType: DocumentCardType;
  isFilled: boolean;
  onPointerEnter: (e: React.PointerEvent) => void;
  onPointerLeave: () => void;
  onClick: () => void;
}> = ({ docType, isFilled, onPointerEnter, onPointerLeave, onClick }) => {
  const def = CARD_DEFINITIONS[docType];
  const label = DOC_LABELS[docType];

  return (
    <motion.button
      type="button"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onClick={onClick}
      whileHover={{ scale: 1.1, y: -3 }}
      whileTap={{ scale: 0.96 }}
      className="flex flex-col items-center gap-0.5 cursor-pointer focus:outline-none"
    >
      <div
        className={`w-14 sm:w-16 aspect-[3/4] rounded-lg border-2 overflow-hidden relative transition-shadow ${
          isFilled
            ? 'border-doc-green bg-white shadow-retro-sm'
            : 'border-dashed border-ink/30 bg-white/55 hover:border-ink/60'
        }`}
      >
        <AnimatePresence>
          {isFilled && (
            <motion.div
              initial={{ scale: 2.3, rotate: -15, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 20 }}
              className="w-full h-full"
            >
              <img
                src={getCardImage(docType)}
                alt={def.nameAr}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = getCardFallbackSvg(docType, def.nameAr, 'document');
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
        {!isFilled && (
          <div className="absolute inset-0 flex items-center justify-center p-0.5 text-center">
            <span className="text-[11px] sm:text-xs font-cairo font-bold text-ink/45 leading-tight">
              {label}
            </span>
          </div>
        )}
      </div>
      <span className={`text-[11px] sm:text-xs font-cairo font-extrabold ${isFilled ? 'text-doc-green' : 'text-ink/55'}`}>
        {label}
      </span>
    </motion.button>
  );
};
