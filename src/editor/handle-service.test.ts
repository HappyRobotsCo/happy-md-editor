import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PerfLogger } from '../shared/logger';

// In-memory store to simulate IndexedDB for FileHandle objects
// Real FileSystemFileHandle is structured-cloneable in Chrome,
// but fake-indexeddb cannot clone vi.fn() mock functions.
let mockStore: Record<string, unknown> = {};

vi.mock('./db', () => ({
  HANDLES_STORE: 'handles',
  openDB: vi.fn().mockImplementation(() => {
    const db = {
      transaction: (_storeName: string, _mode?: string) => {
        const tx = {
          objectStore: () => ({
            put: (value: unknown, key: string) => {
              mockStore[key] = value;
              // Trigger oncomplete asynchronously
              Promise.resolve().then(() => tx.oncomplete?.());
              return {};
            },
            get: (key: string) => {
              const req = {
                result: mockStore[key] ?? undefined,
                onsuccess: null as (() => void) | null,
                onerror: null as (() => void) | null,
              };
              Promise.resolve().then(() => req.onsuccess?.());
              return req;
            },
            delete: (key: string) => {
              delete mockStore[key];
              Promise.resolve().then(() => tx.oncomplete?.());
              return {};
            },
          }),
          oncomplete: null as (() => void) | null,
          onerror: null as (() => void) | null,
        };
        return tx;
      },
      close: vi.fn(),
    };
    return Promise.resolve(db);
  }),
}));

import { saveHandle, restoreHandle, clearHandle } from './handle-service';

function createMockHandle(
  name: string,
  permission: PermissionState = 'granted',
): FileSystemFileHandle {
  return {
    kind: 'file' as const,
    name,
    getFile: vi.fn().mockResolvedValue({
      name,
      text: vi.fn().mockResolvedValue('# Content'),
      size: 9,
    }),
    createWritable: vi.fn(),
    queryPermission: vi.fn().mockResolvedValue(permission),
    requestPermission: vi.fn().mockResolvedValue(permission),
  } as unknown as FileSystemFileHandle;
}

describe('handle-service', () => {
  beforeEach(() => {
    PerfLogger.clear();
    mockStore = {};
  });

  describe('saveHandle', () => {
    it('saves a handle to IndexedDB', async () => {
      const handle = createMockHandle('test.md');
      await saveHandle(handle, 'test.md');

      const restored = await restoreHandle();
      expect(restored).not.toBeNull();
      expect(restored!.fileName).toBe('test.md');
    });

    it('overwrites previous handle', async () => {
      const handle1 = createMockHandle('first.md');
      const handle2 = createMockHandle('second.md');

      await saveHandle(handle1, 'first.md');
      await saveHandle(handle2, 'second.md');

      const restored = await restoreHandle();
      expect(restored!.fileName).toBe('second.md');
    });
  });

  describe('restoreHandle', () => {
    it('returns null when no handle exists', async () => {
      const result = await restoreHandle();
      expect(result).toBeNull();
    });

    it('returns stored handle when permission is already granted', async () => {
      const handle = createMockHandle('test.md', 'granted');
      await saveHandle(handle, 'test.md');
      PerfLogger.clear();

      const result = await restoreHandle();
      expect(result).not.toBeNull();
      expect(result!.fileName).toBe('test.md');
      expect(handle.queryPermission).toHaveBeenCalledWith({
        mode: 'readwrite',
      });
    });

    it('requests permission when not already granted', async () => {
      const handle = createMockHandle('test.md');
      (handle.queryPermission as ReturnType<typeof vi.fn>).mockResolvedValue(
        'prompt',
      );
      (handle.requestPermission as ReturnType<typeof vi.fn>).mockResolvedValue(
        'granted',
      );

      await saveHandle(handle, 'test.md');
      PerfLogger.clear();

      const result = await restoreHandle();
      expect(result).not.toBeNull();
      expect(handle.requestPermission).toHaveBeenCalledWith({
        mode: 'readwrite',
      });
    });

    it('returns null when permission is denied', async () => {
      const handle = createMockHandle('test.md');
      (handle.queryPermission as ReturnType<typeof vi.fn>).mockResolvedValue(
        'prompt',
      );
      (handle.requestPermission as ReturnType<typeof vi.fn>).mockResolvedValue(
        'denied',
      );

      await saveHandle(handle, 'test.md');
      PerfLogger.clear();

      const result = await restoreHandle();
      expect(result).toBeNull();
    });

    it('logs file:handle-restore via PerfLogger on success', async () => {
      const handle = createMockHandle('doc.md', 'granted');
      await saveHandle(handle, 'doc.md');
      PerfLogger.clear();

      await restoreHandle();

      const entries = PerfLogger.getAll();
      const entry = entries.find((e) => e.label === 'file:handle-restore');
      expect(entry).toBeDefined();
      expect(entry!.durationMs).toBeGreaterThanOrEqual(0);
      expect(entry!.metadata).toMatchObject({
        found: true,
        fileName: 'doc.md',
        permissionGranted: true,
      });
    });

    it('logs file:handle-restore with found:false when no data', async () => {
      await restoreHandle();

      const entries = PerfLogger.getAll();
      const entry = entries.find((e) => e.label === 'file:handle-restore');
      expect(entry).toBeDefined();
      expect(entry!.metadata).toMatchObject({ found: false });
    });

    it('logs permission denied in PerfLogger metadata', async () => {
      const handle = createMockHandle('denied.md');
      (handle.queryPermission as ReturnType<typeof vi.fn>).mockResolvedValue(
        'prompt',
      );
      (handle.requestPermission as ReturnType<typeof vi.fn>).mockResolvedValue(
        'denied',
      );

      await saveHandle(handle, 'denied.md');
      PerfLogger.clear();

      await restoreHandle();

      const entries = PerfLogger.getAll();
      const entry = entries.find((e) => e.label === 'file:handle-restore');
      expect(entry!.metadata).toMatchObject({
        found: true,
        fileName: 'denied.md',
        permissionGranted: false,
      });
    });

    it('file:handle-restore completes within 200ms budget', async () => {
      const handle = createMockHandle('test.md', 'granted');
      await saveHandle(handle, 'test.md');
      PerfLogger.clear();

      await restoreHandle();

      const entries = PerfLogger.getAll();
      const entry = entries.find((e) => e.label === 'file:handle-restore');
      expect(entry!.durationMs).toBeLessThan(200);
    });
  });

  describe('clearHandle', () => {
    it('removes stored handle', async () => {
      const handle = createMockHandle('test.md');
      await saveHandle(handle, 'test.md');
      await clearHandle();

      PerfLogger.clear();
      const result = await restoreHandle();
      expect(result).toBeNull();
    });
  });
});
