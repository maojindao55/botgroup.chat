import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

type Theme = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
  } catch {}
  return 'system';
}

function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

// Simple external store for cross-component sync
let currentTheme: Theme = getStoredTheme();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Theme {
  return currentTheme;
}

function setThemeValue(theme: Theme) {
  currentTheme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {}
  const resolved = theme === 'system' ? getSystemTheme() : theme;
  applyTheme(resolved);
  listeners.forEach((l) => l());
}

// Apply theme on module load to avoid flash
applyTheme(currentTheme === 'system' ? getSystemTheme() : currentTheme);

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot);

  const resolvedTheme: ResolvedTheme = useMemo(
    () => (theme === 'system' ? getSystemTheme() : theme),
    [theme],
  );

  const setTheme = useCallback((t: Theme) => {
    setThemeValue(t);
  }, []);

  // Listen for system theme changes when in 'system' mode
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (currentTheme === 'system') {
        applyTheme(getSystemTheme());
        listeners.forEach((l) => l());
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return { theme, resolvedTheme, setTheme };
}
