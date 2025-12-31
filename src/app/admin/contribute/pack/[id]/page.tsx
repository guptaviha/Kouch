"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Edit } from 'lucide-react';

import GenericCard from '@/components/shared/generic-card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { CreatePackPayload, TriviaPack, TriviaQuestion } from '@/types/trivia';

const cardMotion = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

const labelClass = "text-base font-semibold text-gray-900 dark:text-gray-50";
const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-base text-gray-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:ring-blue-900";
const helperClass = "text-sm text-gray-600 dark:text-gray-300";

interface PackFormState {
  name: string;
  description: string;
  selectedQuestionIds: number[];
  imagePreview: string;
  imageUploadUrl: string;
}

type LoadedPack = TriviaPack & { question_ids?: number[] };

export default function EditPackPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const packId = params?.id;
  const formId = 'edit-pack-form';

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [pack, setPack] = useState<LoadedPack | null>(null);
  const [questions, setQuestions] = useState<TriviaQuestion[]>([]);
  const [form, setForm] = useState<PackFormState>({
    name: '',
    description: '',
    selectedQuestionIds: [],
    imagePreview: '',
    imageUploadUrl: '',
  });

  useEffect(() => {
    async function fetchData() {
      if (!packId) return;
      setIsLoading(true);
      try {
        const [packRes, questionsRes] = await Promise.all([
          fetch(`/api/admin/trivia/packs/${packId}`, { cache: 'no-store' }),
          fetch('/api/admin/trivia/questions?limit=200', { cache: 'no-store' }),
        ]);

        if (!packRes.ok) {
          toast({
            title: 'Could not load pack',
            description: 'This pack may not exist.',
          });
          setIsLoading(false);
          return;
        }

        if (!questionsRes.ok) {
          toast({
            title: 'Could not load questions',
            description: 'Question list may be incomplete.',
          });
        }

        const packData = (await packRes.json()) as LoadedPack;
        const questionData = questionsRes.ok ? ((await questionsRes.json()) as TriviaQuestion[]) : [];

        setPack(packData);
        setQuestions(questionData);
        setForm({
          name: packData.name,
          description: packData.description ?? '',
          selectedQuestionIds: packData.question_ids ?? [],
          imagePreview: packData.image_url,
          imageUploadUrl: packData.image_url,
        });
      } catch (error) {
        console.error('Failed to load pack', error);
        toast({
          title: 'Could not load pack',
          description: 'Please try again.',
        });
      } finally {
        setIsLoading(false);
      }
    }

    void fetchData();
  }, [packId, toast]);

  const questionMap = useMemo(() => new Map(questions.map((question) => [question.id, question])), [questions]);

  const selectedQuestions = useMemo(() => {
    return form.selectedQuestionIds
      .map((id) => questionMap.get(id))
      .filter((question): question is TriviaQuestion => Boolean(question));
  }, [form.selectedQuestionIds, questionMap]);

  function toggleQuestionSelection(id: number) {
    if (!isEditing) return;
    setForm((prev) => {
      const exists = prev.selectedQuestionIds.includes(id);
      const nextIds = exists ? prev.selectedQuestionIds.filter((value) => value !== id) : [...prev.selectedQuestionIds, id];
      return { ...prev, selectedQuestionIds: nextIds };
    });
  }

  function startEditing() {
    if (!pack) return;
    setForm({
      name: pack.name,
      description: pack.description ?? '',
      selectedQuestionIds: pack.question_ids ?? [],
      imagePreview: pack.image_url,
      imageUploadUrl: pack.image_url,
    });
    setIsEditing(true);
  }

  function cancelEditing() {
    if (!pack) return;
    setForm({
      name: pack.name,
      description: pack.description ?? '',
      selectedQuestionIds: pack.question_ids ?? [],
      imagePreview: pack.image_url,
      imageUploadUrl: pack.image_url,
    });
    setIsEditing(false);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!pack) return;

    setIsSaving(true);
    try {
      if (!form.imageUploadUrl) {
        throw new Error('A pack image is required. Please upload one.');
      }

      const payload: CreatePackPayload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        question_ids: form.selectedQuestionIds,
        image_url: form.imageUploadUrl,
      };

      const response = await fetch(`/api/admin/trivia/packs/${pack.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error ?? 'Unable to update pack');
      }

      const updated = (await response.json()) as LoadedPack;
      setPack(updated);
      setForm({
        name: updated.name,
        description: updated.description ?? '',
        selectedQuestionIds: updated.question_ids ?? [],
        imagePreview: updated.image_url,
        imageUploadUrl: updated.image_url,
      });
      setIsEditing(false);

      toast({
        title: 'Pack updated',
        description: 'Changes have been saved.',
      });
    } catch (error: any) {
      toast({
        title: 'Could not save pack',
        description: error.message ?? 'Please try again.',
      });
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-10">
        <div className="h-6 w-32 rounded-md bg-gray-200 dark:bg-gray-800" />
        <div className="h-[480px] rounded-xl bg-gray-50 dark:bg-gray-900" />
      </div>
    );
  }

  if (!pack) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-10">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">Pack not found</h1>
        <p className="text-gray-600 dark:text-gray-300">The pack you are trying to edit does not exist.</p>
        <div className="flex gap-3">
          <Button asChild variant="outline">
            <Link href="/admin/contribute">Back to contribute</Link>
          </Button>
          <Button variant="ghost" onClick={() => router.back()}>Go back</Button>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">{pack.name}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">Pack ID: {pack.id}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isEditing ? (
            <>
              <Button variant="secondary" onClick={cancelEditing} disabled={isSaving}>Cancel</Button>
              <Button type="submit" form={formId} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save changes'}
              </Button>
            </>
          ) : (
            <Button onClick={startEditing} size="lg">
              <Edit className="mr-2 h-4 w-4" />
              Edit pack
            </Button>
          )}
        </div>
      </div>

      <GenericCard initial={cardMotion.initial} animate={cardMotion.animate} transition={{ duration: 0.35 }}>
        <form id={formId} className="space-y-5 text-[15px]" onSubmit={handleSubmit}>
          <p className="text-sm text-gray-600 dark:text-gray-300">Fields marked with <span className="text-red-500">*</span> are required.</p>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className={labelClass}>Pack name <span className="text-red-500">*</span></label>
              <input
                required
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                className={inputClass}
                placeholder="Pack title"
                disabled={!isEditing || isSaving}
              />
            </div>

            <div className="space-y-2">
              <label className={labelClass}>Description</label>
              <textarea
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                className={inputClass}
                placeholder="Optional summary for hosts"
                rows={2}
                disabled={!isEditing || isSaving}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className={labelClass}>Pack image</label>
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  if (!isEditing) return;
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const preview = URL.createObjectURL(file);
                  const placeholders = ['/Trivia-Default.png'];
                  const selectedUrl = placeholders[Math.floor(Math.random() * placeholders.length)];
                  setForm((prev) => ({ ...prev, imagePreview: preview, imageUploadUrl: selectedUrl }));
                }}
                className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-700 disabled:opacity-70 dark:text-gray-200"
                disabled={!isEditing || isSaving}
              />
              {isEditing && form.imageUploadUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setForm((prev) => ({ ...prev, imagePreview: pack.image_url, imageUploadUrl: pack.image_url }))}
                  disabled={isSaving}
                >
                  Reset image
                </Button>
              )}
            </div>
            {form.imagePreview && <img src={form.imagePreview} alt="Pack preview" className="h-44 w-full rounded-lg object-cover" />}
            {!form.imagePreview && pack.image_url && (
              <img src={pack.image_url} alt="Pack preview" className="h-44 w-full rounded-lg object-cover" />
            )}
            <p className={helperClass}>Images are stored later; a placeholder URL is kept now.</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className={labelClass}>Questions in pack</label>
              <span className="text-sm text-gray-600 dark:text-gray-400">{form.selectedQuestionIds.length} selected</span>
            </div>

            <div className="space-y-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
              {selectedQuestions.length === 0 && (
                <p className="text-base text-gray-600 dark:text-gray-300">No questions selected. Turn on edit mode to add questions.</p>
              )}
              {selectedQuestions.map((question) => (
                <div key={question.id} className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                  <div className="flex-1">
                    <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{question.prompt}</p>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                        {question.question_type === 'multiple_choice' ? 'MCQ' : question.question_type === 'multi_part' ? 'Multi' : 'Open'}
                      </span>
                      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-200">Difficulty {question.difficulty}</span>
                      {(question.tags ?? []).slice(0, 3).map((tag) => (
                        <span key={tag.id} className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/60 dark:text-blue-100">
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  {isEditing && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => toggleQuestionSelection(question.id)} disabled={isSaving}>
                      Remove
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Available questions</p>
                <span className="text-xs text-gray-500 dark:text-gray-400">Click to add/remove</span>
              </div>
              <div className="max-h-80 space-y-2 overflow-y-auto rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                {questions.map((question) => (
                  <div
                    key={question.id}
                    className="flex items-start gap-3 rounded-lg border border-transparent px-2 py-1 transition hover:border-gray-200 dark:hover:border-gray-700"
                  >
                    <input
                      type="checkbox"
                      checked={form.selectedQuestionIds.includes(question.id)}
                      onChange={() => toggleQuestionSelection(question.id)}
                      className="mt-1 h-4 w-4 accent-blue-600"
                      aria-label={`Select question ${question.id}`}
                      disabled={!isEditing || isSaving}
                    />
                    <div className="flex-1">
                      <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{question.prompt}</p>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                          {question.question_type === 'multiple_choice' ? 'MCQ' : question.question_type === 'multi_part' ? 'Multi' : 'Open'}
                        </span>
                        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-200">Difficulty {question.difficulty}</span>
                        {(question.tags ?? []).slice(0, 3).map((tag) => (
                          <span key={tag.id} className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/60 dark:text-blue-100">
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {isEditing && (
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={cancelEditing} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save changes'}
              </Button>
            </div>
          )}
        </form>
      </GenericCard>
    </motion.div>
  );
}
