"use client";

import { useMemo, useState } from 'react';

import GenericCard from '@/components/shared/generic-card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { CreatePackPayload, TriviaQuestion } from '@/types/trivia';

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
}

interface PacksTabProps {
  questions: TriviaQuestion[];
  onRefreshQuestions: () => Promise<void>;
}

export default function PacksTab({ questions, onRefreshQuestions }: PacksTabProps) {
  const { toast } = useToast();

  const [isSubmittingPack, setIsSubmittingPack] = useState(false);
  const [packForm, setPackForm] = useState<PackFormState>({
    name: '',
    description: '',
    selectedQuestionIds: [],
    imagePreview: '',
  });

  const displayQuestions = useMemo(() => {
    return questions.map((question) => ({
      ...question,
      tags: (question.tags ?? []).slice(0, 3),
    }));
  }, [questions]);

  function toggleQuestionSelection(id: number) {
    setPackForm((prev) => {
      const exists = prev.selectedQuestionIds.includes(id);
      const nextIds = exists ? prev.selectedQuestionIds.filter((value) => value !== id) : [...prev.selectedQuestionIds, id];
      return { ...prev, selectedQuestionIds: nextIds };
    });
  }

  async function handleCreatePack(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmittingPack(true);

    try {
      const payload: CreatePackPayload = {
        name: packForm.name.trim(),
        description: packForm.description.trim() || null,
        question_ids: packForm.selectedQuestionIds,
      };

      if (packForm.imagePreview) {
        // Placeholder until pack images are persisted server-side
        payload.image_url = packForm.imagePreview;
      }

      const response = await fetch('/api/admin/trivia/packs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error ?? 'Unable to create pack');
      }

      toast({
        title: 'Pack created',
        description: 'Questions have been linked to this pack.',
      });

      setPackForm({ name: '', description: '', selectedQuestionIds: [], imagePreview: '' });
      await onRefreshQuestions();
    } catch (error: any) {
      toast({
        title: 'Could not save pack',
        description: error.message ?? 'Please try again.',
      });
    } finally {
      setIsSubmittingPack(false);
    }
  }

  return (
    <GenericCard initial={cardMotion.initial} animate={cardMotion.animate} transition={{ duration: 0.35, delay: 0.05 }}>
      <div className="flex items-center justify-between gap-4 border-b border-gray-100 pb-4 dark:border-gray-800">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Create Pack</h2>
        </div>
      </div>

      <form className="mt-6 space-y-5 text-[15px]" onSubmit={handleCreatePack}>
        <p className="text-sm text-gray-600 dark:text-gray-300">Fields marked with <span className="text-red-500">*</span> are required.</p>

        <div className="space-y-2">
          <label className={labelClass}>
            Pack name <span className="text-red-500" aria-hidden>*</span>
          </label>
          <input
            required
            value={packForm.name}
            onChange={(event) => setPackForm((prev) => ({ ...prev, name: event.target.value }))}
            className={inputClass}
            placeholder="General Knowledge Week 1"
          />
        </div>

        <div className="space-y-2">
          <label className={labelClass}>Description</label>
          <textarea
            value={packForm.description}
            onChange={(event) => setPackForm((prev) => ({ ...prev, description: event.target.value }))}
            className={inputClass}
            placeholder="Optional summary for hosts"
            rows={2}
          />
        </div>

        <div className="space-y-2">
          <label className={labelClass}>Pack image</label>
          <div className="flex items-center gap-3">
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) {
                  setPackForm((prev) => ({ ...prev, imagePreview: '' }));
                  return;
                }
                const preview = URL.createObjectURL(file);
                setPackForm((prev) => ({ ...prev, imagePreview: preview }));
              }}
              className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-700 dark:text-gray-200"
            />
            {packForm.imagePreview && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setPackForm((prev) => ({ ...prev, imagePreview: '' }))}>
                Remove
              </Button>
            )}
          </div>
          {packForm.imagePreview && <img src={packForm.imagePreview} alt="Pack preview" className="h-36 w-full rounded-lg object-cover" />}
          <p className={helperClass}>Recommended portrait cover, around 3:4 ratio (e.g., 900x1200). Images are stored later; a placeholder URL is kept now.</p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className={labelClass}>
              Select questions <span className="text-red-500" aria-hidden>*</span>
            </label>
            <span className="text-sm text-gray-600 dark:text-gray-400">{packForm.selectedQuestionIds.length} selected</span>
          </div>
          <div className="max-h-80 space-y-2 overflow-y-auto rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            {displayQuestions.length === 0 && (
              <p className="text-base text-gray-500 dark:text-gray-400">Create a question first to add it to a pack.</p>
            )}
            {displayQuestions.map((question) => (
              <div
                key={question.id}
                className="flex items-start gap-3 rounded-lg border border-transparent px-2 py-1 transition hover:border-gray-200 dark:hover:border-gray-700"
              >
                <input
                  type="checkbox"
                  checked={packForm.selectedQuestionIds.includes(question.id)}
                  onChange={() => toggleQuestionSelection(question.id)}
                  className="mt-1 h-4 w-4 accent-blue-600"
                  aria-label={`Select question ${question.id}`}
                />
                <div className="flex-1">
                  <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{question.prompt}</p>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                      {question.question_type === 'multiple_choice' ? 'MCQ' : question.question_type === 'multi_part' ? 'Multi' : 'Open'}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-200">Difficulty {question.difficulty}</span>
                    {(question.tags ?? []).map((tag) => (
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

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="submit" disabled={isSubmittingPack}>
            {isSubmittingPack ? 'Saving...' : 'Save pack'}
          </Button>
        </div>
      </form>
    </GenericCard>
  );
}
