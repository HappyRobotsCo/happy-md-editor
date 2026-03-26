# Spec: Theming & Appearance

## Job to Be Done
User sees a polished light or dark theme that respects their OS preference, with consistent styling across all editing modes.

## Requirements
- Light and dark themes (F-32)
- Auto-detect OS color scheme via `prefers-color-scheme` media query (F-33)
- Manual override stored in `chrome.storage.local`
- Theme toggle button in toolbar
- Consistent theme across: Tiptap WYSIWYG, CodeMirror source editor, preview pane, toolbars, dialogs
- GitHub-style preview rendering (default preview theme)
- WCAG AA contrast ratios in both themes (NF-20)
- Print stylesheet for PDF export (no dark backgrounds, appropriate margins)

## Performance Logging
- `theme:switch` — time to apply theme change across all components
- `theme:init` — time to detect OS preference and apply initial theme

## Acceptance Criteria
- [ ] Extension respects OS dark mode preference on first load
- [ ] User can toggle light/dark via toolbar button
- [ ] Theme preference persists across sessions
- [ ] Tiptap editor, CodeMirror, preview, and toolbar all switch together
- [ ] Light theme: white backgrounds, dark text, sufficient contrast
- [ ] Dark theme: dark backgrounds, light text, no elements "stuck" in light mode
- [ ] Code blocks in preview use appropriate dark/light syntax theme
- [ ] Theme switch completes within 50ms (no flash)
- [ ] Print stylesheet produces clean output on white background

## Test Cases
| Input | Expected Output |
|-------|-----------------|
| OS set to dark mode, open extension | Dark theme applied |
| OS set to light mode, open extension | Light theme applied |
| Toggle theme via button | All components switch immediately |
| Toggle theme, reload extension | Preference persisted |
| Print preview in dark mode | Print uses light stylesheet |
| Check contrast ratio on body text | >= 4.5:1 (AA) |
| Check contrast ratio on code blocks | >= 4.5:1 (AA) |

## Technical Notes
- CSS custom properties (variables) for theme colors — single point of change
- Theme class on `<html>` element: `data-theme="light"` or `data-theme="dark"`
- CodeMirror themes: `@codemirror/theme-one-dark` for dark, default for light
- Prism themes: `prism-one-dark` for dark, default for light
- Use `window.matchMedia('(prefers-color-scheme: dark)')` with change listener

## Revision History
- 2026-03-05: Initial spec from PRD
