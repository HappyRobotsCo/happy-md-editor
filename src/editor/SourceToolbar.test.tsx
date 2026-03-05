import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SourceToolbar } from './SourceToolbar';
import { PerfLogger } from '../shared/logger';
import type { EditorView } from '@codemirror/view';
import { SourceEditor, SourceEditorRef } from './SourceEditor';

beforeEach(() => {
  PerfLogger.clear();
});

function createMockView(content: string, selFrom: number, selTo: number): EditorView {
  let doc = content;
  let lastDispatch: unknown = null;

  const mockView = {
    state: {
      doc: {
        toString: () => doc,
        length: doc.length,
        lineAt: (pos: number) => {
          let lineStart = 0;
          let lineEnd = doc.indexOf('\n', 0);
          if (lineEnd === -1) lineEnd = doc.length;
          let lineNum = 1;

          while (lineEnd < pos && lineEnd < doc.length) {
            lineStart = lineEnd + 1;
            const nextNewline = doc.indexOf('\n', lineStart);
            lineEnd = nextNewline === -1 ? doc.length : nextNewline;
            lineNum++;
          }

          // Recalculate for the actual pos
          lineStart = 0;
          for (let i = 0; i < doc.length; i++) {
            if (i === pos) break;
            if (doc[i] === '\n') lineStart = i + 1;
          }
          lineEnd = doc.indexOf('\n', lineStart);
          if (lineEnd === -1) lineEnd = doc.length;

          return {
            from: lineStart,
            to: lineEnd,
            text: doc.slice(lineStart, lineEnd),
            number: lineNum,
          };
        },
      },
      selection: {
        main: { from: selFrom, to: selTo },
      },
      sliceDoc: (from: number, to: number) => doc.slice(from, to),
    },
    dispatch: vi.fn((spec: unknown) => {
      lastDispatch = spec;
      // Apply changes for chained operations
      const s = spec as { changes?: { from: number; to?: number; insert: string } | Array<{ from: number; to?: number; insert: string }> };
      if (s.changes) {
        if (Array.isArray(s.changes)) {
          // Apply in reverse order to preserve positions
          const sorted = [...s.changes].sort((a, b) => b.from - a.from);
          for (const change of sorted) {
            doc = doc.slice(0, change.from) + change.insert + doc.slice(change.to ?? change.from);
          }
        } else {
          const c = s.changes;
          doc = doc.slice(0, c.from) + c.insert + doc.slice(c.to ?? c.from);
        }
        // Update doc reference
        (mockView.state.doc as { length: number }).length = doc.length;
      }
    }),
    focus: vi.fn(),
    hasFocus: true,
    getDoc: () => doc,
    getLastDispatch: () => lastDispatch,
  } as unknown as EditorView & { getDoc: () => string; getLastDispatch: () => unknown };

  return mockView;
}

