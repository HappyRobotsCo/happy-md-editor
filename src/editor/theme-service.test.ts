import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PerfLogger } from '../shared/logger';
import {
  saveTheme,
  restoreTheme,
  detectOSTheme,
  applyTheme,
  initTheme,
  switchTheme,
  onOSThemeChange,
} from './theme-service';

describe('theme-service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    PerfLogger.clear();
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  describe('saveTheme / restoreTheme', () => {
    it('persists and restores light theme via localStorage', async () => {
      await saveTheme('light');
      const result = await restoreTheme();
      expect(result).toBe('light');
    });

    it('persists and restores dark theme via localStorage', async () => {
      await saveTheme('dark');
      const result = await restoreTheme();
      expect(result).toBe('dark');
    });

    it('returns null when no theme is stored', async () => {
      const result = await restoreTheme();
      expect(result).toBeNull();
    });

    it('returns null for invalid stored values', async () => {
      localStorage.setItem('themePreference', 'invalid');
      const result = await restoreTheme();
      expect(result).toBeNull();
    });
  });

  describe('detectOSTheme', () => {
    it('returns dark when OS prefers dark', () => {
      const original = window.matchMedia;
      window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
      expect(detectOSTheme()).toBe('dark');
      window.matchMedia = original;
    });

    it('returns light when OS prefers light', () => {
      const original = window.matchMedia;
      window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
      expect(detectOSTheme()).toBe('light');
      window.matchMedia = original;
    });
  });

  describe('applyTheme', () => {
    it('sets data-theme attribute on html element', () => {
      applyTheme('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('switches data-theme attribute', () => {
      applyTheme('dark');
      applyTheme('light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });
  });

  describe('initTheme', () => {
    it('uses stored theme when available', async () => {
      await saveTheme('dark');
      const theme = await initTheme();
      expect(theme).toBe('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('falls back to OS theme when no stored preference', async () => {
      const original = window.matchMedia;
      window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
      const theme = await initTheme();
      expect(theme).toBe('dark');
      window.matchMedia = original;
    });

    it('logs theme:init performance entry', async () => {
      await initTheme();
      const entries = PerfLogger.getAll();
      const initEntry = entries.find((e) => e.label === 'theme:init');
      expect(initEntry).toBeDefined();
      expect(initEntry!.durationMs).toBeLessThan(50);
    });

    it('includes source metadata in theme:init entry', async () => {
      await saveTheme('light');
      await initTheme();
      const entries = PerfLogger.getAll();
      const initEntry = entries.find((e) => e.label === 'theme:init');
      expect(initEntry!.metadata).toEqual({ theme: 'light', source: 'storage' });
    });

    it('reports os source when no stored preference', async () => {
      const original = window.matchMedia;
      window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
      await initTheme();
      const entries = PerfLogger.getAll();
      const initEntry = entries.find((e) => e.label === 'theme:init');
      expect(initEntry!.metadata).toEqual({ theme: 'light', source: 'os' });
      window.matchMedia = original;
    });
  });

  describe('switchTheme', () => {
    it('applies theme and persists it', async () => {
      switchTheme('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      const restored = await restoreTheme();
      expect(restored).toBe('dark');
    });

    it('logs theme:switch performance entry', () => {
      switchTheme('dark');
      const entries = PerfLogger.getAll();
      const switchEntry = entries.find((e) => e.label === 'theme:switch');
      expect(switchEntry).toBeDefined();
      expect(switchEntry!.durationMs).toBeLessThan(50);
    });

    it('theme:switch completes within 50ms budget', () => {
      switchTheme('dark');
      const entries = PerfLogger.getAll();
      const switchEntry = entries.find((e) => e.label === 'theme:switch');
      expect(switchEntry!.durationMs).toBeLessThan(50);
    });
  });

  describe('onOSThemeChange', () => {
    it('registers and calls listener on OS theme change', () => {
      const listeners: ((e: MediaQueryListEvent) => void)[] = [];
      const original = window.matchMedia;
      window.matchMedia = vi.fn().mockReturnValue({
        matches: false,
        addEventListener: (_: string, handler: (e: MediaQueryListEvent) => void) => {
          listeners.push(handler);
        },
        removeEventListener: vi.fn(),
      }) as unknown as typeof window.matchMedia;

      const callback = vi.fn();
      const cleanup = onOSThemeChange(callback);

      // Simulate OS switching to dark
      listeners[0]({ matches: true } as MediaQueryListEvent);
      expect(callback).toHaveBeenCalledWith('dark');

      // Simulate OS switching to light
      listeners[0]({ matches: false } as MediaQueryListEvent);
      expect(callback).toHaveBeenCalledWith('light');

      cleanup();
      window.matchMedia = original;
    });

    it('cleanup removes the listener', () => {
      const removeFn = vi.fn();
      const original = window.matchMedia;
      window.matchMedia = vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: removeFn,
      }) as unknown as typeof window.matchMedia;

      const cleanup = onOSThemeChange(vi.fn());
      cleanup();
      expect(removeFn).toHaveBeenCalled();

      window.matchMedia = original;
    });
  });
});
