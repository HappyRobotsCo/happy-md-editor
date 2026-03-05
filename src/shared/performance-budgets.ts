/**
 * Performance Budget Registry — Single source of truth for all timing budgets.
 * Defined in specs/11-performance-monitoring.md.
 *
 * Individual feature tests assert their own budgets inline.
 * The centralized budget test (performance-budgets.test.ts) validates
 * that this registry is complete and consistent.
 */

export interface PerformanceBudget {
  /** PerfLogger label */
  label: string;
  /** Maximum allowed duration in milliseconds */
  budgetMs: number;
  /** Human-readable description */
  description: string;
  /** Which test file validates this budget */
  testedIn: string;
}

/**
 * Complete performance budget registry from spec 11.
 * Every timed operation in the system must have an entry here.
 */
export const PERFORMANCE_BUDGETS: PerformanceBudget[] = [
  // Extension lifecycle
  { label: 'extension:init', budgetMs: 500, description: 'Tab open to interactive', testedIn: 'e2e (Task 7.1)' },

  // File operations
  { label: 'file:open', budgetMs: 100, description: 'Picker close to content in editor (files < 1MB)', testedIn: 'file-service.test.ts' },
  { label: 'file:save', budgetMs: 100, description: 'Trigger to writable.close (files < 1MB)', testedIn: 'file-service.test.ts' },
  { label: 'file:autosave', budgetMs: 50, description: 'Auto-save to IndexedDB', testedIn: 'autosave-service.test.ts' },
  { label: 'file:restore', budgetMs: 50, description: 'Restore from IndexedDB', testedIn: 'autosave-service.test.ts' },
  { label: 'file:handle-restore', budgetMs: 200, description: 'FileHandle restore + permission re-grant', testedIn: 'handle-service.test.ts' },

  // Tiptap editor
  { label: 'tiptap:init', budgetMs: 200, description: 'Markdown string to editor ready (docs < 10k lines)', testedIn: 'TiptapEditor.test.tsx' },
  { label: 'tiptap:serialize', budgetMs: 100, description: 'Editor state to markdown (docs < 10k lines)', testedIn: 'TiptapEditor.roundtrip.test.tsx' },
  { label: 'tiptap:render', budgetMs: 200, description: 'Process update and re-render (docs < 10k lines)', testedIn: 'TiptapEditor.test.tsx' },
  { label: 'tiptap:hydrate', budgetMs: 200, description: 'Load new content into existing editor (docs < 10k lines)', testedIn: 'TiptapEditor.test.tsx' },

  // Toolbar
  { label: 'toolbar:action', budgetMs: 16, description: 'Button click to editor state updated', testedIn: 'Toolbar.test.tsx' },
  { label: 'toolbar:state-sync', budgetMs: 16, description: 'Compute active states from cursor', testedIn: 'Toolbar.test.tsx' },
  { label: 'toolbar:floating:show', budgetMs: 100, description: 'Selection change to visible', testedIn: 'FloatingToolbar.test.tsx' },
  { label: 'toolbar:floating:hide', budgetMs: 16, description: 'Dismiss floating toolbar', testedIn: 'FloatingToolbar.test.tsx' },

  // Mode switching
  { label: 'mode:switch', budgetMs: 300, description: 'Button click to new mode ready (docs < 10k lines)', testedIn: 'ModeSwitching.test.tsx' },
  // Note: "mode switch first time < 800ms" in spec is mode:switch on first invocation (includes codemirror:load)
  { label: 'mode:serialize', budgetMs: 100, description: 'Tiptap → markdown for mode switch (docs < 10k lines)', testedIn: 'ModeSwitching.test.tsx' },
  { label: 'mode:hydrate', budgetMs: 200, description: 'Markdown → Tiptap for mode switch (docs < 10k lines)', testedIn: 'ModeSwitching.test.tsx' },
  // Note: "mode:codemirror-load < 500ms" in spec maps to codemirror:load label

  // Theme
  { label: 'theme:switch', budgetMs: 50, description: 'Theme switch', testedIn: 'theme-service.test.ts' },
  { label: 'theme:init', budgetMs: 100, description: 'Detect OS preference + apply', testedIn: 'theme-service.test.ts' },

  // Preview
  { label: 'preview:render', budgetMs: 200, description: 'Keystroke to DOM update (docs < 10k lines)', testedIn: 'PreviewPane.test.tsx' },
  { label: 'preview:load', budgetMs: 500, description: 'Lazy-load markdown-it + DOMPurify', testedIn: 'PreviewPane.test.tsx' },
  { label: 'preview:sanitize', budgetMs: 200, description: 'DOMPurify pass (docs < 10k lines)', testedIn: 'PreviewPane.test.tsx' },

  // Syntax highlighting
  { label: 'highlight:page', budgetMs: 100, description: 'Highlight all code blocks', testedIn: 'highlight-service.test.ts' },
  { label: 'highlight:block', budgetMs: 10, description: 'Highlight single code block', testedIn: 'highlight-service.test.ts' },
  { label: 'highlight:lazy-load', budgetMs: 200, description: 'Load additional language', testedIn: 'highlight-service.test.ts' },
  { label: 'highlight:load', budgetMs: 500, description: 'Initial Prism + default languages', testedIn: 'highlight-service.test.ts' },

  // CodeMirror
  { label: 'codemirror:load', budgetMs: 500, description: 'Lazy-load CodeMirror bundle', testedIn: 'SourceEditor.test.tsx' },
  { label: 'codemirror:init', budgetMs: 500, description: 'Create editor with content', testedIn: 'SourceEditor.test.tsx' },

  // Scroll
  { label: 'scroll:sync', budgetMs: 50, description: 'Compute and apply scroll position', testedIn: 'scroll-sync.test.ts' },

  // Frontmatter
  { label: 'frontmatter:parse', budgetMs: 10, description: 'Extract frontmatter block', testedIn: 'frontmatter-service.test.ts' },
  { label: 'frontmatter:recombine', budgetMs: 10, description: 'Prepend frontmatter on save', testedIn: 'frontmatter-service.test.ts' },

  // Onboarding
  { label: 'onboarding:init', budgetMs: 100, description: 'Theme detect + DOM setup', testedIn: 'onboarding.test.ts' },
  { label: 'onboarding:complete', budgetMs: 50, description: 'Store flag + close', testedIn: 'onboarding.test.ts' },

  // Lazy features
  { label: 'lazy:feature-load', budgetMs: 500, description: 'Lazy feature load (Mermaid/KaTeX)', testedIn: 'e2e (future)' },
];

/**
 * Look up the budget for a PerfLogger label.
 * Returns undefined if no budget is defined.
 */
export function getBudget(label: string): number | undefined {
  const entry = PERFORMANCE_BUDGETS.find((b) => b.label === label);
  return entry?.budgetMs;
}