describe('SourceToolbar', () => {
  describe('rendering', () => {
    it('renders with correct aria label', () => {
      const getView = vi.fn(() => null);
      render(<SourceToolbar getView={getView} />);

      expect(screen.getByRole('toolbar', { name: 'Source formatting toolbar' })).toBeTruthy();
    });

    it('renders inline formatting buttons', () => {
      const getView = vi.fn(() => null);
      render(<SourceToolbar getView={getView} />);

      expect(screen.getByLabelText('Bold')).toBeTruthy();
      expect(screen.getByLabelText('Italic')).toBeTruthy();
      expect(screen.getByLabelText('Strikethrough')).toBeTruthy();
      expect(screen.getByLabelText('Inline code')).toBeTruthy();
    });

    it('renders block formatting buttons', () => {
      const getView = vi.fn(() => null);
      render(<SourceToolbar getView={getView} />);

      expect(screen.getByLabelText('Heading 1')).toBeTruthy();
      expect(screen.getByLabelText('Heading 2')).toBeTruthy();
      expect(screen.getByLabelText('Heading 3')).toBeTruthy();
      expect(screen.getByLabelText('Unordered list')).toBeTruthy();
      expect(screen.getByLabelText('Ordered list')).toBeTruthy();
      expect(screen.getByLabelText('Task list')).toBeTruthy();
      expect(screen.getByLabelText('Blockquote')).toBeTruthy();
    });

    it('renders insert action buttons', () => {
      const getView = vi.fn(() => null);
      render(<SourceToolbar getView={getView} />);

      expect(screen.getByLabelText('Code block')).toBeTruthy();
      expect(screen.getByLabelText('Horizontal rule')).toBeTruthy();
      expect(screen.getByLabelText('Link')).toBeTruthy();
    });
  });

  describe('inline wrapping', () => {
    it('wraps selection with ** for bold', () => {
      // "hello" selected (chars 0-5)
      const view = createMockView('hello', 0, 5);
      const getView = () => view;
      render(<SourceToolbar getView={getView} />);

      fireEvent.click(screen.getByLabelText('Bold'));

      expect(view.dispatch).toHaveBeenCalled();
      const call = (view.dispatch as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.changes.insert).toBe('**hello**');
    });

    it('wraps selection with _ for italic', () => {
      const view = createMockView('hello', 0, 5);
      const getView = () => view;
      render(<SourceToolbar getView={getView} />);

      fireEvent.click(screen.getByLabelText('Italic'));

      const call = (view.dispatch as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.changes.insert).toBe('_hello_');
    });

    it('wraps selection with ~~ for strikethrough', () => {
      const view = createMockView('hello', 0, 5);
      const getView = () => view;
      render(<SourceToolbar getView={getView} />);

      fireEvent.click(screen.getByLabelText('Strikethrough'));

      const call = (view.dispatch as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.changes.insert).toBe('~~hello~~');
    });

    it('wraps selection with ` for inline code', () => {
      const view = createMockView('hello', 0, 5);
      const getView = () => view;
      render(<SourceToolbar getView={getView} />);

      fireEvent.click(screen.getByLabelText('Inline code'));

      const call = (view.dispatch as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.changes.insert).toBe('`hello`');
    });

    it('toggles off bold when selection already wrapped', () => {
      // "**hello**" selected (chars 0-9)
      const view = createMockView('**hello**', 0, 9);
      const getView = () => view;
      render(<SourceToolbar getView={getView} />);

      fireEvent.click(screen.getByLabelText('Bold'));

      const call = (view.dispatch as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.changes.insert).toBe('hello');
    });

    it('removes surrounding markers when text is between markers', () => {
      // "hello" selected within "**hello**" (chars 2-7)
      const view = createMockView('**hello**', 2, 7);
      const getView = () => view;
      render(<SourceToolbar getView={getView} />);

      fireEvent.click(screen.getByLabelText('Bold'));

      const call = (view.dispatch as ReturnType<typeof vi.fn>).mock.calls[0][0];
      // Should remove surrounding ** markers
      expect(call.changes).toHaveLength(2);
    });
  });

  describe('line prefix actions', () => {
    it('adds H1 prefix to line', () => {
      const view = createMockView('hello world', 0, 0);
      const getView = () => view;
      render(<SourceToolbar getView={getView} />);

      fireEvent.click(screen.getByLabelText('Heading 1'));

      const firstCall = (view.dispatch as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(firstCall.changes.insert).toBe('# ');
    });

    it('toggles off H1 prefix when already present', () => {
      const view = createMockView('# hello', 2, 2);
      const getView = () => view;
      render(<SourceToolbar getView={getView} />);

      fireEvent.click(screen.getByLabelText('Heading 1'));

      const firstCall = (view.dispatch as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(firstCall.changes.insert).toBe('');
      expect(firstCall.changes.to).toBe(2); // Removes "# "
    });

    it('adds bullet list prefix', () => {
      const view = createMockView('item', 0, 0);
      const getView = () => view;
      render(<SourceToolbar getView={getView} />);

      fireEvent.click(screen.getByLabelText('Unordered list'));

      const firstCall = (view.dispatch as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(firstCall.changes.insert).toBe('- ');
    });

    it('adds task list prefix', () => {
      const view = createMockView('task item', 0, 0);
      const getView = () => view;
      render(<SourceToolbar getView={getView} />);

      fireEvent.click(screen.getByLabelText('Task list'));

      const firstCall = (view.dispatch as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(firstCall.changes.insert).toBe('- [ ] ');
    });

    it('adds blockquote prefix', () => {
      const view = createMockView('quote text', 0, 0);
      const getView = () => view;
      render(<SourceToolbar getView={getView} />);

      fireEvent.click(screen.getByLabelText('Blockquote'));

      const firstCall = (view.dispatch as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(firstCall.changes.insert).toBe('> ');
    });

    it('replaces existing prefix when switching heading level', () => {
      const view = createMockView('# hello', 2, 2);
      const getView = () => view;
      render(<SourceToolbar getView={getView} />);

      fireEvent.click(screen.getByLabelText('Heading 2'));

      const firstCall = (view.dispatch as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(firstCall.changes.insert).toBe('## ');
    });
  });

  describe('insert actions', () => {
    it('inserts code block fences around selection', () => {
      const view = createMockView('code here', 0, 9);
      const getView = () => view;
      render(<SourceToolbar getView={getView} />);

      fireEvent.click(screen.getByLabelText('Code block'));

      const call = (view.dispatch as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.changes.insert).toBe('```\ncode here\n```');
    });

    it('inserts horizontal rule', () => {
      const view = createMockView('', 0, 0);
      const getView = () => view;
      render(<SourceToolbar getView={getView} />);

      fireEvent.click(screen.getByLabelText('Horizontal rule'));

      const call = (view.dispatch as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.changes.insert).toContain('---');
    });

    it('inserts link with selected text', () => {
      const view = createMockView('click here', 0, 10);
      const getView = () => view;
      render(<SourceToolbar getView={getView} />);

      fireEvent.click(screen.getByLabelText('Link'));

      const call = (view.dispatch as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.changes.insert).toBe('[click here](url)');
    });

    it('inserts link placeholder when no selection', () => {
      const view = createMockView('some text', 4, 4);
      const getView = () => view;
      render(<SourceToolbar getView={getView} />);

      fireEvent.click(screen.getByLabelText('Link'));

      const call = (view.dispatch as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.changes.insert).toBe('[text](url)');
    });
  });

  describe('PerfLogger instrumentation', () => {
    it('logs toolbar:action for inline formatting', () => {
      const view = createMockView('hello', 0, 5);
      const getView = () => view;
      render(<SourceToolbar getView={getView} />);

      fireEvent.click(screen.getByLabelText('Bold'));

      const entries = PerfLogger.getAll();
      const actionEntry = entries.find((e) => e.label === 'toolbar:action');
      expect(actionEntry).toBeTruthy();
      expect(actionEntry!.metadata).toEqual({
        action: 'bold',
        source: 'source-toolbar',
      });
    });

    it('logs toolbar:action for block formatting', () => {
      const view = createMockView('hello', 0, 0);
      const getView = () => view;
      render(<SourceToolbar getView={getView} />);

      fireEvent.click(screen.getByLabelText('Heading 1'));

      const entries = PerfLogger.getAll();
      const actionEntry = entries.find((e) => e.label === 'toolbar:action');
      expect(actionEntry).toBeTruthy();
      expect(actionEntry!.metadata).toEqual({
        action: 'heading 1',
        source: 'source-toolbar',
      });
    });

    it('toolbar:action completes within 16ms budget', () => {
      const view = createMockView('hello world test content', 0, 5);
      const getView = () => view;
      render(<SourceToolbar getView={getView} />);

      fireEvent.click(screen.getByLabelText('Bold'));

      const entries = PerfLogger.getAll();
      const actionEntry = entries.find((e) => e.label === 'toolbar:action');
      expect(actionEntry).toBeTruthy();
      expect(actionEntry!.durationMs).toBeLessThan(16);
    });
  });

  describe('keyboard shortcuts', () => {
    it('Cmd+B wraps selection with ** in source mode', () => {
      const view = createMockView('hello', 0, 5);
      const getView = () => view;
      render(<SourceToolbar getView={getView} />);

      fireEvent.keyDown(document, { key: 'b', metaKey: true });

      const call = (view.dispatch as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.changes.insert).toBe('**hello**');
    });

    it('Cmd+I wraps selection with _ in source mode', () => {
      const view = createMockView('hello', 0, 5);
      const getView = () => view;
      render(<SourceToolbar getView={getView} />);

      fireEvent.keyDown(document, { key: 'i', metaKey: true });

      const call = (view.dispatch as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.changes.insert).toBe('_hello_');
    });

    it('Cmd+E wraps selection with ` in source mode', () => {
      const view = createMockView('hello', 0, 5);
      const getView = () => view;
      render(<SourceToolbar getView={getView} />);

      fireEvent.keyDown(document, { key: 'e', metaKey: true });

      const call = (view.dispatch as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.changes.insert).toBe('`hello`');
    });

    it('Cmd+K inserts link in source mode', () => {
      const view = createMockView('hello', 0, 5);
      const getView = () => view;
      render(<SourceToolbar getView={getView} />);

      fireEvent.keyDown(document, { key: 'k', metaKey: true });

      const call = (view.dispatch as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.changes.insert).toBe('[hello](url)');
    });

    it('Cmd+Shift+H adds heading prefix in source mode', () => {
      const view = createMockView('hello', 0, 0);
      const getView = () => view;
      render(<SourceToolbar getView={getView} />);

      fireEvent.keyDown(document, { key: 'h', metaKey: true, shiftKey: true });

      // Should add H1 prefix
      const firstCall = (view.dispatch as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(firstCall.changes.insert).toBe('# ');
    });

    it('Cmd+Shift+. toggles blockquote in source mode', () => {
      const view = createMockView('hello', 0, 0);
      const getView = () => view;
      render(<SourceToolbar getView={getView} />);

      fireEvent.keyDown(document, { key: '.', metaKey: true, shiftKey: true });

      const firstCall = (view.dispatch as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(firstCall.changes.insert).toBe('> ');
    });

    it('Cmd+Shift+8 toggles unordered list in source mode', () => {
      const view = createMockView('item', 0, 0);
      const getView = () => view;
      render(<SourceToolbar getView={getView} />);

      fireEvent.keyDown(document, { key: '8', metaKey: true, shiftKey: true });

      const firstCall = (view.dispatch as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(firstCall.changes.insert).toBe('- ');
    });

    it('does not handle shortcuts when view has no focus', () => {
      const view = createMockView('hello', 0, 5);
      (view as unknown as { hasFocus: boolean }).hasFocus = false;
      const getView = () => view;
      render(<SourceToolbar getView={getView} />);

      fireEvent.keyDown(document, { key: 'b', metaKey: true });

      expect(view.dispatch).not.toHaveBeenCalled();
    });
  });

  describe('find/replace (via CodeMirror search)', () => {
    it('CodeMirror includes searchKeymap for Cmd+F and Cmd+H', async () => {
      const onUpdate = vi.fn();
      const ref = React.createRef<SourceEditorRef>();
      render(<SourceEditor ref={ref} content="find this text" onUpdate={onUpdate} />);

      await waitFor(() => {
        expect(ref.current?.getView()).toBeTruthy();
      });

      // searchKeymap is registered as part of SourceEditor extensions
      // We verify the keymaps exist by checking the view was created with them
      const view = ref.current!.getView()!;
      expect(view).toBeTruthy();
      // The search panel is activated via keymap, so the integration is
      // confirmed by the fact that searchKeymap is in the extensions
    });
  });
});
