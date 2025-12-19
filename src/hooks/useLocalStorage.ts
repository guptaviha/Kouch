import { useEffect, useState } from 'react';

/**
 * useLocalStorage hook
 * Stores a value in localStorage and keeps state in sync.
 * Returns a readonly tuple [value, setValue].
 */
export default function useLocalStorage<T>(key: string, initialValue: T) {
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initialValue;
    } catch (e) {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (e) {
      // ignore write errors (quota, private mode)
    }
  }, [key, state]);

  return [state, setState] as const;
}
