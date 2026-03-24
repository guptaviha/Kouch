import { neon } from '@neondatabase/serverless';

export type GameType = 'trivia' | 'rebus';
export type QuestionType = 'multiple_choice' | 'open_ended' | 'multi_part';

export interface TriviaMultiPart {
  prompt: string;
  correct_answers: string[];
  image_url: string | null;
}

export interface BaseGamePack {
  id: number;
  name: string;
  description: string | null;
  image_url: string;
  gameType: GameType;
  created_at: string;
  updated_at: string;
}

export interface TriviaPack extends BaseGamePack {
  gameType: 'trivia';
  user_id: string;
  question_ids?: number[];
}

export interface RebusPack extends BaseGamePack {
  gameType: 'rebus';
}

export type GamePackDetail = TriviaPack | RebusPack;

export interface TriviaGameQuestion {
  question: string;
  answers: string[];
  image?: string | null;
  hint?: string;
  questionType: QuestionType;
  prompts?: string[];
  promptImages?: Array<string | null> | null;
}

export interface GamePackSummary {
  id: number;
  name: string;
  description: string | null;
  imageUrl: string;
  gameType: GameType;
  updatedAt: string;
}

export interface PlayableQuestion {
  question: string;
  answers: string[];
  image?: string | null;
  hint?: string;
  questionType: QuestionType;
  prompts?: string[];
  promptImages?: Array<string | null> | null;
}

export interface RoomPackDefinition {
  id: number;
  name: string;
  description: string | null;
  imageUrl: string;
  gameType: GameType;
  questions: PlayableQuestion[];
}

export type GameContentErrorCode =
  | 'CONFIG_ERROR'
  | 'PACK_NOT_FOUND'
  | 'UPSTREAM_ERROR'
  | 'INVALID_UPSTREAM_PAYLOAD';

export class GameContentError extends Error {
  readonly code: GameContentErrorCode;
  readonly cause?: unknown;

  constructor(code: GameContentErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'GameContentError';
    this.code = code;
    this.cause = cause;
  }
}

export interface GameContentConfig {
  neonDatabaseUrl?: string;
  rebusApiBaseUrl?: string;
  rebusApiKey?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

interface TriviaPackRow {
  id: number;
  name: string;
  description: string | null;
  image_url: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  question_ids: number[];
}

interface TriviaQuestionRow {
  question: string;
  answers: string[] | null;
  image: string | null;
  clues: string[] | null;
  question_type: QuestionType;
  prompts: string[] | null;
  prompt_images: Array<string | null> | null;
}

const DEFAULT_REBUS_API_BASE_URL = 'https://rebus.games/api/admin';
const DEFAULT_TIMEOUT_MS = 8_000;

function withTimeoutSignal(timeoutMs: number): AbortSignal | undefined {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs);
  }

  return undefined;
}

function toGamePackSummary(pack: GamePackDetail): GamePackSummary {
  return {
    id: pack.id,
    name: pack.name,
    description: pack.description,
    imageUrl: pack.image_url,
    gameType: pack.gameType,
    updatedAt: pack.updated_at,
  };
}

function normalizeTriviaPack(row: TriviaPackRow): TriviaPack {
  return {
    ...row,
    gameType: 'trivia',
  };
}

function normalizeRebusPack(rawPack: Record<string, unknown>): RebusPack {
  return {
    id: Number(rawPack.id),
    name: String(rawPack.name ?? ''),
    description: rawPack.description == null ? null : String(rawPack.description),
    image_url: String(rawPack.image_url ?? rawPack.image ?? ''),
    gameType: 'rebus',
    created_at: String(rawPack.created_at ?? new Date(0).toISOString()),
    updated_at: String(rawPack.updated_at ?? new Date(0).toISOString()),
  };
}

function normalizeTriviaQuestion(row: TriviaQuestionRow): TriviaGameQuestion {
  return {
    question: row.question,
    answers: row.answers ?? [],
    image: row.image,
    hint: row.clues?.[0],
    questionType: row.question_type ?? 'open_ended',
    prompts: row.prompts ?? undefined,
    promptImages: row.prompt_images ?? undefined,
  };
}

