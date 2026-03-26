# Happy MD Editor

Chrome Extension (Manifest V3) for opening, editing, and saving `.md` files with a WYSIWYG interface. Uses the File System Access API to read/write local files directly — no server, no account, no network requests.

## Tech Stack

- **UI**: React 18, TypeScript 5.7, Vite 6
- **WYSIWYG editor**: Tiptap 3 with GFM extensions (tables, task lists, strikethrough)
- **Source editor**: CodeMirror 6 (lazy-loaded on first use)
- **Markdown**: tiptap-markdown (serialization), markdown-it (preview rendering), Prism.js (syntax highlighting)
- **Sanitization**: DOMPurify
- **Testing**: Vitest + Testing Library (unit), Playwright (e2e)
- **Linting**: ESLint 9 + TypeScript plugin + React Hooks plugin + Prettier

## Commands

```bash
npm run dev          # Watch mode rebuild to dist/
npm run build        # Typecheck + production build
npm run typecheck    # tsc --noEmit
npm run lint         # eslint src/
npm test             # vitest run (unit tests)
npm run test:watch   # vitest (watch mode)
npm run test:e2e     # playwright test

# Validate everything
npm run typecheck && npm run lint && npm test && npm run build
```

Load the extension: chrome://extensions, Developer mode, Load unpacked, select `dist/`.

## Project Structure

```
src/
  background.ts              # Service worker: icon click, onInstalled, message routing
  content/content-script.ts  # Injected into file://*.md URLs, sends content to background
  editor/
    App.tsx                  # Main app: coordinates mode, file state, autosave
    main.tsx                 # React entry point
    TiptapEditor.tsx         # WYSIWYG editor component (forwardRef + useImperativeHandle)
    SourceEditor.tsx         # CodeMirror wrapper (lazy-loaded)
    PreviewPane.tsx          # Rendered markdown preview (lazy-loaded)
    FloatingToolbar.tsx      # Context-aware formatting toolbar
    Toolbar.tsx              # Top toolbar (file ops, mode switch, theme)
    SourceToolbar.tsx        # Toolbar variant for source mode
    LinkPopover.tsx          # Link editing popover
    file-service.ts          # File System Access API (open/save)
    autosave-service.ts      # IndexedDB auto-save + crash recovery
    handle-service.ts        # FileHandle persistence in IndexedDB
    frontmatter-service.ts   # YAML frontmatter strip/restore (byte-preserving)
    theme-service.ts         # Light/dark theme detection + persistence
    mode-service.ts          # Editor mode persistence (wysiwyg/split/source)
    highlight-service.ts     # Prism syntax highlighting for preview
    scroll-sync.ts           # Source to preview scroll synchronization
    scroll-guard.ts          # Prevents scroll jumps during content updates
    db.ts                    # IndexedDB initialization
    prism-plugin.ts          # Prism plugin for Tiptap
  onboarding/                # First-install onboarding page
  shared/
    logger.ts                # PerfLogger: timing instrumentation for all operations
    constants.ts             # Shared constants
    performance-budgets.ts   # Timing budget definitions
    storage-utils.ts         # Chrome storage helpers
  styles/                    # CSS: editor, toolbar, light/dark themes, print
  types/                     # TypeScript declarations
  build/                     # Build-time checks (bundle size, perf budgets)
public/
  manifest.json              # MV3 manifest
  icons/                     # Extension icons
specs/                       # 12 feature specification documents
playwright/                  # E2E test infrastructure
```

## Key Patterns

- **Service modules**: Each domain (file I/O, autosave, theme, etc.) is a standalone async module. No Redux or Context; state is lifted to `App.tsx`.
- **Lazy loading**: CodeMirror and markdown-it are loaded on first use via `React.lazy()` + `Suspense`. Ref-based caching prevents re-imports.
- **Ref forwarding**: Editor components use `forwardRef` + `useImperativeHandle` to expose `getEditor()`, `getView()`, `getContainer()` to the parent.
- **PerfLogger**: All timed operations are wrapped with `PerfLogger.start()`/`.end()` or `PerfLogger.measure()`/`.async()`. Tests assert timing budgets via `PerfLogger.getAll()`.
- **Frontmatter**: Stripped before passing to Tiptap, preserved as raw string, prepended verbatim on save (never re-serialized through a YAML library).
- **Theming**: CSS custom properties toggled via `data-theme` attribute on `<html>`. OS preference detected on first load.
- **Mode switching**: WYSIWYG, Split, Source cycle. Content synced through markdown serialization/deserialization on each transition.

## Conventions

- **TypeScript strict mode** with `noUnusedLocals` and `noUnusedParameters`
- **Path alias**: `@/` maps to `src/`
- **Prettier**: single quotes, semicolons, trailing commas, 2-space indent, 80-char width
- **Unused args**: prefix with `_` (ESLint `argsIgnorePattern: '^_'`)
- **Tests**: co-located as `*.test.ts` / `*.test.tsx` next to source files, jsdom environment, globals enabled
- **Build output**: `dist/` with `background.js` and `content-script.js` at top level, app assets hashed under `assets/`
