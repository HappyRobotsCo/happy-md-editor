# Spec: Extension Scaffold & Build Pipeline

## Job to Be Done
Developer can build, test, and load the extension into Chrome from a single command.

## Requirements
- Manifest V3 Chrome extension with minimal permissions (`storage`)
- Vite-based build pipeline producing a `dist/` folder loadable as unpacked extension
- TypeScript for all source code
- Vitest for unit/integration testing
- ESLint + Prettier for code quality
- `manifest.json` with service worker, editor page, content script entry points
- Project structure:
  ```
  src/
    background.ts        (service worker)
    editor/
      index.html         (full-page editor tab)
      main.ts            (entry point)
      App.tsx            (React root — Tiptap requires React or Vue)
    content/
      content-script.ts  (file:// URL interception — Phase 2)
    shared/
      logger.ts          (structured performance logging)
      constants.ts
    styles/
      light.css
      dark.css
  ```
- React as the UI framework (Tiptap has first-class React bindings)
- Source maps in development, minified production builds

## Performance Logging
- `src/shared/logger.ts` must export a `PerfLogger` class:
  ```typescript
  PerfLogger.start(label: string): void
  PerfLogger.end(label: string): { label: string, durationMs: number }
  PerfLogger.measure(label: string, fn: () => T): T
  PerfLogger.async(label: string, fn: () => Promise<T>): Promise<T>
  PerfLogger.getAll(): PerfEntry[]
  PerfLogger.summary(): string  // formatted table of all measurements
  ```
- All performance entries stored in memory with timestamps
- `PerfLogger.summary()` prints a formatted table to console
- Logger is no-op in production builds (tree-shaken via `import.meta.env.DEV`)

## Acceptance Criteria
- [ ] `npm run build` produces a `dist/` folder with valid Manifest V3 extension
- [ ] `npm run dev` starts a watch mode that rebuilds on file changes
- [ ] `npm test` runs Vitest test suite
- [ ] `npm run lint` runs ESLint without errors
- [ ] `npm run typecheck` runs TypeScript compiler in check mode without errors
- [ ] Extension loads in Chrome via "Load unpacked" pointing to `dist/`
- [ ] Clicking extension icon opens a new tab with editor.html
- [ ] PerfLogger measures and logs extension init time to console
- [ ] Build output is under 300KB gzipped (excluding lazy chunks)

## Test Cases
| Input | Expected Output |
|-------|-----------------|
| `npm run build` | Clean build, no errors, `dist/` created |
| `npm test` | All tests pass |
| `npm run lint` | Zero lint errors |
| `npm run typecheck` | Zero type errors |
| Load unpacked `dist/` in Chrome | Extension appears, icon clickable |
| Click extension icon | New tab opens with editor.html |
| Check console on editor tab load | PerfLogger outputs `extension:init` timing |

## Technical Notes
- Use Vite with `@crxjs/vite-plugin` or manual Vite config for Chrome extension builds
- React 18+ with strict mode
- Bundle analysis: use `rollup-plugin-visualizer` to track bundle size per chunk
- Dev mode: `import.meta.env.DEV` enables verbose logging

## Revision History
- 2026-03-05: Initial spec from PRD
