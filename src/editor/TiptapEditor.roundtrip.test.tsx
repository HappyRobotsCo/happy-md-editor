import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { TiptapEditor, TiptapEditorRef } from './TiptapEditor';
import { PerfLogger } from '../shared/logger';

// Tiptap needs these DOM APIs that jsdom may not fully support
beforeEach(() => {
  if (!document.createRange) {
    document.createRange = () =>
      ({
        setStart: vi.fn(),
        setEnd: vi.fn(),
        commonAncestorContainer: document.body,
        getBoundingClientRect: () => ({
          top: 0, left: 0, right: 0, bottom: 0,
          width: 0, height: 0, x: 0, y: 0, toJSON: vi.fn(),
        }),
        getClientRects: () => [],
        createContextualFragment: (html: string) => {
          const div = document.createElement('div');
          div.innerHTML = html;
          const frag = document.createDocumentFragment();
          while (div.firstChild) frag.appendChild(div.firstChild);
          return frag;
        },
      }) as unknown as Range;
  }

  if (!window.getComputedStyle) {
    window.getComputedStyle = () =>
      ({ getPropertyValue: () => '' }) as unknown as CSSStyleDeclaration;
  }

  if (!Element.prototype.getClientRects) {
    Element.prototype.getClientRects = () => [] as unknown as DOMRectList;
  }

  PerfLogger.clear();
});

/**
 * Helper: render markdown into Tiptap and capture the serialized output.
 * Returns the serialized markdown string from onUpdate.
 */
async function roundTrip(input: string): Promise<string> {
  const onUpdate = vi.fn();

  const ref = React.createRef<TiptapEditorRef>();

  await act(async () => {
    render(<TiptapEditor ref={ref} content={input} onUpdate={onUpdate} />);
  });

  // Wait for editor to initialize and fire onUpdate (from onCreate or initial content)
  // The editor may or may not call onUpdate on init depending on Tiptap behavior.
  // We can also manually trigger serialization via the ref.
  await waitFor(() => {
    expect(ref.current?.getEditor()).toBeTruthy();
  });

  const editor = ref.current!.getEditor()!;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const md = (editor.storage as any).markdown.getMarkdown() as string;
  return md;
}

// ─── Headings ───────────────────────────────────────────────────────

describe('Round-trip: Headings', () => {
  it('# Heading 1', async () => {
    const result = await roundTrip('# Heading 1');
    expect(result).toBe('# Heading 1');
  });

  it('## Heading 2', async () => {
    const result = await roundTrip('## Heading 2');
    expect(result).toBe('## Heading 2');
  });

  it('### Heading 3', async () => {
    const result = await roundTrip('### Heading 3');
    expect(result).toBe('### Heading 3');
  });

  it('#### Heading 4', async () => {
    const result = await roundTrip('#### Heading 4');
    expect(result).toBe('#### Heading 4');
  });

  it('##### Heading 5', async () => {
    const result = await roundTrip('##### Heading 5');
    expect(result).toBe('##### Heading 5');
  });

  it('###### Heading 6', async () => {
    const result = await roundTrip('###### Heading 6');
    expect(result).toBe('###### Heading 6');
  });
});

// ─── Inline formatting ─────────────────────────────────────────────

describe('Round-trip: Inline formatting', () => {
  it('**bold**', async () => {
    const result = await roundTrip('**bold**');
    expect(result).toBe('**bold**');
  });

  it('*italic*', async () => {
    const result = await roundTrip('*italic*');
    expect(result).toBe('*italic*');
  });

  it('~~strikethrough~~', async () => {
    const result = await roundTrip('~~strikethrough~~');
    expect(result).toBe('~~strikethrough~~');
  });

  it('`inline code`', async () => {
    const result = await roundTrip('`inline code`');
    expect(result).toBe('`inline code`');
  });

  it('**bold** and *italic* in same paragraph', async () => {
    const result = await roundTrip('**bold** and *italic* text');
    expect(result).toBe('**bold** and *italic* text');
  });

  it('nested **bold with *italic* inside**', async () => {
    const result = await roundTrip('***bold italic***');
    // Acceptable: may serialize as ***text*** or **_text_** etc
    expect(result).toMatch(/\*{2,3}bold italic\*{2,3}|(\*\*\*bold italic\*\*\*)/);
  });

  it('**bold** at start of paragraph', async () => {
    const result = await roundTrip('**start** of line');
    expect(result).toBe('**start** of line');
  });

  it('end of line **bold**', async () => {
    const result = await roundTrip('end of line **bold**');
    expect(result).toBe('end of line **bold**');
  });

  it('multiple `code` spans `in` one `line`', async () => {
    const result = await roundTrip('a `code` b `in` c `line` d');
    expect(result).toBe('a `code` b `in` c `line` d');
  });

  it('bold and strikethrough combined', async () => {
    const result = await roundTrip('**bold** and ~~struck~~');
    expect(result).toBe('**bold** and ~~struck~~');
  });
});

