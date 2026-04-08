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

type RealtimeBootstrapErrorResponse = {
  error?: {
    message?: string;
  };
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

function isLoopbackHost(hostname: string): boolean {
  return hostname === '127.0.0.1' || hostname === '::1' || hostname === 'localhost';
}

export function normalizeRoomCode(value: string): string {
  return RoomCodeSchema.parse(value);
}

export function buildRealtimeWebSocketUrl(
  baseUrl: string,
  roomCode: string,
  sessionToken: string,
  publicHost?: string,
): string {
  const url = new URL(baseUrl);
  if (publicHost && isLoopbackHost(url.hostname)) {
    url.hostname = publicHost;
  }

  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = `/parties/main/${normalizeRoomCode(roomCode)}`;
  url.search = `session=${encodeURIComponent(sessionToken)}`;
  return url.toString();
}

export function getRequestPublicHost(request: Request): string | undefined {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const hostHeader = forwardedHost || request.headers.get('host');
  if (!hostHeader) {
    return undefined;
  }

  const host = hostHeader.split(',')[0].trim();
  try {
    return new URL(`http://${host}`).hostname;
  } catch {
    return undefined;
  }
}

async function readRealtimePayload(response: Response): Promise<{ data: unknown; message?: string }> {
  const text = await response.text().catch(() => '');
  if (!text) {
    return { data: null, message: undefined };
  }

  try {
    const data = JSON.parse(text) as RealtimeBootstrapErrorResponse;
    return {
      data,
      message: data.error?.message,
    };
  } catch {
    return {
      data: text,
      message: text,
    };
  }
}

function getFallbackRealtimePath(path: string): string | null {
  if (!path.startsWith('/api/')) {
    return null;
  }

  return path.replace(/^\/api/, '');
}

export async function callRealtimeBootstrap<TResponse>(path: string, body: Record<string, unknown>): Promise<TResponse> {
  const realtimeBaseUrl = getRealtimeServerBaseUrl();
  const headers = {
    'content-type': 'application/json',
    [INTERNAL_HEADER]: '1',
    [INTERNAL_TOKEN_HEADER]: getRealtimeSessionSecret(),
  };
  const payloadBody = JSON.stringify(body);

  const tryFetch = async (targetPath: string) => fetch(`${realtimeBaseUrl}${targetPath}`, {
    method: 'POST',
    headers,
    body: payloadBody,
    cache: 'no-store',
  });

  let response = await tryFetch(path);
  if (response.status === 404) {
    const fallbackPath = getFallbackRealtimePath(path);
    if (fallbackPath) {
      response = await tryFetch(fallbackPath);
    }
  }

  const payload = await readRealtimePayload(response);
  if (!response.ok) {
    throw new Error(payload.message || 'Realtime bootstrap failed');
  }

  return payload.data as TResponse;
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
