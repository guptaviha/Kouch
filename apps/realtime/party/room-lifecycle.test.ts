import assert from 'node:assert/strict';
import test from 'node:test';

import { createRoomState, type GameTransitionResult } from '@kouch/game-engine';
import { PROTOCOL_VERSION, type ParticipantRole } from '@kouch/contracts';

import {
  getDesiredAlarmAt,
  getInactivityDeadline,
  shouldAdvanceExpiredTimer,
  type RoomLifecycleRuntime,
} from './room-lifecycle.js';
import { ROOM_INACTIVITY_TTL_MS, type RoomLogLevel, type RoomMetricName } from './runtime-shared.js';

function createLifecycleRuntime(overrides?: {
  activeConnectionCount?: number;
  timerEndsAt?: number | null;
  phase?: 'lobby' | 'playing' | 'round_result' | 'finished';
}) {
  const now = 10_000;
  const state = createRoomState({
    roomCode: 'ABCD',
    protocolVersion: PROTOCOL_VERSION,
    now,
  });

  state.phase = overrides?.phase ?? 'lobby';
  state.round.timerEndsAt = overrides?.timerEndsAt ?? null;

  const runtime: RoomLifecycleRuntime = {
    roomCode: 'ABCD',
    room: {
      storage: {
        async get() {
          return undefined;
        },
        async put() {
          return undefined;
        },
        async setAlarm() {
          return undefined;
        },
        async deleteAlarm() {
          return undefined;
        },
        async deleteAll() {
          return undefined;
        },
      },
    },
    state,
    lastActiveAt: now,
    scheduledAlarmAt: null,
    lastCheckpointReason: 'test',
    getActiveConnectionCount() {
      return overrides?.activeConnectionCount ?? 0;
    },
    clearConnectionState() {
      return undefined;
    },
    log(_level: RoomLogLevel, _event: string, _context?: Record<string, unknown>) {
      return undefined;
    },
    logMetric(_metric: RoomMetricName, _context?: Record<string, unknown>) {
      return undefined;
    },
    async runTransition(_result: GameTransitionResult, _options?: {
      reason?: string;
      commandType?: string;
      participantId?: string;
      role?: ParticipantRole;
      correlationId?: string;
      markActivity?: boolean;
      source?: string;
    }) {
      return undefined;
    },
  };

  return runtime;
}

test('getInactivityDeadline disables idle expiry while players are connected', () => {
  const runtime = createLifecycleRuntime({ activeConnectionCount: 2 });

  assert.equal(getInactivityDeadline(runtime.state, runtime.lastActiveAt, runtime.getActiveConnectionCount()), null);
});

test('getDesiredAlarmAt prefers the earlier active timer over idle expiry', () => {
  const timerEndsAt = 15_000;
  const runtime = createLifecycleRuntime({ phase: 'playing', timerEndsAt });

  assert.equal(getDesiredAlarmAt(runtime), timerEndsAt);
});

test('getDesiredAlarmAt falls back to idle expiry when no timer is running', () => {
  const runtime = createLifecycleRuntime();

  assert.equal(getDesiredAlarmAt(runtime), runtime.lastActiveAt + ROOM_INACTIVITY_TTL_MS);
});

test('shouldAdvanceExpiredTimer only advances active timed phases', () => {
  const playingRuntime = createLifecycleRuntime({ phase: 'playing', timerEndsAt: 9_999 });
  const lobbyRuntime = createLifecycleRuntime({ phase: 'lobby', timerEndsAt: 9_999 });

  assert.equal(shouldAdvanceExpiredTimer(playingRuntime.state, 10_000), true);
  assert.equal(shouldAdvanceExpiredTimer(lobbyRuntime.state, 10_000), false);
});