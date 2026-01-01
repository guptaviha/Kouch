import { getSqlClient } from '../lib/neon.ts';
import type { QuestionType, TriviaGameQuestion, TriviaPack } from '../types/trivia.ts';

const sql = getSqlClient();

export class PackService {
  static async getAllPacks(): Promise<TriviaPack[]> {
    const packs = (await sql`
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
    `) as unknown as Array<TriviaPack & { question_ids: number[] }>;

    return packs;
  }

  static async getPackById(id: number): Promise<TriviaPack | null> {
    const packs = (await sql`
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
    `) as unknown as Array<TriviaPack & { question_ids: number[] }>;

    return packs[0] || null;
  }

  static async getQuestionsForPack(id: number): Promise<TriviaGameQuestion[]> {
    const questions = await sql`
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
      ORDER BY ppq.position
    ` as Array<{ question: string; answers: string[] | null; image: string | null; clues: string[] | null; question_type: QuestionType; prompts: string[] | null; prompt_images: Array<string | null> | null }>;

    return questions.map(row => ({
      question: row.question,
      answers: row.answers || [],
      image: row.image,
      hint: (row.clues && row.clues.length > 0) ? row.clues[0] : undefined,
      questionType: row.question_type || 'open_ended',
      prompts: row.prompts || undefined,
      promptImages: row.prompt_images || undefined,
    }));
  }
}
