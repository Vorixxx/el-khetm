// ========================
// EL-KHETM — Zustand Game Store (Simplified El-Khetm State)
// ========================

import { create } from 'zustand';
import type {
  PublicGameState,
  PrivateGameState,
  LobbyState,
  SoundEffect,
  AvatarId,
  Card,
  CardType,
  CardMotionEvent,
  PlayCardPayload,
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
  | 'target_discard'
  | 'discard'
  | 'card_zoom'
  | 'stickers'
  | 'rules'
  | 'gameover'
  | null;

export interface ModalData {
  cardInstanceId?: string;
  cardType?: string;
  handCard?: Card;
  targetPlayerId?: string;
  ownSlotIndex?: number;
}

export type BoardInteractionMode =
  | { type: 'place_in_slot'; handCard: Card }
  | { type: 'pick_own_slot'; card: Card; purpose: 'desk_swap' | 'wasta' }
  | null;

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
  screen: ScreenState;
  setScreen: (screen: ScreenState) => void;

  myPlayerId: string | null;
  playerName: string;
  setPlayerName: (name: string) => void;
  avatarId: AvatarId;
  setAvatarId: (id: AvatarId) => void;

  isMuted: boolean;
  toggleMute: () => void;

  lobbyState: LobbyState | null;
  publicState: PublicGameState | null;
  privateState: PrivateGameState | null;

  interactionMode: BoardInteractionMode;
  setInteractionMode: (mode: BoardInteractionMode) => void;

  hoveredPreview: CardHoverPreview | null;
  setHoveredPreview: (preview: CardHoverPreview | null) => void;

  activeStickers: Record<string, { stickerId: string; timestamp: number }>;

  hiddenHandCardIds: Record<string, string[]>;
  hiddenSlotKeys: Record<string, string[]>;
  hiddenArchiveCardIds: Record<string, string[]>;
  revealFlightTarget: (motionId: string) => void;

  toasts: Toast[];
  addToast: (message: string, type: Toast['type']) => void;
  removeToast: (id: string) => void;

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

  startPeek: (socket: TypedSocket, slotIndex: number) => void;
  drawCard: (socket: TypedSocket) => void;
  placeInSlot: (socket: TypedSocket, cardInstanceId: string, slotIndex: number) => void;
  playCard: (socket: TypedSocket, payload: PlayCardPayload) => void;
  targetDiscard: (socket: TypedSocket, cardInstanceIds: string[]) => void;
  endTurn: (socket: TypedSocket) => void;
  react: (socket: TypedSocket, block: boolean) => void;
  pickArchive: (socket: TypedSocket, cardInstanceId: string) => void;
  discardCards: (socket: TypedSocket, cardInstanceIds: string[]) => void;
  sendSticker: (socket: TypedSocket, stickerId: string) => void;

  setupSocketListeners: (socket: TypedSocket, playSound: (s: SoundEffect) => void) => () => void;
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

  interactionMode: null,
  setInteractionMode: (interactionMode) => set({ interactionMode, hoveredPreview: null }),

  hoveredPreview: null,
  setHoveredPreview: (hoveredPreview) => set({ hoveredPreview }),

  activeStickers: {},

  hiddenHandCardIds: {},
  hiddenSlotKeys: {},
  hiddenArchiveCardIds: {},
  revealFlightTarget: (motionId) => set((s) => {
    const stripOwner = (record: Record<string, string[]>) => {
      let changed = false;
      const next: Record<string, string[]> = {};
      for (const [k, owners] of Object.entries(record)) {
        if (!owners.includes(motionId)) {
          next[k] = owners;
          continue;
        }
        changed = true;
        const filtered = owners.filter((id) => id !== motionId);
        if (filtered.length > 0) next[k] = filtered;
      }
      return changed ? next : record;
    };

    const nextHand = stripOwner(s.hiddenHandCardIds);
    const nextSlots = stripOwner(s.hiddenSlotKeys);
    const nextArchive = stripOwner(s.hiddenArchiveCardIds);
    if (
      nextHand === s.hiddenHandCardIds &&
      nextSlots === s.hiddenSlotKeys &&
      nextArchive === s.hiddenArchiveCardIds
    ) {
      return s;
    }
    return {
      hiddenHandCardIds: nextHand,
      hiddenSlotKeys: nextSlots,
      hiddenArchiveCardIds: nextArchive,
    };
  }),

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
      interactionMode: null,
      hoveredPreview: null,
      activeStickers: {},
    });
  },
  addBot: (socket) => { socket.emit('room:add_bot'); },
  removeBot: (socket, botId) => { socket.emit('room:remove_bot', { botId }); },
  startGame: (socket) => { socket.emit('room:start_game'); },

  startPeek: (socket, slotIndex) => {
    socket.emit('action:start_peek', { slotIndex });
  },
  drawCard: (socket) => {
    set({ interactionMode: null, hoveredPreview: null });
    socket.emit('action:draw_card');
  },
  placeInSlot: (socket, cardInstanceId, slotIndex) => {
    set({ interactionMode: null, hoveredPreview: null });
    socket.emit('action:place_in_slot', { cardInstanceId, slotIndex });
  },
  playCard: (socket, payload) => {
    set({ interactionMode: null, hoveredPreview: null });
    socket.emit('action:play_card', payload);
  },
  targetDiscard: (socket, cardInstanceIds) => {
    socket.emit('action:target_discard', { cardInstanceIds });
  },
  endTurn: (socket) => {
    set({ interactionMode: null, hoveredPreview: null });
    socket.emit('action:end_turn');
  },
  react: (socket, block) => { socket.emit('action:react', { block }); },
  pickArchive: (socket, cardInstanceId) => { socket.emit('action:pick_archive', { cardInstanceId }); },
  discardCards: (socket, cardInstanceIds) => { socket.emit('action:discard_cards', { cardInstanceIds }); },
  sendSticker: (socket, stickerId) => { socket.emit('action:send_sticker', { stickerId }); },

  // === Socket Listeners ===

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

    const seenMotionIds = new Set<string>();
    const motionFailsafes = new Map<string, ReturnType<typeof setTimeout>>();

    const onPublicState = (data: PublicGameState) => {
      const prev = get().publicState;
      const myId = get().privateState?.playerId || get().myPlayerId;

      if (data.phase === 'GAME_OVER' && get().screen === 'lobby' && !prev) {
        return;
      }

      const now = Date.now();
      const freshMotions: CardMotionEvent[] = [];
      for (const m of data.recentCardMotions ?? []) {
        if (seenMotionIds.has(m.id)) continue;
        seenMotionIds.add(m.id);
        const maxAge = (m.delayMs ?? 0) + (m.durationMs ?? 480) + 1200;
        if (now - m.createdAt <= maxAge) {
          freshMotions.push(m);
        }
      }
      if (seenMotionIds.size > 120) {
        const recent = Array.from(seenMotionIds).slice(-60);
        seenMotionIds.clear();
        for (const id of recent) seenMotionIds.add(id);
      }

      let nextHiddenHand = get().hiddenHandCardIds;
      let nextHiddenSlots = get().hiddenSlotKeys;
      let nextHiddenArchive = get().hiddenArchiveCardIds;

      if (freshMotions.length > 0) {
        const addOwner = (
          base: Record<string, string[]>,
          key: string,
          motionId: string,
        ): Record<string, string[]> => {
          const existing = base[key] ?? [];
          if (existing.includes(motionId)) return base;
          return { ...base, [key]: [...existing, motionId] };
        };

        for (const m of freshMotions) {
          let hidesSomething = false;
          if (m.to.zone === 'hand' && m.to.cardInstanceId) {
            nextHiddenHand = addOwner(nextHiddenHand, m.to.cardInstanceId, m.id);
            hidesSomething = true;
          } else if (m.to.zone === 'slot') {
            nextHiddenSlots = addOwner(nextHiddenSlots, `${m.to.playerId}:${m.to.slotIndex}`, m.id);
            hidesSomething = true;
          } else if (m.to.zone === 'archive' && m.to.cardInstanceId) {
            nextHiddenArchive = addOwner(nextHiddenArchive, m.to.cardInstanceId, m.id);
            hidesSomething = true;
          }

          if (hidesSomething) {
            const failMs = Math.min(2000, (m.delayMs ?? 0) + (m.durationMs ?? 480) + 520);
            const timer = setTimeout(() => {
              motionFailsafes.delete(m.id);
              get().revealFlightTarget(m.id);
            }, failMs);
            motionFailsafes.set(m.id, timer);
          }
        }
      }

      let nextModal = get().activeModal;
      let nextModalData = get().modalData;
      let nextInteraction = get().interactionMode;

      if (data.phase !== 'ACTION_PHASE' || data.currentTurnPlayerId !== myId) {
        nextInteraction = null;
      }

      if (nextModal === 'reaction' && data.phase !== 'PENDING_REACTION') {
        nextModal = null; nextModalData = {};
      }
      if (nextModal === 'archive' && data.phase !== 'PENDING_ARCHIVE') {
        nextModal = null; nextModalData = {};
      }
      if (nextModal === 'target_discard' && data.phase !== 'PENDING_TARGET_DISCARD') {
        nextModal = null; nextModalData = {};
      }
      if (nextModal === 'discard' && data.phase !== 'DISCARD_PHASE') {
        nextModal = null; nextModalData = {};
      }
      if (nextModal === 'target' && (data.phase !== 'ACTION_PHASE' || data.currentTurnPlayerId !== myId)) {
        nextModal = null; nextModalData = {};
      }

      if (data.phase === 'GAME_OVER' && prev?.phase !== 'GAME_OVER') {
        nextModal = 'gameover';
        saveActiveRoomCode(null);
      } else if (data.phase === 'PENDING_REACTION' && data.pendingReaction?.targetId === myId) {
        nextModal = 'reaction';
      } else if (data.phase === 'PENDING_ARCHIVE' && data.pendingArchive?.playerId === myId) {
        nextModal = 'archive';
      } else if (data.phase === 'PENDING_TARGET_DISCARD' && data.pendingTargetDiscard?.targetId === myId) {
        nextModal = 'target_discard';
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
        interactionMode: nextInteraction,
        hiddenHandCardIds: nextHiddenHand,
        hiddenSlotKeys: nextHiddenSlots,
        hiddenArchiveCardIds: nextHiddenArchive,
      });
    };

    const onPrivateState = (data: PrivateGameState) => {
      const pub = get().publicState;
      set({ privateState: data, myPlayerId: data.playerId });

      if (pub) {
        if (pub.phase === 'PENDING_REACTION' && pub.pendingReaction?.targetId === data.playerId) {
          set({ activeModal: 'reaction' });
        } else if (pub.phase === 'PENDING_ARCHIVE' && pub.pendingArchive?.playerId === data.playerId) {
          set({ activeModal: 'archive' });
        } else if (pub.phase === 'PENDING_TARGET_DISCARD' && pub.pendingTargetDiscard?.targetId === data.playerId) {
          set({ activeModal: 'target_discard' });
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

    const onSocketReconnect = () => { get().reconnectIfActive(socket); };
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

    if (socket.connected) onSocketConnect();

    return () => {
      for (const timer of motionFailsafes.values()) clearTimeout(timer);
      motionFailsafes.clear();
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
      interactionMode: null,
      hoveredPreview: null,
      activeStickers: {},
      hiddenHandCardIds: {},
      hiddenSlotKeys: {},
      hiddenArchiveCardIds: {},
    });
  },
}));
