import Server from '../apps/realtime/party/index.js';
import { createRoomState } from '@kouch/game-engine';
import {
  startGame,
  upsertParticipant,
  configureRoom,
} from '@kouch/game-engine';

const samplePack = {
  id: 1,
  name: 'Sample Pack',
  description: null,
  imageUrl: 'https://example.com/pack.png',
  gameType: 'trivia',
  questions: [
    { question: 'Q1', answers: ['A1'], questionType: 'open_ended' },
    { question: 'Q2', answers: ['A2'], questionType: 'open_ended' },
  ],
};

class InMemoryStorage {
  store = new Map();
  alarm: number | null = null;
  async get(key: string) {
    return this.store.get(key) ?? null;
  }
  async put(key: string, value: unknown) {
    this.store.set(key, value);
  }
  async setAlarm(at: number | null) {
    this.alarm = at;
    console.log('setAlarm called ->', at);
  }
  async deleteAlarm() {
    this.alarm = null;
    console.log('deleteAlarm called');
  }
  async deleteAll() {
    this.store.clear();
    this.alarm = null;
    console.log('deleteAll called');
  }
}

async function main() {
  const room: any = {
    id: 'ABCD',
    env: {},
    getConnections: () => new Set(),
    storage: new InMemoryStorage(),
  };

  const server = new (Server as any)(room);
  await server.onStart();

  const now = Date.now();

  // add host
  await (server as any).runTransition(upsertParticipant(server.state, {
    participantId: 'host-1',
    role: 'host',
    displayName: 'Host',
    now,
  }), { reason: 'setup', commandType: 'test', participantId: 'host-1', role: 'host' });

  // configure pack
  await (server as any).runTransition(configureRoom(server.state, {
    hostParticipantId: 'host-1',
    selectedPack: '1',
    packDefinition: samplePack,
    now,
  }), { reason: 'configure', commandType: 'test', participantId: 'host-1', role: 'host' });

  // start game (schedules alarm)
  await (server as any).runTransition(startGame(server.state, { now: Date.now(), roundDurationMs: 2000 }), { reason: 'start', commandType: 'test', participantId: 'host-1', role: 'host' });

  console.log('after start state.phase=', server.state.phase, 'timerEndsAt=', server.state.round.timerEndsAt);
  console.log('stored alarm ->', room.storage.alarm);

  // simulate timer expired by setting timerEndsAt in the past
  server.state.round.timerEndsAt = Date.now() - 10;
  console.log('manually set timerEndsAt in past ->', server.state.round.timerEndsAt);

  // call onAlarm to simulate alarm firing
  await server.onAlarm();

  console.log('after onAlarm state.phase=', server.state.phase, 'roundIndex=', server.state.round.roundIndex, 'timerEndsAt=', server.state.round.timerEndsAt);
}

main().catch((err) => {
  console.error('error in test', err);
  process.exit(1);
});
