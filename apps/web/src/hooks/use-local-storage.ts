import { useState, useEffect } from 'react';

// Utility for non-react usage
export function getStorageItem(key: string): string | null {
    if (typeof window === 'undefined') return null;
    try {
        return localStorage.getItem(key);
    } catch (e) {
        console.error('Error reading localStorage', e);
        return null;
    }
}

export function setStorageItem(key: string, value: string): void {
    console.log('Setting localStorage item (utility):', { key, value });
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(key, value);
    } catch (e) {
        console.error('Error writing localStorage', e);
    }
}

// Hook for React usage
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
    const [storedValue, setStoredValue] = useState<T>(() => {
        console.log('Getting localStorage item (hook):', { key });
        if (typeof window === 'undefined') return initialValue;
        try {
            const item = localStorage.getItem(key);
            console.log('Got localStorage item (hook):', { key, item });
            if (typeof initialValue === 'string' || initialValue === null) {
                return item || initialValue;
            }
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.error(error);
            return initialValue;
        }
    });

    const setValue = (value: T | ((val: T) => T)) => {
        console.log('Setting localStorage item (hook):', { key, value });
        try {
            const valueToStore =
                value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            if (typeof window !== 'undefined') {
                localStorage.setItem(key, JSON.stringify(valueToStore));
            }
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === key && e.newValue) {
                setStoredValue(JSON.parse(e.newValue));
            }
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, [key]);

    return [storedValue, setValue];
}
