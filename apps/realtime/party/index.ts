import type * as Party from 'partykit/server';
import { z } from 'zod';
import {
  ClientEventSchema,
  GameTypeSchema,
  ParticipantSessionSchema,
  PROTOCOL_VERSION,
  RoomSnapshotSchema,
  verifyParticipantSessionToken,
  type ClientEvent,
  type GameType,
  type ParticipantRole,
  type ParticipantSession,
  type PlayerWire,
  type RoomErrorCode,
  type RoomSnapshot,
  type ServerEvent,
} from '@kouch/contracts';
import {
  GameContentError,
  createGameContentService,
  type RoomPackDefinition,
} from '@kouch/game-content';
import {
  DEFAULT_ROUND_DURATION_MS,
  DEFAULT_ROUND_RESULT_DURATION_MS,
  DEFAULT_TIMER_EXTENSION_MS,
  advanceRound,
  closeRoom as closeRoomTransition,
  configureRoom,
  createRoomState,
  extendTimer,
  getCurrentRoundView,
  getLastRoundResult,
  getLeaderboard,
  pauseGame,
  resetGame,
  resumeGame,
  skipTimer,
  startGame,
  submitAnswer,
  upsertParticipant,
  useHint,
  type GameEngineErrorCode,
  type GameEngineEvent,
  type GameRoomState,
  type GameTransitionResult,
} from '@kouch/game-engine';

const PARTY_NAME = 'main';
const CHECKPOINT_STORAGE_KEY = 'room:checkpoint';
const INTERNAL_HEADER = 'x-kouch-internal';
const INTERNAL_TOKEN_HEADER = 'x-kouch-internal-token';
const DEBUG_TOKEN_HEADER = 'x-kouch-debug-token';
const ROOM_CODE_LENGTH = 4;
const ROOM_CREATE_ATTEMPTS = 12;
const INVALID_SESSION_WINDOW_MS = 15_000;
const INVALID_SESSION_LIMIT = 6;
const INVALID_SESSION_BLOCK_MS = 10_000;

type RuntimeEnv = Record<string, unknown>;

type ConnectionAttachment = {
  participantId: string;
  role: ParticipantRole;
};

const CreateRoomRequestSchema = z.object({
  participantId: z.string().min(1).optional(),
  displayName: z.string().min(1).optional(),
  avatar: z.string().min(1).optional(),
  protocolVersion: z.literal(PROTOCOL_VERSION).optional(),
  pack: z.string().min(1).optional(),
  packId: z.number().int().positive().optional(),
  gameType: GameTypeSchema.optional(),
});

const JoinRoomRequestSchema = z.object({
  participantId: z.string().min(1).optional(),
  displayName: z.string().min(1).optional(),
  avatar: z.string().min(1).optional(),
  protocolVersion: z.literal(PROTOCOL_VERSION).optional(),
});

const BootstrapHostRequestSchema = z.object({
  session: ParticipantSessionSchema,
  pack: z.string().min(1).optional(),
  packId: z.number().int().positive().optional(),
  gameType: GameTypeSchema.optional(),
});

const JoinAuthorizationRequestSchema = z.object({
  session: ParticipantSessionSchema,
});

function normalizeRoomCode(value: string): string {
  return value.trim().slice(0, ROOM_CODE_LENGTH).toUpperCase();
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asEnvString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function getSessionSecret(env: RuntimeEnv): string {
  const configuredSecret = asEnvString(env.KOUCH_SESSION_SECRET);
  if (configuredSecret) {
    return configuredSecret;
  }

  if (asEnvString(env.NODE_ENV) !== 'production') {
    return 'kouch-dev-session-secret';
  }

  throw new Error('KOUCH_SESSION_SECRET is required in production');
}

function createSession(params: {
  roomCode: string;
  role: ParticipantRole;
  participantId?: string;
  displayName?: string;
  avatar?: string;
  protocolVersion?: typeof PROTOCOL_VERSION;
}): ParticipantSession {
  return ParticipantSessionSchema.parse({
    participantId: params.participantId ?? crypto.randomUUID(),
    role: params.role,
    roomCode: normalizeRoomCode(params.roomCode),
    displayName: params.displayName,
    avatar: params.avatar,
    protocolVersion: params.protocolVersion ?? PROTOCOL_VERSION,
    nonce: crypto.randomUUID(),
    issuedAt: Date.now(),
  });
}

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeSession(session: ParticipantSession): string {
  return encodeBase64Url(JSON.stringify(session));
}

function parseMessagePayload(message: string | ArrayBuffer | ArrayBufferView): unknown {
  if (typeof message === 'string') {
    return JSON.parse(message);
  }

  const view = message instanceof ArrayBuffer
    ? new Uint8Array(message)
    : new Uint8Array(message.buffer, message.byteOffset, message.byteLength);

  return JSON.parse(new TextDecoder().decode(view));
}

function parseClientCommand(message: string | ArrayBuffer | ArrayBufferView): ClientEvent {
  const payload = parseMessagePayload(message);
  const candidate = isObject(payload) && 'event' in payload ? payload.event : payload;
  return ClientEventSchema.parse(candidate);
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init?.headers ?? {}),
    },
  });
}

