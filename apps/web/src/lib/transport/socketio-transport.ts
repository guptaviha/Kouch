import { io, type Socket } from 'socket.io-client';
import {
  parseTransportServerEvent,
  type TransportClientEvent,
  type TransportServerEvent,
} from '@kouch/contracts';

import type { ConnectionState } from '@/lib/store/types';
import type {
  ConnectionStateListener,
  RealtimeSessionConnectParams,
  RealtimeTransport,
  TransportSubscriptionHandler,
} from '@/lib/transport/partykit-transport';

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

export function createSocketIoTransport(): RealtimeTransport {
  let socket: Socket | null = null;
  let connectionUrl: string | null = null;
  let intentionallyClosed = false;
  let hasConnected = false;
  let connectionStateListener: ConnectionStateListener | undefined;
  const subscribers = new Set<TransportSubscriptionHandler>();

  const notifyState = (state: ConnectionState) => {
    connectionStateListener?.(state);
  };

  const teardownSocket = () => {
    if (!socket) {
      return;
    }

    socket.removeAllListeners();
    socket.io.removeAllListeners();
    socket.close();
    socket = null;
  };

  return {
    connect(session: RealtimeSessionConnectParams) {
      const nextConnectionUrl = normalizeBaseUrl(session.websocketUrl);
      const sameConnection = connectionUrl === nextConnectionUrl;
      connectionUrl = nextConnectionUrl;
      intentionallyClosed = false;

      if (sameConnection && socket?.connected) {
        return;
      }

      teardownSocket();
      notifyState(hasConnected ? 'reconnecting' : 'connecting');

      const nextSocket = io(nextConnectionUrl, {
        path: '/ws',
        transports: ['websocket'],
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      socket = nextSocket;

      nextSocket.on('connect', () => {
        if (socket !== nextSocket) {
          return;
        }

        hasConnected = true;
        notifyState('connected');
      });

      nextSocket.on('server', (event: TransportServerEvent) => {
        if (socket !== nextSocket) {
          return;
        }

        try {
          const parsedEvent = parseTransportServerEvent(event);
          subscribers.forEach((handler) => handler(parsedEvent));
        } catch (error) {
          console.error('Failed to parse legacy realtime event', error);
        }
      });

      nextSocket.on('connect_error', () => {
        if (socket !== nextSocket) {
          return;
        }

        notifyState(hasConnected ? 'reconnecting' : 'connecting');
      });

      nextSocket.io.on('reconnect_attempt', () => {
        if (socket !== nextSocket) {
          return;
        }

        notifyState('reconnecting');
      });

      nextSocket.io.on('reconnect_failed', () => {
        if (socket !== nextSocket) {
          return;
        }

        notifyState('failed');
      });

      nextSocket.on('disconnect', (reason) => {
        if (socket !== nextSocket) {
          return;
        }

        if (intentionallyClosed || reason === 'io client disconnect') {
          notifyState('disconnected');
          return;
        }

        notifyState('reconnecting');
      });
    },
    disconnect() {
      intentionallyClosed = true;
      connectionUrl = null;
      teardownSocket();
      notifyState('disconnected');
    },
    send(event: TransportClientEvent) {
      socket?.emit('message', event);
    },
    subscribe(handler: TransportSubscriptionHandler) {
      subscribers.add(handler);
      return () => {
        subscribers.delete(handler);
      };
    },
    setConnectionStateListener(listener?: ConnectionStateListener) {
      connectionStateListener = listener;
    },
  };
}
