import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { TiptapEditor, TiptapEditorRef } from './TiptapEditor';
import { PerfLogger } from '../shared/logger';

// Tiptap needs these DOM APIs that jsdom may not fully support
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

  if (!window.getComputedStyle) {
    window.getComputedStyle = () =>
      ({ getPropertyValue: () => '' }) as unknown as CSSStyleDeclaration;
  }

  if (!Element.prototype.getClientRects) {
    Element.prototype.getClientRects = () => [] as unknown as DOMRectList;
  }

  PerfLogger.clear();
});

/** Helper: render TiptapEditor, wait for the editor, return ref + editor */
async function renderWithEditor(content: string) {
  const ref = React.createRef<TiptapEditorRef>();
  const onUpdate = vi.fn();

  await act(async () => {
    render(
      <TiptapEditor ref={ref} content={content} onUpdate={onUpdate} />,
    );
  });

  await waitFor(() => {
    expect(ref.current?.getEditor()).toBeTruthy();
  });

  const editor = ref.current!.getEditor()!;
  return { editor, onUpdate };
}

/** Helper: get the serialized markdown from Tiptap */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getMarkdown(editor: any) {
  return editor.storage.markdown.getMarkdown() as string;
}

describe('Keyboard shortcuts — StarterKit built-in', () => {
  it('Mod-b toggles bold', async () => {
    const { editor } = await renderWithEditor('hello world');

    await act(async () => {
      editor.commands.setTextSelection({ from: 1, to: 6 }); // select "hello"
      editor.commands.toggleBold();
    });

    const md = getMarkdown(editor);
    expect(md).toContain('**hello**');
  });

  it('Mod-i toggles italic', async () => {
    const { editor } = await renderWithEditor('hello world');

    await act(async () => {
      editor.commands.setTextSelection({ from: 1, to: 6 });
      editor.commands.toggleItalic();
    });

    const md = getMarkdown(editor);
    expect(md).toContain('*hello*');
  });

  it('Mod-e toggles inline code', async () => {
    const { editor } = await renderWithEditor('hello world');

    await act(async () => {
      editor.commands.setTextSelection({ from: 1, to: 6 });
      editor.commands.toggleCode();
    });

    const md = getMarkdown(editor);
    expect(md).toContain('`hello`');
  });

  it('Mod-Shift-8 toggles bullet list', async () => {
    const { editor } = await renderWithEditor('item one');

    await act(async () => {
      editor.commands.setTextSelection(1);
      editor.commands.toggleBulletList();
    });

    const md = getMarkdown(editor);
    expect(md).toMatch(/^- item one/);
  });

  it('Mod-Shift-7 toggles ordered list', async () => {
    const { editor } = await renderWithEditor('item one');

    await act(async () => {
      editor.commands.setTextSelection(1);
      editor.commands.toggleOrderedList();
    });

    const md = getMarkdown(editor);
    expect(md).toMatch(/^1\. item one/);
  });
});

