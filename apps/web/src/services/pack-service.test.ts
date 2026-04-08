import assert from 'node:assert/strict';
import test from 'node:test';

import { createGameContentService } from '@kouch/game-content';

test('game content falls back to a demo pack when local sources are empty', async () => {
  const service = createGameContentService({
    enableFallbackPack: true,
    rebusApiKey: 'test-key',
    fetch: async () => new Response(JSON.stringify([]), {
      status: 200,
      headers: {
        'content-type': 'application/json',
      },
    }),
  });

  const packs = await service.getAllPacks();
  assert.equal(packs.length, 1);
  assert.equal(packs[0]?.id, 900001);
  assert.equal(packs[0]?.name, 'Demo Party Pack');

  const pack = await service.getPackById(900001);
  assert.equal(pack?.gameType, 'trivia');

  const questions = await service.getQuestionsForPack(900001);
  assert.equal(questions.length, 3);
  assert.equal(questions[1]?.questionType, 'multi_part');
});