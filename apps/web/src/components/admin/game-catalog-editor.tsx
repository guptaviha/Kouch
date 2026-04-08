"use client";

import { useRouter } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';

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

const labelClass = 'text-sm font-semibold text-gray-900 dark:text-gray-50';
const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-base text-gray-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:ring-blue-900';
const compactInputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:ring-blue-900';
const panelClass = 'rounded-2xl border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-800 dark:bg-gray-950/40';

interface GameCatalogEditorProps {
  gameId?: number | null;
}

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

interface RangeRowProps {
  title: string;
  startLabel: string;
  endLabel: string;
  startValue: string;
  endValue: string;
  startPlaceholder?: string;
  endPlaceholder?: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
}

async function fetchGameCatalogTags(query?: string): Promise<GameCatalogTag[]> {
  const search = query?.trim() ? `?q=${encodeURIComponent(query.trim())}&limit=20` : '?limit=20';
  const response = await fetch(`/api/admin/game-catalog/tags${search}`, { cache: 'no-store' });
  if (!response.ok) {
    return [];
  }

  return response.json() as Promise<GameCatalogTag[]>;
}

async function fetchGameCatalogEquipmentTags(query?: string): Promise<GameCatalogEquipmentTag[]> {
  const search = query?.trim() ? `?q=${encodeURIComponent(query.trim())}&limit=20` : '?limit=20';
  const response = await fetch(`/api/admin/game-catalog/equipment${search}`, { cache: 'no-store' });
  if (!response.ok) {
    return [];
  }

  return response.json() as Promise<GameCatalogEquipmentTag[]>;
}

