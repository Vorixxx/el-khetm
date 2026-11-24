// ========================
// EL-KHETM — Top Bar HUD (Clock, Rules, Mute, Event Log Drawer, Exit)
// ========================

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, Volume2, VolumeX, ScrollText, LogOut, X } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { useSocket } from '../hooks/useSocket';
import { roundToClockTime, roundToClockProgress, CARD_DEFINITIONS } from '@el-khetm/shared';
import { getCardImage } from '../config/assets';

export const TopBarHUD: React.FC = () => {
  const { socket } = useSocket();
  const { publicState, isMuted, toggleMute, openModal, leaveRoom } = useGameStore();
  const [showHistory, setShowHistory] = useState(false);

  if (!publicState) return null;

  const round = publicState.roundNumber || 1;
  const clockTime = roundToClockTime(round);
  const progress = roundToClockProgress(round);
  const events = [...(publicState.eventHistory ?? [])].reverse();

  return (
    <>
      <div className="w-full flex-shrink-0 flex items-center justify-between px-2.5 pt-2 pb-1 z-20" dir="rtl">
        {/* Right: Office Clock + Round Counter */}
        <div className="flex items-center gap-2 bg-manila/95 backdrop-blur-sm px-2.5 py-1 rounded-xl border-2 border-ink shadow-retro-sm">
          <div className="relative w-9 h-9 flex-shrink-0">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
              <circle cx="18" cy="18" r="16" fill="#FFFFFFAA" stroke="#1E293B25" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="16" fill="none"
                stroke={progress > 0.75 ? '#B91C1C' : '#1E293B'}
                strokeWidth="3"
                strokeDasharray={`${progress * 100.5} 100.5`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[8px] font-cairo font-black text-ink" dir="ltr">
              {clockTime}
            </span>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[11px] sm:text-xs font-cairo font-extrabold text-ink">
              الساعة {clockTime}
            </span>
            <span className="text-[10px] font-cairo font-bold text-ink/65">
              جولة {round} / 20
            </span>
          </div>
        </div>

        {/* Left: Controls (Event History, Mute, Rules, Leave) */}
        <div className="flex items-center gap-1 bg-manila/95 backdrop-blur-sm px-2 py-1 rounded-xl border-2 border-ink shadow-retro-sm">
          <button
            onClick={() => setShowHistory(true)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-ink/10 active:bg-ink/15 transition-colors text-[11px] sm:text-xs font-cairo font-bold text-ink"
            title="سجل وشرح الحركات"
          >
            <ScrollText size={16} />
            <span>السجل</span>
          </button>

          <button
            onClick={toggleMute}
            className={`p-1.5 rounded-lg transition-colors ${
              isMuted ? 'bg-prank-red/15 text-prank-red hover:bg-prank-red/25' : 'hover:bg-ink/10 text-ink'
            }`}
            title={isMuted ? 'تشغيل الصوت' : 'كتم الصوت'}
          >
            {isMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
          </button>

          <button
            onClick={() => openModal('rules')}
            className="p-1.5 rounded-lg hover:bg-ink/10 active:bg-ink/15 transition-colors"
            title="طريقة اللعب"
          >
            <HelpCircle size={17} className="text-ink" />
          </button>

          <button
            onClick={() => leaveRoom(socket)}
            className="p-1.5 rounded-lg hover:bg-prank-red/10 text-prank-red active:bg-prank-red/20 transition-colors"
            title="خروج من الجيم"
          >
            <LogOut size={17} />
          </button>
        </div>
      </div>

      {/* Event History & Explanation Modal */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            className="absolute inset-0 z-50 flex items-center justify-center bg-ink/55 backdrop-blur-xs p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowHistory(false)}
          >
            <motion.div
              className="w-full max-w-md bg-manila rounded-2xl border-2 border-ink shadow-retro-lg max-h-[80vh] flex flex-col overflow-hidden"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              dir="rtl"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b-2 border-ink/15 bg-white/60">
                <div className="flex items-center gap-2">
                  <ScrollText size={18} className="text-ink" />
                  <h3 className="font-cairo font-black text-base text-ink">سجل وشرح الحركات</h3>
                </div>
                <button onClick={() => setShowHistory(false)} className="p-1 rounded-lg hover:bg-ink/10">
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {events.length === 0 ? (
                  <p className="text-center text-sm font-cairo text-ink/50 py-6">لسه مفيش حركات في الجيم</p>
                ) : (
                  events.map(ev => (
                    <div
                      key={ev.id}
                      className={`flex items-start gap-2.5 p-2.5 rounded-xl border-2 bg-white ${
                        ev.blocked
                          ? 'border-defense-blue'
                          : CARD_DEFINITIONS[ev.cardType].category === 'prank'
                          ? 'border-prank-red/60'
                          : 'border-doc-green/60'
                      }`}
                    >
                      <img
                        src={getCardImage(ev.cardType)}
                        alt={CARD_DEFINITIONS[ev.cardType].nameAr}
                        className="w-10 h-14 rounded border border-ink object-cover flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-cairo font-extrabold text-xs text-ink">{ev.headlineAr}</p>
                        <p className="font-cairo text-[11px] text-ink/75 mt-0.5 leading-relaxed">{ev.explanationAr}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
