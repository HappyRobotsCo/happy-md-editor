import { PerfLogger } from '../shared/logger';
import { THEME_STORAGE_KEY, type Theme, THEMES } from '../shared/constants';
import { hasChromeStorage } from '../shared/storage-utils';

export async function saveTheme(theme: Theme): Promise<void> {
  if (hasChromeStorage()) {
    await chrome.storage.local.set({ [THEME_STORAGE_KEY]: theme });
  } else {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }
}

export async function restoreTheme(): Promise<Theme | null> {
  if (hasChromeStorage()) {
    const result = await chrome.storage.local.get(THEME_STORAGE_KEY);
    const value = result[THEME_STORAGE_KEY];
    if (THEMES.includes(value as Theme)) {
      return value as Theme;
    }
    return null;
  }

  const value = localStorage.getItem(THEME_STORAGE_KEY);
  if (value && THEMES.includes(value as Theme)) {
    return value as Theme;
  }
  return null;
}

function hasMatchMedia(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function';
}

export function detectOSTheme(): Theme {
  if (!hasMatchMedia()) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
}

export async function initTheme(): Promise<Theme> {
  PerfLogger.start('theme:init');
  const saved = await restoreTheme();
  const theme = saved ?? detectOSTheme();
  applyTheme(theme);
  PerfLogger.end('theme:init', { theme, source: saved ? 'storage' : 'os' });
  return theme;
}

export function switchTheme(theme: Theme): void {
  PerfLogger.start('theme:switch');
  applyTheme(theme);
  saveTheme(theme);
  PerfLogger.end('theme:switch', { theme });
}

export function onOSThemeChange(callback: (theme: Theme) => void): () => void {
  if (!hasMatchMedia()) return () => {};
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (e: MediaQueryListEvent) => {
    callback(e.matches ? 'dark' : 'light');
  };
  mql.addEventListener('change', handler);
  return () => mql.removeEventListener('change', handler);
}
