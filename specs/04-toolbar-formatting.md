# Spec: Toolbar & Formatting Controls

## Job to Be Done
User applies markdown formatting via visual toolbar buttons and keyboard shortcuts, with clear feedback about active formatting state.

## Requirements
- Fixed top toolbar with block-level actions (F-11c):
  - Heading picker (1-6), paragraph
  - Unordered list, ordered list, task list
  - Blockquote, code block
  - Horizontal rule, table insert, image insert
- Floating toolbar on text selection (F-11b):
  - Bold, italic, strikethrough, inline code
  - Link (opens link editor)
  - Heading level picker
- Active state indicators — toolbar buttons highlight when cursor is inside formatted text (F-11d)
- Toggle behavior — clicking active button removes formatting (F-11e)
- Link editing: clicking a link shows popover with URL and text fields; Cmd/Ctrl+K opens on selection (F-11i)
- All toolbar actions work via Tiptap commands in WYSIWYG mode
- All toolbar actions work via markdown notation wrapping in source mode (F-13)
- Keyboard shortcuts shared across both modes (F-14)
- Toolbar is accessible: ARIA labels, keyboard navigable, focus management (NF-18, NF-19)

## Performance Logging
- `toolbar:action` — time from button click to editor state updated (should be < 16ms for 60fps)
- `toolbar:floating:show` — time from selection change to floating toolbar visible
- `toolbar:floating:hide` — time to dismiss floating toolbar
- `toolbar:state-sync` — time to compute active states from current cursor position

## Acceptance Criteria
- [ ] Fixed toolbar renders above editor with all block-level actions
- [ ] Floating toolbar appears within 100ms of text selection
- [ ] Floating toolbar disappears when selection is cleared
- [ ] Bold button highlighted when cursor is inside bold text
- [ ] Clicking bold button when not in bold text wraps selection with `**`
- [ ] Clicking bold button when in bold text removes `**` markers
- [ ] All keyboard shortcuts from Appendix A work in WYSIWYG mode
- [ ] All keyboard shortcuts from Appendix A work in source mode
- [ ] Link popover shows URL and text fields when clicking a link
- [ ] Cmd/Ctrl+K with text selected opens link editor
- [ ] Heading picker allows selecting H1-H6 and paragraph
- [ ] Table insert creates a 3x3 table by default
- [ ] All toolbar buttons have ARIA labels
- [ ] Toolbar is keyboard-navigable (Tab/Arrow keys)

## Keyboard Shortcuts
| Action | Mac | Windows/Linux |
|--------|-----|---------------|
| Bold | Cmd+B | Ctrl+B |
| Italic | Cmd+I | Ctrl+I |
| Link | Cmd+K | Ctrl+K |
| Code (inline) | Cmd+E | Ctrl+E |
| Heading (cycle) | Cmd+Shift+H | Ctrl+Shift+H |
| Blockquote | Cmd+Shift+. | Ctrl+Shift+. |
| Unordered list | Cmd+Shift+8 | Ctrl+Shift+8 |
| Ordered list | Cmd+Shift+7 | Ctrl+Shift+7 |
| Task list | Cmd+Shift+9 | Ctrl+Shift+9 |

## Test Cases
| Input | Expected Output |
|-------|-----------------|
| Select "hello", click Bold | Markdown: `**hello**` |
| Cursor inside `**bold**`, check toolbar | Bold button has active state |
| Cursor inside `**bold**`, click Bold | Markdown: `bold` (markers removed) |
| Select text, Cmd+K, enter URL | Markdown: `[text](url)` |
| Click existing link in WYSIWYG | Link popover appears with current URL |
| Select text, Cmd+B, then Cmd+Z | Undo restores unbolded text |
| Click heading picker, select H2 | Current line becomes `## text` |
| Tab through toolbar buttons | Focus moves through all buttons |
| Screen reader on toolbar | Announces button labels and states |

## Technical Notes
- Floating toolbar: use Tiptap's `BubbleMenu` component
- Fixed toolbar: custom React component reading Tiptap editor state
- Active states: use `editor.isActive('bold')`, `editor.isActive('italic')`, etc.
- Source mode toolbar: wrap selection using CodeMirror transaction API
- Link popover: custom React component positioned relative to link node

## Revision History
- 2026-03-05: Initial spec from PRD
