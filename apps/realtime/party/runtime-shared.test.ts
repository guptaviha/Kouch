import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getJoinRoomCode,
  isCreateRoomPath,
  normalizeLobbyPath,
} from './runtime-shared.js';

test('normalizeLobbyPath removes the PartyKit room prefix', () => {
  assert.equal(normalizeLobbyPath('/parties/main/api/rooms'), '/api/rooms');
  assert.equal(normalizeLobbyPath('/parties/main'), '/');
  assert.equal(normalizeLobbyPath('/healthz'), '/healthz');
});

test('isCreateRoomPath accepts legacy and prefixed bootstrap routes', () => {
  assert.equal(isCreateRoomPath('/api/rooms'), true);
  assert.equal(isCreateRoomPath('/rooms'), true);
  assert.equal(isCreateRoomPath('/parties/main/api/bootstrap/host'), true);
  assert.equal(isCreateRoomPath('/parties/main/bootstrap/host/'), true);
  assert.equal(isCreateRoomPath('/api/rooms/ABCD/join'), false);
});

test('getJoinRoomCode extracts and normalizes both join route shapes', () => {
  assert.equal(getJoinRoomCode('/api/rooms/abcz/join'), 'ABCZ');
  assert.equal(getJoinRoomCode('/parties/main/bootstrap/join/wxyz'), 'WXYZ');
  assert.equal(getJoinRoomCode('/api/rooms'), null);
});