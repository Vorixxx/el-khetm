// ========================
// EL-KHETM — Lobby (Home Screen)
// ========================

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Gamepad2, BookOpen, LogIn, Volume2, VolumeX } from 'lucide-react';
import { AVATAR_IDS, AVATAR_LABELS } from '@el-khetm/shared';
import type { AvatarId } from '@el-khetm/shared';
import { useGameStore } from '../store/useGameStore';
import { useSocket } from '../hooks/useSocket';
import { useSound } from '../hooks/useSound';
import { getAvatarImage, getAvatarFallback, getBackground, BRANDING } from '../config/assets';

export const Lobby: React.FC = () => {
  const { socket } = useSocket();
  const { play } = useSound();
  const {
    playerName, setPlayerName,
    avatarId, setAvatarId,
    createRoom, joinRoom, quickPlay,
    openModal,
    isMuted, toggleMute,
  } = useGameStore();

  const [roomCode, setRoomCode] = useState('');
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [logoError, setLogoError] = useState(false);

  const canProceed = playerName.trim().length >= 2;
  const playableAvatars = AVATAR_IDS.filter((a) => a !== 'bot');
  const bgUrl = getBackground('lobby_mobile');

  const handleCreate = () => {
    if (!canProceed) return;
    createRoom(socket);
  };

  const handleJoin = () => {
    if (!canProceed || roomCode.trim().length < 4) return;
    joinRoom(socket, roomCode.trim());
  };

  const handleQuickPlay = () => {
    if (!canProceed) return;
    quickPlay(socket, 3);
  };

  return (
    <div
      className="h-full w-full flex flex-col items-center justify-center relative overflow-y-auto py-4"
      style={{
        backgroundImage: `linear-gradient(rgba(244,239,230,0.45), rgba(244,239,230,0.55)), url('${bgUrl}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundColor: '#F4EFE6',
      }}
      dir="rtl"
    >
      <motion.div
        className="relative z-10 flex flex-col items-center gap-3.5 w-full max-w-sm mx-4 p-5 bg-manila/[0.96] rounded-2xl border-2 border-ink shadow-retro-lg"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <button
          onClick={() => {
            const wasMuted = isMuted;
            toggleMute();
            if (wasMuted) {
              setTimeout(() => play('card_flip'), 30);
            }
          }}
          className={`absolute top-3 left-3 p-2 rounded-full border-2 border-ink shadow-retro-sm transition-colors ${
            isMuted ? 'bg-stamp-red/15 text-stamp-red' : 'bg-white text-ink hover:bg-manila/60'
          }`}
          title={isMuted ? 'تشغيل الصوت' : 'كتم الصوت'}
        >
          {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>

        {/* Logo & Title */}
        <div className="flex flex-col items-center gap-1">
          {!logoError ? (
            <img
              src={BRANDING.logo}
              alt="الختم"
              className="w-16 h-16 object-contain drop-shadow"
              onError={() => setLogoError(true)}
            />
          ) : (
            <div className="w-16 h-16 bg-ink/10 rounded-xl border-2 border-ink flex items-center justify-center">
              <span className="text-3xl font-cairo font-black text-ink">🦅</span>
            </div>
          )}
          <h1 className="text-3xl font-cairo font-black text-ink tracking-tight">الختم</h1>
          <p className="text-xs font-cairo font-bold text-ink/70">لعبة أوراق المصلحة — ذاكرة، خداع، وختم النسر!</p>
        </div>

        {/* Name Input */}
        <div className="w-full">
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canProceed) handleQuickPlay();
            }}
            placeholder="اكتب اسمك هنا..."
            maxLength={14}
            className="w-full px-4 py-2 bg-white border-2 border-ink rounded-lg shadow-retro-sm font-cairo font-bold text-ink text-center placeholder:text-ink/35 focus:outline-none focus:ring-2 focus:ring-ink"
            dir="rtl"
          />
        </div>

        {/* Avatar Picker (Cosmetic) */}
        <div className="w-full flex flex-col gap-1.5">
          <div className="flex gap-2.5 justify-center">
            {playableAvatars.map((avId) => (
              <AvatarButton
                key={avId}
                avatarId={avId}
                isSelected={avatarId === avId}
                onSelect={() => setAvatarId(avId)}
              />
            ))}
          </div>
          <p className="text-[11px] font-cairo font-bold text-ink/60 text-center">
            الشخصية المختارة: <span className="text-ink font-black">{AVATAR_LABELS[avatarId]}</span>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="w-full flex flex-col gap-2">
          <button
            onClick={handleQuickPlay}
            disabled={!canProceed}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-wasta-gold text-white font-cairo font-bold rounded-lg border-2 border-ink shadow-retro active:shadow-none disabled:opacity-40 transition-all"
          >
            <Gamepad2 size={19} />
            لعب سريع ضد بوتات
          </button>

          <button
            onClick={handleCreate}
            disabled={!canProceed}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-doc-green text-white font-cairo font-bold rounded-lg border-2 border-ink shadow-retro active:shadow-none disabled:opacity-40 transition-all"
          >
            <Users size={19} />
            إنشاء غرفة جديدة
          </button>

          {!showCodeInput ? (
            <button
              onClick={() => setShowCodeInput(true)}
              disabled={!canProceed}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-defense-blue text-white font-cairo font-bold rounded-lg border-2 border-ink shadow-retro active:shadow-none disabled:opacity-40 transition-all"
            >
              <LogIn size={19} />
              دخول غرفة بكود
            </button>
          ) : (
            <motion.div
              className="flex gap-2"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
            >
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canProceed && roomCode.trim().length >= 4) handleJoin();
                }}
                placeholder="كود الغرفة"
                maxLength={4}
                className="flex-1 px-3 py-2 bg-white border-2 border-ink rounded-lg shadow-retro-sm font-cairo font-bold text-ink text-center tracking-widest uppercase placeholder:text-ink/35 focus:outline-none"
                dir="ltr"
              />
              <button
                onClick={handleJoin}
                disabled={!canProceed || roomCode.trim().length < 4}
                className="px-4 py-2 bg-defense-blue text-white font-cairo font-bold rounded-lg border-2 border-ink shadow-retro-sm active:shadow-none disabled:opacity-40 transition-all"
              >
                دخول
              </button>
            </motion.div>
          )}

          <button
            onClick={() => openModal('rules')}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white text-ink font-cairo font-bold rounded-lg border-2 border-ink shadow-retro-sm active:shadow-none transition-all"
          >
            <BookOpen size={17} />
            طريقة اللعب والقواعد الجديدة
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const AvatarButton: React.FC<{
  avatarId: AvatarId;
  isSelected: boolean;
  onSelect: () => void;
}> = ({ avatarId, isSelected, onSelect }) => {
  const [imgErr, setImgErr] = useState(false);
  const label = AVATAR_LABELS[avatarId];

  return (
    <motion.button
      onClick={onSelect}
      className={`flex flex-col items-center gap-1 p-1.5 rounded-lg border-2 transition-all
        ${isSelected
          ? 'border-ink bg-ink/10 shadow-retro-sm'
          : 'border-ink/15 bg-white/70 hover:bg-white'
        }`}
      whileTap={{ scale: 0.9 }}
    >
      <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-ink bg-white">
        {!imgErr ? (
          <img
            src={getAvatarImage(avatarId)}
            alt={label}
            className="w-full h-full object-cover"
            onError={() => setImgErr(true)}
          />
        ) : (
          <img src={getAvatarFallback(label)} alt={label} className="w-full h-full" />
        )}
      </div>
      <span className="text-[11px] font-cairo font-bold text-ink">{label}</span>
    </motion.button>
  );
};