function normalizeRebusQuestion(rawQuestion: Record<string, unknown>): TriviaGameQuestion {
  const answers = Array.isArray(rawQuestion.answers)
    ? rawQuestion.answers.map((answer) => String(answer))
    : Array.isArray(rawQuestion.correct_answers)
      ? rawQuestion.correct_answers.map((answer) => String(answer))
      : [];

  const clues = Array.isArray(rawQuestion.clues)
    ? rawQuestion.clues.map((clue) => String(clue))
    : [];

  const prompts = Array.isArray(rawQuestion.prompts)
    ? rawQuestion.prompts.map((prompt) => String(prompt))
    : undefined;

  const promptImages = Array.isArray(rawQuestion.prompt_images)
    ? rawQuestion.prompt_images.map((image) => (image == null ? null : String(image)))
    : Array.isArray(rawQuestion.promptImages)
      ? rawQuestion.promptImages.map((image) => (image == null ? null : String(image)))
      : undefined;

  return {
    question: String(rawQuestion.question ?? rawQuestion.prompt ?? ''),
    answers,
    image: rawQuestion.image == null ? (rawQuestion.image_url == null ? null : String(rawQuestion.image_url)) : String(rawQuestion.image),
    hint: rawQuestion.hint == null ? clues[0] : String(rawQuestion.hint),
    questionType: (rawQuestion.questionType ?? rawQuestion.question_type ?? 'open_ended') as QuestionType,
    prompts,
    promptImages,
  };
}

export function getGameContentConfigFromEnv(
  env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {},
): GameContentConfig {
  return {
    neonDatabaseUrl: env.NEXT_PUBLIC_NEON_URL,
    rebusApiBaseUrl: env.REBUS_API_BASE_URL,
    rebusApiKey: env.REBUS_PACKS_API_SECRET_KEY,
  };
}

