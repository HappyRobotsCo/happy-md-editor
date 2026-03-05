import React, { useCallback, useEffect } from 'react';
import type { EditorView } from '@codemirror/view';
import { PerfLogger } from '../shared/logger';

export interface SourceToolbarProps {
  getView: () => EditorView | null;
}

interface WrapAction {
  label: string;
  ariaLabel: string;
  before: string;
  after: string;
}

interface LineAction {
  label: string;
  ariaLabel: string;
  prefix: string;
}

const INLINE_ACTIONS: WrapAction[] = [
  { label: 'B', ariaLabel: 'Bold', before: '**', after: '**' },
  { label: 'I', ariaLabel: 'Italic', before: '_', after: '_' },
  { label: 'S', ariaLabel: 'Strikethrough', before: '~~', after: '~~' },
  { label: '<>', ariaLabel: 'Inline code', before: '`', after: '`' },
];

const BLOCK_ACTIONS: LineAction[] = [
  { label: 'H1', ariaLabel: 'Heading 1', prefix: '# ' },
  { label: 'H2', ariaLabel: 'Heading 2', prefix: '## ' },
  { label: 'H3', ariaLabel: 'Heading 3', prefix: '## ' },
  { label: 'UL', ariaLabel: 'Unordered list', prefix: '- ' },
  { label: 'OL', ariaLabel: 'Ordered list', prefix: '1. ' },
  { label: 'Tasks', ariaLabel: 'Task list', prefix: '- [ ] ' },
  { label: 'Quote', ariaLabel: 'Blockquote', prefix: '> ' },
];

// Fix H3 prefix
BLOCK_ACTIONS[2] = { label: 'H3', ariaLabel: 'Heading 3', prefix: '### ' };

function wrapSelection(view: EditorView, before: string, after: string): void {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);

  // Toggle off: if already wrapped, remove markers
  if (selected.startsWith(before) && selected.endsWith(after) && selected.length >= before.length + after.length) {
    const inner = selected.slice(before.length, selected.length - after.length);
    view.dispatch({
      changes: { from, to, insert: inner },
      selection: { anchor: from, head: from + inner.length },
    });
    return;
  }

  // Check if the surrounding text already has the markers
  const docBefore = from >= before.length ? view.state.sliceDoc(from - before.length, from) : '';
  const docAfter = to + after.length <= view.state.doc.length ? view.state.sliceDoc(to, to + after.length) : '';
  if (docBefore === before && docAfter === after) {
    // Remove surrounding markers
    view.dispatch({
      changes: [
        { from: from - before.length, to: from, insert: '' },
        { from: to, to: to + after.length, insert: '' },
      ],
      selection: { anchor: from - before.length, head: to - before.length },
    });
    return;
  }

  // Wrap selection
  const replacement = before + selected + after;
  view.dispatch({
    changes: { from, to, insert: replacement },
    selection: { anchor: from + before.length, head: from + before.length + selected.length },
  });
}

function prefixLine(view: EditorView, prefix: string): void {
  const { from, to } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);

  // Toggle off: if line already starts with prefix, remove it
  if (line.text.startsWith(prefix)) {
    view.dispatch({
      changes: { from: line.from, to: line.from + prefix.length, insert: '' },
    });
    return;
  }

  // Strip any existing heading prefix before applying new one
  const headingMatch = line.text.match(/^#{1,6}\s/);
  const listMatch = line.text.match(/^(?:- \[[ x]\] |[-*+] |\d+\. |> )/);
  const existingPrefix = headingMatch?.[0] || listMatch?.[0];

  if (existingPrefix) {
    view.dispatch({
      changes: { from: line.from, to: line.from + existingPrefix.length, insert: prefix },
    });
  } else {
    view.dispatch({
      changes: { from: line.from, insert: prefix },
    });
  }

  // Restore selection after line prefix
  const delta = prefix.length - (existingPrefix?.length ?? 0);
  const newFrom = Math.max(line.from, from + delta);
  const newTo = Math.max(line.from, to + delta);
  view.dispatch({
    selection: { anchor: newFrom, head: newTo },
  });
}

function insertCodeBlock(view: EditorView): void {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);
  const replacement = '```\n' + selected + '\n```';
  view.dispatch({
    changes: { from, to, insert: replacement },
    selection: { anchor: from + 4, head: from + 4 + selected.length },
  });
}

function insertHorizontalRule(view: EditorView): void {
  const { from } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);
  // Insert HR on its own line
  const prefix = line.from === from && line.text === '' ? '' : '\n';
  const insert = prefix + '---\n';
  view.dispatch({
    changes: { from, insert },
    selection: { anchor: from + insert.length },
  });
}

