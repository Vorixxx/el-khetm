// ========================
// EL-KHETM (الختم) — Shared Types
// ========================

// === Card Types ===

export type CardCategory = 'document' | 'prank' | 'utility';

export type DocumentCardType = 'id_copy' | 'stamp_duty' | 'manager_sign' | 'eagle_seal';

export type PrankCardType = 'system_down' | 'come_tomorrow' | 'missing_papers' | 'window_4' | 'medhat_vacation' | 'file_lost';

export type UtilityCardType = 'breakfast_break' | 'wasta' | 'recommendation' | 'uncle_gamal';

export type CardType = DocumentCardType | PrankCardType | UtilityCardType;

export interface CardDefinition {
  cardType: CardType;
  category: CardCategory;
  nameAr: string;
  descriptionAr: string;
  color: string;
  quantity: number;
  /** Whether this card triggers a 5s reaction window when played */
  triggersReaction: boolean;
  /** Whether this card targets a specific opponent */
  targetsOpponent: boolean;
  /** Whether this card targets a specific document in opponent's file */
  targetsDocument: boolean;
  /** Whether this card is global (no reaction window, no target) */
  isGlobal: boolean;
  /** Whether this card is reaction-only (breakfast_break) */
  isReactionOnly: boolean;
  /** Whether this card is self-targeting */
  isSelfTarget: boolean;
}

export interface Card {
  instanceId: string;
  cardType: CardType;
}

// === Player Types ===

export interface PublicPlayer {
  id: string;
  name: string;
  avatarId: string;
  isBot: boolean;
  isDisconnected: boolean;
  isFrozen: boolean;
  file: DocumentCardType[];
  handCount: number;
}

export interface LobbyPlayer {
  id: string;
  name: string;
  avatarId: string;
  isBot: boolean;
  isReady: boolean;
}

// === Game State Types ===

export type GamePhase =
  | 'LOBBY'
  | 'TURN_START'
  | 'ACTION_PHASE'
  | 'PENDING_REACTION'
  | 'PENDING_ARCHIVE'
  | 'DISCARD_PHASE'
  | 'TURN_END'
  | 'GAME_OVER';

export type WinReason = 'EAGLE_SEAL' | 'TWO_PM_TIMEOUT' | null;

export interface GlobalEffects {
  medhatVacationUntilPlayerId: string | null;
}

export interface PendingReaction {
  attackerId: string;
  attackerName: string;
  targetId: string;
  targetName: string;
  cardPlayed: Card;
  targetDoc?: DocumentCardType;
  expiresAt: number;
}

export interface PendingArchive {
  playerId: string;
  expiresAt: number;
}

export interface GameEventNotice {
  id: string;
  actorId: string;
  actorName: string;
  targetId?: string;
  targetName?: string;
  cardType: CardType;
  targetDoc?: DocumentCardType;
  blocked?: boolean;
  isFrozenSkip?: boolean;
  headlineAr: string;
  explanationAr: string;
  bubbleActorAr?: string;
  bubbleTargetAr?: string;
  timestamp: number;
}

export interface PublicGameState {
  roomCode: string;
  hostId: string;
  phase: GamePhase;
  roundNumber: number;
  currentTurnPlayerId: string;
  actionsRemaining: number;
  turnExpiresAt: number | null;
  players: PublicPlayer[];
  deckCount: number;
  discardPileTop: Card | null;
  discardPileCount: number;
  globalEffects: GlobalEffects;
  pendingReaction: PendingReaction | null;
  pendingArchive: PendingArchive | null;
  actionLog: string[];
  lastEvent: GameEventNotice | null;
  eventHistory: GameEventNotice[];
  winnerIds: string[] | null;
  winReason: WinReason;
}

export interface PrivateGameState {
  playerId: string;
  hand: Card[];
  archiveCards: Card[] | null;
}

// === Lobby State ===

export interface LobbyState {
  roomCode: string;
  hostId: string;
  players: LobbyPlayer[];
  maxPlayers: number;
}

// === Socket Event Contracts ===

// Client → Server Events
export interface ClientToServerEvents {
  'room:create': (data: { playerName: string; avatarId: string; sessionId: string }) => void;
  'room:join': (data: { roomCode: string; playerName: string; avatarId: string; sessionId: string }) => void;
  'room:reconnect': (data: { roomCode: string; sessionId: string }) => void;
  'room:quick_play': (data: { playerName: string; avatarId: string; sessionId: string; botCount: number }) => void;
  'room:add_bot': () => void;
  'room:remove_bot': (data: { botId: string }) => void;
  'room:start_game': () => void;
  'room:leave': () => void;
  'action:play_card': (data: { cardInstanceId: string; targetPlayerId?: string; targetDocument?: DocumentCardType }) => void;
  'action:end_turn': () => void;
  'action:react': (data: { block: boolean }) => void;
  'action:pick_archive': (data: { cardInstanceId: string }) => void;
  'action:discard_cards': (data: { cardInstanceIds: string[] }) => void;
  'action:send_sticker': (data: { stickerId: string }) => void;
}

