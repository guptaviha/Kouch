import { NextRequest, NextResponse } from 'next/server';

import { getSqlClient, withTransaction } from '@/lib/neon';
import type { CreatePackPayload, TriviaPack } from '@/types/game-types';

const sql = getSqlClient();

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function sanitizeName(name?: string): string {
  return (name ?? '').trim();
}

function sanitizeImageUrl(url?: string): string {
  return (url ?? '').trim();
}

function sanitizeQuestionIds(ids?: number[]): number[] {
  return Array.from(new Set((ids ?? []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)));
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = Number(searchParams.get('limit'));
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 50;

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
      ORDER BY p.updated_at DESC
      LIMIT ${limit};
    `) as unknown as Array<TriviaPack & { question_ids: number[] }>;

    return NextResponse.json(packs);
  } catch (error) {
    console.error('Failed to fetch packs', error);
    return NextResponse.json({ error: 'Failed to fetch packs' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as CreatePackPayload;
    const name = sanitizeName(payload.name);
    const imageUrl = sanitizeImageUrl(payload.image_url);
    const questionIds = sanitizeQuestionIds(payload.question_ids);

    if (!name) {
      return badRequest('Pack name is required');
    }

    if (!imageUrl) {
      return badRequest('Pack image_url is required');
    }

    if (questionIds.length === 0) {
      return badRequest('At least one question_id is required to create a pack');
    }

    const existing = (await sql`SELECT id FROM trivia_questions WHERE id = ANY(${questionIds}::int[]);`) as Array<{ id: number | string }>;
    const existingIds = existing.map((row) => Number(row.id));
    const missing = questionIds.filter((id) => !existingIds.includes(id));

    if (missing.length > 0) {
      return badRequest(`Unknown question_ids: ${missing.join(', ')}`);
    }

    const pack = await withTransaction(async (tx) => {
      const [created] = (await tx`
        INSERT INTO trivia_packs (name, description, image_url)
        VALUES (${name}, ${payload.description ?? null}, ${imageUrl})
        ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, image_url = EXCLUDED.image_url, updated_at = now()
        RETURNING id, name, description, image_url, user_id, created_at, updated_at;
      `) as unknown as TriviaPack[];

      for (const [position, questionId] of questionIds.entries()) {
        await tx`
          INSERT INTO trivia_pack_questions (pack_id, question_id, position)
          VALUES (${created.id}, ${questionId}, ${position})
          ON CONFLICT (pack_id, question_id) DO UPDATE SET position = EXCLUDED.position, updated_at = now();
        `;
      }

      return { ...created, question_ids: questionIds } satisfies TriviaPack & { question_ids: number[] };
    });

    return NextResponse.json(pack, { status: 201 });
  } catch (error) {
    console.error('Failed to create pack', error);
    return NextResponse.json({ error: 'Failed to create pack' }, { status: 500 });
  }
}
