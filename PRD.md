# Product Requirements Document: MarkDown Studio

## Chrome Extension for Viewing, Editing, and Saving Markdown Files

**Version:** 1.0
**Date:** March 5, 2026
**Status:** Draft

---

## 1. Problem Statement

There is no Chrome extension that lets users open a local markdown file, edit it, and save changes back to the original file. The market is split between viewers (excellent rendering, zero editing) and editors (basic editing, no file persistence). Users are forced into a fragmented workflow: preview markdown in a Chrome extension, switch to VS Code or another desktop editor to make changes, then manually reload.

This gap is well-documented across Chrome Web Store reviews, Reddit, Hacker News, and GitHub issues. It is the single most requested feature across all markdown Chrome extensions.

### Why This Gap Exists

The common belief is that Chrome extensions cannot write to local files. This is mostly incorrect. The File System Access API (`showOpenFilePicker`, `createWritable`) works within extension tab pages served from `chrome-extension://` URLs. No existing extension has leveraged this capability for markdown editing.

---

## 2. Product Vision

**MarkDown Studio** is a free, open-source Chrome extension that treats markdown as a first-class editable document format. Open a file, edit with live preview, save back to disk. One tool, zero friction.

### Design Principles

1. **It just works.** No hidden permission toggles, no registration walls, no broken features. If we ship it, it works.
2. **Edit where you read.** Users can edit directly in the rendered preview — click text, type, apply formatting from a toolbar — and the underlying markdown source stays in sync. Source editing is always available for power users, but the default experience is WYSIWYG.
3. **Your files, your disk.** Files are opened from and saved to the local filesystem. No cloud accounts, no vendor lock-in, no data collection.
4. **Earn trust, keep trust.** Open source. Minimal permissions. No paywalls. No monetization bait-and-switch. No analytics or tracking.
5. **Ship what's reliable.** Only advertise features that actually work. No "supports Mermaid" if Mermaid is half-broken.

---

## 3. Target Users

### Primary: Developer / Technical Writer

- Works with `.md` files daily (READMEs, docs, specs, blog posts)
- Currently uses VS Code with markdown preview, but wants something lighter for quick edits
- Values keyboard shortcuts, split-view, and source-level editing
- Expects GFM support (tables, task lists, fenced code blocks)
- Often works with frontmatter (YAML) for static site generators

### Secondary: Knowledge Worker

- Uses markdown for notes, meeting agendas, personal docs
- Less technical but comfortable with Chrome
- Values clean rendering, dark mode, and easy export
- May not know what "GFM" means but expects tables and checklists to render

### Tertiary: Student / Academic

- Writes documentation, papers, or notes in markdown
- Needs math equation rendering (LaTeX)
- Needs diagram support (Mermaid)
- Values PDF/HTML export for submissions

---

## 4. User Stories

### File Operations

- **US-1:** As a user, I can open a local `.md` file from disk using a file picker, so I can view and edit it in the extension.
- **US-2:** As a user, I can save my edits back to the original file on disk with Cmd/Ctrl+S, so my changes persist without leaving Chrome.
- **US-3:** As a user, I can use "Save As" to write to a new file location, so I can create copies or rename files.
- **US-4:** As a user, I can drag and drop a `.md` file onto the extension tab to open it.
- **US-5:** As a user, I can open recent files from a list, so I don't have to navigate the file picker every time.

### Viewing

- **US-6:** As a user, I see rendered markdown in a preview pane that updates in real-time as I type.
- **US-7:** As a user, scrolling the editor scrolls the preview to the corresponding position (and vice versa).
- **US-8:** As a user, I can toggle between split-pane (editor + preview), preview-only, and editor-only modes.
- **US-9:** As a user, code blocks in the preview are syntax-highlighted with copy buttons.
- **US-10:** As a user, I can switch between light and dark themes, and the extension respects my OS preference by default.

### WYSIWYG Editing (Rendered Mode)

