import { notFound } from 'next/navigation';

import { GameCatalogEditor } from '@/components/admin/game-catalog-editor';

interface GameCatalogEditorPageProps {
  params: Promise<{ id: string }>;
}

export default async function GameCatalogEditorPage({ params }: GameCatalogEditorPageProps) {
  const { id } = await params;
  const gameId = Number(id);

  if (!Number.isInteger(gameId) || gameId < 1) {
    notFound();
  }

  return <GameCatalogEditor gameId={gameId} />;
}