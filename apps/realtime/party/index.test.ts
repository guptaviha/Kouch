import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PROTOCOL_VERSION,
  createProtocolEnvelope,
  signParticipantSessionToken,
  type ParticipantRole,
  type ServerEvent,
  type SignedParticipantSession,
} from '@kouch/contracts';
import {
  configureRoom,
  createRoomState,
  startGame,
  upsertParticipant,
  type GameRoomState,
} from '@kouch/game-engine';
import type { RoomPackDefinition } from '@kouch/game-content';

import Server from './index.js';

const CHECKPOINT_STORAGE_KEY = 'room:checkpoint';
const SESSION_SECRET = 'integration-secret';

const samplePack: RoomPackDefinition = {
  id: 1,
  name: 'Integration Pack',
  description: null,
  imageUrl: 'https://example.com/pack.png',
  gameType: 'trivia',
  questions: [
    {
      question: 'Capital of France?',
      answers: ['Paris'],
      hint: 'City of lights',
      questionType: 'open_ended',
    },
  ],
};

class FakeStorage {
  readonly values = new Map<string, unknown>();
  alarm: number | null = null;

  async get<T>(key: string): Promise<T | undefined> {
    return this.values.get(key) as T | undefined;
  }

  async put(key: string, value: unknown): Promise<void> {
    this.values.set(key, structuredClone(value));
  }

  async setAlarm(at: number): Promise<void> {
    this.alarm = at;
  }

  async deleteAlarm(): Promise<void> {
    this.alarm = null;
  }

  async deleteAll(): Promise<void> {
    this.values.clear();
    this.alarm = null;
  }
}

class FakeConnection {
  readonly sent: ServerEvent[] = [];
  state: { participantId: string; role: ParticipantRole } | null = null;
  closed: { code?: number; reason?: string } | null = null;

  constructor(readonly id: string) {}

  send(message: string) {
    this.sent.push(JSON.parse(message) as ServerEvent);
  }

  setState(state: { participantId: string; role: ParticipantRole }) {
    this.state = state;
  }

  close(code?: number, reason?: string) {
    this.closed = { code, reason };
  }
}

class FakeRoom {
  readonly storage = new FakeStorage();
  readonly env = {
    KOUCH_SESSION_SECRET: SESSION_SECRET,
    NODE_ENV: 'test',
  };
  private readonly connections = new Map<string, FakeConnection>();

  constructor(readonly id: string) {}

  addConnection(connection: FakeConnection) {
    this.connections.set(connection.id, connection);
  }

  removeConnection(connectionId: string) {
    this.connections.delete(connectionId);
  }

  getConnections() {
    return this.connections.values();
  }
}

function getRuntimeState(server: Server): GameRoomState {
  return (server as unknown as { state: GameRoomState }).state;
}

function setRuntimeState(server: Server, state: GameRoomState) {
  (server as unknown as { state: GameRoomState }).state = state;
}

function seedRoomState(roomCode: string, now = Date.now()) {
  let state = createRoomState({
    roomCode,
    protocolVersion: PROTOCOL_VERSION,
    now,
  });

  state = upsertParticipant(state, {
    participantId: 'host-1',
    role: 'host',
    displayName: 'Host',
    now,
  }).state;

  state = configureRoom(state, {
    hostParticipantId: 'host-1',
    selectedPack: '1',
    packDefinition: samplePack,
    now,
  }).state;

  return state;
}

async function createSignedRequest(roomCode: string, participantId: string, role: ParticipantRole, displayName?: string) {
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const session: SignedParticipantSession = {
    participantId,
    role,
    roomCode,
    displayName,
    protocolVersion: PROTOCOL_VERSION,
    nonce: crypto.randomUUID(),
    issuedAt: nowInSeconds,
    exp: nowInSeconds + 60,
  };

  const token = await signParticipantSessionToken(session, SESSION_SECRET);
  return new Request(`http://localhost/parties/main/${roomCode}?session=${encodeURIComponent(token)}`);
}

test('room runtime handles host/player flow and finishes a round', async () => {
  const room = new FakeRoom('ABCD');
  const server = new Server(room as never);
  await server.onStart();
  setRuntimeState(server, seedRoomState('ABCD'));

  const hostConnection = new FakeConnection('host-connection');
  room.addConnection(hostConnection);
  await server.onConnect(hostConnection as never, {
    request: await createSignedRequest('ABCD', 'host-1', 'host', 'Host'),
  } as never);

  const playerConnection = new FakeConnection('player-connection');
  room.addConnection(playerConnection);
  await server.onConnect(playerConnection as never, {
    request: await createSignedRequest('ABCD', 'player-1', 'player', 'Ada'),
  } as never);

  await server.onMessage(JSON.stringify(createProtocolEnvelope({
    type: 'start_game',
    roomCode: 'ABCD',
    playerId: 'host-1',
  })), hostConnection as never);

  assert.ok(playerConnection.sent.some((event) => event.type === 'game_state'));
  assert.ok(room.storage.alarm && room.storage.alarm > Date.now());

  await server.onMessage(JSON.stringify(createProtocolEnvelope({
    type: 'submit_answer',
    roomCode: 'ABCD',
    playerId: 'player-1',
    answer: 'Paris',
  })), playerConnection as never);

  assert.ok(playerConnection.sent.some((event) => event.type === 'answer_received'));
  assert.ok(playerConnection.sent.some((event) => event.type === 'round_result'));

  const state = getRuntimeState(server);
  state.round.timerEndsAt = Date.now() - 1;
  await server.onAlarm();

  assert.equal(getRuntimeState(server).phase, 'finished');
  assert.ok(hostConnection.sent.some((event) => event.type === 'final_leaderboard'));
});

