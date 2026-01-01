"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Edit } from 'lucide-react';

import GenericCard from '@/components/shared/generic-card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { CreateQuestionPayload, QuestionType, TriviaQuestion, TriviaTag } from '@/types/trivia';

const cardMotion = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

const labelClass = "text-base font-semibold text-gray-900 dark:text-gray-50";
const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-base text-gray-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:ring-blue-900";
const helperClass = "text-sm text-gray-600 dark:text-gray-300";

interface PromptInput {
  prompt: string;
  imagePreview: string;
}

interface QuestionFormState {
  prompts: PromptInput[];
  question_type: QuestionType;
  difficulty: number;
  clues: string[];
  choices: string[];
  correct_choice_index: number;
  correct_answers: string[];
  selectedTags: string[];
}

function parseLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export default function EditQuestionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const questionId = params?.id;
  const formId = 'edit-question-form';

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [question, setQuestion] = useState<TriviaQuestion | null>(null);
  const [form, setForm] = useState<QuestionFormState>({
    prompts: [{ prompt: '', imagePreview: '' }],
    question_type: 'multiple_choice',
    difficulty: 3,
    clues: [],
    choices: ['', ''],
    correct_choice_index: 0,
    correct_answers: [],
    selectedTags: [],
  });

  useEffect(() => {
    async function fetchData() {
      if (!questionId) return;
      setIsLoading(true);
      try {
        const response = await fetch(`/api/admin/trivia/questions/${questionId}`, { cache: 'no-store' });

        if (!response.ok) {
          toast({
            title: 'Could not load question',
            description: 'This question may not exist.',
          });
          setIsLoading(false);
          return;
        }

        const questionData = (await response.json()) as TriviaQuestion & { tags: TriviaTag[] };

        setQuestion(questionData);
        setForm({
          prompts: questionData.prompts.map((prompt, index) => ({
            prompt,
            imagePreview: questionData.prompt_images[index] || '',
          })),
          question_type: questionData.question_type,
          difficulty: questionData.difficulty,
          clues: questionData.clues ?? [],
          choices: questionData.choices ?? ['', ''],
          correct_choice_index: questionData.correct_choice_index ?? 0,
          correct_answers: questionData.correct_answers ?? [],
          selectedTags: (questionData.tags ?? []).map((tag) => tag.name),
        });
      } catch (error) {
        console.error('Failed to load question', error);
        toast({
          title: 'Could not load question',
          description: 'Please try again.',
        });
      } finally {
        setIsLoading(false);
      }
    }

    void fetchData();
  }, [questionId, toast]);

  function startEditing() {
    if (!question) return;
    setForm({
      prompts: question.prompts.map((prompt, index) => ({
        prompt,
        imagePreview: question.prompt_images[index] || '',
      })),
      question_type: question.question_type,
      difficulty: question.difficulty,
      clues: question.clues ?? [],
      choices: question.choices ?? ['', ''],
      correct_choice_index: question.correct_choice_index ?? 0,
      correct_answers: question.correct_answers ?? [],
      selectedTags: ((question as TriviaQuestion & { tags?: TriviaTag[] }).tags ?? []).map((tag) => tag.name),
    });
    setIsEditing(true);
  }

  function cancelEditing() {
    if (!question) return;
    setForm({
      prompts: question.prompts.map((prompt, index) => ({
        prompt,
        imagePreview: question.prompt_images[index] || '',
      })),
      question_type: question.question_type,
      difficulty: question.difficulty,
      clues: question.clues ?? [],
      choices: question.choices ?? ['', ''],
      correct_choice_index: question.correct_choice_index ?? 0,
      correct_answers: question.correct_answers ?? [],
      selectedTags: ((question as TriviaQuestion & { tags?: TriviaTag[] }).tags ?? []).map((tag) => tag.name),
    });
    setIsEditing(false);
  }

  function handleAddPrompt() {
    setForm((prev) => {
      if (prev.prompts.length >= 4) return prev;
      return { ...prev, prompts: [...prev.prompts, { prompt: '', imagePreview: '' }] };
    });
  }

  function handleRemovePrompt(index: number) {
    setForm((prev) => {
      if (prev.prompts.length <= 1) return prev;
      const nextPrompts = prev.prompts.filter((_, i) => i !== index);
      return { ...prev, prompts: nextPrompts };
    });
  }

  function handlePromptChange(index: number, value: string) {
    setForm((prev) => {
      const nextPrompts = [...prev.prompts];
      nextPrompts[index] = { ...nextPrompts[index], prompt: value };
      return { ...prev, prompts: nextPrompts };
    });
  }

  function handlePromptImageSelect(index: number, file?: File | null) {
    setForm((prev) => {
      const nextPrompts = [...prev.prompts];
      const imagePreview = file ? URL.createObjectURL(file) : '';
      nextPrompts[index] = { ...nextPrompts[index], imagePreview };
      return { ...prev, prompts: nextPrompts };
    });
  }

  function handleAddChoice() {
    setForm((prev) => ({ ...prev, choices: [...prev.choices, ''] }));
  }

  function handleChoiceChange(index: number, value: string) {
    setForm((prev) => {
      const nextChoices = [...prev.choices];
      nextChoices[index] = value;
      return { ...prev, choices: nextChoices };
    });
  }

  function handleRemoveChoice(index: number) {
    setForm((prev) => {
      const nextChoices = prev.choices.filter((_, i) => i !== index);
      const nextCorrectIndex = Math.min(prev.correct_choice_index, Math.max(0, nextChoices.length - 1));
      return { ...prev, choices: nextChoices, correct_choice_index: nextCorrectIndex };
    });
  }

  function addTag(tagName: string) {
    const normalized = tagName.trim().toLowerCase();
    if (!normalized || form.selectedTags.includes(normalized)) return;
    setForm((prev) => ({ ...prev, selectedTags: [...prev.selectedTags, normalized] }));
  }

  function removeTag(tagName: string) {
    setForm((prev) => ({ ...prev, selectedTags: prev.selectedTags.filter((tag) => tag !== tagName) }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!question) return;

    setIsSaving(true);
    try {
      let prompts = form.prompts.map((p) => p.prompt.trim());
      if (form.question_type !== 'multi_part') {
        prompts = [prompts[0] ?? ''];
      }

      if (prompts.some((prompt) => prompt.length < 3)) {
        throw new Error('Each prompt must be at least 3 characters.');
      }

      if (form.question_type === 'multi_part' && (prompts.length < 2 || prompts.length > 4)) {
        throw new Error('Multi-part questions need between 2 and 4 prompts.');
      }

      if (form.question_type !== 'multi_part' && prompts.length !== 1) {
        throw new Error('This question type requires exactly one prompt.');
      }

      let promptImages = form.prompts.map((p) => (p.imagePreview ? p.imagePreview : null));
      if (form.question_type !== 'multi_part') {
        promptImages = [promptImages[0] ?? null];
      }

      const payload: CreateQuestionPayload = {
        prompts,
        prompt_images: promptImages,
        question_type: form.question_type,
        difficulty: form.difficulty,
        clues: form.clues,
        tag_names: form.selectedTags,
      };

      if (form.question_type === 'multiple_choice') {
        const trimmedChoices = form.choices
          .map((choice) => choice.trim())
          .filter((choice) => choice.length > 0);

        if (trimmedChoices.length < 2) {
          throw new Error('Add at least two answer options.');
        }

        const boundedIndex = Math.min(form.correct_choice_index, Math.max(trimmedChoices.length - 1, 0));

        payload.choices = trimmedChoices;
        payload.correct_choice_index = boundedIndex;
      } else {
        payload.correct_answers = form.correct_answers;
        if ((payload.correct_answers?.length ?? 0) === 0) {
          throw new Error('Add at least one accepted answer.');
        }
      }

      const response = await fetch(`/api/admin/trivia/questions/${question.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error ?? 'Unable to update question');
      }

      const updated = (await response.json()) as TriviaQuestion & { tags: TriviaTag[] };
      setQuestion(updated);
      setForm({
        prompts: updated.prompts.map((prompt, index) => ({
          prompt,
          imagePreview: updated.prompt_images[index] || '',
        })),
        question_type: updated.question_type,
        difficulty: updated.difficulty,
        clues: updated.clues ?? [],
        choices: updated.choices ?? ['', ''],
        correct_choice_index: updated.correct_choice_index ?? 0,
        correct_answers: updated.correct_answers ?? [],
        selectedTags: (updated.tags ?? []).map((tag) => tag.name),
      });
      setIsEditing(false);

      toast({
        title: 'Question updated',
        description: 'Changes have been saved.',
      });
    } catch (error: any) {
      toast({
        title: 'Could not save question',
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

  if (!question) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-10">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">Question not found</h1>
        <p className="text-gray-600 dark:text-gray-300">The question you are trying to edit does not exist.</p>
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">{question.prompt}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">Question ID: {question.id}</p>
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
              Edit question
            </Button>
          )}
        </div>
      </div>

      <GenericCard initial={cardMotion.initial} animate={cardMotion.animate} transition={{ duration: 0.35 }}>
        <form id={formId} className="space-y-5 text-[15px]" onSubmit={handleSubmit}>
          <p className="text-sm text-gray-600 dark:text-gray-300">Fields marked with <span className="text-red-500">*</span> are required.</p>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className={labelClass}>
                Question type <span className="text-red-500">*</span>
              </label>
              <select
                value={form.question_type}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    question_type: event.target.value as QuestionType,
                  }))
                }
                className={inputClass}
                disabled={!isEditing || isSaving}
              >
                <option value="multiple_choice">Multiple Choice</option>
                <option value="open_ended">Open Ended</option>
                <option value="multi_part">Multi-part</option>
              </select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className={labelClass}>
                  Difficulty <span className="text-red-500">*</span>
                </label>
                <span className="text-sm text-gray-600 dark:text-gray-300">{form.difficulty} / 5</span>
              </div>
              <input
                type="range"
                min={1}
                max={5}
                value={form.difficulty}
                onChange={(event) => setForm((prev) => ({ ...prev, difficulty: Number(event.target.value) }))}
                className="w-full accent-blue-600"
                disabled={!isEditing || isSaving}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className={labelClass}>
                  Prompts <span className="text-red-500">*</span>
                </label>
                <p className={helperClass}>
                  {form.question_type === 'multi_part'
                    ? 'Add 2-4 prompts, each with an optional image.'
                    : 'Single prompt with an optional image.'}
                </p>
              </div>
              {isEditing && form.question_type === 'multi_part' && (
                <Button type="button" variant="outline" size="sm" onClick={handleAddPrompt} disabled={form.prompts.length >= 4 || isSaving}>
                  Add prompt
                </Button>
              )}
            </div>
            <div className="space-y-3">
              {form.prompts.map((prompt, index) => (
                <div key={index} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 space-y-2">
                      <label className="text-base font-semibold text-gray-800 dark:text-gray-100">
                        Prompt {index + 1} <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={prompt.prompt}
                        onChange={(event) => handlePromptChange(index, event.target.value)}
                        className={inputClass}
                        placeholder="Enter the prompt text"
                        rows={3}
                        disabled={!isEditing || isSaving}
                      />
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-800 dark:text-gray-100">Prompt image</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(event) => handlePromptImageSelect(index, event.target.files?.[0])}
                            className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-700 disabled:opacity-70 dark:text-gray-200"
                            disabled={!isEditing || isSaving}
                          />
                          {isEditing && prompt.imagePreview && (
                            <Button type="button" variant="ghost" size="sm" onClick={() => handlePromptImageSelect(index, null)} disabled={isSaving}>
                              Remove
                            </Button>
                          )}
                        </div>
                        {prompt.imagePreview && (
                          <img src={prompt.imagePreview} alt={`Prompt ${index + 1} preview`} className="h-28 w-full rounded-lg object-cover" />
                        )}
                      </div>
                    </div>
                    {isEditing && form.question_type === 'multi_part' && form.prompts.length > 2 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => handleRemovePrompt(index)} disabled={isSaving}>
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className={labelClass}>Clues</label>
            <div className="space-y-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
              {form.clues.length === 0 && (
                <p className="text-base text-gray-600 dark:text-gray-300">No clues added.</p>
              )}
              {form.clues.map((clue, index) => (
                <div key={index} className="flex items-center gap-3">
                  <input
                    value={clue}
                    onChange={(event) => {
                      if (!isEditing) return;
                      const nextClues = [...form.clues];
                      nextClues[index] = event.target.value;
                      setForm((prev) => ({ ...prev, clues: nextClues }));
                    }}
                    className={inputClass}
                    placeholder={`Clue ${index + 1}`}
                    disabled={!isEditing || isSaving}
                  />
                  {isEditing && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const nextClues = form.clues.filter((_, i) => i !== index);
                        setForm((prev) => ({ ...prev, clues: nextClues }));
                      }}
                      disabled={isSaving}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
              {isEditing && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setForm((prev) => ({ ...prev, clues: [...prev.clues, ''] }))}
                  disabled={isSaving}
                >
                  Add clue
                </Button>
              )}
            </div>
          </div>

          {form.question_type === 'multiple_choice' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className={labelClass}>
                  Choices <span className="text-red-500">*</span>
                </label>
                {isEditing && (
                  <Button type="button" variant="outline" size="sm" onClick={handleAddChoice} disabled={isSaving}>
                    Add option
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                {form.choices.map((choice, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="correct-choice"
                      checked={form.correct_choice_index === index}
                      onChange={() => {
                        if (!isEditing) return;
                        setForm((prev) => ({ ...prev, correct_choice_index: index }));
                      }}
                      className="h-4 w-4 accent-blue-600"
                      aria-label="Mark as correct"
                      disabled={!isEditing || isSaving}
                    />
                    <input
                      value={choice}
                      onChange={(event) => handleChoiceChange(index, event.target.value)}
                      className={inputClass}
                      placeholder={`Option ${index + 1}`}
                      disabled={!isEditing || isSaving}
                    />
                    {isEditing && form.choices.length > 2 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveChoice(index)} disabled={isSaving}>
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(form.question_type === 'open_ended' || form.question_type === 'multi_part') && (
            <div className="space-y-2">
              <label className={labelClass}>
                Accepted answers <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                {form.correct_answers.length === 0 && (
                  <p className="text-base text-gray-600 dark:text-gray-300">No accepted answers added.</p>
                )}
                {form.correct_answers.map((answer, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <input
                      value={answer}
                      onChange={(event) => {
                        if (!isEditing) return;
                        const nextAnswers = [...form.correct_answers];
                        nextAnswers[index] = event.target.value;
                        setForm((prev) => ({ ...prev, correct_answers: nextAnswers }));
                      }}
                      className={inputClass}
                      placeholder={`Answer ${index + 1}`}
                      disabled={!isEditing || isSaving}
                    />
                    {isEditing && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const nextAnswers = form.correct_answers.filter((_, i) => i !== index);
                          setForm((prev) => ({ ...prev, correct_answers: nextAnswers }));
                        }}
                        disabled={isSaving}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
                {isEditing && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setForm((prev) => ({ ...prev, correct_answers: [...prev.correct_answers, ''] }))}
                    disabled={isSaving}
                  >
                    Add answer
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className={labelClass}>Tags</label>
            <div className="flex flex-wrap gap-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
              {form.selectedTags.length === 0 && (
                <span className="text-base text-gray-600 dark:text-gray-300">No tags selected.</span>
              )}
              {form.selectedTags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/60 dark:text-blue-100"
                >
                  {tag}
                  {isEditing && (
                    <button
                      type="button"
                      className="text-blue-700 transition hover:opacity-70 dark:text-blue-100"
                      onClick={() => removeTag(tag)}
                      disabled={isSaving}
                    >
                      x
                    </button>
                  )}
                </span>
              ))}
            </div>
            {isEditing && (
              <div className="flex gap-2">
                <input
                  id="tag-input"
                  className="flex-1 rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-base text-gray-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:ring-blue-900"
                  placeholder="Add a new tag"
                  disabled={isSaving}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      const input = event.currentTarget;
                      addTag(input.value);
                      input.value = '';
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    const input = document.getElementById('tag-input') as HTMLInputElement;
                    addTag(input.value);
                    input.value = '';
                  }}
                  disabled={isSaving}
                >
                  Add
                </Button>
              </div>
            )}
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
