import type * as Party from 'partykit/server';
import { z } from 'zod';
import {
  GameTypeSchema,
  PROTOCOL_VERSION,
  createSignedParticipantSession,
  type RoomErrorCode,
} from '@kouch/contracts';
import {
  PARTY_NAME,
  ROOM_CREATE_ATTEMPTS,
  INTERNAL_HEADER,
  INTERNAL_TOKEN_HEADER,
  buildPartyWebSocketUrl,
  getJoinRoomCode,
  getSessionSecret,
  hasInternalAccess,
  isCreateRoomPath,
  jsonResponse,
  normalizeLobbyPath,
  toRoomErrorBody,
} from './runtime-shared.js';

const CreateRoomRequestSchema = z.object({
  participantId: z.string().min(1).optional(),
  displayName: z.string().min(1).optional(),
  avatar: z.string().min(1).optional(),
  protocolVersion: z.literal(PROTOCOL_VERSION).optional(),
  pack: z.string().min(1).optional(),
  packId: z.number().int().positive().optional(),
  gameType: GameTypeSchema.optional(),
});

const JoinRoomRequestSchema = z.object({
  participantId: z.string().min(1).optional(),
  displayName: z.string().min(1).optional(),
  avatar: z.string().min(1).optional(),
  protocolVersion: z.literal(PROTOCOL_VERSION).optional(),
});

export async function handleLobbyFetch(
  req: Party.Request,
  lobby: Party.FetchLobby,
): Promise<Response | undefined> {
  const url = new URL(req.url);
  const pathname = normalizeLobbyPath(url.pathname);

  if (pathname === '/healthz') {
    return jsonResponse({ ok: true, service: 'realtime', protocolVersion: PROTOCOL_VERSION });
  }

  if (isCreateRoomPath(pathname) && req.method === 'POST') {
    if (!hasInternalAccess(req, lobby.env)) {
      return toRoomErrorBody('COMMAND_NOT_ALLOWED', 'Web bootstrap access required', 403);
    }

    const body = CreateRoomRequestSchema.parse(await req.json());
    const sessionSecret = getSessionSecret(lobby.env);

    for (let attempt = 0; attempt < ROOM_CREATE_ATTEMPTS; attempt += 1) {
      const roomCode = ServerRoomCode.generate();
      const { session, sessionToken } = await createSignedParticipantSession({
        roomCode,
        role: 'host',
        participantId: body.participantId,
        displayName: body.displayName,
        avatar: body.avatar,
        protocolVersion: body.protocolVersion,
        secret: sessionSecret,
      });
      const stub = lobby.parties[PARTY_NAME].get(roomCode);
      const response = await stub.fetch('/_internal/bootstrap-host', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [INTERNAL_HEADER]: '1',
          [INTERNAL_TOKEN_HEADER]: sessionSecret,
        },
        body: JSON.stringify({
          session,
          pack: body.pack,
          packId: body.packId,
          gameType: body.gameType,
        }),
      });

      if (response.ok) {
        const payload = await response.json();
        return jsonResponse({
          ok: true,
          roomCode,
          session,
          sessionToken,
          websocketPath: `/parties/${PARTY_NAME}/${roomCode}`,
          websocketUrl: buildPartyWebSocketUrl(req, roomCode, sessionToken),
          snapshot: payload.snapshot,
        });
      }

      const errorBody = await response.clone().json().catch(() => null);
      const errorCode = errorBody?.error?.code as RoomErrorCode | undefined;
      if (errorCode === 'HOST_ALREADY_ASSIGNED') {
        continue;
      }

      return response;
    }

    return toRoomErrorBody('INTERNAL_ERROR', 'Unable to allocate a room code', 503, true);
  }

  const joinRoomCode = getJoinRoomCode(pathname);
  if (joinRoomCode && req.method === 'POST') {
    if (!hasInternalAccess(req, lobby.env)) {
      return toRoomErrorBody('COMMAND_NOT_ALLOWED', 'Web bootstrap access required', 403);
    }

    const body = JoinRoomRequestSchema.parse(await req.json());
    const sessionSecret = getSessionSecret(lobby.env);
    const { session, sessionToken } = await createSignedParticipantSession({
      roomCode: joinRoomCode,
      role: 'player',
      participantId: body.participantId,
      displayName: body.displayName,
      avatar: body.avatar,
      protocolVersion: body.protocolVersion,
      secret: sessionSecret,
    });
    const stub = lobby.parties[PARTY_NAME].get(joinRoomCode);
    const response = await stub.fetch('/_internal/authorize-join', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [INTERNAL_HEADER]: '1',
        [INTERNAL_TOKEN_HEADER]: sessionSecret,
      },
      body: JSON.stringify({ session }),
    });

    if (!response.ok) {
      return response;
    }

    const payload = await response.json();
    return jsonResponse({
      ok: true,
      roomCode: joinRoomCode,
      session,
      sessionToken,
      websocketPath: `/parties/${PARTY_NAME}/${joinRoomCode}`,
      websocketUrl: buildPartyWebSocketUrl(req, joinRoomCode, sessionToken),
      snapshot: payload.snapshot,
    });
  }

  return undefined;
}

const ServerRoomCode = {
  generate(): string {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let value = '';
    for (let index = 0; index < 4; index += 1) {
      value += letters[Math.floor(Math.random() * letters.length)];
    }
    return value;
  },
};