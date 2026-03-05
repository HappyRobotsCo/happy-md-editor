import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import type { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Markdown } from 'tiptap-markdown';
import { PerfLogger } from '../shared/logger';
import { FloatingToolbar } from './FloatingToolbar';
import { createScrollGuard } from './scroll-guard';
import { createPrismPlugin } from './prism-plugin';

export const LINK_EDIT_EVENT = 'tiptap:link-edit';

const PrismHighlight = Extension.create({
  name: 'prismHighlight',
  addProseMirrorPlugins() {
    return [createPrismPlugin()];
  },
});

const CustomShortcuts = Extension.create({
  name: 'customShortcuts',
  addKeyboardShortcuts() {
    return {
      'Mod-k': ({ editor }) => {
        editor.view.dom.dispatchEvent(new CustomEvent(LINK_EDIT_EVENT));
        return true;
      },
      'Mod-Shift-h': ({ editor }) => {
        // Cycle: H1→H2→H3→H4→H5→H6→Paragraph→H1
        for (let level = 1; level <= 6; level++) {
          if (editor.isActive('heading', { level })) {
            if (level === 6) {
              return editor.commands.setParagraph();
            }
            return editor.commands.toggleHeading({ level: (level + 1) as 1|2|3|4|5|6 });
          }
        }
        return editor.commands.toggleHeading({ level: 1 });
      },
      'Mod-Shift-.': ({ editor }) => {
        return editor.commands.toggleBlockquote();
      },
      'Mod-Shift-9': ({ editor }) => {
        return editor.commands.toggleTaskList();
      },
    };
  },
});

export interface TiptapEditorProps {
  content: string;
  onUpdate: (markdown: string) => void;
  onReady?: () => void;
  onEditorReady?: (editor: Editor) => void;
}

export interface TiptapEditorRef {
  getEditor: () => Editor | null;
}

export const TiptapEditor = forwardRef<TiptapEditorRef, TiptapEditorProps>(({
  content,
  onUpdate,
  onReady,
  onEditorReady,
}, ref) => {
  const onUpdateRef = useRef(onUpdate);
  const onReadyRef = useRef(onReady);
  const onEditorReadyRef = useRef(onEditorReady);
  const initStarted = useRef(false);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    onEditorReadyRef.current = onEditorReady;
  }, [onEditorReady]);

  const isInternalUpdateRef = useRef(false);

  const handleUpdate = useCallback(
    ({ editor }: { editor: ReturnType<typeof useEditor> }) => {
      if (!editor) return;
      // End tiptap:render timer (started in onTransaction)
      PerfLogger.end('tiptap:render');
      PerfLogger.start('tiptap:serialize');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const md = (editor.storage as any).markdown.getMarkdown() as string;
      PerfLogger.end('tiptap:serialize', {
        charCount: md.length,
      });
      isInternalUpdateRef.current = true;
      onUpdateRef.current(md);
    },
    [],
  );

  // Start init timing before editor creation
  if (!initStarted.current) {
    initStarted.current = true;
    PerfLogger.start('tiptap:init');
  }

  const editor = useEditor({
    editorProps: {
      handleClick: (_view, _pos, event) => {
        // Cmd+click (Mac) or Ctrl+click (Windows/Linux) opens links in a new tab
        if (event.metaKey || event.ctrlKey) {
          const target = event.target as HTMLElement;
          const anchor = target.closest('a');
          if (anchor?.href) {
            window.open(anchor.href, '_blank', 'noopener');
            return true;
          }
        }
        return false;
      },
      handleScrollToSelection: (view) => {
        // Let the scroll guard handle all scroll decisions.
        // Only allow ProseMirror's own scrollIntoView when cursor is
        // near the edge of the scroll container.
        const scrollParent = view.dom.closest('.editor-area');
        if (!scrollParent) return false;
        const coords = view.coordsAtPos(view.state.selection.from);
        const rect = scrollParent.getBoundingClientRect();
        const margin = 40;
        if (coords.top < rect.top + margin || coords.bottom > rect.bottom - margin) {
          return false; // cursor near edge — allow scroll
        }
        return true; // cursor visible — suppress
      },
    },
    extensions: [
      StarterKit.configure({
        link: {
          openOnClick: false,
          autolink: true,
        },
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Table.configure({
        resizable: false,
      }),
      TableRow,
      TableCell,
      TableHeader,
      Markdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: true,
      }),
      CustomShortcuts,
      PrismHighlight,
    ],
    content,
    onTransaction: ({ transaction }) => {
      // Start tiptap:render timer for transactions that change the doc.
      // The timer is ended in onUpdate after Tiptap re-renders.
      if (transaction.docChanged) {
        PerfLogger.start('tiptap:render');
      }
    },
    onUpdate: handleUpdate,
    onCreate: ({ editor: createdEditor }) => {
      PerfLogger.end('tiptap:init', {
        charCount: content.length,
      });
      onReadyRef.current?.();
      onEditorReadyRef.current?.(createdEditor);
    },
  });

  useImperativeHandle(ref, () => ({
    getEditor: () => editor,
  }), [editor]);

  // Handle external content changes (e.g., file open, mode switch).
  // We compare against Tiptap's current serialized markdown to avoid
  // re-hydrating on changes that came from the user typing (which would
  // reset cursor position).
  const prevContentRef = useRef(content);
  useEffect(() => {
    if (!editor) return;
    // Only hydrate if the content prop changed AND it wasn't from our own onUpdate
    if (content === prevContentRef.current) return;
    prevContentRef.current = content;

    // Skip re-hydration if this content change came from Tiptap's own onUpdate
    if (isInternalUpdateRef.current) {
      isInternalUpdateRef.current = false;
      return;
    }

    PerfLogger.start('tiptap:hydrate');
    editor.commands.setContent(content, { emitUpdate: false });
    PerfLogger.end('tiptap:hydrate', {
      charCount: content.length,
    });

    // Serialize the Tiptap-normalized markdown and notify parent
    PerfLogger.start('tiptap:serialize');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const normalized = (editor.storage as any).markdown.getMarkdown() as string;
    PerfLogger.end('tiptap:serialize', { charCount: normalized.length });
    onUpdateRef.current(normalized);
  }, [editor, content]);

  // Scroll guard: intercept browser-native scroll jumps caused by DOM mutations.
  // ProseMirror's handleScrollToSelection only controls its own scrollIntoView,
  // but the browser can independently scroll when nodes are removed/replaced.
  // This wraps view.dispatch to save/restore scroll position when the cursor
  // is already visible.
  useEffect(() => {
    if (!editor) return;
    return createScrollGuard(editor.view, '.editor-area');
  }, [editor]);

  return (
    <div className="tiptap-editor" aria-label="Markdown editor">
      <EditorContent editor={editor} />
      <FloatingToolbar editor={editor} />
    </div>
  );
});
