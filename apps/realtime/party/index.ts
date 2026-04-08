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
const ROOM_INACTIVITY_TTL_MS = 15 * 60_000;
const CHECKPOINT_SCHEMA_VERSION = 1;
const MAX_RECOVERY_TRANSITIONS = 32;
const ROOM_INACTIVITY_CLOSE_REASON = 'Room expired after inactivity.';

type RuntimeEnv = Record<string, unknown>;

type ConnectionAttachment = {
  participantId: string;
  role: ParticipantRole;
};

type RoomCheckpoint = {
  version: number;
  state: GameRoomState;
  lastActiveAt: number;
  lastCheckpointReason: string;
  savedAt: number;
  scheduledAlarmAt: number | null;
};

type RoomLogLevel = 'info' | 'warn' | 'error';
type RoomMetricName =
  | 'room_creates'
  | 'joins'
  | 'reconnects'
  | 'invalid_commands'
  | 'upstream_content_fetch_failures'
  | 'round_transitions';

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

function isCreateRoomPath(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, '');
  return normalized === '/api/rooms'
    || normalized === '/rooms'
    || normalized.endsWith('/api/rooms')
    || normalized.endsWith('/rooms')
    || normalized === '/api/bootstrap/host'
    || normalized === '/bootstrap/host'
    || normalized.endsWith('/api/bootstrap/host')
    || normalized.endsWith('/bootstrap/host');
}

function getJoinRoomCode(pathname: string): string | null {
  const normalized = pathname.replace(/\/+$/, '');
  const match = normalized.match(/(?:\/parties\/[^/]+)?\/(?:api\/)?rooms\/([A-Za-z]{4})\/join$/)
    ?? normalized.match(/(?:\/parties\/[^/]+)?\/(?:api\/)?bootstrap\/join\/([A-Za-z]{4})$/);
  return match ? normalizeRoomCode(match[1]) : null;
}

function normalizeLobbyPath(pathname: string): string {
  const prefix = `/parties/${PARTY_NAME}`;
  if (pathname === prefix) {
    return '/';
  }

  return pathname.startsWith(`${prefix}/`) ? pathname.slice(prefix.length) : pathname;
}

function isGameRoomState(value: unknown): value is GameRoomState {
  return isObject(value)
    && typeof value.roomCode === 'string'
    && typeof value.protocolVersion === 'number'
    && typeof value.stateVersion === 'number'
    && typeof value.phase === 'string'
    && Array.isArray(value.participants)
    && isObject(value.round);
}

function isRoomCheckpoint(value: unknown): value is RoomCheckpoint {
  return isObject(value)
    && value.version === CHECKPOINT_SCHEMA_VERSION
    && isGameRoomState(value.state)
    && typeof value.lastActiveAt === 'number'
    && typeof value.lastCheckpointReason === 'string'
    && typeof value.savedAt === 'number'
    && (typeof value.scheduledAlarmAt === 'number' || value.scheduledAlarmAt === null);
}

