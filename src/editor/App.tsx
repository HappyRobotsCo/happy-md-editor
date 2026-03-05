import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { Editor } from '@tiptap/core';
import { openFile, saveFile, saveFileAs, type FileState } from './file-service';
import { autosave, restoreAutosave, clearAutosave } from './autosave-service';
import { saveHandle, restoreHandle } from './handle-service';
import { saveMode, restoreMode } from './mode-service';
import { parseFrontmatter, recombineFrontmatter } from './frontmatter-service';
import { APP_NAME, AUTOSAVE_DEBOUNCE_MS, type EditorMode, EDITOR_MODES, type Theme } from '../shared/constants';
import { initTheme, switchTheme, onOSThemeChange, restoreTheme, applyTheme } from './theme-service';
import { TiptapEditor } from './TiptapEditor';
import { Toolbar } from './Toolbar';
import { SourceToolbar } from './SourceToolbar';
import { PerfLogger } from '../shared/logger';
import type { SourceEditorRef } from './SourceEditor';
import type { PreviewPaneRef } from './PreviewPane';
import type { ScrollSyncCleanup } from './scroll-sync';

// Lazy-load source mode components
const SourceEditor = React.lazy(() =>
  import('./SourceEditor').then((m) => ({ default: m.SourceEditor })),
);
const PreviewPane = React.lazy(() =>
  import('./PreviewPane').then((m) => ({ default: m.PreviewPane })),
);

