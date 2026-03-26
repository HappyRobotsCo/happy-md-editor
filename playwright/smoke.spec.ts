import { test, expect } from './fixtures';

test.describe('Extension smoke tests', () => {
  test('editor page loads and Tiptap initializes', async ({ editorPage }) => {
    // The editorPage fixture already waits for .tiptap to appear
    const editor = editorPage.locator('.tiptap');
    await expect(editor).toBeVisible();
  });

  test('editor is editable', async ({ editorPage }) => {
    const editor = editorPage.locator('.tiptap');
    await editor.click();
    await editorPage.keyboard.type('Hello, Playwright!');
    const text = await editor.textContent();
    expect(text).toContain('Hello, Playwright!');
  });

  test('toolbar is visible', async ({ editorPage }) => {
    const toolbar = editorPage.locator('.toolbar-area');
    await expect(toolbar).toBeVisible();
  });
});
