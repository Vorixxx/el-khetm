// ========================
// EL-KHETM — App Root (Mobile 9:16 Phone Viewport Frame)
// ========================

import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from './store/useGameStore';
import { useSocket } from './hooks/useSocket';
import { useSound } from './hooks/useSound';
import { Lobby } from './components/Lobby';
import { WaitingRoom } from './components/WaitingRoom';
import { GameBoard } from './components/GameBoard';
import { TargetModal } from './components/TargetModal';
import { ReactionModal } from './components/ReactionModal';
import { ArchiveModal } from './components/ArchiveModal';
import { DiscardModal } from './components/DiscardModal';
import { RulesModal } from './components/RulesModal';
import { GameOverModal } from './components/GameOverModal';
import { WifiOff } from 'lucide-react';

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  override componentDidCatch(error: unknown) {
    console.error('El-Khetm UI Error:', error);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="h-full w-full flex flex-col items-center justify-center bg-manila p-6 text-center font-cairo" dir="rtl">
          <div className="bg-white border-2 border-ink rounded-2xl shadow-retro p-6 max-w-sm space-y-4">
            <h2 className="text-xl font-black text-prank-red">حصل عطل بسيط في الشاشة</h2>
            <p className="text-sm text-ink/75">اضغط الزرار عشان ترجع للصفحة الرئيسية وتكمل لعب.</p>
            <button
              onClick={() => {
                useGameStore.getState().reset();
                this.setState({ hasError: false });
              }}
              className="w-full py-3 bg-doc-green text-white font-bold rounded-xl border-2 border-ink shadow-retro"
            >
              الرجوع للرئيسية
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const App: React.FC = () => {
  const { socket, isConnected, isReconnecting, isVercelWithoutServer } = useSocket();
  const { play } = useSound();
  const { screen, toasts, setupSocketListeners } = useGameStore();

  useEffect(() => {
    const cleanup = setupSocketListeners(socket, play);
    return cleanup;
  }, [socket, play, setupSocketListeners]);

  return (
    <AppErrorBoundary>
      {/* Full-height 9:16 mobile portrait viewport centered on desktop */}
      <div className="h-full w-full flex items-center justify-center bg-[#2A1C16] sm:p-2 overflow-hidden">
        <div className="h-full w-full sm:h-[min(96dvh,920px)] sm:w-[clamp(420px,54dvh,520px)] sm:max-w-[96vw] sm:rounded-[28px] sm:border-[3px] sm:border-ink sm:shadow-[0_24px_60px_rgba(0,0,0,0.55)] font-cairo bg-manila text-ink relative overflow-hidden">
          {screen === 'lobby' && (
            <div className="h-full w-full">
              <Lobby />
            </div>
          )}
          {screen === 'waiting' && (
            <div className="h-full w-full">
              <WaitingRoom />
            </div>
          )}
          {screen === 'game' && (
            <div className="h-full w-full">
              <GameBoard />
            </div>
          )}

          {/* Modals (scoped cleanly inside the 9:16 phone container) */}
          <TargetModal />
          <ReactionModal />
          <ArchiveModal />
          <DiscardModal />
          <RulesModal />
          <GameOverModal />

          {/* Toast Overlay */}
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 w-[92%] flex flex-col items-center gap-1.5 pointer-events-none">
            <AnimatePresence>
              {toasts.map(toast => (
                <motion.div
                  key={toast.id}
                  initial={{ opacity: 0, y: -16, scale: 0.92 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.92 }}
                  className={`px-3.5 py-1.5 rounded-xl border-2 shadow-retro-sm font-cairo font-bold text-xs sm:text-sm text-center pointer-events-auto bg-manila ${
                    toast.type === 'success' ? 'border-doc-green text-doc-green' :
                    toast.type === 'danger' ? 'border-prank-red text-prank-red' :
                    toast.type === 'warning' ? 'border-wasta-gold text-wasta-gold' :
                    'border-ink text-ink'
                  }`}
                  dir="rtl"
                >
                  {toast.message}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Connection Status */}
          {!isConnected && (
            <div className="absolute bottom-2 inset-x-0 px-3 flex justify-center z-50 pointer-events-none">
              <div className="flex items-center gap-2 bg-prank-red/95 text-white px-4 py-1.5 rounded-full font-cairo text-xs font-bold shadow-lg text-center">
                <WifiOff size={14} className="flex-shrink-0" />
                <span>
                  {isVercelWithoutServer
                    ? 'السيرفر غير مربوط — أضف VITE_SERVER_URL على Vercel أو شغّل السيرفر'
                    : isReconnecting
                    ? 'جاري إعادة الاتصال...'
                    : 'غير متصل بالسيرفر'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppErrorBoundary>
  );
};

export default App;