function buildPartyWebSocketUrl(request: { url: string }, roomCode: string, encodedSession: string): string {
  const url = new URL(request.url);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = `/parties/${PARTY_NAME}/${roomCode}`;
  url.search = `session=${encodeURIComponent(encodedSession)}`;
  return url.toString();
}

async function parseSessionFromRequest(
  request: Party.Request,
  fallbackRoomCode: string,
  env: RuntimeEnv,
): Promise<ParticipantSession> {
  const url = new URL(request.url);
  const sessionToken = url.searchParams.get('session');

  if (sessionToken) {
    const session = await verifyParticipantSessionToken(sessionToken, getSessionSecret(env));
    return ParticipantSessionSchema.parse({
      ...session,
      roomCode: session.roomCode ?? fallbackRoomCode,
    });
  }

  throw new RoomRuntimeError('INVALID_SESSION', 'Missing signed session token', 401);
}

function hasInternalAccess(req: Party.Request, env: RuntimeEnv): boolean {
  if (req.headers.get(INTERNAL_HEADER) !== '1') {
    return false;
  }

  return req.headers.get(INTERNAL_TOKEN_HEADER) === getSessionSecret(env);
}

function getPackIdentifier(pack?: string, packId?: number): { selectedPack?: string; resolvedPackId?: number } {
  const selectedPack = pack ?? (typeof packId === 'number' ? String(packId) : undefined);
  const resolvedPackId = typeof packId === 'number'
    ? packId
    : selectedPack && /^\d+$/.test(selectedPack)
      ? Number(selectedPack)
      : undefined;

  return { selectedPack, resolvedPackId };
}

function toRoomErrorBody(code: RoomErrorCode, message: string, status: number, retryable = false) {
  return jsonResponse({ ok: false, error: { code, message, retryable } }, { status });
}

class RoomRuntimeError extends Error {
  constructor(
    readonly code: RoomErrorCode,
    message: string,
    readonly status = 400,
    readonly retryable = false,
  ) {
    super(message);
    this.name = 'RoomRuntimeError';
  }
}

function toRoomErrorResponse(error: unknown): Response {
  if (error instanceof Response) {
    return error;
  }

  if (error instanceof RoomRuntimeError) {
    return toRoomErrorBody(error.code, error.message, error.status, error.retryable);
  }

  if (error instanceof z.ZodError) {
    return toRoomErrorBody('INVALID_SESSION', error.issues[0]?.message ?? 'Invalid request payload', 400);
  }

  if (error instanceof Error) {
    return toRoomErrorBody('INTERNAL_ERROR', error.message, 500, true);
  }

  return toRoomErrorBody('INTERNAL_ERROR', 'Unknown room runtime error', 500, true);
}

function mapEngineError(code: GameEngineErrorCode): RoomErrorCode {
  switch (code) {
    case 'HOST_ALREADY_ASSIGNED':
      return 'HOST_ALREADY_ASSIGNED';
    case 'PARTICIPANT_ROLE_MISMATCH':
      return 'PARTICIPANT_ROLE_MISMATCH';
    case 'PACK_NOT_READY':
      return 'PACK_LOAD_FAILED';
    default:
      return 'COMMAND_NOT_ALLOWED';
  }
}

export default class Server implements Party.Server {
  readonly options = {
    hibernate: true,
  } as const;

  static async onFetch(req: Party.Request, lobby: Party.FetchLobby, _ctx: Party.ExecutionContext) {
    const url = new URL(req.url);

    if (url.pathname === '/healthz') {
      return jsonResponse({ ok: true, service: 'realtime', protocolVersion: PROTOCOL_VERSION });
    }

    if (url.pathname === '/api/rooms' && req.method === 'POST') {
      if (!hasInternalAccess(req, lobby.env)) {
        return toRoomErrorBody('COMMAND_NOT_ALLOWED', 'Web bootstrap access required', 403);
      }

      const body = CreateRoomRequestSchema.parse(await req.json());

      for (let attempt = 0; attempt < ROOM_CREATE_ATTEMPTS; attempt += 1) {
        const roomCode = Server.generateRoomCode();
        const session = createSession({
          roomCode,
          role: 'host',
          participantId: body.participantId,
          displayName: body.displayName,
          avatar: body.avatar,
          protocolVersion: body.protocolVersion,
        });
        const stub = lobby.parties[PARTY_NAME].get(roomCode);
        const response = await stub.fetch('/_internal/bootstrap-host', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            [INTERNAL_HEADER]: '1',
            [INTERNAL_TOKEN_HEADER]: getSessionSecret(lobby.env),
          },
          body: JSON.stringify({
            session,
            pack: body.pack,
            packId: body.packId,
            gameType: body.gameType,
          }),
        });

        if (response.ok) {
          const encodedSession = encodeSession(session);
          const payload = await response.json();
          return jsonResponse({
            ok: true,
            roomCode,
            session,
            encodedSession,
            websocketPath: `/parties/${PARTY_NAME}/${roomCode}`,
            websocketUrl: buildPartyWebSocketUrl(req, roomCode, encodedSession),
            snapshot: payload.snapshot,
          });
        }

        const errorBody = await response.json().catch(() => null);
        const errorCode = errorBody?.error?.code as RoomErrorCode | undefined;
        if (errorCode === 'HOST_ALREADY_ASSIGNED') {
          continue;
        }

        return response;
      }

