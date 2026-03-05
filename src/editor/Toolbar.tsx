import React, { useCallback, useState, useRef, useEffect } from 'react';
import type { Editor } from '@tiptap/core';
import { PerfLogger } from '../shared/logger';

export interface ToolbarProps {
  editor: Editor | null;
}

const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const;

export const Toolbar: React.FC<ToolbarProps> = ({ editor }) => {
  const [headingOpen, setHeadingOpen] = useState(false);
  const [, setTick] = useState(0);
  const headingRef = useRef<HTMLDivElement>(null);

  // Re-render toolbar on editor transactions (selection/content changes)
  useEffect(() => {
    if (!editor) return;
    const handler = () => setTick((t) => t + 1);
    editor.on('transaction', handler);
    return () => {
      editor.off('transaction', handler);
    };
  }, [editor]);

  // Close heading picker on outside click
  useEffect(() => {
    if (!headingOpen) return;
    const handler = (e: MouseEvent) => {
      if (headingRef.current && !headingRef.current.contains(e.target as Node)) {
        setHeadingOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [headingOpen]);

  const runAction = useCallback(
    (name: string, fn: () => void) => {
      PerfLogger.start('toolbar:action');
      fn();
      PerfLogger.end('toolbar:action', { action: name });
    },
    [],
  );

  if (!editor) return null;

  // Compute active states with PerfLogger instrumentation
  PerfLogger.start('toolbar:state-sync');
  const currentHeading = HEADING_LEVELS.find((level) =>
    editor.isActive('heading', { level }),
  );
  const isBulletList = editor.isActive('bulletList');
  const isOrderedList = editor.isActive('orderedList');
  const isTaskList = editor.isActive('taskList');
  const isBlockquote = editor.isActive('blockquote');
  const isCodeBlock = editor.isActive('codeBlock');
  PerfLogger.end('toolbar:state-sync');

  const headingLabel = currentHeading ? `H${currentHeading}` : 'Paragraph';

  return (
    <div className="toolbar" role="toolbar" aria-label="Formatting toolbar">
      {/* Heading picker */}
      <div className="toolbar-heading-picker" ref={headingRef}>
        <button
          className="toolbar-btn"
          onClick={() => setHeadingOpen(!headingOpen)}
          aria-label="Heading level"
          aria-expanded={headingOpen}
          aria-haspopup="listbox"
        >
          {headingLabel}
        </button>
        {headingOpen && (
          <ul className="toolbar-heading-dropdown" role="listbox" aria-label="Heading levels">
            <li role="option" aria-selected={!currentHeading}>
              <button
                className={`toolbar-dropdown-item${!currentHeading ? ' active' : ''}`}
                onClick={() => {
                  runAction('paragraph', () => editor.chain().focus().setParagraph().run());
                  setHeadingOpen(false);
                }}
              >
                Paragraph
              </button>
            </li>
            {HEADING_LEVELS.map((level) => (
              <li key={level} role="option" aria-selected={currentHeading === level}>
                <button
                  className={`toolbar-dropdown-item${currentHeading === level ? ' active' : ''}`}
                  onClick={() => {
                    runAction(`heading-${level}`, () =>
                      editor.chain().focus().toggleHeading({ level }).run(),
                    );
                    setHeadingOpen(false);
                  }}
                >
                  H{level}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <span className="toolbar-separator" aria-hidden="true" />

      {/* Lists */}
      <button
        className={`toolbar-btn${isBulletList ? ' active' : ''}`}
        onClick={() =>
          runAction('bullet-list', () => editor.chain().focus().toggleBulletList().run())
        }
        aria-label="Unordered list"
        aria-pressed={isBulletList}
      >
        UL
      </button>
      <button
        className={`toolbar-btn${isOrderedList ? ' active' : ''}`}
        onClick={() =>
          runAction('ordered-list', () => editor.chain().focus().toggleOrderedList().run())
        }
        aria-label="Ordered list"
        aria-pressed={isOrderedList}
      >
        OL
      </button>
      <button
        className={`toolbar-btn${isTaskList ? ' active' : ''}`}
        onClick={() =>
          runAction('task-list', () => editor.chain().focus().toggleTaskList().run())
        }
        aria-label="Task list"
        aria-pressed={isTaskList}
      >
        Tasks
      </button>

      <span className="toolbar-separator" aria-hidden="true" />

      {/* Block elements */}
      <button
        className={`toolbar-btn${isBlockquote ? ' active' : ''}`}
        onClick={() =>
          runAction('blockquote', () => editor.chain().focus().toggleBlockquote().run())
        }
        aria-label="Blockquote"
        aria-pressed={isBlockquote}
      >
        Quote
      </button>
      <button
        className={`toolbar-btn${isCodeBlock ? ' active' : ''}`}
        onClick={() =>
          runAction('code-block', () => editor.chain().focus().toggleCodeBlock().run())
        }
        aria-label="Code block"
        aria-pressed={isCodeBlock}
      >
        Code
      </button>

      <span className="toolbar-separator" aria-hidden="true" />

      {/* Insert actions */}
      <button
        className="toolbar-btn"
        onClick={() =>
          runAction('horizontal-rule', () => editor.chain().focus().setHorizontalRule().run())
        }
        aria-label="Horizontal rule"
      >
        HR
      </button>
      <button
        className="toolbar-btn"
        onClick={() =>
          runAction('table', () =>
            editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
          )
        }
        aria-label="Insert table"
      >
        Table
      </button>
    </div>
  );
};
