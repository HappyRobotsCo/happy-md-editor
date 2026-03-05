import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { App } from './App';
import { APP_NAME } from '../shared/constants';

// Capture the onUpdate callback from TiptapEditor so tests can simulate edits
let capturedOnUpdate: ((markdown: string) => void) | null = null;

vi.mock('./TiptapEditor', () => ({
  TiptapEditor: ({
    content,
    onUpdate,
  }: {
    content: string;
    onUpdate: (md: string) => void;
    onEditorReady?: (editor: unknown) => void;
  }) => {
    capturedOnUpdate = onUpdate;
    return (
      <div aria-label="Markdown editor" data-testid="tiptap-mock">
        {content}
      </div>
    );
  },
}));

vi.mock('./Toolbar', () => ({
  Toolbar: () => null,
}));

// Mock theme-service (plain functions — vi.restoreAllMocks must not clear these)
vi.mock('./theme-service', () => ({
  initTheme: () => Promise.resolve('light' as const),
  switchTheme: () => {},
  onOSThemeChange: () => () => {},
  detectOSTheme: () => 'light' as const,
  applyTheme: () => {},
  restoreTheme: () => Promise.resolve(null),
}));

// Mock file-service
vi.mock('./file-service', () => ({
  openFile: vi.fn(),
  saveFile: vi.fn(),
  saveFileAs: vi.fn(),
}));

// Mock autosave-service
vi.mock('./autosave-service', () => ({
  autosave: vi.fn().mockResolvedValue(undefined),
  restoreAutosave: vi.fn().mockResolvedValue(null),
  clearAutosave: vi.fn().mockResolvedValue(undefined),
}));

// Mock handle-service
vi.mock('./handle-service', () => ({
  saveHandle: vi.fn().mockResolvedValue(undefined),
  restoreHandle: vi.fn().mockResolvedValue(null),
}));

import { openFile, saveFile, saveFileAs } from './file-service';
import { restoreAutosave } from './autosave-service';
import { saveHandle, restoreHandle } from './handle-service';

const mockOpenFile = openFile as ReturnType<typeof vi.fn>;
const mockSaveFile = saveFile as ReturnType<typeof vi.fn>;
const mockSaveFileAs = saveFileAs as ReturnType<typeof vi.fn>;
const mockRestoreAutosave = restoreAutosave as ReturnType<typeof vi.fn>;
const mockSaveHandle = saveHandle as ReturnType<typeof vi.fn>;
const mockRestoreHandle = restoreHandle as ReturnType<typeof vi.fn>;

function createMockFileState(content: string, name: string) {
  return {
    content,
    name,
    handle: {
      kind: 'file' as const,
      name,
      createWritable: vi.fn().mockResolvedValue({
        write: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      }),
    } as unknown as FileSystemFileHandle,
  };
}

/** Simulate Tiptap hydration callback after file open (normalizes saved baseline) */
function simulateHydration(normalizedContent: string) {
  act(() => {
    capturedOnUpdate?.(normalizedContent);
  });
}

/** Simulate a user edit via the captured TiptapEditor onUpdate callback */
function simulateEdit(newContent: string) {
  act(() => {
    capturedOnUpdate?.(newContent);
  });
}

