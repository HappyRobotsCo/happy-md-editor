import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { TiptapEditor, TiptapEditorRef } from './TiptapEditor';
import { Toolbar } from './Toolbar';
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

describe('Toolbar — rendering', () => {
  it('renders nothing when editor is null', () => {
    const { container } = render(<Toolbar editor={null} />);
    expect(container.querySelector('.toolbar')).toBeNull();
  });

  it('renders formatting toolbar with role="toolbar"', async () => {
    const { editor } = await renderWithEditor('# Hello');
    render(<Toolbar editor={editor} />);
    expect(screen.getByRole('toolbar')).toBeTruthy();
  });

  it('renders heading picker button', async () => {
    const { editor } = await renderWithEditor('# Hello');
    render(<Toolbar editor={editor} />);
    expect(screen.getByLabelText('Heading level')).toBeTruthy();
  });

  it('renders all block-level action buttons', async () => {
    const { editor } = await renderWithEditor('Hello');
    render(<Toolbar editor={editor} />);

    expect(screen.getByLabelText('Unordered list')).toBeTruthy();
    expect(screen.getByLabelText('Ordered list')).toBeTruthy();
    expect(screen.getByLabelText('Task list')).toBeTruthy();
    expect(screen.getByLabelText('Blockquote')).toBeTruthy();
    expect(screen.getByLabelText('Code block')).toBeTruthy();
    expect(screen.getByLabelText('Horizontal rule')).toBeTruthy();
    expect(screen.getByLabelText('Insert table')).toBeTruthy();
  });

  it('all toolbar buttons have ARIA labels', async () => {
    const { editor } = await renderWithEditor('Hello');
    render(<Toolbar editor={editor} />);

    const toolbar = screen.getByRole('toolbar');
    const buttons = toolbar.querySelectorAll('button');
    buttons.forEach((btn) => {
      expect(
        btn.getAttribute('aria-label') || btn.getAttribute('aria-pressed') !== null,
      ).toBeTruthy();
    });
  });
});

describe('Toolbar — heading picker', () => {
  it('shows "Paragraph" when cursor is in paragraph', async () => {
    const { editor } = await renderWithEditor('Hello');
    render(<Toolbar editor={editor} />);
    expect(screen.getByLabelText('Heading level').textContent).toBe('Paragraph');
  });

  it('shows "H1" when cursor is in heading 1', async () => {
    const { editor } = await renderWithEditor('# Hello');
    render(<Toolbar editor={editor} />);
    expect(screen.getByLabelText('Heading level').textContent).toBe('H1');
  });

  it('opens dropdown with H1-H6 and Paragraph options', async () => {
    const { editor } = await renderWithEditor('Hello');
    render(<Toolbar editor={editor} />);

    fireEvent.click(screen.getByLabelText('Heading level'));

    expect(screen.getByRole('listbox')).toBeTruthy();
    // "Paragraph" appears both in the heading button and the dropdown
    expect(screen.getAllByText('Paragraph').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('H1')).toBeTruthy();
    expect(screen.getByText('H2')).toBeTruthy();
    expect(screen.getByText('H3')).toBeTruthy();
    expect(screen.getByText('H4')).toBeTruthy();
    expect(screen.getByText('H5')).toBeTruthy();
    expect(screen.getByText('H6')).toBeTruthy();
  });

  it('selecting H2 applies heading level 2', async () => {
    const { editor } = await renderWithEditor('Hello world');
    render(<Toolbar editor={editor} />);

    // Open heading picker
    fireEvent.click(screen.getByLabelText('Heading level'));
    // Click H2
    fireEvent.click(screen.getByText('H2'));

    expect(editor.isActive('heading', { level: 2 })).toBe(true);
  });

  it('closes dropdown after selecting heading', async () => {
    const { editor } = await renderWithEditor('Hello');
    render(<Toolbar editor={editor} />);

    fireEvent.click(screen.getByLabelText('Heading level'));
    expect(screen.getByRole('listbox')).toBeTruthy();

    fireEvent.click(screen.getByText('H3'));
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});

describe('Toolbar — list actions', () => {
  it('clicking UL button toggles bullet list', async () => {
    const { editor } = await renderWithEditor('Hello');
    render(<Toolbar editor={editor} />);

    act(() => {
      fireEvent.click(screen.getByLabelText('Unordered list'));
    });

    expect(editor.isActive('bulletList')).toBe(true);
  });

  it('clicking OL button toggles ordered list', async () => {
    const { editor } = await renderWithEditor('Hello');
    render(<Toolbar editor={editor} />);

    act(() => {
      fireEvent.click(screen.getByLabelText('Ordered list'));
    });

    expect(editor.isActive('orderedList')).toBe(true);
  });

  it('clicking Tasks button toggles task list', async () => {
    const { editor } = await renderWithEditor('Hello');
    render(<Toolbar editor={editor} />);

    act(() => {
      fireEvent.click(screen.getByLabelText('Task list'));
    });

    expect(editor.isActive('taskList')).toBe(true);
  });
});

describe('Toolbar — block element actions', () => {
  it('clicking Quote button toggles blockquote', async () => {
    const { editor } = await renderWithEditor('Hello');
    render(<Toolbar editor={editor} />);

    act(() => {
      fireEvent.click(screen.getByLabelText('Blockquote'));
    });

    expect(editor.isActive('blockquote')).toBe(true);
  });

  it('clicking Code button toggles code block', async () => {
    const { editor } = await renderWithEditor('Hello');
    render(<Toolbar editor={editor} />);

    act(() => {
      fireEvent.click(screen.getByLabelText('Code block'));
    });

    expect(editor.isActive('codeBlock')).toBe(true);
  });

  it('clicking HR button inserts horizontal rule', async () => {
    const onUpdate = vi.fn();
    const ref = React.createRef<TiptapEditorRef>();

    await act(async () => {
      render(
        <TiptapEditor ref={ref} content="Hello" onUpdate={onUpdate} />,
      );
    });
    await waitFor(() => expect(ref.current?.getEditor()).toBeTruthy());

    const ed = ref.current!.getEditor()!;
    render(<Toolbar editor={ed} />);

    act(() => {
      fireEvent.click(screen.getByLabelText('Horizontal rule'));
    });

    await waitFor(() => {
      const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1];
      expect(lastCall[0]).toContain('---');
    });
  });

  it('clicking Table button inserts a 3x3 table', async () => {
    const onUpdate = vi.fn();
    const ref = React.createRef<TiptapEditorRef>();

    await act(async () => {
      render(
        <TiptapEditor ref={ref} content="Hello" onUpdate={onUpdate} />,
      );
    });
    await waitFor(() => expect(ref.current?.getEditor()).toBeTruthy());

    const ed = ref.current!.getEditor()!;
    render(<Toolbar editor={ed} />);

    act(() => {
      fireEvent.click(screen.getByLabelText('Insert table'));
    });

    await waitFor(() => {
      const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1];
      // Table markdown has pipe characters
      expect(lastCall[0]).toContain('|');
    });
  });
});

