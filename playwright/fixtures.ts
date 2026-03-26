import { test as base, expect, type Page, type BrowserContext } from '@playwright/test';
import path from 'path';
import fs from 'fs';

/**
 * Get the extension ID from a loaded Chrome extension.
 * Chrome assigns a unique ID to each unpacked extension based on its key/path.
 */
async function getExtensionId(context: BrowserContext): Promise<string> {
  // Open the service worker which gives us the extension URL
  let [background] = context.serviceWorkers();
  if (!background) {
    background = await context.waitForEvent('serviceworker');
  }
  const extensionId = background.url().split('/')[2];
  return extensionId;
}

/**
 * Extended test fixture that provides extension-aware page navigation.
 */
export const test = base.extend<{
  extensionId: string;
  editorPage: Page;
}>({
  extensionId: async ({ context }, use) => {
    const id = await getExtensionId(context);
    await use(id);
  },
  editorPage: async ({ page, extensionId }, use) => {
    await page.goto(`chrome-extension://${extensionId}/src/editor/index.html`);
    // Wait for the editor to be ready
    await page.waitForSelector('.tiptap', { timeout: 10_000 });
    await use(page);
  },
});

export { expect };

// ---- Test data helpers ----

const fixturesDir = path.resolve(__dirname, 'test-data');

function readFixture(name: string): string {
  return fs.readFileSync(path.join(fixturesDir, name), 'utf-8');
}

export const fixture100Lines = readFixture('100-lines.md');
export const fixture1000Lines = readFixture('1000-lines.md');
export const fixture5000Lines = readFixture('5000-lines.md');

// ---- Page helpers ----

/**
 * Set content in the Tiptap editor by dispatching to the app.
 * Uses the editor's innerHTML approach since we can't use File System Access in tests.
 */
export async function loadDocument(page: Page, markdown: string): Promise<void> {
  await page.evaluate((md) => {
    // Access the Tiptap editor instance from the DOM
    const editorEl = document.querySelector('.tiptap');
    if (!editorEl) throw new Error('Tiptap editor not found');
    // Use ProseMirror view to set content
    const pmView = (editorEl as HTMLElement & { pmViewDesc?: { view: { dispatch: unknown } } })
      .pmViewDesc;
    if (pmView) {
      // If we have direct ProseMirror access, use it
      // For now, use a simpler approach: set innerHTML and let Tiptap parse it
    }
    // Simpler approach: use clipboard API to paste markdown content
    // Actually, let's use the app's exposed API or direct DOM manipulation
    // The most reliable approach for e2e: type content or use the editor commands
    // For large documents, we'll inject via the editor's setContent command
    const event = new CustomEvent('e2e:set-content', { detail: md });
    document.dispatchEvent(event);
  }, markdown);

  // Give Tiptap time to render
  await page.waitForTimeout(500);
}

export async function getScrollTop(page: Page): Promise<number> {
  return page.evaluate(() => {
    const container = document.querySelector('.editor-area');
    return container ? container.scrollTop : document.documentElement.scrollTop;
  });
}

export async function scrollToMiddle(page: Page): Promise<void> {
  await page.evaluate(() => {
    const container = document.querySelector('.editor-area');
    if (container) {
      container.scrollTop = container.scrollHeight / 2;
    }
  });
  await page.waitForTimeout(100);
}

export async function isCursorInViewport(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= window.innerHeight;
  });
}

export async function clickAtEnd(page: Page): Promise<void> {
  await page.evaluate(() => {
    const editor = document.querySelector('.tiptap');
    if (!editor) return;
    // Click at the very end of the editor content
    const lastChild = editor.lastElementChild;
    if (lastChild) {
      const range = document.createRange();
      range.selectNodeContents(lastChild);
      range.collapse(false);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  });
}

export async function clickIntoEmptyListItem(page: Page): Promise<void> {
  await page.evaluate(() => {
    // Find an empty list item
    const listItems = document.querySelectorAll('.tiptap li');
    for (const li of listItems) {
      if (li.textContent?.trim() === '') {
        const range = document.createRange();
        range.selectNodeContents(li);
        range.collapse(true);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        return;
      }
    }
  });
}
