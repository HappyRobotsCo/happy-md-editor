import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { PerfLogger } from '../shared/logger';

// Capture callbacks from mocked components
let capturedOnUpdate: ((markdown: string) => void) | null = null;

// Build a shared mock editor with storage.markdown.getMarkdown
let mockEditorContent = '';
const mockEditor = {
  storage: {
    markdown: {
      getMarkdown: () => mockEditorContent,
    },
  },
};

vi.mock('./TiptapEditor', () => ({
  TiptapEditor: ({
    content,
    onUpdate,
    onEditorReady,
  }: {
    content: string;
    onUpdate: (md: string) => void;
    onEditorReady?: (editor: unknown) => void;
  }) => {
    capturedOnUpdate = onUpdate;
    mockEditorContent = content;
    // Call onEditorReady in a microtask so React can process the render
    if (onEditorReady) {
      // Use queueMicrotask for fastest async delivery
      queueMicrotask(() => onEditorReady(mockEditor));
    }
    return (
      <div aria-label="Markdown editor" data-testid="tiptap-mock">
        {content}
      </div>
    );
  },
}));

vi.mock('./Toolbar', () => ({
  Toolbar: () => <div data-testid="toolbar-mock" />,
}));

// Mock SourceEditor — must be a forwardRef to accept refs
const MockSourceEditor = React.forwardRef(function MockSourceEditor(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  props: any,
  ref: React.Ref<unknown>,
) {
  const { content, onReady } = props;
  React.useImperativeHandle(ref, () => ({
    getView: () => ({
      state: {
        doc: {
          toString: () => content,
        },
      },
    }),
  }));
  React.useEffect(() => {
    onReady?.();
  }, [onReady]);
  return (
    <div aria-label="Markdown source editor" data-testid="source-mock">
      {content}
    </div>
  );
});

vi.mock('./SourceEditor', () => ({
  SourceEditor: MockSourceEditor,
}));

// Mock PreviewPane — must be a forwardRef
const MockPreviewPane = React.forwardRef(function MockPreviewPane(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  props: any,
  ref: React.Ref<unknown>,
) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  React.useImperativeHandle(ref, () => ({
    getContainer: () => containerRef.current,
  }));
  return (
    <div ref={containerRef} aria-label="Markdown preview" data-testid="preview-mock">
      {props.markdown}
    </div>
  );
});

vi.mock('./PreviewPane', () => ({
  PreviewPane: MockPreviewPane,
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

vi.mock('./file-service', () => ({
  openFile: vi.fn(),
  saveFile: vi.fn(),
  saveFileAs: vi.fn(),
}));

vi.mock('./autosave-service', () => ({
  autosave: vi.fn().mockResolvedValue(undefined),
  restoreAutosave: vi.fn().mockResolvedValue(null),
  clearAutosave: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./handle-service', () => ({
  saveHandle: vi.fn().mockResolvedValue(undefined),
  restoreHandle: vi.fn().mockResolvedValue(null),
}));

vi.mock('./mode-service', () => ({
  saveMode: vi.fn().mockResolvedValue(undefined),
  restoreMode: vi.fn().mockResolvedValue(null),
}));

vi.mock('./scroll-sync', () => ({
  setupScrollSync: vi.fn().mockReturnValue({ destroy: vi.fn() }),
}));

import { App } from './App';
import { openFile } from './file-service';
import { restoreHandle } from './handle-service';
import { restoreAutosave } from './autosave-service';
import { saveMode, restoreMode } from './mode-service';

const mockOpenFile = openFile as ReturnType<typeof vi.fn>;
const mockRestoreHandle = restoreHandle as ReturnType<typeof vi.fn>;
const mockRestoreAutosave = restoreAutosave as ReturnType<typeof vi.fn>;
const mockSaveMode = saveMode as ReturnType<typeof vi.fn>;
const mockRestoreMode = restoreMode as ReturnType<typeof vi.fn>;

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

function simulateHydration(normalizedContent: string) {
  act(() => {
    capturedOnUpdate?.(normalizedContent);
  });
}

async function openFileInApp(content: string, name: string) {
  const fileState = createMockFileState(content, name);
  mockOpenFile.mockResolvedValue(fileState);

  await act(async () => {
    fireEvent.click(screen.getByLabelText('Open file'));
  });
  // Wait for onEditorReady microtask + state update
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50));
  });
  simulateHydration(content);
  // Wait again to ensure all state updates are flushed
  await act(async () => {
    await new Promise((r) => setTimeout(r, 10));
  });
  return fileState;
}

