import {
  getSqlClient,
  queryRows,
  type SqlClient,
  withTransaction,
} from '@/lib/neon';
import type {
  CreateGameCatalogGamePayload,
  CreateGameCatalogTagPayload,
  GameCatalogDetail,
  GameCatalogEquipmentTag,
  GameCatalogFacetOption,
  GameCatalogFilterMetadata,
  GameCatalogFilters,
  GameCatalogGameRecord,
  GameCatalogListItem,
  GameCatalogListResponse,
  GameCatalogTag,
  UpdateGameCatalogGamePayload,
} from '@/types/game-catalog';

const sql = getSqlClient();
const DEFAULT_PUBLIC_LIMIT = 24;
const DEFAULT_ADMIN_LIMIT = 50;
const MAX_LIMIT = 100;

type TaxonomyKind = 'tag' | 'equipment';

interface ValidatedGameCatalogInput {
  slug: string;
  name: string;
  short_description: string;
  rules_markdown: string;
  min_players: number;
  max_players: number;
  ideal_players_min: number | null;
  ideal_players_max: number | null;
  min_play_time_minutes: number;
  max_play_time_minutes: number;
  ease_of_learning: number;
  requires_equipment: boolean;
  created_by: string;
  tag_names: string[];
  equipment_names: string[];
}

interface GameCatalogRecordRow extends Omit<GameCatalogGameRecord, 'tags' | 'equipment_tags'> {
  tags: GameCatalogTag[] | null;
  equipment_tags: GameCatalogEquipmentTag[] | null;
}

interface GameCatalogListRow extends Omit<GameCatalogListItem, 'tags' | 'equipment_tags'> {
  tags: Array<Pick<GameCatalogTag, 'id' | 'name'>> | null;
  equipment_tags: Array<Pick<GameCatalogEquipmentTag, 'id' | 'name'>> | null;
  total_count: number | string;
}

interface FacetCountRow {
  name: string;
  count: number | string;
}

interface BoundsRow {
  min_players: number | null;
  max_players: number | null;
  min_play_time_minutes: number | null;
  max_play_time_minutes: number | null;
}

interface EaseRow {
  ease_of_learning: number;
}

interface AdminListOptions {
  search?: string | null;
  tag?: string | null;
  limit?: number;
}

interface TaxonomyListOptions {
  q?: string | null;
  limit?: number;
}

export class GameCatalogInputError extends Error {}

function sanitizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function sanitizeOptionalString(value: unknown): string | null {
  const trimmed = sanitizeString(value);
  return trimmed.length > 0 ? trimmed : null;
}

function sanitizeInteger(value: unknown): number | null {
  const normalized = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(normalized)) {
    return null;
  }

  return normalized;
}

function sanitizePositiveInteger(value: unknown): number | null {
  const normalized = sanitizeInteger(value);
  if (normalized === null || normalized < 1) {
    return null;
  }

  return normalized;
}

function sanitizeBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes'].includes(normalized)) {
    return true;
  }

  if (['false', '0', 'no'].includes(normalized)) {
    return false;
  }

  return null;
}

function sanitizeLimit(limit: number | null | undefined, fallback: number): number {
  if (!Number.isFinite(limit)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(limit ?? fallback), 1), MAX_LIMIT);
}

function sanitizeOffset(offset: number | null | undefined): number {
  if (!Number.isFinite(offset)) {
    return 0;
  }

  return Math.max(Math.trunc(offset ?? 0), 0);
}

function readFirstSearchParam(searchParams: URLSearchParams, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = searchParams.get(key);
    if (value !== null) {
      return value;
    }
  }

  return null;
}

function readIntegerSearchParam(searchParams: URLSearchParams, ...keys: string[]): number | null {
  const rawValue = readFirstSearchParam(searchParams, ...keys);
  if (rawValue === null) {
    return null;
  }

  return sanitizePositiveInteger(rawValue);
}

function readBooleanSearchParam(searchParams: URLSearchParams, ...keys: string[]): boolean | null {
  const rawValue = readFirstSearchParam(searchParams, ...keys);
  if (rawValue === null) {
    return null;
  }

  return sanitizeBoolean(rawValue);
}

function readListSearchParam(searchParams: URLSearchParams, keys: string[]): string[] {
  const values = keys.flatMap((key) => searchParams.getAll(key));
  return normalizeGameCatalogNames(
    values.flatMap((value) => value.split(',')),
  );
}

