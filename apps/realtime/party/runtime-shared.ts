import type * as Party from 'partykit/server';
import { z } from 'zod';
import {
  ParticipantSessionSchema,
  parseTransportClientEvent,
  verifyParticipantSessionToken,
  type ParticipantRole,
  type ParticipantSession,
  type RoomErrorCode,
  type TransportClientEvent,
} from '@kouch/contracts';
import type { GameEngineErrorCode, GameRoomState } from '@kouch/game-engine';

export const PARTY_NAME = 'main';
export const CHECKPOINT_STORAGE_KEY = 'room:checkpoint';
export const INTERNAL_HEADER = 'x-kouch-internal';
export const INTERNAL_TOKEN_HEADER = 'x-kouch-internal-token';
export const DEBUG_TOKEN_HEADER = 'x-kouch-debug-token';
export const ROOM_CODE_LENGTH = 4;
export const ROOM_CREATE_ATTEMPTS = 12;
export const INVALID_SESSION_WINDOW_MS = 15_000;
export const INVALID_SESSION_LIMIT = 6;
export const INVALID_SESSION_BLOCK_MS = 10_000;
export const ROOM_INACTIVITY_TTL_MS = 15 * 60_000;
export const CHECKPOINT_SCHEMA_VERSION = 1;
export const MAX_RECOVERY_TRANSITIONS = 32;
export const ROOM_INACTIVITY_CLOSE_REASON = 'Room expired after inactivity.';

export type RuntimeEnv = Record<string, unknown>;

export type ConnectionAttachment = {
  participantId: string;
  role: ParticipantRole;
};

export type RoomCheckpoint = {
  version: number;
  state: GameRoomState;
  lastActiveAt: number;
  lastCheckpointReason: string;
  savedAt: number;
  scheduledAlarmAt: number | null;
};

export type RoomLogLevel = 'info' | 'warn' | 'error';
export type RoomMetricName =
  | 'room_creates'
  | 'joins'
  | 'reconnects'
  | 'invalid_commands'
  | 'upstream_content_fetch_failures'
  | 'round_transitions';

export function normalizeRoomCode(value: string): string {
  return value.trim().slice(0, ROOM_CODE_LENGTH).toUpperCase();
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function asEnvString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function getSessionSecret(env: RuntimeEnv): string {
  const configuredSecret = asEnvString(env.KOUCH_SESSION_SECRET);
  if (configuredSecret) {
    return configuredSecret;
  }

  if (asEnvString(env.NODE_ENV) !== 'production') {
    return 'kouch-dev-session-secret';
  }

  throw new Error('KOUCH_SESSION_SECRET is required in production');
}

export function parseMessagePayload(message: string | ArrayBuffer | ArrayBufferView): unknown {
  if (typeof message === 'string') {
    return JSON.parse(message);
  }

  const view = message instanceof ArrayBuffer
    ? new Uint8Array(message)
    : new Uint8Array(message.buffer, message.byteOffset, message.byteLength);

  return JSON.parse(new TextDecoder().decode(view));
}

export function parseClientCommand(message: string | ArrayBuffer | ArrayBufferView): TransportClientEvent {
  const payload = parseMessagePayload(message);
  const candidate = isObject(payload) && 'event' in payload ? payload.event : payload;
  return parseTransportClientEvent(candidate);
}

export function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init?.headers ?? {}),
    },
  });
}

export function buildPartyWebSocketUrl(request: { url: string }, roomCode: string, sessionValue: string): string {
  const url = new URL(request.url);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = `/parties/${PARTY_NAME}/${roomCode}`;
  url.search = `session=${encodeURIComponent(sessionValue)}`;
  return url.toString();
}

export async function parseSessionFromRequest(
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

export function hasInternalAccess(req: Party.Request, env: RuntimeEnv): boolean {
  if (req.headers.get(INTERNAL_HEADER) !== '1') {
    return false;
  }

  return req.headers.get(INTERNAL_TOKEN_HEADER) === getSessionSecret(env);
}

export function getPackIdentifier(pack?: string, packId?: number): { selectedPack?: string; resolvedPackId?: number } {
  const selectedPack = pack ?? (typeof packId === 'number' ? String(packId) : undefined);
  const resolvedPackId = typeof packId === 'number'
    ? packId
    : selectedPack && /^\d+$/.test(selectedPack)
      ? Number(selectedPack)
      : undefined;

  return { selectedPack, resolvedPackId };
}

export function isCreateRoomPath(pathname: string): boolean {
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

export function getJoinRoomCode(pathname: string): string | null {
  const normalized = pathname.replace(/\/+$/, '');
  const match = normalized.match(/(?:\/parties\/[^/]+)?\/(?:api\/)?rooms\/([A-Za-z]{4})\/join$/)
    ?? normalized.match(/(?:\/parties\/[^/]+)?\/(?:api\/)?bootstrap\/join\/([A-Za-z]{4})$/);
  return match ? normalizeRoomCode(match[1]) : null;
}

export function normalizeLobbyPath(pathname: string): string {
  const prefix = `/parties/${PARTY_NAME}`;
  if (pathname === prefix) {
    return '/';
  }

  return pathname.startsWith(`${prefix}/`) ? pathname.slice(prefix.length) : pathname;
}

export function isGameRoomState(value: unknown): value is GameRoomState {
  return isObject(value)
    && typeof value.roomCode === 'string'
    && typeof value.protocolVersion === 'number'
    && typeof value.stateVersion === 'number'
    && typeof value.phase === 'string'
    && Array.isArray(value.participants)
    && isObject(value.round);
}

export function isRoomCheckpoint(value: unknown): value is RoomCheckpoint {
  return isObject(value)
    && value.version === CHECKPOINT_SCHEMA_VERSION
    && isGameRoomState(value.state)
    && typeof value.lastActiveAt === 'number'
    && typeof value.lastCheckpointReason === 'string'
    && typeof value.savedAt === 'number'
    && (typeof value.scheduledAlarmAt === 'number' || value.scheduledAlarmAt === null);
}

export function getCommandTypeCandidate(message: string | ArrayBuffer | ArrayBufferView): string | undefined {
  try {
    const payload = parseMessagePayload(message);
    const candidate = isObject(payload) && 'event' in payload ? payload.event : payload;
    return isObject(candidate) && typeof candidate.type === 'string' ? candidate.type : undefined;
  } catch {
    return undefined;
  }
}

export function toRoomErrorBody(code: RoomErrorCode, message: string, status: number, retryable = false): Response {
  return jsonResponse({ ok: false, error: { code, message, retryable } }, { status });
}

export class RoomRuntimeError extends Error {
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

export function toRoomErrorResponse(error: unknown): Response {
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

export function mapEngineError(code: GameEngineErrorCode): RoomErrorCode {
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