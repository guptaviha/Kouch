import type * as Party from 'partykit/server';
import { z } from 'zod';
import {
  GameTypeSchema,
  ParticipantSessionSchema,
  PROTOCOL_VERSION,
  RoomSnapshotSchema,
  type GameType,
  type ParticipantRole,
  type ParticipantSession,
  type PlayerWire,
  type RoomErrorCode,
  type RoomSnapshot,
  type TransportClientEvent,
  type TransportServerEvent,
} from '@kouch/contracts';
import { createGameContentService } from '@kouch/game-content';
import {
  DEFAULT_ROUND_DURATION_MS,
  DEFAULT_ROUND_RESULT_DURATION_MS,
  DEFAULT_TIMER_EXTENSION_MS,
  advanceRound,
  closeRoom as closeRoomTransition,
  createRoomState,
  extendTimer,
  getCurrentRoundView,
  getLastRoundResult,
  pauseGame,
  resetGame,
  resumeGame,
  skipTimer,
  startGame,
  submitAnswer,
  useHint,
  type GameEngineEvent,
  type GameRoomState,
  type GameTransitionResult,
} from '@kouch/game-engine';

import { handleLobbyFetch } from './fetch-handler.js';
import {
  broadcastLobbyUpdate as broadcastLobbyUpdateEvent,
  broadcastSnapshot as broadcastSnapshotEvent,
  emitCurrentPhaseState as emitCurrentPhaseStateEvent,
  emitDomainEvent as emitDomainEventToClients,
  type RoomEventRuntime,
} from './room-events.js';
import {
  commitCheckpoint as commitRoomCheckpoint,
  expireRoomForInactivity as expireInactiveRoom,
  getInactivityDeadline as getRoomInactivityDeadline,
  isInactiveExpired as isRoomInactiveExpired,
  reconcileRecoveredState as reconcileRecoveredRoom,
  restoreCheckpoint,
  shouldAdvanceExpiredTimer as hasExpiredTimer,
  type RoomLifecycleRuntime,
} from './room-lifecycle.js';
import {
  assertJoinAllowed as assertJoinIsAllowed,
  attachConnection as attachRoomConnection,
  bootstrapHost as bootstrapHostSession,
  detachConnection as detachRoomConnection,
  getParticipant as findParticipant,
  requireAttachment as requireRoomAttachment,
  type RoomParticipantRuntime,
} from './room-participants.js';
import {
  DEBUG_TOKEN_HEADER,
  INVALID_SESSION_BLOCK_MS,
  INVALID_SESSION_LIMIT,
  INVALID_SESSION_WINDOW_MS,
  RoomRuntimeError,
  asEnvString,
  getCommandTypeCandidate,
  hasInternalAccess,
  jsonResponse,
  mapEngineError,
  normalizeRoomCode,
  parseClientCommand,
  parseSessionFromRequest,
  toRoomErrorBody,
  toRoomErrorResponse,
  type ConnectionAttachment,
  type RoomLogLevel,
  type RoomMetricName,
} from './runtime-shared.js';

const BootstrapHostRequestSchema = z.object({
  session: ParticipantSessionSchema,
  pack: z.string().min(1).optional(),
  packId: z.number().int().positive().optional(),
  gameType: GameTypeSchema.optional(),
});

const JoinAuthorizationRequestSchema = z.object({
  session: ParticipantSessionSchema,
});

export default class Server implements Party.Server {
  readonly options = {
    hibernate: true,
  } as const;

  static async onFetch(req: Party.Request, lobby: Party.FetchLobby, _ctx: Party.ExecutionContext) {
    return handleLobbyFetch(req, lobby);
  }

  private state: GameRoomState;
  private _roomCode?: string;
  private readonly connectionIndex = new Map<string, ConnectionAttachment>();
  private readonly participantConnections = new Map<string, Set<string>>();
  private invalidSessionWindowStartedAt = 0;
  private invalidSessionAttempts = 0;
  private invalidSessionBlockedUntil = 0;
  private lastActiveAt = Date.now();
  private scheduledAlarmAt: number | null = null;
  private lastCheckpointReason = 'room_initialized';