function readIntegerListSearchParam(searchParams: URLSearchParams, keys: string[]): number[] {
  const values = keys.flatMap((key) => searchParams.getAll(key));
  const parsed = values.flatMap((value) => value.split(','))
    .map((value) => sanitizeInteger(value))
    .filter((value): value is number => value !== null && value >= 1 && value <= 5);

  return Array.from(new Set(parsed));
}

export function createGameCatalogSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export function normalizeGameCatalogNames(values: string[] | undefined): string[] {
  return Array.from(new Set(
    (values ?? [])
      .map((value) => sanitizeString(value).toLowerCase())
      .filter((value) => value.length > 0),
  ));
}

export function parseGameCatalogFilters(searchParams: URLSearchParams): GameCatalogFilters {
  return {
    search: sanitizeOptionalString(readFirstSearchParam(searchParams, 'search', 'q')),
    player_count: readIntegerSearchParam(searchParams, 'playerCount', 'player_count', 'players'),
    min_players: readIntegerSearchParam(searchParams, 'minPlayers', 'min_players'),
    max_players: readIntegerSearchParam(searchParams, 'maxPlayers', 'max_players'),
    ideal_players: readIntegerSearchParam(searchParams, 'idealPlayers', 'ideal_players'),
    min_play_time_minutes: readIntegerSearchParam(searchParams, 'timeMin', 'time_min', 'min_play_time_minutes'),
    max_play_time_minutes: readIntegerSearchParam(searchParams, 'timeMax', 'time_max', 'max_play_time_minutes'),
    ease_of_learning: readIntegerListSearchParam(searchParams, ['easeOfLearning', 'ease_of_learning']),
    tags: readListSearchParam(searchParams, ['tags', 'tag']),
    requires_equipment: readBooleanSearchParam(searchParams, 'requiresEquipment', 'requires_equipment'),
    equipment: readListSearchParam(searchParams, ['equipment', 'equipment_tags']),
    limit: sanitizeLimit(readIntegerSearchParam(searchParams, 'limit'), DEFAULT_PUBLIC_LIMIT),
    offset: sanitizeOffset(readIntegerSearchParam(searchParams, 'offset')),
  };
}

function mapGameCatalogRecord(row: GameCatalogRecordRow): GameCatalogGameRecord {
  return {
    ...row,
    tags: row.tags ?? [],
    equipment_tags: row.equipment_tags ?? [],
  };
}

function mapGameCatalogListItem(row: GameCatalogListRow): GameCatalogListItem {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    short_description: row.short_description,
    min_players: row.min_players,
    max_players: row.max_players,
    ideal_players_min: row.ideal_players_min,
    ideal_players_max: row.ideal_players_max,
    min_play_time_minutes: row.min_play_time_minutes,
    max_play_time_minutes: row.max_play_time_minutes,
    ease_of_learning: row.ease_of_learning,
    requires_equipment: row.requires_equipment,
    tags: row.tags ?? [],
    equipment_tags: row.equipment_tags ?? [],
  };
}

function getTaxonomyTable(kind: TaxonomyKind): 'game_catalog_tags' | 'game_catalog_equipment_tags' {
  return kind === 'tag' ? 'game_catalog_tags' : 'game_catalog_equipment_tags';
}

function assertValidGameCatalogInput(input: ValidatedGameCatalogInput) {
  if (!input.name) {
    throw new GameCatalogInputError('Game name is required');
  }

  if (!input.slug) {
    throw new GameCatalogInputError('Game slug is required');
  }

  if (!input.short_description) {
    throw new GameCatalogInputError('short_description is required');
  }

  if (!input.rules_markdown) {
    throw new GameCatalogInputError('rules_markdown is required');
  }

  if (input.min_players < 1) {
    throw new GameCatalogInputError('min_players must be at least 1');
  }

  if (input.max_players < input.min_players) {
    throw new GameCatalogInputError('max_players must be greater than or equal to min_players');
  }

  if (input.ideal_players_min !== null) {
    if (input.ideal_players_min < input.min_players || input.ideal_players_min > input.max_players) {
      throw new GameCatalogInputError('ideal_players_min must stay within the supported player range');
    }
  }

  if (input.ideal_players_max !== null) {
    if (input.ideal_players_max < input.min_players || input.ideal_players_max > input.max_players) {
      throw new GameCatalogInputError('ideal_players_max must stay within the supported player range');
    }
  }

  if (
    input.ideal_players_min !== null
    && input.ideal_players_max !== null
    && input.ideal_players_max < input.ideal_players_min
  ) {
    throw new GameCatalogInputError('ideal_players_max must be greater than or equal to ideal_players_min');
  }

  if (input.min_play_time_minutes < 1) {
    throw new GameCatalogInputError('min_play_time_minutes must be at least 1');
  }

  if (input.max_play_time_minutes < input.min_play_time_minutes) {
    throw new GameCatalogInputError('max_play_time_minutes must be greater than or equal to min_play_time_minutes');
  }

  if (input.ease_of_learning < 1 || input.ease_of_learning > 5) {
    throw new GameCatalogInputError('ease_of_learning must be between 1 and 5');
  }
}

