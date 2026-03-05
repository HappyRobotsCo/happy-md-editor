import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { PerfLogger } from '../shared/logger';
import { autosave, restoreAutosave, clearAutosave } from './autosave-service';

describe('autosave-service', () => {
  beforeEach(() => {
    PerfLogger.clear();
  });

  afterEach(async () => {
    // Clean up IndexedDB between tests
    await clearAutosave();
  });

  describe('autosave', () => {
    it('saves content to IndexedDB', async () => {
      await autosave('# Hello', 'test.md');

      const restored = await restoreAutosave();
      expect(restored).not.toBeNull();
      expect(restored!.content).toBe('# Hello');
      expect(restored!.fileName).toBe('test.md');
      expect(restored!.timestamp).toBeGreaterThan(0);
    });

    it('overwrites previous autosave', async () => {
      await autosave('# First', 'test.md');
      await autosave('# Second', 'test.md');

      const restored = await restoreAutosave();
      expect(restored!.content).toBe('# Second');
    });

    it('saves with null fileName when no file is open', async () => {
      await autosave('# Untitled content', null);

      const restored = await restoreAutosave();
      expect(restored!.fileName).toBeNull();
      expect(restored!.content).toBe('# Untitled content');
    });

    it('logs file:autosave via PerfLogger', async () => {
      await autosave('# Content', 'doc.md');

      const entries = PerfLogger.getAll();
      const autosaveEntry = entries.find((e) => e.label === 'file:autosave');
      expect(autosaveEntry).toBeDefined();
      expect(autosaveEntry!.durationMs).toBeGreaterThanOrEqual(0);
      expect(autosaveEntry!.metadata).toMatchObject({ fileName: 'doc.md' });
      expect(autosaveEntry!.metadata).toHaveProperty('size');
    });

    it('file:autosave completes within 50ms budget', async () => {
      const content = '# Content\n'.repeat(500);
      await autosave(content, 'large.md');

      const entries = PerfLogger.getAll();
      const autosaveEntry = entries.find((e) => e.label === 'file:autosave');
      expect(autosaveEntry!.durationMs).toBeLessThan(50);
    });
  });

  describe('restoreAutosave', () => {
    it('returns null when no autosave exists', async () => {
      const result = await restoreAutosave();
      expect(result).toBeNull();
    });

    it('returns saved content after autosave', async () => {
      await autosave('# Recovered', 'recovered.md');
      PerfLogger.clear();

      const result = await restoreAutosave();
      expect(result).not.toBeNull();
      expect(result!.content).toBe('# Recovered');
      expect(result!.fileName).toBe('recovered.md');
    });

    it('logs file:restore via PerfLogger', async () => {
      await autosave('# Content', 'doc.md');
      PerfLogger.clear();

      await restoreAutosave();

      const entries = PerfLogger.getAll();
      const restoreEntry = entries.find((e) => e.label === 'file:restore');
      expect(restoreEntry).toBeDefined();
      expect(restoreEntry!.metadata).toMatchObject({ found: true });
      expect(restoreEntry!.metadata).toHaveProperty('size');
    });

    it('logs file:restore with found:false when no data', async () => {
      await restoreAutosave();

      const entries = PerfLogger.getAll();
      const restoreEntry = entries.find((e) => e.label === 'file:restore');
      expect(restoreEntry).toBeDefined();
      expect(restoreEntry!.metadata).toMatchObject({ found: false, size: 0 });
    });
  });

  describe('clearAutosave', () => {
    it('removes autosave data', async () => {
      await autosave('# Data', 'file.md');
      await clearAutosave();

      const result = await restoreAutosave();
      expect(result).toBeNull();
    });
  });
});
