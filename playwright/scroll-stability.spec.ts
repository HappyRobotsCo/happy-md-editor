import {
  test,
  expect,
  fixture100Lines,
  fixture1000Lines,
  loadDocument,
  getScrollTop,
  scrollToMiddle,
  isCursorInViewport,
  clickAtEnd,
  clickIntoEmptyListItem,
} from './fixtures';
import fs from 'fs';
import path from 'path';

const fixtureWithLists = fs.readFileSync(
  path.resolve(__dirname, 'test-data/with-lists.md'),
  'utf-8',
);

test.describe('Scroll stability', () => {
  test('backspace at paragraph start does not jump', async ({ editorPage }) => {
    await loadDocument(editorPage, fixture1000Lines);

    // Scroll to the middle of the document
    await scrollToMiddle(editorPage);
    await editorPage.waitForTimeout(200);

    // Click into a paragraph in the middle of the visible area
    await editorPage.evaluate(() => {
      const paragraphs = document.querySelectorAll('.tiptap p');
      const midIdx = Math.floor(paragraphs.length / 2);
      const p = paragraphs[midIdx];
      if (!p) return;
      // Place cursor at the start of the paragraph
      const range = document.createRange();
      range.setStart(p, 0);
      range.collapse(true);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    });
    await editorPage.waitForTimeout(100);

    const scrollBefore = await getScrollTop(editorPage);
    await editorPage.keyboard.press('Backspace');
    await editorPage.waitForTimeout(200);
    const scrollAfter = await getScrollTop(editorPage);

    expect(Math.abs(scrollAfter - scrollBefore)).toBeLessThan(10);
  });

  test('backspace deleting empty list item does not jump', async ({ editorPage }) => {
    await loadDocument(editorPage, fixtureWithLists);

    // Scroll to middle so list items are in view
    await scrollToMiddle(editorPage);
    await editorPage.waitForTimeout(200);

    await clickIntoEmptyListItem(editorPage);
    await editorPage.waitForTimeout(100);

    const scrollBefore = await getScrollTop(editorPage);
    await editorPage.keyboard.press('Backspace');
    await editorPage.waitForTimeout(200);
    const scrollAfter = await getScrollTop(editorPage);

    expect(Math.abs(scrollAfter - scrollBefore)).toBeLessThan(10);
  });

  test('select all + type does not jump beyond cursor', async ({ editorPage }) => {
    await loadDocument(editorPage, fixture1000Lines);
    await scrollToMiddle(editorPage);
    await editorPage.waitForTimeout(200);

    // Click into editor to ensure focus
    await editorPage.locator('.tiptap').click();
    await editorPage.waitForTimeout(100);

    // Select all and type replacement text
    await editorPage.keyboard.press('Meta+a');
    await editorPage.waitForTimeout(100);
    await editorPage.keyboard.type('replaced');
    await editorPage.waitForTimeout(200);

    // After replacing all content, viewport should be near top since
    // the document is now tiny
    const scrollAfter = await getScrollTop(editorPage);
    expect(scrollAfter).toBeLessThan(100);
  });

  test('typing at bottom of viewport follows cursor', async ({ editorPage }) => {
    await loadDocument(editorPage, fixture100Lines);
    await clickAtEnd(editorPage);
    await editorPage.waitForTimeout(100);

    // Press Enter 20 times to push cursor past the viewport
    for (let i = 0; i < 20; i++) {
      await editorPage.keyboard.press('Enter');
    }
    await editorPage.waitForTimeout(200);

    // Cursor should still be visible — viewport should have followed it
    const cursorVisible = await isCursorInViewport(editorPage);
    expect(cursorVisible).toBe(true);
  });

  test('mouse scroll is not blocked', async ({ editorPage }) => {
    await loadDocument(editorPage, fixture1000Lines);
    await editorPage.waitForTimeout(200);

    const scrollBefore = await getScrollTop(editorPage);
    await editorPage.mouse.wheel(0, 500);
    await editorPage.waitForTimeout(200);
    const scrollAfter = await getScrollTop(editorPage);

    expect(scrollAfter - scrollBefore).toBeGreaterThan(100);
  });
});