function buildValidatedGameCatalogInput(
  payload: CreateGameCatalogGamePayload | UpdateGameCatalogGamePayload,
  existing?: GameCatalogGameRecord,
): ValidatedGameCatalogInput {
  const name = payload.name !== undefined ? sanitizeString(payload.name) : existing?.name ?? '';
  const slugSource = payload.slug !== undefined
    ? sanitizeString(payload.slug)
    : existing?.slug ?? name;
  const slug = createGameCatalogSlug(slugSource || name);
  const shortDescription = payload.short_description !== undefined
    ? sanitizeString(payload.short_description)
    : existing?.short_description ?? '';
  const rulesMarkdown = payload.rules_markdown !== undefined
    ? sanitizeString(payload.rules_markdown)
    : existing?.rules_markdown ?? '';

  const minPlayers = payload.min_players !== undefined
    ? sanitizePositiveInteger(payload.min_players)
    : existing?.min_players ?? null;
  const maxPlayers = payload.max_players !== undefined
    ? sanitizePositiveInteger(payload.max_players)
    : existing?.max_players ?? null;
  const idealPlayersMin = payload.ideal_players_min !== undefined
    ? (payload.ideal_players_min === null ? null : sanitizePositiveInteger(payload.ideal_players_min))
    : existing?.ideal_players_min ?? null;
  const idealPlayersMax = payload.ideal_players_max !== undefined
    ? (payload.ideal_players_max === null ? null : sanitizePositiveInteger(payload.ideal_players_max))
    : existing?.ideal_players_max ?? null;
  const minPlayTime = payload.min_play_time_minutes !== undefined
    ? sanitizePositiveInteger(payload.min_play_time_minutes)
    : existing?.min_play_time_minutes ?? null;
  const maxPlayTime = payload.max_play_time_minutes !== undefined
    ? sanitizePositiveInteger(payload.max_play_time_minutes)
    : existing?.max_play_time_minutes ?? null;
  const easeOfLearning = payload.ease_of_learning !== undefined
    ? sanitizeInteger(payload.ease_of_learning)
    : existing?.ease_of_learning ?? null;
  const requiresEquipment = payload.requires_equipment !== undefined
    ? Boolean(payload.requires_equipment)
    : existing?.requires_equipment ?? false;
  const createdBy = payload.created_by !== undefined
    ? sanitizeString(payload.created_by)
    : existing?.created_by ?? 'admin';
  const tagNames = payload.tag_names !== undefined
    ? normalizeGameCatalogNames(payload.tag_names)
    : existing?.tags.map((tag) => tag.name) ?? [];
  const equipmentNames = payload.equipment_names !== undefined
    ? normalizeGameCatalogNames(payload.equipment_names)
    : existing?.equipment_tags.map((tag) => tag.name) ?? [];

  if (minPlayers === null) {
    throw new GameCatalogInputError('min_players is required');
  }

  if (maxPlayers === null) {
    throw new GameCatalogInputError('max_players is required');
  }

  if (minPlayTime === null) {
    throw new GameCatalogInputError('min_play_time_minutes is required');
  }

  if (maxPlayTime === null) {
    throw new GameCatalogInputError('max_play_time_minutes is required');
  }

  if (easeOfLearning === null) {
    throw new GameCatalogInputError('ease_of_learning is required');
  }

  const input: ValidatedGameCatalogInput = {
    slug,
    name,
    short_description: shortDescription,
    rules_markdown: rulesMarkdown,
    min_players: minPlayers,
    max_players: maxPlayers,
    ideal_players_min: idealPlayersMin,
    ideal_players_max: idealPlayersMax,
    min_play_time_minutes: minPlayTime,
    max_play_time_minutes: maxPlayTime,
    ease_of_learning: easeOfLearning,
    requires_equipment: requiresEquipment,
    created_by: createdBy || 'admin',
    tag_names: tagNames,
    equipment_names: requiresEquipment ? equipmentNames : [],
  };

  assertValidGameCatalogInput(input);
  return input;
}

