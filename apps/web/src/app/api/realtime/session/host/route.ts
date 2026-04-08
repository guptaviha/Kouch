import { z } from 'zod';
import { NextResponse } from 'next/server';
import { RoomSnapshotSchema, SignedParticipantSessionSchema } from '@kouch/contracts';

import { assertPartyKitRealtimeEnabled } from '@/lib/realtime/provider';
import {
  buildRealtimeWebSocketUrl,
  callRealtimeBootstrap,
  getRealtimeServerBaseUrl,
  getRequestPublicHost,
} from '@/lib/realtime/session-bootstrap';

const HostSessionRequestSchema = z.object({
  participantId: z.string().min(1).optional(),
  displayName: z.string().trim().min(1).max(64).optional(),
  avatar: z.string().trim().min(1).max(128).optional(),
  pack: z.string().trim().min(1).optional(),
});

const RealtimeHostBootstrapResponseSchema = z.object({
  roomCode: z.string().trim().length(4),
  session: SignedParticipantSessionSchema,
  sessionToken: z.string().min(1),
  snapshot: RoomSnapshotSchema,
});

export async function POST(request: Request) {
  try {
    assertPartyKitRealtimeEnabled();
    const body = HostSessionRequestSchema.parse(await request.json());
    const realtimeResponse = RealtimeHostBootstrapResponseSchema.parse(
      await callRealtimeBootstrap('/api/rooms', {
        participantId: body.participantId,
        displayName: body.displayName,
        avatar: body.avatar,
        pack: body.pack,
      }),
    );

    return NextResponse.json({
      ok: true,
      roomCode: realtimeResponse.roomCode,
      session: realtimeResponse.session,
      sessionToken: realtimeResponse.sessionToken,
      websocketUrl: buildRealtimeWebSocketUrl(
        getRealtimeServerBaseUrl(),
        realtimeResponse.roomCode,
        realtimeResponse.sessionToken,
        getRequestPublicHost(request),
      ),
      snapshot: realtimeResponse.snapshot,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create realtime host session';
    return NextResponse.json({ error: { message } }, { status: 400 });
  }
}
