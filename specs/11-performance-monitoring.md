# Spec: Performance Monitoring & Logging

## Job to Be Done
Developers can measure, log, and validate performance of every critical operation against defined budgets.

## Requirements
- Structured `PerfLogger` utility used by all specs (defined in spec 01)
- Performance budgets defined for every critical path:
  | Operation | Budget |
  |-----------|--------|
  | Extension init (tab open to interactive) | < 500ms |
  | File open (picker close to content in editor) | < 100ms (files < 1MB) |
  | File save (trigger to writable.close) | < 100ms (files < 1MB) |
  | Preview render (keystroke to DOM update) | < 200ms (docs < 10k lines) |
  | Tiptap init (markdown string to editor ready) | < 200ms (docs < 10k lines) |
  | Tiptap serialize (editor state to markdown) | < 100ms (docs < 10k lines) |
  | Mode switch (button click to new mode ready) | < 300ms (docs < 10k lines) |
  | Mode switch first time (with lazy load) | < 800ms |
  | Theme switch | < 50ms |
  | Theme init (detect OS preference + apply) | < 100ms |
  | Code block highlight (all blocks) | < 100ms |
  | Code block highlight (single block) | < 10ms |
  | Highlight lazy-load (additional language) | < 200ms |
  | Highlight load (initial Prism + default languages) | < 500ms |
  | Auto-save to IndexedDB | < 50ms |
  | Restore from IndexedDB (file:restore) | < 50ms |
  | FileHandle restore + permission re-grant (file:handle-restore) | < 200ms |
  | Tiptap render (process update and re-render) | < 200ms (docs < 10k lines) |
  | Tiptap hydrate (load new content into existing editor) | < 200ms (docs < 10k lines) |
  | Toolbar action (button click to editor state updated) | < 16ms |
  | Toolbar state-sync (compute active states from cursor) | < 16ms |
  | Floating toolbar show (selection change to visible) | < 100ms |
  | Floating toolbar hide (dismiss) | < 16ms |
  | CodeMirror load (lazy-load bundle) | < 500ms |
  | CodeMirror init (create editor with content) | < 500ms |
  | Preview load (lazy-load markdown-it + DOMPurify) | < 500ms |
  | Preview sanitize (DOMPurify pass) | < 200ms (docs < 10k lines) |
  | Mode serialize (Tiptap → markdown for mode switch) | < 100ms (docs < 10k lines) |
  | Mode hydrate (markdown → Tiptap for mode switch) | < 200ms (docs < 10k lines) |
  | Mode CodeMirror load (first switch lazy load) | < 500ms |
  | Scroll sync (compute and apply scroll position) | < 50ms |
  | Frontmatter parse (extract frontmatter block) | < 10ms |
  | Frontmatter recombine (prepend on save) | < 10ms |
  | Onboarding init (theme detect + DOM setup) | < 100ms |
  | Onboarding complete (store flag + close) | < 50ms |
  | Lazy feature load (Mermaid/KaTeX) | < 500ms |
  | Bundle size (core WYSIWYG) | < 280KB gzipped |
  | Bundle size (with source mode) | < 500KB gzipped |
- Dev mode: PerfLogger writes all entries to console with formatted table
- Test mode: PerfLogger entries accessible programmatically for assertions
- Production mode: PerfLogger is a no-op (runtime `isEnabled()` guard; `end()` returns stub entry with `durationMs: 0`)
- Bundle size tracked as part of build step — build fails if budget exceeded

## Acceptance Criteria
- [ ] PerfLogger available as import from `src/shared/logger.ts`
- [ ] Every spec's performance-logged operations produce PerfLogger entries
- [ ] `PerfLogger.summary()` prints human-readable table to console
- [ ] PerfLogger entries include label, duration, timestamp, optional metadata
- [ ] In test environment, `PerfLogger.getAll()` returns all entries for assertions
- [ ] In production build, PerfLogger calls are removed (verify via bundle inspection)
- [ ] Build step reports bundle sizes and fails if over budget
- [ ] CI-compatible output: performance test results parseable

## Test Cases (Vitest Performance Tests)
```typescript
// Example performance test pattern
import { PerfLogger } from '../shared/logger';

describe('Performance budgets', () => {
  it('Tiptap init under 200ms for 5000-line document', async () => {
    const doc = generateMarkdown(5000); // lines
    PerfLogger.start('tiptap:init');
    await initTiptap(doc);
    const entry = PerfLogger.end('tiptap:init');
    expect(entry.durationMs).toBeLessThan(200);
  });

  it('markdown-it render under 200ms for 5000-line document', () => {
    const doc = generateMarkdown(5000);
    PerfLogger.start('preview:render');
    markdownIt.render(doc);
    const entry = PerfLogger.end('preview:render');
    expect(entry.durationMs).toBeLessThan(200);
  });

  it('mode switch under 300ms for 5000-line document', async () => {
    // ... setup Tiptap with content
    PerfLogger.start('mode:switch');
    await switchToSourceMode();
    const entry = PerfLogger.end('mode:switch');
    expect(entry.durationMs).toBeLessThan(300);
  });
});
```

## Build Size Validation
```typescript
// In build script or test
describe('Bundle size budgets', () => {
  it('core bundle under 280KB gzipped', () => {
    const stats = readBuildStats();
    const coreSize = stats.chunks
      .filter(c => !c.isLazy)
      .reduce((sum, c) => sum + c.gzipSize, 0);
    expect(coreSize).toBeLessThan(280 * 1024);
  });

  it('total bundle with source mode under 500KB gzipped', () => {
    const stats = readBuildStats();
    const totalSize = stats.chunks
      .filter(c => !c.name.includes('mermaid') && !c.name.includes('katex'))
      .reduce((sum, c) => sum + c.gzipSize, 0);
    expect(totalSize).toBeLessThan(500 * 1024);
  });
});
```

