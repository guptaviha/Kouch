import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createGameCatalogSlug,
  normalizeGameCatalogNames,
} from '@/lib/game-catalog';
import { parseGameCatalogFilters } from '@/services/game-catalog-service';

test('createGameCatalogSlug normalizes a readable slug', () => {
  assert.equal(createGameCatalogSlug('  Mafia: The Party Game  '), 'mafia-the-party-game');
  assert.equal(createGameCatalogSlug("What's Up?"), 'whats-up');
});

test('normalizeGameCatalogNames trims, lowers, and deduplicates taxonomy values', () => {
  assert.deepEqual(
    normalizeGameCatalogNames([' Party ', 'strategy', 'PARTY', '', ' Cards ']),
    ['party', 'strategy', 'cards'],
  );
});

test('parseGameCatalogFilters supports camelCase and comma-separated filter aliases', () => {
  const filters = parseGameCatalogFilters(new URLSearchParams(
    'q=Mafia&minPlayers=6&timeMax=45&easeOfLearning=2,3&tags=party,team&equipment=cards&requiresEquipment=true&limit=12&offset=24',
  ));

  assert.equal(filters.search, 'Mafia');
  assert.equal(filters.min_players, 6);
  assert.equal(filters.max_play_time_minutes, 45);
  assert.equal(filters.requires_equipment, true);
  assert.equal(filters.limit, 12);
  assert.equal(filters.offset, 24);
  assert.deepEqual(filters.ease_of_learning, [2, 3]);
  assert.deepEqual(filters.tags, ['party', 'team']);
  assert.deepEqual(filters.equipment, ['cards']);
});