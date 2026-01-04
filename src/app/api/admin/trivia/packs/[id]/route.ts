import { NextRequest, NextResponse } from 'next/server';

import { getSqlClient, withTransaction } from '@/lib/neon';
import type { CreatePackPayload, TriviaPack } from '@/types/trivia';

const sql = getSqlClient();

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function notFound(message: string) {
  return NextResponse.json({ error: message }, { status: 404 });
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

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const packId = Number(id);
  if (!Number.isInteger(packId) || packId <= 0) {
    return badRequest('Invalid pack id');
  }

  try {
    const rows = (await sql`
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
      WHERE p.id = ${packId}
      GROUP BY p.id;
    `) as unknown as Array<TriviaPack & { question_ids: number[] }>;

    if (!rows || rows.length === 0) {
      return notFound('Pack not found');
    }

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('Failed to fetch pack', error);
    return NextResponse.json({ error: 'Failed to fetch pack' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const packId = Number(id);
  if (!Number.isInteger(packId) || packId <= 0) {
    return badRequest('Invalid pack id');
  }

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
      return badRequest('At least one question_id is required to update a pack');
    }

    const existingQuestions = (await sql`SELECT id FROM trivia_questions WHERE id = ANY(${questionIds}::int[]);`) as Array<{ id: number | string }>;
    const existingIds = existingQuestions.map((row) => Number(row.id));
    const missing = questionIds.filter((qid) => !existingIds.includes(qid));

    if (missing.length > 0) {
      return badRequest(`Unknown question_ids: ${missing.join(', ')}`);
    }

    const pack = await withTransaction(async (tx) => {
      const [updated] = (await tx`
        UPDATE trivia_packs
        SET name = ${name}, description = ${payload.description ?? null}, image_url = ${imageUrl}, updated_at = now()
        WHERE id = ${packId}
        RETURNING id, name, description, image_url, user_id, created_at, updated_at;
      `) as unknown as TriviaPack[];

      if (!updated) {
        throw notFound('Pack not found');
      }

      await tx`DELETE FROM trivia_pack_questions WHERE pack_id = ${packId};`;

      for (const [position, questionId] of questionIds.entries()) {
        await tx`
          INSERT INTO trivia_pack_questions (pack_id, question_id, position)
          VALUES (${packId}, ${questionId}, ${position})
          ON CONFLICT (pack_id, question_id) DO UPDATE SET position = EXCLUDED.position, updated_at = now();
        `;
      }

      return { ...updated, question_ids: questionIds } satisfies TriviaPack & { question_ids: number[] };
    });

    return NextResponse.json(pack);
  } catch (error) {
    console.error('Failed to update pack', error);
    if (error instanceof Response) return error;
    return NextResponse.json({ error: 'Failed to update pack' }, { status: 500 });
  }
}
