import { PerfLogger } from '../shared/logger';
import { SUPPORTED_EXTENSIONS } from '../shared/constants';

export interface FileState {
  content: string;
  name: string;
  handle: FileSystemFileHandle | null;
}

const fileTypes: FilePickerAcceptType[] = [
  {
    description: 'Markdown files',
    accept: {
      'text/markdown': SUPPORTED_EXTENSIONS.map(
        (ext) => ext as `.${string}`,
      ),
    },
  },
];

export async function openFile(): Promise<FileState | null> {
  let handle: FileSystemFileHandle;
  try {
    [handle] = await window.showOpenFilePicker({
      types: fileTypes,
      multiple: false,
    });
  } catch (err) {
    // User cancelled the picker — no PerfLogger entry
    if (err instanceof DOMException && err.name === 'AbortError') {
      return null;
    }
    throw err;
  }

  // Start timing AFTER picker resolves (measures I/O, not user interaction)
  PerfLogger.start('file:open');
  const file = await handle.getFile();
  const content = await file.text();
  const result: FileState = {
    content,
    name: file.name,
    handle,
  };
  PerfLogger.end('file:open', { size: file.size, name: file.name });
  return result;
}

export async function saveFile(
  handle: FileSystemFileHandle | null,
  content: string,
): Promise<void> {
  if (!handle) throw new Error('No file handle — use Save As instead');
  PerfLogger.start('file:save');
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
  PerfLogger.end('file:save', { size: new Blob([content]).size });
}

export async function saveFileAs(
  content: string,
  suggestedName?: string,
): Promise<FileSystemFileHandle | null> {
  let handle: FileSystemFileHandle;
  try {
    handle = await window.showSaveFilePicker({
      types: fileTypes,
      suggestedName: suggestedName ?? 'untitled.md',
    });
  } catch (err) {
    // User cancelled the picker
    if (err instanceof DOMException && err.name === 'AbortError') {
      return null;
    }
    throw err;
  }

  PerfLogger.start('file:save');
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
  PerfLogger.end('file:save', { size: new Blob([content]).size, saveAs: true });
  return handle;
}
