import assert from 'node:assert/strict';
import test from 'node:test';

import { PROTOCOL_VERSION, type TransportServerEvent } from '@kouch/contracts';

import {
  authorizeJoinSession,
  bootstrapHostSession,
  createPartyKitTransport,
} from './partykit-transport';

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static OPEN = 1;
  static CONNECTING = 0;

  readonly sent: string[] = [];
  readyState = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;

  constructor(readonly url: string) {
    MockWebSocket.instances.push(this);
  }

  send(payload: string) {
    this.sent.push(payload);
  }

  open() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  receive(event: TransportServerEvent) {
    this.onmessage?.({ data: JSON.stringify(event) });
  }

  close(code = 1000) {
    this.readyState = 3;
    this.onclose?.({ code });
  }
}

test('bootstrap helpers call the Next.js realtime session routes', async () => {
  const originalFetch = globalThis.fetch;
  const fetchCalls: Array<{ url: string; body: Record<string, unknown> }> = [];

  globalThis.fetch = (async (input, init) => {
    fetchCalls.push({
      url: String(input),
      body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>,
    });

    return new Response(JSON.stringify({
      ok: true,
      roomCode: 'ABCD',
      session: {
        participantId: 'player-1',
        role: 'player',
        roomCode: 'ABCD',
        protocolVersion: PROTOCOL_VERSION,
      },
      sessionToken: 'signed-token',
      websocketUrl: 'ws://localhost:1999/parties/main/ABCD?session=signed-token',
      snapshot: {
        roomCode: 'ABCD',
        state: 'lobby',
        players: [],
        stateVersion: 0,
        protocolVersion: PROTOCOL_VERSION,
      },
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;

  await bootstrapHostSession('http://localhost:3000', { displayName: 'Host' });
  await authorizeJoinSession('http://localhost:3000', { roomCode: 'abcd', displayName: 'Ada' });

  assert.equal(fetchCalls[0]?.url, 'http://localhost:3000/api/realtime/session/host');
  assert.equal(fetchCalls[1]?.url, 'http://localhost:3000/api/realtime/session/join');
  assert.equal(fetchCalls[1]?.body.roomCode, 'ABCD');

  globalThis.fetch = originalFetch;
});

test('bootstrap helpers surface JSON error messages from the session routes', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () => new Response(JSON.stringify({
    error: {
      message: 'Room not found',
    },
  }), {
    status: 404,
    headers: {
      'content-type': 'application/json',
    },
  })) as typeof fetch;

  await assert.rejects(
    () => authorizeJoinSession('http://localhost:3000', { roomCode: 'ZZZZ', displayName: 'Ada' }),
    /Room not found/,
  );

  globalThis.fetch = originalFetch;
});

test('PartyKit transport connects, emits envelopes, and forwards server events', async () => {
  const originalWebSocket = globalThis.WebSocket;
  MockWebSocket.instances.length = 0;
  globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;

  const transport = createPartyKitTransport();
  const seenStates: string[] = [];
  const receivedEvents: TransportServerEvent[] = [];

  transport.setConnectionStateListener((state) => {
    seenStates.push(state);
  });

  const unsubscribe = transport.subscribe((event) => {
    receivedEvents.push(event);
  });

  transport.connect({ websocketUrl: 'ws://localhost:1999/parties/main/ABCD?session=token' });
  const socket = MockWebSocket.instances[0];
  assert.ok(socket);
  assert.equal(seenStates[0], 'connecting');

  socket.open();
  assert.equal(seenStates.at(-1), 'connected');

  transport.send({ type: 'ping' });
  assert.deepEqual(JSON.parse(socket.sent[0] ?? '{}'), {
    protocolVersion: PROTOCOL_VERSION,
    event: { type: 'ping' },
  });

  socket.receive({ type: 'pong' });
  assert.deepEqual(receivedEvents, [{ type: 'pong' }]);

  unsubscribe();
  transport.disconnect();
  assert.equal(seenStates.at(-1), 'disconnected');

  globalThis.WebSocket = originalWebSocket;
});
