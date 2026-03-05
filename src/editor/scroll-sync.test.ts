import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  getVisibleSourceLine,
  findPreviewElementForLine,
  getVisiblePreviewLine,
  scrollPreviewToLine,
  scrollSourceToLine,
  setupScrollSync,
} from './scroll-sync';
import { PerfLogger } from '../shared/logger';

beforeEach(() => {
  PerfLogger.clear();
});

// Helper to create a mock CodeMirror EditorView
function createMockView(opts: {
  lines?: string[];
  scrollTop?: number;
}) {
  const lines = opts.lines ?? ['# Hello', '', 'World', '', 'End'];
  const doc = lines.join('\n');
  const lineStarts: number[] = [];
  let pos = 0;
  for (const line of lines) {
    lineStarts.push(pos);
    pos += line.length + 1; // +1 for newline
  }

  const scrollDOM = document.createElement('div');
  scrollDOM.scrollTop = opts.scrollTop ?? 0;
  // Make scrollDOM measurable
  Object.defineProperty(scrollDOM, 'scrollHeight', { value: lines.length * 20 });

  const view = {
    scrollDOM,
    state: {
      doc: {
        lines: lines.length,
        lineAt(from: number) {
          for (let i = lines.length - 1; i >= 0; i--) {
            if (from >= lineStarts[i]) {
              return {
                number: i + 1,
                from: lineStarts[i],
                to: lineStarts[i] + lines[i].length,
                text: lines[i],
              };
            }
          }
          return { number: 1, from: 0, to: lines[0].length, text: lines[0] };
        },
        line(num: number) {
          const idx = num - 1;
          return {
            number: num,
            from: lineStarts[idx],
            to: lineStarts[idx] + lines[idx].length,
            text: lines[idx],
          };
        },
        toString() {
          return doc;
        },
      },
    },
    lineBlockAtHeight(height: number) {
      // Simple model: each line is 20px tall
      const lineIdx = Math.min(Math.floor(height / 20), lines.length - 1);
      return {
        from: lineStarts[lineIdx],
        to: lineStarts[lineIdx] + lines[lineIdx].length,
        top: lineIdx * 20,
        bottom: (lineIdx + 1) * 20,
        height: 20,
      };
    },
    lineBlockAt(from: number) {
      // Find line index from position
      for (let i = lines.length - 1; i >= 0; i--) {
        if (from >= lineStarts[i]) {
          return {
            from: lineStarts[i],
            to: lineStarts[i] + lines[i].length,
            top: i * 20,
            bottom: (i + 1) * 20,
            height: 20,
          };
        }
      }
      return { from: 0, to: lines[0].length, top: 0, bottom: 20, height: 20 };
    },
  };

  return view as unknown as import('@codemirror/view').EditorView;
}

// Helper to create a mock preview container with data-source-line elements
function createPreviewContainer(lineMap: { line: number; tag: string; text: string }[]) {
  const container = document.createElement('div');
  // Mock getBoundingClientRect for the container
  Object.defineProperty(container, 'getBoundingClientRect', {
    value: () => ({
      top: 0,
      bottom: 400,
      left: 0,
      right: 800,
      width: 800,
      height: 400,
    }),
  });

  let topOffset = 0;
  for (const item of lineMap) {
    const el = document.createElement(item.tag);
    el.setAttribute('data-source-line', String(item.line));
    el.textContent = item.text;
    const elTop = topOffset;
    const elHeight = 30;
    Object.defineProperty(el, 'getBoundingClientRect', {
      value: () => ({
        top: elTop,
        bottom: elTop + elHeight,
        left: 0,
        right: 800,
        width: 800,
        height: elHeight,
      }),
    });
    container.appendChild(el);
    topOffset += elHeight;
  }

  return container;
}

