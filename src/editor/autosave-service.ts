import { PerfLogger } from '../shared/logger';
import { openDB, AUTOSAVE_STORE } from './db';

const AUTOSAVE_KEY = 'current';

export interface AutosaveEntry {
  content: string;
  fileName: string | null;
  timestamp: number;
}

export async function autosave(
  content: string,
  fileName: string | null,
): Promise<void> {
  PerfLogger.start('file:autosave');
  const db = await openDB();
  const entry: AutosaveEntry = {
    content,
    fileName,
    timestamp: Date.now(),
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(AUTOSAVE_STORE, 'readwrite');
    const store = tx.objectStore(AUTOSAVE_STORE);
    store.put(entry, AUTOSAVE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  db.close();
  PerfLogger.end('file:autosave', {
    size: new Blob([content]).size,
    fileName,
  });
}

export async function restoreAutosave(): Promise<AutosaveEntry | null> {
  PerfLogger.start('file:restore');

  let db: IDBDatabase;
  try {
    db = await openDB();
  } catch {
    PerfLogger.end('file:restore', { found: false, error: 'db-open-failed' });
    return null;
  }

  const entry = await new Promise<AutosaveEntry | null>((resolve, reject) => {
    const tx = db.transaction(AUTOSAVE_STORE, 'readonly');
    const store = tx.objectStore(AUTOSAVE_STORE);
    const request = store.get(AUTOSAVE_KEY);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });

  db.close();
  PerfLogger.end('file:restore', {
    found: entry !== null,
    size: entry ? new Blob([entry.content]).size : 0,
  });

  return entry;
}

export async function clearAutosave(): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(AUTOSAVE_STORE, 'readwrite');
    const store = tx.objectStore(AUTOSAVE_STORE);
    store.delete(AUTOSAVE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