  constructor(readonly room: Party.Room) {
    this._roomCode = undefined;
    this.state = createRoomState({
      roomCode: Server.generateRoomCode(),
      protocolVersion: PROTOCOL_VERSION,
      now: Date.now(),
    });
    this.lastActiveAt = this.state.createdAt;
  }

  private get eventRuntime(): RoomEventRuntime {
    const server = this;
    return {
      get state() {
        return server.state;
      },
      set state(value: GameRoomState) {
        server.state = value;
      },
      getPlayerParticipants() {
        return server.getPlayerParticipants();
      },
      toPlayerWire(participantId: string) {
        return server.toPlayerWire(participantId);
      },
      buildSnapshot() {
        return server.buildSnapshot();
      },
      sendRaw(connection: Party.Connection, event: TransportServerEvent) {
        server.sendRaw(connection, event);
      },
      broadcast(event: TransportServerEvent) {
        server.broadcast(event);
      },
      log(level: RoomLogLevel, event: string, context?: Record<string, unknown>) {
        server.log(level, event, context);
      },
      logMetric(metric: RoomMetricName, context?: Record<string, unknown>) {
        server.logMetric(metric, context);
      },
    };
  }

  private get lifecycleRuntime(): RoomLifecycleRuntime {
    const server = this;
    return {
      get roomCode() {
        return server.roomCode;
      },
      room: server.room,
      get state() {
        return server.state;
      },
      set state(value: GameRoomState) {
        server.state = value;
      },
      get lastActiveAt() {
        return server.lastActiveAt;
      },
      set lastActiveAt(value: number) {
        server.lastActiveAt = value;
      },
      get scheduledAlarmAt() {
        return server.scheduledAlarmAt;
      },
      set scheduledAlarmAt(value: number | null) {
        server.scheduledAlarmAt = value;
      },
      get lastCheckpointReason() {
        return server.lastCheckpointReason;
      },
      set lastCheckpointReason(value: string) {
        server.lastCheckpointReason = value;
      },
      getActiveConnectionCount() {
        return server.getActiveConnectionCount();
      },
      clearConnectionState() {
        server.connectionIndex.clear();
        server.participantConnections.clear();
      },
      log(level: RoomLogLevel, event: string, context?: Record<string, unknown>) {
        server.log(level, event, context);
      },
      logMetric(metric: RoomMetricName, context?: Record<string, unknown>) {
        server.logMetric(metric, context);
      },
      runTransition(result: GameTransitionResult, options) {
        return server.runTransition(result, options);
      },
    };
  }

  private get participantRuntime(): RoomParticipantRuntime {
    const server = this;
    return {
      get roomCode() {
        return server.roomCode;
      },
      room: server.room,
      get state() {
        return server.state;
      },
      set state(value: GameRoomState) {
        server.state = value;
      },
      connectionIndex: server.connectionIndex,
      participantConnections: server.participantConnections,
      get gameContentService() {
        return server.gameContentService;
      },
      toPlayerWire(participantId: string) {
        return server.toPlayerWire(participantId);
      },
      buildSnapshot() {
        return server.buildSnapshot();
      },
      sendRaw(connection: Party.Connection, event: TransportServerEvent) {
        server.sendRaw(connection, event);
      },
      emitCurrentPhaseState(connection: Party.Connection) {
        emitCurrentPhaseStateEvent(server.eventRuntime, connection);
      },
      broadcastSnapshot() {
        broadcastSnapshotEvent(server.eventRuntime);
      },
      broadcastLobbyUpdate() {
        broadcastLobbyUpdateEvent(server.eventRuntime);
      },
      commitCheckpoint(reason: string, options?: { now?: number; markActivity?: boolean }) {
        return commitRoomCheckpoint(server.lifecycleRuntime, reason, options);
      },
      log(level: RoomLogLevel, event: string, context?: Record<string, unknown>) {
        server.log(level, event, context);
      },
      logMetric(metric: RoomMetricName, context?: Record<string, unknown>) {
        server.logMetric(metric, context);
      },
      runTransition(result: GameTransitionResult, options) {
        return server.runTransition(result, options);
      },
    };
  }

