import { z } from 'zod';
import {
  ClientEventSchema,
  ParticipantSessionSchema,
  RoomSnapshotSchema,
  createProtocolEnvelope,
  parseServerEvent,
  type ClientEvent,
  type ParticipantSession,
  type RoomSnapshot,
  type ServerEvent,
} from '@kouch/contracts';

import type { ConnectionState } from '@/lib/store/types';

const RealtimeBootstrapResponseSchema = z.object({
  ok: z.literal(true),
  roomCode: z.string().trim().length(4),
  session: ParticipantSessionSchema,
  encodedSession: z.string().min(1),
  websocketPath: z.string().min(1),
  websocketUrl: z.string().url(),
  snapshot: RoomSnapshotSchema,
});

type RealtimeBootstrapResponse = z.infer<typeof RealtimeBootstrapResponseSchema>;

type RealtimeErrorResponse = {
  error?: {
    message?: string;
  };
};

export type HostBootstrapInput = {
  participantId?: string;
  displayName?: string;
  avatar?: string;
  pack?: string;
};

export type JoinRoomInput = {
  roomCode: string;
  participantId?: string;
  displayName?: string;
  avatar?: string;
};

export type RealtimeSessionConnectParams = {
  websocketUrl: string;
};

export type TransportSubscriptionHandler = (event: ServerEvent) => void;
export type ConnectionStateListener = (state: ConnectionState) => void;

export interface RealtimeTransport {
  connect(session: RealtimeSessionConnectParams): void;
  disconnect(): void;
  send(event: ClientEvent): void;
  subscribe(handler: TransportSubscriptionHandler): () => void;
  setConnectionStateListener(listener?: ConnectionStateListener): void;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as RealtimeErrorResponse;
    return body.error?.message || response.statusText || 'Realtime request failed';
  } catch {
    return response.statusText || 'Realtime request failed';
  }
}

async function postRealtimeJson(
  url: string,
  body: Record<string, unknown>,
): Promise<RealtimeBootstrapResponse> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return RealtimeBootstrapResponseSchema.parse(await response.json());
}

export async function bootstrapHostSession(
  baseUrl: string,
  input: HostBootstrapInput,
): Promise<RealtimeBootstrapResponse> {
  return postRealtimeJson(`${normalizeBaseUrl(baseUrl)}/api/rooms`, {
    participantId: input.participantId,
    displayName: input.displayName,
    avatar: input.avatar,
    pack: input.pack,
  });
}

export async function authorizeJoinSession(
  baseUrl: string,
  input: JoinRoomInput,
): Promise<RealtimeBootstrapResponse> {
  return postRealtimeJson(`${normalizeBaseUrl(baseUrl)}/api/rooms/${input.roomCode.toUpperCase()}/join`, {
    participantId: input.participantId,
    displayName: input.displayName,
    avatar: input.avatar,
  });
}

export function createPartyKitTransport(): RealtimeTransport {
  let socket: WebSocket | null = null;
  let websocketUrl: string | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectAttempts = 0;
  let intentionallyClosed = false;
  let connectionStateListener: ConnectionStateListener | undefined;
  const subscribers = new Set<TransportSubscriptionHandler>();

  const notifyState = (state: ConnectionState) => {
    connectionStateListener?.(state);
  };

  const clearReconnectTimer = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const openSocket = (state: ConnectionState) => {
    if (!websocketUrl) {
      return;
    }

    clearReconnectTimer();
    notifyState(state);

    const nextSocket = new WebSocket(websocketUrl);
    socket = nextSocket;

    nextSocket.onopen = () => {
      if (socket !== nextSocket) {
        return;
      }

      reconnectAttempts = 0;
      notifyState('connected');
    };

    nextSocket.onmessage = (event) => {
      if (socket !== nextSocket) {
        return;
      }

      try {
        const serverEvent = parseServerEvent(event.data);
        subscribers.forEach((handler) => handler(serverEvent));
      } catch (error) {
        console.error('Failed to parse realtime event', error);
      }
    };

    nextSocket.onerror = () => {
      if (socket !== nextSocket || !websocketUrl) {
        return;
      }

      if (nextSocket.readyState !== WebSocket.OPEN) {
        notifyState(reconnectAttempts > 0 ? 'reconnecting' : 'connecting');
      }
    };

    nextSocket.onclose = (event) => {
      if (socket !== nextSocket) {
        return;
      }

      socket = null;

      if (intentionallyClosed) {
        notifyState('disconnected');
        return;
      }

      if (event.code === 1000) {
        notifyState('disconnected');
        return;
      }

      if (event.code >= 4000 && event.code < 4100) {
        notifyState('failed');
        return;
      }

      reconnectAttempts += 1;
      notifyState('reconnecting');
      const delayMs = Math.min(1000 * 2 ** (reconnectAttempts - 1), 5000);
      reconnectTimer = setTimeout(() => openSocket('reconnecting'), delayMs);
    };
  };

  return {
    connect(session) {
      const nextWebsocketUrl = session.websocketUrl;
      const sameSession = websocketUrl === nextWebsocketUrl;
      websocketUrl = nextWebsocketUrl;
      intentionallyClosed = false;

      if (
        sameSession
        && socket
        && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)
      ) {
        return;
      }

      clearReconnectTimer();

      if (socket) {
        socket.close();
        socket = null;
      }

      openSocket(sameSession && reconnectAttempts > 0 ? 'reconnecting' : 'connecting');
    },
    disconnect() {
      intentionallyClosed = true;
      reconnectAttempts = 0;
      websocketUrl = null;
      clearReconnectTimer();

      if (socket) {
        socket.close(1000, 'Client disconnected');
        socket = null;
      }

      notifyState('disconnected');
    },
    send(event) {
      const payload = ClientEventSchema.parse(event);
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        return;
      }

      socket.send(JSON.stringify(createProtocolEnvelope(payload)));
    },
    subscribe(handler) {
      subscribers.add(handler);
      return () => {
        subscribers.delete(handler);
      };
    },
    setConnectionStateListener(listener) {
      connectionStateListener = listener;
    },
  };
}

export type { ParticipantSession, RoomSnapshot };
