import {
  DEFAULT_ROUND_DURATION_MS,
  DEFAULT_ROUND_RESULT_DURATION_MS,
  advanceRound,
  closeRoom as closeRoomTransition,
  createRoomState,
  type GameRoomState,
  type GameTransitionResult,
} from '@kouch/game-engine';
import type { ParticipantRole } from '@kouch/contracts';

import {
  CHECKPOINT_SCHEMA_VERSION,
  CHECKPOINT_STORAGE_KEY,
  MAX_RECOVERY_TRANSITIONS,
  ROOM_INACTIVITY_CLOSE_REASON,
  ROOM_INACTIVITY_TTL_MS,
  isGameRoomState,
  isRoomCheckpoint,
  type RoomCheckpoint,
  type RoomLogLevel,
  type RoomMetricName,
} from './runtime-shared.js';

type TransitionContext = {
  reason?: string;
  commandType?: string;
  participantId?: string;
  role?: ParticipantRole;
  correlationId?: string;
  markActivity?: boolean;
  source?: string;
};

export type RoomLifecycleRuntime = {
  roomCode: string;
  room: {
    storage: {
      get<T>(key: string): Promise<T | undefined>;
      put(key: string, value: unknown): Promise<void>;
      setAlarm(at: number): Promise<void>;
      deleteAlarm(): Promise<void>;
      deleteAll(): Promise<void>;
    };
  };
  state: GameRoomState;
  lastActiveAt: number;
  scheduledAlarmAt: number | null;
  lastCheckpointReason: string;
  getActiveConnectionCount(): number;
  clearConnectionState(): void;
  log(level: RoomLogLevel, event: string, context?: Record<string, unknown>): void;
  logMetric(metric: RoomMetricName, context?: Record<string, unknown>): void;
  runTransition(result: GameTransitionResult, options?: TransitionContext): Promise<void>;
};

export function getRoundAlarmAt(state: GameRoomState): number | null {
  if ((state.phase !== 'playing' && state.phase !== 'round_result') || state.round.timerEndsAt == null) {
    return null;
  }

  return state.round.timerEndsAt;
}

export function getInactivityDeadline(
  state: GameRoomState,
  lastActiveAt: number,
  activeConnectionCount: number,
): number | null {
  if (activeConnectionCount > 0) {
    return null;
  }

  return Math.max(lastActiveAt, state.updatedAt, state.createdAt) + ROOM_INACTIVITY_TTL_MS;
}

export function shouldAdvanceExpiredTimer(state: GameRoomState, now = Date.now()): boolean {
  return (state.phase === 'playing' || state.phase === 'round_result')
    && state.round.timerEndsAt != null
    && state.round.timerEndsAt <= now;
}

export function getDesiredAlarmAt(runtime: RoomLifecycleRuntime): number | null {
  const candidates = [
    getRoundAlarmAt(runtime.state),
    getInactivityDeadline(runtime.state, runtime.lastActiveAt, runtime.getActiveConnectionCount()),
  ].filter((value): value is number => value != null);

  if (candidates.length === 0) {
    return null;
  }

  return Math.min(...candidates);
}

export function isInactiveExpired(runtime: RoomLifecycleRuntime, now = Date.now()): boolean {
  const inactivityDeadline = getInactivityDeadline(runtime.state, runtime.lastActiveAt, runtime.getActiveConnectionCount());
  return inactivityDeadline != null && inactivityDeadline <= now;
}

export async function persistCheckpoint(runtime: RoomLifecycleRuntime, reason: string, savedAt: number) {
  runtime.lastCheckpointReason = reason;
  await runtime.room.storage.put(CHECKPOINT_STORAGE_KEY, {
    version: CHECKPOINT_SCHEMA_VERSION,
    state: runtime.state,
    lastActiveAt: runtime.lastActiveAt,
    lastCheckpointReason: reason,
    savedAt,
    scheduledAlarmAt: runtime.scheduledAlarmAt,
  } satisfies RoomCheckpoint);
}

export async function flushAlarm(runtime: RoomLifecycleRuntime) {
  if (runtime.scheduledAlarmAt == null) {
    await runtime.room.storage.deleteAlarm();
    return;
  }

  await runtime.room.storage.setAlarm(runtime.scheduledAlarmAt);
}

export async function commitCheckpoint(
  runtime: RoomLifecycleRuntime,
  reason: string,
  options?: { now?: number; markActivity?: boolean },
) {
  const now = options?.now ?? Date.now();
  if (options?.markActivity ?? true) {
    runtime.lastActiveAt = now;
  }

  runtime.scheduledAlarmAt = getDesiredAlarmAt(runtime);
  await persistCheckpoint(runtime, reason, now);
  await flushAlarm(runtime);
}