  private get roomCode() {
    if (this._roomCode) {
      return this._roomCode;
    }

    try {
      this._roomCode = normalizeRoomCode(this.room.id);
      return this._roomCode;
    } catch {
      return this.state.roomCode ?? Server.generateRoomCode();
    }
  }

  private get gameContentService() {
    return createGameContentService({
      neonDatabaseUrl: asEnvString(this.room.env.NEXT_PUBLIC_NEON_URL),
      rebusApiBaseUrl: asEnvString(this.room.env.REBUS_API_BASE_URL),
      rebusApiKey: asEnvString(this.room.env.REBUS_PACKS_API_SECRET_KEY),
      enableFallbackPack: asEnvString(this.room.env.NODE_ENV) !== 'production',
      fetch,
    });
  }

  static generateRoomCode(): string {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let value = '';
    for (let index = 0; index < 4; index += 1) {
      value += letters[Math.floor(Math.random() * letters.length)];
    }
    return value;
  }

  async onStart() {
    if (await restoreCheckpoint(this.lifecycleRuntime)) {
      return;
    }

    this.state = createRoomState({
      roomCode: this.roomCode,
      protocolVersion: PROTOCOL_VERSION,
      now: Date.now(),
    });
    this.lastActiveAt = this.state.createdAt;
    this.scheduledAlarmAt = null;
  }

  async onConnect(connection: Party.Connection<ConnectionAttachment>, ctx: Party.ConnectionContext) {
    const correlationId = crypto.randomUUID();
    try {
      this.assertInvalidSessionThrottle();
      const session = await parseSessionFromRequest(ctx.request, this.roomCode, this.room.env);
      this.resetInvalidSessionThrottle();
      await attachRoomConnection(this.participantRuntime, connection, session, correlationId);
    } catch (error) {
      this.recordInvalidSessionAttempt();
      this.log('warn', 'connection_rejected', {
        correlationId,
        commandType: 'connect',
        reason: error instanceof Error ? error.message : 'Failed to attach session',
      });
      if (error instanceof RoomRuntimeError) {
        this.sendRaw(connection, {
          type: 'error',
          code: error.code,
          message: error.message,
          retryable: error.retryable,
        });
        connection.close(4001, error.message);
        return;
      }

      const message = error instanceof z.ZodError
        ? 'Invalid participant session'
        : error instanceof Error
          ? error.message
          : 'Failed to attach session';
      this.sendRaw(connection, {
        type: 'error',
        code: 'INVALID_SESSION',
        message,
      });
      connection.close(4001, message);
    }
  }

  async onMessage(message: string | ArrayBuffer | ArrayBufferView, sender: Party.Connection<ConnectionAttachment>) {
    const correlationId = crypto.randomUUID();
    const attachment = this.connectionIndex.get(sender.id) ?? sender.state ?? null;
    const commandType = getCommandTypeCandidate(message);

    try {
      const command = parseClientCommand(message);
      this.log('info', 'command_received', {
        correlationId,
        commandType: command.type,
        participantId: attachment?.participantId,
        role: attachment?.role,
      });
      await this.applyCommand(command, sender, correlationId);
    } catch (error) {
      this.logMetric('invalid_commands', {
        correlationId,
        commandType,
        participantId: attachment?.participantId,
        role: attachment?.role,
        reason: error instanceof Error ? error.message : 'Unable to process command',
      });
      this.log('warn', 'command_rejected', {
        correlationId,
        commandType,
        participantId: attachment?.participantId,
        role: attachment?.role,
        reason: error instanceof Error ? error.message : 'Unable to process command',
      });
      if (error instanceof RoomRuntimeError) {
        this.sendError(sender, error.code, error.message, error.retryable);
        return;
      }

      const messageText = error instanceof z.ZodError
        ? 'Invalid client event payload'
        : error instanceof Error
          ? error.message
          : 'Unable to process command';
      this.sendError(sender, 'INVALID_PROTOCOL', messageText, true);
    }
  }