// ─── Links ──────────────────────────────────────────────────────────

describe('Round-trip: Links', () => {
  it('[link](url)', async () => {
    const result = await roundTrip('[click here](https://example.com)');
    expect(result).toBe('[click here](https://example.com)');
  });

  it('[link](url "title") — title may be stripped', async () => {
    const result = await roundTrip('[click](https://example.com "Title")');
    // tiptap-markdown may or may not preserve the title attribute
    expect(result).toContain('[click](https://example.com');
  });

  it('multiple links in one paragraph', async () => {
    const result = await roundTrip('[a](https://a.com) and [b](https://b.com)');
    expect(result).toContain('[a](https://a.com)');
    expect(result).toContain('[b](https://b.com)');
  });

  it('link with **bold** text', async () => {
    const result = await roundTrip('[**bold link**](https://example.com)');
    expect(result).toContain('bold link');
    expect(result).toContain('https://example.com');
  });
});

// ─── Task lists ─────────────────────────────────────────────────────

describe('Round-trip: Task lists', () => {
  it('- [ ] unchecked task', async () => {
    const result = await roundTrip('- [ ] unchecked task');
    expect(result).toContain('[ ]');
    expect(result).toContain('unchecked task');
  });

  it('- [x] checked task', async () => {
    const result = await roundTrip('- [x] checked task');
    expect(result).toContain('[x]');
    expect(result).toContain('checked task');
  });

  it('mixed checked and unchecked', async () => {
    const input = '- [ ] todo\n- [x] done\n- [ ] also todo';
    const result = await roundTrip(input);
    const lines = result.split('\n').filter(l => l.trim());
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('[ ]');
    expect(lines[1]).toContain('[x]');
    expect(lines[2]).toContain('[ ]');
  });
});

// ─── Blockquotes ────────────────────────────────────────────────────

describe('Round-trip: Blockquotes', () => {
  it('> simple blockquote', async () => {
    const result = await roundTrip('> A quote');
    expect(result).toBe('> A quote');
  });

  it('multi-line blockquote', async () => {
    const result = await roundTrip('> Line one\n> Line two');
    expect(result).toContain('>');
    expect(result).toContain('Line one');
    // Tiptap may join lines into one paragraph
  });

  it('blockquote with **bold** text', async () => {
    const result = await roundTrip('> **bold** quote');
    expect(result).toMatch(/^>\s+\*\*bold\*\* quote$/m);
  });
});

// ─── Code blocks ────────────────────────────────────────────────────

describe('Round-trip: Code blocks', () => {
  it('fenced code block without language', async () => {
    const input = '```\nconst x = 1;\n```';
    const result = await roundTrip(input);
    expect(result).toContain('```');
    expect(result).toContain('const x = 1;');
  });

  it('fenced code block with javascript language', async () => {
    const input = '```javascript\nconsole.log("hi");\n```';
    const result = await roundTrip(input);
    expect(result).toContain('```javascript');
    expect(result).toContain('console.log("hi");');
  });

  it('fenced code block with python language', async () => {
    const input = '```python\nprint("hello")\n```';
    const result = await roundTrip(input);
    expect(result).toContain('```python');
    expect(result).toContain('print("hello")');
  });

  it('code block with multiple lines', async () => {
    const input = '```\nline 1\nline 2\nline 3\n```';
    const result = await roundTrip(input);
    expect(result).toContain('line 1');
    expect(result).toContain('line 2');
    expect(result).toContain('line 3');
  });

  it('code block preserves indentation', async () => {
    const input = '```\n  indented\n    more indented\n```';
    const result = await roundTrip(input);
    expect(result).toContain('  indented');
    expect(result).toContain('    more indented');
  });
});

// ─── Tables ─────────────────────────────────────────────────────────

