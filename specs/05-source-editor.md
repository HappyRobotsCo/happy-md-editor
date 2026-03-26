# Spec: CodeMirror Source Editor

## Job to Be Done
User can edit raw markdown source directly with syntax highlighting, line numbers, and a live preview pane.

## Requirements
- CodeMirror 6 as the source editor (F-12)
- Markdown syntax highlighting (F-12a)
- Line numbers, active line highlighting, bracket matching (F-12b)
- Lazy-loaded — CodeMirror bundle only fetched when user switches to source mode
- Source mode layouts: split-pane (editor left, preview right) or source-only (F-29a, F-29b)
- Preview pane rendered by markdown-it with DOMPurify sanitization
- Scroll synchronization between source editor and preview via line-anchored mapping (F-21)
- Real-time preview updates debounced at 150ms (F-20)
- Formatting toolbar wraps selection with markdown notation in source mode (F-13)
- Find and replace via Cmd/Ctrl+F, Cmd/Ctrl+H (F-15)

## Performance Logging
- `codemirror:init` — time to initialize CodeMirror with content
- `codemirror:load` — time to lazy-load the CodeMirror bundle
- `preview:render` — time for markdown-it to parse and render to HTML
- `preview:sanitize` — time for DOMPurify to sanitize the HTML
- `scroll:sync` — time to compute and apply scroll synchronization
- Log document size alongside each timing

## Acceptance Criteria
- [ ] CodeMirror loads within 500ms on first mode switch (lazy-load + init)
- [ ] Markdown syntax highlighting shows headings, bold, italic, code, links in distinct colors
- [ ] Line numbers visible on left gutter
- [ ] Active line has distinct background color
- [ ] Preview pane updates within 200ms of keystroke (NF-2)
- [ ] Scrolling editor scrolls preview to corresponding section
- [ ] Scrolling preview scrolls editor to corresponding section
- [ ] Cmd/Ctrl+F opens find bar, Cmd/Ctrl+H opens find-and-replace
- [ ] Selecting text and pressing Cmd+B wraps with `**` in source
- [ ] Source mode bundle adds < 60KB gzipped to loaded size

## Scroll Sync Test Cases
| Action | Expected |
|--------|----------|
| Scroll source to line 50 | Preview shows content around line 50 |
| Scroll preview to a heading | Source scrolls to that heading's line |
| Rapid scrolling in source | Preview follows without jank (debounced) |
| Document with images (tall preview) | Scroll positions approximate, no jumps |

## Technical Notes
- Use `@codemirror/lang-markdown` for syntax highlighting
- Use `@codemirror/search` for find/replace
- Use `@codemirror/view` EditorView.lineBlockAt() for scroll sync mapping
- Preview rendering: markdown-it with `data-source-line` annotations per block element
- Scroll sync: map visible source lines to `[data-source-line]` elements in preview
- DOMPurify config: allow standard HTML tags, strip `<script>`, `<style>`, `on*` attributes

## Revision History
- 2026-03-05: Initial spec from PRD
