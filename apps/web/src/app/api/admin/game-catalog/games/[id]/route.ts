import { NextRequest, NextResponse } from 'next/server';

import {
  GameCatalogInputError,
  GameCatalogService,
} from '@/services/game-catalog-service';
import type { UpdateGameCatalogGamePayload } from '@/types/game-catalog';

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function notFound(message: string) {
  return NextResponse.json({ error: message }, { status: 404 });
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

function parseId(rawId: string): number | null {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = parseId(rawId);
  if (id === null) {
    return badRequest('Invalid game id');
  }

  try {
    const game = await GameCatalogService.getAdminGameById(id);
    if (!game) {
      return notFound('Game not found');
    }

    return NextResponse.json(game);
  } catch (error) {
    console.error('Failed to fetch game catalog record', error);
    return NextResponse.json({ error: 'Failed to fetch game catalog record' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = parseId(rawId);
  if (id === null) {
    return badRequest('Invalid game id');
  }

  try {
    const payload = (await request.json()) as UpdateGameCatalogGamePayload;
    const game = await GameCatalogService.updateGame(id, payload);
    if (!game) {
      return notFound('Game not found');
    }

    return NextResponse.json(game);
  } catch (error) {
    console.error('Failed to update game catalog record', error);
    if (error instanceof GameCatalogInputError) {
      return badRequest(error.message);
    }

    if (isDatabaseConflictError(error)) {
      return conflict('A game with this name or slug already exists');
    }

    return NextResponse.json({ error: 'Failed to update game catalog record' }, { status: 500 });
  }
}