async function fetchGameCatalogRecordById(executor: SqlClient, id: number): Promise<GameCatalogGameRecord | null> {
  const rows = (await executor`
    SELECT
      g.id,
      g.slug,
      g.name,
      g.short_description,
      g.rules_markdown,
      g.min_players,
      g.max_players,
      g.ideal_players_min,
      g.ideal_players_max,
      g.min_play_time_minutes,
      g.max_play_time_minutes,
      g.ease_of_learning,
      g.requires_equipment,
      g.created_by,
      g.created_at,
      g.updated_at,
      COALESCE(tag_data.tags, '[]'::json) AS tags,
      COALESCE(equipment_data.equipment_tags, '[]'::json) AS equipment_tags
    FROM game_catalog_games g
    LEFT JOIN LATERAL (
      SELECT json_agg(
        json_build_object(
          'id', t.id,
          'name', t.name,
          'description', t.description,
          'created_by', t.created_by,
          'created_at', t.created_at,
          'updated_at', t.updated_at
        )
        ORDER BY t.name
      ) AS tags
      FROM game_catalog_game_tags gt
      INNER JOIN game_catalog_tags t ON t.id = gt.tag_id
      WHERE gt.game_id = g.id
    ) AS tag_data ON TRUE
    LEFT JOIN LATERAL (
      SELECT json_agg(
        json_build_object(
          'id', et.id,
          'name', et.name,
          'description', et.description,
          'created_by', et.created_by,
          'created_at', et.created_at,
          'updated_at', et.updated_at
        )
        ORDER BY et.name
      ) AS equipment_tags
      FROM game_catalog_game_equipment ge
      INNER JOIN game_catalog_equipment_tags et ON et.id = ge.equipment_tag_id
      WHERE ge.game_id = g.id
    ) AS equipment_data ON TRUE
    WHERE g.id = ${id};
  `) as unknown as GameCatalogRecordRow[];

  return rows[0] ? mapGameCatalogRecord(rows[0]) : null;
}

async function fetchGameCatalogRecordBySlug(executor: SqlClient, slug: string): Promise<GameCatalogDetail | null> {
  const rows = (await executor`
    SELECT
      g.id,
      g.slug,
      g.name,
      g.short_description,
      g.rules_markdown,
      g.min_players,
      g.max_players,
      g.ideal_players_min,
      g.ideal_players_max,
      g.min_play_time_minutes,
      g.max_play_time_minutes,
      g.ease_of_learning,
      g.requires_equipment,
      g.created_by,
      g.created_at,
      g.updated_at,
      COALESCE(tag_data.tags, '[]'::json) AS tags,
      COALESCE(equipment_data.equipment_tags, '[]'::json) AS equipment_tags
    FROM game_catalog_games g
    LEFT JOIN LATERAL (
      SELECT json_agg(
        json_build_object(
          'id', t.id,
          'name', t.name,
          'description', t.description,
          'created_by', t.created_by,
          'created_at', t.created_at,
          'updated_at', t.updated_at
        )
        ORDER BY t.name
      ) AS tags
      FROM game_catalog_game_tags gt
      INNER JOIN game_catalog_tags t ON t.id = gt.tag_id
      WHERE gt.game_id = g.id
    ) AS tag_data ON TRUE
    LEFT JOIN LATERAL (
      SELECT json_agg(
        json_build_object(
          'id', et.id,
          'name', et.name,
          'description', et.description,
          'created_by', et.created_by,
          'created_at', et.created_at,
          'updated_at', et.updated_at
        )
        ORDER BY et.name
      ) AS equipment_tags
      FROM game_catalog_game_equipment ge
      INNER JOIN game_catalog_equipment_tags et ON et.id = ge.equipment_tag_id
      WHERE ge.game_id = g.id
    ) AS equipment_data ON TRUE
    WHERE g.slug = ${slug};
  `) as unknown as GameCatalogRecordRow[];

  return rows[0] ? mapGameCatalogRecord(rows[0]) : null;
}

