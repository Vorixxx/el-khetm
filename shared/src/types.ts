// ========================
// EL-KHETM (الختم) — Shared Types (Simplified Memory & 4-Document Race)
// ========================

// === Card Types ===

export type CardCategory = 'document' | 'prank' | 'utility';

export type DocumentCardType = 'id_copy' | 'stamp_duty' | 'manager_sign' | 'eagle_seal';

export type PrankCardType =
  | 'system_down'
  | 'come_tomorrow'
  | 'missing_papers'
  | 'window_4'
  | 'medhat_vacation'
  | 'file_lost';

export type UtilityCardType =
  | 'breakfast_break'
  | 'wasta'
  | 'drawer_peek'
  | 'show_me_all'
  | 'desk_swap'
  | 'recommendation'
  | 'uncle_gamal';

export type CardType = DocumentCardType | PrankCardType | UtilityCardType;

export type PositionalTarget = 'next' | 'prev' | 'all' | null;

export interface CardDefinition {
  cardType: CardType;
  category: CardCategory;
  nameAr: string;
  /** Short 2-4 word crisp hint displayed clearly under large hand cards */
  shortEffectAr: string;
  descriptionAr: string;
  color: string;
  quantity: number;
  /** Fair positional targeting: next player, prev player, or all table players */
  positionalTarget: PositionalTarget;
  /** Whether this card triggers a 7s reaction window when targeting an opponent */
  triggersReaction: boolean;
  /** Whether player explicitly picks an opponent (respects Anti-Spam Round Immunity!) */
  targetsOpponent: boolean;
  /** Whether this card targets a specific dossier slot (0..3) of opponent */
  targetsSlot: boolean;
  /** Whether this card also picks one of caster's own dossier slots (0..3) */
  targetsOwnSlot: boolean;
  /** Whether this card can peek either own slot or opponent's slot */
  targetsAnySlot: boolean;
  /** Whether this card is global */
  isGlobal: boolean;
  /** Whether this card is reaction-only (breakfast_break) */
  isReactionOnly: boolean;
  /** Whether this card is self-only immediate utility */
  isSelfTarget: boolean;
}

export interface Card {
  instanceId: string;
  cardType: CardType;
}

// === Dossier Slot, Highlights & Player Types ===

export interface PublicDossierSlot {
  slotIndex: number;
  hasCard: boolean;
  /** Only revealed during final showdown / GAME_OVER */
  revealedCard: Card | null;
}

export interface SlotHighlight {
  id: string;
  playerId: string;
  slotIndex: number;
  kind: 'swapped' | 'stolen' | 'removed' | 'peeked';
  labelAr: string;
  expiresAt: number;
}

export interface SpotlightCardNotice {
  id: string;
  cardType: CardType;
  headlineAr: string;
  subtitleAr: string;
  actorName: string;
  targetName?: string;
  expiresAt: number;
}

export type CardMotionLocation =
  | { zone: 'deck' }
  | { zone: 'archive'; cardInstanceId?: string }
  | { zone: 'hand'; playerId: string; cardInstanceId?: string }
  | { zone: 'slot'; playerId: string; slotIndex: number };

export interface CardMotionEvent {
  id: string;
  from: CardMotionLocation;
  to: CardMotionLocation;
  cardType?: CardType;
  faceDown: boolean;
  labelAr?: string;
  durationMs: number;
  delayMs?: number;
  createdAt: number;
}

export interface PlayerFileSummary {
  playerId: string;
  uniqueDocsCount: number;
  filledSlotsCount: number;
  docsCollected: DocumentCardType[];
  hasCompleteFile: boolean;
}

