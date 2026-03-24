import { z } from 'zod';
import { NextResponse } from 'next/server';
import { RoomSnapshotSchema } from '@kouch/contracts';

import { assertPartyKitRealtimeEnabled } from '@/lib/realtime/provider';
import {
  buildRealtimeWebSocketUrl,
  callRealtimeBootstrap,
  createSignedRealtimeSession,
  getRealtimeServerBaseUrl,
  normalizeRoomCode,
} from '@/lib/realtime/session-bootstrap';

const JoinSessionRequestSchema = z.object({
  roomCode: z.string().trim().length(4),
  participantId: z.string().min(1).optional(),
  displayName: z.string().trim().min(1).max(64).optional(),
  avatar: z.string().trim().min(1).max(128).optional(),
});

const RealtimeJoinBootstrapResponseSchema = z.object({
  roomCode: z.string().trim().length(4),
  snapshot: RoomSnapshotSchema,
});

export async function POST(request: Request) {
  try {
    assertPartyKitRealtimeEnabled();
    const body = JoinSessionRequestSchema.parse(await request.json());
    const roomCode = normalizeRoomCode(body.roomCode);
    const realtimeResponse = RealtimeJoinBootstrapResponseSchema.parse(
      await callRealtimeBootstrap(`/api/rooms/${roomCode}/join`, {
        participantId: body.participantId,
        displayName: body.displayName,
        avatar: body.avatar,
      }),
    );

    const { session, sessionToken } = await createSignedRealtimeSession({
      role: 'player',
      roomCode: realtimeResponse.roomCode,
      participantId: body.participantId,
      displayName: body.displayName,
      avatar: body.avatar,
    });

    return NextResponse.json({
      ok: true,
      roomCode: realtimeResponse.roomCode,
      session,
      sessionToken,
      websocketUrl: buildRealtimeWebSocketUrl(getRealtimeServerBaseUrl(), realtimeResponse.roomCode, sessionToken),
      snapshot: realtimeResponse.snapshot,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create realtime player session';
    return NextResponse.json({ error: { message } }, { status: 400 });
  }
}