export async function reconcileRecoveredState(runtime: RoomLifecycleRuntime) {
  const now = Date.now();

  if (isInactiveExpired(runtime, now)) {
    runtime.log('info', 'room_expired_on_start', {
      reason: 'inactivity',
      lastActiveAt: runtime.lastActiveAt,
    });
    await resetDurableRoom(runtime, now);
    return;
  }

  let recoveryTransitions = 0;
  while (shouldAdvanceExpiredTimer(runtime.state, now) && recoveryTransitions < MAX_RECOVERY_TRANSITIONS) {
    const result = advanceRound(runtime.state, {
      now,
      roundDurationMs: DEFAULT_ROUND_DURATION_MS,
      roundResultDurationMs: DEFAULT_ROUND_RESULT_DURATION_MS,
    });

    if (!result.ok) {
      runtime.log('error', 'room_recovery_failed', {
        commandType: 'recovery',
        reason: result.error?.message ?? 'Unable to advance recovered room state',
      });
      break;
    }

    runtime.state = result.state;
    recoveryTransitions += 1;
  }

  if (recoveryTransitions >= MAX_RECOVERY_TRANSITIONS && shouldAdvanceExpiredTimer(runtime.state, now)) {
    runtime.log('warn', 'room_recovery_guard_hit', {
      commandType: 'recovery',
      reason: 'Exceeded maximum recovery transitions',
    });
  }

  runtime.scheduledAlarmAt = getDesiredAlarmAt(runtime);
  await persistCheckpoint(runtime, recoveryTransitions > 0 ? 'state_recovered' : runtime.lastCheckpointReason, now);
  await flushAlarm(runtime);

  runtime.log('info', 'room_recovered', {
    commandType: 'recovery',
    reason: recoveryTransitions > 0 ? 'expired_timer_reconciled' : 'checkpoint_restored',
    recoveredTransitions: recoveryTransitions,
    scheduledAlarmAt: runtime.scheduledAlarmAt,
  });

  if (recoveryTransitions > 0) {
    runtime.logMetric('round_transitions', {
      commandType: 'recovery',
      count: recoveryTransitions,
    });
  }
}

export async function resetDurableRoom(runtime: RoomLifecycleRuntime, now: number) {
  await runtime.room.storage.deleteAll();
  runtime.state = createRoomState({
    roomCode: runtime.roomCode,
    protocolVersion: runtime.state.protocolVersion,
    now,
  });
  runtime.clearConnectionState();
  runtime.lastActiveAt = now;
  runtime.scheduledAlarmAt = null;
  runtime.lastCheckpointReason = 'room_reset';
}

export async function expireRoomForInactivity(runtime: RoomLifecycleRuntime, now: number) {
  if (!runtime.state.closedAt) {
    const result = closeRoomTransition(runtime.state, {
      now,
      reason: ROOM_INACTIVITY_CLOSE_REASON,
    });

    if (result.ok) {
      await runtime.runTransition(result, {
        reason: 'room_closed',
        commandType: 'room_expired',
        markActivity: false,
        source: 'inactivity',
      });
    }
  }

  runtime.log('info', 'room_expired', {
    commandType: 'room_expired',
    reason: ROOM_INACTIVITY_CLOSE_REASON,
    lastActiveAt: runtime.lastActiveAt,
  });

  await resetDurableRoom(runtime, now);
}

export async function restoreCheckpoint(runtime: RoomLifecycleRuntime) {
  const checkpoint = await runtime.room.storage.get<RoomCheckpoint | GameRoomState>(CHECKPOINT_STORAGE_KEY);
  if (!checkpoint) {
    return false;
  }

  if (isRoomCheckpoint(checkpoint)) {
    runtime.state = checkpoint.state;
    runtime.lastActiveAt = checkpoint.lastActiveAt;
    runtime.scheduledAlarmAt = checkpoint.scheduledAlarmAt;
    runtime.lastCheckpointReason = checkpoint.lastCheckpointReason;
  } else if (isGameRoomState(checkpoint)) {
    runtime.state = checkpoint;
    runtime.lastActiveAt = checkpoint.updatedAt;
    runtime.scheduledAlarmAt = checkpoint.round.timerEndsAt;
    runtime.lastCheckpointReason = 'legacy_checkpoint_restored';
  }

  await reconcileRecoveredState(runtime);
  return true;
}