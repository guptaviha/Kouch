import { z } from 'zod';

export const PROTOCOL_VERSION = 1 as const;

export const RoomPhaseSchema = z.enum(['lobby', 'playing', 'round_result', 'finished']);
export type RoomPhase = z.infer<typeof RoomPhaseSchema>;

export const QuestionTypeSchema = z.enum(['multiple_choice', 'open_ended', 'multi_part']);
export type QuestionType = z.infer<typeof QuestionTypeSchema>;

export const GameTypeSchema = z.enum(['trivia', 'rebus']);
export type GameType = z.infer<typeof GameTypeSchema>;

export const ParticipantRoleSchema = z.enum(['host', 'player']);
export type ParticipantRole = z.infer<typeof ParticipantRoleSchema>;

export const RoomErrorCodeSchema = z.enum([
  'INVALID_PROTOCOL',
  'INVALID_SESSION',
  'ROOM_NOT_FOUND',
  'ROOM_CLOSED',
  'HOST_ALREADY_ASSIGNED',
  'PARTICIPANT_ROLE_MISMATCH',
  'COMMAND_NOT_ALLOWED',
  'PACK_LOAD_FAILED',
  'INTERNAL_ERROR',
]);
export type RoomErrorCode = z.infer<typeof RoomErrorCodeSchema>;

export const PlayerWireSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  score: z.number(),
  avatar: z.string().min(1).optional(),
  isNewUser: z.boolean().optional(),
  connected: z.boolean().optional(),
});
export type PlayerWire = z.infer<typeof PlayerWireSchema>;

export const RoundResultEntrySchema = z.object({
  playerId: z.string().min(1),
  name: z.string().min(1),
  answer: z.string().nullable(),
  correct: z.boolean(),
  timeTaken: z.number().nullable(),
  points: z.number(),
  base: z.number(),
  bonus: z.number(),
  hintUsed: z.boolean(),
});
export type RoundResultEntry = z.infer<typeof RoundResultEntrySchema>;

const roomCodeSchema = z.string().trim().length(4).transform((value) => value.toUpperCase());
const optionalAvatarSchema = z.string().min(1).optional();
const optionalNameSchema = z.string().min(1).optional();
const optionalIdSchema = z.string().min(1).optional();

export const HostCreateRoomEventSchema = z.object({
  type: z.literal('fetch_room_for_game'),
  name: optionalNameSchema,
  pack: z.string().min(1).optional(),
  userId: optionalIdSchema,
  avatar: optionalAvatarSchema,
});

export const PlayerJoinRoomEventSchema = z.object({
  type: z.literal('join'),
  roomCode: roomCodeSchema,
  name: optionalNameSchema,
  userId: optionalIdSchema,
  avatar: optionalAvatarSchema,
});

export const StartGameEventSchema = z.object({
  type: z.literal('start_game'),
  roomCode: roomCodeSchema,
  playerId: z.string().min(1),
});

export const CloseRoomEventSchema = z.object({
  type: z.literal('close_room'),
  roomCode: roomCodeSchema,
});

export const PauseGameEventSchema = z.object({
  type: z.literal('pause_game'),
});

export const ResumeGameEventSchema = z.object({
  type: z.literal('resume_game'),
});

export const SubmitAnswerEventSchema = z.object({
  type: z.literal('submit_answer'),
  roomCode: roomCodeSchema,
  playerId: z.string().min(1),
  answer: z.string(),
});

export const UseHintEventSchema = z.object({
  type: z.literal('use_hint'),
  roomCode: roomCodeSchema,
  playerId: z.string().min(1),
});

export const ResetGameEventSchema = z.object({
  type: z.literal('reset_game'),
  roomCode: roomCodeSchema.optional(),
  playerId: optionalIdSchema,
  hostId: optionalIdSchema,
});

export const ExtendTimerEventSchema = z.object({
  type: z.literal('extend_timer'),
  roomCode: roomCodeSchema.optional(),
  playerId: optionalIdSchema,
  hostId: optionalIdSchema,
});

export const SkipTimerEventSchema = z.object({
  type: z.literal('skip_timer'),
  roomCode: roomCodeSchema.optional(),
  playerId: optionalIdSchema,
  hostId: optionalIdSchema,
});

export const PingEventSchema = z.object({
  type: z.literal('ping'),
});

