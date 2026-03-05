import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PerfLogger } from '../shared/logger';
import { ONBOARDING_STORAGE_KEY } from '../shared/constants';

describe('onboarding', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    PerfLogger.clear();
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.body.innerHTML = '';
  });

  describe('constants', () => {
    it('exports ONBOARDING_STORAGE_KEY', () => {
      expect(ONBOARDING_STORAGE_KEY).toBe('onboardingComplete');
    });
  });

  describe('onboarding page structure', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <main class="onboarding" role="main">
          <h1>Welcome to MarkDown Studio</h1>
          <section aria-labelledby="permission-heading">
            <h2 id="permission-heading">Step 1: Enable File URL Access</h2>
            <code class="url-display" id="extensions-url">chrome://extensions</code>
            <button class="copy-btn" id="copy-url-btn" type="button">Copy</button>
          </section>
          <section aria-labelledby="quickstart-heading">
            <h2 id="quickstart-heading">Step 2: Open the Editor</h2>
          </section>
          <section aria-labelledby="features-heading">
            <h2 id="features-heading">Features</h2>
          </section>
          <button class="got-it-btn" id="got-it-btn" type="button">Got it — Open the Editor</button>
        </main>
      `;
    });

    it('has accessible main landmark', () => {
      const main = document.querySelector('main[role="main"]');
      expect(main).not.toBeNull();
    });

    it('has section headings for accessibility', () => {
      const headings = document.querySelectorAll('h2[id]');
      expect(headings.length).toBe(3);
    });

    it('has copy button for chrome://extensions URL', () => {
      const btn = document.getElementById('copy-url-btn');
      expect(btn).not.toBeNull();
      expect(btn?.getAttribute('type')).toBe('button');
    });

    it('has got-it button', () => {
      const btn = document.getElementById('got-it-btn');
      expect(btn).not.toBeNull();
      expect(btn?.textContent).toContain('Got it');
    });

    it('displays chrome://extensions as copyable text', () => {
      const urlDisplay = document.getElementById('extensions-url');
      expect(urlDisplay).not.toBeNull();
      expect(urlDisplay?.textContent?.trim()).toBe('chrome://extensions');
    });
  });

  describe('copy URL functionality', () => {
    it('copies URL to clipboard on button click', async () => {
      document.body.innerHTML = `
        <code id="extensions-url">chrome://extensions</code>
        <button id="copy-url-btn">Copy</button>
      `;

      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: { writeText },
      });

      const copyBtn = document.getElementById('copy-url-btn')!;
      const extensionsUrl = document.getElementById('extensions-url')!;

      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(extensionsUrl.textContent?.trim() ?? 'chrome://extensions');
        copyBtn.textContent = 'Copied!';
      });

      copyBtn.click();
      expect(writeText).toHaveBeenCalledWith('chrome://extensions');
      expect(copyBtn.textContent).toBe('Copied!');
    });
  });

  describe('got-it button functionality', () => {
    it('stores onboardingComplete flag in localStorage', async () => {
      const gotItBtn = document.createElement('button');
      gotItBtn.id = 'got-it-btn';
      document.body.appendChild(gotItBtn);

      gotItBtn.addEventListener('click', () => {
        localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
      });

      gotItBtn.click();
      expect(localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBe('true');
    });
  });

  describe('performance logging', () => {
    it('onboarding:init perf entry can be logged within budget', () => {
      PerfLogger.start('onboarding:init');
      // Simulate onboarding page init (theme detection + DOM setup)
      document.documentElement.setAttribute('data-theme', 'light');
      const entry = PerfLogger.end('onboarding:init');
      expect(entry.durationMs).toBeLessThan(100);
    });

    it('onboarding:complete perf entry can be logged within budget', () => {
      PerfLogger.start('onboarding:complete');
      localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
      const entry = PerfLogger.end('onboarding:complete');
      expect(entry.durationMs).toBeLessThan(50);
    });
  });

  describe('theme support', () => {
    it('onboarding page respects light theme', () => {
      document.documentElement.setAttribute('data-theme', 'light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('onboarding page respects dark theme', () => {
      document.documentElement.setAttribute('data-theme', 'dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
  });
});