- **US-11:** As a user, I can click into the rendered preview and edit text directly — typing, deleting, and navigating — as if it were a document editor.
- **US-11a:** As a user, when I edit in the rendered view, the underlying markdown source is updated in real-time with correct markdown notation (not HTML).
- **US-11b:** As a user, I can select text in the rendered view and apply formatting (bold, italic, heading, link, code, etc.) from a floating toolbar or the main toolbar, and the extension wraps my selection with the correct markdown syntax (e.g., `**bold**`, `*italic*`, `[text](url)`).
- **US-11c:** As a user, I can see which formatting is active on my current selection — the toolbar highlights the bold button when my cursor is inside `**bold**` text, the italic button when inside `*italic*` text, etc.
- **US-11d:** As a user, I can toggle formatting off by clicking an active toolbar button — e.g., clicking the bold button when inside bold text removes the `**` markers.
- **US-11e:** As a user, I can create new headings, lists, blockquotes, code blocks, and tables from the toolbar or slash command menu while editing in the rendered view.
- **US-11f:** As a user, I can press Enter in a list item to create a new list item, and press Enter twice to exit the list — matching behavior I expect from document editors.
- **US-11g:** As a user, I can tab/shift-tab to indent and outdent list items and nested content in the rendered view.

### Source Editing (Code Mode)

- **US-12:** As a user, I can switch to a source editor with syntax highlighting, line numbers, and bracket matching to edit the raw markdown directly.
- **US-12a:** As a user, I have a toolbar for common formatting actions (bold, italic, heading, link, image, code block, list, task list, table, blockquote) that works in both rendered and source editing modes.
- **US-13:** As a user, I can use standard keyboard shortcuts for formatting (Cmd/Ctrl+B for bold, Cmd/Ctrl+I for italic, etc.) in both editing modes.

### Editing (General)

- **US-14:** As a user, I can find and replace text within the document using Cmd/Ctrl+F / Cmd/Ctrl+H.
- **US-15:** As a user, I have full undo/redo support that works across both editing modes — undoing in rendered mode reverts the corresponding markdown change.
- **US-16:** As a user, my unsaved work is auto-saved to browser storage every few seconds, so I don't lose progress if Chrome crashes.

### Content Features

- **US-17:** As a user, GFM features render correctly: tables, task lists, strikethrough, autolinks, footnotes.
- **US-18:** As a user, fenced code blocks render with syntax highlighting for common languages.
- **US-19:** As a user, YAML frontmatter is preserved when editing and not rendered in the preview (or shown in a collapsible metadata panel).
- **US-20:** As a user, Mermaid diagram code blocks render as diagrams in the preview.
- **US-21:** As a user, LaTeX math expressions render in the preview (both inline `$...$` and block `$$...$$`).

### Navigation

- **US-22:** As a user, I can see a table of contents generated from headings, and click entries to navigate.
- **US-23:** As a user, I see word count and estimated reading time.
- **US-24:** As a user, I can browse a folder of markdown files in a sidebar after opening a directory.

### Export

- **US-25:** As a user, I can export the rendered document as HTML.
- **US-26:** As a user, I can export the rendered document as PDF (via browser print).
- **US-27:** As a user, I can copy the rendered HTML to clipboard for pasting into other tools.

### file:// URL Interception

