# Spec: First-Run Onboarding

## Job to Be Done
New user understands how to use the extension and grants necessary permissions without confusion.

## Requirements
- First-run onboarding page shown after install (F-44)
- Step-by-step visual guide for enabling "Allow access to file URLs"
- Screenshots/illustrations for each step
- Direct link to `chrome://extensions` (note: cannot be clickable, must be copy-paste)
- Onboarding page shown via `chrome.runtime.onInstalled` listener in service worker
- Onboarding only shown once — flag stored in `chrome.storage.local`
- Quick start: "Click the extension icon to open the editor" with visual
- Feature overview: WYSIWYG editing, save to disk, themes, keyboard shortcuts

## Acceptance Criteria
- [ ] Installing extension opens onboarding tab automatically
- [ ] Onboarding page explains file URL permission with clear steps
- [ ] Onboarding page has "Got it" button that closes and marks as seen
- [ ] Onboarding does not appear on subsequent browser starts
- [ ] Page renders correctly in light and dark mode
- [ ] Page is accessible (headings, alt text, keyboard nav)

## Test Cases
| Input | Expected Output |
|-------|-----------------|
| Fresh install | Onboarding tab opens |
| Click "Got it" on onboarding | Tab closes, flag stored |
| Restart browser after onboarding | No onboarding tab |
| Uninstall + reinstall | Onboarding appears again |

## Performance Logging
- `onboarding:init` — theme detection + DOM setup (< 100ms)
- `onboarding:complete` — store completion flag + close tab (< 50ms)

## Technical Notes
- `chrome.runtime.onInstalled` in background.js service worker
- Open `chrome.tabs.create({ url: 'onboarding.html' })` on `reason === 'install'`
- Store `{ onboardingComplete: true }` in `chrome.storage.local`
- Onboarding page is a static HTML file, minimal JS

## Revision History
- 2026-03-05: Initial spec from PRD
- 2026-03-05: Added Performance Logging section with `onboarding:init` and `onboarding:complete` — instrumented in Task 6.4 but spec lacked the section (build log review iter 26)
