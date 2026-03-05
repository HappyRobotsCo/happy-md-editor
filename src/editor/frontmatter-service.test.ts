import { describe, it, expect, beforeEach } from 'vitest';
import { PerfLogger } from '../shared/logger';
import { parseFrontmatter, recombineFrontmatter } from './frontmatter-service';

describe('frontmatter-service', () => {
  beforeEach(() => {
    PerfLogger.clear();
  });

  describe('parseFrontmatter', () => {
    it('extracts frontmatter and body from a file with YAML frontmatter', () => {
      const raw = '---\ntitle: Hello\ntags:\n  - foo\n---\n# Body';
      const { rawFrontmatter, body } = parseFrontmatter(raw);
      expect(rawFrontmatter).toBe('---\ntitle: Hello\ntags:\n  - foo\n---\n');
      expect(body).toBe('# Body');
    });

    it('returns empty frontmatter for files without frontmatter', () => {
      const raw = '# Just a heading\n\nSome content';
      const { rawFrontmatter, body } = parseFrontmatter(raw);
      expect(rawFrontmatter).toBe('');
      expect(body).toBe(raw);
    });

    it('handles empty frontmatter (---\\n---)', () => {
      const raw = '---\n---\n# Body';
      const { rawFrontmatter, body } = parseFrontmatter(raw);
      expect(rawFrontmatter).toBe('---\n---\n');
      expect(body).toBe('# Body');
    });

    it('preserves complex YAML with nested objects and arrays', () => {
      const yaml = [
        '---',
        'title: "Complex YAML"',
        'tags:',
        '  - foo',
        '  - bar',
        'nested:',
        '  key: value',
        '  list:',
        '    - one',
        '    - two',
        'multiline: |',
        '  This is a',
        '  multiline string',
        '---',
        '# Body content',
      ].join('\n');
      const { rawFrontmatter, body } = parseFrontmatter(yaml);
      expect(body).toBe('# Body content');
      expect(rawFrontmatter).toContain('title: "Complex YAML"');
      expect(rawFrontmatter).toContain('  - foo');
      expect(rawFrontmatter).toContain('multiline: |');
    });

    it('handles frontmatter with special characters', () => {
      const raw = '---\ntitle: "Hello: World"\ndescription: "It\'s a <test> & more"\n---\n# Body';
      const { rawFrontmatter, body } = parseFrontmatter(raw);
      expect(rawFrontmatter).toBe('---\ntitle: "Hello: World"\ndescription: "It\'s a <test> & more"\n---\n');
      expect(body).toBe('# Body');
    });

    it('handles Windows-style line endings (\\r\\n)', () => {
      const raw = '---\r\ntitle: Hello\r\n---\r\n# Body';
      const { rawFrontmatter, body } = parseFrontmatter(raw);
      expect(rawFrontmatter).toBe('---\r\ntitle: Hello\r\n---\r\n');
      expect(body).toBe('# Body');
    });

    it('does not treat --- in body as frontmatter delimiter', () => {
      const raw = '# Heading\n\n---\n\nSome content';
      const { rawFrontmatter, body } = parseFrontmatter(raw);
      expect(rawFrontmatter).toBe('');
      expect(body).toBe(raw);
    });

    it('handles frontmatter with --- inside YAML values', () => {
      const raw = '---\ntitle: "---"\n---\n# Body';
      // gray-matter style: --- inside quotes is part of YAML, closing --- must be on its own line
      const { body } = parseFrontmatter(raw);
      // The parser finds the first valid \n---\n pattern
      // "---" in the value contains --- but not on its own line with \n prefix
      expect(body).toBe('# Body');
    });

    it('handles file with only frontmatter and no body', () => {
      const raw = '---\ntitle: Hello\n---\n';
      const { rawFrontmatter, body } = parseFrontmatter(raw);
      expect(rawFrontmatter).toBe('---\ntitle: Hello\n---\n');
      expect(body).toBe('');
    });

    it('handles file that starts with --- but has no closing delimiter', () => {
      const raw = '---\ntitle: Hello\nNo closing delimiter';
      const { rawFrontmatter, body } = parseFrontmatter(raw);
      expect(rawFrontmatter).toBe('');
      expect(body).toBe(raw);
    });

    it('preserves blank line between frontmatter and body', () => {
      const raw = '---\ntitle: Hello\n---\n\n# Body';
      const { rawFrontmatter, body } = parseFrontmatter(raw);
      expect(rawFrontmatter).toBe('---\ntitle: Hello\n---\n');
      expect(body).toBe('\n# Body');
    });

    it('logs frontmatter:parse via PerfLogger', () => {
      parseFrontmatter('---\ntitle: Test\n---\n# Body');
      const entries = PerfLogger.getAll();
      const parseEntry = entries.find((e) => e.label === 'frontmatter:parse');
      expect(parseEntry).toBeDefined();
      expect(parseEntry!.metadata?.hasFrontmatter).toBe(true);
    });

    it('logs hasFrontmatter: false when no frontmatter', () => {
      parseFrontmatter('# No frontmatter');
      const entries = PerfLogger.getAll();
      const parseEntry = entries.find((e) => e.label === 'frontmatter:parse');
      expect(parseEntry).toBeDefined();
      expect(parseEntry!.metadata?.hasFrontmatter).toBe(false);
    });

    it('parses within 10ms for typical files', () => {
      const raw = '---\ntitle: Hello\ntags:\n  - foo\n  - bar\n---\n' + '# Body\n\n'.repeat(100);
      PerfLogger.clear();
      parseFrontmatter(raw);
      const entries = PerfLogger.getAll();
      const parseEntry = entries.find((e) => e.label === 'frontmatter:parse');
      expect(parseEntry).toBeDefined();
      expect(parseEntry!.durationMs).toBeLessThan(10);
    });

    it('handles empty string input', () => {
      const { rawFrontmatter, body } = parseFrontmatter('');
      expect(rawFrontmatter).toBe('');
      expect(body).toBe('');
    });
  });

  describe('recombineFrontmatter', () => {
    it('concatenates frontmatter block and body', () => {
      const result = recombineFrontmatter('---\ntitle: Hello\n---\n', '# Body');
      expect(result).toBe('---\ntitle: Hello\n---\n# Body');
    });

    it('returns body unchanged when frontmatter is empty', () => {
      const result = recombineFrontmatter('', '# Body');
      expect(result).toBe('# Body');
    });

    it('logs frontmatter:recombine via PerfLogger', () => {
      recombineFrontmatter('---\ntitle: Test\n---\n', '# Body');
      const entries = PerfLogger.getAll();
      const recombineEntry = entries.find((e) => e.label === 'frontmatter:recombine');
      expect(recombineEntry).toBeDefined();
    });
  });

  describe('round-trip preservation', () => {
    const testCases = [
      '---\ntitle: Hello\n---\n# Body',
      '# No frontmatter',
      '---\n---\n# Empty FM',
      '---\ntitle: "# Body"\ntags:\n  - foo\n  - bar\n---\n# Body',
      '---\r\ntitle: Hello\r\n---\r\n# Body',
      '---\ntitle: Hello\n---\n\n# Body with gap',
      '---\ntitle: Hello\n---\n',
    ];

    for (const raw of testCases) {
      it(`byte-for-byte preserves: ${JSON.stringify(raw).slice(0, 50)}`, () => {
        const { rawFrontmatter, body } = parseFrontmatter(raw);
        const reconstructed = recombineFrontmatter(rawFrontmatter, body);
        expect(reconstructed).toBe(raw);
      });
    }
  });
});
