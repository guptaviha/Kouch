"use client";

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

import { GameCatalogRecordList } from '@/components/admin/game-catalog-record-list';
import { GameCatalogTaxonomyInput } from '@/components/admin/game-catalog-taxonomy-input';
import GenericCard from '@/components/shared/generic-card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { createGameCatalogSlug, normalizeGameCatalogNames } from '@/lib/game-catalog';
import type {
  CreateGameCatalogGamePayload,
  GameCatalogEquipmentTag,
  GameCatalogGameRecord,
  GameCatalogTag,
} from '@/types/game-catalog';

const cardMotion = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

const labelClass = 'text-base font-semibold text-gray-900 dark:text-gray-50';
const helperClass = 'text-sm text-gray-600 dark:text-gray-300';
const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-base text-gray-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:ring-blue-900';

interface GameCatalogFormState {
  name: string;
  slug: string;
  slugManuallyEdited: boolean;
  shortDescription: string;
  rulesMarkdown: string;
  minPlayers: string;
  maxPlayers: string;
  idealPlayersMin: string;
  idealPlayersMax: string;
  minPlayTimeMinutes: string;
  maxPlayTimeMinutes: string;
  easeOfLearning: number;
  requiresEquipment: boolean;
  tagNames: string[];
  equipmentNames: string[];
  createdBy: string;
}

function createEmptyFormState(): GameCatalogFormState {
  return {
    name: '',
    slug: '',
    slugManuallyEdited: false,
    shortDescription: '',
    rulesMarkdown: '',
    minPlayers: '2',
    maxPlayers: '8',
    idealPlayersMin: '',
    idealPlayersMax: '',
    minPlayTimeMinutes: '15',
    maxPlayTimeMinutes: '30',
    easeOfLearning: 3,
    requiresEquipment: false,
    tagNames: [],
    equipmentNames: [],
    createdBy: 'admin',
  };
}

function buildFormState(game: GameCatalogGameRecord): GameCatalogFormState {
  return {
    name: game.name,
    slug: game.slug,
    slugManuallyEdited: true,
    shortDescription: game.short_description,
    rulesMarkdown: game.rules_markdown,
    minPlayers: String(game.min_players),
    maxPlayers: String(game.max_players),
    idealPlayersMin: game.ideal_players_min === null ? '' : String(game.ideal_players_min),
    idealPlayersMax: game.ideal_players_max === null ? '' : String(game.ideal_players_max),
    minPlayTimeMinutes: String(game.min_play_time_minutes),
    maxPlayTimeMinutes: String(game.max_play_time_minutes),
    easeOfLearning: game.ease_of_learning,
    requiresEquipment: game.requires_equipment,
    tagNames: game.tags.map((tag) => tag.name),
    equipmentNames: game.equipment_tags.map((tag) => tag.name),
    createdBy: game.created_by,
  };
}

function parseIntegerOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = Number(trimmed);
  return Number.isInteger(normalized) ? normalized : null;
}

function buildPayload(form: GameCatalogFormState): CreateGameCatalogGamePayload {
  const minPlayers = parseIntegerOrNull(form.minPlayers);
  const maxPlayers = parseIntegerOrNull(form.maxPlayers);
  const minPlayTime = parseIntegerOrNull(form.minPlayTimeMinutes);
  const maxPlayTime = parseIntegerOrNull(form.maxPlayTimeMinutes);

  if (minPlayers === null || maxPlayers === null || minPlayTime === null || maxPlayTime === null) {
    throw new Error('Player counts and play time fields must be whole numbers.');
  }

  const name = form.name.trim();
  const shortDescription = form.shortDescription.trim();
  const rulesMarkdown = form.rulesMarkdown.trim();

  if (!name) {
    throw new Error('Game name is required.');
  }

  if (!shortDescription) {
    throw new Error('Short description is required.');
  }

  if (!rulesMarkdown) {
    throw new Error('Rules content is required.');
  }

  return {
    name,
    slug: createGameCatalogSlug(form.slug || name),
    short_description: shortDescription,
    rules_markdown: rulesMarkdown,
    min_players: minPlayers,
    max_players: maxPlayers,
    ideal_players_min: parseIntegerOrNull(form.idealPlayersMin),
    ideal_players_max: parseIntegerOrNull(form.idealPlayersMax),
    min_play_time_minutes: minPlayTime,
    max_play_time_minutes: maxPlayTime,
    ease_of_learning: form.easeOfLearning,
    requires_equipment: form.requiresEquipment,
    tag_names: normalizeGameCatalogNames(form.tagNames),
    equipment_names: form.requiresEquipment ? normalizeGameCatalogNames(form.equipmentNames) : [],
    created_by: form.createdBy.trim() || 'admin',
  };
}

