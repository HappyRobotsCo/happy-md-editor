import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import type { EditorView } from '@codemirror/view';
import { PerfLogger } from '../shared/logger';

export interface SourceEditorProps {
  content: string;
  onUpdate: (markdown: string) => void;
  onReady?: () => void;
}

export interface SourceEditorRef {
  getView: () => EditorView | null;
}

// Lazy-load all CodeMirror modules in a single dynamic import chunk
async function loadCodeMirror() {
  PerfLogger.start('codemirror:load');
  const [
    { EditorView, lineNumbers, highlightActiveLine, highlightActiveLineGutter, keymap, drawSelection },
    { EditorState },
    { markdown, markdownLanguage },
    { languages },
    { defaultHighlightStyle, syntaxHighlighting, bracketMatching },
    { searchKeymap, highlightSelectionMatches },
    { defaultKeymap, history, historyKeymap, indentWithTab },
  ] = await Promise.all([
    import('@codemirror/view'),
    import('@codemirror/state'),
    import('@codemirror/lang-markdown'),
    import('@codemirror/language-data'),
    import('@codemirror/language'),
    import('@codemirror/search'),
    import('@codemirror/commands'),
  ]);
  PerfLogger.end('codemirror:load');

  return {
    EditorView,
    EditorState,
    markdown,
    markdownLanguage,
    languages,
    defaultHighlightStyle,
    syntaxHighlighting,
    bracketMatching,
    lineNumbers,
    highlightActiveLine,
    highlightActiveLineGutter,
    drawSelection,
    keymap,
    searchKeymap,
    highlightSelectionMatches,
    defaultKeymap,
    history,
    historyKeymap,
    indentWithTab,
  };
}

export const SourceEditor = forwardRef<SourceEditorRef, SourceEditorProps>(({
  content,
  onUpdate,
  onReady,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onUpdateRef = useRef(onUpdate);
  const onReadyRef = useRef(onReady);
  const contentRef = useRef(content);
  const initializedRef = useRef(false);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useImperativeHandle(ref, () => ({
    getView: () => viewRef.current,
  }), []);

  const initEditor = useCallback(async () => {
    if (!containerRef.current || initializedRef.current) return;
    initializedRef.current = true;

    const cm = await loadCodeMirror();

    PerfLogger.start('codemirror:init');

    const updateListener = cm.EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const doc = update.state.doc.toString();
        contentRef.current = doc;
        onUpdateRef.current(doc);
      }
    });

    const state = cm.EditorState.create({
      doc: contentRef.current,
      extensions: [
        cm.lineNumbers(),
        cm.highlightActiveLineGutter(),
        cm.highlightActiveLine(),
        cm.drawSelection(),
        cm.bracketMatching(),
        cm.history(),
        cm.highlightSelectionMatches(),
        cm.keymap.of([
          ...cm.defaultKeymap,
          ...cm.historyKeymap,
          ...cm.searchKeymap,
          cm.indentWithTab,
        ]),
        cm.markdown({
          base: cm.markdownLanguage,
          codeLanguages: cm.languages,
        }),
        cm.syntaxHighlighting(cm.defaultHighlightStyle, { fallback: true }),
        updateListener,
        cm.EditorView.lineWrapping,
      ],
    });

    const view = new cm.EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    PerfLogger.end('codemirror:init', {
      charCount: contentRef.current.length,
    });

    onReadyRef.current?.();
  }, []);

  // Initialize editor on mount
  useEffect(() => {
    initEditor();

    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
        initializedRef.current = false;
      }
    };
  }, [initEditor]);

  // Handle external content changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (content === contentRef.current) return;

    contentRef.current = content;
    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: content,
      },
    });
  }, [content]);

  return (
    <div
      ref={containerRef}
      className="source-editor"
      aria-label="Markdown source editor"
    />
  );
});
