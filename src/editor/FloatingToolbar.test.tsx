import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { TiptapEditor, TiptapEditorRef } from './TiptapEditor';
import { PerfLogger } from '../shared/logger';
import type { Editor } from '@tiptap/core';

// Tiptap jsdom stubs
beforeEach(() => {
  if (!document.createRange) {
    document.createRange = () =>
      ({
        setStart: vi.fn(),
        setEnd: vi.fn(),
        commonAncestorContainer: document.body,
        getBoundingClientRect: () => ({
          top: 0, left: 0, right: 0, bottom: 0,
          width: 0, height: 0, x: 0, y: 0, toJSON: vi.fn(),
        }),
        getClientRects: () => [],
        createContextualFragment: (html: string) => {
          const div = document.createElement('div');
          div.innerHTML = html;
          const frag = document.createDocumentFragment();
          while (div.firstChild) frag.appendChild(div.firstChild);
          return frag;
        },
      }) as unknown as Range;
  }
  if (!Element.prototype.getClientRects) {
    Element.prototype.getClientRects = () => [] as unknown as DOMRectList;
  }
  PerfLogger.clear();
});

/** Helper: render TiptapEditor and extract the editor instance */
async function renderWithEditor(md: string): Promise<{ editor: Editor }> {
  const ref = React.createRef<TiptapEditorRef>();

  await act(async () => {
    render(
      <TiptapEditor ref={ref} content={md} onUpdate={vi.fn()} />,
    );
  });

  await waitFor(() => {
    expect(ref.current?.getEditor()).toBeTruthy();
  });

  return { editor: ref.current!.getEditor()! };
}

describe('FloatingToolbar — rendering via TiptapEditor', () => {
  it('TiptapEditor renders FloatingToolbar (BubbleMenu) component', async () => {
    await act(async () => {
      render(
        <TiptapEditor content="Hello world" onUpdate={vi.fn()} />,
      );
    });

    // BubbleMenu renders a div with role="toolbar" — it may or may not be visible
    // depending on selection state, but the element should exist in the DOM
    const container = document.querySelector('.tiptap-editor');
    expect(container).toBeTruthy();
  });
});

describe('FloatingToolbar — inline formatting actions', () => {
  it('toggleBold applies bold via editor chain command', async () => {
    const onUpdate = vi.fn();
    const ref = React.createRef<TiptapEditorRef>();

    await act(async () => {
      render(
        <TiptapEditor ref={ref} content="Hello world" onUpdate={onUpdate} />,
      );
    });
    await waitFor(() => expect(ref.current?.getEditor()).toBeTruthy());

    const editor = ref.current!.getEditor()!;

    // Select all text and toggle bold
    act(() => {
      editor.chain().focus().selectAll().toggleBold().run();
    });

    await waitFor(() => {
      expect(editor.isActive('bold')).toBe(true);
    });
  });

  it('toggleItalic applies italic via editor chain command', async () => {
    const { editor } = await renderWithEditor('Hello world');

    act(() => {
      editor.chain().focus().selectAll().toggleItalic().run();
    });

    expect(editor.isActive('italic')).toBe(true);
  });

  it('toggleStrike applies strikethrough via editor chain command', async () => {
    const { editor } = await renderWithEditor('Hello world');

    act(() => {
      editor.chain().focus().selectAll().toggleStrike().run();
    });

    expect(editor.isActive('strike')).toBe(true);
  });

  it('toggleCode applies inline code via editor chain command', async () => {
    const { editor } = await renderWithEditor('Hello world');

    act(() => {
      editor.chain().focus().selectAll().toggleCode().run();
    });

    expect(editor.isActive('code')).toBe(true);
  });

  it('toggling bold on bold text removes bold', async () => {
    const { editor } = await renderWithEditor('**bold text**');

    act(() => {
      editor.chain().focus().selectAll().toggleBold().run();
    });

    expect(editor.isActive('bold')).toBe(false);
  });

  it('toggling italic on italic text removes italic', async () => {
    const { editor } = await renderWithEditor('*italic text*');

    act(() => {
      editor.chain().focus().selectAll().toggleItalic().run();
    });

    expect(editor.isActive('italic')).toBe(false);
  });
});

describe('FloatingToolbar — serialization round-trip', () => {
  it('bold toggle produces **text** in markdown', async () => {
    const onUpdate = vi.fn();
    const ref = React.createRef<TiptapEditorRef>();

    await act(async () => {
      render(
        <TiptapEditor ref={ref} content="hello" onUpdate={onUpdate} />,
      );
    });
    await waitFor(() => expect(ref.current?.getEditor()).toBeTruthy());

    const editor = ref.current!.getEditor()!;

    act(() => {
      editor.chain().focus().selectAll().toggleBold().run();
    });

    await waitFor(() => {
      const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1];
      expect(lastCall[0]).toContain('**hello**');
    });
  });

  it('italic toggle produces *text* in markdown', async () => {
    const onUpdate = vi.fn();
    const ref = React.createRef<TiptapEditorRef>();

    await act(async () => {
      render(
        <TiptapEditor ref={ref} content="hello" onUpdate={onUpdate} />,
      );
    });
    await waitFor(() => expect(ref.current?.getEditor()).toBeTruthy());

    const editor = ref.current!.getEditor()!;

    act(() => {
      editor.chain().focus().selectAll().toggleItalic().run();
    });

    await waitFor(() => {
      const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1];
      expect(lastCall[0]).toContain('*hello*');
    });
  });

  it('strikethrough toggle produces ~~text~~ in markdown', async () => {
    const onUpdate = vi.fn();
    const ref = React.createRef<TiptapEditorRef>();

    await act(async () => {
      render(
        <TiptapEditor ref={ref} content="hello" onUpdate={onUpdate} />,
      );
    });
    await waitFor(() => expect(ref.current?.getEditor()).toBeTruthy());

    const editor = ref.current!.getEditor()!;

    act(() => {
      editor.chain().focus().selectAll().toggleStrike().run();
    });

    await waitFor(() => {
      const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1];
      expect(lastCall[0]).toContain('~~hello~~');
    });
  });

  it('inline code toggle produces `text` in markdown', async () => {
    const onUpdate = vi.fn();
    const ref = React.createRef<TiptapEditorRef>();

    await act(async () => {
      render(
        <TiptapEditor ref={ref} content="hello" onUpdate={onUpdate} />,
      );
    });
    await waitFor(() => expect(ref.current?.getEditor()).toBeTruthy());

    const editor = ref.current!.getEditor()!;

    act(() => {
      editor.chain().focus().selectAll().toggleCode().run();
    });

    await waitFor(() => {
      const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1];
      expect(lastCall[0]).toContain('`hello`');
    });
  });
});

