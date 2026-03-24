import test from 'node:test';
import assert from 'node:assert/strict';
import type { RoomPackDefinition } from '@kouch/game-content';
import {
  DEFAULT_ROUND_DURATION_MS,
  addPlayer,
  advanceRound,
  closeRoom,
  configureRoom,
  createRoomState,
  pauseGame,
  resumeGame,
  startGame,
  submitAnswer,
  upsertParticipant,
  useHint,
} from './index.js';

const samplePack: RoomPackDefinition = {
  id: 1,
  name: 'Sample Pack',
  description: null,
  imageUrl: 'https://example.com/pack.png',
  gameType: 'trivia',
  questions: [
    {
      question: 'Capital of France?',
      answers: ['Paris'],
      questionType: 'open_ended',
      hint: 'City of lights',
    },
    {
      question: 'Movie quote',
      answers: ['The Matrix'],
      questionType: 'multi_part',
      prompts: ['Blue pill', 'Red pill'],
      promptImages: [null, null],
      hint: '1999 sci-fi',
    },
  ],
};

function createSeededState() {
  const now = 1_000;
  let state = createRoomState({
    roomCode: 'ABCD',
    protocolVersion: 1,
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

  state = addPlayer(state, {
    participantId: 'player-1',
    displayName: 'Ada',
    now,
  }).state;

  state = addPlayer(state, {
    participantId: 'player-2',
    displayName: 'Linus',
    now,
  }).state;

  return state;
}

test('startGame begins the first round and schedules an alarm', () => {
  const started = startGame(createSeededState(), { now: 2_000 });

  assert.equal(started.ok, true);
  assert.equal(started.state.phase, 'playing');
  assert.equal(started.state.round.roundIndex, 0);
  assert.equal(started.timerIntent?.type, 'set-alarm');
  assert.equal(started.timerIntent?.at, 2_000 + DEFAULT_ROUND_DURATION_MS);
  assert.equal(started.events[0]?.type, 'round_started');
});

test('submitAnswer scores a correct standard answer with time bonus', () => {
  const started = startGame(createSeededState(), { now: 2_000 });
  const firstAnswer = submitAnswer(started.state, {
    participantId: 'player-1',
    answer: 'Paris',
    now: 3_000,
  });
  const secondAnswer = submitAnswer(firstAnswer.state, {
    participantId: 'player-2',
    answer: 'London',
    now: 4_000,
  });

  assert.equal(secondAnswer.ok, true);
  assert.equal(secondAnswer.state.phase, 'round_result');
  const resultEvent = secondAnswer.events.find((event) => event.type === 'round_result_ready');
  assert.ok(resultEvent && resultEvent.type === 'round_result_ready');

  const ada = resultEvent.result.results.find((entry) => entry.playerId === 'player-1');
  const linus = resultEvent.result.results.find((entry) => entry.playerId === 'player-2');
  assert.ok(ada);
  assert.ok(linus);
  assert.equal(ada.correct, true);
  assert.equal(ada.points, 293);
  assert.equal(linus.points, 0);
});

test('useHint halves awarded points for correct answers', () => {
  const started = startGame(createSeededState(), { now: 10_000 });
  const hinted = useHint(started.state, {
    participantId: 'player-1',
    now: 10_500,
  });
  const firstAnswer = submitAnswer(hinted.state, {
    participantId: 'player-1',
    answer: 'Paris',
    now: 11_000,
  });
  const secondAnswer = submitAnswer(firstAnswer.state, {
    participantId: 'player-2',
    answer: 'Berlin',
    now: 12_000,
  });

  const resultEvent = secondAnswer.events.find((event) => event.type === 'round_result_ready');
  assert.ok(resultEvent && resultEvent.type === 'round_result_ready');
  const ada = resultEvent.result.results.find((entry) => entry.playerId === 'player-1');
  assert.ok(ada);
  assert.equal(ada.points, 146);
  assert.equal(ada.hintUsed, true);
});

test('advanceRound progresses multi-part questions and awards staged points', () => {
  const started = startGame(createSeededState(), { now: 20_000 });
  const firstRoundDone = submitAnswer(started.state, {
    participantId: 'player-1',
    answer: 'Paris',
    now: 21_000,
  });
  const firstRoundResult = submitAnswer(firstRoundDone.state, {
    participantId: 'player-2',
    answer: 'Rome',
    now: 22_000,
  });
  const secondRoundStart = advanceRound(firstRoundResult.state, { now: 32_000 });

  assert.equal(secondRoundStart.state.round.currentPartIndex, 0);
  assert.equal(secondRoundStart.events[0]?.type, 'round_started');

  const p1Wrong = submitAnswer(secondRoundStart.state, {
    participantId: 'player-1',
    answer: 'Avatar',
    now: 33_000,
  });
  const p2Correct = submitAnswer(p1Wrong.state, {
    participantId: 'player-2',
    answer: 'The Matrix',
    now: 34_000,
  });

  assert.equal(p2Correct.state.phase, 'playing');
  assert.equal(p2Correct.state.round.currentPartIndex, 1);

  const p1CorrectSecondStage = submitAnswer(p2Correct.state, {
    participantId: 'player-1',
    answer: 'The Matrix',
    now: 35_000,
  });
  const resultEvent = p1CorrectSecondStage.events.find((event) => event.type === 'round_result_ready');
  assert.ok(resultEvent && resultEvent.type === 'round_result_ready');

  const ada = resultEvent.result.results.find((entry) => entry.playerId === 'player-1');
  const linus = resultEvent.result.results.find((entry) => entry.playerId === 'player-2');
  assert.ok(ada);
  assert.ok(linus);
  assert.equal(ada.points, 200);
  assert.equal(linus.points, 300);
});

test('pauseGame, resumeGame, and closeRoom return timer intents', () => {
  const started = startGame(createSeededState(), { now: 60_000 });
  const paused = pauseGame(started.state, { now: 65_000 });
  assert.equal(paused.ok, true);
  assert.equal(paused.events[0]?.type, 'game_paused');
  assert.equal(paused.timerIntent?.at, null);

  const resumed = resumeGame(paused.state, { now: 70_000 });
  assert.equal(resumed.ok, true);
  assert.equal(resumed.events[0]?.type, 'game_resumed');
  assert.ok(typeof resumed.timerIntent?.at === 'number');

  const closed = closeRoom(resumed.state, { now: 75_000, reason: 'Done' });
  assert.equal(closed.ok, true);
  assert.equal(closed.events[0]?.type, 'room_closed');
  assert.equal(closed.timerIntent?.at, null);
});