export const MockEventSchema = z.object({
  type: z.literal('mock'),
  roomCode: roomCodeSchema.optional(),
});

export const ClientEventSchema = z.discriminatedUnion('type', [
  HostCreateRoomEventSchema,
  PlayerJoinRoomEventSchema,
  StartGameEventSchema,
  CloseRoomEventSchema,
  PauseGameEventSchema,
  ResumeGameEventSchema,
  SubmitAnswerEventSchema,
  UseHintEventSchema,
  ResetGameEventSchema,
  ExtendTimerEventSchema,
  SkipTimerEventSchema,
  PingEventSchema,
  MockEventSchema,
]);
export type ClientEvent = z.infer<typeof ClientEventSchema>;
export type ClientMessage = ClientEvent;

export const RoomCreatedEventSchema = z.object({
  type: z.literal('room_created'),
  roomCode: roomCodeSchema,
  player: PlayerWireSchema,
  pack: z.string().min(1).optional(),
  reused: z.boolean().optional(),
  players: z.array(PlayerWireSchema).optional(),
  state: RoomPhaseSchema.optional(),
});

export const LobbyUpdateEventSchema = z.object({
  type: z.literal('lobby_update'),
  roomCode: roomCodeSchema,
  players: z.array(PlayerWireSchema),
  state: RoomPhaseSchema,
});

export const RoomSnapshotSchema = z.object({
  roomCode: roomCodeSchema,
  state: RoomPhaseSchema,
  players: z.array(PlayerWireSchema),
  hostId: z.string().min(1).optional(),
  roundIndex: z.number().nullable().optional(),
  currentPartIndex: z.number().nullable().optional(),
  totalParts: z.number().nullable().optional(),
  timerEndsAt: z.number().nullable().optional(),
  totalQuestionDuration: z.number().nullable().optional(),
  pauseRemainingMs: z.number().nullable().optional(),
  closeReason: z.string().min(1).optional(),
  closedAt: z.number().nullable().optional(),
  stateVersion: z.number().int().nonnegative().default(0),
  protocolVersion: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
});
export type RoomSnapshot = z.infer<typeof RoomSnapshotSchema>;

export const RoomSnapshotEventSchema = z.object({
  type: z.literal('room_snapshot'),
  snapshot: RoomSnapshotSchema,
});

export const GameStateEventSchema = z.object({
  type: z.literal('game_state'),
  state: z.literal('playing'),
  roomCode: roomCodeSchema,
  roundIndex: z.number(),
  currentPartIndex: z.number().nullable().optional(),
  totalParts: z.number().nullable().optional(),
  question: z.string(),
  questionType: QuestionTypeSchema,
  prompts: z.array(z.string()).optional(),
  promptImages: z.array(z.string().nullable()).nullable().optional(),
  image: z.string().optional(),
  hint: z.string().optional(),
  timerEndsAt: z.number(),
  totalQuestionDuration: z.number(),
  answeredPlayers: z.array(z.string()).optional(),
});

export const RoundResultEventSchema = z.object({
  type: z.literal('round_result'),
  roomCode: roomCodeSchema,
  roundIndex: z.number(),
  results: z.array(RoundResultEntrySchema),
  leaderboard: z.array(PlayerWireSchema),
  correctAnswer: z.string(),
  nextTimerEndsAt: z.number(),
  nextTimerDurationMs: z.number(),
});

export const FinalLeaderboardEventSchema = z.object({
  type: z.literal('final_leaderboard'),
  roomCode: roomCodeSchema,
  leaderboard: z.array(PlayerWireSchema),
});

export const RoomClosedEventSchema = z.object({
  type: z.literal('room_closed'),
  roomCode: roomCodeSchema,
  reason: z.string().optional(),
});

export const GamePausedEventSchema = z.object({
  type: z.literal('game_paused'),
  roomCode: roomCodeSchema,
  pauseRemainingMs: z.number(),
});

export const GameResumedEventSchema = z.object({
  type: z.literal('game_resumed'),
  roomCode: roomCodeSchema,
  nextTimerEndsAt: z.number(),
});

export const TimerUpdatedEventSchema = z.object({
  type: z.literal('timer_updated'),
  roomCode: roomCodeSchema,
  timerEndsAt: z.number(),
  totalQuestionDuration: z.number(),
});

export const JoinedEventSchema = z.object({
  type: z.literal('joined'),
  roomCode: roomCodeSchema,
  player: PlayerWireSchema,
});

