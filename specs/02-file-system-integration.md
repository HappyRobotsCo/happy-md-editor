# Spec: File System Integration

## Job to Be Done
User can open a local markdown file, edit it, and save changes back to the same file on disk.

## Requirements
- Open `.md` and `.markdown` files via `showOpenFilePicker()` (F-1)
- Save back to original file via `FileHandle.createWritable()` (F-2)
- "Save As" to new location via `showSaveFilePicker()` (F-3)
- Auto-save editor content to IndexedDB every 2 seconds, debounced (F-4)
- Recover unsaved content from IndexedDB on extension reopen (F-5)
- Dirty state indicator — tab title shows `*` prefix when unsaved (F-9)
- `beforeunload` prompt when closing tab with unsaved changes (F-10)
- FileHandle persisted in IndexedDB for session restoration
- Permission re-grant via `queryPermission()` / `requestPermission()` on restored handles
- Cmd/Ctrl+S triggers save, Cmd/Ctrl+Shift+S triggers save-as, Cmd/Ctrl+O triggers open

## Performance Logging
- `file:open` — time from picker resolution (handle received) to content loaded in editor. Must NOT include time user spends in the picker dialog. Cancelled picks must not log an entry.
- `file:save` — time from save trigger to writable.close()
- `file:autosave` — time for IndexedDB write
- `file:restore` — time to restore content from IndexedDB on reopen
- `file:handle-restore` — time to restore and re-grant FileHandle from IndexedDB
- All timings logged via PerfLogger

## Acceptance Criteria
- [ ] User clicks Open, selects a `.md` file, content appears in editor
- [ ] User edits content, presses Cmd/Ctrl+S, file on disk is updated
- [ ] User presses Cmd/Ctrl+Shift+S, new file is created at chosen location
- [ ] Tab title shows `*` prefix after edits, clears after save
- [ ] Closing tab with unsaved changes shows browser confirmation dialog
- [ ] After crash/close, reopening extension recovers last auto-saved content
- [ ] After browser restart, stored FileHandle can be re-granted and used
- [ ] File open completes within 100ms for files under 1MB (NF-3)
- [ ] File save completes within 100ms for files under 1MB (NF-3)
- [ ] Auto-save to IndexedDB completes within 50ms

## Test Cases
| Input | Expected Output |
|-------|-----------------|
| Open 1KB `.md` file | Content loaded, `file:open` < 100ms |
| Open 500KB `.md` file | Content loaded, `file:open` < 100ms |
| Edit then Cmd+S | File on disk matches editor content |
| Edit then Cmd+Shift+S | New file created with editor content |
| Edit, do NOT save, close tab | `beforeunload` prompt appears |
| Edit, wait 3 seconds | IndexedDB contains auto-saved content |
| Kill extension tab, reopen | Auto-saved content restored |
| Open file, close browser, reopen extension | FileHandle prompt to re-grant, then file restored |
| Open non-markdown file via picker | Picker only shows `.md`/`.markdown` files |
| Open file, save, check PerfLogger | `file:open` and `file:save` entries present |

## Technical Notes
- POC validated: File System Access API works in `chrome-extension://` tabs
- POC validated: FileHandle survives IndexedDB structured clone
- POC validated: `createWritable()` works in extension context
- IndexedDB database name: `markdown-studio`
- Object stores: `handles` (FileHandle persistence), `autosave` (crash recovery)
- **Shared DB opener required**: Both `autosave` and `handles` stores live in the same `markdown-studio` database. A single shared `openDB()` function must manage schema versioning and create all object stores in `onupgradeneeded`. When Task 2.5 adds the `handles` store, the existing `autosave-service.ts` `openDB()` must be refactored into a shared module (e.g., `src/editor/db.ts`) and the DB_VERSION bumped to 2.
- gray-matter used to separate frontmatter before loading into editor — see spec 08

## Revision History
- 2026-03-05: Initial spec from PRD. POC findings integrated.
- 2026-03-05: Clarified `file:open` timing boundary — must start AFTER picker resolves (not before picker opens), so measurement reflects actual I/O, not user interaction time. Cancelled picker operations must not record a PerfLogger entry. (build log review iter 2)
- 2026-03-05: Added shared DB opener requirement — `autosave` and `handles` stores must use unified schema versioning via a shared `openDB()` module to prevent IndexedDB version conflicts. (build log review iter 5)
