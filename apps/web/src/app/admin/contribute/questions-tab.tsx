"use client";

import { useMemo, useState } from 'react';

import { QuestionsTable } from '@/components/admin/questions-table';
import GenericCard from '@/components/shared/generic-card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { CreateQuestionPayload, QuestionType, TriviaQuestion, TriviaTag } from '@/types/game-types';

const cardMotion = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

const labelClass = "text-base font-semibold text-gray-900 dark:text-gray-50";
const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-base text-gray-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:ring-blue-900";
const helperClass = "text-sm text-gray-600 dark:text-gray-300";

function parseLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function lowercaseUnique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.toLowerCase())));
}

interface QuestionsTabProps {
  tags: TriviaTag[];
  questions: TriviaQuestion[];
  onRefreshTags: (query?: string) => Promise<void>;
  onRefreshQuestions: () => Promise<void>;
}

interface PromptInput {
  prompt: string;
  imagePreview: string;
}

interface QuestionFormState {
  prompts: PromptInput[];
  question_type: QuestionType;
  difficulty: number;
  cluesInput: string;
  choices: string[];
  correct_choice_index: number;
  correctAnswersInput: string;
  tagInput: string;
}

const defaultPrompts: PromptInput[] = [{ prompt: '', imagePreview: '' }];