function insertLink(view: EditorView): void {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);
  if (selected) {
    const replacement = `[${selected}](url)`;
    view.dispatch({
      changes: { from, to, insert: replacement },
      // Select "url" for easy replacement
      selection: { anchor: from + selected.length + 3, head: from + selected.length + 6 },
    });
  } else {
    const replacement = '[text](url)';
    view.dispatch({
      changes: { from, insert: replacement },
      selection: { anchor: from + 1, head: from + 5 },
    });
  }
}

export const SourceToolbar: React.FC<SourceToolbarProps> = ({ getView }) => {
  const runAction = useCallback(
    (name: string, fn: (view: EditorView) => void) => {
      const view = getView();
      if (!view) return;
      PerfLogger.start('toolbar:action');
      fn(view);
      view.focus();
      PerfLogger.end('toolbar:action', { action: name, source: 'source-toolbar' });
    },
    [getView],
  );

  // Keyboard shortcuts for source mode (Mod+B, Mod+I, Mod+E, Mod+K, etc.)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      const view = getView();
      if (!view) return;

      // Only handle if focus is in the CodeMirror editor
      if (!view.hasFocus) return;

      if (e.key === 'b' && !e.shiftKey) {
        e.preventDefault();
        runAction('bold', (v) => wrapSelection(v, '**', '**'));
      } else if (e.key === 'i' && !e.shiftKey) {
        e.preventDefault();
        runAction('italic', (v) => wrapSelection(v, '_', '_'));
      } else if (e.key === 'e' && !e.shiftKey) {
        e.preventDefault();
        runAction('inline-code', (v) => wrapSelection(v, '`', '`'));
      } else if (e.key === 'k' && !e.shiftKey) {
        e.preventDefault();
        runAction('link', insertLink);
      } else if (e.key === 'h' && e.shiftKey) {
        e.preventDefault();
        // Cycle headings: H1→H2→H3→H4→H5→H6→P
        const line = view.state.doc.lineAt(view.state.selection.main.from);
        const match = line.text.match(/^(#{1,6})\s/);
        if (match) {
          const level = match[1].length;
          if (level >= 6) {
            runAction('heading-cycle', (v) => {
              const l = v.state.doc.lineAt(v.state.selection.main.from);
              const m = l.text.match(/^#{1,6}\s/);
              if (m) {
                v.dispatch({ changes: { from: l.from, to: l.from + m[0].length, insert: '' } });
              }
            });
          } else {
            runAction('heading-cycle', (v) => prefixLine(v, '#'.repeat(level + 1) + ' '));
          }
        } else {
          runAction('heading-cycle', (v) => prefixLine(v, '# '));
        }
      } else if (e.key === '.' && e.shiftKey) {
        e.preventDefault();
        runAction('blockquote', (v) => prefixLine(v, '> '));
      } else if (e.key === '8' && e.shiftKey) {
        e.preventDefault();
        runAction('bullet-list', (v) => prefixLine(v, '- '));
      } else if (e.key === '7' && e.shiftKey) {
        e.preventDefault();
        runAction('ordered-list', (v) => prefixLine(v, '1. '));
      } else if (e.key === '9' && e.shiftKey) {
        e.preventDefault();
        runAction('task-list', (v) => prefixLine(v, '- [ ] '));
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [getView, runAction]);

  return (
    <div className="toolbar source-toolbar" role="toolbar" aria-label="Source formatting toolbar">
      {/* Inline formatting */}
      {INLINE_ACTIONS.map((action) => (
        <button
          key={action.ariaLabel}
          className="toolbar-btn"
          onClick={() =>
            runAction(action.ariaLabel.toLowerCase(), (v) => wrapSelection(v, action.before, action.after))
          }
          aria-label={action.ariaLabel}
        >
          {action.label}
        </button>
      ))}

      <span className="toolbar-separator" aria-hidden="true" />

      {/* Link */}
      <button
        className="toolbar-btn"
        onClick={() => runAction('link', insertLink)}
        aria-label="Link"
      >
        Link
      </button>

      <span className="toolbar-separator" aria-hidden="true" />

      {/* Block formatting */}
      {BLOCK_ACTIONS.map((action) => (
        <button
          key={action.ariaLabel}
          className="toolbar-btn"
          onClick={() =>
            runAction(action.ariaLabel.toLowerCase(), (v) => prefixLine(v, action.prefix))
          }
          aria-label={action.ariaLabel}
        >
          {action.label}
        </button>
      ))}

      <span className="toolbar-separator" aria-hidden="true" />

      {/* Code block and HR */}
      <button
        className="toolbar-btn"
        onClick={() => runAction('code-block', insertCodeBlock)}
        aria-label="Code block"
      >
        Code
      </button>
      <button
        className="toolbar-btn"
        onClick={() => runAction('horizontal-rule', insertHorizontalRule)}
        aria-label="Horizontal rule"
      >
        HR
      </button>
    </div>
  );
};
