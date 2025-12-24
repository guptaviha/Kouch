import { getAllGames } from '@/lib/games-data';
import { NextResponse } from 'next/server';

export async function GET() {
  const games = getAllGames();
  return NextResponse.json(games);
}
