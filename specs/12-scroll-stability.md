# Spec: Scroll Stability

## Job to Be Done
The editor viewport never jumps unexpectedly during normal editing. The user's scroll position is preserved unless the cursor moves off-screen, at which point the viewport scrolls smoothly to follow.

## Problem Statement
ProseMirror/Tiptap renders content by replacing DOM nodes during transactions. When the browser detects that a focused element's DOM subtree has changed, it may independently call `scrollIntoView` on the focused element — this happens outside ProseMirror's own `handleScrollToSelection` and causes the viewport to jump hundreds of pixels.

This is especially pronounced with:
- Backspace at the beginning of a block (node merge/delete)
- Shift+A (select all) followed by typing (replace all nodes)
- Deleting list items or table rows
- Any operation that removes a DOM node containing the selection

## Requirements
- Viewport must not jump when the cursor is already visible on screen
- Viewport must scroll to follow the cursor when it moves off-screen (natural behavior)
- Scroll guard must work regardless of document length or scroll position
- Scroll guard must not interfere with intentional user scrolling (mouse wheel, trackpad, scroll bar)
- Scroll guard must not introduce visual flicker or jank
- Scroll guard implemented as a standalone utility (`src/editor/scroll-guard.ts`) with no React dependencies

## Architecture
The scroll guard wraps ProseMirror's `view.dispatch`:

1. Before dispatching a transaction, save `scrollContainer.scrollTop`
2. Check if the cursor is currently visible within the scroll container
3. Dispatch the transaction (DOM mutations happen here)
4. In a `requestAnimationFrame` callback, if the cursor was visible AND scroll position changed beyond a threshold, restore the saved scroll position

This approach catches browser-native scroll adjustments that bypass ProseMirror's `handleScrollToSelection`.

The `handleScrollToSelection` prop on the editor handles the ProseMirror-controlled scroll path separately — it suppresses ProseMirror's own `scrollIntoView` when the cursor is already visible.

## Performance Logging
- No dedicated PerfLogger entries (scroll guard is per-frame, logging would be too noisy)
- Scroll guard must add < 1ms overhead per transaction (measured via e2e performance test)

## Acceptance Criteria
- [ ] Backspace at beginning of paragraph does not jump viewport
- [ ] Backspace to delete empty list item does not jump viewport
- [ ] Shift+A then typing does not jump viewport (beyond following cursor)
- [ ] Typing at end of document scrolls viewport to follow cursor naturally
- [ ] Scrolling with mouse/trackpad is not affected by scroll guard
- [ ] Cursor arrow-keying past bottom of viewport scrolls to follow
- [ ] Scroll guard cleanup removes dispatch wrapper on editor destroy
- [ ] All scenarios validated by e2e tests running in real Chrome

## Test Strategy

### Why e2e tests are required
Scroll behavior depends on the browser's layout engine. jsdom does not compute layout, does not implement `scrollIntoView`, and does not trigger browser-native scroll adjustments after DOM mutations. **Unit tests in Vitest/jsdom cannot validate scroll stability.** Only real-browser tests can.

### E2E test infrastructure
- **Playwright** with Chrome (not Chromium — extension testing requires Chrome)
- Extension loaded as unpacked via `--load-extension` Chrome flag
- Tests navigate to `chrome-extension://<id>/src/editor/index.html`
- Test fixtures: markdown files of varying sizes (100 lines, 1000 lines, 5000 lines)

### E2E test cases
```typescript
// playwright/scroll-stability.spec.ts

test.describe('Scroll stability', () => {
  test('backspace at paragraph start does not jump', async ({ page }) => {
    await loadDocument(page, fixture1000Lines);
    await scrollToMiddle(page);
    const scrollBefore = await getScrollTop(page);
    await page.keyboard.press('Backspace');
    const scrollAfter = await getScrollTop(page);
    expect(Math.abs(scrollAfter - scrollBefore)).toBeLessThan(10);
  });

  test('backspace deleting empty list item does not jump', async ({ page }) => {
    await loadDocument(page, fixtureWithLists);
    await scrollToMiddle(page);
    await clickIntoEmptyListItem(page);
    const scrollBefore = await getScrollTop(page);
    await page.keyboard.press('Backspace');
    const scrollAfter = await getScrollTop(page);
    expect(Math.abs(scrollAfter - scrollBefore)).toBeLessThan(10);
  });

  test('select all + type does not jump beyond cursor', async ({ page }) => {
    await loadDocument(page, fixture1000Lines);
    await scrollToMiddle(page);
    await page.keyboard.press('Meta+a');
    await page.keyboard.type('replaced');
    // Viewport should be at top since content was replaced
    const scrollAfter = await getScrollTop(page);
    expect(scrollAfter).toBeLessThan(100);
  });

  test('typing at bottom of viewport follows cursor', async ({ page }) => {
    await loadDocument(page, fixture100Lines);
    await clickAtEnd(page);
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Enter');
    }
    // Cursor should still be visible
    const cursorVisible = await isCursorInViewport(page);
    expect(cursorVisible).toBe(true);
  });

  test('mouse scroll is not blocked', async ({ page }) => {
    await loadDocument(page, fixture1000Lines);
    const scrollBefore = await getScrollTop(page);
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(100);
    const scrollAfter = await getScrollTop(page);
    expect(scrollAfter - scrollBefore).toBeGreaterThan(100);
  });
});
```

### Unit tests (scroll-guard.ts logic only)
The `isCursorVisible` function and the dispatch-wrapping logic can be unit tested with mocked `EditorView` and `Element` interfaces — verifying the save/restore decision logic without requiring real layout. These run in Vitest.

```typescript
// src/editor/scroll-guard.test.ts
describe('isCursorVisible', () => {
  it('returns true when cursor coords are within container bounds', () => { ... });
  it('returns false when cursor is above container', () => { ... });
  it('returns false when cursor is below container', () => { ... });
  it('returns false when coordsAtPos throws', () => { ... });
});

describe('createScrollGuard', () => {
  it('wraps view.dispatch', () => { ... });
  it('cleanup restores original dispatch', () => { ... });
  it('passes transaction through to original dispatch', () => { ... });
});
```

## Technical Notes
- `requestAnimationFrame` is used because browser scroll adjustments happen asynchronously after DOM mutations — synchronous scroll restore would be overwritten
- The 5px threshold prevents micro-adjustments from sub-pixel rendering differences
- `view.coordsAtPos` can throw if the editor view isn't mounted or the position is invalid — always wrap in try/catch
- The scroll guard is installed via `useEffect` cleanup pattern in TiptapEditor to ensure proper lifecycle management
- Chrome extension testing with Playwright requires `--disable-extensions-except` and `--load-extension` flags, plus `chrome` channel (not default Chromium)

## Revision History
- 2026-03-05: Initial spec — scroll jump issue identified during demo testing. Root cause: browser-native scrollIntoView after ProseMirror DOM mutations bypasses handleScrollToSelection.
- 2026-03-05: (iter30 review) Added requirement: App must expose an e2e content injection hook. `loadDocument` in `playwright/fixtures.ts` dispatches `CustomEvent('e2e:set-content')` but no listener exists in app code. Task 7.2 must either add a dev-only `e2e:set-content` listener in the editor (guarded behind `import.meta.env.DEV` or a test flag) or rewrite `loadDocument` to use Tiptap's editor instance directly (e.g., `window.__tiptapEditor?.commands.setContent()`).