// Server → Client Events
export interface ServerToClientEvents {
  'room:created': (data: { roomCode: string; playerId: string }) => void;
  'room:joined': (data: { roomCode: string; playerId: string }) => void;
  'room:error': (data: { message: string }) => void;
  'lobby:state': (data: LobbyState) => void;
  'game:public_state': (data: PublicGameState) => void;
  'game:private_state': (data: PrivateGameState) => void;
  'game:toast': (data: { message: string; type: 'info' | 'success' | 'warning' | 'danger' }) => void;
  'game:sound': (data: { sound: SoundEffect }) => void;
  'game:sticker': (data: { playerId: string; playerName: string; stickerId: string; timestamp: number }) => void;
}

// === Global Meme Stickers ===

export interface MemeSticker {
  id: string;
  labelAr: string;
  emoji: string;
}

export const MEME_STICKERS: MemeSticker[] = [
  { id: 'this_is_fine', labelAr: 'كله تحت السيطرة', emoji: '🔥' },
  { id: 'surprised_shock', labelAr: 'إيه الصدمة دي!', emoji: '😮' },
  { id: 'crying_laugh', labelAr: 'همووووت ضحك', emoji: '😂' },
  { id: 'table_cat', labelAr: 'أنا مالي؟', emoji: '😾' },
  { id: 'big_brain', labelAr: 'دماغ شغالة', emoji: '🧠' },
  { id: 'stonks', labelAr: 'كسبان كسبان', emoji: '📈' },
  { id: 'pain_coffee', labelAr: 'مبتسم من بره بس', emoji: '😬' },
  { id: 'cool_shades', labelAr: 'برنس القعدة', emoji: '😎' },
];

// === Sound Effects ===

export type SoundEffect =
  | 'stamp'
  | 'card_flip'
  | 'card_draw'
  | 'prank_alarm'
  | 'shield_block'
  | 'tick_tock'
  | 'win_fanfare'
  | 'shutter_close'
  | 'swoosh'
  | 'buzz';

// === Avatar Definitions ===

export const AVATAR_IDS = ['student', 'employee', 'manager', 'bot'] as const;
export type AvatarId = typeof AVATAR_IDS[number];

export const AVATAR_LABELS: Record<AvatarId, string> = {
  student: 'الطالب',
  employee: 'الموظف',
  manager: 'المدير',
  bot: 'بوت',
};

// === Clock Helper ===

/** Convert round number (1-20) to Arabic time string (10:00 ص to 2:00 م) */
export function roundToClockTime(round: number): string {
  const totalMinutes = (round - 1) * 12; // 12 minutes per round
  const hours = 10 + Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const displayHour = hours > 12 ? hours - 12 : hours;
  const period = hours >= 12 ? 'م' : 'ص';
  const minuteStr = minutes.toString().padStart(2, '0');
  return `${displayHour}:${minuteStr} ${period}`;
}

/** Get clock progress (0-1) from round number */
export function roundToClockProgress(round: number): number {
  return Math.min((round - 1) / 19, 1);
}

// === Constants ===

export const GAME_CONSTANTS = {
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 6,
  STARTING_HAND_SIZE: 5,
  MAX_HAND_SIZE: 7,
  ACTIONS_PER_TURN: 2,
  MAX_ROUNDS: 20,
  TURN_TIMER_MS: 30_000,
  REACTION_TIMER_MS: 5_000,
  ARCHIVE_TIMER_MS: 15_000,
  DISCARD_TIMER_MS: 15_000,
  BOT_MIN_DELAY_MS: 2200,
  BOT_MAX_DELAY_MS: 3000,
  BOT_TURN_START_DELAY_MS: 1400,
  BOT_TURN_END_PAUSE_MS: 1300,
  FROZEN_SKIP_DELAY_MS: 2200,
  BOT_REACTION_MIN_MS: 2200,
  BOT_REACTION_MAX_MS: 3200,
  ROOM_CLEANUP_TIMEOUT_MS: 5 * 60 * 1000, // 5 minutes
  ROOM_CODE_LENGTH: 4,
} as const;

// === Bot Names ===

export const BOT_NAMES = [
  'مدحت',
  'أم عبده',
  'عم جمال',
  'نجوى',
  'سعاد',
  'حسني',
  'فاطمة',
  'عادل',
  'سميرة',
  'محسن',
] as const;