  async onClose(connection: Party.Connection<ConnectionAttachment>) {
    await detachRoomConnection(this.participantRuntime, connection);
  }

  async onRequest(req: Party.Request) {
    const url = new URL(req.url);

    if (url.pathname === '/health') {
      return jsonResponse({
        ok: true,
        roomCode: this.roomCode,
        state: this.state.phase,
        stateVersion: this.state.stateVersion,
      });
    }

    if (url.pathname === '/metadata') {
      return jsonResponse({
        roomCode: this.roomCode,
        state: this.state.phase,
        playerCount: this.getPlayerParticipants().length,
        hasHost: Boolean(this.state.hostParticipantId),
        closed: Boolean(this.state.closedAt),
      });
    }

    if (url.pathname === '/debug') {
      if (!this.isDebugRequestAllowed(req)) {
        return toRoomErrorBody('COMMAND_NOT_ALLOWED', 'Debug access denied', 403);
      }

      return jsonResponse({
        snapshot: this.buildSnapshot(),
        participants: this.state.participants,
        connectionIndex: Array.from(this.connectionIndex.entries()),
        participantConnections: Array.from(this.participantConnections.entries()).map(([participantId, ids]) => ({
          participantId,
          connectionIds: Array.from(ids),
        })),
        runtime: {
          lastActiveAt: this.lastActiveAt,
          inactivityDeadline: getRoomInactivityDeadline(this.state, this.lastActiveAt, this.getActiveConnectionCount()),
          scheduledAlarmAt: this.scheduledAlarmAt,
          lastCheckpointReason: this.lastCheckpointReason,
          activeConnectionCount: this.getActiveConnectionCount(),
        },
        selectedPack: this.state.selectedPack,
        hasPackDefinition: Boolean(this.state.packDefinition),
        roundView: getCurrentRoundView(this.state),
        lastRoundResult: getLastRoundResult(this.state),
      });
    }

    if (req.method === 'POST' && (url.pathname === '/_internal/bootstrap-host' || url.pathname.endsWith('/_internal/bootstrap-host'))) {
      if (!hasInternalAccess(req, this.room.env)) {
        return toRoomErrorBody('COMMAND_NOT_ALLOWED', 'Internal bootstrap only', 403);
      }

      try {
        const body = BootstrapHostRequestSchema.parse(await req.json());
        const response = await bootstrapHostSession(this.participantRuntime, body.session, body.pack, body.packId, body.gameType);
        return jsonResponse(response);
      } catch (error) {
        this.log('warn', 'bootstrap_host_failed', {
          commandType: 'bootstrap_host',
          reason: error instanceof Error ? error.message : 'Failed to bootstrap host',
        });
        return toRoomErrorResponse(error);
      }
    }

    if (req.method === 'POST' && (url.pathname === '/_internal/authorize-join' || url.pathname.endsWith('/_internal/authorize-join'))) {
      if (!hasInternalAccess(req, this.room.env)) {
        return toRoomErrorBody('COMMAND_NOT_ALLOWED', 'Internal join authorization only', 403);
      }

      try {
        const body = JoinAuthorizationRequestSchema.parse(await req.json());
        assertJoinIsAllowed(this.participantRuntime, body.session);
        this.log('info', 'join_authorized', {
          participantId: body.session.participantId,
          role: body.session.role,
          commandType: 'authorize_join',
        });
        return jsonResponse({ ok: true, snapshot: this.buildSnapshot() });
      } catch (error) {
        this.log('warn', 'join_authorization_failed', {
          participantId: req.headers.get('x-kouch-participant-id') ?? undefined,
          commandType: 'authorize_join',
          reason: error instanceof Error ? error.message : 'Join authorization failed',
        });
        return toRoomErrorResponse(error);
      }
    }

    return new Response('Not found', { status: 404 });
  }