export default function QuestionsTab({ tags, questions, onRefreshTags, onRefreshQuestions }: QuestionsTabProps) {
  const { toast } = useToast();

  const [tagQuery, setTagQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isSubmittingQuestion, setIsSubmittingQuestion] = useState(false);

  const [questionForm, setQuestionForm] = useState<QuestionFormState>({
    prompts: defaultPrompts,
    question_type: 'multiple_choice',
    difficulty: 3,
    cluesInput: '',
    choices: ['', ''],
    correct_choice_index: 0,
    correctAnswersInput: '',
    tagInput: '',
  });

  const filteredTagSuggestions = useMemo(() => {
    const search = tagQuery.trim().toLowerCase();
    const available = tags.filter((tag) => !selectedTags.includes(tag.name));
    if (!search) return available.slice(0, 15);
    return available.filter((tag) => tag.name.includes(search)).slice(0, 15);
  }, [tagQuery, tags, selectedTags]);

  function addSelectedTag(name: string) {
    const normalized = name.trim().toLowerCase();
    if (!normalized || selectedTags.includes(normalized)) return;
    setSelectedTags((prev) => [...prev, normalized]);
  }

  function removeSelectedTag(name: string) {
    setSelectedTags((prev) => prev.filter((tag) => tag !== name));
  }

  function handleAddChoice() {
    setQuestionForm((prev) => ({ ...prev, choices: [...prev.choices, ''] }));
  }

  function handleChoiceChange(index: number, value: string) {
    setQuestionForm((prev) => {
      const nextChoices = [...prev.choices];
      nextChoices[index] = value;
      return { ...prev, choices: nextChoices };
    });
  }

  function handleRemoveChoice(index: number) {
    setQuestionForm((prev) => {
      const nextChoices = prev.choices.filter((_, i) => i !== index);
      const nextCorrectIndex = Math.min(prev.correct_choice_index, Math.max(0, nextChoices.length - 1));
      return { ...prev, choices: nextChoices, correct_choice_index: nextCorrectIndex };
    });
  }

  function handleAddPrompt() {
    setQuestionForm((prev) => {
      if (prev.prompts.length >= 4) return prev;
      return { ...prev, prompts: [...prev.prompts, { prompt: '', imagePreview: '' }] };
    });
  }

  function handleRemovePrompt(index: number) {
    setQuestionForm((prev) => {
      if (prev.prompts.length <= 1) return prev;
      const nextPrompts = prev.prompts.filter((_, i) => i !== index);
      return { ...prev, prompts: nextPrompts };
    });
  }

  function handlePromptChange(index: number, value: string) {
    setQuestionForm((prev) => {
      const nextPrompts = [...prev.prompts];
      nextPrompts[index] = { ...nextPrompts[index], prompt: value };
      return { ...prev, prompts: nextPrompts };
    });
  }

  function handlePromptImageSelect(index: number, file?: File | null) {
    setQuestionForm((prev) => {
      const nextPrompts = [...prev.prompts];
      const imagePreview = file ? URL.createObjectURL(file) : '';
      nextPrompts[index] = { ...nextPrompts[index], imagePreview };
      return { ...prev, prompts: nextPrompts };
    });
  }

  async function handleCreateQuestion(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmittingQuestion(true);

    try {
      let prompts = questionForm.prompts.map((p) => p.prompt.trim());
      if (questionForm.question_type !== 'multi_part') {
        prompts = [prompts[0] ?? ''];
      }

      if (prompts.some((prompt) => prompt.length < 3)) {
        throw new Error('Each prompt must be at least 3 characters.');
      }

      if (questionForm.question_type === 'multi_part' && (prompts.length < 2 || prompts.length > 4)) {
        throw new Error('Multi-part questions need between 2 and 4 prompts.');
      }

      if (questionForm.question_type !== 'multi_part' && prompts.length !== 1) {
        throw new Error('This question type requires exactly one prompt.');
      }

      let promptImages = questionForm.prompts.map((p) => (p.imagePreview ? p.imagePreview : null));
      if (questionForm.question_type !== 'multi_part') {
        promptImages = [promptImages[0] ?? null];
      }

      const payload: CreateQuestionPayload = {
        prompts,
        prompt_images: promptImages,
        question_type: questionForm.question_type,
        difficulty: questionForm.difficulty,
        clues: parseLines(questionForm.cluesInput),
        tag_names: lowercaseUnique(selectedTags),
      };

      if (questionForm.question_type === 'multiple_choice') {
        const trimmedChoices = questionForm.choices
          .map((choice) => choice.trim())
          .filter((choice) => choice.length > 0);

        if (trimmedChoices.length < 2) {
          throw new Error('Add at least two answer options.');
        }

        const boundedIndex = Math.min(questionForm.correct_choice_index, Math.max(trimmedChoices.length - 1, 0));

        payload.choices = trimmedChoices;
        payload.correct_choice_index = boundedIndex;
      } else {
        payload.correct_answers = parseLines(questionForm.correctAnswersInput);
        if ((payload.correct_answers?.length ?? 0) === 0) {
          throw new Error('Add at least one accepted answer.');
        }
      }

      const response = await fetch('/api/admin/trivia/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error ?? 'Unable to create question');
      }

      toast({
        title: 'Question saved',
        description: 'Your question is now ready to add to packs.',
      });

      const resetPrompts = questionForm.question_type === 'multi_part'
        ? [{ prompt: '', imagePreview: '' }, { prompt: '', imagePreview: '' }]
        : defaultPrompts;

      setQuestionForm({
        prompts: resetPrompts,
        question_type: questionForm.question_type,
        difficulty: 3,
        cluesInput: '',
        choices: ['', ''],
        correct_choice_index: 0,
        correctAnswersInput: '',
        tagInput: '',
      });
      setSelectedTags([]);
      await Promise.all([onRefreshTags(), onRefreshQuestions()]);
    } catch (error: any) {
      toast({
        title: 'Could not save question',
        description: error.message ?? 'Please try again.',
      });
    } finally {
      setIsSubmittingQuestion(false);
    }
  }

  return (
    <GenericCard initial={cardMotion.initial} animate={cardMotion.animate} transition={{ duration: 0.35 }}>
      <div className="flex items-center justify-between gap-4 border-b border-gray-100 pb-4 dark:border-gray-800">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Create Question</h2>
        </div>
      </div>

      <form className="mt-6 space-y-5 text-[15px]" onSubmit={handleCreateQuestion}>
        <p className="text-sm text-gray-600 dark:text-gray-300">Fields marked with <span className="text-red-500">*</span> are required.</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className={labelClass}>
              Question type <span className="text-red-500" aria-hidden>*</span>
            </label>
            <select
              value={questionForm.question_type}
              onChange={(event) =>
                setQuestionForm((prev) => ({
                  ...prev,
                  question_type: event.target.value as QuestionType,
                }))
              }
              className={inputClass}
            >
              <option value="multiple_choice">Multiple Choice</option>
              <option value="open_ended">Open Ended</option>
              <option value="multi_part">Multi-part</option>
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className={labelClass}>
                Difficulty <span className="text-red-500" aria-hidden>*</span>
              </label>
              <span className="text-sm text-gray-600 dark:text-gray-300">{questionForm.difficulty} / 5</span>
            </div>
            <input
              type="range"
              min={1}
              max={5}
              value={questionForm.difficulty}
              onChange={(event) => setQuestionForm((prev) => ({ ...prev, difficulty: Number(event.target.value) }))}
              className="w-full accent-blue-600"
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <label className={labelClass}>
                Prompts <span className="text-red-500" aria-hidden>*</span>
              </label>
              <p className={helperClass}>
                {questionForm.question_type === 'multi_part'
                  ? 'Add 2-4 prompts, each with an optional image.'
                  : 'Single prompt with an optional image.'}
              </p>
            </div>
            {questionForm.question_type === 'multi_part' && (
              <Button type="button" variant="outline" size="sm" onClick={handleAddPrompt} disabled={questionForm.prompts.length >= 4}>
                Add prompt
              </Button>
            )}
          </div>
          <div className="space-y-3">
            {questionForm.prompts.map((prompt, index) => (
              <div key={index} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                <div className="flex items-start gap-3">
                  <div className="flex-1 space-y-2">
                    <label className="text-base font-semibold text-gray-800 dark:text-gray-100">
                      Prompt {index + 1} <span className="text-red-500" aria-hidden>*</span>
                    </label>
                    <textarea
                      value={prompt.prompt}
                      onChange={(event) => handlePromptChange(index, event.target.value)}
                      className={inputClass}
                      placeholder="Enter the prompt text"
                      rows={3}
                    />
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-800 dark:text-gray-100">Prompt image</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(event) => handlePromptImageSelect(index, event.target.files?.[0])}
                          className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-700 dark:text-gray-200"
                        />
                        {prompt.imagePreview && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => handlePromptImageSelect(index, null)}>
                            Remove
                          </Button>
                        )}
                      </div>
                      {prompt.imagePreview && (
                        <img src={prompt.imagePreview} alt={`Prompt ${index + 1} preview`} className="h-28 w-full rounded-lg object-cover" />
                      )}
                    </div>
                  </div>
                  {questionForm.question_type === 'multi_part' && questionForm.prompts.length > 2 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => handleRemovePrompt(index)}>
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className={labelClass}>Clues (one per line)</label>
          <textarea
            value={questionForm.cluesInput}
            onChange={(event) => setQuestionForm((prev) => ({ ...prev, cluesInput: event.target.value }))}
            className={inputClass}
            placeholder="Optional clues..."
            rows={3}
          />
        </div>

        {questionForm.question_type === 'multiple_choice' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className={labelClass}>
                Choices <span className="text-red-500" aria-hidden>*</span>
              </label>
              <Button type="button" variant="outline" size="sm" onClick={handleAddChoice}>
                Add option
              </Button>
            </div>
            <div className="space-y-2">
              {questionForm.choices.map((choice, index) => (
                <div key={index} className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="correct-choice"
                    checked={questionForm.correct_choice_index === index}
                    onChange={() => setQuestionForm((prev) => ({ ...prev, correct_choice_index: index }))}
                    className="h-4 w-4 accent-blue-600"
                    aria-label="Mark as correct"
                  />
                  <input
                    value={choice}
                    onChange={(event) => handleChoiceChange(index, event.target.value)}
                    className={inputClass}
                    placeholder={`Option ${index + 1}`}
                  />
                  {questionForm.choices.length > 2 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveChoice(index)}>
                      Remove
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {(questionForm.question_type === 'open_ended' || questionForm.question_type === 'multi_part') && (
          <div className="space-y-2">
            <label className={labelClass}>
              Accepted answers (one per line) <span className="text-red-500" aria-hidden>*</span>
            </label>
            <textarea
              value={questionForm.correctAnswersInput}
              onChange={(event) => setQuestionForm((prev) => ({ ...prev, correctAnswersInput: event.target.value }))}
              className={inputClass}
              placeholder={`Answer A
Answer B`}
              rows={3}
            />
          </div>
        )}

        <div className="space-y-2">
          <label className={labelClass}>Tags</label>
          <div className="flex flex-wrap gap-2">
            {selectedTags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/60 dark:text-blue-100"
              >
                {tag}
                <button
                  type="button"
                  className="text-blue-700 transition hover:opacity-70 dark:text-blue-100"
                  onClick={() => removeSelectedTag(tag)}
                >
                  x
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={questionForm.tagInput}
              onChange={(event) => setQuestionForm((prev) => ({ ...prev, tagInput: event.target.value }))}
              className="flex-1 rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-base text-gray-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:ring-blue-900"
              placeholder="Add a new tag"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                addSelectedTag(questionForm.tagInput);
                setQuestionForm((prev) => ({ ...prev, tagInput: '' }));
              }}
            >
              Add
            </Button>
          </div>
          <div className="space-y-2 rounded-lg border border-dashed border-gray-200 p-3 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Tag suggestions</span>
              <input
                value={tagQuery}
                onChange={(event) => {
                  const value = event.target.value;
                  setTagQuery(value);
                  onRefreshTags(value);
                }}
                placeholder="Search tags"
                className="w-48 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:ring-blue-900"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {filteredTagSuggestions.length === 0 && (
                <span className="text-xs text-gray-500 dark:text-gray-400">No tags yet. Add one above.</span>
              )}
              {filteredTagSuggestions.map((tag) => (
                <Button key={tag.id} type="button" variant="outline" size="sm" onClick={() => addSelectedTag(tag.name)}>
                  {tag.name}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="submit" disabled={isSubmittingQuestion}>
            {isSubmittingQuestion ? 'Saving...' : 'Save question'}
          </Button>
        </div>
      </form>

      <div className="mt-10 border-t border-gray-100 pt-8 dark:border-gray-800">
        <QuestionsTable questions={questions} />
      </div>
    </GenericCard>
  );
}
