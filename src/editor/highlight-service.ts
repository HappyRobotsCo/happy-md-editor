import { PerfLogger } from '../shared/logger';

// Language alias mapping — maps common aliases to Prism component names
const LANGUAGE_ALIASES: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  rb: 'ruby',
  rs: 'rust',
  golang: 'go',
  htm: 'html',
  xml: 'markup',
  svg: 'markup',
  md: 'markdown',
  dockerfile: 'docker',
};

// The 10 default languages to bundle (loaded eagerly with Prism)
const DEFAULT_LANGUAGES = [
  'javascript',
  'typescript',
  'python',
  'bash',
  'markup', // HTML/XML/SVG
  'css',
  'json',
  'sql',
  'go',
  'rust',
];

// Track loaded additional languages to avoid re-importing
const loadedLanguages = new Set<string>();

let prismInstance: typeof import('prismjs') | null = null;
let loadPromise: Promise<typeof import('prismjs')> | null = null;

/** Reset state — used by tests */
export function _resetHighlighter(): void {
  prismInstance = null;
  loadPromise = null;
  loadedLanguages.clear();
}

/**
 * Lazy-load Prism.js with all 10 default languages.
 * Subsequent calls return the cached instance.
 */
export async function loadPrism(): Promise<typeof import('prismjs')> {
  if (prismInstance) return prismInstance;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    PerfLogger.start('highlight:load');

    // Import Prism core (includes JS, CSS, markup, clike)
    const Prism = (await import('prismjs')).default;

    // Prevent Prism from auto-highlighting on load
    Prism.manual = true;

    // Load additional default languages that aren't in core
    await Promise.all([
      import('prismjs/components/prism-typescript'),
      import('prismjs/components/prism-python'),
      import('prismjs/components/prism-bash'),
      import('prismjs/components/prism-json'),
      import('prismjs/components/prism-sql'),
      import('prismjs/components/prism-go'),
      import('prismjs/components/prism-rust'),
    ]);

    // Mark all defaults as loaded
    for (const lang of DEFAULT_LANGUAGES) {
      loadedLanguages.add(lang);
    }
    // Also mark aliases that map to core languages
    loadedLanguages.add('clike');

    PerfLogger.end('highlight:load', { languageCount: DEFAULT_LANGUAGES.length });
    prismInstance = Prism;
    return Prism;
  })();

  return loadPromise;
}

/**
 * Resolve a language string to a Prism grammar name.
 * Returns null if the language is unknown/empty.
 */
function resolveLanguage(lang: string): string | null {
  if (!lang) return null;
  const normalized = lang.toLowerCase().trim();
  return LANGUAGE_ALIASES[normalized] || normalized;
}

/**
 * Try to lazy-load an additional language grammar.
 * Returns true if the language is available after loading.
 */
async function loadLanguage(lang: string): Promise<boolean> {
  if (!prismInstance) return false;
  if (loadedLanguages.has(lang)) return true;
  if (prismInstance.languages[lang]) {
    loadedLanguages.add(lang);
    return true;
  }

  PerfLogger.start('highlight:lazy-load');
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (import(`prismjs/components/prism-${lang}.js`) as Promise<any>);
    loadedLanguages.add(lang);
    PerfLogger.end('highlight:lazy-load', { language: lang });
    return true;
  } catch {
    PerfLogger.end('highlight:lazy-load', { language: lang, error: true });
    return false;
  }
}

/**
 * Highlight all code blocks within a container element.
 * Finds `<pre><code class="language-xxx">` elements and applies Prism highlighting.
 * Adds language labels to code blocks.
 */
export async function highlightAllBlocks(container: HTMLElement): Promise<void> {
  const Prism = await loadPrism();

  PerfLogger.start('highlight:page');

  const codeBlocks = container.querySelectorAll<HTMLElement>('pre code[class*="language-"]');
  let blockCount = 0;

  for (const codeEl of codeBlocks) {
    const classMatch = codeEl.className.match(/language-(\S+)/);
    if (!classMatch) continue;

    const rawLang = classMatch[1];
    const lang = resolveLanguage(rawLang);
    if (!lang) continue;

    // Ensure the language grammar is available
    const hasGrammar = loadedLanguages.has(lang) || (await loadLanguage(lang));

    if (hasGrammar && Prism.languages[lang]) {
      PerfLogger.start('highlight:block');
      Prism.highlightElement(codeEl);
      PerfLogger.end('highlight:block', {
        language: lang,
        codeLength: codeEl.textContent?.length ?? 0,
      });
      blockCount++;
    }

    // Add language label to the parent <pre> if not already present
    const pre = codeEl.parentElement;
    if (pre && pre.tagName === 'PRE' && !pre.hasAttribute('data-language')) {
      pre.setAttribute('data-language', rawLang);
    }
  }

  PerfLogger.end('highlight:page', { blockCount });
}

/**
 * Highlight a single code string and return the HTML.
 * Used for Tiptap WYSIWYG decoration.
 * Returns null if the language is not available.
 */
export function highlightCode(code: string, language: string): string | null {
  if (!prismInstance) return null;
  const lang = resolveLanguage(language);
  if (!lang || !prismInstance.languages[lang]) return null;
  return prismInstance.highlight(code, prismInstance.languages[lang], lang);
}

/**
 * Get the Prism instance if loaded, or null.
 */
export function getPrism(): typeof import('prismjs') | null {
  return prismInstance;
}