  async onAlarm() {
    const now = Date.now();

    if (isRoomInactiveExpired(this.lifecycleRuntime, now)) {
      await expireInactiveRoom(this.lifecycleRuntime, now);
      return;
    }

    if (this.state.round.pauseRemainingMs && !this.state.round.timerEndsAt) {
      await commitRoomCheckpoint(this.lifecycleRuntime, 'alarm_noop', { now, markActivity: false });
      return;
    }

    if (hasExpiredTimer(this.state, now)) {
      try {
        await this.runTransition(advanceRound(this.state, {
          now,
          roundDurationMs: DEFAULT_ROUND_DURATION_MS,
          roundResultDurationMs: DEFAULT_ROUND_RESULT_DURATION_MS,
        }), {
          reason: 'round_advanced',
          commandType: 'alarm',
          markActivity: false,
          source: 'alarm',
        });
      } catch (error) {
        this.log('error', 'alarm_transition_failed', {
          reason: error instanceof Error ? error.message : String(error),
        });
        try {
          await commitRoomCheckpoint(this.lifecycleRuntime, 'alarm_failed', { now, markActivity: false });
        } catch (checkpointError) {
          this.log('error', 'alarm_reschedule_failed', {
            reason: checkpointError instanceof Error ? checkpointError.message : String(checkpointError),
          });
        }
      }

      return;
    }

    await commitRoomCheckpoint(this.lifecycleRuntime, 'alarm_rescheduled', { now, markActivity: false });
  }

  private getPlayerParticipants() {
    return this.state.participants.filter((participant) => participant.role === 'player');
  }

  private assertInvalidSessionThrottle(now = Date.now()) {
    if (now < this.invalidSessionBlockedUntil) {
      throw new RoomRuntimeError('INVALID_SESSION', 'Too many invalid session attempts. Try again shortly.', 429, true);
    }
  }

  private resetInvalidSessionThrottle() {
    this.invalidSessionWindowStartedAt = 0;
    this.invalidSessionAttempts = 0;
    this.invalidSessionBlockedUntil = 0;
  }

  private recordInvalidSessionAttempt(now = Date.now()) {
    if (this.invalidSessionWindowStartedAt === 0 || now - this.invalidSessionWindowStartedAt > INVALID_SESSION_WINDOW_MS) {
      this.invalidSessionWindowStartedAt = now;
      this.invalidSessionAttempts = 0;
    }

    this.invalidSessionAttempts += 1;
    if (this.invalidSessionAttempts >= INVALID_SESSION_LIMIT) {
      this.invalidSessionBlockedUntil = now + INVALID_SESSION_BLOCK_MS;
      this.invalidSessionWindowStartedAt = now;
      this.invalidSessionAttempts = 0;
    }
  }

  private getParticipant(participantId: string) {
    return findParticipant(this.state, participantId);
  }

  private isParticipantConnected(participantId: string): boolean {
    return (this.participantConnections.get(participantId)?.size ?? 0) > 0;
  }

  private toPlayerWire(participantId: string): PlayerWire {
    const participant = this.getParticipant(participantId);
    if (!participant) {
      throw new RoomRuntimeError('INTERNAL_ERROR', `Participant ${participantId} not found`, 500, true);
    }

    return {
      id: participant.participantId,
      name: participant.displayName,
      score: participant.score,
      avatar: participant.avatar,
      connected: this.isParticipantConnected(participant.participantId),
    };
  }

  private buildSnapshot(): RoomSnapshot {
    return RoomSnapshotSchema.parse({
      roomCode: this.state.roomCode,
      state: this.state.phase,
      players: this.getPlayerParticipants().map((participant) => this.toPlayerWire(participant.participantId)),
      hostId: this.state.hostParticipantId,
      roundIndex: this.state.round.roundIndex,
      currentPartIndex: this.state.round.currentPartIndex,
      totalParts: this.state.round.totalParts,
      timerEndsAt: this.state.round.timerEndsAt,
      totalQuestionDuration: this.state.round.totalQuestionDuration,
      pauseRemainingMs: this.state.round.pauseRemainingMs,
      closeReason: this.state.closeReason,
      closedAt: this.state.closedAt ?? null,
      stateVersion: this.state.stateVersion,
      protocolVersion: PROTOCOL_VERSION,
    });
  }

