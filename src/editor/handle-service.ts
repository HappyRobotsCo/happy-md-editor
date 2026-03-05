import { PerfLogger } from '../shared/logger';
import { openDB, HANDLES_STORE } from './db';

const HANDLE_KEY = 'lastFile';

export interface StoredHandle {
  handle: FileSystemFileHandle;
  fileName: string;
  timestamp: number;
}

export async function saveHandle(
  handle: FileSystemFileHandle,
  fileName: string,
): Promise<void> {
  const db = await openDB();
  const entry: StoredHandle = {
    handle,
    fileName,
    timestamp: Date.now(),
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(HANDLES_STORE, 'readwrite');
    const store = tx.objectStore(HANDLES_STORE);
    store.put(entry, HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  db.close();
}

export async function restoreHandle(): Promise<StoredHandle | null> {
  PerfLogger.start('file:handle-restore');

  let db: IDBDatabase;
  try {
    db = await openDB();
  } catch {
    PerfLogger.end('file:handle-restore', {
      found: false,
      error: 'db-open-failed',
    });
    return null;
  }

  const entry = await new Promise<StoredHandle | null>((resolve, reject) => {
    const tx = db.transaction(HANDLES_STORE, 'readonly');
    const store = tx.objectStore(HANDLES_STORE);
    const request = store.get(HANDLE_KEY);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });

  db.close();

  if (!entry) {
    PerfLogger.end('file:handle-restore', { found: false });
    return null;
  }

  // Re-grant permission on the restored handle
  const permission = await entry.handle.queryPermission({ mode: 'readwrite' });
  if (permission === 'granted') {
    PerfLogger.end('file:handle-restore', {
      found: true,
      fileName: entry.fileName,
      permissionGranted: true,
    });
    return entry;
  }

  const requested = await entry.handle.requestPermission({ mode: 'readwrite' });
  if (requested === 'granted') {
    PerfLogger.end('file:handle-restore', {
      found: true,
      fileName: entry.fileName,
      permissionGranted: true,
      permissionRequested: true,
    });
    return entry;
  }

  // User denied permission
  PerfLogger.end('file:handle-restore', {
    found: true,
    fileName: entry.fileName,
    permissionGranted: false,
  });
  return null;
}

export async function clearHandle(): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(HANDLES_STORE, 'readwrite');
    const store = tx.objectStore(HANDLES_STORE);
    store.delete(HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