async function replaceTaxonomyLinks(
  tx: SqlClient,
  gameId: number,
  kind: TaxonomyKind,
  names: string[],
  createdBy: string,
): Promise<void> {
  if (kind === 'tag') {
    await tx`DELETE FROM game_catalog_game_tags WHERE game_id = ${gameId};`;

    for (const name of names) {
      const [tag] = (await tx`
        INSERT INTO game_catalog_tags (name, created_by)
        VALUES (${name}, ${createdBy})
        ON CONFLICT (name) DO UPDATE SET updated_at = now()
        RETURNING id;
      `) as unknown as Array<{ id: number }>;

      await tx`
        INSERT INTO game_catalog_game_tags (game_id, tag_id, created_by)
        VALUES (${gameId}, ${tag.id}, ${createdBy})
        ON CONFLICT (game_id, tag_id) DO NOTHING;
      `;
    }

    return;
  }

  await tx`DELETE FROM game_catalog_game_equipment WHERE game_id = ${gameId};`;

  for (const name of names) {
    const [equipmentTag] = (await tx`
      INSERT INTO game_catalog_equipment_tags (name, created_by)
      VALUES (${name}, ${createdBy})
      ON CONFLICT (name) DO UPDATE SET updated_at = now()
      RETURNING id;
    `) as unknown as Array<{ id: number }>;

    await tx`
      INSERT INTO game_catalog_game_equipment (game_id, equipment_tag_id, created_by)
      VALUES (${gameId}, ${equipmentTag.id}, ${createdBy})
      ON CONFLICT (game_id, equipment_tag_id) DO NOTHING;
    `;
  }
}

async function listTaxonomy<T extends GameCatalogTag | GameCatalogEquipmentTag>(
  kind: TaxonomyKind,
  options: TaxonomyListOptions,
): Promise<T[]> {
  const table = getTaxonomyTable(kind);
  const values: unknown[] = [];
  const whereClauses: string[] = [];

  if (options.q) {
    values.push(`%${sanitizeString(options.q)}%`);
    whereClauses.push(`name ILIKE $${values.length}`);
  }

  const limit = sanitizeLimit(options.limit ?? null, 25);
  values.push(limit);

  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  return queryRows<T>(`
    SELECT id, name, description, created_by, created_at, updated_at
    FROM ${table}
    ${whereClause}
    ORDER BY updated_at DESC, name ASC
    LIMIT $${values.length};
  `, values);
}

async function upsertTaxonomy<T extends GameCatalogTag | GameCatalogEquipmentTag>(
  kind: TaxonomyKind,
  payload: CreateGameCatalogTagPayload,
): Promise<T> {
  const table = getTaxonomyTable(kind);
  const name = sanitizeString(payload.name).toLowerCase();
  const description = sanitizeOptionalString(payload.description);
  const createdBy = sanitizeString(payload.created_by) || 'admin';

  if (!name) {
    throw new GameCatalogInputError('Tag name is required');
  }

  const rows = await queryRows<T>(`
    INSERT INTO ${table} (name, description, created_by)
    VALUES ($1, $2, $3)
    ON CONFLICT (name) DO UPDATE
    SET description = EXCLUDED.description,
        updated_at = now()
    RETURNING id, name, description, created_by, created_at, updated_at;
  `, [name, description, createdBy]);

  return rows[0] as T;
}

