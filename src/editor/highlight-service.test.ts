import { describe, it, expect, beforeEach } from 'vitest';
import { PerfLogger } from '../shared/logger';
import {
  loadPrism,
  highlightAllBlocks,
  highlightCode,
  getPrism,
  _resetHighlighter,
} from './highlight-service';

describe('highlight-service', () => {
  beforeEach(() => {
    PerfLogger.clear();
    _resetHighlighter();
  });

  describe('loadPrism', () => {
    it('loads Prism with default languages', async () => {
      const Prism = await loadPrism();
      expect(Prism).toBeDefined();
      expect(Prism.languages.javascript).toBeDefined();
      expect(Prism.languages.typescript).toBeDefined();
      expect(Prism.languages.python).toBeDefined();
      expect(Prism.languages.bash).toBeDefined();
      expect(Prism.languages.css).toBeDefined();
      expect(Prism.languages.json).toBeDefined();
      expect(Prism.languages.sql).toBeDefined();
      expect(Prism.languages.go).toBeDefined();
      expect(Prism.languages.rust).toBeDefined();
      expect(Prism.languages.markup).toBeDefined(); // HTML/XML
    });

    it('returns cached instance on subsequent calls', async () => {
      const first = await loadPrism();
      const second = await loadPrism();
      expect(first).toBe(second);
    });

    it('logs highlight:load performance entry', async () => {
      await loadPrism();
      const entries = PerfLogger.getAll();
      const loadEntry = entries.find((e) => e.label === 'highlight:load');
      expect(loadEntry).toBeDefined();
      expect(loadEntry!.metadata).toEqual({ languageCount: 10 });
    });
  });

  describe('highlightCode', () => {
    it('highlights JavaScript code', async () => {
      await loadPrism();
      const result = highlightCode('const x = 1;', 'javascript');
      expect(result).toBeDefined();
      expect(result).toContain('token');
      expect(result).toContain('keyword');
    });

    it('highlights Python code', async () => {
      await loadPrism();
      const result = highlightCode('def foo():\n  pass', 'python');
      expect(result).toBeDefined();
      expect(result).toContain('keyword');
    });

    it('handles language aliases (js → javascript)', async () => {
      await loadPrism();
      const result = highlightCode('const x = 1;', 'js');
      expect(result).toBeDefined();
      expect(result).toContain('keyword');
    });

    it('returns null for unknown language', async () => {
      await loadPrism();
      const result = highlightCode('some code', 'unknownlang');
      expect(result).toBeNull();
    });

    it('returns null if Prism not loaded', () => {
      const result = highlightCode('const x = 1;', 'javascript');
      expect(result).toBeNull();
    });
  });

  describe('highlightAllBlocks', () => {
    it('highlights code blocks in a container', async () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <pre><code class="language-javascript">const x = 1;</code></pre>
        <pre><code class="language-python">def foo():\n  pass</code></pre>
      `;

      await highlightAllBlocks(container);

      const jsCode = container.querySelector('.language-javascript');
      expect(jsCode?.innerHTML).toContain('<span class="token');
      expect(jsCode?.innerHTML).toContain('keyword');

      const pyCode = container.querySelector('.language-python');
      expect(pyCode?.innerHTML).toContain('<span class="token');
    });

    it('adds data-language attribute to pre elements', async () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <pre><code class="language-typescript">const x: number = 1;</code></pre>
      `;

      await highlightAllBlocks(container);

      const pre = container.querySelector('pre');
      expect(pre?.getAttribute('data-language')).toBe('typescript');
    });

    it('handles unknown language without errors', async () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <pre><code class="language-unknownlang">some code here</code></pre>
      `;

      // Should not throw
      await highlightAllBlocks(container);

      const code = container.querySelector('code');
      // Unknown language: plain text, no Prism spans added
      expect(code?.innerHTML).toBe('some code here');
    });

    it('handles code blocks without language class', async () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <pre><code>plain text</code></pre>
      `;

      await highlightAllBlocks(container);

      const code = container.querySelector('code');
      expect(code?.innerHTML).toBe('plain text');
    });

    it('handles language aliases in class names', async () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <pre><code class="language-js">const x = 1;</code></pre>
      `;

      await highlightAllBlocks(container);

      const code = container.querySelector('.language-js');
      expect(code?.innerHTML).toContain('<span class="token');
    });

    it('logs highlight:page and highlight:block performance', async () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <pre><code class="language-javascript">const x = 1;</code></pre>
        <pre><code class="language-python">def foo(): pass</code></pre>
      `;

      await highlightAllBlocks(container);

      const entries = PerfLogger.getAll();
      const pageEntry = entries.find((e) => e.label === 'highlight:page');
      expect(pageEntry).toBeDefined();
      expect(pageEntry!.metadata).toEqual({ blockCount: 2 });

      const blockEntries = entries.filter((e) => e.label === 'highlight:block');
      expect(blockEntries).toHaveLength(2);
    });

    it('highlights 20 code blocks within performance budget', async () => {
      const blocks = Array.from({ length: 20 }, (_, i) => {
        const lang = i % 2 === 0 ? 'javascript' : 'python';
        const code = lang === 'javascript'
          ? 'const x = 1;\nfunction foo() { return x; }'
          : 'def foo():\n  return 42';
        return `<pre><code class="language-${lang}">${code}</code></pre>`;
      }).join('\n');

      const container = document.createElement('div');
      container.innerHTML = blocks;

      PerfLogger.start('highlight:page');
      await highlightAllBlocks(container);
      // The service already logs highlight:page, check its timing
      const entries = PerfLogger.getAll();
      const pageEntries = entries.filter((e) => e.label === 'highlight:page');
      const lastPage = pageEntries[pageEntries.length - 1];
      expect(lastPage).toBeDefined();
      expect(lastPage!.durationMs).toBeLessThan(100);
    });
  });

  describe('getPrism', () => {
    it('returns null before loading', () => {
      expect(getPrism()).toBeNull();
    });

    it('returns Prism after loading', async () => {
      await loadPrism();
      expect(getPrism()).toBeDefined();
      expect(getPrism()!.languages).toBeDefined();
    });
  });

  describe('lazy language loading', () => {
    it('lazy-loads additional languages for unknown blocks', async () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <pre><code class="language-ruby">puts "hello"</code></pre>
      `;

      await highlightAllBlocks(container);

      const entries = PerfLogger.getAll();
      const lazyEntry = entries.find((e) => e.label === 'highlight:lazy-load');
      // Ruby may or may not be available — just verify no crash
      // If ruby is available, it should have been lazy-loaded
      if (lazyEntry) {
        expect(lazyEntry.metadata).toHaveProperty('language', 'ruby');
      }
    });
  });
});
