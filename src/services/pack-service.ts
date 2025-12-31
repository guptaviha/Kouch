import { getSqlClient } from '../lib/neon.ts';
import type { TriviaPack } from '../types/trivia.ts';

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

  static async getQuestionsForPack(id: number): Promise<any[]> {
    const questions = await sql`
      SELECT 
        q.prompt as question, 
        q.correct_answers as answers, 
        q.image_url as image, 
        q.clues
      FROM trivia_packs p
      JOIN trivia_pack_questions ppq ON p.id = ppq.pack_id
      JOIN trivia_questions q ON ppq.question_id = q.id
      WHERE p.id = ${id}
      ORDER BY ppq.position
    `;

    return questions.map(row => ({
      question: row.question,
      answers: row.answers || [],
      image: row.image,
      hint: (row.clues && row.clues.length > 0) ? row.clues[0] : undefined
    }));
  }
}
