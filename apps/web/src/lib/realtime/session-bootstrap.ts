import {
  PROTOCOL_VERSION,
  RoomCodeSchema,
  signParticipantSessionToken,
  type ParticipantRole,
  type RoomSnapshot,
  type SignedParticipantSession,
} from '@kouch/contracts';

const INTERNAL_HEADER = 'x-kouch-internal';
const INTERNAL_TOKEN_HEADER = 'x-kouch-internal-token';
const DEFAULT_REALTIME_BASE_URL = 'http://127.0.0.1:1999';
const DEFAULT_SESSION_TTL_SECONDS = 60 * 60;

export type RealtimeBootstrapPayload = {
  roomCode: string;
  session: SignedParticipantSession;
  sessionToken: string;
  websocketUrl: string;
  snapshot: RoomSnapshot;
};

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

export function getRealtimeServerBaseUrl(): string {
  return normalizeBaseUrl(
    process.env.REALTIME_BASE_URL
      || process.env.NEXT_PUBLIC_REALTIME_BASE_URL
      || DEFAULT_REALTIME_BASE_URL,
  );
}

export function getRealtimeSessionSecret(): string {
  const configuredSecret = process.env.KOUCH_SESSION_SECRET;
  if (configuredSecret) {
    return configuredSecret;
  }

  if (process.env.NODE_ENV !== 'production') {
    return 'kouch-dev-session-secret';
  }

  throw new Error('KOUCH_SESSION_SECRET is required in production');
}

function sanitizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function normalizeRoomCode(value: string): string {
  return RoomCodeSchema.parse(value);
}

export function buildRealtimeWebSocketUrl(baseUrl: string, roomCode: string, sessionToken: string): string {
  const url = new URL(baseUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = `/parties/main/${normalizeRoomCode(roomCode)}`;
  url.search = `session=${encodeURIComponent(sessionToken)}`;
  return url.toString();
}

export async function callRealtimeBootstrap<TResponse>(path: string, body: Record<string, unknown>): Promise<TResponse> {
  const realtimeBaseUrl = getRealtimeServerBaseUrl();
  const response = await fetch(`${realtimeBaseUrl}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      [INTERNAL_HEADER]: '1',
      [INTERNAL_TOKEN_HEADER]: getRealtimeSessionSecret(),
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  const payload = await response.json().catch(() => ({ error: { message: 'Realtime bootstrap failed' } }));
  if (!response.ok) {
    const error = payload as { error?: { message?: string } };
    throw new Error(error.error?.message || 'Realtime bootstrap failed');
  }

  return payload as TResponse;
}

export async function createSignedRealtimeSession(params: {
  role: ParticipantRole;
  roomCode: string;
  participantId?: string;
  displayName?: string;
  avatar?: string;
  ttlSeconds?: number;
}): Promise<{ session: SignedParticipantSession; sessionToken: string }> {
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const session: SignedParticipantSession = {
    participantId: params.participantId ?? crypto.randomUUID(),
    role: params.role,
    roomCode: normalizeRoomCode(params.roomCode),
    displayName: sanitizeOptionalString(params.displayName),
    avatar: sanitizeOptionalString(params.avatar),
    protocolVersion: PROTOCOL_VERSION,
    nonce: crypto.randomUUID(),
    issuedAt: nowInSeconds,
    exp: nowInSeconds + (params.ttlSeconds ?? DEFAULT_SESSION_TTL_SECONDS),
  };

  return {
    session,
    sessionToken: await signParticipantSessionToken(session, getRealtimeSessionSecret()),
  };
}
