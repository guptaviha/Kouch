export type GameType = 'trivia' | 'rebus';
export type QuestionType = 'multiple_choice' | 'open_ended' | 'multi_part';

export interface TriviaMultiPart {
  prompt: string;
  correct_answers: string[];
  image_url: string | null;
}

export interface TriviaTag {
  id: number;
  name: string;
  description: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface TriviaQuestion {
  id: number;
  prompt: string;
  prompts: string[];
  prompt_images: Array<string | null>;
  question_type: QuestionType;
  difficulty: number;
  clues: string[];
  image_url: string | null;
  choices: string[] | null;
  correct_choice_index: number | null;
  correct_answers: string[] | null;
  multi_parts: TriviaMultiPart[] | null;
  user_id: string;
  created_at: string;
  updated_at: string;
  tags?: TriviaTag[];
}

export interface TriviaGameQuestion {
  question: string;
  answers: string[];
  image?: string | null;
  hint?: string;
  questionType: QuestionType;
  prompts?: string[];
  promptImages?: Array<string | null> | null;
}

// Base game pack interface with common fields
export interface BaseGamePack {
  id: number;
  name: string;
  description: string | null;
  image_url: string;
  gameType: GameType;
  created_at: string;
  updated_at: string;
}

// Trivia-specific pack
export interface TriviaPack extends BaseGamePack {
  gameType: 'trivia';
  user_id: string;
  questions?: TriviaQuestion[];
  question_ids?: number[];
}

// Rebus-specific pack
export interface RebusPack extends BaseGamePack {
  gameType: 'rebus';
}

// Legacy: simple pack identifier used across the UI (string id)
export type GamePack = string;

export function isValidGame(value: unknown): value is GamePack {
  return typeof value === 'string' && value.length > 0;
}

// Union type for detailed pack data (database/API models)
export type GamePackDetail = TriviaPack | RebusPack;

export interface CreateTagPayload {
  name: string;
  description?: string | null;
}

export interface CreateQuestionPayload {
  prompt?: string;
  prompts: string[];
  prompt_images?: Array<string | null>;
  question_type: QuestionType;
  difficulty?: number;
  clues?: string[];
  choices?: string[];
  correct_choice_index?: number | null;
  correct_answers?: string[];
  image_url?: string | null;
  multi_parts?: TriviaMultiPart[];
  tag_names?: string[];
}

export interface CreatePackPayload {
  name: string;
  description?: string | null;
  question_ids: number[];
  image_url: string;
}
