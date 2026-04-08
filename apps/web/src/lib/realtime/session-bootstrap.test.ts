import assert from 'node:assert/strict';
import test from 'node:test';

import { buildRealtimeWebSocketUrl, callRealtimeBootstrap } from './session-bootstrap';

test('callRealtimeBootstrap falls back to the root worker path after a 404 on /api', async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];

  globalThis.fetch = (async (input) => {
    const url = String(input);
    calls.push(url);

    if (url.endsWith('/api/rooms')) {
      return new Response('Not found', { status: 404 });
    }

    return new Response(JSON.stringify({
      roomCode: 'ABCD',
      snapshot: {
        roomCode: 'ABCD',
        state: 'lobby',
        players: [],
        stateVersion: 0,
        protocolVersion: 1,
      },
    }), {
      status: 200,
      headers: {
        'content-type': 'application/json',
      },
    });
  }) as typeof fetch;

  const payload = await callRealtimeBootstrap<{ roomCode: string }>('/api/rooms', {
    displayName: 'Host',
  });

  assert.equal(payload.roomCode, 'ABCD');
  assert.deepEqual(calls, [
    'http://127.0.0.1:1999/api/rooms',
    'http://127.0.0.1:1999/rooms',
  ]);

  globalThis.fetch = originalFetch;
});

test('buildRealtimeWebSocketUrl replaces loopback host with public host when provided', () => {
  const websocketUrl = buildRealtimeWebSocketUrl(
    'http://127.0.0.1:1999',
    'ABCD',
    'signed-session-token',
    '192.168.0.90',
  );

  assert.equal(websocketUrl, 'ws://192.168.0.90:1999/parties/main/ABCD?session=signed-session-token');
});