test('room runtime rejects invalid session tokens on connect', async () => {
  const room = new FakeRoom('WXYZ');
  const server = new Server(room as never);
  await server.onStart();

  const connection = new FakeConnection('invalid-connection');
  room.addConnection(connection);
  await server.onConnect(connection as never, {
    request: new Request('http://localhost/parties/main/WXYZ?session=bad-token'),
  } as never);

  assert.equal(connection.closed?.code, 4001);
  assert.equal(connection.sent[0]?.type, 'error');
  assert.equal(connection.sent[0]?.code, 'INVALID_SESSION');
});

test('room runtime restores an expired checkpoint and reschedules the next alarm', async () => {
  const room = new FakeRoom('LMNO');
  const expiredStartedState = startGame(seedRoomState('LMNO', Date.now() - 60_000), {
    now: Date.now() - 20_000,
  }).state;
  expiredStartedState.round.timerEndsAt = Date.now() - 1_000;

  room.storage.values.set(CHECKPOINT_STORAGE_KEY, {
    version: 1,
    state: expiredStartedState,
    lastActiveAt: Date.now() - 10_000,
    lastCheckpointReason: 'game_started',
    savedAt: Date.now() - 10_000,
    scheduledAlarmAt: expiredStartedState.round.timerEndsAt,
  });

  const server = new Server(room as never);
  await server.onStart();

  const recoveredState = getRuntimeState(server);
  assert.equal(recoveredState.phase, 'round_result');
  assert.ok(room.storage.alarm && room.storage.alarm > Date.now());
});

test('room creation preserves upstream error bodies for the web bootstrap caller', async () => {
  const request = new Request('http://localhost/api/rooms', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-kouch-internal': '1',
      'x-kouch-internal-token': SESSION_SECRET,
    },
    body: JSON.stringify({
      participantId: 'host-1',
      displayName: 'Host',
      protocolVersion: PROTOCOL_VERSION,
      pack: 'missing-pack',
    }),
  });

  const response = await Server.onFetch(request as never, {
    env: {
      KOUCH_SESSION_SECRET: SESSION_SECRET,
      NODE_ENV: 'test',
    },
    parties: {
      main: {
        get() {
          return {
            fetch: async () => new Response(JSON.stringify({
              ok: false,
              error: {
                code: 'PACK_LOAD_FAILED',
                message: 'Unable to load pack definition',
                retryable: false,
              },
            }), {
              status: 422,
              headers: {
                'content-type': 'application/json',
              },
            }),
          };
        },
      },
    },
  } as never, {} as never);

  assert.ok(response);
  assert.equal(response?.status, 422);
  assert.deepEqual(await response?.json(), {
    ok: false,
    error: {
      code: 'PACK_LOAD_FAILED',
      message: 'Unable to load pack definition',
      retryable: false,
    },
  });
});

test('room creation accepts the root bootstrap path used by local worker fallback', async () => {
  const response = await Server.onFetch(new Request('http://localhost/rooms', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-kouch-internal': '1',
      'x-kouch-internal-token': SESSION_SECRET,
    },
    body: JSON.stringify({
      participantId: 'host-1',
      displayName: 'Host',
      protocolVersion: PROTOCOL_VERSION,
      pack: '1',
    }),
  }) as never, {
    env: {
      KOUCH_SESSION_SECRET: SESSION_SECRET,
      NODE_ENV: 'test',
    },
    parties: {
      main: {
        get(roomCode: string) {
          return {
            fetch: async () => new Response(JSON.stringify({
              ok: true,
              snapshot: {
                roomCode,
                state: 'lobby',
                players: [],
                stateVersion: 0,
                protocolVersion: PROTOCOL_VERSION,
              },
            }), {
              status: 200,
              headers: {
                'content-type': 'application/json',
              },
            }),
          };
        },
      },
    },
  } as never, {} as never);

  assert.equal(response?.status, 200);
  const payload = await response?.json();
  assert.equal(payload?.ok, true);
  assert.equal(typeof payload?.roomCode, 'string');
});

test('room creation accepts the PartyKit local-dev prefixed bootstrap path', async () => {
  const response = await Server.onFetch(new Request('http://localhost/parties/main/api/rooms', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-kouch-internal': '1',
      'x-kouch-internal-token': SESSION_SECRET,
    },
    body: JSON.stringify({
      participantId: 'host-1',
      displayName: 'Host',
      protocolVersion: PROTOCOL_VERSION,
      pack: '1',
    }),
  }) as never, {
    env: {
      KOUCH_SESSION_SECRET: SESSION_SECRET,
      NODE_ENV: 'test',
    },
    parties: {
      main: {
        get(roomCode: string) {
          return {
            fetch: async () => new Response(JSON.stringify({
              ok: true,
              snapshot: {
                roomCode,
                state: 'lobby',
                players: [],
                stateVersion: 0,
                protocolVersion: PROTOCOL_VERSION,
              },
            }), {
              status: 200,
              headers: {
                'content-type': 'application/json',
              },
            }),
          };
        },
      },
    },
  } as never, {} as never);

  assert.equal(response?.status, 200);
  const payload = await response?.json();
  assert.equal(payload?.ok, true);
  assert.equal(typeof payload?.roomCode, 'string');
});