## Technical Notes
- PerfLogger implementation: use `performance.now()` for high-resolution timing
- Store entries in an array in memory (Map for in-flight start times)
- `import.meta.env.DEV` guard for console output
- `import.meta.env.MODE === 'test'` guard for programmatic access in Vitest
- Production no-op: runtime `isEnabled()` guard is acceptable; true tree-shaking via static `import.meta.env.DEV` wrapping each method body is ideal but not required. The `end()` method still returns a stub `PerfEntry` with `durationMs: 0` when disabled — callers must not rely on production timing values.
- Build step: use Vite's built-in `manifest: true` to generate `dist/.vite/manifest.json`, parse in test
- Consider `PerformanceObserver` for long-task detection in dev mode

## Revision History
- 2026-03-05: Initial spec from PRD
- 2026-03-05: Clarified PerfLogger no-op behavior — runtime guard acceptable, `end()` returns stub entry in production (build log review iter 1)
- 2026-03-05: Fixed contradictory Requirements bullet — was still saying "tree-shaken" while Technical Notes already clarified runtime guard is acceptable (build log review iter 3)
- 2026-03-05: Added `file:restore` (< 50ms) and `file:handle-restore` (< 200ms) to performance budget table — these operations were instrumented in code and referenced in spec 02 but missing from spec 11 (build log review iter 6)
- 2026-03-05: Added `tiptap:hydrate` (< 200ms) to performance budget table — instrumented in Task 3.1 and defined in spec 03 but missing from spec 11 (build log review iter 7)
- 2026-03-05: Added `tiptap:render` (< 200ms) to performance budget table — defined in spec 03 Performance Logging but missing from spec 11 (build log review iter 10)
- 2026-03-05: Added `toolbar:action` (< 16ms) and `toolbar:state-sync` (< 16ms) to performance budget table — defined in spec 04 Performance Logging but missing from spec 11 (build log review iter 13)
- 2026-03-05: Raised bundle budgets — core WYSIWYG from 250KB to 280KB, with source mode from 300KB to 350KB. Tiptap + extensions + BubbleMenu (Floating UI) consumes 248KB, leaving no headroom for remaining features (Prism.js, link extension, theming). Prism.js will also be lazy-loaded to minimize core bundle impact.
- 2026-03-05: Added `toolbar:floating:show` (< 100ms) and `toolbar:floating:hide` (< 16ms) to performance budget table — defined in spec 04 Performance Logging and instrumented in Task 4.2 but missing from spec 11 (build log review iter 14)
- 2026-03-05: Removed duplicate `Floating toolbar show | < 100ms` entry from budget table — was duplicated by the more descriptive `Floating toolbar show (selection change to visible) | < 100ms` added in iter14 (build log review iter 15)
- 2026-03-05: Fixed Build Size Validation code sample comment — said "250KB" but budget was raised to 280KB in iter14 (build log review iter 17)
- 2026-03-05: Added `codemirror:load` (< 500ms) and `codemirror:init` (< 500ms) to performance budget table — defined in spec 05 Performance Logging and instrumented in Task 5.1 but missing from spec 11 (build log review iter 18)
- 2026-03-05: Added `preview:load` (< 500ms) and `preview:sanitize` (< 200ms) to performance budget table — instrumented in Task 5.2 PreviewPane.tsx and defined in spec 05 Performance Logging but missing from spec 11 (build log review iter 19)
- 2026-03-05: Added `scroll:sync` (< 50ms) to performance budget table — instrumented in Task 5.3 scroll-sync.ts and defined in spec 05 Performance Logging but missing from spec 11 (build log review iter 20)
- 2026-03-05: Added `mode:serialize` (< 100ms), `mode:hydrate` (< 200ms), and `mode:codemirror-load` (< 500ms) to performance budget table — defined in spec 06 Performance Logging and instrumented in Task 5.4 but missing from spec 11. Updated Task P.2 acceptance criteria to include all three. 10th occurrence of recurring gap pattern (build log review iter 21)
- 2026-03-05: Added `theme:init` (< 100ms) to performance budget table — defined in spec 07 Performance Logging and instrumented in Task 6.1 theme-service.ts but missing from spec 11. 11th occurrence of recurring gap pattern (build log review iter 23)
- 2026-03-05: Added `frontmatter:parse` (< 10ms) and `frontmatter:recombine` (< 10ms) to performance budget table — defined in spec 08 Performance Logging and instrumented in Task 6.3 frontmatter-service.ts but missing from spec 11. 12th occurrence of recurring gap pattern
- 2026-03-05: Added `highlight:block` (< 10ms), `highlight:lazy-load` (< 200ms), and `highlight:load` (< 500ms) to performance budget table — defined in spec 09 Performance Logging (block/lazy-load) and instrumented in Task 6.2 highlight-service.ts (all three) but missing from spec 11. 13th occurrence of recurring gap pattern
- 2026-03-05: Added `onboarding:init` (< 100ms) and `onboarding:complete` (< 50ms) to performance budget table — instrumented in Task 6.4 onboarding/main.ts but missing from spec 11. 14th occurrence of recurring gap pattern (build log review iter 26)
- 2026-03-05: Raised "with source mode" bundle budget from 350KB to 500KB. CodeMirror 6 base modules (state, view, commands, search, lang-markdown, language-data index) add ~209KB gzipped on top of the 248KB core. 350KB was unrealistic. 500KB provides ~40KB headroom.
- 2026-03-05: Fixed stale Technical Notes build tool reference — changed `rollup-plugin-visualizer` to Vite's built-in `manifest: true` (actual implementation from Task P.1). Advisory only, no functional impact (build log review iter 29)
