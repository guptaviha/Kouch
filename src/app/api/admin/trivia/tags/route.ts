import { NextRequest, NextResponse } from 'next/server';

import { getSqlClient } from '@/lib/neon';
import type { CreateTagPayload, TriviaTag } from '@/types/trivia';

const sql = getSqlClient();

function sanitizeName(name?: string): string {
  return (name ?? '').trim().toLowerCase();
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim();
    const limitParam = Number(searchParams.get('limit'));
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 25;

    let tags: TriviaTag[];

    if (q && q.length > 0) {
      tags = (await sql`
        SELECT id, name, description, user_id, created_at, updated_at
        FROM trivia_tags
        WHERE name ILIKE ${'%' + q + '%'}
        ORDER BY updated_at DESC
        LIMIT ${limit};
      `) as unknown as TriviaTag[];
    } else {
      tags = (await sql`
        SELECT id, name, description, user_id, created_at, updated_at
        FROM trivia_tags
        ORDER BY updated_at DESC
        LIMIT ${limit};
      `) as unknown as TriviaTag[];
    }

    return NextResponse.json(tags);
  } catch (error) {
    console.error('Failed to fetch tags', error);
    return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as CreateTagPayload;
    const name = sanitizeName(payload.name);

    if (!name) {
      return badRequest('Tag name is required');
    }

    const description = payload.description ?? null;

    const [tag] = (await sql`
      INSERT INTO trivia_tags (name, description)
      VALUES (${name}, ${description})
      ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, updated_at = now()
      RETURNING id, name, description, user_id, created_at, updated_at;
    `) as unknown as TriviaTag[];

    return NextResponse.json(tag, { status: 201 });
  } catch (error) {
    console.error('Failed to create tag', error);
    return NextResponse.json({ error: 'Failed to create tag' }, { status: 500 });
  }
}
