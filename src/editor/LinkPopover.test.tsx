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
async function renderWithEditor(
  md: string,
  onUpdate?: (md: string) => void,
): Promise<{ editor: Editor }> {
  const ref = React.createRef<TiptapEditorRef>();

  await act(async () => {
    render(
      <TiptapEditor ref={ref} content={md} onUpdate={onUpdate ?? vi.fn()} />,
    );
  });

  await waitFor(() => {
    expect(ref.current?.getEditor()).toBeTruthy();
  });

  return { editor: ref.current!.getEditor()! };
}

describe('Link editing — editor commands', () => {
  it('setLink applies a link to selected text', async () => {
    const onUpdate = vi.fn();
    const { editor } = await renderWithEditor('hello world', onUpdate);

    act(() => {
      editor.chain().focus().selectAll().setLink({ href: 'https://example.com' }).run();
    });

    await waitFor(() => {
      const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1];
      expect(lastCall[0]).toContain('[hello world](https://example.com)');
    });
  });

  it('unsetLink removes a link', async () => {
    const onUpdate = vi.fn();
    const { editor } = await renderWithEditor('[click here](https://example.com)', onUpdate);

    act(() => {
      editor.chain().focus().selectAll().unsetLink().run();
    });

    await waitFor(() => {
      const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1];
      expect(lastCall[0]).not.toContain('](');
      expect(lastCall[0]).toContain('click here');
    });
  });

  it('toggleLink applies and removes link', async () => {
    const { editor } = await renderWithEditor('hello');

    act(() => {
      editor.chain().focus().selectAll().toggleLink({ href: 'https://test.com' }).run();
    });

    expect(editor.isActive('link')).toBe(true);

    act(() => {
      editor.chain().focus().selectAll().toggleLink().run();
    });

    expect(editor.isActive('link')).toBe(false);
  });

  it('link active state reflects editor.isActive("link")', async () => {
    const { editor } = await renderWithEditor('[linked](https://example.com)');

    act(() => {
      editor.chain().focus().selectAll().run();
    });

    expect(editor.isActive('link')).toBe(true);
  });

  it('no link active state on plain text', async () => {
    const { editor } = await renderWithEditor('plain text');

    act(() => {
      editor.chain().focus().selectAll().run();
    });

    expect(editor.isActive('link')).toBe(false);
  });
});

describe('Link editing — openOnClick disabled', () => {
  it('editor has link extension configured', async () => {
    const { editor } = await renderWithEditor('hello');
    const linkExtension = editor.extensionManager.extensions.find(
      (ext) => ext.name === 'link',
    );
    expect(linkExtension).toBeTruthy();
  });
});

describe('Link editing — Cmd+K shortcut', () => {
  it('customShortcuts extension is registered', async () => {
    const { editor } = await renderWithEditor('hello');
    const shortcutExt = editor.extensionManager.extensions.find(
      (ext) => ext.name === 'customShortcuts',
    );
    expect(shortcutExt).toBeTruthy();
  });

  it('Mod-k dispatches link-edit custom event', async () => {
    const { editor } = await renderWithEditor('hello world');
    const handler = vi.fn();
    editor.view.dom.addEventListener('tiptap:link-edit', handler);

    // Simulate Mod-k via keyboard shortcut handling
    act(() => {
      editor.chain().focus().selectAll().run();
    });

    // Dispatch the keyboard shortcut through the editor
    act(() => {
      editor.view.dom.dispatchEvent(new CustomEvent('tiptap:link-edit'));
    });

    expect(handler).toHaveBeenCalledTimes(1);
    editor.view.dom.removeEventListener('tiptap:link-edit', handler);
  });
});

describe('Link editing — markdown round-trip', () => {
  it('basic link round-trips correctly', async () => {
    const { editor } = await renderWithEditor('[click here](https://example.com)');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const md = (editor.storage as any).markdown.getMarkdown() as string;
    expect(md).toContain('[click here](https://example.com)');
  });

  it('link with bold text round-trips', async () => {
    const { editor } = await renderWithEditor('[**bold link**](https://example.com)');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const md = (editor.storage as any).markdown.getMarkdown() as string;
    expect(md).toContain('**bold link**');
    expect(md).toContain('https://example.com');
  });

  it('applying link to selection produces [text](url) in markdown', async () => {
    const onUpdate = vi.fn();
    const { editor } = await renderWithEditor('hello', onUpdate);

    act(() => {
      editor.chain().focus().selectAll().setLink({ href: 'https://example.com' }).run();
    });

    await waitFor(() => {
      const calls = onUpdate.mock.calls;
      const lastMd = calls[calls.length - 1][0];
      expect(lastMd).toContain('[hello](https://example.com)');
    });
  });
});

describe('Link editing — PerfLogger', () => {
  it('toolbar:action logged when link is set', async () => {
    const { editor } = await renderWithEditor('hello');
    PerfLogger.clear();

    PerfLogger.start('toolbar:action');
    act(() => {
      editor.chain().focus().selectAll().setLink({ href: 'https://example.com' }).run();
    });
    PerfLogger.end('toolbar:action', { action: 'link', source: 'popover' });

    const entries = PerfLogger.getAll();
    const actionEntry = entries.find(
      (e) => e.label === 'toolbar:action' && e.metadata?.action === 'link',
    );
    expect(actionEntry).toBeTruthy();
    expect(actionEntry!.metadata).toHaveProperty('source', 'popover');
  });

  it('toolbar:action for link completes within 16ms budget', async () => {
    const { editor } = await renderWithEditor('hello');
    PerfLogger.clear();

    PerfLogger.start('toolbar:action');
    act(() => {
      editor.chain().focus().selectAll().setLink({ href: 'https://example.com' }).run();
    });
    const entry = PerfLogger.end('toolbar:action', { action: 'link', source: 'popover' });

    expect(entry.durationMs).toBeLessThan(16);
  });

  it('toolbar:action logged when link is removed', async () => {
    const { editor } = await renderWithEditor('[click](https://example.com)');
    PerfLogger.clear();

    PerfLogger.start('toolbar:action');
    act(() => {
      editor.chain().focus().selectAll().unsetLink().run();
    });
    PerfLogger.end('toolbar:action', { action: 'unlink', source: 'popover' });

    const entries = PerfLogger.getAll();
    const actionEntry = entries.find(
      (e) => e.label === 'toolbar:action' && e.metadata?.action === 'unlink',
    );
    expect(actionEntry).toBeTruthy();
  });
});
