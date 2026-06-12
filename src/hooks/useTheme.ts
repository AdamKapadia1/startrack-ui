import { useState, useEffect } from 'react';

export type Theme = 'dark' | 'light';
const KEY = 'startrack-theme';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(KEY) as Theme | null;
    const resolved = saved ?? 'dark';
    document.documentElement.setAttribute('data-theme', resolved);
    return resolved;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(KEY, theme);
  }, [theme]);

  function toggleTheme() {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'));
  }

  return { theme, toggleTheme };
}