describe('Toolbar — active state indicators', () => {
  it('bullet list button has active class when in bullet list', async () => {
    const { editor } = await renderWithEditor('- Item 1');
    render(<Toolbar editor={editor} />);

    const btn = screen.getByLabelText('Unordered list');
    expect(btn.classList.contains('active')).toBe(true);
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('ordered list button has active class when in ordered list', async () => {
    const { editor } = await renderWithEditor('1. Item 1');
    render(<Toolbar editor={editor} />);

    const btn = screen.getByLabelText('Ordered list');
    expect(btn.classList.contains('active')).toBe(true);
  });

  it('blockquote button has active class when in blockquote', async () => {
    const { editor } = await renderWithEditor('> Quote text');
    render(<Toolbar editor={editor} />);

    const btn = screen.getByLabelText('Blockquote');
    expect(btn.classList.contains('active')).toBe(true);
  });

  it('code block button has active class when in code block', async () => {
    const { editor } = await renderWithEditor('```\ncode\n```');
    render(<Toolbar editor={editor} />);

    const btn = screen.getByLabelText('Code block');
    expect(btn.classList.contains('active')).toBe(true);
  });

  it('no active class on buttons when in plain paragraph', async () => {
    const { editor } = await renderWithEditor('Plain text');
    render(<Toolbar editor={editor} />);

    expect(screen.getByLabelText('Unordered list').classList.contains('active')).toBe(false);
    expect(screen.getByLabelText('Ordered list').classList.contains('active')).toBe(false);
    expect(screen.getByLabelText('Blockquote').classList.contains('active')).toBe(false);
    expect(screen.getByLabelText('Code block').classList.contains('active')).toBe(false);
  });
});

describe('Toolbar — PerfLogger instrumentation', () => {
  it('logs toolbar:action on button click', async () => {
    const { editor } = await renderWithEditor('Hello');
    render(<Toolbar editor={editor} />);
    PerfLogger.clear();

    act(() => {
      fireEvent.click(screen.getByLabelText('Blockquote'));
    });

    const entries = PerfLogger.getAll();
    const actionEntry = entries.find((e) => e.label === 'toolbar:action');
    expect(actionEntry).toBeTruthy();
    expect(actionEntry!.metadata).toHaveProperty('action', 'blockquote');
  });

  it('toolbar:action completes within 16ms budget', async () => {
    const { editor } = await renderWithEditor('Hello');
    render(<Toolbar editor={editor} />);
    PerfLogger.clear();

    act(() => {
      fireEvent.click(screen.getByLabelText('Unordered list'));
    });

    const entries = PerfLogger.getAll();
    const actionEntry = entries.find((e) => e.label === 'toolbar:action');
    expect(actionEntry).toBeTruthy();
    expect(actionEntry!.durationMs).toBeLessThan(16);
  });

  it('logs toolbar:state-sync on render', async () => {
    const { editor } = await renderWithEditor('Hello');
    PerfLogger.clear();

    render(<Toolbar editor={editor} />);

    const entries = PerfLogger.getAll();
    const syncEntry = entries.find((e) => e.label === 'toolbar:state-sync');
    expect(syncEntry).toBeTruthy();
  });
});