describe('App — dirty state tracking', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.title = '';
    capturedOnUpdate = null;
    mockOpenFile.mockResolvedValue(null);
    mockSaveFile.mockResolvedValue(undefined);
    mockSaveFileAs.mockResolvedValue(null);
    mockRestoreAutosave.mockResolvedValue(null);
    mockRestoreHandle.mockResolvedValue(null);
    mockSaveHandle.mockResolvedValue(undefined);
  });

  it('sets default tab title to APP_NAME', () => {
    render(<App />);
    expect(document.title).toBe(APP_NAME);
  });

  it('shows filename in tab title after opening a file', async () => {
    const fileState = createMockFileState('# Hello', 'readme.md');
    mockOpenFile.mockResolvedValue(fileState);

    render(<App />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Open file'));
    });
    simulateHydration('# Hello');

    expect(document.title).toBe(`readme.md — ${APP_NAME}`);
  });

  it('shows * prefix in tab title when content is edited', async () => {
    const fileState = createMockFileState('# Hello', 'readme.md');
    mockOpenFile.mockResolvedValue(fileState);

    render(<App />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Open file'));
    });
    simulateHydration('# Hello');

    expect(document.title).toBe(`readme.md — ${APP_NAME}`);

    simulateEdit('# Hello World');

    expect(document.title).toBe(`* readme.md — ${APP_NAME}`);
  });

  it('shows * prefix in file name display when dirty', async () => {
    const fileState = createMockFileState('# Hello', 'readme.md');
    mockOpenFile.mockResolvedValue(fileState);

    render(<App />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Open file'));
    });
    simulateHydration('# Hello');

    simulateEdit('# Changed');

    expect(screen.getByText(/\* /)).toBeTruthy();
  });

  it('clears * prefix after saving', async () => {
    const fileState = createMockFileState('# Hello', 'readme.md');
    mockOpenFile.mockResolvedValue(fileState);
    mockSaveFile.mockResolvedValue(undefined);

    render(<App />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Open file'));
    });
    simulateHydration('# Hello');

    // Edit to make dirty
    simulateEdit('# Changed');
    expect(document.title).toBe(`* readme.md — ${APP_NAME}`);

    // Save to clear dirty
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Save file'));
    });

    expect(document.title).toBe(`readme.md — ${APP_NAME}`);
  });

  it('clears * prefix after save-as', async () => {
    const fileState = createMockFileState('# Hello', 'readme.md');
    mockOpenFile.mockResolvedValue(fileState);

    const newHandle = {
      kind: 'file' as const,
      name: 'new-file.md',
      createWritable: vi.fn(),
    } as unknown as FileSystemFileHandle;
    mockSaveFileAs.mockResolvedValue(newHandle);

    render(<App />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Open file'));
    });
    simulateHydration('# Hello');

    // Edit to make dirty
    simulateEdit('# Changed');
    expect(document.title).toBe(`* readme.md — ${APP_NAME}`);

    // Save As to clear dirty
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Save file as'));
    });

    expect(document.title).toBe(`new-file.md — ${APP_NAME}`);
  });

  it('clears dirty state when content reverts to saved version', async () => {
    const fileState = createMockFileState('# Hello', 'readme.md');
    mockOpenFile.mockResolvedValue(fileState);

    render(<App />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Open file'));
    });
    simulateHydration('# Hello');

    // Edit to make dirty
    simulateEdit('# Changed');
    expect(document.title).toBe(`* readme.md — ${APP_NAME}`);

    // Revert to original (normalized baseline from hydration)
    simulateEdit('# Hello');
    expect(document.title).toBe(`readme.md — ${APP_NAME}`);
  });

  it('clears dirty state when opening a new file', async () => {
    const fileState1 = createMockFileState('# First', 'first.md');
    const fileState2 = createMockFileState('# Second', 'second.md');
    mockOpenFile.mockResolvedValueOnce(fileState1);

    render(<App />);

    // Open first file
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Open file'));
    });
    simulateHydration('# First');

    // Edit to make dirty
    simulateEdit('# Changed');
    expect(document.title).toBe(`* first.md — ${APP_NAME}`);

    // Open second file
    mockOpenFile.mockResolvedValueOnce(fileState2);
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Open file'));
    });
    simulateHydration('# Second');

    expect(document.title).toBe(`second.md — ${APP_NAME}`);
  });

  it('registers beforeunload handler when dirty', async () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const fileState = createMockFileState('# Hello', 'readme.md');
    mockOpenFile.mockResolvedValue(fileState);

    render(<App />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Open file'));
    });
    simulateHydration('# Hello');

    simulateEdit('# Changed');

    const beforeUnloadCalls = addSpy.mock.calls.filter(
      ([event]) => event === 'beforeunload',
    );
    expect(beforeUnloadCalls.length).toBeGreaterThan(0);
  });

  it('beforeunload handler calls preventDefault', async () => {
    const fileState = createMockFileState('# Hello', 'readme.md');
    mockOpenFile.mockResolvedValue(fileState);

    render(<App />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Open file'));
    });
    simulateHydration('# Hello');

    simulateEdit('# Changed');

    const event = new Event('beforeunload', { cancelable: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    window.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('does not register beforeunload when not dirty', () => {
    render(<App />);

    const event = new Event('beforeunload', { cancelable: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    window.dispatchEvent(event);

    expect(preventDefaultSpy).not.toHaveBeenCalled();
  });

  it('removes beforeunload handler after saving', async () => {
    const fileState = createMockFileState('# Hello', 'readme.md');
    mockOpenFile.mockResolvedValue(fileState);
    mockSaveFile.mockResolvedValue(undefined);

    render(<App />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Open file'));
    });
    simulateHydration('# Hello');

    // Make dirty
    simulateEdit('# Changed');

    // Verify beforeunload is active
    let event = new Event('beforeunload', { cancelable: true });
    let spy = vi.spyOn(event, 'preventDefault');
    window.dispatchEvent(event);
    expect(spy).toHaveBeenCalled();

    // Save to clear dirty
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Save file'));
    });

    // Verify beforeunload is no longer active
    event = new Event('beforeunload', { cancelable: true });
    spy = vi.spyOn(event, 'preventDefault');
    window.dispatchEvent(event);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('App — crash recovery', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.title = '';
    capturedOnUpdate = null;
    mockOpenFile.mockResolvedValue(null);
    mockSaveFile.mockResolvedValue(undefined);
    mockSaveFileAs.mockResolvedValue(null);
    mockRestoreAutosave.mockResolvedValue(null);
    mockRestoreHandle.mockResolvedValue(null);
    mockSaveHandle.mockResolvedValue(undefined);
  });

  it('recovers auto-saved content on mount', async () => {
    mockRestoreAutosave.mockResolvedValue({
      content: '# Recovered content',
      fileName: 'lost.md',
      timestamp: Date.now(),
    });

    await act(async () => {
      render(<App />);
    });

    const editor = screen.getByLabelText('Markdown editor');
    expect(editor).toBeTruthy();
    // TiptapEditor mock receives content as a prop and renders it as text
    expect(editor.textContent).toBe('# Recovered content');
  });

  it('shows editor when recovery data exists (no file open)', async () => {
    mockRestoreAutosave.mockResolvedValue({
      content: '# Recovered',
      fileName: null,
      timestamp: Date.now(),
    });

    await act(async () => {
      render(<App />);
    });

    // Should show the editor, not the placeholder
    expect(screen.getByLabelText('Markdown editor')).toBeTruthy();
    expect(screen.queryByText(/Open a markdown file/)).toBeNull();
  });

  it('marks content as dirty after recovery', async () => {
    mockRestoreAutosave.mockResolvedValue({
      content: '# Recovered',
      fileName: null,
      timestamp: Date.now(),
    });

    await act(async () => {
      render(<App />);
    });

    expect(document.title).toBe(`* ${APP_NAME}`);
  });

  it('shows placeholder when no recovery data', async () => {
    mockRestoreAutosave.mockResolvedValue(null);

    await act(async () => {
      render(<App />);
    });

    expect(screen.getByText(/Open a markdown file/)).toBeTruthy();
  });
});

describe('App — handle restoration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.title = '';
    capturedOnUpdate = null;
    mockOpenFile.mockResolvedValue(null);
    mockSaveFile.mockResolvedValue(undefined);
    mockSaveFileAs.mockResolvedValue(null);
    mockRestoreAutosave.mockResolvedValue(null);
    mockRestoreHandle.mockResolvedValue(null);
    mockSaveHandle.mockResolvedValue(undefined);
  });

  it('restores file from handle on mount', async () => {
    const handle = {
      kind: 'file' as const,
      name: 'restored.md',
      getFile: vi.fn().mockResolvedValue({
        name: 'restored.md',
        text: vi.fn().mockResolvedValue('# Restored from handle'),
        size: 23,
      }),
      createWritable: vi.fn(),
      queryPermission: vi.fn().mockResolvedValue('granted'),
      requestPermission: vi.fn().mockResolvedValue('granted'),
    } as unknown as FileSystemFileHandle;

    mockRestoreHandle.mockResolvedValue({
      handle,
      fileName: 'restored.md',
      timestamp: Date.now(),
    });

    await act(async () => {
      render(<App />);
    });
    simulateHydration('# Restored from handle');

    const editor = screen.getByLabelText('Markdown editor');
    expect(editor.textContent).toBe('# Restored from handle');
    expect(document.title).toBe(`restored.md — ${APP_NAME}`);
  });

  it('does not mark content as dirty after handle restore', async () => {
    const handle = {
      kind: 'file' as const,
      name: 'clean.md',
      getFile: vi.fn().mockResolvedValue({
        name: 'clean.md',
        text: vi.fn().mockResolvedValue('# Clean'),
        size: 7,
      }),
      createWritable: vi.fn(),
      queryPermission: vi.fn().mockResolvedValue('granted'),
      requestPermission: vi.fn().mockResolvedValue('granted'),
    } as unknown as FileSystemFileHandle;

    mockRestoreHandle.mockResolvedValue({
      handle,
      fileName: 'clean.md',
      timestamp: Date.now(),
    });

    await act(async () => {
      render(<App />);
    });
    simulateHydration('# Clean');

    // Should NOT have * prefix — file is freshly loaded from disk
    expect(document.title).toBe(`clean.md — ${APP_NAME}`);
  });

  it('falls back to autosave when handle restore returns null', async () => {
    mockRestoreHandle.mockResolvedValue(null);
    mockRestoreAutosave.mockResolvedValue({
      content: '# Fallback content',
      fileName: null,
      timestamp: Date.now(),
    });

    await act(async () => {
      render(<App />);
    });

    const editor = screen.getByLabelText('Markdown editor');
    expect(editor.textContent).toBe('# Fallback content');
    expect(document.title).toBe(`* ${APP_NAME}`);
  });

  it('falls back to autosave when handle getFile fails', async () => {
    const handle = {
      kind: 'file' as const,
      name: 'broken.md',
      getFile: vi.fn().mockRejectedValue(new Error('File not found')),
      createWritable: vi.fn(),
      queryPermission: vi.fn().mockResolvedValue('granted'),
      requestPermission: vi.fn().mockResolvedValue('granted'),
    } as unknown as FileSystemFileHandle;

    mockRestoreHandle.mockResolvedValue({
      handle,
      fileName: 'broken.md',
      timestamp: Date.now(),
    });
    mockRestoreAutosave.mockResolvedValue({
      content: '# Autosave fallback',
      fileName: null,
      timestamp: Date.now(),
    });

    await act(async () => {
      render(<App />);
    });

    const editor = screen.getByLabelText('Markdown editor');
    expect(editor.textContent).toBe('# Autosave fallback');
  });

  it('saves handle when opening a file', async () => {
    const fileState = createMockFileState('# Hello', 'readme.md');
    mockOpenFile.mockResolvedValue(fileState);

    render(<App />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Open file'));
    });
    simulateHydration('# Hello');

    expect(mockSaveHandle).toHaveBeenCalledWith(
      fileState.handle,
      'readme.md',
    );
  });

  it('saves handle when saving as', async () => {
    const fileState = createMockFileState('# Hello', 'readme.md');
    mockOpenFile.mockResolvedValue(fileState);

    const newHandle = {
      kind: 'file' as const,
      name: 'new-file.md',
      createWritable: vi.fn(),
    } as unknown as FileSystemFileHandle;
    mockSaveFileAs.mockResolvedValue(newHandle);

    render(<App />);

    // Open a file first
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Open file'));
    });
    simulateHydration('# Hello');

    // Save As
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Save file as'));
    });

    expect(mockSaveHandle).toHaveBeenCalledWith(newHandle, 'new-file.md');
  });
});

