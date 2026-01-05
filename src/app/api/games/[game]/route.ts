import { mapPackToGame } from '@/lib/game-mapper';
import { PackService } from '@/services/pack-service';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ game: string }> }
) {
  const gameId = (await params).game;

  // Handle dynamic packs
  const packId = Number(gameId);
  if (isNaN(packId)) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  const pack = await PackService.getPackById(packId);

  if (!pack) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  const gameDetails = mapPackToGame(pack);

  return NextResponse.json(gameDetails);
}
