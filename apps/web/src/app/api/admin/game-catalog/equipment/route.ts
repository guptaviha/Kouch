import { NextRequest, NextResponse } from 'next/server';

import {
  GameCatalogInputError,
  GameCatalogService,
} from '@/services/game-catalog-service';
import type { CreateGameCatalogTagPayload } from '@/types/game-catalog';

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = Number(searchParams.get('limit'));
    const equipmentTags = await GameCatalogService.listEquipmentTags({
      q: searchParams.get('q'),
      limit: Number.isFinite(limitParam) ? limitParam : undefined,
    });

    return NextResponse.json(equipmentTags);
  } catch (error) {
    console.error('Failed to fetch game catalog equipment tags', error);
    return NextResponse.json({ error: 'Failed to fetch game catalog equipment tags' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as CreateGameCatalogTagPayload;
    const equipmentTag = await GameCatalogService.upsertEquipmentTag(payload);
    return NextResponse.json(equipmentTag, { status: 201 });
  } catch (error) {
    console.error('Failed to upsert game catalog equipment tag', error);
    if (error instanceof GameCatalogInputError) {
      return badRequest(error.message);
    }

    return NextResponse.json({ error: 'Failed to upsert game catalog equipment tag' }, { status: 500 });
  }
}