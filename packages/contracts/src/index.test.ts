import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PROTOCOL_VERSION,
  createSignedParticipantSession,
  createProtocolEnvelope,
  parseClientEvent,
  parseTransportClientEvent,
  parseServerEvent,
  signParticipantSessionToken,
  verifyParticipantSessionToken,
} from './index.js';

test('signed participant session tokens round-trip correctly', async () => {
  const session = {
    participantId: 'player-1',
    role: 'player' as const,
    roomCode: 'ABCD',
    displayName: 'Ada',
    protocolVersion: PROTOCOL_VERSION,
    nonce: 'nonce-1',
    issuedAt: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60,
  };

  const token = await signParticipantSessionToken(session, 'test-secret');
  const verified = await verifyParticipantSessionToken(token, 'test-secret');

  assert.deepEqual(verified, session);
});

test('parseClientEvent accepts JSON payloads and preserves discriminated unions', () => {
  const event = parseClientEvent(JSON.stringify({
    type: 'submit_answer',
    roomCode: 'abcd',
    playerId: 'player-1',
    answer: 'Paris',
  }));

  if (event.type !== 'submit_answer') {
    throw new Error(`Expected submit_answer event, received ${event.type}`);
  }

  assert.equal(event.roomCode, 'ABCD');
  assert.equal(event.answer, 'Paris');
});

test('parseServerEvent accepts plain objects and createProtocolEnvelope wraps events', () => {
  const event = parseServerEvent({
    type: 'room_snapshot',
    snapshot: {
      roomCode: 'ABCD',
      state: 'lobby',
      players: [],
      stateVersion: 2,
      protocolVersion: PROTOCOL_VERSION,
    },
  });

  assert.equal(event.type, 'room_snapshot');
  const envelope = createProtocolEnvelope(event);
  assert.deepEqual(envelope, {
    protocolVersion: PROTOCOL_VERSION,
    event,
  });
});

test('transport parsing keeps legacy compatibility out of the current PartyKit command parser', () => {
  const legacyEvent = {
    type: 'join',
    roomCode: 'abcd',
    name: 'Ada',
  };

  const parsedTransportEvent = parseTransportClientEvent(legacyEvent);
  if (parsedTransportEvent.type !== 'join') {
    throw new Error(`Expected join event, received ${parsedTransportEvent.type}`);
  }

  assert.equal(parsedTransportEvent.roomCode, 'ABCD');

  assert.throws(() => parseClientEvent(legacyEvent));
});

test('createSignedParticipantSession normalizes room codes and returns a signed token', async () => {
  const { session, sessionToken } = await createSignedParticipantSession({
    roomCode: 'abcd',
    role: 'player',
    displayName: 'Ada',
    secret: 'test-secret',
  });
  const verifiedSession = await verifyParticipantSessionToken(sessionToken, 'test-secret');

  assert.equal(session.roomCode, 'ABCD');
  assert.ok(sessionToken.length > 0);
  assert.equal(verifiedSession.roomCode, session.roomCode);
  assert.equal(verifiedSession.role, session.role);
  assert.equal(verifiedSession.displayName, session.displayName);
  assert.equal(verifiedSession.participantId, session.participantId);
  assert.equal(verifiedSession.protocolVersion, session.protocolVersion);
});
