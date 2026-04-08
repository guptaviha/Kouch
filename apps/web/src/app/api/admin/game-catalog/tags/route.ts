import { NextRequest, NextResponse } from 'next/server';

import {
  GameCatalogInputError,
  GameCatalogService,
} from '@/services/game-catalog-service';
import type { CreateGameCatalogTagPayload } from '@/types/game-catalog';

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = Number(searchParams.get('limit'));
    const tags = await GameCatalogService.listTags({
      q: searchParams.get('q'),
      limit: Number.isFinite(limitParam) ? limitParam : undefined,
    });

    return NextResponse.json(tags);
  } catch (error) {
    console.error('Failed to fetch game catalog tags', error);
    return NextResponse.json({ error: 'Failed to fetch game catalog tags' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as CreateGameCatalogTagPayload;
    const tag = await GameCatalogService.upsertTag(payload);
    return NextResponse.json(tag, { status: 201 });
  } catch (error) {
    console.error('Failed to upsert game catalog tag', error);
    if (error instanceof GameCatalogInputError) {
      return badRequest(error.message);
    }

    return NextResponse.json({ error: 'Failed to upsert game catalog tag' }, { status: 500 });
  }
}