"use client";

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import type { GameCatalogGameRecord } from '@/types/game-catalog';

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-base text-gray-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:ring-blue-900';

interface GameCatalogRecordListProps {
  games: GameCatalogGameRecord[];
  searchValue: string;
  isLoading: boolean;
  onSearchChange: (value: string) => void;
  onRefresh?: () => void;
}

function formatPlayerSummary(game: GameCatalogGameRecord): string {
  const idealSummary = game.ideal_players_min === null && game.ideal_players_max === null
    ? null
    : `${game.ideal_players_min ?? game.min_players}-${game.ideal_players_max ?? game.max_players} ideal`;

  return idealSummary
    ? `${game.min_players}-${game.max_players} players • ${idealSummary}`
    : `${game.min_players}-${game.max_players} players`;
}

function formatTimeSummary(game: GameCatalogGameRecord): string {
  if (game.min_play_time_minutes === game.max_play_time_minutes) {
    return `${game.min_play_time_minutes} min`;
  }

  return `${game.min_play_time_minutes}-${game.max_play_time_minutes} min`;
}

export function GameCatalogRecordList({
  games,
  searchValue,
  isLoading,
  onSearchChange,
  onRefresh,
}: GameCatalogRecordListProps) {
  const resultLabel = `${games.length} ${games.length === 1 ? 'game' : 'games'}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 border-b border-gray-100 pb-5 dark:border-gray-800">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Existing games</h2>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <input
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            className={inputClass}
            placeholder="Search by game name or slug"
          />
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 lg:min-w-fit">{resultLabel}</p>
        </div>
      </div>

      <div className="space-y-3">
        {isLoading && <p className="text-sm text-gray-600 dark:text-gray-300">Loading game records...</p>}
        {!isLoading && games.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-200 p-5 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">
            No Game Database entries found yet.
          </div>
        )}

        {!isLoading && games.map((game) => (
          <Link
            key={game.id}
            href={`/admin/game-catalog/${game.id}`}
            className="block rounded-xl border border-gray-200 bg-white px-4 py-4 text-left transition hover:border-gray-300 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:hover:border-gray-700 dark:hover:bg-gray-900"
          >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-gray-900 dark:text-gray-50">{game.name}</p>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{game.short_description}</p>
                </div>
                <div className="flex flex-col items-end gap-2 text-right">
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                    {game.slug}
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-300">
                    Open editor
                  </span>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium text-gray-600 dark:text-gray-300">
                <span className="rounded-full bg-gray-100 px-2.5 py-1 dark:bg-gray-800">{formatPlayerSummary(game)}</span>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 dark:bg-gray-800">{formatTimeSummary(game)}</span>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 dark:bg-gray-800">Learning {game.ease_of_learning}/5</span>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 dark:bg-gray-800">
                  {game.requires_equipment ? 'Equipment required' : 'No equipment required'}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {game.tags.slice(0, 3).map((tag) => (
                  <span key={tag.id} className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-semibold text-blue-700 dark:bg-blue-900/60 dark:text-blue-100">
                    {tag.name}
                  </span>
                ))}
                {game.tags.length > 3 && (
                  <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-semibold text-blue-700 dark:bg-blue-900/60 dark:text-blue-100">
                    +{game.tags.length - 3} more
                  </span>
                )}
              </div>

              <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                Updated {new Date(game.updated_at).toLocaleDateString()}
              </div>
          </Link>
        ))}
      </div>
    </div>
  );
}