export interface PublicPlayer {
  id: string;
  name: string;
  avatarId: string;
  isBot: boolean;
  isDisconnected: boolean;
  isFrozen: boolean;
  /** Anti-spam shield: prevents multiple targeted attacks before player's own next turn */
  isImmuneThisRound: boolean;
  /** Closed 4-slot dossier around the table */
  dossierSlots: PublicDossierSlot[];
  filledSlotCount: number;
  handCount: number;
  file: DocumentCardType[];
  fileSummary: PlayerFileSummary | null;
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
  | 'PEEK_START'
  | 'TURN_START'
  | 'DRAW_PHASE'
  | 'ACTION_PHASE'
  | 'PENDING_REACTION'
  | 'PENDING_ARCHIVE'
  | 'PENDING_TARGET_DISCARD'
  | 'DISCARD_PHASE'
  | 'TURN_END'
  | 'GAME_OVER';

export type WinReason = 'PERFECT_SEAL' | 'TWO_PM_TIMEOUT' | null;

export interface GlobalEffects {
  medhatVacationUntilPlayerId: string | null;
}

export interface PendingReaction {
  attackerId: string;
  attackerName: string;
  targetId: string;
  targetName: string;
  cardPlayed: Card;
  targetSlotIndex?: number;
  attackerSlotIndex?: number;
  expiresAt: number;
}

export interface PendingArchive {
  playerId: string;
  expiresAt: number;
}

export interface PendingTargetDiscard {
  attackerId: string;
  attackerName: string;
  targetId: string;
  count: number;
  expiresAt: number;
}

export interface ActivePeekInfo {
  targetPlayerId: string;
  slotIndex: number;
  card: Card;
  expiresAt: number;
}

export interface GameEventNotice {
  id: string;
  actorId: string;
  actorName: string;
  targetId?: string;
  targetName?: string;
  cardType?: CardType;
  targetSlotIndex?: number;
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
  peekStartExpiresAt: number | null;
  players: PublicPlayer[];
  deckCount: number;
  discardPileRecent: Card[];
  discardPileTop: Card | null;
  discardPileCount: number;
  globalEffects: GlobalEffects;
  pendingReaction: PendingReaction | null;
  pendingArchive: PendingArchive | null;
  pendingTargetDiscard: PendingTargetDiscard | null;
  recentSlotHighlights: SlotHighlight[];
  recentCardMotions: CardMotionEvent[];
  spotlightCard: SpotlightCardNotice | null;
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
  startPeeksRemaining: number;
  seenSlotsByPlayer: Record<string, number[]>;
  /** Slots this player previously memorized that were tampered/swapped behind their back */
  tamperedSlotsByPlayer: Record<string, number[]>;
  activePeek: ActivePeekInfo | null;
  /** Multiple revealed cards for "وريني كده اللي معاك" or start peeks */
  activeMultiPeek: ActivePeekInfo[] | null;
}

// === Lobby State ===

export interface LobbyState {
  roomCode: string;
  hostId: string;
  players: LobbyPlayer[];
  maxPlayers: number;
}

// === Socket Event Contracts ===

export interface PlayCardPayload {
  cardInstanceId: string;
  targetPlayerId?: string;
  targetSlotIndex?: number;
  ownSlotIndex?: number;
  /** playerId -> slotIndex map for "show_me_all" (وريني كده اللي معاك) */
  multiTargets?: Record<string, number>;
}

export interface ClientToServerEvents {
  'room:create': (data: { playerName: string; avatarId: string; sessionId: string }) => void;
  'room:join': (data: { roomCode: string; playerName: string; avatarId: string; sessionId: string }) => void;
  'room:reconnect': (data: { roomCode: string; sessionId: string }) => void;
  'room:quick_play': (data: { playerName: string; avatarId: string; sessionId: string; botCount: number }) => void;
  'room:add_bot': () => void;
  'room:remove_bot': (data: { botId: string }) => void;
  'room:start_game': () => void;
  'room:leave': () => void;

  'action:start_peek': (data: { slotIndex: number }) => void;
  'action:draw_card': () => void;
  'action:place_in_slot': (data: { cardInstanceId: string; slotIndex: number }) => void;
  'action:play_card': (data: PlayCardPayload) => void;
  'action:target_discard': (data: { cardInstanceIds: string[] }) => void;
  'action:end_turn': () => void;
  'action:react': (data: { block: boolean }) => void;
  'action:pick_archive': (data: { cardInstanceId: string }) => void;
  'action:discard_cards': (data: { cardInstanceIds: string[] }) => void;
  'action:send_sticker': (data: { stickerId: string }) => void;
}

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
  | 'card_slap'
  | 'card_match'
  | 'peek_chime'
  | 'prank_alarm'
  | 'shield_block'
  | 'tick_tock'
  | 'win_fanfare'
  | 'shutter_close'
  | 'swoosh'
  | 'buzz';

// === Avatar Definitions (Cosmetic) ===

export const AVATAR_IDS = ['student', 'employee', 'manager', 'bot'] as const;
export type AvatarId = typeof AVATAR_IDS[number];

export const AVATAR_LABELS: Record<AvatarId, string> = {
  student: 'الطالب',
  employee: 'الموظف',
  manager: 'المدير',
  bot: 'بوت',
};

export function roundToClockTime(round: number): string {
  const totalMinutes = (round - 1) * 12;
  const hours = 10 + Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const displayHour = hours > 12 ? hours - 12 : hours;
  const period = hours >= 12 ? 'م' : 'ص';
  const minuteStr = minutes.toString().padStart(2, '0');
  return `${displayHour}:${minuteStr} ${period}`;
}

export function roundToClockProgress(round: number): number {
  return Math.min((round - 1) / 19, 1);
}

// === Constants ===

export const GAME_CONSTANTS = {
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 6,
  DOSSIER_SLOTS: 4,
  START_PEEKS_COUNT: 2,
  STARTING_HAND_SIZE: 3,
  MAX_HAND_SIZE: 7,
  ACTIONS_PER_TURN: 2,
  MAX_ROUNDS: 20,
  PEEK_START_TIMER_MS: 16_000,
  ACTIVE_PEEK_DURATION_MS: 6_000,
  MULTI_PEEK_DURATION_MS: 7_500,
  SLOT_HIGHLIGHT_DURATION_MS: 4_000,
  CARD_MOTION_TTL_MS: 3_500,
  SPOTLIGHT_DURATION_MS: 3_200,
  DRAW_TIMER_MS: 32_000,
  TURN_TIMER_MS: 45_000,
  REACTION_TIMER_MS: 7_000,
  ARCHIVE_TIMER_MS: 18_000,
  TARGET_DISCARD_TIMER_MS: 15_000,
  DISCARD_TIMER_MS: 18_000,
  BOT_MIN_DELAY_MS: 2800,
  BOT_MAX_DELAY_MS: 3800,
  BOT_TURN_START_DELAY_MS: 2000,
  BOT_DRAW_DELAY_MS: 2200,
  BOT_TURN_END_PAUSE_MS: 2000,
  FROZEN_SKIP_DELAY_MS: 2600,
  BOT_REACTION_MIN_MS: 2000,
  BOT_REACTION_MAX_MS: 3000,
  ROOM_CLEANUP_TIMEOUT_MS: 5 * 60 * 1000,
  ROOM_CODE_LENGTH: 4,
} as const;

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
