#!/usr/bin/env node
/**
 * Capture Chrome Web Store screenshots using Puppeteer.
 * Loads the extension unpacked and takes screenshots of the editor and onboarding pages.
 *
 * Usage: node scripts/screenshots.mjs
 * Output: store-assets/screenshot-*.png (1280x800)
 */

import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const OUTPUT = path.join(ROOT, 'store-assets');

const WIDTH = 1280;
const HEIGHT = 800;

// Sample markdown to populate the editor
const SAMPLE_MD = `# Getting Started with Happy MD Editor

Welcome to **Happy MD Editor** — the missing Chrome markdown editor.

## Features

- **WYSIWYG editing** with live formatting
- **Source mode** with syntax highlighting
- **Save to disk** using the File System Access API
- Light and dark **themes**

## Code Example

\`\`\`javascript
function greet(name) {
  return \`Hello, \${name}!\`;
}
\`\`\`

## Task List

- [x] Install the extension
- [x] Enable file URL access
- [ ] Open your first markdown file
- [ ] Try switching between WYSIWYG and Source mode

## Blockquote

> "The best way to predict the future is to invent it."
> — Alan Kay

## Table

| Shortcut | Action |
|----------|--------|
| Cmd+B | Bold |
| Cmd+I | Italic |
| Cmd+S | Save |
| Cmd+O | Open |

---

Happy writing!
`;

async function main() {
  fs.mkdirSync(OUTPUT, { recursive: true });

  console.log('Launching Chrome with extension loaded...');
  const browser = await puppeteer.launch({
    headless: false, // Extensions require headed mode
    defaultViewport: { width: WIDTH, height: HEIGHT },
    args: [
      `--disable-extensions-except=${DIST}`,
      `--load-extension=${DIST}`,
      `--window-size=${WIDTH},${HEIGHT}`,
    ],
  });

  // Wait for the extension to register
  await new Promise((r) => setTimeout(r, 2000));

  // Find the extension ID
  const targets = browser.targets();
  const extTarget = targets.find(
    (t) => t.type() === 'service_worker' && t.url().includes('chrome-extension://'),
  );
  if (!extTarget) {
    console.error('Could not find extension service worker. Targets:', targets.map(t => `${t.type()}: ${t.url()}`));
    await browser.close();
    process.exit(1);
  }
  const extId = new URL(extTarget.url()).hostname;
  console.log(`Extension ID: ${extId}`);

  // --- Screenshot 1: WYSIWYG editor with sample content (light theme) ---
  console.log('Taking screenshot 1: WYSIWYG editor (light)...');
  const editorPage = await browser.newPage();
  await editorPage.setViewport({ width: WIDTH, height: HEIGHT });
  await editorPage.goto(`chrome-extension://${extId}/src/editor/index.html`, {
    waitUntil: 'networkidle0',
  });

  // Wait for React to mount (the app root will have children)
  await editorPage.waitForSelector('#root .app', { timeout: 10000 });

  // Force light theme before injecting content
  await editorPage.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'light');
  });

  // Inject sample content via the e2e hook — this triggers the editor to appear
  await editorPage.evaluate((md) => {
    document.dispatchEvent(new CustomEvent('e2e:set-content', { detail: md }));
  }, SAMPLE_MD);
  await new Promise((r) => setTimeout(r, 2000));

  // Now the tiptap editor should be visible
  await editorPage.waitForSelector('.tiptap-editor', { timeout: 10000 });

  // Override the filename display
  await editorPage.evaluate(() => {
    const nameEl = document.querySelector('.file-name');
    if (nameEl) nameEl.textContent = 'README.md';
  });

  await editorPage.screenshot({
    path: path.join(OUTPUT, 'screenshot-1-editor-light.png'),
    clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
  });

  // --- Screenshot 2: WYSIWYG editor dark theme ---
  console.log('Taking screenshot 2: WYSIWYG editor (dark)...');
  await editorPage.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
  });
  await new Promise((r) => setTimeout(r, 500));
  await editorPage.screenshot({
    path: path.join(OUTPUT, 'screenshot-2-editor-dark.png'),
    clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
  });

  // Switch back to light for remaining screenshots
  await editorPage.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'light');
  });
  await new Promise((r) => setTimeout(r, 300));

  // Restore filename after theme switch
  await editorPage.evaluate(() => {
    const nameEl = document.querySelector('.file-name');
    if (nameEl) nameEl.textContent = 'README.md';
  });

  // --- Screenshot 3: Source mode ---
  console.log('Taking screenshot 3: Source mode...');
  // Click the Source mode button
  const sourceBtn = await editorPage.$('.mode-btn:last-child');
  if (sourceBtn) {
    await sourceBtn.click();
    await new Promise((r) => setTimeout(r, 1500));
  }
  await editorPage.screenshot({
    path: path.join(OUTPUT, 'screenshot-3-source-mode.png'),
    clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
  });

  // --- Screenshot 4: Split mode ---
  console.log('Taking screenshot 4: Split mode...');
  const splitBtn = await editorPage.$$('.mode-btn');
  if (splitBtn.length >= 2) {
    await splitBtn[1].click();
    await new Promise((r) => setTimeout(r, 1500));
  }
  await editorPage.screenshot({
    path: path.join(OUTPUT, 'screenshot-4-split-mode.png'),
    clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
  });

  // --- Screenshot 5: Onboarding / Welcome page ---
  console.log('Taking screenshot 5: Welcome page...');
  const onboardingPage = await browser.newPage();
  await onboardingPage.setViewport({ width: WIDTH, height: HEIGHT });
  await onboardingPage.goto(`chrome-extension://${extId}/src/onboarding/index.html`, {
    waitUntil: 'networkidle0',
  });
  // Force light theme on welcome page too
  await onboardingPage.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'light');
  });
  await new Promise((r) => setTimeout(r, 1000));
  await onboardingPage.screenshot({
    path: path.join(OUTPUT, 'screenshot-5-welcome.png'),
    clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
  });

  await browser.close();
  console.log(`\nDone! Screenshots saved to ${OUTPUT}/`);
  console.log(fs.readdirSync(OUTPUT).filter(f => f.endsWith('.png')).join('\n'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
