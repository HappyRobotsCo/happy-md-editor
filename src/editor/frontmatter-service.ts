import { PerfLogger } from '../shared/logger';

export interface FrontmatterResult {
  /** Raw frontmatter block including delimiters and trailing newline, or empty string if none */
  rawFrontmatter: string;
  /** Markdown body after frontmatter */
  body: string;
}

/**
 * Extract YAML frontmatter from a markdown string.
 * Preserves the raw frontmatter block byte-for-byte — never parses or re-serializes YAML.
 */
export function parseFrontmatter(raw: string): FrontmatterResult {
  PerfLogger.start('frontmatter:parse');

  // Frontmatter must start at the very beginning of the file with ---
  if (!raw.startsWith('---')) {
    PerfLogger.end('frontmatter:parse', { hasFrontmatter: false });
    return { rawFrontmatter: '', body: raw };
  }

  // Find the closing delimiter: \n---\n or \n--- at end of string
  // Start searching after the opening ---
  const searchStart = 3; // length of '---'
  const newlineAfterOpen = raw.indexOf('\n', searchStart);
  if (newlineAfterOpen === -1) {
    // No newline after opening --- means it's not valid frontmatter
    PerfLogger.end('frontmatter:parse', { hasFrontmatter: false });
    return { rawFrontmatter: '', body: raw };
  }

  // Look for \n--- followed by \n or end of string
  let pos = newlineAfterOpen;
  while (pos < raw.length) {
    const idx = raw.indexOf('\n---', pos);
    if (idx === -1) break;

    const afterClose = idx + 4; // position after \n---
    // Check if followed by \n, \r\n, or end of string
    if (
      afterClose >= raw.length ||
      raw[afterClose] === '\n' ||
      (raw[afterClose] === '\r' && raw[afterClose + 1] === '\n')
    ) {
      // Found the closing delimiter
      // The frontmatter block is everything up to and including the line after ---
      let blockEnd = afterClose;
      if (blockEnd < raw.length) {
        // Include the newline after closing ---
        blockEnd = raw[blockEnd] === '\r' ? blockEnd + 2 : blockEnd + 1;
      }

      const rawFrontmatter = raw.substring(0, blockEnd);
      const body = raw.substring(blockEnd);

      PerfLogger.end('frontmatter:parse', {
        hasFrontmatter: true,
        frontmatterLength: rawFrontmatter.length,
      });
      return { rawFrontmatter, body };
    }

    // Not a valid closing delimiter, keep searching
    pos = idx + 1;
  }

  // No closing delimiter found — not valid frontmatter
  PerfLogger.end('frontmatter:parse', { hasFrontmatter: false });
  return { rawFrontmatter: '', body: raw };
}

/**
 * Recombine frontmatter block with markdown body.
 * Simple concatenation — frontmatter block already includes delimiters and trailing newline.
 */
export function recombineFrontmatter(
  rawFrontmatter: string,
  body: string,
): string {
  PerfLogger.start('frontmatter:recombine');
  const result = rawFrontmatter + body;
  PerfLogger.end('frontmatter:recombine', { length: result.length });
  return result;
}