function buildPublicListQuery(filters: GameCatalogFilters): { text: string; values: unknown[] } {
  const values: unknown[] = [];
  const whereClauses: string[] = [];
  const pushValue = (value: unknown) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (filters.search) {
    const placeholder = pushValue(`%${filters.search}%`);
    whereClauses.push(`(
      g.name ILIKE ${placeholder}
      OR g.short_description ILIKE ${placeholder}
      OR g.rules_markdown ILIKE ${placeholder}
    )`);
  }

  if (filters.player_count !== null) {
    const placeholder = pushValue(filters.player_count);
    whereClauses.push(`g.min_players <= ${placeholder} AND g.max_players >= ${placeholder}`);
  }

  if (filters.min_players !== null) {
    const placeholder = pushValue(filters.min_players);
    whereClauses.push(`g.max_players >= ${placeholder}`);
  }

  if (filters.max_players !== null) {
    const placeholder = pushValue(filters.max_players);
    whereClauses.push(`g.min_players <= ${placeholder}`);
  }

  if (filters.ideal_players !== null) {
    const placeholder = pushValue(filters.ideal_players);
    whereClauses.push(`
      COALESCE(g.ideal_players_min, g.min_players) <= ${placeholder}
      AND COALESCE(g.ideal_players_max, g.max_players) >= ${placeholder}
    `);
  }

  if (filters.min_play_time_minutes !== null) {
    const placeholder = pushValue(filters.min_play_time_minutes);
    whereClauses.push(`g.max_play_time_minutes >= ${placeholder}`);
  }

  if (filters.max_play_time_minutes !== null) {
    const placeholder = pushValue(filters.max_play_time_minutes);
    whereClauses.push(`g.min_play_time_minutes <= ${placeholder}`);
  }

  if (filters.ease_of_learning.length > 0) {
    const placeholder = pushValue(filters.ease_of_learning);
    whereClauses.push(`g.ease_of_learning = ANY(${placeholder}::int[])`);
  }

  if (filters.requires_equipment !== null) {
    const placeholder = pushValue(filters.requires_equipment);
    whereClauses.push(`g.requires_equipment = ${placeholder}`);
  }

  if (filters.tags.length > 0) {
    const placeholder = pushValue(filters.tags);
    whereClauses.push(`EXISTS (
      SELECT 1
      FROM game_catalog_game_tags gt
      INNER JOIN game_catalog_tags t ON t.id = gt.tag_id
      WHERE gt.game_id = g.id
        AND t.name = ANY(${placeholder}::text[])
    )`);
  }

  if (filters.equipment.length > 0) {
    const placeholder = pushValue(filters.equipment);
    whereClauses.push(`EXISTS (
      SELECT 1
      FROM game_catalog_game_equipment ge
      INNER JOIN game_catalog_equipment_tags et ON et.id = ge.equipment_tag_id
      WHERE ge.game_id = g.id
        AND et.name = ANY(${placeholder}::text[])
    )`);
  }

  const limitPlaceholder = pushValue(filters.limit);
  const offsetPlaceholder = pushValue(filters.offset);
  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  return {
    text: `
      SELECT
        g.id,
        g.slug,
        g.name,
        g.short_description,
        g.min_players,
        g.max_players,
        g.ideal_players_min,
        g.ideal_players_max,
        g.min_play_time_minutes,
        g.max_play_time_minutes,
        g.ease_of_learning,
        g.requires_equipment,
        COALESCE(tag_data.tags, '[]'::json) AS tags,
        COALESCE(equipment_data.equipment_tags, '[]'::json) AS equipment_tags,
        COUNT(*) OVER() AS total_count
      FROM game_catalog_games g
      LEFT JOIN LATERAL (
        SELECT json_agg(
          json_build_object('id', t.id, 'name', t.name)
          ORDER BY t.name
        ) AS tags
        FROM game_catalog_game_tags gt
        INNER JOIN game_catalog_tags t ON t.id = gt.tag_id
        WHERE gt.game_id = g.id
      ) AS tag_data ON TRUE
      LEFT JOIN LATERAL (
        SELECT json_agg(
          json_build_object('id', et.id, 'name', et.name)
          ORDER BY et.name
        ) AS equipment_tags
        FROM game_catalog_game_equipment ge
        INNER JOIN game_catalog_equipment_tags et ON et.id = ge.equipment_tag_id
        WHERE ge.game_id = g.id
      ) AS equipment_data ON TRUE
      ${whereClause}
      ORDER BY g.updated_at DESC, g.name ASC
      LIMIT ${limitPlaceholder}
      OFFSET ${offsetPlaceholder};
    `,
    values,
  };
}

