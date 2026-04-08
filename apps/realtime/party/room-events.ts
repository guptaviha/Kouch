import type * as Party from 'partykit/server';
import {
  getCurrentRoundView,
  getLastRoundResult,
  getLeaderboard,
  type GameEngineEvent,
  type GameParticipant,
  type GameRoomState,
} from '@kouch/game-engine';
import type { ParticipantRole, PlayerWire, RoomSnapshot, TransportServerEvent } from '@kouch/contracts';

import type { RoomLogLevel, RoomMetricName } from './runtime-shared.js';

type DomainEventContext = {
  commandType?: string;
  participantId?: string;
  role?: ParticipantRole;
  correlationId?: string;
  source?: string;
};

export type RoomEventRuntime = {
  state: GameRoomState;
  getPlayerParticipants(): GameParticipant[];
  toPlayerWire(participantId: string): PlayerWire;
  buildSnapshot(): RoomSnapshot;
  sendRaw(connection: Party.Connection, event: TransportServerEvent): void;
  broadcast(event: TransportServerEvent): void;
  log(level: RoomLogLevel, event: string, context?: Record<string, unknown>): void;
  logMetric(metric: RoomMetricName, context?: Record<string, unknown>): void;
};

export function broadcastLobbyUpdate(runtime: RoomEventRuntime) {
  runtime.broadcast({
    type: 'lobby_update',
    roomCode: runtime.state.roomCode,
    players: runtime.getPlayerParticipants().map((participant) => runtime.toPlayerWire(participant.participantId)),
    state: runtime.state.phase,
  });
}

export function broadcastSnapshot(runtime: RoomEventRuntime) {
  runtime.broadcast({
    type: 'room_snapshot',
    snapshot: runtime.buildSnapshot(),
  });
}

export function emitCurrentPhaseState(runtime: RoomEventRuntime, connection: Party.Connection) {
  const roundView = getCurrentRoundView(runtime.state);
  if (roundView) {
    runtime.sendRaw(connection, {
      type: 'game_state',
      state: 'playing',
      roomCode: runtime.state.roomCode,
      roundIndex: roundView.roundIndex,
      currentPartIndex: roundView.currentPartIndex,
      totalParts: roundView.totalParts,
      question: roundView.question,
      questionType: roundView.questionType,
      prompts: roundView.prompts,
      promptImages: roundView.promptImages,
      image: roundView.image ?? undefined,
      hint: roundView.hint,
      timerEndsAt: roundView.timerEndsAt,
      totalQuestionDuration: roundView.totalQuestionDuration,
      answeredPlayers: roundView.answeredParticipantIds,
    });
    return;
  }

  const lastRoundResult = getLastRoundResult(runtime.state);
  if (lastRoundResult && runtime.state.phase === 'round_result') {
    runtime.sendRaw(connection, {
      type: 'round_result',
      roomCode: runtime.state.roomCode,
      roundIndex: lastRoundResult.roundIndex,
      results: lastRoundResult.results,
      leaderboard: getLeaderboard(runtime.state).map((participant) => runtime.toPlayerWire(participant.participantId)),
      correctAnswer: lastRoundResult.correctAnswer,
      nextTimerEndsAt: lastRoundResult.nextTimerEndsAt,
      nextTimerDurationMs: lastRoundResult.nextTimerDurationMs,
    });
    return;
  }

  if (runtime.state.phase === 'finished') {
    runtime.sendRaw(connection, {
      type: 'final_leaderboard',
      roomCode: runtime.state.roomCode,
      leaderboard: getLeaderboard(runtime.state).map((participant) => runtime.toPlayerWire(participant.participantId)),
    });
  }
}

