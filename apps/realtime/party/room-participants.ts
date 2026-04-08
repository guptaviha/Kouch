import type * as Party from 'partykit/server';
import type {
  GameParticipant,
  GameRoomState,
  GameTransitionResult,
} from '@kouch/game-engine';
import { configureRoom, upsertParticipant } from '@kouch/game-engine';
import {
  GameContentError,
  type RoomPackDefinition,
} from '@kouch/game-content';
import type {
  GameType,
  ParticipantRole,
  ParticipantSession,
  PlayerWire,
  RoomSnapshot,
  ServerEvent,
} from '@kouch/contracts';

import {
  RoomRuntimeError,
  getPackIdentifier,
  normalizeRoomCode,
  type ConnectionAttachment,
  type RoomLogLevel,
  type RoomMetricName,
} from './runtime-shared.js';

type TransitionOptions = {
  reason?: string;
  commandType?: string;
  participantId?: string;
  role?: ParticipantRole;
  correlationId?: string;
  markActivity?: boolean;
  source?: string;
};

export type RoomParticipantRuntime = {
  roomCode: string;
  room: Party.Room;
  state: GameRoomState;
  connectionIndex: Map<string, ConnectionAttachment>;
  participantConnections: Map<string, Set<string>>;
  gameContentService: {
    getRoomPackDefinition(id: number, gameType?: GameType): Promise<RoomPackDefinition>;
  };
  toPlayerWire(participantId: string): PlayerWire;
  buildSnapshot(): RoomSnapshot;
  sendRaw(connection: Party.Connection, event: ServerEvent): void;
  emitCurrentPhaseState(connection: Party.Connection): void;
  broadcastSnapshot(): Promise<void> | void;
  broadcastLobbyUpdate(): void;
  commitCheckpoint(reason: string, options?: { now?: number; markActivity?: boolean }): Promise<void>;
  log(level: RoomLogLevel, event: string, context?: Record<string, unknown>): void;
  logMetric(metric: RoomMetricName, context?: Record<string, unknown>): void;
  runTransition(result: GameTransitionResult, options?: TransitionOptions): Promise<void>;
};

export function assertSession(runtime: RoomParticipantRuntime, session: ParticipantSession) {
  if (session.protocolVersion !== runtime.state.protocolVersion) {
    throw new RoomRuntimeError('INVALID_PROTOCOL', 'Unsupported protocol version', 400);
  }

  if (normalizeRoomCode(session.roomCode ?? runtime.roomCode) !== runtime.roomCode) {
    throw new RoomRuntimeError('INVALID_SESSION', 'Session room code does not match party room', 400);
  }

  if (runtime.state.closedAt) {
    throw new RoomRuntimeError('ROOM_CLOSED', 'Room is closed', 410);
  }
}

export function assertJoinAllowed(runtime: RoomParticipantRuntime, session: ParticipantSession) {
  assertSession(runtime, session);

  const existingParticipant = runtime.state.participants.find(
    (participant) => participant.participantId === session.participantId,
  );
  if (session.role === 'host') {
    if (runtime.state.hostParticipantId && runtime.state.hostParticipantId !== session.participantId) {
      throw new RoomRuntimeError('HOST_ALREADY_ASSIGNED', 'Host already assigned for this room', 409);
    }
    return;
  }

  if (!runtime.state.hostParticipantId) {
    throw new RoomRuntimeError('ROOM_NOT_FOUND', 'Room not found', 404);
  }

  if (!existingParticipant && runtime.state.phase !== 'lobby') {
    throw new RoomRuntimeError('COMMAND_NOT_ALLOWED', 'Room is already in progress', 409);
  }
}

export async function bootstrapHost(
  runtime: RoomParticipantRuntime,
  session: ParticipantSession,
  pack?: string,
  packId?: number,
  gameType?: GameType,
) {
  assertSession(runtime, session);
  const now = Date.now();
  let packDefinition: RoomPackDefinition | undefined = runtime.state.packDefinition;
  const { selectedPack, resolvedPackId } = getPackIdentifier(pack, packId);
  const isNewRoom = !runtime.state.hostParticipantId;

  if (selectedPack) {
    try {
      packDefinition = resolvedPackId != null
        ? await runtime.gameContentService.getRoomPackDefinition(resolvedPackId, gameType)
        : runtime.state.packDefinition;
    } catch (error) {
      runtime.logMetric('upstream_content_fetch_failures', {
        commandType: 'bootstrap_host',
        participantId: session.participantId,
        role: session.role,
        reason: error instanceof Error ? error.message : 'Unable to load pack definition',
      });
      const message = error instanceof GameContentError ? error.message : 'Unable to load pack definition';
      throw new RoomRuntimeError('PACK_LOAD_FAILED', message, 422);
    }
  }

  await runtime.runTransition(upsertParticipant(runtime.state, {
    participantId: session.participantId,
    role: 'host',
    displayName: session.displayName ?? 'Host',
    avatar: session.avatar,
    now,
  }), {
    reason: isNewRoom ? 'room_created' : 'host_reconnected',
    commandType: 'bootstrap_host',
    participantId: session.participantId,
    role: session.role,
  });

  await runtime.runTransition(configureRoom(runtime.state, {
    hostParticipantId: session.participantId,
    selectedPack: selectedPack ?? runtime.state.selectedPack,
    packDefinition,
    now,
  }), {
    reason: 'room_configured',
    commandType: 'bootstrap_host',
    participantId: session.participantId,
    role: session.role,
  });

  if (isNewRoom) {
    runtime.logMetric('room_creates', {
      commandType: 'bootstrap_host',
      participantId: session.participantId,
      role: session.role,
    });
  }

  runtime.log('info', 'host_bootstrapped', {
    commandType: 'bootstrap_host',
    participantId: session.participantId,
    role: session.role,
    reason: isNewRoom ? 'room_created' : 'room_reused',
  });

  return {
    ok: true,
    roomCode: runtime.state.roomCode,
    snapshot: runtime.buildSnapshot(),
  };
}