async function getFilterMetadata(): Promise<GameCatalogFilterMetadata> {
  const [tagRows, equipmentRows, boundsRows, easeRows] = await Promise.all([
    queryRows<FacetCountRow>(`
      SELECT t.name, COUNT(DISTINCT gt.game_id) AS count
      FROM game_catalog_tags t
      INNER JOIN game_catalog_game_tags gt ON gt.tag_id = t.id
      GROUP BY t.name
      ORDER BY t.name ASC;
    `),
    queryRows<FacetCountRow>(`
      SELECT et.name, COUNT(DISTINCT ge.game_id) AS count
      FROM game_catalog_equipment_tags et
      INNER JOIN game_catalog_game_equipment ge ON ge.equipment_tag_id = et.id
      GROUP BY et.name
      ORDER BY et.name ASC;
    `),
    queryRows<BoundsRow>(`
      SELECT
        MIN(min_players) AS min_players,
        MAX(max_players) AS max_players,
        MIN(min_play_time_minutes) AS min_play_time_minutes,
        MAX(max_play_time_minutes) AS max_play_time_minutes
      FROM game_catalog_games;
    `),
    queryRows<EaseRow>(`
      SELECT DISTINCT ease_of_learning
      FROM game_catalog_games
      ORDER BY ease_of_learning ASC;
    `),
  ]);

  const bounds = boundsRows[0] ?? {
    min_players: null,
    max_players: null,
    min_play_time_minutes: null,
    max_play_time_minutes: null,
  };

  return {
    tags: tagRows.map((row): GameCatalogFacetOption => ({
      name: row.name,
      count: Number(row.count),
    })),
    equipment_tags: equipmentRows.map((row): GameCatalogFacetOption => ({
      name: row.name,
      count: Number(row.count),
    })),
    ease_of_learning_options: easeRows.map((row) => row.ease_of_learning),
    player_count_bounds: {
      min_players: bounds.min_players,
      max_players: bounds.max_players,
    },
    play_time_bounds: {
      min_play_time_minutes: bounds.min_play_time_minutes,
      max_play_time_minutes: bounds.max_play_time_minutes,
    },
  };
}

export class GameCatalogService {
  static async listAdminGames(options: AdminListOptions = {}): Promise<GameCatalogGameRecord[]> {
    const values: unknown[] = [];
    const whereClauses: string[] = [];

    if (options.search) {
      values.push(`%${sanitizeString(options.search)}%`);
      const placeholder = `$${values.length}`;
      whereClauses.push(`(
        g.name ILIKE ${placeholder}
        OR g.short_description ILIKE ${placeholder}
        OR g.rules_markdown ILIKE ${placeholder}
      )`);
    }

    if (options.tag) {
      values.push(sanitizeString(options.tag).toLowerCase());
      whereClauses.push(`EXISTS (
        SELECT 1
        FROM game_catalog_game_tags gt
        INNER JOIN game_catalog_tags t ON t.id = gt.tag_id
        WHERE gt.game_id = g.id
          AND t.name = $${values.length}
      )`);
    }

    const limit = sanitizeLimit(options.limit ?? null, DEFAULT_ADMIN_LIMIT);
    values.push(limit);
    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const rows = await queryRows<GameCatalogRecordRow>(`
      SELECT
        g.id,
        g.slug,
        g.name,
        g.short_description,
        g.rules_markdown,
        g.min_players,
        g.max_players,
        g.ideal_players_min,
        g.ideal_players_max,
        g.min_play_time_minutes,
        g.max_play_time_minutes,
        g.ease_of_learning,
        g.requires_equipment,
        g.created_by,
        g.created_at,
        g.updated_at,
        COALESCE(tag_data.tags, '[]'::json) AS tags,
        COALESCE(equipment_data.equipment_tags, '[]'::json) AS equipment_tags
      FROM game_catalog_games g
      LEFT JOIN LATERAL (
        SELECT json_agg(
          json_build_object(
            'id', t.id,
            'name', t.name,
            'description', t.description,
            'created_by', t.created_by,
            'created_at', t.created_at,
            'updated_at', t.updated_at
          )
          ORDER BY t.name
        ) AS tags
        FROM game_catalog_game_tags gt
        INNER JOIN game_catalog_tags t ON t.id = gt.tag_id
        WHERE gt.game_id = g.id
      ) AS tag_data ON TRUE
      LEFT JOIN LATERAL (
        SELECT json_agg(
          json_build_object(
            'id', et.id,
            'name', et.name,
            'description', et.description,
            'created_by', et.created_by,
            'created_at', et.created_at,
            'updated_at', et.updated_at
          )
          ORDER BY et.name
        ) AS equipment_tags
        FROM game_catalog_game_equipment ge
        INNER JOIN game_catalog_equipment_tags et ON et.id = ge.equipment_tag_id
        WHERE ge.game_id = g.id
      ) AS equipment_data ON TRUE
      ${whereClause}
      ORDER BY g.updated_at DESC, g.name ASC
      LIMIT $${values.length};
    `, values);

    return rows.map(mapGameCatalogRecord);
  }

  static async getAdminGameById(id: number): Promise<GameCatalogGameRecord | null> {
    return fetchGameCatalogRecordById(sql, id);
  }