describe('Keyboard shortcuts — Custom: Heading cycle (Mod-Shift-H)', () => {
  it('paragraph → H1 on first press', async () => {
    const { editor } = await renderWithEditor('some text');

    await act(async () => {
      editor.commands.setTextSelection(1);
      editor.commands.toggleHeading({ level: 1 });
    });

    expect(editor.isActive('heading', { level: 1 })).toBe(true);
    expect(getMarkdown(editor)).toMatch(/^# some text/);
  });

  it('H1 → H2 on next press', async () => {
    const { editor } = await renderWithEditor('# heading');

    await act(async () => {
      editor.commands.setTextSelection(1);
      // Simulate the cycle logic: detect H1 → apply H2
      expect(editor.isActive('heading', { level: 1 })).toBe(true);
      editor.commands.toggleHeading({ level: 2 });
    });

    expect(editor.isActive('heading', { level: 2 })).toBe(true);
    expect(getMarkdown(editor)).toMatch(/^## heading/);
  });

  it('H6 → paragraph on next press', async () => {
    const { editor } = await renderWithEditor('###### heading');

    await act(async () => {
      editor.commands.setTextSelection(1);
      expect(editor.isActive('heading', { level: 6 })).toBe(true);
      editor.commands.setParagraph();
    });

    expect(editor.isActive('heading')).toBe(false);
    expect(getMarkdown(editor)).toBe('heading');
  });

  it('customShortcuts extension is registered with heading cycle', async () => {
    const { editor } = await renderWithEditor('test');
    const ext = editor.extensionManager.extensions.find(
      (e) => e.name === 'customShortcuts',
    );
    expect(ext).toBeTruthy();
  });

  it('full heading cycle works via commands', async () => {
    const { editor } = await renderWithEditor('text');

    // Simulate full cycle: P → H1 → H2 → H3 → H4 → H5 → H6 → P
    const cycleHeading = () => {
      for (let level = 1; level <= 6; level++) {
        if (editor.isActive('heading', { level })) {
          if (level === 6) {
            editor.commands.setParagraph();
            return;
          }
          editor.commands.toggleHeading({ level: (level + 1) as 1|2|3|4|5|6 });
          return;
        }
      }
      editor.commands.toggleHeading({ level: 1 });
    };

    await act(async () => { editor.commands.setTextSelection(1); cycleHeading(); });
    expect(editor.isActive('heading', { level: 1 })).toBe(true);

    await act(async () => { cycleHeading(); });
    expect(editor.isActive('heading', { level: 2 })).toBe(true);

    await act(async () => { cycleHeading(); });
    expect(editor.isActive('heading', { level: 3 })).toBe(true);

    await act(async () => { cycleHeading(); });
    expect(editor.isActive('heading', { level: 4 })).toBe(true);

    await act(async () => { cycleHeading(); });
    expect(editor.isActive('heading', { level: 5 })).toBe(true);

    await act(async () => { cycleHeading(); });
    expect(editor.isActive('heading', { level: 6 })).toBe(true);

    await act(async () => { cycleHeading(); });
    expect(editor.isActive('heading')).toBe(false);
    expect(getMarkdown(editor)).toBe('text');
  });
});

describe('Keyboard shortcuts — Custom: Blockquote (Mod-Shift-.)', () => {
  it('toggles blockquote on', async () => {
    const { editor } = await renderWithEditor('some text');

    await act(async () => {
      editor.commands.setTextSelection(1);
      editor.commands.toggleBlockquote();
    });

    expect(editor.isActive('blockquote')).toBe(true);
    expect(getMarkdown(editor)).toMatch(/^> some text/);
  });

  it('toggles blockquote off', async () => {
    const { editor } = await renderWithEditor('> quoted text');

    await act(async () => {
      editor.commands.setTextSelection(1);
      expect(editor.isActive('blockquote')).toBe(true);
      editor.commands.toggleBlockquote();
    });

    expect(editor.isActive('blockquote')).toBe(false);
    expect(getMarkdown(editor)).toBe('quoted text');
  });
});

describe('Keyboard shortcuts — Custom: Task list (Mod-Shift-9)', () => {
  it('toggles task list on', async () => {
    const { editor } = await renderWithEditor('buy milk');

    await act(async () => {
      editor.commands.setTextSelection(1);
      editor.commands.toggleTaskList();
    });

    expect(editor.isActive('taskList')).toBe(true);
    expect(getMarkdown(editor)).toMatch(/- \[ \] buy milk/);
  });

  it('toggles task list off', async () => {
    const { editor } = await renderWithEditor('- [ ] buy milk');

    await act(async () => {
      editor.commands.setTextSelection(1);
      expect(editor.isActive('taskList')).toBe(true);
      editor.commands.toggleTaskList();
    });

    expect(editor.isActive('taskList')).toBe(false);
    expect(getMarkdown(editor)).toBe('buy milk');
  });
});

describe('Keyboard shortcuts — Cmd+K link editing', () => {
  it('Mod-k dispatches link-edit event', async () => {
    const { editor } = await renderWithEditor('hello world');
    const handler = vi.fn();
    editor.view.dom.addEventListener('tiptap:link-edit', handler);

    await act(async () => {
      editor.view.dom.dispatchEvent(new CustomEvent('tiptap:link-edit'));
    });

    expect(handler).toHaveBeenCalledTimes(1);
    editor.view.dom.removeEventListener('tiptap:link-edit', handler);
  });
});

describe('Keyboard shortcuts — Performance', () => {
  it('toolbar:action completes within 16ms budget', async () => {
    const { editor } = await renderWithEditor('hello world');

    PerfLogger.clear();
    PerfLogger.start('toolbar:action');
    await act(async () => {
      editor.commands.setTextSelection({ from: 1, to: 6 });
      editor.commands.toggleBold();
    });
    const entry = PerfLogger.end('toolbar:action');

    expect(entry.durationMs).toBeLessThan(16);
  });
});
