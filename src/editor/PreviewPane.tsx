import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { PerfLogger } from '../shared/logger';
import { PREVIEW_DEBOUNCE_MS } from '../shared/constants';
import { highlightAllBlocks } from './highlight-service';

export interface PreviewPaneProps {
  markdown: string;
}

export interface PreviewPaneRef {
  getContainer: () => HTMLDivElement | null;
}

interface MarkdownRenderer {
  md: import('markdown-it').default;
  DOMPurify: typeof import('dompurify').default;
}

let rendererPromise: Promise<MarkdownRenderer> | null = null;

/** Reset the cached renderer — used by tests to ensure clean state */
export function _resetRenderer(): void {
  rendererPromise = null;
}

function loadRenderer(): Promise<MarkdownRenderer> {
  if (rendererPromise) return rendererPromise;
  rendererPromise = (async () => {
    PerfLogger.start('preview:load');
    const [markdownItModule, domPurifyModule] = await Promise.all([
      import('markdown-it'),
      import('dompurify'),
    ]);
    const MarkdownIt = markdownItModule.default;
    const DOMPurify = domPurifyModule.default;

    const md = new MarkdownIt({
      html: false,
      linkify: true,
      typographer: false,
    });

    // Add data-source-line attributes to block-level tokens
    addSourceLinePlugin(md);

    PerfLogger.end('preview:load');
    return { md, DOMPurify };
  })();
  return rendererPromise;
}

/** markdown-it plugin that adds data-source-line to block elements */
function addSourceLinePlugin(md: import('markdown-it').default) {
  // Override the default open renderer for block-level tokens to inject data-source-line
  const defaultRender =
    md.renderer.rules.fence ||
    function (tokens, idx, options, _env, self) {
      return self.renderToken(tokens, idx, options);
    };

  // Inject line attributes on block tokens during the core rule phase
  md.core.ruler.push('source_line', (state) => {
    for (const token of state.tokens) {
      if (token.map && token.map.length >= 2) {
        token.attrSet('data-source-line', String(token.map[0]));
      }
    }
  });

  // For fence blocks, inject data-source-line on the wrapping <pre>
  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const line = token.map ? token.map[0] : null;
    const result = defaultRender(tokens, idx, options, env, self);
    if (line != null) {
      return result.replace(/^<pre/, `<pre data-source-line="${line}"`);
    }
    return result;
  };
}

function renderMarkdown(
  renderer: MarkdownRenderer,
  markdown: string,
): string {
  PerfLogger.start('preview:render');
  const rawHtml = renderer.md.render(markdown);
  PerfLogger.end('preview:render', { charCount: markdown.length });

  PerfLogger.start('preview:sanitize');
  const cleanHtml = renderer.DOMPurify.sanitize(rawHtml, {
    ADD_ATTR: ['data-source-line'],
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'onfocus', 'onblur'],
  });
  PerfLogger.end('preview:sanitize', { charCount: markdown.length });

  return cleanHtml;
}

export const PreviewPane = forwardRef<PreviewPaneRef, PreviewPaneProps>(({ markdown }, ref) => {
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const rendererRef = useRef<MarkdownRenderer | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markdownRef = useRef(markdown);
  const mountedRef = useRef(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    getContainer: () => containerRef.current,
  }), []);

  markdownRef.current = markdown;

  // Load renderer on mount
  useEffect(() => {
    mountedRef.current = true;
    loadRenderer().then((renderer) => {
      if (!mountedRef.current) return;
      rendererRef.current = renderer;
      // Render initial content immediately (no debounce)
      const result = renderMarkdown(renderer, markdownRef.current);
      setHtml(result);
      setLoading(false);
    });

    return () => {
      mountedRef.current = false;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Debounced re-render on markdown changes
  const scheduleRender = useCallback((newMarkdown: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      const renderer = rendererRef.current;
      if (!renderer || !mountedRef.current) return;
      const result = renderMarkdown(renderer, newMarkdown);
      setHtml(result);
    }, PREVIEW_DEBOUNCE_MS);
  }, []);

  // Watch for markdown changes after initial load
  const initialRenderDone = useRef(false);
  useEffect(() => {
    if (loading) return;
    if (!initialRenderDone.current) {
      initialRenderDone.current = true;
      return;
    }
    scheduleRender(markdown);
  }, [markdown, loading, scheduleRender]);

  // Apply syntax highlighting to code blocks after HTML render
  useEffect(() => {
    if (loading || !html || !containerRef.current) return;
    highlightAllBlocks(containerRef.current);
  }, [html, loading]);

  if (loading) {
    return (
      <div ref={containerRef} className="preview-pane preview-loading" aria-label="Preview loading">
        Loading preview…
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="preview-pane"
      aria-label="Markdown preview"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});
