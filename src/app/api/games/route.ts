import { mapPackToGame } from '@/lib/game-mapper';
import { PackService } from '@/services/pack-service';
import { NextResponse } from 'next/server';

export async function GET() {
  const packs = await PackService.getAllPacks();
  const packGames = packs.map(mapPackToGame);

  return NextResponse.json(packGames);
}