  private sendRaw(connection: Party.Connection, event: TransportServerEvent) {
    connection.send(JSON.stringify(event));
  }

  private log(level: RoomLogLevel, event: string, context: Record<string, unknown> = {}) {
    const payload = {
      ts: new Date().toISOString(),
      level,
      source: 'kouch-realtime-room',
      event,
      roomCode: this.roomCode,
      roomState: this.state.phase,
      stateVersion: this.state.stateVersion,
      ...context,
    };

    const message = JSON.stringify(payload);
    if (level === 'error') {
      console.error(message);
      return;
    }

    if (level === 'warn') {
      console.warn(message);
      return;
    }

    console.info(message);
  }

  private logMetric(metric: RoomMetricName, context: Record<string, unknown> = {}) {
    this.log('info', 'metric', {
      metric,
      count: 1,
      ...context,
    });
  }

  private getActiveConnectionCount() {
    return Array.from(this.room.getConnections()).length;
  }

  private sendError(connection: Party.Connection, code: RoomErrorCode, message: string, retryable = false) {
    this.sendRaw(connection, {
      type: 'error',
      code,
      message,
      retryable,
    });
  }

  private broadcast(event: TransportServerEvent) {
    const serialized = JSON.stringify(event);
    for (const connection of this.room.getConnections()) {
      connection.send(serialized);
    }
  }

  private assertRoomCode(commandRoomCode: string | undefined) {
    if (commandRoomCode && normalizeRoomCode(commandRoomCode) !== this.state.roomCode) {
      throw new RoomRuntimeError('INVALID_SESSION', 'Command room code does not match active room', 400);
    }
  }

  private assertHost(attachment: ConnectionAttachment) {
    if (attachment.role !== 'host' || attachment.participantId !== this.state.hostParticipantId) {
      throw new RoomRuntimeError('COMMAND_NOT_ALLOWED', 'Only the host can perform this action', 403);
    }
  }

  private assertPlayer(attachment: ConnectionAttachment, playerId: string) {
    if (attachment.role !== 'player' || attachment.participantId !== playerId) {
      throw new RoomRuntimeError('COMMAND_NOT_ALLOWED', 'Only the owning player can perform this action', 403);
    }
  }

