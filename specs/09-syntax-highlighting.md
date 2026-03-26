# Spec: Syntax Highlighting in Code Blocks

## Job to Be Done
User sees properly syntax-highlighted code blocks in both the WYSIWYG view and the source mode preview.

## Requirements
- Prism.js for syntax highlighting in rendered code blocks (F-22)
- Default languages bundled: JavaScript, TypeScript, Python, Bash, HTML, CSS, JSON, SQL, Go, Rust
- Additional languages lazy-loaded on demand
- Copy button on each code block (F-23 — Phase 2)
- Code blocks in Tiptap WYSIWYG use `@tiptap/extension-code-block-lowlight` or Prism integration
- Code blocks in source mode preview highlighted by Prism post-render
- Language label shown on code block (e.g., "javascript" in top-right corner)
- Syntax highlighting themes match the active light/dark theme

## Performance Logging
- `highlight:load` — time to load Prism.js core + default languages (initial load)
- `highlight:block` — time to highlight a single code block
- `highlight:page` — total time to highlight all code blocks on a page render
- `highlight:lazy-load` — time to load an additional language module
- Log language name and code length alongside timings

## Acceptance Criteria
- [ ] JavaScript code block renders with correct keyword coloring
- [ ] Python code block renders with correct syntax colors
- [ ] Unknown language renders as plain monospace text (no error)
- [ ] Code blocks in WYSIWYG view are highlighted
- [ ] Code blocks in source mode preview are highlighted
- [ ] Highlighting all code blocks on a page < 100ms for typical documents
- [ ] Language label visible on code blocks
- [ ] Syntax colors appropriate for light and dark themes

## Test Cases
| Input | Expected Output |
|-------|-----------------|
| ` ```javascript\nconst x = 1;\n``` ` | `const` highlighted as keyword |
| ` ```python\ndef foo():\n  pass\n``` ` | `def` highlighted as keyword |
| ` ```\nplain text\n``` ` | Rendered as monospace, no highlighting |
| ` ```unknownlang\ncode\n``` ` | Rendered as monospace, no error |
| Document with 20 code blocks | `highlight:page` < 100ms |
| Request for `ruby` highlighting | Language lazy-loaded, then highlighted |

## Technical Notes
- Bundle only default 10 languages (JS, TS, Python, Bash, HTML, CSS, JSON, SQL, Go, Rust)
- Use dynamic `import()` for additional languages: `import('prismjs/components/prism-ruby')`
- Prism operates on DOM post-render — call `Prism.highlightElement()` on each `<code>` block
- For Tiptap: use lowlight (highlight.js-based) via `@tiptap/extension-code-block-lowlight`, OR create custom Prism-based extension
- Copy button: added as overlay on code block, copies raw code to clipboard

## Revision History
- 2026-03-05: Initial spec from PRD
- 2026-03-05: Added `highlight:load` to Performance Logging — implemented in highlight-service.ts but missing from original spec (build log review iter25)
