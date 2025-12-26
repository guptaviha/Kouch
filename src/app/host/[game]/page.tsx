"use client";

import { useParams, useRouter } from 'next/navigation';
import HostGameLayout from '@/components/shared/host-game-layout';
import { useEffect } from 'react';
import { isValidGame } from '@/types/games';

export default function HostGamePage() {
  const params = useParams();
  const router = useRouter();
  const game = params.game as string;

  useEffect(() => {
    // Validate game parameter
    if (!isValidGame(game)) {
      router.push('/');
    }
  }, [game, router]);

  if (!isValidGame(game)) {
    return null;
  }

  return <HostGameLayout game={game} />;
}
