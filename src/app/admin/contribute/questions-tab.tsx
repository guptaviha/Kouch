"use client";

import { useMemo, useState } from 'react';

import GenericCard from '@/components/shared/generic-card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type {
  CreateQuestionPayload,
  QuestionType,
  TriviaMultiPart,
  TriviaTag,
} from '@/types/trivia';

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
  onRefreshTags: (query?: string) => Promise<void>;
  onRefreshQuestions: () => Promise<void>;
}

interface MultiPartFormPart {
  prompt: string;
  answersInput: string;
  imagePreview: string;
}

interface QuestionFormState {
  prompt: string;
  question_type: QuestionType;
  difficulty: number;
  cluesInput: string;
  choices: string[];
  correct_choice_index: number;
  correctAnswersInput: string;
  tagInput: string;
  imagePreview: string;
  multiParts: MultiPartFormPart[];
}

const defaultMultiParts: MultiPartFormPart[] = [
  { prompt: '', answersInput: '', imagePreview: '' },
  { prompt: '', answersInput: '', imagePreview: '' },
];

export default function QuestionsTab({ tags, onRefreshTags, onRefreshQuestions }: QuestionsTabProps) {
  const { toast } = useToast();

  const [tagQuery, setTagQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isSubmittingQuestion, setIsSubmittingQuestion] = useState(false);

  const [questionForm, setQuestionForm] = useState<QuestionFormState>({
    prompt: '',
    question_type: 'multiple_choice',
    difficulty: 3,
    cluesInput: '',
    choices: ['', ''],
    correct_choice_index: 0,
    correctAnswersInput: '',
    tagInput: '',
    imagePreview: '',
    multiParts: defaultMultiParts,
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

  function handleAddMultiPart() {
    setQuestionForm((prev) => {
      if (prev.multiParts.length >= 4) return prev;
      return {
        ...prev,
        multiParts: [...prev.multiParts, { prompt: '', answersInput: '', imagePreview: '' }],
      };
    });
  }

  function handleRemoveMultiPart(index: number) {
    setQuestionForm((prev) => {
      if (prev.multiParts.length <= 2) return prev;
      const nextParts = prev.multiParts.filter((_, i) => i !== index);
      return { ...prev, multiParts: nextParts };
    });
  }

  function handleMultiPartChange(index: number, key: keyof MultiPartFormPart, value: string) {
    setQuestionForm((prev) => {
      const nextParts = [...prev.multiParts];
      nextParts[index] = { ...nextParts[index], [key]: value };
      return { ...prev, multiParts: nextParts };
    });
  }

  function handleImageSelect(file?: File | null) {
    if (!file) {
      setQuestionForm((prev) => ({ ...prev, imagePreview: '' }));
      return;
    }
    const preview = URL.createObjectURL(file);
    setQuestionForm((prev) => ({ ...prev, imagePreview: preview }));
  }

  function handleMultiPartImageSelect(index: number, file?: File | null) {
    if (!file) {
      handleMultiPartChange(index, 'imagePreview', '');
      return;
    }
    const preview = URL.createObjectURL(file);
    handleMultiPartChange(index, 'imagePreview', preview);
  }

  async function handleCreateQuestion(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmittingQuestion(true);

    try {
      const payload: CreateQuestionPayload = {
        prompt: questionForm.prompt.trim(),
        question_type: questionForm.question_type,
        difficulty: questionForm.difficulty,
        clues: parseLines(questionForm.cluesInput),
        tag_names: lowercaseUnique(selectedTags),
      };

      if (questionForm.imagePreview) {
        payload.image_url = questionForm.imagePreview;
      }

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
      } else if (questionForm.question_type === 'open_ended') {
        payload.correct_answers = parseLines(questionForm.correctAnswersInput);
        if ((payload.correct_answers?.length ?? 0) === 0) {
          throw new Error('Add at least one accepted answer.');
        }
      } else {
        const parts: TriviaMultiPart[] = questionForm.multiParts.map((part) => ({
          prompt: part.prompt.trim(),
          correct_answers: parseLines(part.answersInput),
          image_url: part.imagePreview || null,
        }));

        if (parts.length < 2 || parts.length > 4) {
          throw new Error('Multi-part questions need 2 to 4 parts.');
        }

        if (parts.some((part) => part.prompt.length < 3)) {
          throw new Error('Each part needs a prompt of at least 3 characters.');
        }

        if (parts.some((part) => (part.correct_answers?.length ?? 0) === 0)) {
          throw new Error('Each part needs at least one accepted answer.');
        }

        payload.multi_parts = parts;
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

      setQuestionForm({
        prompt: '',
        question_type: questionForm.question_type,
        difficulty: 3,
        cluesInput: '',
        choices: ['', ''],
        correct_choice_index: 0,
        correctAnswersInput: '',
        tagInput: '',
        imagePreview: '',
        multiParts: defaultMultiParts,
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
        <div className="space-y-2">
          <label className={labelClass}>
            Prompt <span className="text-red-500" aria-hidden>*</span>
          </label>
          <textarea
            required
            value={questionForm.prompt}
            onChange={(event) => setQuestionForm((prev) => ({ ...prev, prompt: event.target.value }))}
            className={inputClass}
            placeholder="Enter the trivia question prompt"
            rows={3}
          />
        </div>

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

        <div className="space-y-2">
          <label className={labelClass}>Question image</label>
          <div className="flex items-center gap-3">
            <input
              type="file"
              accept="image/*"
              onChange={(event) => handleImageSelect(event.target.files?.[0])}
              className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-700 dark:text-gray-200"
            />
            {questionForm.imagePreview && (
              <Button type="button" variant="ghost" size="sm" onClick={() => handleImageSelect(null)}>
                Remove
              </Button>
            )}
          </div>
          {questionForm.imagePreview && (
            <img
              src={questionForm.imagePreview}
              alt="Question preview"
              className="h-28 w-full rounded-lg object-cover"
            />
          )}
          <p className="text-sm text-gray-500 dark:text-gray-400">Images will be uploaded to storage later; a placeholder URL is stored for now.</p>
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

        {questionForm.question_type === 'open_ended' && (
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

        {questionForm.question_type === 'multi_part' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className={labelClass}>
                  Parts <span className="text-red-500" aria-hidden>*</span>
                </label>
                <p className={helperClass}>Each part can include text answers and an optional image (min 2, max 4).</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleAddMultiPart} disabled={questionForm.multiParts.length >= 4}>
                Add part
              </Button>
            </div>
            <div className="space-y-3">
              {questionForm.multiParts.map((part, index) => (
                <div key={index} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-2">
                      <label className="text-base font-semibold text-gray-800 dark:text-gray-100">
                        Part {index + 1} <span className="text-red-500" aria-hidden>*</span>
                      </label>
                      <input
                        value={part.prompt}
                        onChange={(event) => handleMultiPartChange(index, 'prompt', event.target.value)}
                        className={inputClass}
                        placeholder="Enter the part prompt"
                      />
                      <label className="text-base font-semibold text-gray-800 dark:text-gray-100">
                        Accepted answers <span className="text-red-500" aria-hidden>*</span>
                      </label>
                      <textarea
                        value={part.answersInput}
                        onChange={(event) => handleMultiPartChange(index, 'answersInput', event.target.value)}
                        className={inputClass}
                        placeholder="Accepted answers (one per line)"
                        rows={3}
                      />
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-800 dark:text-gray-100">Part image</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(event) => handleMultiPartImageSelect(index, event.target.files?.[0])}
                            className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-700 dark:text-gray-200"
                          />
                          {part.imagePreview && (
                            <Button type="button" variant="ghost" size="sm" onClick={() => handleMultiPartImageSelect(index, null)}>
                              Remove
                            </Button>
                          )}
                        </div>
                        {part.imagePreview && (
                          <img src={part.imagePreview} alt={`Part ${index + 1} preview`} className="h-24 w-full rounded-lg object-cover" />
                        )}
                      </div>
                    </div>
                    {questionForm.multiParts.length > 2 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveMultiPart(index)}>
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
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
    </GenericCard>
  );
}
