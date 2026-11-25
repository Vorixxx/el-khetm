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
import { TargetDiscardModal } from './components/TargetDiscardModal';
import { DiscardModal } from './components/DiscardModal';
import { CardZoomModal } from './components/CardZoomModal';
import { StickerModal } from './components/StickerModal';
import { RulesModal } from './components/RulesModal';
import { GameOverModal } from './components/GameOverModal';
import { preloadGameAssets } from './config/assets';
import { WifiOff } from 'lucide-react';

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMessage: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): { hasError: boolean; errorMessage: string } {
    const msg = error instanceof Error ? error.message : String(error ?? '');
    return { hasError: true, errorMessage: msg };
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
            {this.state.errorMessage && (
              <p className="text-[11px] font-mono bg-manila/80 border border-ink/20 rounded-lg p-2 text-ink/70 break-all" dir="ltr">
                {this.state.errorMessage}
              </p>
            )}
            <button
              onClick={() => {
                try {
                  sessionStorage.removeItem('el-khetm-active-room');
                } catch {}
                useGameStore.getState().reset();
                this.setState({ hasError: false, errorMessage: '' });
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
    preloadGameAssets();
    return cleanup;
  }, [socket, play, setupSocketListeners]);

  return (
    <AppErrorBoundary>
      <div className="h-full w-full flex items-center justify-center bg-[#2A1C16] lg:p-3 overflow-hidden">
        <div className="safe-phone-frame h-full w-full lg:h-[min(96dvh,960px)] lg:w-[clamp(460px,58dvh,640px)] lg:max-w-[95vw] lg:rounded-[28px] lg:border-[3px] lg:border-ink lg:shadow-[0_24px_60px_rgba(0,0,0,0.55)] font-cairo bg-manila text-ink relative overflow-hidden">
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

          {/* Modals */}
          <TargetModal />
          <ReactionModal />
          <ArchiveModal />
          <TargetDiscardModal />
          <DiscardModal />
          <CardZoomModal />
          <StickerModal />
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
