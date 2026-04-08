"use client";

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';

import { GameCatalogRecordList } from '@/components/admin/game-catalog-record-list';
import GenericCard from '@/components/shared/generic-card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { GameCatalogGameRecord } from '@/types/game-catalog';

const cardMotion = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

async function fetchGameCatalogRecords(): Promise<GameCatalogGameRecord[]> {
  const response = await fetch('/api/admin/game-catalog/games?limit=100', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Unable to load game catalog records.');
  }

  return response.json() as Promise<GameCatalogGameRecord[]>;
}

export function GameCatalogAdmin() {
  const { toast } = useToast();

  const [games, setGames] = useState<GameCatalogGameRecord[]>([]);
  const [searchValue, setSearchValue] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const filteredGames = games.filter((game) => {
    if (!searchValue.trim()) {
      return true;
    }

    const normalizedSearch = searchValue.trim().toLowerCase();
    return game.name.toLowerCase().includes(normalizedSearch) || game.slug.toLowerCase().includes(normalizedSearch);
  });

  const refreshGames = useCallback(async (showToast = true) => {
    setIsLoading(true);
    setPageError(null);

    try {
      const data = await fetchGameCatalogRecords();
      setGames(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load game catalog records.';
      setPageError(message);

      if (showToast) {
        toast({
          title: 'Could not load Game Database records',
          description: message,
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void refreshGames(false);
  }, [refreshGames]);

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"
      >
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-50">Game Database</h1>
        </div>

        <Button asChild size="lg" className="h-12 rounded-xl px-6 text-base font-semibold">
          <Link href="/admin/game-catalog/new" className="gap-2">
            <Plus className="h-4 w-4" aria-hidden />
            Create new game
          </Link>
        </Button>
      </motion.div>

      {pageError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200">
          {pageError}
        </div>
      )}

      <GenericCard initial={cardMotion.initial} animate={cardMotion.animate} transition={{ duration: 0.35 }}>
        <GameCatalogRecordList
          games={filteredGames}
          searchValue={searchValue}
          isLoading={isLoading}
          onSearchChange={setSearchValue}
        />
      </GenericCard>
    </div>
  );
}