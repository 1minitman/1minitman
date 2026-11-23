import { useCallback, useEffect, useState } from 'react';

export type ThemeSetting = 'system' | 'light' | 'dark';
const STORAGE_KEY = 'mm-theme';

// Storage can throw (private mode, blocked cookies): fall back to System.
const read = (): ThemeSetting => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
};

const apply = (setting: ThemeSetting) => {
  const root = document.documentElement;
  if (setting === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', setting);
};

/** Call once before the app renders so the first paint already has the right theme. */
export const initTheme = () => apply(read());

export const useTheme = () => {
  const [theme, setThemeState] = useState<ThemeSetting>(read);
  useEffect(() => apply(theme), [theme]);
  const setTheme = useCallback((next: ThemeSetting) => {
    try {
      if (next === 'system') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not saved; still applied for this visit.
    }
    setThemeState(next);
  }, []);
  return { theme, setTheme };
};
