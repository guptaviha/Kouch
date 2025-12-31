import { PackService } from '@/services/pack-service';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ game: string }> }
) {
    const gameId = (await params).game;
    const packId = Number(gameId);

    if (isNaN(packId)) {
        return NextResponse.json({ error: 'Invalid pack ID' }, { status: 400 });
    }

    const questions = await PackService.getQuestionsForPack(packId);
    return NextResponse.json(questions);
}