describe('Round-trip: Tables', () => {
  it('simple 2x2 table', async () => {
    const input = '| A | B |\n| --- | --- |\n| 1 | 2 |';
    const result = await roundTrip(input);
    expect(result).toContain('A');
    expect(result).toContain('B');
    expect(result).toContain('1');
    expect(result).toContain('2');
    expect(result).toContain('|');
    expect(result).toContain('---');
  });

  it('table with 3 columns', async () => {
    const input = '| Name | Age | City |\n| --- | --- | --- |\n| Alice | 30 | NYC |';
    const result = await roundTrip(input);
    expect(result).toContain('Name');
    expect(result).toContain('Age');
    expect(result).toContain('City');
    expect(result).toContain('Alice');
  });

  it('table with alignment markers (best effort)', async () => {
    const input = '| Left | Center | Right |\n| :--- | :---: | ---: |\n| a | b | c |';
    const result = await roundTrip(input);
    // Best effort: content preserved, alignment markers may or may not survive
    expect(result).toContain('Left');
    expect(result).toContain('Center');
    expect(result).toContain('Right');
    expect(result).toContain('|');
  });

  it('table with formatted cells', async () => {
    const input = '| **Bold** | *Italic* |\n| --- | --- |\n| `code` | ~~struck~~ |';
    const result = await roundTrip(input);
    expect(result).toContain('**Bold**');
    expect(result).toContain('*Italic*');
    expect(result).toContain('`code`');
    expect(result).toContain('~~struck~~');
  });
});

// ─── Lists ──────────────────────────────────────────────────────────

describe('Round-trip: Lists', () => {
  it('simple bullet list', async () => {
    const input = '- Item 1\n- Item 2\n- Item 3';
    const result = await roundTrip(input);
    const lines = result.split('\n').filter(l => l.trim());
    expect(lines).toHaveLength(3);
    lines.forEach(line => expect(line.trim()).toMatch(/^[-*] /));
  });

  it('simple ordered list', async () => {
    const input = '1. First\n2. Second\n3. Third';
    const result = await roundTrip(input);
    expect(result).toContain('First');
    expect(result).toContain('Second');
    expect(result).toContain('Third');
    // May use 1. 2. 3. or all 1.
    expect(result).toMatch(/^\d+\./m);
  });

  it('nested bullet list (2 levels)', async () => {
    const input = '- Level 1\n  - Level 2';
    const result = await roundTrip(input);
    expect(result).toContain('Level 1');
    expect(result).toContain('Level 2');
    // Nested items should have indentation
    const lines = result.split('\n').filter(l => l.trim());
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });

  it('nested bullet list (3 levels)', async () => {
    const input = '- Level 1\n  - Level 2\n    - Level 3';
    const result = await roundTrip(input);
    expect(result).toContain('Level 1');
    expect(result).toContain('Level 2');
    expect(result).toContain('Level 3');
  });

  it('mixed ordered and bullet lists', async () => {
    const input = '1. Ordered\n\n- Bullet';
    const result = await roundTrip(input);
    expect(result).toContain('Ordered');
    expect(result).toContain('Bullet');
  });
});

// ─── Horizontal rules ──────────────────────────────────────────────

describe('Round-trip: Horizontal rules', () => {
  it('--- horizontal rule', async () => {
    const input = 'Above\n\n---\n\nBelow';
    const result = await roundTrip(input);
    expect(result).toContain('---');
    expect(result).toContain('Above');
    expect(result).toContain('Below');
  });
});

// ─── Paragraphs ─────────────────────────────────────────────────────

describe('Round-trip: Paragraphs', () => {
  it('simple paragraph', async () => {
    const result = await roundTrip('Hello world');
    expect(result).toBe('Hello world');
  });

  it('two paragraphs separated by blank line', async () => {
    const input = 'Paragraph one\n\nParagraph two';
    const result = await roundTrip(input);
    expect(result).toContain('Paragraph one');
    expect(result).toContain('Paragraph two');
    // Should have blank line between them
    expect(result).toMatch(/Paragraph one\n\nParagraph two/);
  });

  it('paragraph with inline formatting', async () => {
    const input = 'This has **bold**, *italic*, and `code` in it.';
    const result = await roundTrip(input);
    expect(result).toBe('This has **bold**, *italic*, and `code` in it.');
  });
});

// ─── Mixed / complex documents ──────────────────────────────────────

