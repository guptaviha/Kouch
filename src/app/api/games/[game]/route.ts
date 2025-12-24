import { getGameDetails } from '@/lib/games-data';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ game: string }> }
) {
  const gameId = (await params).game;
  const gameDetails = getGameDetails(gameId);

  if (!gameDetails) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  return NextResponse.json(gameDetails);
}
