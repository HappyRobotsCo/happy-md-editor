#!/usr/bin/env node
/**
 * Generate a 440x280 Chrome Web Store small promo tile.
 */

import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ICONS_DIR = path.join(ROOT, 'public', 'icons');
const OUTPUT = path.join(ROOT, 'store-assets');

async function main() {
  fs.mkdirSync(OUTPUT, { recursive: true });

  const svgContent = fs.readFileSync(path.join(ICONS_DIR, 'icon.svg'), 'utf-8');

  const html = `<!DOCTYPE html>
<html><head><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 440px;
    height: 280px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 24px;
    background: linear-gradient(135deg, #1a73e8 0%, #1557b0 100%);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    overflow: hidden;
  }
  .icon {
    width: 80px;
    height: 80px;
    flex-shrink: 0;
  }
  .icon svg {
    width: 80px;
    height: 80px;
    filter: drop-shadow(0 2px 8px rgba(0,0,0,0.2));
  }
  .text {
    color: #fff;
  }
  .title {
    font-size: 26px;
    font-weight: 700;
    margin-bottom: 6px;
    letter-spacing: -0.3px;
  }
  .subtitle {
    font-size: 14px;
    font-weight: 400;
    opacity: 0.85;
    line-height: 1.4;
    max-width: 240px;
  }
</style></head>
<body>
  <div class="icon">${svgContent}</div>
  <div class="text">
    <div class="title">Happy MD Editor</div>
    <div class="subtitle">Open, edit, and save markdown files — right in Chrome.</div>
  </div>
</body></html>`;

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 440, height: 280, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'networkidle0' });

  const outPath = path.join(OUTPUT, 'promo-small-440x280.png');
  await page.screenshot({
    path: outPath,
    clip: { x: 0, y: 0, width: 440, height: 280 },
  });

  console.log('Generated ' + outPath);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