- **US-28:** As a user, when I open a `file://.../*.md` URL in Chrome, the extension renders it automatically (if I've granted file access permission).
- **US-29:** As a user, the extension guides me through enabling "Allow access to file URLs" on first install with clear instructions.

---

## 5. Functional Requirements

### 5.1 File System Integration

| Req | Description | Priority |
|-----|-------------|----------|
| F-1 | Open `.md` and `.markdown` files via File System Access API picker | P0 |
| F-2 | Save changes back to the original file handle via `createWritable()` | P0 |
| F-3 | "Save As" to a new file location via `showSaveFilePicker()` | P0 |
| F-4 | Auto-save editor state to IndexedDB every 2 seconds (debounced) | P0 |
| F-5 | Recover unsaved work from IndexedDB on extension reopen | P0 |
| F-6 | Drag-and-drop file import | P1 |
| F-7 | Recent files list (stored in `chrome.storage.local`, max 20 entries) | P1 |
| F-8 | Open directory for folder browsing sidebar | P2 |
| F-9 | Dirty state indicator (dot on tab title, unsaved badge) | P0 |
| F-10 | Prompt "unsaved changes" confirmation before closing tab | P0 |

### 5.2 WYSIWYG Editor (Rendered Mode — Default)

| Req | Description | Priority |
|-----|-------------|----------|
| F-11 | Tiptap-based WYSIWYG editor as the default editing experience, rendering markdown as formatted content the user edits directly | P0 |
| F-11a | Two-way markdown sync: edits in WYSIWYG update the markdown source; edits in source mode update the WYSIWYG view. Tiptap's markdown serializer ensures round-trip fidelity. | P0 |
| F-11b | Floating formatting toolbar appears on text selection with: bold, italic, strikethrough, code, link, heading level picker | P0 |
| F-11c | Fixed top toolbar with block-level actions: heading (1-6), unordered list, ordered list, task list, blockquote, code block, horizontal rule, table, image | P0 |
| F-11d | Active state indicators on toolbar buttons reflecting current cursor position formatting (e.g., bold button highlighted when cursor is in bold text) | P0 |
| F-11e | Toggle formatting: clicking an active toolbar button removes that formatting (e.g., click bold while in bold text removes `**` markers) | P0 |
| F-11f | Slash command menu: typing `/` at start of a line shows a dropdown to insert headings, lists, code blocks, tables, horizontal rules, images | P1 |
| F-11g | List continuation: Enter in a list item creates new item; Enter on empty item exits list. Tab/Shift-Tab indents/outdents. | P0 |
| F-11h | Table editing: click into a table to edit cells directly; add/remove rows and columns via toolbar or context menu | P1 |
| F-11i | Link editing: clicking a link shows a popover to edit URL and text; Cmd/Ctrl+K opens link editor on selection | P0 |
| F-11j | Image display: images render inline in WYSIWYG view; click to resize or edit alt text/URL | P1 |
| F-11k | Code block editing: fenced code blocks show as editable blocks with language selector dropdown | P1 |

### 5.3 Source Editor (Code Mode)

| Req | Description | Priority |
|-----|-------------|----------|
| F-12 | CodeMirror 6 as the source editor, available as an alternate mode | P0 |
| F-12a | Markdown syntax highlighting in source editor | P0 |
| F-12b | Line numbers, active line highlighting, bracket matching | P0 |
| F-13 | Formatting toolbar works in source mode too — wraps selection with markdown notation (e.g., `**`, `*`, `` ` ``, `[]()`) | P0 |
| F-14 | Keyboard shortcuts for all formatting actions, shared across both modes | P0 |
| F-15 | Find and replace (Cmd/Ctrl+F, Cmd/Ctrl+H) | P1 |
| F-16 | Vim keybinding mode (opt-in via settings, using @codemirror/vim) | P2 |
| F-17 | Emmet-style table generation (e.g., type `\|3x3` to scaffold a 3-column, 3-row table) | P2 |

### 5.4 Rendering & Content Features

| Req | Description | Priority |
|-----|-------------|----------|
| F-19 | markdown-it as the parser for source-to-preview rendering and initial WYSIWYG hydration | P0 |
| F-20 | Real-time preview updates in source mode (debounced at 150ms) | P0 |
| F-21 | Scroll synchronization between source editor and read-only preview (when in split source mode) | P0 |
| F-22 | Syntax highlighting in code blocks via Prism.js (JS, TS, Python, Bash, HTML, CSS, JSON, SQL, Go, Rust as defaults) | P0 |
| F-23 | Copy button on code blocks (in both WYSIWYG view and read-only preview) | P1 |
| F-24 | Mermaid diagram rendering (lazy-loaded) — rendered as non-editable blocks in WYSIWYG; user edits the mermaid source in a code block | P1 |
| F-25 | KaTeX math rendering for inline and block expressions (lazy-loaded) — rendered visually in WYSIWYG; user edits LaTeX source | P1 |
| F-26 | GitHub-style alerts/callouts (`> [!NOTE]`, `> [!WARNING]`, etc.) | P1 |
| F-27 | Checkbox interactivity: clicking a task list checkbox toggles it in both the visual view and the markdown source | P0 |
| F-28 | Image rendering for relative paths (resolved against file location) | P1 |

### 5.5 Layout & UI

| Req | Description | Priority |
|-----|-------------|----------|
| F-29 | Default mode: WYSIWYG editor (full-width rendered view with inline editing) | P0 |
| F-29a | Source mode: split-pane with CodeMirror left, read-only preview right | P0 |
| F-29b | Source-only mode: CodeMirror full-width, no preview | P0 |
| F-30 | Mode switcher in toolbar: WYSIWYG / Split Source / Source Only — toggle via toolbar buttons and keyboard shortcut (Cmd/Ctrl+\\) | P0 |
| F-30a | Switching modes preserves cursor position and scroll location as closely as possible | P1 |
| F-31 | Resizable split pane divider in source mode | P1 |
| F-32 | Light and dark themes | P0 |
| F-33 | Auto-detect OS color scheme preference; manual override available | P0 |
| F-34 | Table of contents sidebar (generated from headings, collapsible) — works in all modes | P1 |
| F-35 | Word count and reading time in status bar | P1 |
| F-36 | Folder browser sidebar (when directory opened) | P2 |
| F-37 | Responsive layout — usable at 800px minimum width | P1 |

### 5.6 Export

| Req | Description | Priority |
|-----|-------------|----------|
| F-38 | Export as styled HTML file (self-contained, inline CSS) | P1 |
| F-39 | Export as PDF via `window.print()` with print-optimized stylesheet | P1 |
| F-40 | Copy rendered HTML to clipboard | P1 |

### 5.7 file:// URL Handling

| Req | Description | Priority |
|-----|-------------|----------|
| F-41 | Content script intercepts `file://` URLs ending in `.md` or `.markdown` | P1 |
| F-42 | Intercepted files render in preview-only mode (read-only since file handle isn't available via content script) | P1 |
| F-43 | "Edit this file" button that opens the extension tab with the File System Access API picker pre-targeted | P1 |
| F-44 | First-run onboarding page that explains "Allow access to file URLs" with step-by-step visual guide | P0 |

### 5.8 Frontmatter

| Req | Description | Priority |
|-----|-------------|----------|
| F-45 | Parse YAML frontmatter via gray-matter; preserve it during editing | P0 |
| F-46 | Frontmatter hidden from preview by default | P0 |
| F-47 | Collapsible frontmatter metadata panel in editor (shows parsed key-value pairs) | P2 |

---

## 6. Non-Functional Requirements

### 6.1 Performance

| Req | Description |
|-----|-------------|
| NF-1 | Extension tab opens and is interactive within 500ms |
| NF-2 | Preview re-renders within 200ms of keystroke (for documents under 10,000 lines) |
| NF-3 | File open/save completes within 100ms for files under 1MB |
| NF-4 | Mermaid and KaTeX load on-demand; do not block initial render |
| NF-5 | Total core bundle under 250KB gzipped (WYSIWYG mode); under 300KB with source mode loaded |
| NF-6 | Lazy-loaded features (Mermaid, KaTeX, additional Prism languages) loaded in under 500ms |

### 6.2 Security & Privacy

| Req | Description |
|-----|-------------|
| NF-7 | Zero data collection: no analytics, no tracking, no telemetry |
| NF-8 | No network requests (all processing is local) |
| NF-9 | Rendered HTML is sanitized via DOMPurify to prevent XSS from malicious markdown |
| NF-10 | Minimal Chrome permissions: `storage`, `activeTab`. No `tabs`, no `history`, no `<all_urls>` |
| NF-11 | Content Security Policy: no `eval()`, no inline scripts, no remote resources |
| NF-12 | All dependencies vendored and bundled locally (no CDN loading) |

### 6.3 Compatibility

| Req | Description |
|-----|-------------|
| NF-13 | Chrome 120+ (File System Access API + Manifest V3) |
| NF-14 | Edge 120+ (Chromium-based, same APIs) |
| NF-15 | Brave (test and document any limitations) |
| NF-16 | Works on macOS, Windows, and Linux |
| NF-17 | Manifest V3 compliant |

### 6.4 Accessibility

| Req | Description |
|-----|-------------|
| NF-18 | All interactive elements keyboard-navigable |
| NF-19 | ARIA labels on toolbar buttons and UI controls |
| NF-20 | Sufficient color contrast in both light and dark themes (WCAG AA) |
| NF-21 | Screen reader compatible: preview pane uses semantic HTML (headings, lists, tables) |

---

## 7. Technical Architecture

### 7.1 Extension Structure

```
manifest.json              (Manifest V3)
background.js              (Service worker — minimal, handles extension icon click)
editor.html                (Full-page extension tab — main application)
editor.js                  (Editor app bundle)
content-script.js          (Intercepts file:// .md URLs)
onboarding.html            (First-run permission guide)
styles/
  light.css
  dark.css
  print.css
  preview-themes/
    github.css             (Default preview theme)
```

### 7.2 Core Dependencies

| Library | Role | Size (gzipped) | Loading |
|---------|------|-----------------|---------|
| Tiptap (core + starter-kit + markdown extension) | WYSIWYG editor with markdown round-tripping | ~100KB | Bundled |
| CodeMirror 6 (@codemirror/view, @codemirror/state, @codemirror/lang-markdown) | Source editor (alternate mode) | ~50KB | Lazy (loaded on mode switch) |
| markdown-it + plugins (gfm, task-lists, footnotes, front-matter, alerts) | Parser for Tiptap hydration + source mode preview | ~40KB | Bundled |
| Prism.js (core + 10 languages) | Code highlighting in preview + WYSIWYG code blocks | ~55KB | Bundled |
| gray-matter | Frontmatter parsing | ~8KB | Bundled |
| DOMPurify | HTML sanitization (for source mode preview) | ~7KB | Bundled |
| **Core total** | | **~210KB** (WYSIWYG only); **~260KB** (with source mode) | |
| Mermaid | Diagram rendering | ~150KB | Lazy |
| KaTeX + CSS | Math rendering | ~55KB | Lazy |

### 7.3 Data Flow

```
User opens file
  -> showOpenFilePicker() -> FileHandle
  -> FileHandle.getFile() -> File.text() -> markdown string
  -> gray-matter extracts frontmatter + body
  -> Store FileHandle in memory (for save)
  -> Store file path in chrome.storage.local (recent files)
  -> Load markdown into Tiptap via markdown extension (WYSIWYG mode)

User edits in WYSIWYG mode
  -> Tiptap dispatches update
  -> Tiptap markdown serializer -> markdown string (the source of truth)
  -> If source mode panel is open, sync markdown string to CodeMirror
  -> Debounce 2000ms -> auto-save to IndexedDB

User edits in source mode
  -> CodeMirror dispatches update
  -> Debounce 150ms -> update Tiptap content from markdown string
  -> Debounce 150ms -> markdown-it.render() -> preview pane HTML
  -> Debounce 2000ms -> auto-save to IndexedDB

User applies formatting via toolbar (either mode)
  -> WYSIWYG mode: Tiptap command (e.g., toggleBold) -> updates rich text + serializes markdown
  -> Source mode: wrap selection with markdown notation (e.g., **selection**)

User saves (Cmd/Ctrl+S)
  -> Tiptap markdown serializer -> final markdown string
  -> Prepend preserved frontmatter
  -> FileHandle.createWritable()
  -> writable.write(markdownString)
  -> writable.close()
  -> Clear dirty state indicator

Mode switching
  -> WYSIWYG -> Source: serialize Tiptap to markdown, load into CodeMirror
  -> Source -> WYSIWYG: parse CodeMirror content, hydrate Tiptap
  -> Cursor position mapped approximately between modes
```

### 7.4 Scroll Synchronization

Strategy: **Line-anchored mapping**

1. During markdown-it render, annotate each top-level block element with `data-source-line` attribute indicating the source line range.
2. On editor scroll, find the top visible source line.
3. In preview, find the element whose `data-source-line` contains that line number.
4. Scroll preview to align that element with the viewport top.
5. Reverse direction: on preview scroll, map DOM position back to source line and scroll editor.
6. Debounce both directions to prevent feedback loops.

### 7.5 Manifest V3 Considerations

- **Service worker:** Minimal. Handles `chrome.action.onClicked` to open editor tab. No persistent state.
- **State persistence:** All editor state in IndexedDB (accessed from editor.html page context). Recent files in `chrome.storage.local`.
- **Content script:** Lightweight. Detects `file://` URLs ending in `.md`, replaces page content with rendered preview + "Edit in MarkDown Studio" button.
- **CSP:** `script-src 'self'; style-src 'self' 'unsafe-inline'` — inline styles needed for Mermaid SVG output and KaTeX rendering.

---

## 8. Phased Delivery

### Phase 1: MVP — WYSIWYG Edit + Save

**Goal:** The core loop works reliably. A user opens a markdown file, edits it directly in the rendered view, and saves back to disk. This is the experience no Chrome extension offers today.

**Scope:**
- File open/save/save-as via File System Access API (F-1, F-2, F-3)
- Auto-save to IndexedDB + crash recovery (F-4, F-5)
- Dirty state indicator + close confirmation (F-9, F-10)
- Tiptap WYSIWYG editor as default mode (F-11)
- Two-way markdown sync — Tiptap serializes edits back to proper markdown notation (F-11a)
- Floating toolbar on text selection: bold, italic, strikethrough, code, link, heading picker (F-11b)
- Fixed toolbar with block actions: heading, lists, blockquote, code block, table, image, HR (F-11c)
- Active state indicators on toolbar buttons (F-11d, F-11e)
- List continuation and indent/outdent (F-11g)
- Link editing popover (F-11i)
- Keyboard shortcuts for all formatting (F-14)
- Checkbox interactivity — click to toggle (F-27)
- Prism.js syntax highlighting in code blocks (F-22)
- Light/dark theme with OS auto-detect (F-32, F-33)
- Frontmatter preservation — hidden from rendered view (F-45, F-46)
- Mode switcher: WYSIWYG / Source+Preview / Source Only (F-29, F-29a, F-29b, F-30)
- CodeMirror 6 source editor (lazy-loaded on mode switch) (F-12)
- First-run onboarding for file URL permissions (F-44)
- DOMPurify sanitization (NF-9)

**Exit criteria:** A user can open `README.md`, click into the rendered text, select a word, click Bold in the toolbar, see `**word**` appear in the markdown source, press Cmd+S, and confirm the edit persisted on disk.

### Phase 2: Polish + Content Features

**Goal:** Feature parity with the best viewers. Rich content editing.

**Scope:**
- Slash command menu for block insertion (F-11f)
- Table editing: click into cells, add/remove rows and columns (F-11h)
- Image display and editing in WYSIWYG (F-11j)
- Code block language selector (F-11k)
- Mermaid diagram rendering (F-24)
- KaTeX math rendering (F-25)
- GitHub alerts/callouts (F-26)
- Table of contents sidebar (F-34)
- Word count + reading time (F-35)
- Drag-and-drop file import (F-6)
- Recent files list (F-7)
- Find and replace (F-15)
- Copy button on code blocks (F-23)
- Export: HTML, PDF, clipboard (F-38, F-39, F-40)
- Resizable split pane in source mode (F-31)
- Relative image path resolution (F-28)
- `file://` URL interception (F-41, F-42, F-43)
- Responsive layout (F-37)

**Exit criteria:** Extension matches MarkView's rendering quality. WYSIWYG editing feels natural for tables, images, and code blocks. Export works.

### Phase 3: Power User Features

**Goal:** Differentiation. Features no other extension offers.

**Scope:**
- Vim keybinding mode in source editor (F-16)
- Folder browser sidebar (F-36)
- Frontmatter metadata panel (F-47)
- Table scaffold shortcut (F-17)
- Additional Prism languages (lazy-loaded)
- Custom preview CSS injection
- Keyboard shortcut customization
- Cursor position preservation across mode switches (F-30a)

**Exit criteria:** Power users have a reason to prefer this over VS Code for quick markdown edits.

---

## 9. Competitive Positioning

| Capability | MarkView | Markdown Viewer | Markdown Editor | **MarkDown Studio** |
|------------|----------|-----------------|-----------------|---------------------|
| Render quality | Excellent | Good | Basic | Excellent |
| WYSIWYG editing | No | No | No | **Yes** |
| Source editing | No | No | Yes | **Yes** |
| Save to file | No | No | No | **Yes** |
| Formatting toolbar | No | No | Basic | **Full (floating + fixed)** |
| Mermaid diagrams | Yes | Partial | No | Yes (Phase 2) |
| Math/KaTeX | Yes | Partial | No | Yes (Phase 2) |
| Vim keybindings | No | No | No | **Yes** (Phase 3) |
| Folder browser | Yes | No | No | Yes (Phase 3) |
| Export HTML/PDF | Yes | No | Print only | Yes (Phase 2) |
| Open source | No | Yes | No | **Yes** |
| Free (no paywalls) | Yes | Yes | Trial/unclear | **Yes** |
| Offline / no network | Yes | Yes | Yes | **Yes** |
| Tracking / analytics | Unknown | No | Unknown | **None** |

### Unique Value Proposition

"The only Chrome extension where you can edit markdown directly in the rendered view — click, type, format, and save back to disk. No source code required."

---

## 10. Success Metrics

### Launch (Phase 1 complete)

- Extension loads in under 500ms
- File open-edit-save round-trip works on macOS, Windows, Linux
- Works in Chrome and Edge
- Core bundle under 200KB gzipped
- Zero network requests made by extension
- Zero errors in Chrome DevTools console during normal usage

### Growth (Phase 2 complete)

- 4.5+ star rating on Chrome Web Store
- <2% uninstall rate within first week
- Mermaid and KaTeX render correctly on test suite of 50 sample documents
- `file://` interception works without user confusion (validated via user testing)

### Maturity (Phase 3 complete)

- Recognized in "best markdown extensions" comparison posts
- Active GitHub community (issues, PRs, feature requests)
- Cross-platform test matrix passing on every release

---

## 11. Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| File System Access API not available in extension tab context | Blocks entire product | Low (tested and confirmed working) | Verify in Chrome 120+ during first spike. Fallback: download-based save. |
| Manifest V3 CSP blocks Mermaid SVG rendering | Blocks diagrams | Medium | Test early. Mermaid renders to SVG which should work with `unsafe-inline` styles. If blocked, render to PNG via canvas. |
| Users confused by file permission setup | Adoption friction | High | First-run onboarding page with screenshots. In-extension banner if permissions not granted. |
| CodeMirror 6 bundle larger than estimated | Bundle bloat | Low | Use only required extensions. Tree-shake aggressively. Measure during build. |
| Brave blocks File System Access API | Loses Brave users | Medium | Document limitation. Offer download-based save as fallback for unsupported browsers. |
| Tiptap markdown round-tripping loses formatting nuances | Data fidelity | Medium | Extensive test suite of markdown documents. Compare serialized output to input. Address edge cases (nested lists, complex tables, raw HTML) with custom serializer rules. |
| WYSIWYG mode confuses power users who want raw source | Expectation mismatch | Low | Source mode always one click away. Persist user's preferred mode across sessions. |

---

## 12. Out of Scope

The following are explicitly not part of this product:

- **Cloud sync** (Google Drive, Dropbox, GitHub) — adds complexity, accounts, and network dependency
- **Collaborative editing** — requires server infrastructure
- **Block-based editor** (Notion-style drag-and-drop blocks) — Tiptap provides WYSIWYG but we are not building a block editor with drag handles, slash-to-insert-everything UX, or database views
- **Mobile support** — Chrome extensions don't run on mobile Chrome
- **Firefox/Safari support** — Firefox uses different extension APIs; may be considered later
- **Markdown linting** — valuable but not core to view/edit/save
- **Git integration** — too complex for initial scope
- **AI features** — out of scope; the tool should be fast, simple, and deterministic

---

## 13. Open Questions

1. **Extension name:** "MarkDown Studio" is a working title. Needs trademark search and Chrome Web Store availability check.
2. **file:// interception in edit mode:** Can we pass a file path from the content script to the extension tab to auto-open the File System Access picker? Needs technical spike.
3. ~~**FileHandle persistence across sessions:**~~ **RESOLVED (POC).** IndexedDB can store FileHandles via structured clone. Browser may require permission re-grant on restart via `requestPermission()`, but the handle itself persists.
4. ~~**Inline style CSP:**~~ **RESOLVED (POC).** Inline styles and SVG with inline styles both work under Manifest V3 CSP in extension tabs. Mermaid and KaTeX will work.
5. **Image paths in preview/WYSIWYG:** When editing a file at `/Users/me/docs/README.md` that references `./images/logo.png`, can the WYSIWYG view resolve and display the image? Needs investigation into `file://` access from extension pages.
6. **Tiptap markdown round-trip fidelity:** Tiptap serializes its internal state to markdown. Need to verify fidelity with: nested blockquotes, complex tables (alignment, multiline cells), raw HTML in markdown, reference-style links, definition lists, and edge cases like `***bold italic***`. Build a test suite of 50+ markdown patterns and compare input vs round-tripped output.
7. **Tiptap + Mermaid/KaTeX integration:** These render as "node views" (non-editable islands) inside Tiptap. Need to confirm the Tiptap extension ecosystem supports this or if custom node views are required.
8. **Mode switching latency:** Switching from WYSIWYG to source mode requires serializing Tiptap state to markdown and loading CodeMirror. Need to benchmark this on large documents (10k+ lines) to ensure it feels instant.

---

## Appendix A: Keyboard Shortcuts

| Action | Mac | Windows/Linux |
|--------|-----|---------------|
| Save | Cmd+S | Ctrl+S |
| Save As | Cmd+Shift+S | Ctrl+Shift+S |
| Open File | Cmd+O | Ctrl+O |
| Bold | Cmd+B | Ctrl+B |
| Italic | Cmd+I | Ctrl+I |
| Heading (cycle) | Cmd+Shift+H | Ctrl+Shift+H |
| Link | Cmd+K | Ctrl+K |
| Code (inline) | Cmd+E | Ctrl+E |
| Code block | Cmd+Shift+E | Ctrl+Shift+E |
| Blockquote | Cmd+Shift+. | Ctrl+Shift+. |
| Unordered list | Cmd+Shift+8 | Ctrl+Shift+8 |
| Ordered list | Cmd+Shift+7 | Ctrl+Shift+7 |
| Task list | Cmd+Shift+9 | Ctrl+Shift+9 |
| Find | Cmd+F | Ctrl+F |
| Replace | Cmd+H | Ctrl+H |
| Toggle preview | Cmd+Shift+P | Ctrl+Shift+P |
| Toggle editor | Cmd+Shift+E | Ctrl+Shift+E |
| Toggle split | Cmd+\ | Ctrl+\ |
| Table of contents | Cmd+Shift+T | Ctrl+Shift+T |

## Appendix B: Supported Syntax Highlighting Languages (Default)

JavaScript, TypeScript, Python, Bash/Shell, HTML, CSS, JSON, SQL, Go, Rust

Additional languages lazy-loaded on demand: Java, C, C++, Ruby, PHP, Swift, Kotlin, YAML, TOML, Dockerfile, GraphQL.