export async function attachConnection(
  runtime: RoomParticipantRuntime,
  connection: Party.Connection<ConnectionAttachment>,
  session: ParticipantSession,
  correlationId: string,
) {
  assertJoinAllowed(runtime, session);
  const now = Date.now();
  const existingParticipant = runtime.state.participants.find(
    (participant) => participant.participantId === session.participantId,
  );
  const hadActiveConnection = (runtime.participantConnections.get(session.participantId)?.size ?? 0) > 0;
  const isReconnect = Boolean(existingParticipant) && !hadActiveConnection;

  await runtime.runTransition(upsertParticipant(runtime.state, {
    participantId: session.participantId,
    role: session.role,
    displayName: session.displayName ?? (session.role === 'host' ? 'Host' : 'Player'),
    avatar: session.avatar,
    now,
  }), {
    reason: isReconnect ? 'participant_reconnected' : 'participant_connected',
    commandType: 'connect',
    participantId: session.participantId,
    role: session.role,
    correlationId,
  });

  const attachment: ConnectionAttachment = {
    participantId: session.participantId,
    role: session.role,
  };
  connection.setState(attachment);
  runtime.connectionIndex.set(connection.id, attachment);

  const participantConnectionIds = runtime.participantConnections.get(session.participantId) ?? new Set<string>();
  participantConnectionIds.add(connection.id);
  runtime.participantConnections.set(session.participantId, participantConnectionIds);

  runtime.sendRaw(connection, {
    type: 'room_snapshot',
    snapshot: runtime.buildSnapshot(),
  });
  runtime.emitCurrentPhaseState(connection);

  if (isReconnect) {
    runtime.logMetric('reconnects', {
      correlationId,
      commandType: 'connect',
      participantId: session.participantId,
      role: session.role,
    });
  } else if (session.role === 'player') {
    runtime.logMetric('joins', {
      correlationId,
      commandType: 'connect',
      participantId: session.participantId,
      role: session.role,
    });
  }

  runtime.log('info', 'participant_connected', {
    correlationId,
    commandType: 'connect',
    participantId: session.participantId,
    role: session.role,
    reason: isReconnect ? 'reconnected' : existingParticipant ? 'additional_connection' : 'joined',
  });

  await Promise.resolve(runtime.broadcastSnapshot());
  runtime.broadcastLobbyUpdate();
}

export async function detachConnection(
  runtime: RoomParticipantRuntime,
  connection: Party.Connection<ConnectionAttachment>,
) {
  const attachment = runtime.connectionIndex.get(connection.id) ?? connection.state ?? null;
  if (!attachment) {
    return;
  }

  const now = Date.now();
  runtime.connectionIndex.delete(connection.id);
  const participantConnectionIds = runtime.participantConnections.get(attachment.participantId);
  let participantDisconnected = false;
  if (participantConnectionIds) {
    participantConnectionIds.delete(connection.id);
    if (participantConnectionIds.size === 0) {
      runtime.participantConnections.delete(attachment.participantId);
      participantDisconnected = true;
    }
  }

  if (participantDisconnected || runtime.participantConnections.size === 0) {
    await runtime.commitCheckpoint(participantDisconnected ? 'participant_disconnected' : 'room_became_idle', {
      now,
      markActivity: true,
    });
    runtime.log('info', 'participant_disconnected', {
      participantId: attachment.participantId,
      role: attachment.role,
      reason: runtime.participantConnections.size === 0 ? 'room_idle' : 'participant_offline',
    });
  }

  await Promise.resolve(runtime.broadcastSnapshot());
  runtime.broadcastLobbyUpdate();
}

export function requireAttachment(
  runtime: Pick<RoomParticipantRuntime, 'connectionIndex'>,
  connection: Party.Connection<ConnectionAttachment>,
): ConnectionAttachment {
  return runtime.connectionIndex.get(connection.id) ?? connection.state ?? (() => {
    throw new RoomRuntimeError('INVALID_SESSION', 'Missing participant attachment', 400);
  })();
}

export function getParticipant(
  state: GameRoomState,
  participantId: string,
): GameParticipant | undefined {
  return state.participants.find((participant) => participant.participantId === participantId);
}