describe('Round-trip: Mixed content', () => {
  it('heading followed by paragraph', async () => {
    const input = '# Title\n\nSome body text.';
    const result = await roundTrip(input);
    expect(result).toContain('# Title');
    expect(result).toContain('Some body text.');
  });

  it('heading, paragraph, and list', async () => {
    const input = '# Shopping\n\nBuy these:\n\n- Apples\n- Bananas';
    const result = await roundTrip(input);
    expect(result).toContain('# Shopping');
    expect(result).toContain('Buy these:');
    expect(result).toContain('Apples');
    expect(result).toContain('Bananas');
  });

  it('blockquote followed by code block', async () => {
    const input = '> A quote\n\n```\nsome code\n```';
    const result = await roundTrip(input);
    expect(result).toContain('> A quote');
    expect(result).toContain('some code');
  });

  it('document with all block types', async () => {
    const input = [
      '# Heading',
      '',
      'Paragraph text with **bold**.',
      '',
      '> A blockquote',
      '',
      '- Bullet 1',
      '- Bullet 2',
      '',
      '1. Ordered 1',
      '2. Ordered 2',
      '',
      '```js',
      'const x = 1;',
      '```',
      '',
      '---',
      '',
      '| A | B |',
      '| --- | --- |',
      '| 1 | 2 |',
    ].join('\n');

    const result = await roundTrip(input);
    expect(result).toContain('# Heading');
    expect(result).toContain('**bold**');
    expect(result).toContain('> A blockquote');
    expect(result).toContain('Bullet 1');
    expect(result).toContain('Ordered 1');
    expect(result).toContain('const x = 1;');
    expect(result).toContain('---');
    expect(result).toContain('|');
  });
});

// ─── Edge cases ─────────────────────────────────────────────────────

describe('Round-trip: Edge cases', () => {
  it('empty string', async () => {
    const result = await roundTrip('');
    expect(result.trim()).toBe('');
  });

  it('single newline', async () => {
    const result = await roundTrip('\n');
    // Tiptap normalizes to empty or whitespace
    expect(result.trim()).toBe('');
  });

  it('multiple blank lines collapse', async () => {
    const result = await roundTrip('Line 1\n\n\n\n\nLine 2');
    expect(result).toContain('Line 1');
    expect(result).toContain('Line 2');
    // Tiptap should normalize multiple blank lines
  });

  it('trailing whitespace on paragraph', async () => {
    const result = await roundTrip('Hello   ');
    expect(result.trim()).toBe('Hello');
  });

  it('special characters in text', async () => {
    const result = await roundTrip('Ampersand & angle <brackets> and "quotes"');
    expect(result).toContain('Ampersand & angle');
  });

  it('raw HTML <details> — stripped or preserved (documented)', async () => {
    const input = '<details><summary>Click</summary>Hidden</details>';
    const result = await roundTrip(input);
    // With html: false, raw HTML is stripped. This is documented behavior.
    // We just verify it doesn't crash and produces something
    expect(typeof result).toBe('string');
  });

  it('heading with inline code', async () => {
    const result = await roundTrip('## Method `getValue()`');
    expect(result).toContain('## ');
    expect(result).toContain('`getValue()`');
  });

  it('paragraph with only inline code', async () => {
    const result = await roundTrip('`just code`');
    expect(result).toBe('`just code`');
  });

  it('deeply nested blockquote', async () => {
    const result = await roundTrip('> > nested quote');
    // Tiptap may flatten or preserve nesting
    expect(result).toContain('nested quote');
  });
});

// ─── Serialization performance ──────────────────────────────────────

describe('Round-trip: Performance', () => {
  it('tiptap:serialize < 100ms for moderate document', async () => {
    // Build a moderately complex document
    const sections = Array.from({ length: 20 }, (_, i) => [
      `## Section ${i + 1}`,
      '',
      `This is paragraph ${i + 1} with **bold** and *italic* text.`,
      '',
      `- Item ${i * 3 + 1}`,
      `- Item ${i * 3 + 2}`,
      `- Item ${i * 3 + 3}`,
      '',
    ].join('\n'));

    const largeDoc = sections.join('\n');
    const onUpdate = vi.fn();
    const ref = React.createRef<TiptapEditorRef>();

    await act(async () => {
      render(<TiptapEditor ref={ref} content={largeDoc} onUpdate={onUpdate} />);
    });

    await waitFor(() => {
      expect(ref.current?.getEditor()).toBeTruthy();
    });

    PerfLogger.clear();

    // Trigger a serialization
    const editor = ref.current!.getEditor()!;
    PerfLogger.start('tiptap:serialize');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (editor.storage as any).markdown.getMarkdown();
    const entry = PerfLogger.end('tiptap:serialize', { charCount: largeDoc.length });

    expect(entry.durationMs).toBeLessThan(100);
  });

  it('round-trip does not crash on large document (500 lines)', async () => {
    const lines = Array.from({ length: 500 }, (_, i) => `Line ${i + 1} with some text`);
    const input = lines.join('\n\n');
    const result = await roundTrip(input);
    expect(result).toContain('Line 1');
    expect(result).toContain('Line 500');
  });
});