export const App: React.FC = () => {
  const [fileState, setFileState] = useState<FileState | null>(null);
  const [content, setContent] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [recovered, setRecovered] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [mode, setMode] = useState<EditorMode>('wysiwyg');
  const [theme, setTheme] = useState<Theme>('light');
  const [sourceReady, setSourceReady] = useState(false);
  const savedContentRef = useRef('');
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHydratingRef = useRef(false);
  const isSwitchingRef = useRef(false);
  const sourceEditorRef = useRef<SourceEditorRef>(null);
  const previewPaneRef = useRef<PreviewPaneRef>(null);
  const scrollSyncRef = useRef<ScrollSyncCleanup | null>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const frontmatterRef = useRef('');

  const handleEditorReady = useCallback((ed: Editor) => {
    setEditor(ed);
  }, []);

  // Restore mode preference on mount
  useEffect(() => {
    restoreMode().then((savedMode) => {
      if (savedMode) setMode(savedMode);
    });
  }, []);

  // Initialize theme on mount, listen for OS changes
  useEffect(() => {
    initTheme().then(setTheme);
    return onOSThemeChange((osTheme) => {
      // Only follow OS changes if no manual override is stored
      restoreTheme().then((saved) => {
        if (!saved) {
          applyTheme(osTheme);
          setTheme(osTheme);
        }
      });
    });
  }, []);

  const toggleTheme = useCallback(() => {
    const next: Theme = theme === 'light' ? 'dark' : 'light';
    switchTheme(next);
    setTheme(next);
  }, [theme]);

  // Restore file handle, pending file from content script, or auto-saved content on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Check for a pending file from content script (file:// URL interception)
      try {
        const result = await chrome.storage.session.get('pendingFile');
        if (!cancelled && result.pendingFile) {
          const { content: fileContent, fileName } = result.pendingFile;
          await chrome.storage.session.remove('pendingFile');
          const { rawFrontmatter, body } = parseFrontmatter(fileContent);
          frontmatterRef.current = rawFrontmatter;
          isHydratingRef.current = true;
          setFileState({
            content: fileContent,
            name: fileName,
            handle: null,
          });
          setContent(body);
          savedContentRef.current = body;
          setIsDirty(false);
          return;
        }
      } catch {
        // chrome.storage.session may not be available in all contexts
      }

      // Try to restore the last opened file handle
      const stored = await restoreHandle();
      if (cancelled) return;
      if (stored) {
        try {
          const file = await stored.handle.getFile();
          const fileContent = await file.text();
          if (cancelled) return;
          const { rawFrontmatter, body } = parseFrontmatter(fileContent);
          frontmatterRef.current = rawFrontmatter;
          isHydratingRef.current = true;
          setFileState({
            content: fileContent,
            name: file.name,
            handle: stored.handle,
          });
          setContent(body);
          savedContentRef.current = body;
          setIsDirty(false);
          clearAutosave();
          return;
        } catch {
          // Handle read failed — fall through to autosave recovery
        }
      }

      // Fall back to autosave recovery
      const entry = await restoreAutosave();
      if (cancelled || !entry) return;
      const { rawFrontmatter: recoveredFm, body: recoveredBody } = parseFrontmatter(entry.content);
      frontmatterRef.current = recoveredFm;
      setContent(recoveredBody);
      setIsDirty(true);
      setRecovered(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleOpen = useCallback(async () => {
    const result = await openFile();
    if (result) {
      const { rawFrontmatter, body } = parseFrontmatter(result.content);
      frontmatterRef.current = rawFrontmatter;
      isHydratingRef.current = true;
      setFileState(result);
      setContent(body);
      savedContentRef.current = body;
      setIsDirty(false);
      setRecovered(false);
      clearAutosave();
      saveHandle(result.handle!, result.name);
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!fileState) return;
    const fullContent = recombineFrontmatter(frontmatterRef.current, content);
    await saveFile(fileState.handle, fullContent);
    savedContentRef.current = content;
    setIsDirty(false);
    clearAutosave();
  }, [fileState, content]);

  const handleSaveAs = useCallback(async () => {
    const fullContent = recombineFrontmatter(frontmatterRef.current, content);
    const newHandle = await saveFileAs(fullContent, fileState?.name);
    if (newHandle) {
      setFileState({ content: fullContent, name: newHandle.name, handle: newHandle });
      savedContentRef.current = content;
      setIsDirty(false);
      setRecovered(false);
      clearAutosave();
      saveHandle(newHandle, newHandle.name);
    }
  }, [content, fileState?.name]);

  const handleContentChange = useCallback(
    (newContent: string) => {
      setContent(newContent);

      // After hydration, update the saved baseline to the Tiptap-normalized
      // version so dirty state comparison uses the normalized form
      if (isHydratingRef.current) {
        isHydratingRef.current = false;
        savedContentRef.current = newContent;
        setIsDirty(false);
        return;
      }

      // Skip dirty tracking / autosave during mode switch sync
      if (isSwitchingRef.current) return;

      setIsDirty(newContent !== savedContentRef.current);

      // Debounced auto-save (include frontmatter for full recovery)
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
      autosaveTimerRef.current = setTimeout(() => {
        const fullContent = recombineFrontmatter(frontmatterRef.current, newContent);
        autosave(fullContent, fileState?.name ?? null);
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [fileState?.name],
  );

  // Source editor sends full content (frontmatter + body), so re-parse on update
  const handleSourceContentChange = useCallback(
    (fullContent: string) => {
      const { rawFrontmatter, body } = parseFrontmatter(fullContent);
      frontmatterRef.current = rawFrontmatter;
      handleContentChange(body);
    },
    [handleContentChange],
  );

  // Mode switching logic
  const switchMode = useCallback(
    (newMode: EditorMode) => {
      if (newMode === modeRef.current) return;
      const oldMode = modeRef.current;

      PerfLogger.start('mode:switch');

      // Serialize from current editor before switching
      if (oldMode === 'wysiwyg' && editor) {
        // WYSIWYG → Source: serialize Tiptap to markdown
        PerfLogger.start('mode:serialize');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const md = (editor.storage as any).markdown.getMarkdown() as string;
        PerfLogger.end('mode:serialize', {
          charCount: md.length,
          direction: 'wysiwyg→source',
        });
        isSwitchingRef.current = true;
        setContent(md);
        // isSwitchingRef will be cleared after the source editor picks up the content
        requestAnimationFrame(() => {
          isSwitchingRef.current = false;
        });
      } else if (
        (oldMode === 'split' || oldMode === 'source') &&
        newMode === 'wysiwyg'
      ) {
        // Source → WYSIWYG: get content from CodeMirror, strip frontmatter, hydrate Tiptap
        const view = sourceEditorRef.current?.getView();
        if (view) {
          const fullMd = view.state.doc.toString();
          const { rawFrontmatter, body } = parseFrontmatter(fullMd);
          frontmatterRef.current = rawFrontmatter;
          PerfLogger.start('mode:hydrate');
          isHydratingRef.current = true;
          setContent(body);
          PerfLogger.end('mode:hydrate', {
            charCount: body.length,
            direction: 'source→wysiwyg',
          });
        }
      }
      // split ↔ source: no content sync needed, both use same content state

      // Tear down scroll sync if leaving split mode
      if (oldMode === 'split' && scrollSyncRef.current) {
        scrollSyncRef.current.destroy();
        scrollSyncRef.current = null;
      }

      setMode(newMode);
      setSourceReady(false);
      saveMode(newMode);

      PerfLogger.end('mode:switch', {
        direction: `${oldMode}→${newMode}`,
        charCount: content.length,
      });
    },
    [editor, content],
  );

  const cycleMode = useCallback(() => {
    const idx = EDITOR_MODES.indexOf(modeRef.current);
    const next = EDITOR_MODES[(idx + 1) % EDITOR_MODES.length];
    switchMode(next);
  }, [switchMode]);

  // Set up scroll sync when in split mode and both editors are ready
  const handleSourceReady = useCallback(() => {
    setSourceReady(true);
  }, []);

  useEffect(() => {
    if (mode !== 'split' || !sourceReady) return;

    // Defer scroll sync setup to next frame so refs are populated
    const raf = requestAnimationFrame(async () => {
      const view = sourceEditorRef.current?.getView();
      const previewEl = previewPaneRef.current?.getContainer();
      if (view && previewEl) {
        const { setupScrollSync } = await import('./scroll-sync');
        scrollSyncRef.current = setupScrollSync(view, previewEl);
      }
    });

    return () => {
      cancelAnimationFrame(raf);
      if (scrollSyncRef.current) {
        scrollSyncRef.current.destroy();
        scrollSyncRef.current = null;
      }
    };
  }, [mode, sourceReady]);

  // Cleanup autosave timer on unmount
  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, []);

  // E2E test hook: allow setting editor content via custom event.
  // The listener is always registered because e2e tests run against the
  // production build (dist/), where import.meta.env.DEV is false.
  // This is safe — the event can only be dispatched by code running in the
  // same extension origin (chrome-extension://<id>).
  useEffect(() => {
    const handler = (e: Event) => {
      const md = (e as CustomEvent<string>).detail;
      if (typeof md !== 'string') return;
      const { rawFrontmatter, body } = parseFrontmatter(md);
      frontmatterRef.current = rawFrontmatter;
      isHydratingRef.current = true;
      setContent(body);
      setFileState({ content: md, name: 'e2e-test.md', handle: null });
    };
    document.addEventListener('e2e:set-content', handler);
    return () => document.removeEventListener('e2e:set-content', handler);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      if (e.key === 'o') {
        e.preventDefault();
        handleOpen();
      } else if (e.key === 's' && e.shiftKey) {
        e.preventDefault();
        handleSaveAs();
      } else if (e.key === 's') {
        e.preventDefault();
        handleSave();
      } else if (e.key === '\\') {
        e.preventDefault();
        cycleMode();
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handleOpen, handleSave, handleSaveAs, cycleMode]);

  // Update tab title with dirty indicator
  useEffect(() => {
    const fileName = fileState?.name;
    const base = fileName ? `${fileName} — ${APP_NAME}` : APP_NAME;
    document.title = isDirty ? `* ${base}` : base;
  }, [isDirty, fileState?.name]);

  // beforeunload prompt for unsaved changes
  useEffect(() => {
    if (!isDirty) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const hasContent = fileState || recovered;

  // Full content for source editor (frontmatter + body)
  const sourceContent = useMemo(
    () => frontmatterRef.current + content,
    [content],
  );

  return (
    <div className="app">
      <header className="toolbar-area">
        <div className="file-toolbar">
          <button
            className="toolbar-btn"
            onClick={handleOpen}
            aria-label="Open file"
          >
            Open
          </button>
          <button
            className="toolbar-btn"
            onClick={handleSave}
            disabled={!fileState?.handle}
            aria-label="Save file"
          >
            Save
          </button>
          <button
            className="toolbar-btn"
            onClick={handleSaveAs}
            aria-label="Save file as"
          >
            Save As
          </button>
          {fileState && (
            <span className="file-name">
              {isDirty ? '* ' : ''}
              {fileState.name}
            </span>
          )}
          <span className="toolbar-spacer" />
          <button
            className="toolbar-btn theme-toggle-btn"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          >
            {theme === 'light' ? '\u263E' : '\u2600'}
          </button>
          <div className="mode-switcher" role="radiogroup" aria-label="Editor mode">
            <button
              className={`toolbar-btn mode-btn${mode === 'wysiwyg' ? ' active' : ''}`}
              onClick={() => switchMode('wysiwyg')}
              aria-label="WYSIWYG mode"
              aria-pressed={mode === 'wysiwyg'}
              role="radio"
              aria-checked={mode === 'wysiwyg'}
            >
              WYSIWYG
            </button>
            <button
              className={`toolbar-btn mode-btn${mode === 'split' ? ' active' : ''}`}
              onClick={() => switchMode('split')}
              aria-label="Split mode"
              aria-pressed={mode === 'split'}
              role="radio"
              aria-checked={mode === 'split'}
            >
              Split
            </button>
            <button
              className={`toolbar-btn mode-btn${mode === 'source' ? ' active' : ''}`}
              onClick={() => switchMode('source')}
              aria-label="Source mode"
              aria-pressed={mode === 'source'}
              role="radio"
              aria-checked={mode === 'source'}
            >
              Source
            </button>
          </div>
        </div>
        {mode === 'wysiwyg' && <Toolbar editor={editor} />}
        {(mode === 'split' || mode === 'source') && (
          <SourceToolbar getView={() => sourceEditorRef.current?.getView() ?? null} />
        )}
      </header>
      <main className={`editor-area${mode === 'split' ? ' editor-area--split' : ''}`}>
        {!hasContent ? (
          <p className="placeholder">
            Open a markdown file to get started (Cmd/Ctrl+O)
          </p>
        ) : mode === 'wysiwyg' ? (
          <TiptapEditor
            content={content}
            onUpdate={handleContentChange}
            onEditorReady={handleEditorReady}
          />
        ) : mode === 'split' ? (
          <React.Suspense fallback={<div className="placeholder">Loading source editor…</div>}>
            <div className="split-pane split-pane--source">
              <SourceEditor
                ref={sourceEditorRef}
                content={sourceContent}
                onUpdate={handleSourceContentChange}
                onReady={handleSourceReady}
              />
            </div>
            <div className="split-pane split-pane--preview">
              <PreviewPane ref={previewPaneRef} markdown={content} />
            </div>
          </React.Suspense>
        ) : (
          <React.Suspense fallback={<div className="placeholder">Loading source editor…</div>}>
            <div className="source-only-pane">
              <SourceEditor
                ref={sourceEditorRef}
                content={sourceContent}
                onUpdate={handleSourceContentChange}
                onReady={handleSourceReady}
              />
            </div>
          </React.Suspense>
        )}
      </main>
      <footer className="status-bar-area">
        {/* Status bar will be mounted here */}
      </footer>
    </div>
  );
};