export function emitDomainEvent(
  runtime: RoomEventRuntime,
  event: GameEngineEvent,
  context?: DomainEventContext,
) {
  switch (event.type) {
    case 'lobby_updated': {
      broadcastLobbyUpdate(runtime);
      return;
    }
    case 'round_started': {
      runtime.logMetric('round_transitions', {
        correlationId: context?.correlationId,
        commandType: context?.commandType,
        participantId: context?.participantId,
        role: context?.role,
        source: context?.source,
        transition: 'round_started',
        roundIndex: event.round.roundIndex,
      });
      runtime.log('info', 'round_started', {
        correlationId: context?.correlationId,
        commandType: context?.commandType,
        participantId: context?.participantId,
        role: context?.role,
        source: context?.source,
        roundIndex: event.round.roundIndex,
      });
      runtime.broadcast({
        type: 'game_state',
        state: 'playing',
        roomCode: runtime.state.roomCode,
        roundIndex: event.round.roundIndex,
        currentPartIndex: event.round.currentPartIndex,
        totalParts: event.round.totalParts,
        question: event.round.question,
        questionType: event.round.questionType,
        prompts: event.round.prompts,
        promptImages: event.round.promptImages,
        image: event.round.image ?? undefined,
        hint: event.round.hint,
        timerEndsAt: event.round.timerEndsAt,
        totalQuestionDuration: event.round.totalQuestionDuration,
        answeredPlayers: event.round.answeredParticipantIds,
      });
      return;
    }
    case 'round_result_ready': {
      runtime.logMetric('round_transitions', {
        correlationId: context?.correlationId,
        commandType: context?.commandType,
        participantId: context?.participantId,
        role: context?.role,
        source: context?.source,
        transition: 'round_result_ready',
        roundIndex: event.result.roundIndex,
      });
      runtime.log('info', 'round_result_ready', {
        correlationId: context?.correlationId,
        commandType: context?.commandType,
        participantId: context?.participantId,
        role: context?.role,
        source: context?.source,
        roundIndex: event.result.roundIndex,
      });
      runtime.broadcast({
        type: 'round_result',
        roomCode: runtime.state.roomCode,
        roundIndex: event.result.roundIndex,
        results: event.result.results,
        leaderboard: getLeaderboard(runtime.state).map((participant) => runtime.toPlayerWire(participant.participantId)),
        correctAnswer: event.result.correctAnswer,
        nextTimerEndsAt: event.result.nextTimerEndsAt,
        nextTimerDurationMs: event.result.nextTimerDurationMs,
      });
      return;
    }
    case 'game_finished': {
      runtime.log('info', 'game_finished', {
        correlationId: context?.correlationId,
        commandType: context?.commandType,
        participantId: context?.participantId,
        role: context?.role,
        source: context?.source,
      });
      runtime.broadcast({
        type: 'final_leaderboard',
        roomCode: runtime.state.roomCode,
        leaderboard: getLeaderboard(runtime.state).map((participant) => runtime.toPlayerWire(participant.participantId)),
      });
      return;
    }
    case 'game_paused': {
      runtime.log('info', 'game_paused', {
        correlationId: context?.correlationId,
        commandType: context?.commandType,
        participantId: context?.participantId,
        role: context?.role,
        source: context?.source,
      });
      runtime.broadcast({
        type: 'game_paused',
        roomCode: runtime.state.roomCode,
        pauseRemainingMs: event.pauseRemainingMs,
      });
      return;
    }
    case 'game_resumed': {
      runtime.log('info', 'game_resumed', {
        correlationId: context?.correlationId,
        commandType: context?.commandType,
        participantId: context?.participantId,
        role: context?.role,
        source: context?.source,
      });
      runtime.broadcast({
        type: 'game_resumed',
        roomCode: runtime.state.roomCode,
        nextTimerEndsAt: event.nextTimerEndsAt,
      });
      return;
    }
    case 'timer_updated': {
      runtime.log('info', 'timer_updated', {
        correlationId: context?.correlationId,
        commandType: context?.commandType,
        participantId: context?.participantId,
        role: context?.role,
        source: context?.source,
        timerEndsAt: event.timerEndsAt,
      });
      runtime.broadcast({
        type: 'timer_updated',
        roomCode: runtime.state.roomCode,
        timerEndsAt: event.timerEndsAt,
        totalQuestionDuration: event.totalQuestionDuration,
      });
      return;
    }
    case 'player_answered': {
      runtime.log('info', 'player_answered', {
        correlationId: context?.correlationId,
        commandType: context?.commandType,
        participantId: event.playerId,
        role: 'player',
        source: context?.source,
      });
      runtime.broadcast({
        type: 'player_answered',
        roomCode: runtime.state.roomCode,
        playerId: event.playerId,
      });
      return;
    }
    case 'player_hint_used': {
      runtime.log('info', 'player_hint_used', {
        correlationId: context?.correlationId,
        commandType: context?.commandType,
        participantId: event.playerId,
        role: 'player',
        source: context?.source,
      });
      runtime.broadcast({
        type: 'player_hint_used',
        playerId: event.playerId,
      });
      return;
    }
    case 'room_closed': {
      runtime.log('info', 'room_closed', {
        correlationId: context?.correlationId,
        commandType: context?.commandType,
        participantId: context?.participantId,
        role: context?.role,
        source: context?.source,
        reason: event.reason,
      });
      runtime.broadcast({
        type: 'room_closed',
        roomCode: runtime.state.roomCode,
        reason: event.reason,
      });
      return;
    }
    default: {
      const exhaustive: never = event;
      return exhaustive;
    }
  }
}