// ========================
// EL-KHETM — Zustand Game Store
// ========================

import { create } from 'zustand';
import type {
  PublicGameState,
  PrivateGameState,
  LobbyState,
  DocumentCardType,
  SoundEffect,
  AvatarId,
  CardType,
} from '@el-khetm/shared';
import type { TypedSocket } from '../hooks/useSocket';
import { sessionId } from '../hooks/useSocket';

// === Types ===

export type ScreenState = 'lobby' | 'waiting' | 'game';

export interface Toast {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'danger';
  timestamp: number;
}

export type ModalType =
  | 'target'
  | 'reaction'
  | 'archive'
  | 'discard'
  | 'rules'
  | 'gameover'
  | null;

export interface ModalData {
  cardInstanceId?: string;
  cardType?: string;
  targetPlayerId?: string;
}

export interface CardHoverPreview {
  cardType: CardType;
  badgeText?: string;
  statusText?: string;
  isError?: boolean;
}

// === Persistence Keys ===
const ACTIVE_ROOM_KEY = 'el-khetm-active-room';

function getSavedRoomCode(): string | null {
  try {
    return sessionStorage.getItem(ACTIVE_ROOM_KEY);
  } catch {
    return null;
  }
}

function saveActiveRoomCode(roomCode: string | null): void {
  try {
    if (roomCode) {
      sessionStorage.setItem(ACTIVE_ROOM_KEY, roomCode);
    } else {
      sessionStorage.removeItem(ACTIVE_ROOM_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

// === Store Interface ===

interface GameStore {
  // Screen
  screen: ScreenState;
  setScreen: (screen: ScreenState) => void;

  // Player identity
  myPlayerId: string | null;
  playerName: string;
  setPlayerName: (name: string) => void;
  avatarId: AvatarId;
  setAvatarId: (id: AvatarId) => void;

  // Sound
  isMuted: boolean;
  toggleMute: () => void;

  // Lobby
  lobbyState: LobbyState | null;

  // Game state
  publicState: PublicGameState | null;
  privateState: PrivateGameState | null;

  // Hover card preview (desktop mouse hover for hand / file / archive)
  hoveredPreview: CardHoverPreview | null;
  setHoveredPreview: (preview: CardHoverPreview | null) => void;

  // Live Meme Stickers per player (auto-expiring)
  activeStickers: Record<string, { stickerId: string; timestamp: number }>;

  // Toast queue
  toasts: Toast[];
  addToast: (message: string, type: Toast['type']) => void;
  removeToast: (id: string) => void;

  // Modal
  activeModal: ModalType;
  modalData: ModalData;
  openModal: (modal: ModalType, data?: ModalData) => void;
  closeModal: () => void;

  // Socket actions
  createRoom: (socket: TypedSocket) => void;
  joinRoom: (socket: TypedSocket, roomCode: string) => void;
  quickPlay: (socket: TypedSocket, botCount?: number) => void;
  reconnectIfActive: (socket: TypedSocket) => void;
  leaveRoom: (socket: TypedSocket) => void;
  addBot: (socket: TypedSocket) => void;
  removeBot: (socket: TypedSocket, botId: string) => void;
  startGame: (socket: TypedSocket) => void;
  playCard: (socket: TypedSocket, cardInstanceId: string, targetPlayerId?: string, targetDocument?: DocumentCardType) => void;
  endTurn: (socket: TypedSocket) => void;
  react: (socket: TypedSocket, block: boolean) => void;
  pickArchive: (socket: TypedSocket, cardInstanceId: string) => void;
  discardCards: (socket: TypedSocket, cardInstanceIds: string[]) => void;
  sendSticker: (socket: TypedSocket, stickerId: string) => void;

  // Socket listener setup
  setupSocketListeners: (socket: TypedSocket, playSound: (s: SoundEffect) => void) => () => void;

  // Reset
  reset: () => void;
}

// === Helpers ===

let toastCounter = 0;
function makeToastId(): string {
  return `toast-${Date.now()}-${++toastCounter}`;
}

function getPersistedName(): string {
  return localStorage.getItem('el-khetm-player-name') || '';
}
function getPersistedAvatar(): AvatarId {
  return (localStorage.getItem('el-khetm-avatar-id') as AvatarId) || 'student';
}

function getPersistedMuted(): boolean {
  try {
    return localStorage.getItem('el-khetm-muted') === '1';
  } catch {
    return false;
  }
}

// === Store ===

export const useGameStore = create<GameStore>((set, get) => ({
  screen: 'lobby',
  setScreen: (screen) => set({ screen }),

  myPlayerId: null,
  playerName: getPersistedName(),
  setPlayerName: (name) => {
    localStorage.setItem('el-khetm-player-name', name);
    set({ playerName: name });
  },
  avatarId: getPersistedAvatar(),
  setAvatarId: (id) => {
    localStorage.setItem('el-khetm-avatar-id', id);
    set({ avatarId: id });
  },

  isMuted: getPersistedMuted(),
  toggleMute: () => set((s) => {
    const next = !s.isMuted;
    try { localStorage.setItem('el-khetm-muted', next ? '1' : '0'); } catch {}
    return { isMuted: next };
  }),

  lobbyState: null,
  publicState: null,
  privateState: null,

  hoveredPreview: null,
  setHoveredPreview: (hoveredPreview) => set({ hoveredPreview }),

  activeStickers: {},

  toasts: [],
  addToast: (message, type) => {
    const id = makeToastId();
    set((s) => ({
      toasts: [...s.toasts.slice(-4), { id, message, type, timestamp: Date.now() }],
    }));
    setTimeout(() => get().removeToast(id), 3200);
  },
  removeToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },

  activeModal: null,
  modalData: {},
  openModal: (modal, data = {}) => set({ activeModal: modal, modalData: data, hoveredPreview: null }),
  closeModal: () => set({ activeModal: null, modalData: {} }),

  // === Socket Actions ===

  createRoom: (socket) => {
    const { playerName, avatarId } = get();
    socket.emit('room:create', { playerName, avatarId, sessionId });
  },
  joinRoom: (socket, roomCode) => {
    const { playerName, avatarId } = get();
    socket.emit('room:join', { roomCode: roomCode.toUpperCase(), playerName, avatarId, sessionId });
  },
  quickPlay: (socket, botCount = 3) => {
    const { playerName, avatarId } = get();
    const safeName = playerName.trim() || 'لاعب';
    socket.emit('room:quick_play', { playerName: safeName, avatarId, sessionId, botCount });
  },
  reconnectIfActive: (socket) => {
    const savedRoom = get().publicState?.roomCode || get().lobbyState?.roomCode || getSavedRoomCode();
    if (savedRoom) {
      socket.emit('room:reconnect', { roomCode: savedRoom, sessionId });
    }
  },
  leaveRoom: (socket) => {
    socket.emit('room:leave');
    saveActiveRoomCode(null);
    set({
      screen: 'lobby',
      lobbyState: null,
      publicState: null,
      privateState: null,
      activeModal: null,
      modalData: {},
      hoveredPreview: null,
      activeStickers: {},
    });
  },
  addBot: (socket) => {
    socket.emit('room:add_bot');
  },
  removeBot: (socket, botId) => {
    socket.emit('room:remove_bot', { botId });
  },
  startGame: (socket) => {
    socket.emit('room:start_game');
  },
  playCard: (socket, cardInstanceId, targetPlayerId, targetDocument) => {
    socket.emit('action:play_card', { cardInstanceId, targetPlayerId, targetDocument });
  },
  endTurn: (socket) => {
    socket.emit('action:end_turn');
  },
  react: (socket, block) => {
    socket.emit('action:react', { block });
  },
  pickArchive: (socket, cardInstanceId) => {
    socket.emit('action:pick_archive', { cardInstanceId });
  },
  discardCards: (socket, cardInstanceIds) => {
    socket.emit('action:discard_cards', { cardInstanceIds });
  },
  sendSticker: (socket, stickerId) => {
    socket.emit('action:send_sticker', { stickerId });
  },

  // === Socket Listener Setup ===

  setupSocketListeners: (socket, playSound) => {
    const onCreated = (data: { roomCode: string; playerId: string }) => {
      saveActiveRoomCode(data.roomCode);
      set({ screen: 'waiting', myPlayerId: data.playerId });
      get().addToast(`تم إنشاء الغرفة: ${data.roomCode}`, 'success');
    };

    const onJoined = (data: { roomCode: string; playerId: string }) => {
      saveActiveRoomCode(data.roomCode);
      set({ screen: 'waiting', myPlayerId: data.playerId });
    };

    const onError = (data: { message: string }) => {
      if (
        (data.message === 'الغرفة مش موجودة' || data.message === 'مش لاقي حسابك في الغرفة دي') &&
        get().screen === 'lobby'
      ) {
        saveActiveRoomCode(null);
        return;
      }
      get().addToast(data.message, 'danger');
    };

    const onLobbyState = (data: LobbyState) => {
      set({ lobbyState: data });
    };

    const onPublicState = (data: PublicGameState) => {
      const prev = get().publicState;
      const myId = get().privateState?.playerId || get().myPlayerId;

      // Guard against stale GAME_OVER broadcast arriving right as player intentionally left to lobby
      if (data.phase === 'GAME_OVER' && get().screen === 'lobby' && !prev) {
        return;
      }

      let nextModal = get().activeModal;
      let nextModalData = get().modalData;

      // Close phase-specific modals if phase changed away from them
      if (nextModal === 'reaction' && data.phase !== 'PENDING_REACTION') {
        nextModal = null;
        nextModalData = {};
      }
      if (nextModal === 'archive' && data.phase !== 'PENDING_ARCHIVE') {
        nextModal = null;
        nextModalData = {};
      }
      if (nextModal === 'discard' && data.phase !== 'DISCARD_PHASE') {
        nextModal = null;
        nextModalData = {};
      }
      if (nextModal === 'target' && (data.phase !== 'ACTION_PHASE' || data.currentTurnPlayerId !== myId)) {
        nextModal = null;
        nextModalData = {};
      }

      // Open phase-specific modals when entered
      if (data.phase === 'GAME_OVER' && prev?.phase !== 'GAME_OVER') {
        nextModal = 'gameover';
        saveActiveRoomCode(null);
      } else if (data.phase === 'PENDING_REACTION' && data.pendingReaction && data.pendingReaction.targetId === myId) {
        nextModal = 'reaction';
      } else if (data.phase === 'PENDING_ARCHIVE' && data.pendingArchive && data.pendingArchive.playerId === myId) {
        nextModal = 'archive';
      } else if (data.phase === 'DISCARD_PHASE' && data.currentTurnPlayerId === myId) {
        nextModal = 'discard';
      }

      if (data.phase !== 'LOBBY' && get().screen !== 'game') {
        set({ screen: 'game' });
      }

      set({
        publicState: data,
        activeModal: nextModal,
        modalData: nextModalData,
      });
    };

    const onPrivateState = (data: PrivateGameState) => {
      const pub = get().publicState;
      set({ privateState: data, myPlayerId: data.playerId });

      // Ensure phase modal opens cleanly even if privateState arrived slightly after publicState
      if (pub) {
        if (pub.phase === 'PENDING_REACTION' && pub.pendingReaction?.targetId === data.playerId) {
          set({ activeModal: 'reaction' });
        } else if (pub.phase === 'PENDING_ARCHIVE' && pub.pendingArchive?.playerId === data.playerId) {
          set({ activeModal: 'archive' });
        } else if (pub.phase === 'DISCARD_PHASE' && pub.currentTurnPlayerId === data.playerId && data.hand.length > 7) {
          set({ activeModal: 'discard' });
        }
      }
    };

    const onToast = (data: { message: string; type: 'info' | 'success' | 'warning' | 'danger' }) => {
      get().addToast(data.message, data.type);
    };

    const onSound = (data: { sound: SoundEffect }) => {
      playSound(data.sound);
    };

    const onSticker = (data: { playerId: string; playerName: string; stickerId: string; timestamp: number }) => {
      const ts = data.timestamp || Date.now();
      set((s) => ({
        activeStickers: {
          ...s.activeStickers,
          [data.playerId]: { stickerId: data.stickerId, timestamp: ts },
        },
      }));
      setTimeout(() => {
        set((s) => {
          const current = s.activeStickers[data.playerId];
          if (!current || current.timestamp !== ts) return s;
          const next = { ...s.activeStickers };
          delete next[data.playerId];
          return { activeStickers: next };
        });
      }, 3600);
    };

    const onSocketReconnect = () => {
      get().reconnectIfActive(socket);
    };

    const onSocketConnect = () => {
      if (get().screen === 'lobby' && getSavedRoomCode()) {
        get().reconnectIfActive(socket);
      }
    };

    socket.on('connect', onSocketConnect);
    socket.on('room:created', onCreated);
    socket.on('room:joined', onJoined);
    socket.on('room:error', onError);
    socket.on('lobby:state', onLobbyState);
    socket.on('game:public_state', onPublicState);
    socket.on('game:private_state', onPrivateState);
    socket.on('game:toast', onToast);
    socket.on('game:sound', onSound);
    socket.on('game:sticker', onSticker);
    socket.io.on('reconnect', onSocketReconnect);

    // Trigger immediate check if socket is already connected on mount
    if (socket.connected) {
      onSocketConnect();
    }

    return () => {
      socket.off('connect', onSocketConnect);
      socket.off('room:created', onCreated);
      socket.off('room:joined', onJoined);
      socket.off('room:error', onError);
      socket.off('lobby:state', onLobbyState);
      socket.off('game:public_state', onPublicState);
      socket.off('game:private_state', onPrivateState);
      socket.off('game:toast', onToast);
      socket.off('game:sound', onSound);
      socket.off('game:sticker', onSticker);
      socket.io.off('reconnect', onSocketReconnect);
    };
  },

  reset: () => {
    saveActiveRoomCode(null);
    set({
      screen: 'lobby',
      lobbyState: null,
      publicState: null,
      privateState: null,
      toasts: [],
      activeModal: null,
      modalData: {},
      hoveredPreview: null,
      activeStickers: {},
    });
  },
}));
