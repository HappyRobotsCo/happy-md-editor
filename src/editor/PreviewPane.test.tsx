import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { PreviewPane, _resetRenderer } from './PreviewPane';
import { PerfLogger } from '../shared/logger';

beforeEach(() => {
  PerfLogger.clear();
  _resetRenderer();
});

describe('PreviewPane', () => {
  it('renders loading state initially', () => {
    render(<PreviewPane markdown="# Hello" />);
    expect(screen.getByLabelText('Preview loading')).toBeTruthy();
  });

  it('renders markdown as HTML after loading', async () => {
    render(<PreviewPane markdown="# Hello World" />);

    await waitFor(() => {
      expect(screen.getByLabelText('Markdown preview')).toBeTruthy();
    });

    const preview = screen.getByLabelText('Markdown preview');
    const h1 = preview.querySelector('h1');
    expect(h1).toBeTruthy();
    expect(h1!.textContent).toBe('Hello World');
  });

  it('renders paragraphs', async () => {
    render(<PreviewPane markdown="This is a paragraph." />);

    await waitFor(() => {
      expect(screen.getByLabelText('Markdown preview')).toBeTruthy();
    });

    const preview = screen.getByLabelText('Markdown preview');
    const p = preview.querySelector('p');
    expect(p).toBeTruthy();
    expect(p!.textContent).toBe('This is a paragraph.');
  });

  it('renders bold and italic text', async () => {
    render(<PreviewPane markdown="**bold** and *italic*" />);

    await waitFor(() => {
      expect(screen.getByLabelText('Markdown preview')).toBeTruthy();
    });

    const preview = screen.getByLabelText('Markdown preview');
    expect(preview.querySelector('strong')!.textContent).toBe('bold');
    expect(preview.querySelector('em')!.textContent).toBe('italic');
  });

  it('renders code blocks', async () => {
    const md = '```javascript\nconsole.log("hello");\n```';
    render(<PreviewPane markdown={md} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Markdown preview')).toBeTruthy();
    });

    const preview = screen.getByLabelText('Markdown preview');
    expect(preview.querySelector('pre')).toBeTruthy();
    expect(preview.querySelector('code')).toBeTruthy();
    expect(preview.querySelector('code')!.textContent).toContain('console.log');
  });

  it('renders links', async () => {
    render(<PreviewPane markdown="[Click here](https://example.com)" />);

    await waitFor(() => {
      expect(screen.getByLabelText('Markdown preview')).toBeTruthy();
    });

    const preview = screen.getByLabelText('Markdown preview');
    const link = preview.querySelector('a');
    expect(link).toBeTruthy();
    expect(link!.getAttribute('href')).toBe('https://example.com');
    expect(link!.textContent).toBe('Click here');
  });

  it('renders lists', async () => {
    const md = `- item 1
- item 2
- item 3`;
    render(<PreviewPane markdown={md} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Markdown preview')).toBeTruthy();
    });

    const preview = screen.getByLabelText('Markdown preview');
    const items = preview.querySelectorAll('li');
    expect(items.length).toBe(3);
  });

  it('renders blockquotes', async () => {
    render(<PreviewPane markdown="> This is a quote" />);

    await waitFor(() => {
      expect(screen.getByLabelText('Markdown preview')).toBeTruthy();
    });

    const preview = screen.getByLabelText('Markdown preview');
    expect(preview.querySelector('blockquote')).toBeTruthy();
  });

  it('renders tables', async () => {
    const md = `| A | B |
|---|---|
| 1 | 2 |`;
    render(<PreviewPane markdown={md} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Markdown preview')).toBeTruthy();
    });

    const preview = screen.getByLabelText('Markdown preview');
    expect(preview.querySelector('table')).toBeTruthy();
    expect(preview.querySelector('th')).toBeTruthy();
    expect(preview.querySelector('td')).toBeTruthy();
  });

  it('renders horizontal rules', async () => {
    render(<PreviewPane markdown="---" />);

    await waitFor(() => {
      expect(screen.getByLabelText('Markdown preview')).toBeTruthy();
    });

    const preview = screen.getByLabelText('Markdown preview');
    expect(preview.querySelector('hr')).toBeTruthy();
  });

  describe('data-source-line annotations', () => {
    it('adds data-source-line to headings', async () => {
      const md = `# Heading

Paragraph`;
      render(<PreviewPane markdown={md} />);

      await waitFor(() => {
        expect(screen.getByLabelText('Markdown preview')).toBeTruthy();
      });

      const preview = screen.getByLabelText('Markdown preview');
      const h1 = preview.querySelector('h1');
      expect(h1).toBeTruthy();
      expect(h1!.getAttribute('data-source-line')).toBe('0');
    });

    it('adds data-source-line to paragraphs', async () => {
      const md = `# Heading

Paragraph text`;
      render(<PreviewPane markdown={md} />);

      await waitFor(() => {
        expect(screen.getByLabelText('Markdown preview')).toBeTruthy();
      });

      const preview = screen.getByLabelText('Markdown preview');
      const p = preview.querySelector('p');
      expect(p).toBeTruthy();
      expect(p!.getAttribute('data-source-line')).toBe('2');
    });

    it('adds data-source-line to code blocks', async () => {
      const md = `text

\`\`\`js
code
\`\`\``;
      render(<PreviewPane markdown={md} />);

      await waitFor(() => {
        expect(screen.getByLabelText('Markdown preview')).toBeTruthy();
      });

      const preview = screen.getByLabelText('Markdown preview');
      const pre = preview.querySelector('pre');
      expect(pre).toBeTruthy();
      expect(pre!.getAttribute('data-source-line')).toBe('2');
    });
  });

  describe('sanitization', () => {
    it('preserves data-source-line attributes through sanitization', async () => {
      const md = `# Hello

World`;
      render(<PreviewPane markdown={md} />);

      await waitFor(() => {
        expect(screen.getByLabelText('Markdown preview')).toBeTruthy();
      });

      const preview = screen.getByLabelText('Markdown preview');
      const elements = preview.querySelectorAll('[data-source-line]');
      expect(elements.length).toBeGreaterThan(0);
    });

    it('strips javascript: URLs from links', async () => {
      render(<PreviewPane markdown={"[click](javascript:alert('xss'))"} />);

      await waitFor(() => {
        expect(screen.getByLabelText('Markdown preview')).toBeTruthy();
      });

      const preview = screen.getByLabelText('Markdown preview');
      const links = preview.querySelectorAll('a');
      for (const link of links) {
        const href = link.getAttribute('href') || '';
        expect(href).not.toContain('javascript:');
      }
    });
  });

  describe('debounced updates', () => {
    it('updates preview when markdown prop changes', async () => {
      const { rerender } = render(<PreviewPane markdown="# First" />);

      await waitFor(() => {
        expect(screen.getByLabelText('Markdown preview')).toBeTruthy();
      });

      expect(screen.getByLabelText('Markdown preview').querySelector('h1')!.textContent).toBe('First');

      await act(async () => {
        rerender(<PreviewPane markdown="# Second" />);
      });

      await waitFor(
        () => {
          expect(
            screen.getByLabelText('Markdown preview').querySelector('h1')!.textContent,
          ).toBe('Second');
        },
        { timeout: 1000 },
      );
    });
  });

  describe('PerfLogger instrumentation', () => {
    it('logs preview:render with charCount', async () => {
      render(<PreviewPane markdown="# Hello World" />);

      await waitFor(() => {
        const entries = PerfLogger.getAll();
        const renderEntry = entries.find((e) => e.label === 'preview:render');
        expect(renderEntry).toBeTruthy();
        expect(renderEntry!.metadata).toHaveProperty('charCount');
      });
    });

    it('logs preview:sanitize with charCount', async () => {
      render(<PreviewPane markdown="# Hello World" />);

      await waitFor(() => {
        const entries = PerfLogger.getAll();
        const sanitizeEntry = entries.find((e) => e.label === 'preview:sanitize');
        expect(sanitizeEntry).toBeTruthy();
        expect(sanitizeEntry!.metadata).toHaveProperty('charCount');
      });
    });

    it('logs preview:load on first render', async () => {
      render(<PreviewPane markdown="# Test" />);

      await waitFor(() => {
        const entries = PerfLogger.getAll();
        const loadEntry = entries.find((e) => e.label === 'preview:load');
        expect(loadEntry).toBeTruthy();
      });
    });

    it('preview:render completes within 200ms budget', async () => {
      const largeMd = Array.from(
        { length: 100 },
        (_, i) => `## Heading ${i}\n\nParagraph ${i} with **bold** and *italic* text.\n`,
      ).join('\n');
      render(<PreviewPane markdown={largeMd} />);

      await waitFor(() => {
        const entries = PerfLogger.getAll();
        const renderEntry = entries.find((e) => e.label === 'preview:render');
        expect(renderEntry).toBeTruthy();
        expect(renderEntry!.durationMs).toBeLessThan(200);
      });
    });

    it('preview:sanitize completes within 200ms budget', async () => {
      const largeMd = Array.from(
        { length: 100 },
        (_, i) => `## Heading ${i}\n\nParagraph ${i}\n`,
      ).join('\n');
      render(<PreviewPane markdown={largeMd} />);

      await waitFor(() => {
        const entries = PerfLogger.getAll();
        const sanitizeEntry = entries.find((e) => e.label === 'preview:sanitize');
        expect(sanitizeEntry).toBeTruthy();
        expect(sanitizeEntry!.durationMs).toBeLessThan(200);
      });
    });
  });

  it('cleans up on unmount without errors', async () => {
    const { unmount } = render(<PreviewPane markdown="# First" />);

    await waitFor(() => {
      expect(screen.getByLabelText('Markdown preview')).toBeTruthy();
    });

    unmount();
  });
});