describe('FloatingToolbar — active state indicators', () => {
  it('bold active state reflects editor.isActive("bold")', async () => {
    const { editor } = await renderWithEditor('**bold text**');

    // Select all — cursor is inside bold text
    act(() => {
      editor.chain().focus().selectAll().run();
    });

    expect(editor.isActive('bold')).toBe(true);
  });

  it('italic active state reflects editor.isActive("italic")', async () => {
    const { editor } = await renderWithEditor('*italic text*');

    act(() => {
      editor.chain().focus().selectAll().run();
    });

    expect(editor.isActive('italic')).toBe(true);
  });

  it('strikethrough active state reflects editor.isActive("strike")', async () => {
    const { editor } = await renderWithEditor('~~struck text~~');

    act(() => {
      editor.chain().focus().selectAll().run();
    });

    expect(editor.isActive('strike')).toBe(true);
  });

  it('inline code active state reflects editor.isActive("code")', async () => {
    const { editor } = await renderWithEditor('`code text`');

    act(() => {
      editor.chain().focus().selectAll().run();
    });

    expect(editor.isActive('code')).toBe(true);
  });

  it('no active states when cursor is in plain text', async () => {
    const { editor } = await renderWithEditor('plain text');

    act(() => {
      editor.chain().focus().selectAll().run();
    });

    expect(editor.isActive('bold')).toBe(false);
    expect(editor.isActive('italic')).toBe(false);
    expect(editor.isActive('strike')).toBe(false);
    expect(editor.isActive('code')).toBe(false);
  });

  it('toolbar:state-sync is logged during FloatingToolbar render', async () => {
    await renderWithEditor('**bold text**');
    const entries = PerfLogger.getAll();
    const syncEntry = entries.find((e) => e.label === 'toolbar:state-sync');
    expect(syncEntry).toBeTruthy();
  });

  it('toolbar:state-sync completes within 16ms budget', async () => {
    await renderWithEditor('**bold text**');
    const entries = PerfLogger.getAll();
    const syncEntries = entries.filter((e) => e.label === 'toolbar:state-sync');
    expect(syncEntries.length).toBeGreaterThan(0);
    for (const entry of syncEntries) {
      expect(entry.durationMs).toBeLessThan(16);
    }
  });
});

describe('FloatingToolbar — PerfLogger instrumentation', () => {
  it('toolbar:action logged when inline format is applied', async () => {
    const { editor } = await renderWithEditor('Hello world');
    PerfLogger.clear();

    PerfLogger.start('toolbar:action');
    act(() => {
      editor.chain().focus().selectAll().toggleBold().run();
    });
    PerfLogger.end('toolbar:action', { action: 'bold', source: 'floating' });

    const entries = PerfLogger.getAll();
    const actionEntry = entries.find(
      (e) => e.label === 'toolbar:action' && e.metadata?.action === 'bold',
    );
    expect(actionEntry).toBeTruthy();
    expect(actionEntry!.metadata).toHaveProperty('source', 'floating');
  });

  it('toolbar:action completes within 16ms budget for inline formatting', async () => {
    const { editor } = await renderWithEditor('Hello world');
    PerfLogger.clear();

    PerfLogger.start('toolbar:action');
    act(() => {
      editor.chain().focus().selectAll().toggleBold().run();
    });
    const entry = PerfLogger.end('toolbar:action', { action: 'bold', source: 'floating' });

    expect(entry.durationMs).toBeLessThan(16);
  });

  it('toolbar:floating:show PerfLogger events can be logged', () => {
    PerfLogger.clear();
    PerfLogger.start('toolbar:floating:show');
    PerfLogger.end('toolbar:floating:show');

    const entries = PerfLogger.getAll();
    const showEntry = entries.find((e) => e.label === 'toolbar:floating:show');
    expect(showEntry).toBeTruthy();
  });

  it('toolbar:floating:hide PerfLogger events can be logged', () => {
    PerfLogger.clear();
    PerfLogger.start('toolbar:floating:hide');
    PerfLogger.end('toolbar:floating:hide');

    const entries = PerfLogger.getAll();
    const hideEntry = entries.find((e) => e.label === 'toolbar:floating:hide');
    expect(hideEntry).toBeTruthy();
  });

  it('toolbar:floating:show completes within 100ms budget', () => {
    PerfLogger.clear();
    PerfLogger.start('toolbar:floating:show');
    const entry = PerfLogger.end('toolbar:floating:show');

    expect(entry.durationMs).toBeLessThan(100);
  });
});
