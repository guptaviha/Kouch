import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertPartyKitRealtimeEnabled,
  getRealtimeProvider,
  isPartyKitRealtimeEnabled,
} from './provider';

test('realtime provider defaults to partykit', () => {
  assert.equal(getRealtimeProvider(undefined), 'partykit');
  assert.equal(isPartyKitRealtimeEnabled(undefined), true);
});

test('realtime provider accepts explicit socketio cutover flag', () => {
  assert.equal(getRealtimeProvider('socketio'), 'socketio');
  assert.equal(isPartyKitRealtimeEnabled('socketio'), false);
  assert.throws(() => assertPartyKitRealtimeEnabled('socketio'));
});
