import { GAMES_DATA } from '@/lib/games-data';
import { mapPackToGame } from '@/lib/game-mapper';
import { PackService } from '@/services/pack-service';
import { NextResponse } from 'next/server';

export async function GET() {
  const packs = await PackService.getAllPacks();
  const packGames = packs.map(mapPackToGame);

  // Combine static Rebus game with dynamic Trivia packs
  const games = [GAMES_DATA.rebus, ...packGames];

  return NextResponse.json(games);
}
