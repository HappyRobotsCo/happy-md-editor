# Spec: Mode Switching

## Job to Be Done
User switches seamlessly between WYSIWYG, split-source, and source-only editing modes without losing content or position.

## Requirements
- Three modes: WYSIWYG (default), Split Source, Source Only (F-29, F-29a, F-29b)
- Mode switcher buttons in the toolbar (F-30)
- Keyboard shortcut: Cmd/Ctrl+\\ cycles through modes
- WYSIWYG → Source: serialize Tiptap to markdown, load into CodeMirror
- Source → WYSIWYG: parse CodeMirror content, hydrate Tiptap
- Content integrity: switching modes never loses or corrupts content
- User's preferred mode persisted in `chrome.storage.local` across sessions
- Cursor position mapped approximately between modes (F-30a — Phase 3, but foundation laid now)

## Performance Logging
- `mode:switch` — total time from button click to new mode rendered and interactive
- `mode:serialize` — time to serialize Tiptap → markdown (WYSIWYG → Source)
- `mode:hydrate` — time to parse markdown → Tiptap (Source → WYSIWYG)
- `mode:codemirror-load` — time to lazy-load CodeMirror (first switch only)
- Log document size and direction (e.g., "wysiwyg→source", "source→wysiwyg")

## Acceptance Criteria
- [ ] Clicking WYSIWYG button shows Tiptap editor full-width
- [ ] Clicking Split Source button shows CodeMirror left + preview right
- [ ] Clicking Source Only button shows CodeMirror full-width
- [ ] Content is identical after round-trip: WYSIWYG → Source → WYSIWYG
- [ ] Cmd/Ctrl+\\ cycles through all three modes
- [ ] Preferred mode persists across browser sessions
- [ ] Mode switch completes within 300ms for documents under 10,000 lines
- [ ] First-time source mode switch (with lazy load) completes within 800ms
- [ ] Active mode button is visually distinct in toolbar
- [ ] No flash of unstyled content during mode switch

## Test Cases
| Input | Expected Output |
|-------|-----------------|
| Type in WYSIWYG, switch to Source | Markdown source contains typed text |
| Edit in Source, switch to WYSIWYG | Rendered view shows edits |
| WYSIWYG → Source → WYSIWYG (10 cycles) | Content identical every time |
| Switch to Source mode, reload extension | Source mode restored from preferences |
| Large document (5000 lines), switch modes | Switch completes within 300ms |
| First switch to Source (cold load) | CodeMirror loads + renders within 800ms |

## Technical Notes
- Mode state stored in React context or zustand store
- Tiptap markdown serialization via `tiptap-markdown` extension
- CodeMirror content set via `EditorView.dispatch()` with full replacement
- Prevent update loops: guard against re-serialization triggered by hydration
- UI transition: consider brief opacity fade (100ms) to prevent visual jank

## Revision History
- 2026-03-05: Initial spec from PRD
