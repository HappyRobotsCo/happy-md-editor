import { defineConfig } from '@playwright/test';
import path from 'path';

const extensionPath = path.resolve(__dirname, 'dist');

export default defineConfig({
  testDir: './playwright',
  timeout: 30_000,
  retries: 0,
  use: {
    // Chrome channel (not Chromium) is required for extension testing
    channel: 'chrome',
    headless: false, // Extensions cannot run headless in Chrome
    launchOptions: {
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-first-run',
        '--disable-default-apps',
      ],
    },
  },
  projects: [
    {
      name: 'chrome-extension',
      use: {},
    },
  ],
  // Reporter for CI
  reporter: process.env.CI ? 'dot' : 'list',
});
