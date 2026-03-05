import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dir = dirname(__filename);

/**
 * Static analysis tests for the print stylesheet.
 * jsdom cannot evaluate @media print, so we verify the CSS rules
 * are present by reading the file content directly.
 */
describe('print stylesheet', () => {
  const css = readFileSync(resolve(__dir, 'editor.css'), 'utf-8');
  // Extract everything after "@media print {"
  const printStart = css.indexOf('@media print');
  const printBlock = printStart >= 0 ? css.slice(printStart) : '';

  it('contains @media print block', () => {
    expect(printStart).toBeGreaterThanOrEqual(0);
  });

  it('hides toolbar-area in print', () => {
    expect(printBlock).toContain('.toolbar-area');
    expect(printBlock).toContain('display: none');
  });

  it('forces white background on body', () => {
    expect(printBlock).toContain('background: #ffffff');
  });

  it('overrides dark theme variables for print', () => {
    expect(printBlock).toContain("[data-theme='dark']");
    expect(printBlock).toContain('--bg-primary: #ffffff');
    expect(printBlock).toContain('--text-primary: #1a1a1a');
  });

  it('removes tiptap-editor page chrome (border, shadow, max-width)', () => {
    expect(printBlock).toContain('.tiptap-editor');
    expect(printBlock).toContain('max-width: none');
    expect(printBlock).toContain('box-shadow: none');
    expect(printBlock).toContain('border: none');
  });

  it('sets page margins via @page rule', () => {
    expect(printBlock).toContain('@page');
    expect(printBlock).toContain('margin: 2cm');
  });

  it('prevents page breaks inside code blocks and tables', () => {
    expect(printBlock).toContain('break-inside: avoid');
  });

  it('keeps headings with following content', () => {
    expect(printBlock).toContain('break-after: avoid');
  });

  it('hides source pane in split mode for print', () => {
    expect(printBlock).toContain('.split-pane--source');
  });

  it('expands link URLs for print', () => {
    expect(printBlock).toContain('content: " (" attr(href) ")"');
  });

  it('wraps code block text for print', () => {
    expect(printBlock).toContain('white-space: pre-wrap');
  });
});