  private async applyCommand(command: TransportClientEvent, sender: Party.Connection<ConnectionAttachment>, correlationId: string) {
    const attachment = requireRoomAttachment(this.participantRuntime, sender);
    const now = Date.now();
    const commandContext = {
      correlationId,
      commandType: command.type,
      participantId: attachment.participantId,
      role: attachment.role,
    };

    switch (command.type) {
      case 'ping': {
        this.sendRaw(sender, { type: 'pong' });
        return;
      }
      case 'start_game': {
        this.assertRoomCode(command.roomCode);
        this.assertHost(attachment);
        if (command.playerId !== attachment.participantId) {
          throw new RoomRuntimeError('INVALID_SESSION', 'Host identity mismatch', 400);
        }
        await this.runTransition(startGame(this.state, {
          now,
          roundDurationMs: DEFAULT_ROUND_DURATION_MS,
        }), {
          ...commandContext,
          reason: 'game_started',
        });
        return;
      }
      case 'pause_game': {
        this.assertHost(attachment);
        await this.runTransition(pauseGame(this.state, { now }), {
          ...commandContext,
          reason: 'game_paused',
        });
        return;
      }
      case 'resume_game': {
        this.assertHost(attachment);
        await this.runTransition(resumeGame(this.state, { now }), {
          ...commandContext,
          reason: 'game_resumed',
        });
        return;
      }
      case 'extend_timer': {
        this.assertRoomCode(command.roomCode);
        this.assertHost(attachment);
        await this.runTransition(extendTimer(this.state, {
          now,
          extensionMs: DEFAULT_TIMER_EXTENSION_MS,
        }), {
          ...commandContext,
          reason: 'timer_extended',
        });
        return;
      }
      case 'skip_timer': {
        this.assertRoomCode(command.roomCode);
        this.assertHost(attachment);
        await this.runTransition(skipTimer(this.state, {
          now,
          roundDurationMs: DEFAULT_ROUND_DURATION_MS,
          roundResultDurationMs: DEFAULT_ROUND_RESULT_DURATION_MS,
        }), {
          ...commandContext,
          reason: 'round_advanced',
        });
        return;
      }
      case 'reset_game': {
        this.assertRoomCode(command.roomCode);
        this.assertHost(attachment);
        await this.runTransition(resetGame(this.state, { now }), {
          ...commandContext,
          reason: 'game_reset',
        });
        return;
      }
      case 'close_room': {
        this.assertRoomCode(command.roomCode);
        this.assertHost(attachment);
        await this.runTransition(closeRoomTransition(this.state, {
          now,
          reason: 'The host closed the room.',
        }), {
          ...commandContext,
          reason: 'room_closed',
        });
        for (const connection of this.room.getConnections()) {
          connection.close(1000, 'The host closed the room.');
        }
        return;
      }
      case 'submit_answer': {
        this.assertRoomCode(command.roomCode);
        this.assertPlayer(attachment, command.playerId);
        const result = submitAnswer(this.state, {
          participantId: command.playerId,
          answer: command.answer,
          now,
          roundDurationMs: DEFAULT_ROUND_DURATION_MS,
          roundResultDurationMs: DEFAULT_ROUND_RESULT_DURATION_MS,
        });
        await this.runTransition(result, {
          ...commandContext,
          reason: 'answer_accepted',
        });
        if (result.ok && this.state.round.roundIndex != null) {
          this.sendRaw(sender, {
            type: 'answer_received',
            roundIndex: this.state.round.roundIndex,
          });
        }
        return;
      }
      case 'use_hint': {
        this.assertRoomCode(command.roomCode);
        this.assertPlayer(attachment, command.playerId);
        await this.runTransition(useHint(this.state, {
          participantId: command.playerId,
          now,
        }), {
          ...commandContext,
          reason: 'hint_used',
        });
        return;
      }
      case 'mock': {
        this.broadcast({ type: 'mock_added', roomCode: this.state.roomCode });
        return;
      }
      case 'join':
      case 'fetch_room_for_game': {
        this.sendError(sender, 'COMMAND_NOT_ALLOWED', `Use the HTTP bootstrap flow for ${command.type}`, false);
        return;
      }
      default: {
        const unsupportedCommand: never = command;
        this.sendError(sender, 'COMMAND_NOT_ALLOWED', 'Unhandled PartyKit command', false);
        return unsupportedCommand;
      }
    }
  }

  private async runTransition(
    result: GameTransitionResult,
    options?: {
      reason?: string;
      commandType?: string;
      participantId?: string;
      role?: ParticipantRole;
      correlationId?: string;
      markActivity?: boolean;
      source?: string;
    },
  ) {
    if (!result.ok) {
      const error = result.error ?? {
        code: 'INVALID_PHASE' as const,
        message: 'Unknown game engine transition error',
      };
      this.log('warn', 'transition_rejected', {
        correlationId: options?.correlationId,
        commandType: options?.commandType,
        participantId: options?.participantId,
        role: options?.role,
        reason: error.message,
        source: options?.source,
      });
      throw new RoomRuntimeError(mapEngineError(error.code), error.message, 409);
    }

    this.state = result.state;
    await commitRoomCheckpoint(this.lifecycleRuntime, options?.reason ?? 'state_transition', {
      now: this.state.updatedAt,
      markActivity: options?.markActivity,
    });
    broadcastSnapshotEvent(this.eventRuntime);

    for (const event of result.events) {
      emitDomainEventToClients(this.eventRuntime, event, options);
    }
  }

  private isDebugRequestAllowed(req: Party.Request): boolean {
    const envValue = asEnvString(this.room.env.NODE_ENV);
    if (envValue !== 'production') {
      return true;
    }

    const configuredToken = asEnvString(this.room.env.PARTYKIT_DEBUG_TOKEN);
    return Boolean(configuredToken && req.headers.get(DEBUG_TOKEN_HEADER) === configuredToken);
  }
}

Server satisfies Party.Worker;
