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

export interface TriviaPack {
  id: number;
  name: string;
  description: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
  questions?: TriviaQuestion[];
  question_ids?: number[];
}

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
  image_url?: string | null;
}
