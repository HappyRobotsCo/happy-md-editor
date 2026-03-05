import type { EditorMode } from '../shared/constants';
import { MODE_STORAGE_KEY } from '../shared/constants';
import { hasChromeStorage } from '../shared/storage-utils';

export async function saveMode(mode: EditorMode): Promise<void> {
  if (hasChromeStorage()) {
    await chrome.storage.local.set({ [MODE_STORAGE_KEY]: mode });
  } else {
    localStorage.setItem(MODE_STORAGE_KEY, mode);
  }
}

export async function restoreMode(): Promise<EditorMode | null> {
  if (hasChromeStorage()) {
    const result = await chrome.storage.local.get(MODE_STORAGE_KEY);
    const value = result[MODE_STORAGE_KEY];
    if (value === 'wysiwyg' || value === 'split' || value === 'source') {
      return value;
    }
    return null;
  }

  const value = localStorage.getItem(MODE_STORAGE_KEY);
  if (value === 'wysiwyg' || value === 'split' || value === 'source') {
    return value;
  }
  return null;
}