describe('scroll-sync', () => {
  describe('getVisibleSourceLine', () => {
    it('returns line 1 when scrolled to top', () => {
      const view = createMockView({ scrollTop: 0 });
      expect(getVisibleSourceLine(view)).toBe(1);
    });

    it('returns correct line when scrolled down', () => {
      const view = createMockView({ scrollTop: 40 });
      // 40px / 20px per line = line index 2 = line number 3
      expect(getVisibleSourceLine(view)).toBe(3);
    });

    it('returns last line when scrolled to bottom', () => {
      const lines = ['a', 'b', 'c', 'd', 'e'];
      const view = createMockView({ lines, scrollTop: 80 });
      expect(getVisibleSourceLine(view)).toBe(5);
    });
  });

  describe('findPreviewElementForLine', () => {
    it('finds exact match', () => {
      const container = createPreviewContainer([
        { line: 0, tag: 'h1', text: 'Title' },
        { line: 2, tag: 'p', text: 'Para' },
        { line: 4, tag: 'h2', text: 'Sub' },
      ]);
      const result = findPreviewElementForLine(container, 2);
      expect(result).not.toBeNull();
      expect(result!.line).toBe(2);
      expect(result!.element.textContent).toBe('Para');
    });

    it('finds closest element when no exact match', () => {
      const container = createPreviewContainer([
        { line: 0, tag: 'h1', text: 'Title' },
        { line: 5, tag: 'p', text: 'Para' },
        { line: 10, tag: 'h2', text: 'Sub' },
      ]);
      const result = findPreviewElementForLine(container, 3);
      expect(result).not.toBeNull();
      // Line 5 is closer to 3 than line 0
      expect(result!.line).toBe(5);
    });

    it('returns null for empty container', () => {
      const container = document.createElement('div');
      const result = findPreviewElementForLine(container, 5);
      expect(result).toBeNull();
    });
  });

  describe('getVisiblePreviewLine', () => {
    it('returns first visible source line', () => {
      const container = createPreviewContainer([
        { line: 0, tag: 'h1', text: 'Title' },
        { line: 2, tag: 'p', text: 'Para' },
        { line: 4, tag: 'h2', text: 'Sub' },
      ]);
      const line = getVisiblePreviewLine(container);
      expect(line).toBe(0);
    });

    it('returns null for empty container', () => {
      const container = document.createElement('div');
      Object.defineProperty(container, 'getBoundingClientRect', {
        value: () => ({ top: 0, bottom: 400, left: 0, right: 800, width: 800, height: 400 }),
      });
      const line = getVisiblePreviewLine(container);
      expect(line).toBeNull();
    });
  });

  describe('scrollPreviewToLine', () => {
    it('adjusts preview scrollTop to show target element', () => {
      const container = createPreviewContainer([
        { line: 0, tag: 'h1', text: 'Title' },
        { line: 2, tag: 'p', text: 'Para' },
        { line: 4, tag: 'h2', text: 'Sub' },
      ]);
      container.scrollTop = 0;
      scrollPreviewToLine(container, 4);
      // Element at line 4 is at offset 60 (3rd element * 30px), container top is 0
      expect(container.scrollTop).toBe(60);
    });

    it('does nothing for non-existent line in empty container', () => {
      const container = document.createElement('div');
      container.scrollTop = 100;
      scrollPreviewToLine(container, 50);
      expect(container.scrollTop).toBe(100);
    });
  });

  describe('scrollSourceToLine', () => {
    it('scrolls CodeMirror to show target line', () => {
      const view = createMockView({});
      scrollSourceToLine(view, 2);
      // Line 2 (0-based) → CM line 3 → lineBlockAt returns top=40
      expect(view.scrollDOM.scrollTop).toBe(40);
    });

    it('does nothing for out-of-range line', () => {
      const view = createMockView({});
      view.scrollDOM.scrollTop = 10;
      scrollSourceToLine(view, 100);
      expect(view.scrollDOM.scrollTop).toBe(10);
    });

    it('handles line 0 (first line)', () => {
      const view = createMockView({});
      scrollSourceToLine(view, 0);
      // Line 0 (0-based) → CM line 1 → top=0
      expect(view.scrollDOM.scrollTop).toBe(0);
    });
  });

  describe('setupScrollSync', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('attaches scroll listeners to both containers', () => {
      const view = createMockView({});
      const container = createPreviewContainer([
        { line: 0, tag: 'h1', text: 'Title' },
      ]);

      const sourceSpy = vi.spyOn(view.scrollDOM, 'addEventListener');
      const previewSpy = vi.spyOn(container, 'addEventListener');

      const sync = setupScrollSync(view, container);

      expect(sourceSpy).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true });
      expect(previewSpy).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true });

      sync.destroy();
    });

    it('removes listeners on destroy', () => {
      const view = createMockView({});
      const container = createPreviewContainer([
        { line: 0, tag: 'h1', text: 'Title' },
      ]);

      const sourceRemoveSpy = vi.spyOn(view.scrollDOM, 'removeEventListener');
      const previewRemoveSpy = vi.spyOn(container, 'removeEventListener');

      const sync = setupScrollSync(view, container);
      sync.destroy();

      expect(sourceRemoveSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
      expect(previewRemoveSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
    });

    it('logs scroll:sync PerfLogger entry on source scroll', async () => {
      vi.useFakeTimers();
      const view = createMockView({});
      const container = createPreviewContainer([
        { line: 0, tag: 'h1', text: 'Title' },
        { line: 2, tag: 'p', text: 'Para' },
      ]);

      const sync = setupScrollSync(view, container);

      // Simulate source scroll
      view.scrollDOM.dispatchEvent(new Event('scroll'));
      vi.advanceTimersByTime(60); // past debounce

      const entries = PerfLogger.getAll();
      const syncEntry = entries.find((e) => e.label === 'scroll:sync');
      expect(syncEntry).toBeTruthy();
      expect(syncEntry!.metadata).toMatchObject({ direction: 'source-to-preview' });

      sync.destroy();
      vi.useRealTimers();
    });

    it('logs scroll:sync PerfLogger entry on preview scroll', async () => {
      vi.useFakeTimers();
      const view = createMockView({});
      const container = createPreviewContainer([
        { line: 0, tag: 'h1', text: 'Title' },
        { line: 2, tag: 'p', text: 'Para' },
      ]);

      const sync = setupScrollSync(view, container);

      // Simulate preview scroll
      container.dispatchEvent(new Event('scroll'));
      vi.advanceTimersByTime(60);

      const entries = PerfLogger.getAll();
      const syncEntry = entries.find((e) => e.label === 'scroll:sync');
      expect(syncEntry).toBeTruthy();
      expect(syncEntry!.metadata).toMatchObject({ direction: 'preview-to-source' });

      sync.destroy();
      vi.useRealTimers();
    });
  });

  describe('PerfLogger budgets', () => {
    it('scroll:sync source-to-preview completes within budget', () => {
      const view = createMockView({});
      const container = createPreviewContainer([
        { line: 0, tag: 'h1', text: 'Title' },
        { line: 2, tag: 'p', text: 'Para' },
        { line: 4, tag: 'h2', text: 'Sub' },
      ]);

      PerfLogger.start('scroll:sync');
      const sourceLine = getVisibleSourceLine(view);
      scrollPreviewToLine(container, sourceLine);
      const entry = PerfLogger.end('scroll:sync');

      // scroll:sync should be very fast (< 16ms for one frame budget)
      expect(entry.durationMs).toBeLessThan(16);
    });

    it('scroll:sync preview-to-source completes within budget', () => {
      const view = createMockView({});
      const container = createPreviewContainer([
        { line: 0, tag: 'h1', text: 'Title' },
        { line: 2, tag: 'p', text: 'Para' },
      ]);

      PerfLogger.start('scroll:sync');
      const previewLine = getVisiblePreviewLine(container);
      if (previewLine != null) {
        scrollSourceToLine(view, previewLine);
      }
      const entry = PerfLogger.end('scroll:sync');

      expect(entry.durationMs).toBeLessThan(16);
    });
  });
});
