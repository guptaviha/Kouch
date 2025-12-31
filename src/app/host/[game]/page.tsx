"use client";

import { useParams, useRouter } from 'next/navigation';
import HostGameLayout from '@/components/shared/host-game-layout';
import { useEffect, useState } from 'react';

export default function HostGamePage() {
  const params = useParams();
  const router = useRouter();
  const game = params.game as string;
  const [isValid, setIsValid] = useState<boolean | null>(null);

  useEffect(() => {
    const checkGame = async () => {
      // Basic static check
      if (!game || typeof game !== 'string') {
        router.push('/');
        return;
      }

      // Check against API to ensure game/pack exists
      try {
        const res = await fetch(`/api/games/${game}`);
        if (!res.ok) {
          router.push('/');
          return;
        }
        setIsValid(true);
      } catch (error) {
        console.error('Error validating game:', error);
        router.push('/');
      }
    };

    checkGame();
  }, [game, router]);

  if (isValid === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <HostGameLayout game={game} />;
}
