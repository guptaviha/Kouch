"use client";

import { Button } from '@/components/ui/button';

const labelClass = 'text-base font-semibold text-gray-900 dark:text-gray-50';
const helperClass = 'text-sm text-gray-600 dark:text-gray-300';
const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-base text-gray-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:ring-blue-900';

interface GameCatalogTaxonomyInputProps {
  label: string;
  helperText?: string;
  placeholder: string;
  query: string;
  selectedValues: string[];
  suggestions: Array<{ id: number; name: string }>;
  emptyText: string;
  disabled?: boolean;
  onQueryChange: (value: string) => void;
  onAddValue: (value: string) => void;
  onRemoveValue: (value: string) => void;
}

export function GameCatalogTaxonomyInput({
  label,
  helperText,
  placeholder,
  query,
  selectedValues,
  suggestions,
  emptyText,
  disabled = false,
  onQueryChange,
  onAddValue,
  onRemoveValue,
}: GameCatalogTaxonomyInputProps) {
  const filteredSuggestions = suggestions.filter((suggestion) => !selectedValues.includes(suggestion.name));

  function handleAddCurrentValue() {
    if (!query.trim()) {
      return;
    }

    onAddValue(query);
    onQueryChange('');
  }

  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass}>{label}</label>
        {helperText && <p className={helperClass}>{helperText}</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        {selectedValues.map((value) => (
          <span
            key={value}
            className="flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/60 dark:text-blue-100"
          >
            {value}
            <button
              type="button"
              className="text-blue-700 transition hover:opacity-70 dark:text-blue-100"
              onClick={() => onRemoveValue(value)}
              disabled={disabled}
            >
              x
            </button>
          </span>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          className={`${inputClass} ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
          placeholder={placeholder}
          disabled={disabled}
        />
        <Button type="button" variant="secondary" size="sm" onClick={handleAddCurrentValue} disabled={disabled || !query.trim()}>
          Add
        </Button>
      </div>

      <div className="space-y-2 rounded-lg border border-dashed border-gray-200 p-3 dark:border-gray-700">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Suggestions</span>
        <div className="flex flex-wrap gap-2">
          {filteredSuggestions.length === 0 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">{emptyText}</span>
          )}
          {filteredSuggestions.map((suggestion) => (
            <Button
              key={suggestion.id}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onAddValue(suggestion.name)}
              disabled={disabled}
            >
              {suggestion.name}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}