  static async createGame(payload: CreateGameCatalogGamePayload): Promise<GameCatalogGameRecord> {
    const input = buildValidatedGameCatalogInput(payload);

    return withTransaction(async (tx) => {
      const [created] = (await tx`
        INSERT INTO game_catalog_games (
          slug,
          name,
          short_description,
          rules_markdown,
          min_players,
          max_players,
          ideal_players_min,
          ideal_players_max,
          min_play_time_minutes,
          max_play_time_minutes,
          ease_of_learning,
          requires_equipment,
          created_by
        ) VALUES (
          ${input.slug},
          ${input.name},
          ${input.short_description},
          ${input.rules_markdown},
          ${input.min_players},
          ${input.max_players},
          ${input.ideal_players_min},
          ${input.ideal_players_max},
          ${input.min_play_time_minutes},
          ${input.max_play_time_minutes},
          ${input.ease_of_learning},
          ${input.requires_equipment},
          ${input.created_by}
        )
        RETURNING id;
      `) as unknown as Array<{ id: number }>;

      await replaceTaxonomyLinks(tx, created.id, 'tag', input.tag_names, input.created_by);
      await replaceTaxonomyLinks(tx, created.id, 'equipment', input.equipment_names, input.created_by);

      const game = await fetchGameCatalogRecordById(tx, created.id);
      if (!game) {
        throw new Error('Created game could not be reloaded');
      }

      return game;
    });
  }

  static async updateGame(id: number, payload: UpdateGameCatalogGamePayload): Promise<GameCatalogGameRecord | null> {
    const existing = await fetchGameCatalogRecordById(sql, id);
    if (!existing) {
      return null;
    }

    const input = buildValidatedGameCatalogInput(payload, existing);

    return withTransaction(async (tx) => {
      const [updated] = (await tx`
        UPDATE game_catalog_games
        SET
          slug = ${input.slug},
          name = ${input.name},
          short_description = ${input.short_description},
          rules_markdown = ${input.rules_markdown},
          min_players = ${input.min_players},
          max_players = ${input.max_players},
          ideal_players_min = ${input.ideal_players_min},
          ideal_players_max = ${input.ideal_players_max},
          min_play_time_minutes = ${input.min_play_time_minutes},
          max_play_time_minutes = ${input.max_play_time_minutes},
          ease_of_learning = ${input.ease_of_learning},
          requires_equipment = ${input.requires_equipment},
          created_by = ${input.created_by},
          updated_at = now()
        WHERE id = ${id}
        RETURNING id;
      `) as unknown as Array<{ id: number }>;

      if (!updated) {
        return null;
      }

      await replaceTaxonomyLinks(tx, id, 'tag', input.tag_names, input.created_by);
      await replaceTaxonomyLinks(tx, id, 'equipment', input.equipment_names, input.created_by);

      return fetchGameCatalogRecordById(tx, id);
    });
  }

  static async listTags(options: TaxonomyListOptions = {}): Promise<GameCatalogTag[]> {
    return listTaxonomy<GameCatalogTag>('tag', options);
  }

  static async upsertTag(payload: CreateGameCatalogTagPayload): Promise<GameCatalogTag> {
    return upsertTaxonomy<GameCatalogTag>('tag', payload);
  }

  static async listEquipmentTags(options: TaxonomyListOptions = {}): Promise<GameCatalogEquipmentTag[]> {
    return listTaxonomy<GameCatalogEquipmentTag>('equipment', options);
  }

  static async upsertEquipmentTag(payload: CreateGameCatalogTagPayload): Promise<GameCatalogEquipmentTag> {
    return upsertTaxonomy<GameCatalogEquipmentTag>('equipment', payload);
  }

  static async listPublicGames(filters: GameCatalogFilters): Promise<GameCatalogListResponse> {
    const query = buildPublicListQuery(filters);
    const [rows, filterMetadata] = await Promise.all([
      queryRows<GameCatalogListRow>(query.text, query.values),
      getFilterMetadata(),
    ]);

    return {
      games: rows.map(mapGameCatalogListItem),
      total_count: rows.length > 0 ? Number(rows[0].total_count) : 0,
      filters: filterMetadata,
      applied_filters: filters,
    };
  }

  static async getPublicGameBySlug(slug: string): Promise<GameCatalogDetail | null> {
    const normalizedSlug = createGameCatalogSlug(slug);
    if (!normalizedSlug) {
      return null;
    }

    return fetchGameCatalogRecordBySlug(sql, normalizedSlug);
  }
}