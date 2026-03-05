#!/usr/bin/env node
/**
 * Generate PNG icons from the SVG source using Puppeteer.
 * Output: public/icons/icon-{16,48,128}.png
 */

import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = path.resolve(__dirname, '..', 'public', 'icons');
const SVG_PATH = path.join(ICONS_DIR, 'icon.svg');

const SIZES = [16, 48, 128];

async function main() {
  const svgContent = fs.readFileSync(SVG_PATH, 'utf-8');

  const browser = await puppeteer.launch({ headless: true });

  for (const size of SIZES) {
    const page = await browser.newPage();
    await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });

    // Render SVG in a minimal HTML page at exact size
    const html = `<!DOCTYPE html>
<html><head><style>
  * { margin: 0; padding: 0; }
  body { width: ${size}px; height: ${size}px; overflow: hidden; }
  svg { width: ${size}px; height: ${size}px; }
</style></head>
<body>${svgContent}</body></html>`;

    await page.setContent(html, { waitUntil: 'networkidle0' });

    const outPath = path.join(ICONS_DIR, `icon-${size}.png`);
    await page.screenshot({
      path: outPath,
      clip: { x: 0, y: 0, width: size, height: size },
      omitBackground: true,
    });

    console.log(`Generated ${outPath} (${size}x${size})`);
    await page.close();
  }

  await browser.close();
  console.log('Done!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
