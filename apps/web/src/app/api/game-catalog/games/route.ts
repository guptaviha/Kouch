import { NextRequest, NextResponse } from 'next/server';

import {
  GameCatalogService,
  parseGameCatalogFilters,
} from '@/services/game-catalog-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filters = parseGameCatalogFilters(searchParams);
    const response = await GameCatalogService.listPublicGames(filters);

    return NextResponse.json(response);
  } catch (error) {
    console.error('Failed to fetch public game catalog records', error);
    return NextResponse.json({ error: 'Failed to fetch public game catalog records' }, { status: 500 });
  }
}