function getCommandTypeCandidate(message: string | ArrayBuffer | ArrayBufferView): string | undefined {
  try {
    const payload = parseMessagePayload(message);
    const candidate = isObject(payload) && 'event' in payload ? payload.event : payload;
    return isObject(candidate) && typeof candidate.type === 'string' ? candidate.type : undefined;
  } catch {
    return undefined;
  }
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
    const pathname = normalizeLobbyPath(url.pathname);

    if (pathname === '/healthz') {
      return jsonResponse({ ok: true, service: 'realtime', protocolVersion: PROTOCOL_VERSION });
    }

    if (isCreateRoomPath(pathname) && req.method === 'POST') {
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

        const errorBody = await response.clone().json().catch(() => null);
        const errorCode = errorBody?.error?.code as RoomErrorCode | undefined;
        if (errorCode === 'HOST_ALREADY_ASSIGNED') {
          continue;
        }

        return response;
      }

      return toRoomErrorBody('INTERNAL_ERROR', 'Unable to allocate a room code', 503, true);
    }

    const joinRoomCode = getJoinRoomCode(pathname);
    if (joinRoomCode && req.method === 'POST') {
      if (!hasInternalAccess(req, lobby.env)) {
        return toRoomErrorBody('COMMAND_NOT_ALLOWED', 'Web bootstrap access required', 403);
      }

      const roomCode = joinRoomCode;
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
  private _roomCode?: string;
  private readonly connectionIndex = new Map<string, ConnectionAttachment>();
  private readonly participantConnections = new Map<string, Set<string>>();
  private invalidSessionWindowStartedAt = 0;
  private invalidSessionAttempts = 0;
  private invalidSessionBlockedUntil = 0;
  private lastActiveAt = Date.now();
  private scheduledAlarmAt: number | null = null;
  private lastCheckpointReason = 'room_initialized';

  constructor(readonly room: Party.Room) {
    // Avoid accessing `room.id` here — it may not be initialized yet in some
    // PartyKit worker initialization flows (e.g. alarm-based instantiation).
    // Defer reading `room.id` until it's safe (onStart or first use via the
    // `roomCode` getter). Use a generated temporary code for initial state.
    this._roomCode = undefined;
    this.state = createRoomState({
      roomCode: Server.generateRoomCode(),
      protocolVersion: PROTOCOL_VERSION,
      now: Date.now(),
    });
    this.lastActiveAt = this.state.createdAt;
  }

  private get roomCode() {
    if (this._roomCode) return this._roomCode;
    try {
      // Try to read the real room id provided by PartyKit. If it's not yet
      // initialized the accessor may throw; catch and fall back to the
      // current in-memory state room code.
      this._roomCode = normalizeRoomCode(this.room.id);
      return this._roomCode;
    } catch (err) {
      return this.state?.roomCode ?? Server.generateRoomCode();
    }
  }

  private get gameContentService() {
    return createGameContentService({
      neonDatabaseUrl: asEnvString(this.room.env.NEXT_PUBLIC_NEON_URL),
      rebusApiBaseUrl: asEnvString(this.room.env.REBUS_API_BASE_URL),
      rebusApiKey: asEnvString(this.room.env.REBUS_PACKS_API_SECRET_KEY),
      enableFallbackPack: asEnvString(this.room.env.NODE_ENV) !== 'production',
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
    const checkpoint = await this.room.storage.get<RoomCheckpoint | GameRoomState>(CHECKPOINT_STORAGE_KEY);
    if (checkpoint) {
      if (isRoomCheckpoint(checkpoint)) {
        this.state = checkpoint.state;
        this.lastActiveAt = checkpoint.lastActiveAt;
        this.scheduledAlarmAt = checkpoint.scheduledAlarmAt;
        this.lastCheckpointReason = checkpoint.lastCheckpointReason;
      } else if (isGameRoomState(checkpoint)) {
        this.state = checkpoint;
        this.lastActiveAt = checkpoint.updatedAt;
        this.scheduledAlarmAt = checkpoint.round.timerEndsAt;
        this.lastCheckpointReason = 'legacy_checkpoint_restored';
      }

      await this.reconcileRecoveredState();
      return;
    }

    this.state = createRoomState({
      roomCode: this.roomCode,
      protocolVersion: PROTOCOL_VERSION,
      now: Date.now(),
    });
    this.lastActiveAt = this.state.createdAt;
    this.scheduledAlarmAt = null;
  }

  async onConnect(connection: Party.Connection<ConnectionAttachment>, ctx: Party.ConnectionContext) {
    const correlationId = crypto.randomUUID();
    try {
      this.assertInvalidSessionThrottle();
      const session = await parseSessionFromRequest(ctx.request, this.roomCode, this.room.env);
      this.resetInvalidSessionThrottle();
      await this.attachConnection(connection, session, correlationId);
    } catch (error) {
      this.recordInvalidSessionAttempt();
      this.log('warn', 'connection_rejected', {
        correlationId,
        commandType: 'connect',
        reason: error instanceof Error ? error.message : 'Failed to attach session',
      });
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
    const correlationId = crypto.randomUUID();
    const attachment = this.connectionIndex.get(sender.id) ?? sender.state ?? null;
    const commandType = getCommandTypeCandidate(message);

    try {
      const command = parseClientCommand(message);
      this.log('info', 'command_received', {
        correlationId,
        commandType: command.type,
        participantId: attachment?.participantId,
        role: attachment?.role,
      });
      await this.applyCommand(command, sender, correlationId);
    } catch (error) {
      this.logMetric('invalid_commands', {
        correlationId,
        commandType,
        participantId: attachment?.participantId,
        role: attachment?.role,
        reason: error instanceof Error ? error.message : 'Unable to process command',
      });
      this.log('warn', 'command_rejected', {
        correlationId,
        commandType,
        participantId: attachment?.participantId,
        role: attachment?.role,
        reason: error instanceof Error ? error.message : 'Unable to process command',
      });
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

    const now = Date.now();
    this.connectionIndex.delete(connection.id);
    const participantConnectionIds = this.participantConnections.get(attachment.participantId);
    let participantDisconnected = false;
    if (participantConnectionIds) {
      participantConnectionIds.delete(connection.id);
      if (participantConnectionIds.size === 0) {
        this.participantConnections.delete(attachment.participantId);
        participantDisconnected = true;
      }
    }

    if (participantDisconnected || this.participantConnections.size === 0) {
      await this.commitCheckpoint(participantDisconnected ? 'participant_disconnected' : 'room_became_idle', {
        now,
        markActivity: true,
      });
      this.log('info', 'participant_disconnected', {
        participantId: attachment.participantId,
        role: attachment.role,
        reason: this.participantConnections.size === 0 ? 'room_idle' : 'participant_offline',
      });
    }

    await this.broadcastSnapshot();
    this.broadcastLobbyUpdate();
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
        runtime: {
          lastActiveAt: this.lastActiveAt,
          inactivityDeadline: this.getInactivityDeadline(),
          scheduledAlarmAt: this.scheduledAlarmAt,
          lastCheckpointReason: this.lastCheckpointReason,
          activeConnectionCount: this.getActiveConnectionCount(),
        },
        selectedPack: this.state.selectedPack,
        hasPackDefinition: Boolean(this.state.packDefinition),
        roundView: getCurrentRoundView(this.state),
        lastRoundResult: getLastRoundResult(this.state),
      });
    }

    if (req.method === 'POST' && (url.pathname === '/_internal/bootstrap-host' || url.pathname.endsWith('/_internal/bootstrap-host'))) {
      if (!hasInternalAccess(req, this.room.env)) {
        return toRoomErrorBody('COMMAND_NOT_ALLOWED', 'Internal bootstrap only', 403);
      }

      try {
        const body = BootstrapHostRequestSchema.parse(await req.json());
        const response = await this.bootstrapHost(body.session, body.pack, body.packId, body.gameType);
        return jsonResponse(response);
      } catch (error) {
        this.log('warn', 'bootstrap_host_failed', {
          commandType: 'bootstrap_host',
          reason: error instanceof Error ? error.message : 'Failed to bootstrap host',
        });
        return toRoomErrorResponse(error);
      }
    }

    if (req.method === 'POST' && (url.pathname === '/_internal/authorize-join' || url.pathname.endsWith('/_internal/authorize-join'))) {
      if (!hasInternalAccess(req, this.room.env)) {
        return toRoomErrorBody('COMMAND_NOT_ALLOWED', 'Internal join authorization only', 403);
      }

      try {
        const body = JoinAuthorizationRequestSchema.parse(await req.json());
        this.assertJoinAllowed(body.session);
        this.log('info', 'join_authorized', {
          participantId: body.session.participantId,
          role: body.session.role,
          commandType: 'authorize_join',
        });
        return jsonResponse({ ok: true, snapshot: this.buildSnapshot() });
      } catch (error) {
        this.log('warn', 'join_authorization_failed', {
          participantId: req.headers.get('x-kouch-participant-id') ?? undefined,
          commandType: 'authorize_join',
          reason: error instanceof Error ? error.message : 'Join authorization failed',
        });
        return toRoomErrorResponse(error);
      }
    }

    return new Response('Not found', { status: 404 });
  }

  async onAlarm() {
    const now = Date.now();

    if (this.isInactiveExpired(now)) {
      await this.expireRoomForInactivity(now);
      return;
    }

    if (this.state.round.pauseRemainingMs && !this.state.round.timerEndsAt) {
      await this.commitCheckpoint('alarm_noop', { now, markActivity: false });
      return;
    }

    if (this.shouldAdvanceExpiredTimer(now)) {
      try {
        await this.runTransition(advanceRound(this.state, {
          now,
          roundDurationMs: DEFAULT_ROUND_DURATION_MS,
          roundResultDurationMs: DEFAULT_ROUND_RESULT_DURATION_MS,
        }), {
          reason: 'round_advanced',
          commandType: 'alarm',
          markActivity: false,
          source: 'alarm',
        });
      } catch (err) {
        this.log('error', 'alarm_transition_failed', { reason: err instanceof Error ? err.message : String(err) });
        try {
          await this.commitCheckpoint('alarm_failed', { now, markActivity: false });
        } catch (e) {
          this.log('error', 'alarm_reschedule_failed', { reason: e instanceof Error ? e.message : String(e) });
        }
      }

      return;
    }

    await this.commitCheckpoint('alarm_rescheduled', { now, markActivity: false });
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

  private log(level: RoomLogLevel, event: string, context: Record<string, unknown> = {}) {
    const payload = {
      ts: new Date().toISOString(),
      level,
      source: 'kouch-realtime-room',
      event,
      roomCode: this.roomCode,
      roomState: this.state.phase,
      stateVersion: this.state.stateVersion,
      ...context,
    };

    const message = JSON.stringify(payload);
    if (level === 'error') {
      console.error(message);
      return;
    }

    if (level === 'warn') {
      console.warn(message);
      return;
    }

    console.info(message);
  }

  private logMetric(metric: RoomMetricName, context: Record<string, unknown> = {}) {
    this.log('info', 'metric', {
      metric,
      count: 1,
      ...context,
    });
  }

  private getActiveConnectionCount() {
    return Array.from(this.room.getConnections()).length;
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

  private getRoundAlarmAt() {
    if ((this.state.phase !== 'playing' && this.state.phase !== 'round_result') || this.state.round.timerEndsAt == null) {
      return null;
    }

    return this.state.round.timerEndsAt;
  }

  private getInactivityDeadline() {
    if (this.getActiveConnectionCount() > 0) {
      return null;
    }

    return Math.max(this.lastActiveAt, this.state.updatedAt, this.state.createdAt) + ROOM_INACTIVITY_TTL_MS;
  }

  private isInactiveExpired(now = Date.now()) {
    const inactivityDeadline = this.getInactivityDeadline();
    return inactivityDeadline != null && inactivityDeadline <= now;
  }

  private shouldAdvanceExpiredTimer(now = Date.now()) {
    return (this.state.phase === 'playing' || this.state.phase === 'round_result')
      && this.state.round.timerEndsAt != null
      && this.state.round.timerEndsAt <= now;
  }

  private getDesiredAlarmAt() {
    const candidates = [this.getRoundAlarmAt(), this.getInactivityDeadline()].filter((value): value is number => value != null);
    if (candidates.length === 0) {
      return null;
    }

    return Math.min(...candidates);
  }

  private async persistCheckpoint(reason: string, savedAt: number) {
    this.lastCheckpointReason = reason;
    await this.room.storage.put(CHECKPOINT_STORAGE_KEY, {
      version: CHECKPOINT_SCHEMA_VERSION,
      state: this.state,
      lastActiveAt: this.lastActiveAt,
      lastCheckpointReason: reason,
      savedAt,
      scheduledAlarmAt: this.scheduledAlarmAt,
    } satisfies RoomCheckpoint);
  }

  private async flushAlarm() {
    if (this.scheduledAlarmAt == null) {
      await this.room.storage.deleteAlarm();
      return;
    }

    await this.room.storage.setAlarm(this.scheduledAlarmAt);
  }

  private async commitCheckpoint(reason: string, options?: { now?: number; markActivity?: boolean }) {
    const now = options?.now ?? Date.now();
    if (options?.markActivity ?? true) {
      this.lastActiveAt = now;
    }

    this.scheduledAlarmAt = this.getDesiredAlarmAt();
    await this.persistCheckpoint(reason, now);
    await this.flushAlarm();
  }

  private async reconcileRecoveredState() {
    const now = Date.now();

    if (this.isInactiveExpired(now)) {
      this.log('info', 'room_expired_on_start', {
        reason: 'inactivity',
        lastActiveAt: this.lastActiveAt,
      });
      await this.resetDurableRoom(now);
      return;
    }

    let recoveryTransitions = 0;
    while (this.shouldAdvanceExpiredTimer(now) && recoveryTransitions < MAX_RECOVERY_TRANSITIONS) {
      const result = advanceRound(this.state, {
        now,
        roundDurationMs: DEFAULT_ROUND_DURATION_MS,
        roundResultDurationMs: DEFAULT_ROUND_RESULT_DURATION_MS,
      });

      if (!result.ok) {
        this.log('error', 'room_recovery_failed', {
          commandType: 'recovery',
          reason: result.error?.message ?? 'Unable to advance recovered room state',
        });
        break;
      }

      this.state = result.state;
      recoveryTransitions += 1;
    }

    if (recoveryTransitions >= MAX_RECOVERY_TRANSITIONS && this.shouldAdvanceExpiredTimer(now)) {
      this.log('warn', 'room_recovery_guard_hit', {
        commandType: 'recovery',
        reason: 'Exceeded maximum recovery transitions',
      });
    }

    this.scheduledAlarmAt = this.getDesiredAlarmAt();
    await this.persistCheckpoint(recoveryTransitions > 0 ? 'state_recovered' : this.lastCheckpointReason, now);
    await this.flushAlarm();

    this.log('info', 'room_recovered', {
      commandType: 'recovery',
      reason: recoveryTransitions > 0 ? 'expired_timer_reconciled' : 'checkpoint_restored',
      recoveredTransitions: recoveryTransitions,
      scheduledAlarmAt: this.scheduledAlarmAt,
    });

    if (recoveryTransitions > 0) {
      this.logMetric('round_transitions', {
        commandType: 'recovery',
        count: recoveryTransitions,
      });
    }
  }

  private async resetDurableRoom(now: number) {
    await this.room.storage.deleteAll();
    this.state = createRoomState({
      roomCode: this.roomCode,
      protocolVersion: PROTOCOL_VERSION,
      now,
    });
    this.connectionIndex.clear();
    this.participantConnections.clear();
    this.lastActiveAt = now;
    this.scheduledAlarmAt = null;
    this.lastCheckpointReason = 'room_reset';
  }

  private async expireRoomForInactivity(now: number) {
    if (!this.state.closedAt) {
      const result = closeRoomTransition(this.state, {
        now,
        reason: ROOM_INACTIVITY_CLOSE_REASON,
      });

      if (result.ok) {
        await this.runTransition(result, {
          reason: 'room_closed',
          commandType: 'room_expired',
          markActivity: false,
          source: 'inactivity',
        });
      }
    }

    this.log('info', 'room_expired', {
      commandType: 'room_expired',
      reason: ROOM_INACTIVITY_CLOSE_REASON,
      lastActiveAt: this.lastActiveAt,
    });

    await this.resetDurableRoom(now);
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
    const isNewRoom = !this.state.hostParticipantId;

    if (selectedPack) {
      try {
        packDefinition = resolvedPackId != null
          ? await this.gameContentService.getRoomPackDefinition(resolvedPackId, gameType)
          : this.state.packDefinition;
      } catch (error) {
        this.logMetric('upstream_content_fetch_failures', {
          commandType: 'bootstrap_host',
          participantId: session.participantId,
          role: session.role,
          reason: error instanceof Error ? error.message : 'Unable to load pack definition',
        });
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
    }), {
      reason: isNewRoom ? 'room_created' : 'host_reconnected',
      commandType: 'bootstrap_host',
      participantId: session.participantId,
      role: session.role,
    });

    await this.runTransition(configureRoom(this.state, {
      hostParticipantId: session.participantId,
      selectedPack: selectedPack ?? this.state.selectedPack,
      packDefinition,
      now,
    }), {
      reason: 'room_configured',
      commandType: 'bootstrap_host',
      participantId: session.participantId,
      role: session.role,
    });

    if (isNewRoom) {
      this.logMetric('room_creates', {
        commandType: 'bootstrap_host',
        participantId: session.participantId,
        role: session.role,
      });
    }

    this.log('info', 'host_bootstrapped', {
      commandType: 'bootstrap_host',
      participantId: session.participantId,
      role: session.role,
      reason: isNewRoom ? 'room_created' : 'room_reused',
    });

    return {
      ok: true,
      roomCode: this.state.roomCode,
      snapshot: this.buildSnapshot(),
    };
  }

  private async attachConnection(connection: Party.Connection<ConnectionAttachment>, session: ParticipantSession, correlationId: string) {
    this.assertJoinAllowed(session);
    const now = Date.now();
    const existingParticipant = this.getParticipant(session.participantId);
    const hadActiveConnection = this.isParticipantConnected(session.participantId);
    const isReconnect = Boolean(existingParticipant) && !hadActiveConnection;

    await this.runTransition(upsertParticipant(this.state, {
      participantId: session.participantId,
      role: session.role,
      displayName: session.displayName ?? (session.role === 'host' ? 'Host' : 'Player'),
      avatar: session.avatar,
      now,
    }), {
      reason: isReconnect ? 'participant_reconnected' : 'participant_connected',
      commandType: 'connect',
      participantId: session.participantId,
      role: session.role,
      correlationId,
    });

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

    if (isReconnect) {
      this.logMetric('reconnects', {
        correlationId,
        commandType: 'connect',
        participantId: session.participantId,
        role: session.role,
      });
    } else if (session.role === 'player') {
      this.logMetric('joins', {
        correlationId,
        commandType: 'connect',
        participantId: session.participantId,
        role: session.role,
      });
    }

    this.log('info', 'participant_connected', {
      correlationId,
      commandType: 'connect',
      participantId: session.participantId,
      role: session.role,
      reason: isReconnect ? 'reconnected' : existingParticipant ? 'additional_connection' : 'joined',
    });

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

  private async applyCommand(command: ClientEvent, sender: Party.Connection<ConnectionAttachment>, correlationId: string) {
    const attachment = this.requireAttachment(sender);
    const now = Date.now();
    const commandContext = {
      correlationId,
      commandType: command.type,
      participantId: attachment.participantId,
      role: attachment.role,
    };

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
        }), {
          ...commandContext,
          reason: 'game_started',
        });
        return;
      }
      case 'pause_game': {
        this.assertHost(attachment);
        await this.runTransition(pauseGame(this.state, { now }), {
          ...commandContext,
          reason: 'game_paused',
        });
        return;
      }
      case 'resume_game': {
        this.assertHost(attachment);
        await this.runTransition(resumeGame(this.state, { now }), {
          ...commandContext,
          reason: 'game_resumed',
        });
        return;
      }
      case 'extend_timer': {
        this.assertRoomCode(command.roomCode);
        this.assertHost(attachment);
        await this.runTransition(extendTimer(this.state, {
          now,
          extensionMs: DEFAULT_TIMER_EXTENSION_MS,
        }), {
          ...commandContext,
          reason: 'timer_extended',
        });
        return;
      }
      case 'skip_timer': {
        this.assertRoomCode(command.roomCode);
        this.assertHost(attachment);
        await this.runTransition(skipTimer(this.state, {
          now,
          roundDurationMs: DEFAULT_ROUND_DURATION_MS,
          roundResultDurationMs: DEFAULT_ROUND_RESULT_DURATION_MS,
        }), {
          ...commandContext,
          reason: 'round_advanced',
        });
        return;
      }
      case 'reset_game': {
        this.assertRoomCode(command.roomCode);
        this.assertHost(attachment);
        await this.runTransition(resetGame(this.state, { now }), {
          ...commandContext,
          reason: 'game_reset',
        });
        return;
      }
      case 'close_room': {
        this.assertRoomCode(command.roomCode);
        this.assertHost(attachment);
        await this.runTransition(closeRoomTransition(this.state, {
          now,
          reason: 'The host closed the room.',
        }), {
          ...commandContext,
          reason: 'room_closed',
        });
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
        await this.runTransition(result, {
          ...commandContext,
          reason: 'answer_accepted',
        });
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
        }), {
          ...commandContext,
          reason: 'hint_used',
        });
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

  private async runTransition(
    result: GameTransitionResult,
    options?: {
      reason?: string;
      commandType?: string;
      participantId?: string;
      role?: ParticipantRole;
      correlationId?: string;
      markActivity?: boolean;
      source?: string;
    },
  ) {
    if (!result.ok) {
      const error = result.error ?? {
        code: 'INVALID_PHASE' as const,
        message: 'Unknown game engine transition error',
      };
      this.log('warn', 'transition_rejected', {
        correlationId: options?.correlationId,
        commandType: options?.commandType,
        participantId: options?.participantId,
        role: options?.role,
        reason: error.message,
        source: options?.source,
      });
      throw new RoomRuntimeError(mapEngineError(error.code), error.message, 409);
    }

    this.state = result.state;
    await this.commitCheckpoint(options?.reason ?? 'state_transition', {
      now: this.state.updatedAt,
      markActivity: options?.markActivity,
    });
    await this.broadcastSnapshot();

    for (const event of result.events) {
      this.emitDomainEvent(event, options);
    }
  }

  private emitDomainEvent(
    event: GameEngineEvent,
    context?: {
      commandType?: string;
      participantId?: string;
      role?: ParticipantRole;
      correlationId?: string;
      source?: string;
    },
  ) {
    switch (event.type) {
      case 'lobby_updated': {
        this.broadcastLobbyUpdate();
        return;
      }
      case 'round_started': {
        this.logMetric('round_transitions', {
          correlationId: context?.correlationId,
          commandType: context?.commandType,
          participantId: context?.participantId,
          role: context?.role,
          source: context?.source,
          transition: 'round_started',
          roundIndex: event.round.roundIndex,
        });
        this.log('info', 'round_started', {
          correlationId: context?.correlationId,
          commandType: context?.commandType,
          participantId: context?.participantId,
          role: context?.role,
          source: context?.source,
          roundIndex: event.round.roundIndex,
        });
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
        this.logMetric('round_transitions', {
          correlationId: context?.correlationId,
          commandType: context?.commandType,
          participantId: context?.participantId,
          role: context?.role,
          source: context?.source,
          transition: 'round_result_ready',
          roundIndex: event.result.roundIndex,
        });
        this.log('info', 'round_result_ready', {
          correlationId: context?.correlationId,
          commandType: context?.commandType,
          participantId: context?.participantId,
          role: context?.role,
          source: context?.source,
          roundIndex: event.result.roundIndex,
        });
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
        this.log('info', 'game_finished', {
          correlationId: context?.correlationId,
          commandType: context?.commandType,
          participantId: context?.participantId,
          role: context?.role,
          source: context?.source,
        });
        this.broadcast({
          type: 'final_leaderboard',
          roomCode: this.state.roomCode,
          leaderboard: getLeaderboard(this.state).map((participant) => this.toPlayerWire(participant.participantId)),
        });
        return;
      }
      case 'game_paused': {
        this.log('info', 'game_paused', {
          correlationId: context?.correlationId,
          commandType: context?.commandType,
          participantId: context?.participantId,
          role: context?.role,
          source: context?.source,
        });
        this.broadcast({
          type: 'game_paused',
          roomCode: this.state.roomCode,
          pauseRemainingMs: event.pauseRemainingMs,
        });
        return;
      }
      case 'game_resumed': {
        this.log('info', 'game_resumed', {
          correlationId: context?.correlationId,
          commandType: context?.commandType,
          participantId: context?.participantId,
          role: context?.role,
          source: context?.source,
        });
        this.broadcast({
          type: 'game_resumed',
          roomCode: this.state.roomCode,
          nextTimerEndsAt: event.nextTimerEndsAt,
        });
        return;
      }
      case 'timer_updated': {
        this.log('info', 'timer_updated', {
          correlationId: context?.correlationId,
          commandType: context?.commandType,
          participantId: context?.participantId,
          role: context?.role,
          source: context?.source,
          timerEndsAt: event.timerEndsAt,
        });
        this.broadcast({
          type: 'timer_updated',
          roomCode: this.state.roomCode,
          timerEndsAt: event.timerEndsAt,
          totalQuestionDuration: event.totalQuestionDuration,
        });
        return;
      }
      case 'player_answered': {
        this.log('info', 'player_answered', {
          correlationId: context?.correlationId,
          commandType: context?.commandType,
          participantId: event.playerId,
          role: 'player',
          source: context?.source,
        });
        this.broadcast({
          type: 'player_answered',
          roomCode: this.state.roomCode,
          playerId: event.playerId,
        });
        return;
      }
      case 'player_hint_used': {
        this.log('info', 'player_hint_used', {
          correlationId: context?.correlationId,
          commandType: context?.commandType,
          participantId: event.playerId,
          role: 'player',
          source: context?.source,
        });
        this.broadcast({
          type: 'player_hint_used',
          playerId: event.playerId,
        });
        return;
      }
      case 'room_closed': {
        this.log('info', 'room_closed', {
          correlationId: context?.correlationId,
          commandType: context?.commandType,
          participantId: context?.participantId,
          role: context?.role,
          source: context?.source,
          reason: event.reason,
        });
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
}

Server satisfies Party.Worker;
