# Happy MD Editor

The missing Chrome markdown editor — open, edit, and save `.md` files with a clean WYSIWYG interface.

No server. No account. No data leaves your browser.

## Features

- **WYSIWYG editing** — edit markdown as a formatted document with a floating toolbar
- **Source mode** — switch to raw markdown with syntax highlighting (CodeMirror 6)
- **Open and save** — read and write `.md` files directly to/from disk via the File System Access API
- **GFM support** — tables, task lists, strikethrough, code blocks, blockquotes
- **Auto-save** — content saved to IndexedDB every 2 seconds, recovered on crash
- **Keyboard shortcuts** — Cmd/Ctrl+B, I, K, S, O, and more
- **Offline** — works entirely in-browser with zero network requests
- **Open source** — MIT licensed

## Install

### Chrome Web Store

*Coming soon*

### From source

```bash
git clone https://github.com/HappyRobotsCo/happy-md-editor.git
cd happy-md-editor
npm install
npm run build
```

Then load the extension:

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select the `dist/` folder
4. Click the extension icon in the toolbar to open the editor

## Development

```bash
npm run dev          # Watch mode — rebuilds on file changes
npm run typecheck    # TypeScript type checking
npm run lint         # ESLint
npm test             # Vitest (unit tests)
npm run build        # Production build → dist/
```

### Validate everything

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

## Tech stack

- **Editor**: Tiptap (WYSIWYG), CodeMirror 6 (source mode)
- **Framework**: React 18, TypeScript, Vite
- **Testing**: Vitest, Testing Library
- **Extension**: Chrome Manifest V3, File System Access API
- **Parsing**: tiptap-markdown, markdown-it, DOMPurify

## How it works

Happy MD Editor runs as a Chrome extension tab page (`chrome-extension://` origin). This gives it access to the File System Access API — the same API that powers VS Code for the Web — allowing direct read/write to local files without a server.

Your files never leave your machine. There is no backend, no sync service, no telemetry.

## Contributing

Contributions welcome. Please open an issue first to discuss what you'd like to change.

```bash
# Fork and clone
npm install
npm run dev
# Load dist/ as unpacked extension
# Make changes, write tests, validate
npm run typecheck && npm run lint && npm test && npm run build
```

## License

[MIT](LICENSE) - Happy Robots