export const AnswerReceivedEventSchema = z.object({
  type: z.literal('answer_received'),
  roundIndex: z.number(),
});

export const PlayerAnsweredEventSchema = z.object({
  type: z.literal('player_answered'),
  roomCode: roomCodeSchema,
  playerId: z.string().min(1),
});

export const PlayerHintUsedEventSchema = z.object({
  type: z.literal('player_hint_used'),
  playerId: z.string().min(1),
});

export const MockAddedEventSchema = z.object({
  type: z.literal('mock_added'),
  roomCode: roomCodeSchema,
});

export const HostPromotedEventSchema = z.object({
  type: z.literal('host_promoted'),
  roomCode: roomCodeSchema,
  hostId: z.string().min(1),
});

export const PongEventSchema = z.object({
  type: z.literal('pong'),
});

export const ErrorEventSchema = z.object({
  type: z.literal('error'),
  message: z.string().min(1),
  code: RoomErrorCodeSchema.optional(),
  retryable: z.boolean().optional(),
});

export const ServerEventSchema = z.discriminatedUnion('type', [
  RoomCreatedEventSchema,
  RoomSnapshotEventSchema,
  LobbyUpdateEventSchema,
  GameStateEventSchema,
  RoundResultEventSchema,
  FinalLeaderboardEventSchema,
  RoomClosedEventSchema,
  GamePausedEventSchema,
  GameResumedEventSchema,
  TimerUpdatedEventSchema,
  JoinedEventSchema,
  AnswerReceivedEventSchema,
  PlayerAnsweredEventSchema,
  PlayerHintUsedEventSchema,
  MockAddedEventSchema,
  HostPromotedEventSchema,
  PongEventSchema,
  ErrorEventSchema,
]);
export type ServerEvent = z.infer<typeof ServerEventSchema>;
export type ServerMessage = ServerEvent;

export const ParticipantSessionSchema = z.object({
  participantId: z.string().min(1),
  role: ParticipantRoleSchema,
  roomCode: roomCodeSchema.optional(),
  displayName: z.string().min(1).optional(),
  avatar: z.string().min(1).optional(),
  protocolVersion: z.literal(PROTOCOL_VERSION).default(PROTOCOL_VERSION),
  exp: z.number().int().positive().optional(),
  nonce: z.string().min(1).optional(),
  issuedAt: z.number().int().positive().optional(),
});
export type ParticipantSession = z.infer<typeof ParticipantSessionSchema>;

export const ProtocolEnvelopeSchema = z.object({
  protocolVersion: z.literal(PROTOCOL_VERSION),
  event: z.unknown(),
});
export type ProtocolEnvelope<TEvent = unknown> = {
  protocolVersion: typeof PROTOCOL_VERSION;
  event: TEvent;
};

export const RoomCommandSchema = ClientEventSchema;
export type RoomCommand = ClientEvent;

export const SocketDataSchema = z.object({
  roomCode: roomCodeSchema.optional(),
  playerId: z.string().min(1).optional(),
  hostId: z.string().min(1).optional(),
});
export type SocketData = z.infer<typeof SocketDataSchema>;

export interface ClientToServerEvents {
  message: (payload: ClientEvent) => void;
  client: (payload: ClientEvent) => void;
}

export interface ServerToClientEvents {
  server: (payload: ServerEvent) => void;
}

function parseJsonIfNeeded(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return JSON.parse(value);
}

function safeParseJsonIfNeeded(value: unknown): unknown {
  try {
    return parseJsonIfNeeded(value);
  } catch (error) {
    return value;
  }
}

export function parseClientEvent(value: unknown): ClientEvent {
  return ClientEventSchema.parse(parseJsonIfNeeded(value));
}

export function safeParseClientEvent(value: unknown) {
  return ClientEventSchema.safeParse(safeParseJsonIfNeeded(value));
}

export function parseServerEvent(value: unknown): ServerEvent {
  return ServerEventSchema.parse(parseJsonIfNeeded(value));
}

export function isServerEvent(value: unknown): value is ServerEvent {
  return ServerEventSchema.safeParse(safeParseJsonIfNeeded(value)).success;
}

export function createProtocolEnvelope<TEvent>(event: TEvent): ProtocolEnvelope<TEvent> {
  return {
    protocolVersion: PROTOCOL_VERSION,
    event,
  };
}
