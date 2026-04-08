import { NextRequest, NextResponse } from 'next/server';

import { GameCatalogService } from '@/services/game-catalog-service';

function notFound(message: string) {
  return NextResponse.json({ error: message }, { status: 404 });
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  try {
    const game = await GameCatalogService.getPublicGameBySlug(slug);
    if (!game) {
      return notFound('Game not found');
    }

    return NextResponse.json(game);
  } catch (error) {
    console.error('Failed to fetch public game catalog record', error);
    return NextResponse.json({ error: 'Failed to fetch public game catalog record' }, { status: 500 });
  }
}