async function fetchGameCatalogGame(gameId: number): Promise<GameCatalogGameRecord> {
  const response = await fetch(`/api/admin/game-catalog/games/${gameId}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Unable to load the selected game record.');
  }

  return response.json() as Promise<GameCatalogGameRecord>;
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

function formatTimestamp(value: string | null): string {
  if (!value) {
    return 'Available after first save';
  }

  return new Date(value).toLocaleString();
}

function RangeRow({
  title,
  startLabel,
  endLabel,
  startValue,
  endValue,
  startPlaceholder,
  endPlaceholder,
  onStartChange,
  onEndChange,
}: RangeRowProps) {
  return (
    <div className="py-1">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">{title}</h3>

      <div className="mt-1 grid grid-cols-2 gap-2">
        <label className="space-y-2">
          <span className={labelClass}>{startLabel}</span>
          <input
            type="number"
            min={1}
            value={startValue}
            onChange={(event) => onStartChange(event.target.value)}
            placeholder={startPlaceholder}
            className={compactInputClass}
          />
        </label>

        <label className="space-y-2">
          <span className={labelClass}>{endLabel}</span>
          <input
            type="number"
            min={1}
            value={endValue}
            onChange={(event) => onEndChange(event.target.value)}
            placeholder={endPlaceholder}
            className={compactInputClass}
          />
        </label>
      </div>
    </div>
  );
}

export function GameCatalogEditor({ gameId = null }: GameCatalogEditorProps) {
  const { toast } = useToast();
  const router = useRouter();
  const isDirtyRef = useRef(false);

  const [tags, setTags] = useState<GameCatalogTag[]>([]);
  const [equipmentTags, setEquipmentTags] = useState<GameCatalogEquipmentTag[]>([]);
  const [form, setForm] = useState<GameCatalogFormState>(createEmptyFormState());
  const [selectedGameTimestamps, setSelectedGameTimestamps] = useState<{ created_at: string; updated_at: string } | null>(null);
  const [tagQuery, setTagQuery] = useState('');
  const [equipmentQuery, setEquipmentQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const isEditing = gameId !== null;

  async function refreshTags(query?: string) {
    const data = await fetchGameCatalogTags(query);
    setTags(data);
  }

  async function refreshEquipmentTags(query?: string) {
    const data = await fetchGameCatalogEquipmentTags(query);
    setEquipmentTags(data);
  }

  function markDirty() {
    isDirtyRef.current = true;
  }

  function clearDirty() {
    isDirtyRef.current = false;
  }

  function confirmAbandonChanges() {
    if (!isDirtyRef.current) {
      return true;
    }

    return window.confirm('You have unsaved changes. Abandon them and leave this page?');
  }

  const refreshPageData = useCallback(async () => {
    setIsLoading(true);
    setPageError(null);

    try {
      if (!isEditing) {
        setForm(createEmptyFormState());
        setSelectedGameTimestamps(null);
        setTagQuery('');
        setEquipmentQuery('');
        clearDirty();
      }

      const [nextTags, nextEquipmentTags, nextGame] = await Promise.all([
        fetchGameCatalogTags(),
        fetchGameCatalogEquipmentTags(),
        isEditing ? fetchGameCatalogGame(gameId) : Promise.resolve<GameCatalogGameRecord | null>(null),
      ]);

      setTags(nextTags);
      setEquipmentTags(nextEquipmentTags);

      if (nextGame) {
        setSelectedGameTimestamps({ created_at: nextGame.created_at, updated_at: nextGame.updated_at });
        setForm(buildFormState(nextGame));
        setTagQuery('');
        setEquipmentQuery('');
        clearDirty();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load the Game Database editor.';
      setPageError(message);
      toast({
        title: 'Could not load Game Database editor',
        description: message,
      });
    } finally {
      setIsLoading(false);
    }
  }, [gameId, isEditing, toast]);

  useEffect(() => {
    void refreshPageData();
  }, [refreshPageData]);

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

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!isDirtyRef.current) {
        return;
      }

      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      if (!isDirtyRef.current) {
        return;
      }

      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) {
        return;
      }

      const targetUrl = new URL(anchor.href, window.location.href);
      if (targetUrl.origin !== window.location.origin) {
        return;
      }

      if (targetUrl.pathname === window.location.pathname && targetUrl.search === window.location.search && targetUrl.hash === window.location.hash) {
        return;
      }

      if (!window.confirm('You have unsaved changes. Abandon them and leave this page?')) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      event.preventDefault();
      router.push(`${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`);
    }

    document.addEventListener('click', handleDocumentClick, true);

    return () => document.removeEventListener('click', handleDocumentClick, true);
  }, [router]);

  function handleNameChange(value: string) {
    markDirty();
    setForm((prev) => ({
      ...prev,
      name: value,
      slug: prev.slugManuallyEdited ? prev.slug : createGameCatalogSlug(value),
    }));
  }

  function handleSlugChange(value: string) {
    markDirty();
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

    markDirty();
    setForm((prev) => ({
      ...prev,
      tagNames: prev.tagNames.includes(normalized) ? prev.tagNames : [...prev.tagNames, normalized],
    }));
  }

  function handleRemoveTag(value: string) {
    markDirty();
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

    markDirty();
    setForm((prev) => ({
      ...prev,
      equipmentNames: prev.equipmentNames.includes(normalized) ? prev.equipmentNames : [...prev.equipmentNames, normalized],
    }));
  }

  function handleRemoveEquipment(value: string) {
    markDirty();
    setForm((prev) => ({
      ...prev,
      equipmentNames: prev.equipmentNames.filter((equipmentName) => equipmentName !== value),
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);

    try {
      const payload = buildPayload(form);
      const endpoint = isEditing
        ? `/api/admin/game-catalog/games/${gameId}`
        : '/api/admin/game-catalog/games';
      const method = isEditing ? 'PATCH' : 'POST';

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
      setSelectedGameTimestamps({ created_at: savedGame.created_at, updated_at: savedGame.updated_at });
      setForm(buildFormState(savedGame));
      clearDirty();

      toast({
        title: isEditing ? 'Game record updated' : 'Game record created',
        description: `${savedGame.name} is ready to appear in the Game Database.`,
      });

      if (isEditing) {
        await Promise.all([refreshTags(), refreshEquipmentTags()]);
      } else {
        router.replace(`/admin/game-catalog/${savedGame.id}`);
      }
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
        className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"
      >
        <div className="space-y-1">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
            {isEditing ? 'Edit game' : 'Create game'}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {isEditing && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => {
                if (!confirmAbandonChanges()) {
                  return;
                }

                router.push('/admin/game-catalog/new');
              }}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Create another
            </Button>
          )}

          <Button
            type="submit"
            form="game-editor-form"
            size="lg"
            className="h-12 rounded-xl px-6 text-base font-semibold"
            disabled={isSaving || !form.name.trim() || !form.rulesMarkdown.trim()}
          >
            {isSaving ? 'Saving...' : isEditing ? 'Update game' : 'Save game'}
          </Button>
        </div>
      </motion.div>

      {pageError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200">
          {pageError}
        </div>
      )}

      <GenericCard
        initial={cardMotion.initial}
        animate={cardMotion.animate}
        transition={{ duration: 0.35 }}
        className="overflow-hidden p-0"
      >
        {isLoading ? (
          <div className="px-8 py-12 text-sm text-gray-600 dark:text-gray-300">Loading game editor...</div>
        ) : (
          <form id="game-editor-form" onSubmit={handleSubmit} className="space-y-0">
            <div className="border-b border-gray-100 px-4 py-4 dark:border-gray-800 sm:px-6">
              <div className="space-y-4">
                <div className="space-y-1">
                  <input
                    autoFocus
                    required
                    value={form.name}
                    onChange={(event) => handleNameChange(event.target.value)}
                    className="w-full border-none bg-transparent p-0 text-4xl font-bold tracking-tight text-gray-900 outline-none placeholder:text-gray-400 focus:ring-0 dark:text-gray-50 dark:placeholder:text-gray-500 sm:text-5xl"
                    placeholder="Untitled game"
                  />
                </div>

                <div className="max-w-md space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                    Slug
                  </label>
                  <input
                    required
                    value={form.slug}
                    onChange={(event) => handleSlugChange(event.target.value)}
                    className={compactInputClass}
                    placeholder="mafia"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)]">
              <aside className="border-b border-gray-100 px-4 py-4 dark:border-gray-800 xl:border-b-0 xl:border-r sm:px-6">
                <div className="space-y-4 xl:sticky xl:top-20">
                  <RangeRow
                    title="Players"
                    startLabel="Min players"
                    endLabel="Max players"
                    startValue={form.minPlayers}
                    endValue={form.maxPlayers}
                    onStartChange={(value) => {
                      markDirty();
                      setForm((prev) => ({ ...prev, minPlayers: value }));
                    }}
                    onEndChange={(value) => {
                      markDirty();
                      setForm((prev) => ({ ...prev, maxPlayers: value }));
                    }}
                  />

                  <RangeRow
                    title="Ideal range"
                    startLabel="Ideal min"
                    endLabel="Ideal max"
                    startValue={form.idealPlayersMin}
                    endValue={form.idealPlayersMax}
                    startPlaceholder="Optional"
                    endPlaceholder="Optional"
                    onStartChange={(value) => {
                      markDirty();
                      setForm((prev) => ({ ...prev, idealPlayersMin: value }));
                    }}
                    onEndChange={(value) => {
                      markDirty();
                      setForm((prev) => ({ ...prev, idealPlayersMax: value }));
                    }}
                  />

                  <RangeRow
                    title="Play time"
                    startLabel="Min minutes"
                    endLabel="Max minutes"
                    startValue={form.minPlayTimeMinutes}
                    endValue={form.maxPlayTimeMinutes}
                    onStartChange={(value) => {
                      markDirty();
                      setForm((prev) => ({ ...prev, minPlayTimeMinutes: value }));
                    }}
                    onEndChange={(value) => {
                      markDirty();
                      setForm((prev) => ({ ...prev, maxPlayTimeMinutes: value }));
                    }}
                  />

                  <div className="py-1">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">Ease of learning</h3>
                      </div>
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{form.easeOfLearning} / 5</span>
                    </div>

                    <input
                      type="range"
                      min={1}
                      max={5}
                      value={form.easeOfLearning}
                      onChange={(event) => {
                        markDirty();
                        setForm((prev) => ({ ...prev, easeOfLearning: Number(event.target.value) }));
                      }}
                      className="mt-1 w-full accent-blue-600"
                    />
                  </div>

                  <div className="py-1">
                    <GameCatalogTaxonomyInput
                      label="General tags"
                      placeholder="Add a tag"
                      query={tagQuery}
                      selectedValues={form.tagNames}
                      suggestions={tags}
                      emptyText="No matching tags yet. Add one above."
                      onQueryChange={setTagQuery}
                      onAddValue={handleAddTag}
                      onRemoveValue={handleRemoveTag}
                    />
                  </div>

                  <div className="py-1">
                    <div className="space-y-2">
                      <label className="flex items-start gap-3 text-sm font-semibold text-gray-900 dark:text-gray-50">
                        <input
                          type="checkbox"
                          checked={form.requiresEquipment}
                          onChange={(event) => {
                            markDirty();
                            setForm((prev) => ({
                              ...prev,
                              requiresEquipment: event.target.checked,
                              equipmentNames: event.target.checked ? prev.equipmentNames : [],
                            }));
                          }}
                          className="mt-0.5 h-4 w-4 accent-blue-600"
                        />
                        <span>Requires equipment</span>
                      </label>

                      {form.requiresEquipment ? (
                        <GameCatalogTaxonomyInput
                          label="Equipment tags"
                          placeholder="Add required equipment"
                          query={equipmentQuery}
                          selectedValues={form.equipmentNames}
                          suggestions={equipmentTags}
                          emptyText="No matching equipment tags yet. Add one above."
                          onQueryChange={setEquipmentQuery}
                          onAddValue={handleAddEquipment}
                          onRemoveValue={handleRemoveEquipment}
                        />
                      ) : null}
                    </div>
                  </div>

                  {/* Metadata removed to reduce sidebar height */}

                  {/* Submit button moved to header to keep sidebar compact */}
                </div>
              </aside>

              <div className="space-y-6 px-6 py-6 sm:px-8">
                <section className="space-y-3">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-50">Short description</h2>
                  </div>

                  <textarea
                    required
                    value={form.shortDescription}
                    onChange={(event) => {
                      markDirty();
                      setForm((prev) => ({ ...prev, shortDescription: event.target.value }));
                    }}
                    className={`${inputClass} min-h-32 resize-y`}
                    placeholder="A hidden-role social deduction game for larger groups."
                    rows={4}
                  />
                </section>

                <section className="space-y-3">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-50">Rules</h2>
                  </div>

                  <textarea
                    required
                    value={form.rulesMarkdown}
                    onChange={(event) => {
                      markDirty();
                      setForm((prev) => ({ ...prev, rulesMarkdown: event.target.value }));
                    }}
                    className={`${inputClass} min-h-[520px] resize-y leading-6`}
                    placeholder="Explain setup, turn order, win conditions, and any optional variants."
                    rows={18}
                  />
                </section>
              </div>
            </div>
          </form>
        )}
      </GenericCard>
    </div>
  );
}