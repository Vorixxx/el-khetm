// ========================
// EL-KHETM — Waiting Room
// ========================

import React from 'react';
import { motion } from 'framer-motion';
import { Copy, Plus, Minus, Play, ArrowRight, Bot } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { useSocket } from '../hooks/useSocket';
import { getAvatarImage, getAvatarFallback, BACKGROUNDS } from '../config/assets';
import { GAME_CONSTANTS } from '@el-khetm/shared';
import type { AvatarId } from '@el-khetm/shared';

export const WaitingRoom: React.FC = () => {
  const { socket } = useSocket();
  const { lobbyState, myPlayerId, leaveRoom, addBot, removeBot, startGame, addToast } = useGameStore();

  if (!lobbyState) {
    return (
      <div
        className="h-full w-full flex flex-col items-center justify-center px-6"
        style={{
          backgroundImage: `linear-gradient(rgba(244,239,230,0.45), rgba(244,239,230,0.55)), url('${BACKGROUNDS.table_mobile}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundColor: '#F4EFE6',
        }}
        dir="rtl"
      >
        <div className="bg-manila/90 px-6 py-4 rounded-2xl border-2 border-ink shadow-retro font-cairo font-bold text-ink">
          جاري تجهيز الترابيزة...
        </div>
      </div>
    );
  }

  const { roomCode, hostId, players, maxPlayers } = lobbyState;
  const isHost = myPlayerId === hostId;
  const canStart = players.length >= GAME_CONSTANTS.MIN_PLAYERS;
  const canAddBot = players.length < maxPlayers;

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode).catch(() => {});
    addToast('تم نسخ الكود!', 'success');
  };

  return (
    <div
      className="h-full w-full flex flex-col items-center justify-center px-6"
      style={{
        backgroundImage: `linear-gradient(rgba(244,239,230,0.45), rgba(244,239,230,0.55)), url('${BACKGROUNDS.table_mobile}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundColor: '#F4EFE6',
      }}
      dir="rtl"
    >
      <motion.div
        className="w-full max-w-sm flex flex-col items-center gap-4 bg-manila/90 backdrop-blur-md p-5 rounded-2xl border-2 border-ink shadow-retro-lg"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* Room Code */}
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-sm font-cairo font-bold text-ink/70">كود الغرفة</span>
          <div className="flex items-center gap-3">
            <span
              className="text-4xl font-cairo font-black text-ink tracking-[0.3em] bg-white px-6 py-2.5 rounded-lg border-2 border-ink shadow-retro"
              dir="ltr"
            >
              {roomCode}
            </span>
            <button
              onClick={copyCode}
              className="p-3 bg-white border-2 border-ink rounded-lg shadow-retro-sm active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all"
              title="نسخ الكود"
            >
              <Copy size={20} />
            </button>
          </div>
        </div>

        {/* Player List */}
        <div className="w-full bg-white rounded-lg border-2 border-ink shadow-retro p-3">
          <p className="text-sm font-cairo font-bold text-ink/70 mb-2">
            اللاعبين ({players.length}/{maxPlayers})
          </p>
          <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
            {players.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-2 bg-manila rounded-lg border border-ink/20">
                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-ink bg-white flex-shrink-0">
                  <img
                    src={getAvatarImage(p.avatarId as AvatarId)}
                    alt={p.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = getAvatarFallback(p.name);
                    }}
                  />
                </div>
                <span className="font-cairo font-bold text-ink flex-1">
                  {p.name}
                  {p.id === myPlayerId && (
                    <span className="text-[10px] font-cairo text-doc-green mr-1.5">(أنت)</span>
                  )}
                </span>
                {p.isBot && (
                  <div className="flex items-center gap-1">
                    <Bot size={14} className="text-ink/50" />
                    {isHost && (
                      <button
                        onClick={() => removeBot(socket, p.id)}
                        className="p-1 text-prank-red hover:bg-prank-red/10 rounded"
                        title="إزالة البوت"
                      >
                        <Minus size={16} />
                      </button>
                    )}
                  </div>
                )}
                {p.id === hostId && (
                  <span className="text-[10px] font-cairo font-bold bg-wasta-gold text-white px-2 py-0.5 rounded-full">
                    هوست
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="w-full flex flex-col gap-2.5">
          {isHost && canAddBot && (
            <button
              onClick={() => addBot(socket)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-ink font-cairo font-bold rounded-lg border-2 border-ink shadow-retro-sm active:shadow-none transition-all"
            >
              <Plus size={18} />
              إضافة بوت
            </button>
          )}

          {isHost && (
            <button
              onClick={() => startGame(socket)}
              disabled={!canStart}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-doc-green text-white font-cairo font-bold rounded-lg border-2 border-ink shadow-retro active:shadow-none active:translate-x-[3px] active:translate-y-[3px] disabled:opacity-40 transition-all"
            >
              <Play size={20} />
              ابدأ الجيم
            </button>
          )}

          {!isHost && (
            <div className="text-center font-cairo font-bold text-ink/70 text-sm py-1">
              في انتظار باقي اللاعبين...
            </div>
          )}

          <button
            onClick={() => leaveRoom(socket)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white text-ink font-cairo font-bold rounded-lg border-2 border-ink/40 active:bg-ink/5 transition-all"
          >
            <ArrowRight size={18} />
            خروج
          </button>
        </div>
      </motion.div>
    </div>
  );
};
