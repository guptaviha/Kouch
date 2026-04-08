import { NextRequest, NextResponse } from 'next/server';

import {
  GameCatalogInputError,
  GameCatalogService,
} from '@/services/game-catalog-service';
import type { CreateGameCatalogGamePayload } from '@/types/game-catalog';

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function conflict(message: string) {
  return NextResponse.json({ error: message }, { status: 409 });
}

function isDatabaseConflictError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: string }).code === '23505';
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = Number(searchParams.get('limit'));
    const search = searchParams.get('search') ?? searchParams.get('q');
    const tag = searchParams.get('tag');

    const games = await GameCatalogService.listAdminGames({
      search,
      tag,
      limit: Number.isFinite(limitParam) ? limitParam : undefined,
    });

    return NextResponse.json(games);
  } catch (error) {
    console.error('Failed to fetch admin game catalog records', error);
    return NextResponse.json({ error: 'Failed to fetch admin game catalog records' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as CreateGameCatalogGamePayload;
    const game = await GameCatalogService.createGame(payload);
    return NextResponse.json(game, { status: 201 });
  } catch (error) {
    console.error('Failed to create game catalog record', error);
    if (error instanceof GameCatalogInputError) {
      return badRequest(error.message);
    }

    if (isDatabaseConflictError(error)) {
      return conflict('A game with this name or slug already exists');
    }

    return NextResponse.json({ error: 'Failed to create game catalog record' }, { status: 500 });
  }
}