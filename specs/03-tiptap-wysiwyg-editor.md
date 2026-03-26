# Spec: Tiptap WYSIWYG Editor

## Job to Be Done
User edits markdown directly in the rendered view as if it were a document editor, with all changes serialized back to valid markdown.

## Requirements
- Tiptap editor as the default editing experience (F-11)
- Markdown loaded into Tiptap via tiptap-markdown extension for parsing
- Tiptap serializes editor state back to markdown on every change (F-11a)
- Markdown is the source of truth — what gets saved to disk is the serialized markdown, not HTML
- GFM support: tables, task lists, strikethrough, autolinks (via Tiptap extensions)
- Standard editing: typing, deleting, selecting, copy/paste, undo/redo
- List behavior: Enter creates new item, Enter on empty exits list, Tab/Shift-Tab indent/outdent (F-11g)
- Checkbox interactivity: clicking a task list checkbox toggles it (F-27)
- Code blocks render with syntax highlighting (Prism.js integration)
- Keyboard shortcuts: Cmd/Ctrl+B (bold), Cmd/Ctrl+I (italic), Cmd/Ctrl+K (link), etc. (F-14)

## Performance Logging
- `tiptap:init` — time from markdown string to Tiptap editor ready
- `tiptap:serialize` — time to serialize Tiptap state to markdown string
- `tiptap:render` — time for Tiptap to process an update and re-render
- `tiptap:hydrate` — time to load new markdown content into existing editor
- Log document size (character count) alongside each timing

## Acceptance Criteria
- [ ] Markdown file loads into Tiptap and renders as formatted document
- [ ] User can click into text and type — changes reflected immediately
- [ ] Cmd/Ctrl+B wraps selected text with `**` in serialized markdown
- [ ] Cmd/Ctrl+I wraps selected text with `*` in serialized markdown
- [ ] Pressing Enter in a list creates a new list item
- [ ] Pressing Enter on empty list item exits the list
- [ ] Tab indents list item, Shift+Tab outdents
- [ ] Clicking a task list checkbox toggles `- [ ]` to `- [x]` in markdown
- [ ] Undo/redo works (Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z)
- [ ] Copy-pasting markdown from external source preserves formatting
- [ ] Tiptap init time < 200ms for documents under 10,000 lines
- [ ] Markdown serialization time < 100ms for documents under 10,000 lines

## Markdown Round-Trip Test Cases
| Markdown Input | After Edit + Serialize | Fidelity |
|---|---|---|
| `# Heading 1` | `# Heading 1` | Exact |
| `**bold**` | `**bold**` | Exact |
| `*italic*` | `*italic*` | Exact |
| `~~strikethrough~~` | `~~strikethrough~~` | Exact |
| `` `inline code` `` | `` `inline code` `` | Exact |
| `[link](url)` | `[link](url)` | Exact |
| `- [ ] task` / `- [x] task` | Preserved | Exact |
| `> blockquote` | `> blockquote` | Exact |
| Fenced code block with language | Preserved with language tag | Exact |
| GFM table with alignment | Preserved with `---`, `:---:` | Best effort |
| Nested list (3 levels) | Indentation preserved | Exact |
| `---` (horizontal rule) | `---` | Exact |
| Mixed bold+italic `***text***` | `***text***` or equivalent | Acceptable |
| Raw HTML `<details>` | Preserved or stripped with warning | Documented |
| YAML frontmatter | Never passes through Tiptap — handled by gray-matter | N/A |

## Technical Notes
- Use `@tiptap/starter-kit` for base extensions (bold, italic, heading, list, etc.)
- Use `tiptap-markdown` package for markdown parsing and serialization
- Use `@tiptap/extension-task-list` and `@tiptap/extension-task-item` for task lists
- Use `@tiptap/extension-table`, `@tiptap/extension-table-row`, `@tiptap/extension-table-cell` for tables
- Use `@tiptap/extension-code-block-lowlight` with Prism for syntax highlighting
- Frontmatter is stripped before loading into Tiptap and prepended on save (see spec 08)
- Consider `tiptap-markdown` options for strict mode to maximize round-trip fidelity

## Revision History
- 2026-03-05: Initial spec from PRD
- 2026-03-05: Added cross-reference to spec 12 (scroll stability) — viewport jump on backspace/delete identified during demo testing. Scroll guard implemented in `scroll-guard.ts`, validated via Playwright e2e tests.
