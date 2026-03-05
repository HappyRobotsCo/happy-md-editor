import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PerfLogger } from '../shared/logger';
import { openFile, saveFile, saveFileAs } from './file-service';

function createMockFile(content: string, name: string) {
  return {
    text: vi.fn().mockResolvedValue(content),
    name,
    size: new Blob([content]).size,
    type: 'text/markdown',
  };
}

function createMockHandle(name: string, content: string) {
  const mockFile = createMockFile(content, name);
  return {
    getFile: vi.fn().mockResolvedValue(mockFile),
    kind: 'file' as const,
    name,
    createWritable: vi.fn().mockResolvedValue({
      write: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    }),
  } as unknown as FileSystemFileHandle;
}

describe('file-service', () => {
  beforeEach(() => {
    PerfLogger.clear();
    vi.restoreAllMocks();
  });

  describe('openFile', () => {
    it('opens a file and returns content with FileState', async () => {
      const mockHandle = createMockHandle('test.md', '# Hello World');
      vi.stubGlobal(
        'showOpenFilePicker',
        vi.fn().mockResolvedValue([mockHandle]),
      );

      const result = await openFile();

      expect(result).not.toBeNull();
      expect(result!.content).toBe('# Hello World');
      expect(result!.name).toBe('test.md');
      expect(result!.handle).toBe(mockHandle);
    });

    it('logs file:open via PerfLogger after picker resolves', async () => {
      const mockHandle = createMockHandle('doc.md', 'content');
      vi.stubGlobal(
        'showOpenFilePicker',
        vi.fn().mockResolvedValue([mockHandle]),
      );

      await openFile();

      const entries = PerfLogger.getAll();
      expect(entries).toHaveLength(1);
      expect(entries[0].label).toBe('file:open');
      expect(entries[0].durationMs).toBeGreaterThanOrEqual(0);
      expect(entries[0].metadata).toMatchObject({ name: 'doc.md' });
      expect(entries[0].metadata).toHaveProperty('size');
    });

    it('returns null when user cancels picker', async () => {
      const abortError = new DOMException(
        'The user aborted a request.',
        'AbortError',
      );
      vi.stubGlobal(
        'showOpenFilePicker',
        vi.fn().mockRejectedValue(abortError),
      );

      const result = await openFile();
      expect(result).toBeNull();
    });

    it('does NOT log a PerfLogger entry when user cancels picker', async () => {
      const abortError = new DOMException(
        'The user aborted a request.',
        'AbortError',
      );
      vi.stubGlobal(
        'showOpenFilePicker',
        vi.fn().mockRejectedValue(abortError),
      );

      await openFile();

      const entries = PerfLogger.getAll();
      expect(entries).toHaveLength(0);
    });

    it('re-throws non-abort errors', async () => {
      const networkError = new Error('Network error');
      vi.stubGlobal(
        'showOpenFilePicker',
        vi.fn().mockRejectedValue(networkError),
      );

      await expect(openFile()).rejects.toThrow('Network error');
    });

    it('file:open completes within 100ms budget for small files', async () => {
      const smallContent = '# Small file\n'.repeat(100);
      const mockHandle = createMockHandle('small.md', smallContent);
      vi.stubGlobal(
        'showOpenFilePicker',
        vi.fn().mockResolvedValue([mockHandle]),
      );

      await openFile();

      const entries = PerfLogger.getAll();
      expect(entries[0].label).toBe('file:open');
      expect(entries[0].durationMs).toBeLessThan(100);
    });
  });

  describe('saveFile', () => {
    it('saves content to existing file handle', async () => {
      const mockHandle = createMockHandle('test.md', '');
      const mockWritable = {
        write: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      };
      (mockHandle.createWritable as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockWritable,
      );

      await saveFile(mockHandle, '# Updated content');

      expect(mockHandle.createWritable).toHaveBeenCalled();
      expect(mockWritable.write).toHaveBeenCalledWith('# Updated content');
      expect(mockWritable.close).toHaveBeenCalled();
    });

    it('logs file:save via PerfLogger', async () => {
      const mockHandle = createMockHandle('test.md', '');

      await saveFile(mockHandle, '# Content');

      const entries = PerfLogger.getAll();
      expect(entries).toHaveLength(1);
      expect(entries[0].label).toBe('file:save');
      expect(entries[0].durationMs).toBeGreaterThanOrEqual(0);
      expect(entries[0].metadata).toHaveProperty('size');
    });

    it('file:save completes within 100ms budget', async () => {
      const mockHandle = createMockHandle('test.md', '');
      const content = '# Content\n'.repeat(500);

      await saveFile(mockHandle, content);

      const entries = PerfLogger.getAll();
      expect(entries[0].label).toBe('file:save');
      expect(entries[0].durationMs).toBeLessThan(100);
    });
  });

  describe('saveFileAs', () => {
    it('opens save picker and writes content to new file', async () => {
      const mockWritable = {
        write: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      };
      const mockHandle = {
        kind: 'file' as const,
        name: 'new-file.md',
        createWritable: vi.fn().mockResolvedValue(mockWritable),
      } as unknown as FileSystemFileHandle;

      vi.stubGlobal(
        'showSaveFilePicker',
        vi.fn().mockResolvedValue(mockHandle),
      );

      const result = await saveFileAs('# New content', 'suggested.md');

      expect(result).toBe(mockHandle);
      expect(mockWritable.write).toHaveBeenCalledWith('# New content');
      expect(mockWritable.close).toHaveBeenCalled();
    });

    it('returns null when user cancels save picker', async () => {
      const abortError = new DOMException(
        'The user aborted a request.',
        'AbortError',
      );
      vi.stubGlobal(
        'showSaveFilePicker',
        vi.fn().mockRejectedValue(abortError),
      );

      const result = await saveFileAs('content');
      expect(result).toBeNull();
    });

    it('does NOT log a PerfLogger entry when user cancels save picker', async () => {
      const abortError = new DOMException(
        'The user aborted a request.',
        'AbortError',
      );
      vi.stubGlobal(
        'showSaveFilePicker',
        vi.fn().mockRejectedValue(abortError),
      );

      await saveFileAs('content');

      const entries = PerfLogger.getAll();
      expect(entries).toHaveLength(0);
    });

    it('logs file:save with saveAs flag via PerfLogger', async () => {
      const mockHandle = {
        kind: 'file' as const,
        name: 'new-file.md',
        createWritable: vi.fn().mockResolvedValue({
          write: vi.fn().mockResolvedValue(undefined),
          close: vi.fn().mockResolvedValue(undefined),
        }),
      } as unknown as FileSystemFileHandle;

      vi.stubGlobal(
        'showSaveFilePicker',
        vi.fn().mockResolvedValue(mockHandle),
      );

      await saveFileAs('# Content');

      const entries = PerfLogger.getAll();
      expect(entries).toHaveLength(1);
      expect(entries[0].label).toBe('file:save');
      expect(entries[0].metadata).toMatchObject({ saveAs: true });
      expect(entries[0].metadata).toHaveProperty('size');
    });

    it('file:save-as completes within 100ms budget', async () => {
      const mockHandle = {
        kind: 'file' as const,
        name: 'new-file.md',
        createWritable: vi.fn().mockResolvedValue({
          write: vi.fn().mockResolvedValue(undefined),
          close: vi.fn().mockResolvedValue(undefined),
        }),
      } as unknown as FileSystemFileHandle;

      vi.stubGlobal(
        'showSaveFilePicker',
        vi.fn().mockResolvedValue(mockHandle),
      );

      const content = '# Content\n'.repeat(500);
      await saveFileAs(content);

      const entries = PerfLogger.getAll();
      expect(entries[0].label).toBe('file:save');
      expect(entries[0].durationMs).toBeLessThan(100);
    });

    it('re-throws non-abort errors from save picker', async () => {
      const error = new Error('Disk full');
      vi.stubGlobal(
        'showSaveFilePicker',
        vi.fn().mockRejectedValue(error),
      );

      await expect(saveFileAs('content')).rejects.toThrow('Disk full');
    });

    it('uses suggested name when provided', async () => {
      const mockPicker = vi.fn().mockResolvedValue({
        kind: 'file' as const,
        name: 'my-doc.md',
        createWritable: vi.fn().mockResolvedValue({
          write: vi.fn().mockResolvedValue(undefined),
          close: vi.fn().mockResolvedValue(undefined),
        }),
      });

      vi.stubGlobal('showSaveFilePicker', mockPicker);

      await saveFileAs('content', 'my-doc.md');

      expect(mockPicker).toHaveBeenCalledWith(
        expect.objectContaining({ suggestedName: 'my-doc.md' }),
      );
    });

    it('defaults suggested name to untitled.md', async () => {
      const mockPicker = vi.fn().mockResolvedValue({
        kind: 'file' as const,
        name: 'untitled.md',
        createWritable: vi.fn().mockResolvedValue({
          write: vi.fn().mockResolvedValue(undefined),
          close: vi.fn().mockResolvedValue(undefined),
        }),
      });

      vi.stubGlobal('showSaveFilePicker', mockPicker);

      await saveFileAs('content');

      expect(mockPicker).toHaveBeenCalledWith(
        expect.objectContaining({ suggestedName: 'untitled.md' }),
      );
    });
  });
});