      return toRoomErrorBody('INTERNAL_ERROR', 'Unable to allocate a room code', 503, true);
    }

    const joinMatch = url.pathname.match(/^\/api\/rooms\/([A-Za-z]{4})\/join$/);
    if (joinMatch && req.method === 'POST') {
      if (!hasInternalAccess(req, lobby.env)) {
        return toRoomErrorBody('COMMAND_NOT_ALLOWED', 'Web bootstrap access required', 403);
      }

      const roomCode = normalizeRoomCode(joinMatch[1]);
      const body = JoinRoomRequestSchema.parse(await req.json());
      const session = createSession({
        roomCode,
        role: 'player',
        participantId: body.participantId,
        displayName: body.displayName,
        avatar: body.avatar,
        protocolVersion: body.protocolVersion,
      });
      const stub = lobby.parties[PARTY_NAME].get(roomCode);
      const response = await stub.fetch('/_internal/authorize-join', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [INTERNAL_HEADER]: '1',
          [INTERNAL_TOKEN_HEADER]: getSessionSecret(lobby.env),
        },
        body: JSON.stringify({ session }),
      });

      if (!response.ok) {
        return response;
      }

      const payload = await response.json();
      const encodedSession = encodeSession(session);
      return jsonResponse({
        ok: true,
        roomCode,
        session,
        encodedSession,
        websocketPath: `/parties/${PARTY_NAME}/${roomCode}`,
        websocketUrl: buildPartyWebSocketUrl(req, roomCode, encodedSession),
        snapshot: payload.snapshot,
      });
    }

    return undefined;
  }

  private state: GameRoomState;
  private readonly connectionIndex = new Map<string, ConnectionAttachment>();
  private readonly participantConnections = new Map<string, Set<string>>();
  private invalidSessionWindowStartedAt = 0;
  private invalidSessionAttempts = 0;
  private invalidSessionBlockedUntil = 0;

  constructor(readonly room: Party.Room) {
    this.state = createRoomState({
      roomCode: normalizeRoomCode(room.id),
      protocolVersion: PROTOCOL_VERSION,
      now: Date.now(),
    });
  }

  private get roomCode() {
    return normalizeRoomCode(this.room.id);
  }

  private get gameContentService() {
    return createGameContentService({
      neonDatabaseUrl: asEnvString(this.room.env.NEXT_PUBLIC_NEON_URL),
      rebusApiBaseUrl: asEnvString(this.room.env.REBUS_API_BASE_URL),
      rebusApiKey: asEnvString(this.room.env.REBUS_PACKS_API_SECRET_KEY),
      fetch,
    });
  }

  static generateRoomCode(): string {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let value = '';
    for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
      value += letters[Math.floor(Math.random() * letters.length)];
    }
    return value;
  }

  async onStart() {
    const checkpoint = await this.room.storage.get<GameRoomState>(CHECKPOINT_STORAGE_KEY);
    if (checkpoint) {
      this.state = checkpoint;
      return;
    }

    this.state = createRoomState({
      roomCode: this.roomCode,
      protocolVersion: PROTOCOL_VERSION,
      now: Date.now(),
    });
  }

  async onConnect(connection: Party.Connection<ConnectionAttachment>, ctx: Party.ConnectionContext) {
    try {
      this.assertInvalidSessionThrottle();
      const session = await parseSessionFromRequest(ctx.request, this.roomCode, this.room.env);
      this.resetInvalidSessionThrottle();
      await this.attachConnection(connection, session);
    } catch (error) {
      this.recordInvalidSessionAttempt();
      if (error instanceof RoomRuntimeError) {
        this.sendRaw(connection, {
          type: 'error',
          code: error.code,
          message: error.message,
          retryable: error.retryable,
        });
        connection.close(4001, error.message);
        return;
      }

      const message = error instanceof z.ZodError
        ? 'Invalid participant session'
        : error instanceof Error
          ? error.message
          : 'Failed to attach session';
      this.sendRaw(connection, {
        type: 'error',
        code: 'INVALID_SESSION',
        message,
      });
      connection.close(4001, message);
    }
  }

  async onMessage(message: string | ArrayBuffer | ArrayBufferView, sender: Party.Connection<ConnectionAttachment>) {
    try {
      const command = parseClientCommand(message);
      await this.applyCommand(command, sender);
    } catch (error) {
      if (error instanceof RoomRuntimeError) {
        this.sendError(sender, error.code, error.message, error.retryable);
        return;
      }

      const messageText = error instanceof z.ZodError
        ? 'Invalid client event payload'
        : error instanceof Error
          ? error.message
          : 'Unable to process command';
      this.sendError(sender, 'INVALID_PROTOCOL', messageText, true);
    }
  }

  async onClose(connection: Party.Connection<ConnectionAttachment>) {
    const attachment = this.connectionIndex.get(connection.id) ?? connection.state ?? null;
    if (!attachment) {
      return;
    }

    this.connectionIndex.delete(connection.id);
    const participantConnectionIds = this.participantConnections.get(attachment.participantId);
    if (participantConnectionIds) {
      participantConnectionIds.delete(connection.id);
      if (participantConnectionIds.size === 0) {
        this.participantConnections.delete(attachment.participantId);
      }
    }

    await this.broadcastSnapshot();
    this.broadcastLobbyUpdate();
    await this.cleanupIfClosedAndIdle();
  }

  async onRequest(req: Party.Request) {
    const url = new URL(req.url);

    if (url.pathname === '/health') {
      return jsonResponse({
        ok: true,
        roomCode: this.roomCode,
        state: this.state.phase,
        stateVersion: this.state.stateVersion,
      });
    }

    if (url.pathname === '/metadata') {
      return jsonResponse({
        roomCode: this.roomCode,
        state: this.state.phase,
        playerCount: this.getPlayerParticipants().length,
        hasHost: Boolean(this.state.hostParticipantId),
        closed: Boolean(this.state.closedAt),
      });
    }

    if (url.pathname === '/debug') {
      if (!this.isDebugRequestAllowed(req)) {
        return toRoomErrorBody('COMMAND_NOT_ALLOWED', 'Debug access denied', 403);
      }

      return jsonResponse({
        snapshot: this.buildSnapshot(),
        participants: this.state.participants,
        connectionIndex: Array.from(this.connectionIndex.entries()),
        participantConnections: Array.from(this.participantConnections.entries()).map(([participantId, ids]) => ({
          participantId,
          connectionIds: Array.from(ids),
        })),
        selectedPack: this.state.selectedPack,
        hasPackDefinition: Boolean(this.state.packDefinition),
        roundView: getCurrentRoundView(this.state),
        lastRoundResult: getLastRoundResult(this.state),
      });
    }

    if (req.method === 'POST' && url.pathname === '/_internal/bootstrap-host') {
      if (!hasInternalAccess(req, this.room.env)) {
        return toRoomErrorBody('COMMAND_NOT_ALLOWED', 'Internal bootstrap only', 403);
      }

      try {
        const body = BootstrapHostRequestSchema.parse(await req.json());
        const response = await this.bootstrapHost(body.session, body.pack, body.packId, body.gameType);
        return jsonResponse(response);
      } catch (error) {
        return toRoomErrorResponse(error);
      }
    }

    if (req.method === 'POST' && url.pathname === '/_internal/authorize-join') {
      if (!hasInternalAccess(req, this.room.env)) {
        return toRoomErrorBody('COMMAND_NOT_ALLOWED', 'Internal join authorization only', 403);
      }

      try {
        const body = JoinAuthorizationRequestSchema.parse(await req.json());
        this.assertJoinAllowed(body.session);
        return jsonResponse({ ok: true, snapshot: this.buildSnapshot() });
      } catch (error) {
        return toRoomErrorResponse(error);
      }
    }

    return new Response('Not found', { status: 404 });
  }

  async onAlarm() {
    if (this.state.closedAt) {
      await this.clearAlarm();
      return;
    }

    if (this.state.round.pauseRemainingMs && !this.state.round.timerEndsAt) {
      return;
    }

    if (this.state.phase === 'playing' || this.state.phase === 'round_result') {
      await this.runTransition(advanceRound(this.state, {
        now: Date.now(),
        roundDurationMs: DEFAULT_ROUND_DURATION_MS,
        roundResultDurationMs: DEFAULT_ROUND_RESULT_DURATION_MS,
      }));
    }
  }

  private getPlayerParticipants() {
    return this.state.participants.filter((participant) => participant.role === 'player');
  }

  private assertInvalidSessionThrottle(now = Date.now()) {
    if (now < this.invalidSessionBlockedUntil) {
      throw new RoomRuntimeError('INVALID_SESSION', 'Too many invalid session attempts. Try again shortly.', 429, true);
    }
  }

  private resetInvalidSessionThrottle() {
    this.invalidSessionWindowStartedAt = 0;
    this.invalidSessionAttempts = 0;
    this.invalidSessionBlockedUntil = 0;
  }

  private recordInvalidSessionAttempt(now = Date.now()) {
    if (this.invalidSessionWindowStartedAt === 0 || now - this.invalidSessionWindowStartedAt > INVALID_SESSION_WINDOW_MS) {
      this.invalidSessionWindowStartedAt = now;
      this.invalidSessionAttempts = 0;
    }

    this.invalidSessionAttempts += 1;
    if (this.invalidSessionAttempts >= INVALID_SESSION_LIMIT) {
      this.invalidSessionBlockedUntil = now + INVALID_SESSION_BLOCK_MS;
      this.invalidSessionWindowStartedAt = now;
      this.invalidSessionAttempts = 0;
    }
  }

  private getParticipant(participantId: string) {
    return this.state.participants.find((participant) => participant.participantId === participantId);
  }

  private isParticipantConnected(participantId: string): boolean {
    return (this.participantConnections.get(participantId)?.size ?? 0) > 0;
  }

  private toPlayerWire(participantId: string): PlayerWire {
    const participant = this.getParticipant(participantId);
    if (!participant) {
      throw new RoomRuntimeError('INTERNAL_ERROR', `Participant ${participantId} not found`, 500, true);
    }

    return {
      id: participant.participantId,
      name: participant.displayName,
      score: participant.score,
      avatar: participant.avatar,
      connected: this.isParticipantConnected(participant.participantId),
    };
  }

  private buildSnapshot(): RoomSnapshot {
    return RoomSnapshotSchema.parse({
      roomCode: this.state.roomCode,
      state: this.state.phase,
      players: this.getPlayerParticipants().map((participant) => this.toPlayerWire(participant.participantId)),
      hostId: this.state.hostParticipantId,
      roundIndex: this.state.round.roundIndex,
      currentPartIndex: this.state.round.currentPartIndex,
      totalParts: this.state.round.totalParts,
      timerEndsAt: this.state.round.timerEndsAt,
      totalQuestionDuration: this.state.round.totalQuestionDuration,
      pauseRemainingMs: this.state.round.pauseRemainingMs,
      closeReason: this.state.closeReason,
      closedAt: this.state.closedAt ?? null,
      stateVersion: this.state.stateVersion,
      protocolVersion: PROTOCOL_VERSION,
    });
  }

  private sendRaw(connection: Party.Connection, event: ServerEvent) {
    connection.send(JSON.stringify(event));
  }

  private sendError(connection: Party.Connection, code: RoomErrorCode, message: string, retryable = false) {
    this.sendRaw(connection, {
      type: 'error',
      code,
      message,
      retryable,
    });
  }

  private broadcast(event: ServerEvent) {
    const serialized = JSON.stringify(event);
    for (const connection of this.room.getConnections()) {
      connection.send(serialized);
    }
  }

  private broadcastLobbyUpdate() {
    this.broadcast({
      type: 'lobby_update',
      roomCode: this.state.roomCode,
      players: this.getPlayerParticipants().map((participant) => this.toPlayerWire(participant.participantId)),
      state: this.state.phase,
    });
  }

  private async broadcastSnapshot() {
    this.broadcast({
      type: 'room_snapshot',
      snapshot: this.buildSnapshot(),
    });
  }

  private emitCurrentPhaseState(connection: Party.Connection) {
    const roundView = getCurrentRoundView(this.state);
    if (roundView) {
      this.sendRaw(connection, {
        type: 'game_state',
        state: 'playing',
        roomCode: this.state.roomCode,
        roundIndex: roundView.roundIndex,
        currentPartIndex: roundView.currentPartIndex,
        totalParts: roundView.totalParts,
        question: roundView.question,
        questionType: roundView.questionType,
        prompts: roundView.prompts,
        promptImages: roundView.promptImages,
        image: roundView.image ?? undefined,
        hint: roundView.hint,
        timerEndsAt: roundView.timerEndsAt,
        totalQuestionDuration: roundView.totalQuestionDuration,
        answeredPlayers: roundView.answeredParticipantIds,
      });
      return;
    }

    const lastRoundResult = getLastRoundResult(this.state);
    if (lastRoundResult && this.state.phase === 'round_result') {
      this.sendRaw(connection, {
        type: 'round_result',
        roomCode: this.state.roomCode,
        roundIndex: lastRoundResult.roundIndex,
        results: lastRoundResult.results,
        leaderboard: getLeaderboard(this.state).map((participant) => this.toPlayerWire(participant.participantId)),
        correctAnswer: lastRoundResult.correctAnswer,
        nextTimerEndsAt: lastRoundResult.nextTimerEndsAt,
        nextTimerDurationMs: lastRoundResult.nextTimerDurationMs,
      });
      return;
    }

    if (this.state.phase === 'finished') {
      this.sendRaw(connection, {
        type: 'final_leaderboard',
        roomCode: this.state.roomCode,
        leaderboard: getLeaderboard(this.state).map((participant) => this.toPlayerWire(participant.participantId)),
      });
    }
  }

  private async persistCheckpoint() {
    await this.room.storage.put(CHECKPOINT_STORAGE_KEY, this.state);
  }

  private async clearAlarm() {
    await this.room.storage.deleteAlarm();
  }

  private async applyTimerIntent(timerIntent?: GameTransitionResult['timerIntent']) {
    if (!timerIntent) {
      return;
    }

    if (timerIntent.at == null) {
      await this.clearAlarm();
      return;
    }

    await this.room.storage.setAlarm(timerIntent.at);
  }

  private assertSession(session: ParticipantSession) {
    if (session.protocolVersion !== PROTOCOL_VERSION) {
      throw new RoomRuntimeError('INVALID_PROTOCOL', 'Unsupported protocol version', 400);
    }

    if (normalizeRoomCode(session.roomCode ?? this.roomCode) !== this.roomCode) {
      throw new RoomRuntimeError('INVALID_SESSION', 'Session room code does not match party room', 400);
    }

    if (this.state.closedAt) {
      throw new RoomRuntimeError('ROOM_CLOSED', 'Room is closed', 410);
    }
  }

  private assertJoinAllowed(session: ParticipantSession) {
    this.assertSession(session);

    const existingParticipant = this.getParticipant(session.participantId);
    if (session.role === 'host') {
      if (this.state.hostParticipantId && this.state.hostParticipantId !== session.participantId) {
        throw new RoomRuntimeError('HOST_ALREADY_ASSIGNED', 'Host already assigned for this room', 409);
      }
      return;
    }

    if (!this.state.hostParticipantId) {
      throw new RoomRuntimeError('ROOM_NOT_FOUND', 'Room not found', 404);
    }

    if (!existingParticipant && this.state.phase !== 'lobby') {
      throw new RoomRuntimeError('COMMAND_NOT_ALLOWED', 'Room is already in progress', 409);
    }
  }

  private async bootstrapHost(session: ParticipantSession, pack?: string, packId?: number, gameType?: GameType) {
    this.assertSession(session);
    const now = Date.now();
    let packDefinition: RoomPackDefinition | undefined = this.state.packDefinition;
    const { selectedPack, resolvedPackId } = getPackIdentifier(pack, packId);

    if (selectedPack) {
      try {
        packDefinition = resolvedPackId != null
          ? await this.gameContentService.getRoomPackDefinition(resolvedPackId, gameType)
          : this.state.packDefinition;
      } catch (error) {
        const message = error instanceof GameContentError ? error.message : 'Unable to load pack definition';
        throw new RoomRuntimeError('PACK_LOAD_FAILED', message, 422);
      }
    }

    await this.runTransition(upsertParticipant(this.state, {
      participantId: session.participantId,
      role: 'host',
      displayName: session.displayName ?? 'Host',
      avatar: session.avatar,
      now,
    }));

    await this.runTransition(configureRoom(this.state, {
      hostParticipantId: session.participantId,
      selectedPack: selectedPack ?? this.state.selectedPack,
      packDefinition,
      now,
    }));

    return {
      ok: true,
      roomCode: this.state.roomCode,
      snapshot: this.buildSnapshot(),
    };
  }

  private async attachConnection(connection: Party.Connection<ConnectionAttachment>, session: ParticipantSession) {
    this.assertJoinAllowed(session);
    const now = Date.now();
    const existingParticipant = this.getParticipant(session.participantId);

    await this.runTransition(upsertParticipant(this.state, {
      participantId: session.participantId,
      role: session.role,
      displayName: session.displayName ?? (session.role === 'host' ? 'Host' : 'Player'),
      avatar: session.avatar,
      now,
    }));

    const attachment: ConnectionAttachment = {
      participantId: session.participantId,
      role: session.role,
    };
    connection.setState(attachment);
    this.connectionIndex.set(connection.id, attachment);

    const participantConnectionIds = this.participantConnections.get(session.participantId) ?? new Set<string>();
    participantConnectionIds.add(connection.id);
    this.participantConnections.set(session.participantId, participantConnectionIds);

    const participantWire = this.toPlayerWire(session.participantId);
    if (session.role === 'host') {
      this.sendRaw(connection, {
        type: 'room_created',
        roomCode: this.state.roomCode,
        player: participantWire,
        pack: this.state.selectedPack,
        reused: Boolean(existingParticipant),
        players: this.getPlayerParticipants().map((participant) => this.toPlayerWire(participant.participantId)),
        state: this.state.phase,
      });
    } else {
      this.sendRaw(connection, {
        type: 'joined',
        roomCode: this.state.roomCode,
        player: participantWire,
      });
    }

    this.sendRaw(connection, {
      type: 'room_snapshot',
      snapshot: this.buildSnapshot(),
    });
    this.emitCurrentPhaseState(connection);
    await this.broadcastSnapshot();
    this.broadcastLobbyUpdate();
  }

  private requireAttachment(connection: Party.Connection<ConnectionAttachment>): ConnectionAttachment {
    return this.connectionIndex.get(connection.id) ?? connection.state ?? (() => {
      throw new RoomRuntimeError('INVALID_SESSION', 'Missing participant attachment', 400);
    })();
  }

  private assertRoomCode(commandRoomCode: string | undefined) {
    if (commandRoomCode && normalizeRoomCode(commandRoomCode) !== this.state.roomCode) {
      throw new RoomRuntimeError('INVALID_SESSION', 'Command room code does not match active room', 400);
    }
  }

  private assertHost(attachment: ConnectionAttachment) {
    if (attachment.role !== 'host' || attachment.participantId !== this.state.hostParticipantId) {
      throw new RoomRuntimeError('COMMAND_NOT_ALLOWED', 'Only the host can perform this action', 403);
    }
  }

  private assertPlayer(attachment: ConnectionAttachment, playerId: string) {
    if (attachment.role !== 'player' || attachment.participantId !== playerId) {
      throw new RoomRuntimeError('COMMAND_NOT_ALLOWED', 'Only the owning player can perform this action', 403);
    }
  }

  private async applyCommand(command: ClientEvent, sender: Party.Connection<ConnectionAttachment>) {
    const attachment = this.requireAttachment(sender);
    const now = Date.now();

    switch (command.type) {
      case 'ping': {
        this.sendRaw(sender, { type: 'pong' });
        return;
      }
      case 'start_game': {
        this.assertRoomCode(command.roomCode);
        this.assertHost(attachment);
        if (command.playerId !== attachment.participantId) {
          throw new RoomRuntimeError('INVALID_SESSION', 'Host identity mismatch', 400);
        }
        await this.runTransition(startGame(this.state, {
          now,
          roundDurationMs: DEFAULT_ROUND_DURATION_MS,
        }));
        return;
      }
      case 'pause_game': {
        this.assertHost(attachment);
        await this.runTransition(pauseGame(this.state, { now }));
        return;
      }
      case 'resume_game': {
        this.assertHost(attachment);
        await this.runTransition(resumeGame(this.state, { now }));
        return;
      }
      case 'extend_timer': {
        this.assertRoomCode(command.roomCode);
        this.assertHost(attachment);
        await this.runTransition(extendTimer(this.state, {
          now,
          extensionMs: DEFAULT_TIMER_EXTENSION_MS,
        }));
        return;
      }
      case 'skip_timer': {
        this.assertRoomCode(command.roomCode);
        this.assertHost(attachment);
        await this.runTransition(skipTimer(this.state, {
          now,
          roundDurationMs: DEFAULT_ROUND_DURATION_MS,
          roundResultDurationMs: DEFAULT_ROUND_RESULT_DURATION_MS,
        }));
        return;
      }
      case 'reset_game': {
        this.assertRoomCode(command.roomCode);
        this.assertHost(attachment);
        await this.runTransition(resetGame(this.state, { now }));
        return;
      }
      case 'close_room': {
        this.assertRoomCode(command.roomCode);
        this.assertHost(attachment);
        await this.runTransition(closeRoomTransition(this.state, {
          now,
          reason: 'The host closed the room.',
        }));
        for (const connection of this.room.getConnections()) {
          connection.close(1000, 'The host closed the room.');
        }
        return;
      }
      case 'submit_answer': {
        this.assertRoomCode(command.roomCode);
        this.assertPlayer(attachment, command.playerId);
        const result = submitAnswer(this.state, {
          participantId: command.playerId,
          answer: command.answer,
          now,
          roundDurationMs: DEFAULT_ROUND_DURATION_MS,
          roundResultDurationMs: DEFAULT_ROUND_RESULT_DURATION_MS,
        });
        await this.runTransition(result);
        if (result.ok && this.state.round.roundIndex != null) {
          this.sendRaw(sender, {
            type: 'answer_received',
            roundIndex: this.state.round.roundIndex,
          });
        }
        return;
      }
      case 'use_hint': {
        this.assertRoomCode(command.roomCode);
        this.assertPlayer(attachment, command.playerId);
        await this.runTransition(useHint(this.state, {
          participantId: command.playerId,
          now,
        }));
        return;
      }
      case 'mock': {
        this.broadcast({ type: 'mock_added', roomCode: this.state.roomCode });
        return;
      }
      case 'join':
      case 'fetch_room_for_game': {
        this.sendError(sender, 'COMMAND_NOT_ALLOWED', `Use the HTTP bootstrap flow for ${command.type}`, false);
        return;
      }
      default: {
        const unsupportedCommand: never = command;
        this.sendError(sender, 'COMMAND_NOT_ALLOWED', 'Unhandled PartyKit command', false);
        return unsupportedCommand;
      }
    }
  }

  private async runTransition(result: GameTransitionResult) {
    if (!result.ok) {
      const error = result.error ?? {
        code: 'INVALID_PHASE' as const,
        message: 'Unknown game engine transition error',
      };
      throw new RoomRuntimeError(mapEngineError(error.code), error.message, 409);
    }

    this.state = result.state;
    await this.persistCheckpoint();
    await this.applyTimerIntent(result.timerIntent);
    await this.broadcastSnapshot();

    for (const event of result.events) {
      this.emitDomainEvent(event);
    }
  }

  private emitDomainEvent(event: GameEngineEvent) {
    switch (event.type) {
      case 'lobby_updated': {
        this.broadcastLobbyUpdate();
        return;
      }
      case 'round_started': {
        this.broadcast({
          type: 'game_state',
          state: 'playing',
          roomCode: this.state.roomCode,
          roundIndex: event.round.roundIndex,
          currentPartIndex: event.round.currentPartIndex,
          totalParts: event.round.totalParts,
          question: event.round.question,
          questionType: event.round.questionType,
          prompts: event.round.prompts,
          promptImages: event.round.promptImages,
          image: event.round.image ?? undefined,
          hint: event.round.hint,
          timerEndsAt: event.round.timerEndsAt,
          totalQuestionDuration: event.round.totalQuestionDuration,
          answeredPlayers: event.round.answeredParticipantIds,
        });
        return;
      }
      case 'round_result_ready': {
        this.broadcast({
          type: 'round_result',
          roomCode: this.state.roomCode,
          roundIndex: event.result.roundIndex,
          results: event.result.results,
          leaderboard: getLeaderboard(this.state).map((participant) => this.toPlayerWire(participant.participantId)),
          correctAnswer: event.result.correctAnswer,
          nextTimerEndsAt: event.result.nextTimerEndsAt,
          nextTimerDurationMs: event.result.nextTimerDurationMs,
        });
        return;
      }
      case 'game_finished': {
        this.broadcast({
          type: 'final_leaderboard',
          roomCode: this.state.roomCode,
          leaderboard: getLeaderboard(this.state).map((participant) => this.toPlayerWire(participant.participantId)),
        });
        return;
      }
      case 'game_paused': {
        this.broadcast({
          type: 'game_paused',
          roomCode: this.state.roomCode,
          pauseRemainingMs: event.pauseRemainingMs,
        });
        return;
      }
      case 'game_resumed': {
        this.broadcast({
          type: 'game_resumed',
          roomCode: this.state.roomCode,
          nextTimerEndsAt: event.nextTimerEndsAt,
        });
        return;
      }
      case 'timer_updated': {
        this.broadcast({
          type: 'timer_updated',
          roomCode: this.state.roomCode,
          timerEndsAt: event.timerEndsAt,
          totalQuestionDuration: event.totalQuestionDuration,
        });
        return;
      }
      case 'player_answered': {
        this.broadcast({
          type: 'player_answered',
          roomCode: this.state.roomCode,
          playerId: event.playerId,
        });
        return;
      }
      case 'player_hint_used': {
        this.broadcast({
          type: 'player_hint_used',
          playerId: event.playerId,
        });
        return;
      }
      case 'room_closed': {
        this.broadcast({
          type: 'room_closed',
          roomCode: this.state.roomCode,
          reason: event.reason,
        });
        return;
      }
      default: {
        const exhaustive: never = event;
        return exhaustive;
      }
    }
  }

  private isDebugRequestAllowed(req: Party.Request): boolean {
    const envValue = asEnvString(this.room.env.NODE_ENV);
    if (envValue !== 'production') {
      return true;
    }

    const configuredToken = asEnvString(this.room.env.PARTYKIT_DEBUG_TOKEN);
    return Boolean(configuredToken && req.headers.get(DEBUG_TOKEN_HEADER) === configuredToken);
  }

  private async cleanupIfClosedAndIdle() {
    if (!this.state.closedAt) {
      return;
    }

    if (Array.from(this.room.getConnections()).length > 0) {
      return;
    }

    await this.room.storage.deleteAll();
    this.state = createRoomState({
      roomCode: this.roomCode,
      protocolVersion: PROTOCOL_VERSION,
      now: Date.now(),
    });
    this.connectionIndex.clear();
    this.participantConnections.clear();
  }
}

Server satisfies Party.Worker;