describe('Mode Switching', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.title = '';
    capturedOnUpdate = null;
    mockEditorContent = '';
    PerfLogger.clear();
    mockOpenFile.mockResolvedValue(null);
    mockRestoreHandle.mockResolvedValue(null);
    mockRestoreAutosave.mockResolvedValue(null);
    mockSaveMode.mockResolvedValue(undefined);
    mockRestoreMode.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders mode switcher buttons', async () => {
    await act(async () => {
      render(<App />);
    });

    expect(screen.getByLabelText('WYSIWYG mode')).toBeTruthy();
    expect(screen.getByLabelText('Split mode')).toBeTruthy();
    expect(screen.getByLabelText('Source mode')).toBeTruthy();
  });

  it('WYSIWYG mode is active by default', async () => {
    await act(async () => {
      render(<App />);
    });

    const btn = screen.getByLabelText('WYSIWYG mode');
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('shows Tiptap editor in WYSIWYG mode', async () => {
    await act(async () => {
      render(<App />);
    });
    await openFileInApp('# Hello', 'test.md');

    expect(screen.getByTestId('tiptap-mock')).toBeTruthy();
  });

  it('switches to split mode showing source and preview', async () => {
    await act(async () => {
      render(<App />);
    });
    await openFileInApp('# Hello', 'test.md');

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Split mode'));
    });
    // Allow Suspense to resolve
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(screen.getByTestId('source-mock')).toBeTruthy();
    expect(screen.getByTestId('preview-mock')).toBeTruthy();
  });

  it('switches to source-only mode', async () => {
    await act(async () => {
      render(<App />);
    });
    await openFileInApp('# Hello', 'test.md');

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Source mode'));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(screen.getByTestId('source-mock')).toBeTruthy();
    expect(screen.queryByTestId('preview-mock')).toBeNull();
  });

  it('active mode button is visually distinct', async () => {
    await act(async () => {
      render(<App />);
    });

    expect(screen.getByLabelText('WYSIWYG mode').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByLabelText('Split mode').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByLabelText('Source mode').getAttribute('aria-pressed')).toBe('false');
  });

  it('Cmd+\\ cycles through modes', async () => {
    await act(async () => {
      render(<App />);
    });
    await openFileInApp('# Hello', 'test.md');

    // WYSIWYG → Split
    await act(async () => {
      fireEvent.keyDown(document, { key: '\\', metaKey: true });
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(screen.getByLabelText('Split mode').getAttribute('aria-pressed')).toBe('true');

    // Split → Source
    await act(async () => {
      fireEvent.keyDown(document, { key: '\\', metaKey: true });
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(screen.getByLabelText('Source mode').getAttribute('aria-pressed')).toBe('true');

    // Source → WYSIWYG
    await act(async () => {
      fireEvent.keyDown(document, { key: '\\', metaKey: true });
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(screen.getByLabelText('WYSIWYG mode').getAttribute('aria-pressed')).toBe('true');
  });

  it('persists mode preference via saveMode', async () => {
    await act(async () => {
      render(<App />);
    });

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Source mode'));
    });

    expect(mockSaveMode).toHaveBeenCalledWith('source');
  });

  it('restores mode preference from restoreMode', async () => {
    mockRestoreMode.mockResolvedValue('source');

    await act(async () => {
      render(<App />);
    });
    // Wait for restoreMode promise
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    await openFileInApp('# Hello', 'test.md');

    expect(screen.getByLabelText('Source mode').getAttribute('aria-pressed')).toBe('true');
  });

  it('hides formatting toolbar in source mode', async () => {
    await act(async () => {
      render(<App />);
    });
    await openFileInApp('# Hello', 'test.md');

    // Toolbar visible in WYSIWYG
    expect(screen.getByTestId('toolbar-mock')).toBeTruthy();

    // Switch to source
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Source mode'));
    });

    expect(screen.queryByTestId('toolbar-mock')).toBeNull();
  });

  it('logs mode:switch via PerfLogger', async () => {
    await act(async () => {
      render(<App />);
    });
    await openFileInApp('# Hello', 'test.md');

    PerfLogger.clear();

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Split mode'));
    });

    const entries = PerfLogger.getAll().filter((e) => e.label === 'mode:switch');
    expect(entries.length).toBeGreaterThanOrEqual(1);
    expect(entries[0].metadata?.direction).toBe('wysiwyg→split');
  });

  it('mode:switch completes within 300ms budget', async () => {
    await act(async () => {
      render(<App />);
    });
    await openFileInApp('# Hello', 'test.md');

    PerfLogger.clear();

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Split mode'));
    });

    const entries = PerfLogger.getAll().filter((e) => e.label === 'mode:switch');
    expect(entries.length).toBeGreaterThanOrEqual(1);
    expect(entries[0].durationMs).toBeLessThan(300);
  });

  it('logs mode:serialize when switching WYSIWYG → source', async () => {
    await act(async () => {
      render(<App />);
    });
    await openFileInApp('# Hello', 'test.md');

    PerfLogger.clear();

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Source mode'));
    });

    const entries = PerfLogger.getAll().filter((e) => e.label === 'mode:serialize');
    expect(entries.length).toBeGreaterThanOrEqual(1);
    expect(entries[0].metadata?.direction).toBe('wysiwyg→source');
  });

  it('content survives WYSIWYG → Source → WYSIWYG round-trip', async () => {
    await act(async () => {
      render(<App />);
    });
    await openFileInApp('# Hello World', 'test.md');

    // Switch to source
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Source mode'));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const sourceEl = screen.getByTestId('source-mock');
    expect(sourceEl.textContent).toBe('# Hello World');

    // Switch back to WYSIWYG
    await act(async () => {
      fireEvent.click(screen.getByLabelText('WYSIWYG mode'));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const tiptapEl = screen.getByTestId('tiptap-mock');
    expect(tiptapEl.textContent).toBe('# Hello World');
  });

  it('mode switcher has correct radiogroup semantics', async () => {
    await act(async () => {
      render(<App />);
    });

    const group = screen.getByRole('radiogroup');
    expect(group).toBeTruthy();
    expect(group.getAttribute('aria-label')).toBe('Editor mode');

    const radios = screen.getAllByRole('radio');
    expect(radios.length).toBe(3);
  });

  it('switching to same mode is a no-op', async () => {
    await act(async () => {
      render(<App />);
    });

    PerfLogger.clear();

    await act(async () => {
      fireEvent.click(screen.getByLabelText('WYSIWYG mode'));
    });

    const entries = PerfLogger.getAll().filter((e) => e.label === 'mode:switch');
    expect(entries.length).toBe(0);
  });
});

describe('Mode Switching — mode-service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('saveMode stores value in localStorage (fallback)', async () => {
    const { saveMode: realSave } = await vi.importActual<typeof import('./mode-service')>('./mode-service');
    await realSave('split');
    expect(localStorage.getItem('editorMode')).toBe('split');
  });

  it('restoreMode retrieves stored value', async () => {
    const { saveMode: realSave, restoreMode: realRestore } = await vi.importActual<typeof import('./mode-service')>('./mode-service');
    await realSave('source');
    const result = await realRestore();
    expect(result).toBe('source');
  });

  it('restoreMode returns null for invalid values', async () => {
    const { restoreMode: realRestore } = await vi.importActual<typeof import('./mode-service')>('./mode-service');
    localStorage.setItem('editorMode', 'invalid');
    const result = await realRestore();
    expect(result).toBeNull();
  });

  it('restoreMode returns null when no value stored', async () => {
    const { restoreMode: realRestore } = await vi.importActual<typeof import('./mode-service')>('./mode-service');
    const result = await realRestore();
    expect(result).toBeNull();
  });
});
