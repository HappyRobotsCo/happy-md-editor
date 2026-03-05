import '../styles/light.css';
import '../styles/dark.css';
import '../styles/onboarding.css';
import { ONBOARDING_STORAGE_KEY } from '../shared/constants';
import { initTheme } from '../editor/theme-service';
import { PerfLogger } from '../shared/logger';

async function init(): Promise<void> {
  PerfLogger.start('onboarding:init');

  await initTheme();

  const copyBtn = document.getElementById('copy-url-btn');
  const extensionsUrl = document.getElementById('extensions-url');
  const gotItBtn = document.getElementById('got-it-btn');

  if (copyBtn && extensionsUrl) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(extensionsUrl.textContent?.trim() ?? 'chrome://extensions');
      copyBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyBtn.textContent = 'Copy';
      }, 2000);
    });
  }

  if (gotItBtn) {
    gotItBtn.addEventListener('click', async () => {
      PerfLogger.start('onboarding:complete');
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        await chrome.storage.local.set({ [ONBOARDING_STORAGE_KEY]: true });
      }
      PerfLogger.end('onboarding:complete');

      // Open the editor in a new tab and close this one
      if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
        await chrome.tabs.create({
          url: chrome.runtime.getURL('src/editor/index.html'),
        });
        window.close();
      }
    });
  }

  PerfLogger.end('onboarding:init');
}

init();
