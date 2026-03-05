#!/usr/bin/env node
/**
 * Generate a 1400x560 Chrome Web Store marquee promo tile.
 * JPEG or 24-bit PNG (no alpha).
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
    width: 1400px;
    height: 560px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #1565c0 0%, #1a73e8 40%, #1e88e5 100%);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    overflow: hidden;
    position: relative;
  }

  /* Subtle decorative circles */
  body::before {
    content: '';
    position: absolute;
    top: -120px;
    right: -80px;
    width: 400px;
    height: 400px;
    border-radius: 50%;
    background: rgba(255,255,255,0.04);
  }
  body::after {
    content: '';
    position: absolute;
    bottom: -100px;
    left: -60px;
    width: 300px;
    height: 300px;
    border-radius: 50%;
    background: rgba(255,255,255,0.03);
  }

  .content {
    display: flex;
    align-items: center;
    gap: 48px;
    position: relative;
    z-index: 1;
  }

  .icon {
    width: 140px;
    height: 140px;
    flex-shrink: 0;
  }
  .icon svg {
    width: 140px;
    height: 140px;
    filter: drop-shadow(0 4px 16px rgba(0,0,0,0.2));
  }

  .text {
    color: #fff;
  }
  .title {
    font-size: 52px;
    font-weight: 700;
    margin-bottom: 12px;
    letter-spacing: -0.5px;
  }
  .subtitle {
    font-size: 22px;
    font-weight: 400;
    opacity: 0.85;
    line-height: 1.5;
    max-width: 560px;
  }
  .pills {
    display: flex;
    gap: 12px;
    margin-top: 24px;
    flex-wrap: wrap;
  }
  .pill {
    padding: 8px 18px;
    border-radius: 20px;
    background: rgba(255,255,255,0.15);
    color: #fff;
    font-size: 15px;
    font-weight: 500;
    backdrop-filter: blur(4px);
  }
</style></head>
<body>
  <div class="content">
    <div class="icon">${svgContent}</div>
    <div class="text">
      <div class="title">Happy MD Editor</div>
      <div class="subtitle">The missing Chrome markdown editor — open, edit, and save .md files with a clean WYSIWYG interface.</div>
      <div class="pills">
        <span class="pill">WYSIWYG</span>
        <span class="pill">Source Mode</span>
        <span class="pill">Dark Theme</span>
        <span class="pill">Save to Disk</span>
        <span class="pill">100% Offline</span>
      </div>
    </div>
  </div>
</body></html>`;

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 560, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'networkidle0' });

  const outPath = path.join(OUTPUT, 'promo-marquee-1400x560.png');
  await page.screenshot({
    path: outPath,
    clip: { x: 0, y: 0, width: 1400, height: 560 },
    omitBackground: false, // no alpha
  });

  console.log('Generated ' + outPath);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