export function createGameContentService(config: GameContentConfig) {
  const runtimeFetch = config.fetch ?? fetch;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const rebusApiBaseUrl = config.rebusApiBaseUrl ?? DEFAULT_REBUS_API_BASE_URL;

  const sql = config.neonDatabaseUrl ? neon(config.neonDatabaseUrl) : null;

  function requireSql() {
    if (!sql) {
      throw new GameContentError('CONFIG_ERROR', 'Missing neonDatabaseUrl for trivia content access');
    }

    return sql;
  }

  function requireRebusApiKey() {
    if (!config.rebusApiKey) {
      throw new GameContentError('CONFIG_ERROR', 'Missing rebusApiKey for rebus content access');
    }

    return config.rebusApiKey;
  }

  async function fetchRebusJson<T>(path: string): Promise<T> {
    const apiKey = requireRebusApiKey();

    let response: Response;
    try {
      response = await runtimeFetch(`${rebusApiBaseUrl}${path}`, {
        headers: {
          'x-api-key': apiKey,
        },
        signal: withTimeoutSignal(timeoutMs),
      });
    } catch (error) {
      throw new GameContentError('UPSTREAM_ERROR', `Failed to reach rebus content endpoint: ${path}`, error);
    }

    if (!response.ok) {
      if (response.status === 404) {
        throw new GameContentError('PACK_NOT_FOUND', `Rebus resource not found for path: ${path}`);
      }

      throw new GameContentError('UPSTREAM_ERROR', `Rebus content request failed: ${response.status} ${response.statusText}`);
    }

    try {
      return (await response.json()) as T;
    } catch (error) {
      throw new GameContentError('INVALID_UPSTREAM_PAYLOAD', `Invalid JSON payload from rebus endpoint: ${path}`, error);
    }
  }

  async function getAllTriviaPacks(): Promise<TriviaPack[]> {
    if (!sql) {
      return [];
    }

    const query = requireSql();
    const rows = (await query`
      SELECT
        p.id,
        p.name,
        p.description,
        p.image_url,
        p.user_id,
        p.created_at,
        p.updated_at,
        COALESCE(array_agg(ppq.question_id ORDER BY ppq.position) FILTER (WHERE ppq.question_id IS NOT NULL), '{}') AS question_ids
      FROM trivia_packs p
      LEFT JOIN trivia_pack_questions ppq ON ppq.pack_id = p.id
      GROUP BY p.id
      ORDER BY p.updated_at DESC;
    `) as TriviaPackRow[];

    return rows.map(normalizeTriviaPack);
  }

  async function getTriviaPackById(id: number): Promise<TriviaPack | null> {
    if (!sql) {
      return null;
    }

    const query = requireSql();
    const rows = (await query`
      SELECT
        p.id,
        p.name,
        p.description,
        p.image_url,
        p.user_id,
        p.created_at,
        p.updated_at,
        COALESCE(array_agg(ppq.question_id ORDER BY ppq.position) FILTER (WHERE ppq.question_id IS NOT NULL), '{}') AS question_ids
      FROM trivia_packs p
      LEFT JOIN trivia_pack_questions ppq ON ppq.pack_id = p.id
      WHERE p.id = ${id}
      GROUP BY p.id;
    `) as TriviaPackRow[];

    return rows[0] ? normalizeTriviaPack(rows[0]) : null;
  }

  async function getTriviaQuestionsForPack(id: number): Promise<TriviaGameQuestion[]> {
    if (!sql) {
      return [];
    }

    const query = requireSql();
    const rows = (await query`
      SELECT
        q.prompt AS question,
        q.correct_answers AS answers,
        q.image_url AS image,
        q.clues,
        q.question_type,
        q.prompts,
        q.prompt_images
      FROM trivia_packs p
      JOIN trivia_pack_questions ppq ON p.id = ppq.pack_id
      JOIN trivia_questions q ON ppq.question_id = q.id
      WHERE p.id = ${id}
      ORDER BY ppq.position;
    `) as TriviaQuestionRow[];

    return rows.map(normalizeTriviaQuestion);
  }

  async function getAllRebusPacks(): Promise<RebusPack[]> {
    const packs = await fetchRebusJson<Array<Record<string, unknown>>>('/packs');
    return packs.map(normalizeRebusPack);
  }

  async function getRebusPackById(id: number): Promise<RebusPack | null> {
    try {
      const pack = await fetchRebusJson<Record<string, unknown>>(`/packs/${id}`);
      return normalizeRebusPack(pack);
    } catch (error) {
      if (error instanceof GameContentError && error.code === 'PACK_NOT_FOUND') {
        return null;
      }

      throw error;
    }
  }

  async function getRebusQuestionsForPack(id: number): Promise<TriviaGameQuestion[]> {
    const questions = await fetchRebusJson<Array<Record<string, unknown>>>(`/packs/${id}/questions`);
    return questions.map(normalizeRebusQuestion);
  }

  return {
    async getAllPacks(): Promise<GamePackDetail[]> {
      const triviaPacks = await getAllTriviaPacks();

      let rebusPacks: RebusPack[] = [];
      try {
        rebusPacks = await getAllRebusPacks();
      } catch (error) {
        console.error('Failed to fetch rebus packs; continuing with trivia packs only.', error);
      }

      return [...triviaPacks, ...rebusPacks];
    },

    async getAllPackSummaries(): Promise<GamePackSummary[]> {
      const packs = await this.getAllPacks();
      return packs.map(toGamePackSummary);
    },

    async getPackById(id: number, gameType?: GameType): Promise<GamePackDetail | null> {
      if (gameType === 'trivia') {
        return getTriviaPackById(id);
      }

      if (gameType === 'rebus') {
        return getRebusPackById(id);
      }

      const triviaPack = await getTriviaPackById(id);
      if (triviaPack) {
        return triviaPack;
      }

      return getRebusPackById(id);
    },

    async getQuestionsForPack(id: number, gameType?: GameType): Promise<TriviaGameQuestion[]> {
      if (gameType === 'trivia') {
        return getTriviaQuestionsForPack(id);
      }

      if (gameType === 'rebus') {
        return getRebusQuestionsForPack(id);
      }

      const pack = await this.getPackById(id);
      if (!pack) {
        throw new GameContentError('PACK_NOT_FOUND', `Pack with id ${id} not found`);
      }

      return this.getQuestionsForPack(id, pack.gameType);
    },

    async getRoomPackDefinition(id: number, gameType?: GameType): Promise<RoomPackDefinition> {
      const pack = await this.getPackById(id, gameType);
      if (!pack) {
        throw new GameContentError('PACK_NOT_FOUND', `Pack with id ${id} not found`);
      }

      const questions = await this.getQuestionsForPack(id, pack.gameType);

      return {
        id: pack.id,
        name: pack.name,
        description: pack.description,
        imageUrl: pack.image_url,
        gameType: pack.gameType,
        questions,
      };
    },
  };
}

export type GameContentService = ReturnType<typeof createGameContentService>;