describe('App — file↔Tiptap round-trip wiring (Task 3.5)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.title = '';
    capturedOnUpdate = null;
    mockOpenFile.mockResolvedValue(null);
    mockSaveFile.mockResolvedValue(undefined);
    mockSaveFileAs.mockResolvedValue(null);
    mockRestoreAutosave.mockResolvedValue(null);
    mockRestoreHandle.mockResolvedValue(null);
    mockSaveHandle.mockResolvedValue(undefined);
  });

  it('hydration callback updates saved baseline (no false dirty)', async () => {
    // Simulate Tiptap normalizing whitespace during hydration
    const fileState = createMockFileState('# Hello\n\n\n', 'readme.md');
    mockOpenFile.mockResolvedValue(fileState);

    render(<App />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Open file'));
    });

    // Tiptap normalizes trailing newlines
    simulateHydration('# Hello');

    // Should NOT be dirty — hydration updated the baseline
    expect(document.title).toBe(`readme.md — ${APP_NAME}`);
  });

  it('saves Tiptap-serialized content (not raw file bytes)', async () => {
    const fileState = createMockFileState('# Hello\n\n\n', 'readme.md');
    mockOpenFile.mockResolvedValue(fileState);
    mockSaveFile.mockResolvedValue(undefined);

    render(<App />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Open file'));
    });

    // Tiptap normalizes trailing newlines during hydration
    simulateHydration('# Hello');

    // Save — should write the Tiptap-normalized content
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Save file'));
    });

    expect(mockSaveFile).toHaveBeenCalledWith(fileState.handle, '# Hello');
  });

  it('editing after hydration correctly tracks dirty state', async () => {
    const fileState = createMockFileState('# Hello', 'readme.md');
    mockOpenFile.mockResolvedValue(fileState);

    render(<App />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Open file'));
    });
    simulateHydration('# Hello');

    // Not dirty yet
    expect(document.title).toBe(`readme.md — ${APP_NAME}`);

    // User edits
    simulateEdit('# Hello World');
    expect(document.title).toBe(`* readme.md — ${APP_NAME}`);

    // Revert to hydrated baseline
    simulateEdit('# Hello');
    expect(document.title).toBe(`readme.md — ${APP_NAME}`);
  });

  it('opening a second file resets hydration baseline', async () => {
    const fileState1 = createMockFileState('# First', 'first.md');
    const fileState2 = createMockFileState('# Second', 'second.md');
    mockOpenFile.mockResolvedValueOnce(fileState1);

    render(<App />);

    // Open first file
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Open file'));
    });
    simulateHydration('# First');

    // Open second file
    mockOpenFile.mockResolvedValueOnce(fileState2);
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Open file'));
    });
    simulateHydration('# Second');

    // Not dirty
    expect(document.title).toBe(`second.md — ${APP_NAME}`);

    // Edit second file
    simulateEdit('# Second edited');
    expect(document.title).toBe(`* second.md — ${APP_NAME}`);

    // Revert to second file's baseline (not first file's)
    simulateEdit('# Second');
    expect(document.title).toBe(`second.md — ${APP_NAME}`);
  });

  it('hydration does not trigger autosave', async () => {
    vi.useFakeTimers();
    const { autosave: mockAutosave } = await import('./autosave-service');
    const mockAutosaveFn = mockAutosave as ReturnType<typeof vi.fn>;
    mockAutosaveFn.mockClear();

    const fileState = createMockFileState('# Hello', 'readme.md');
    mockOpenFile.mockResolvedValue(fileState);

    render(<App />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Open file'));
    });
    simulateHydration('# Hello');

    // Advance past autosave debounce
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    // Autosave should NOT have been called — hydration is not a user edit
    expect(mockAutosaveFn).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
});