export function GameCatalogAdmin() {
  const { toast } = useToast();

  const [games, setGames] = useState<GameCatalogGameRecord[]>([]);
  const [tags, setTags] = useState<GameCatalogTag[]>([]);
  const [equipmentTags, setEquipmentTags] = useState<GameCatalogEquipmentTag[]>([]);
  const [form, setForm] = useState<GameCatalogFormState>(createEmptyFormState());
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [selectedGameTimestamps, setSelectedGameTimestamps] = useState<{ created_at: string; updated_at: string } | null>(null);
  const [listSearchValue, setListSearchValue] = useState('');
  const [tagQuery, setTagQuery] = useState('');
  const [equipmentQuery, setEquipmentQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingRecord, setIsLoadingRecord] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const filteredGames = games.filter((game) => {
    if (!listSearchValue.trim()) {
      return true;
    }

    const search = listSearchValue.trim().toLowerCase();
    return game.name.toLowerCase().includes(search) || game.slug.toLowerCase().includes(search);
  });

  async function refreshGames() {
    const response = await fetch('/api/admin/game-catalog/games?limit=100', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Unable to load game catalog records.');
    }

    const data = (await response.json()) as GameCatalogGameRecord[];
    setGames(data);
  }

  async function refreshTags(query?: string) {
    const search = query?.trim() ? `?q=${encodeURIComponent(query.trim())}&limit=20` : '?limit=20';
    const response = await fetch(`/api/admin/game-catalog/tags${search}`, { cache: 'no-store' });
    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as GameCatalogTag[];
    setTags(data);
  }

  async function refreshEquipmentTags(query?: string) {
    const search = query?.trim() ? `?q=${encodeURIComponent(query.trim())}&limit=20` : '?limit=20';
    const response = await fetch(`/api/admin/game-catalog/equipment${search}`, { cache: 'no-store' });
    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as GameCatalogEquipmentTag[];
    setEquipmentTags(data);
  }

  async function refreshPageData() {
    setIsLoading(true);
    setPageError(null);

    try {
      await Promise.all([refreshGames(), refreshTags(), refreshEquipmentTags()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load the Game Database admin screen.';
      setPageError(message);
      toast({
        title: 'Could not load Game Database admin',
        description: message,
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRefreshList() {
    try {
      await refreshGames();
    } catch (error) {
      toast({
        title: 'Could not refresh game records',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    }
  }

  useEffect(() => {
    void refreshPageData();
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void refreshTags(tagQuery);
    }, 150);

    return () => clearTimeout(timeoutId);
  }, [tagQuery]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void refreshEquipmentTags(equipmentQuery);
    }, 150);

    return () => clearTimeout(timeoutId);
  }, [equipmentQuery]);

  function handleNameChange(value: string) {
    setForm((prev) => ({
      ...prev,
      name: value,
      slug: prev.slugManuallyEdited ? prev.slug : createGameCatalogSlug(value),
    }));
  }

  function handleSlugChange(value: string) {
    setForm((prev) => ({
      ...prev,
      slug: value,
      slugManuallyEdited: value.trim().length > 0,
    }));
  }

  function handleAddTag(value: string) {
    const normalized = normalizeGameCatalogNames([value])[0];
    if (!normalized) {
      return;
    }

    setForm((prev) => ({
      ...prev,
      tagNames: prev.tagNames.includes(normalized) ? prev.tagNames : [...prev.tagNames, normalized],
    }));
  }

  function handleRemoveTag(value: string) {
    setForm((prev) => ({
      ...prev,
      tagNames: prev.tagNames.filter((tagName) => tagName !== value),
    }));
  }

  function handleAddEquipment(value: string) {
    const normalized = normalizeGameCatalogNames([value])[0];
    if (!normalized) {
      return;
    }

    setForm((prev) => ({
      ...prev,
      equipmentNames: prev.equipmentNames.includes(normalized) ? prev.equipmentNames : [...prev.equipmentNames, normalized],
    }));
  }

  function handleRemoveEquipment(value: string) {
    setForm((prev) => ({
      ...prev,
      equipmentNames: prev.equipmentNames.filter((equipmentName) => equipmentName !== value),
    }));
  }

  function handleStartNewRecord() {
    setSelectedGameId(null);
    setSelectedGameTimestamps(null);
    setForm(createEmptyFormState());
    setTagQuery('');
    setEquipmentQuery('');
  }

  async function handleSelectGame(gameId: number) {
    setIsLoadingRecord(true);

    try {
      const response = await fetch(`/api/admin/game-catalog/games/${gameId}`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Unable to load the selected game record.');
      }

      const game = (await response.json()) as GameCatalogGameRecord;
      setSelectedGameId(game.id);
      setSelectedGameTimestamps({ created_at: game.created_at, updated_at: game.updated_at });
      setForm(buildFormState(game));
      setTagQuery('');
      setEquipmentQuery('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load the selected game record.';
      toast({
        title: 'Could not open game record',
        description: message,
      });
    } finally {
      setIsLoadingRecord(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);

    try {
      const payload = buildPayload(form);
      const endpoint = selectedGameId === null
        ? '/api/admin/game-catalog/games'
        : `/api/admin/game-catalog/games/${selectedGameId}`;
      const method = selectedGameId === null ? 'POST' : 'PATCH';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(error?.error ?? 'Unable to save this game record.');
      }

      const savedGame = (await response.json()) as GameCatalogGameRecord;
      setSelectedGameId(savedGame.id);
      setSelectedGameTimestamps({ created_at: savedGame.created_at, updated_at: savedGame.updated_at });
      setForm(buildFormState(savedGame));

      await Promise.all([refreshGames(), refreshTags(), refreshEquipmentTags()]);

      toast({
        title: selectedGameId === null ? 'Game record created' : 'Game record updated',
        description: `${savedGame.name} is ready to appear in the Game Database.`,
      });
    } catch (error) {
      toast({
        title: 'Could not save game record',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-2"
      >
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-50">Game Database Admin</h1>
        <p className="max-w-3xl text-base text-gray-600 dark:text-gray-300">
          Create and maintain curated game entries with player counts, play time, learning curve, rules, and taxonomy metadata.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <GenericCard initial={cardMotion.initial} animate={cardMotion.animate} transition={{ duration: 0.35 }}>
          <div className="flex items-center justify-between gap-4 border-b border-gray-100 pb-4 dark:border-gray-800">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
                {selectedGameId === null ? 'Create Game Entry' : 'Edit Game Entry'}
              </h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                Fields marked with <span className="text-red-500">*</span> are required.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={handleStartNewRecord}>
              {selectedGameId === null ? 'Reset form' : 'Create new'}
            </Button>
          </div>

          {pageError && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200">
              {pageError}
            </div>
          )}

          <form className="mt-6 space-y-8 text-[15px]" onSubmit={handleSubmit}>
            <section className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Basics</h3>
                <p className={helperClass}>Core identity and rules content for the curated game record.</p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className={labelClass}>
                    Name <span className="text-red-500" aria-hidden>*</span>
                  </label>
                  <input
                    required
                    value={form.name}
                    onChange={(event) => handleNameChange(event.target.value)}
                    className={inputClass}
                    placeholder="Mafia"
                  />
                </div>

                <div className="space-y-2">
                  <label className={labelClass}>
                    Slug <span className="text-red-500" aria-hidden>*</span>
                  </label>
                  <input
                    required
                    value={form.slug}
                    onChange={(event) => handleSlugChange(event.target.value)}
                    className={inputClass}
                    placeholder="mafia"
                  />
                  <p className={helperClass}>Used by the public detail URL. It auto-generates from the name until you override it.</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className={labelClass}>
                  Short description <span className="text-red-500" aria-hidden>*</span>
                </label>
                <textarea
                  required
                  value={form.shortDescription}
                  onChange={(event) => setForm((prev) => ({ ...prev, shortDescription: event.target.value }))}
                  className={inputClass}
                  placeholder="A hidden-role social deduction game for larger groups."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <label className={labelClass}>
                  Rules content <span className="text-red-500" aria-hidden>*</span>
                </label>
                <textarea
                  required
                  value={form.rulesMarkdown}
                  onChange={(event) => setForm((prev) => ({ ...prev, rulesMarkdown: event.target.value }))}
                  className={inputClass}
                  placeholder="Explain setup, win conditions, turn flow, and any optional variants."
                  rows={10}
                />
              </div>
            </section>

            <section className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Player and Time Metadata</h3>
                <p className={helperClass}>Values used by the public browse filters and game cards.</p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2">
                  <label className={labelClass}>Minimum players</label>
                  <input
                    type="number"
                    min={1}
                    value={form.minPlayers}
                    onChange={(event) => setForm((prev) => ({ ...prev, minPlayers: event.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-2">
                  <label className={labelClass}>Maximum players</label>
                  <input
                    type="number"
                    min={1}
                    value={form.maxPlayers}
                    onChange={(event) => setForm((prev) => ({ ...prev, maxPlayers: event.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-2">
                  <label className={labelClass}>Ideal players min</label>
                  <input
                    type="number"
                    min={1}
                    value={form.idealPlayersMin}
                    onChange={(event) => setForm((prev) => ({ ...prev, idealPlayersMin: event.target.value }))}
                    className={inputClass}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-2">
                  <label className={labelClass}>Ideal players max</label>
                  <input
                    type="number"
                    min={1}
                    value={form.idealPlayersMax}
                    onChange={(event) => setForm((prev) => ({ ...prev, idealPlayersMax: event.target.value }))}
                    className={inputClass}
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <div className="space-y-2">
                  <label className={labelClass}>Minimum play time (minutes)</label>
                  <input
                    type="number"
                    min={1}
                    value={form.minPlayTimeMinutes}
                    onChange={(event) => setForm((prev) => ({ ...prev, minPlayTimeMinutes: event.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-2">
                  <label className={labelClass}>Maximum play time (minutes)</label>
                  <input
                    type="number"
                    min={1}
                    value={form.maxPlayTimeMinutes}
                    onChange={(event) => setForm((prev) => ({ ...prev, maxPlayTimeMinutes: event.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className={labelClass}>Ease of learning</label>
                    <span className="text-sm text-gray-600 dark:text-gray-300">{form.easeOfLearning} / 5</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={form.easeOfLearning}
                    onChange={(event) => setForm((prev) => ({ ...prev, easeOfLearning: Number(event.target.value) }))}
                    className="w-full accent-blue-600"
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Classification</h3>
                <p className={helperClass}>General tags and equipment metadata used to organize the browse experience.</p>
              </div>

              <GameCatalogTaxonomyInput
                label="General tags"
                helperText="Use open-ended taxonomy like party, strategy, deduction, or icebreaker."
                placeholder="Add a tag"
                query={tagQuery}
                selectedValues={form.tagNames}
                suggestions={tags}
                emptyText="No matching tags yet. Add one above."
                onQueryChange={setTagQuery}
                onAddValue={handleAddTag}
                onRemoveValue={handleRemoveTag}
              />

              <div className="space-y-3 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                <label className="flex items-center gap-3 text-base font-semibold text-gray-900 dark:text-gray-50">
                  <input
                    type="checkbox"
                    checked={form.requiresEquipment}
                    onChange={(event) => setForm((prev) => ({
                      ...prev,
                      requiresEquipment: event.target.checked,
                      equipmentNames: event.target.checked ? prev.equipmentNames : [],
                    }))}
                    className="h-4 w-4 accent-blue-600"
                  />
                  Requires equipment
                </label>
                <p className={helperClass}>Turn this on only when the game cannot be played without physical items.</p>

                {form.requiresEquipment ? (
                  <GameCatalogTaxonomyInput
                    label="Equipment tags"
                    helperText="Capture the specific items needed, such as cards, dice, paper, or tokens."
                    placeholder="Add required equipment"
                    query={equipmentQuery}
                    selectedValues={form.equipmentNames}
                    suggestions={equipmentTags}
                    emptyText="No matching equipment tags yet. Add one above."
                    onQueryChange={setEquipmentQuery}
                    onAddValue={handleAddEquipment}
                    onRemoveValue={handleRemoveEquipment}
                  />
                ) : (
                  <div className="rounded-lg border border-dashed border-gray-200 px-4 py-3 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    Equipment tags stay hidden until this game is marked as requiring equipment.
                  </div>
                )}
              </div>
            </section>

            <section className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Metadata</h3>
                <p className={helperClass}>`Created by` defaults to admin until user accounts exist on the backend.</p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className={labelClass}>Created by</label>
                  <input
                    value={form.createdBy}
                    onChange={(event) => setForm((prev) => ({ ...prev, createdBy: event.target.value }))}
                    className={inputClass}
                    placeholder="admin"
                  />
                </div>

                <div className="rounded-xl border border-dashed border-gray-200 px-4 py-3 dark:border-gray-700">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Record timestamps</p>
                  <div className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-300">
                    <p>Created: {selectedGameTimestamps ? new Date(selectedGameTimestamps.created_at).toLocaleString() : 'Available after first save'}</p>
                    <p>Updated: {selectedGameTimestamps ? new Date(selectedGameTimestamps.updated_at).toLocaleString() : 'Available after first save'}</p>
                  </div>
                </div>
              </div>
            </section>

            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-end">
              <Button type="button" variant="outline" size="sm" onClick={handleStartNewRecord}>
                {selectedGameId === null ? 'Clear form' : 'Cancel edit'}
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Saving...' : selectedGameId === null ? 'Save game' : 'Update game'}
              </Button>
            </div>
          </form>
        </GenericCard>

        <GenericCard initial={cardMotion.initial} animate={cardMotion.animate} transition={{ duration: 0.35, delay: 0.05 }} className="xl:sticky xl:top-24 xl:self-start">
          <GameCatalogRecordList
            games={filteredGames}
            activeGameId={selectedGameId}
            searchValue={listSearchValue}
            isLoading={isLoading}
            isLoadingRecord={isLoadingRecord}
            onSearchChange={setListSearchValue}
            onSelectGame={handleSelectGame}
            onStartNew={handleStartNewRecord}
            onRefresh={() => {
              void handleRefreshList();
            }}
          />
        </GenericCard>
      </div>
    </div>
  );
}