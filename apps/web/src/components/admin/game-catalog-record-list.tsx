"use client";

import { Button } from '@/components/ui/button';
import type { GameCatalogGameRecord } from '@/types/game-catalog';

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-base text-gray-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:ring-blue-900';

interface GameCatalogRecordListProps {
  games: GameCatalogGameRecord[];
  activeGameId: number | null;
  searchValue: string;
  isLoading: boolean;
  isLoadingRecord: boolean;
  onSearchChange: (value: string) => void;
  onSelectGame: (gameId: number) => void;
  onStartNew: () => void;
  onRefresh: () => void;
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
  activeGameId,
  searchValue,
  isLoading,
  isLoadingRecord,
  onSearchChange,
  onSelectGame,
  onStartNew,
  onRefresh,
}: GameCatalogRecordListProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 border-b border-gray-100 pb-4 dark:border-gray-800">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Existing Entries</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">Open an existing record to edit it, or start a fresh one.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onRefresh}>
              Refresh
            </Button>
            <Button type="button" size="sm" onClick={onStartNew}>
              New
            </Button>
          </div>
        </div>

        <input
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          className={inputClass}
          placeholder="Search by game name"
        />
      </div>

      <div className="space-y-3">
        {isLoading && <p className="text-sm text-gray-600 dark:text-gray-300">Loading game records...</p>}
        {!isLoading && games.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-200 p-5 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">
            No Game Database entries found yet.
          </div>
        )}

        {!isLoading && games.map((game) => {
          const isActive = game.id === activeGameId;

          return (
            <button
              key={game.id}
              type="button"
              onClick={() => onSelectGame(game.id)}
              className={`w-full rounded-xl border px-4 py-4 text-left transition ${
                isActive
                  ? 'border-blue-500 bg-blue-50 shadow-sm dark:border-blue-400 dark:bg-blue-950/40'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:hover:border-gray-700 dark:hover:bg-gray-900'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-gray-900 dark:text-gray-50">{game.name}</p>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{game.short_description}</p>
                </div>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                  {game.slug}
                </span>
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
            </button>
          );
        })}

        {isLoadingRecord && (
          <p className="text-sm text-gray-600 dark:text-gray-300">Loading selected record...</p>
        )}
      </div>
    </div>
  );
}