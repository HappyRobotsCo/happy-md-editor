# Privacy Policy — Happy MD Editor

**Last updated:** March 5, 2026

## Summary

Happy MD Editor does **not** collect, transmit, or share any user data. Everything stays on your device.

## Data Collection

This extension collects **no data whatsoever**. Specifically:

- **No analytics or telemetry** — we do not track usage, page views, or feature usage.
- **No network requests** — the extension never contacts any server. It works entirely offline.
- **No accounts or sign-in** — there is no user registration or authentication.
- **No third-party services** — no ads, no tracking pixels, no external scripts.

## Local Storage

The extension uses Chrome's local storage APIs (`chrome.storage.local` and `chrome.storage.session`) solely to:

- Remember your preferred editor mode (WYSIWYG, Split, or Source)
- Remember your preferred theme (light or dark)
- Auto-save your current document for crash recovery
- Temporarily pass file content when opening `.md` files from `file://` URLs

This data never leaves your browser and is not accessible to any external party.

## File Access

When you open or save a file, the extension uses the [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API) to read from and write to your local file system. File contents are processed entirely in-browser and are never uploaded or transmitted anywhere.

## Permissions

| Permission | Why it's needed |
|---|---|
| `storage` | Save user preferences (theme, editor mode) and auto-save document content locally |

## Changes

If this policy changes, the updated version will be published here with a new date.

## Contact

If you have questions about this privacy policy, please open an issue on the [GitHub repository](https://github.com/HappyRobotsCo/happy-md-editor).
