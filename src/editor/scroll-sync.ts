/**
 * Bidirectional scroll synchronization between CodeMirror source editor
 * and the markdown preview pane.
 *
 * Maps CodeMirror line numbers to preview elements with data-source-line
 * attributes (injected by PreviewPane's markdown-it plugin).
 *
 * Standalone utility — no React dependencies.
 */

import type { EditorView } from '@codemirror/view';
import { PerfLogger } from '../shared/logger';
import { SCROLL_SYNC_DEBOUNCE_MS } from '../shared/constants';

/** Get the top visible source line number from a CodeMirror EditorView */
export function getVisibleSourceLine(view: EditorView): number {
  const scrollDOM = view.scrollDOM;
  const top = scrollDOM.scrollTop;
  // lineBlockAtHeight gives the line block at a given document-relative height
  const block = view.lineBlockAtHeight(top);
  const line = view.state.doc.lineAt(block.from);
  return line.number;
}

/**
 * Find the preview element closest to a given source line number.
 * Returns the element and its data-source-line value.
 */
export function findPreviewElementForLine(
  previewContainer: Element,
  sourceLine: number,
): { element: Element; line: number } | null {
  const elements = previewContainer.querySelectorAll('[data-source-line]');
  if (elements.length === 0) return null;

  let closest: Element | null = null;
  let closestLine = -1;
  let closestDelta = Infinity;

  for (const el of elements) {
    const lineStr = el.getAttribute('data-source-line');
    if (!lineStr) continue;
    // data-source-line is 0-based (markdown-it token.map[0])
    const line = parseInt(lineStr, 10);
    if (isNaN(line)) continue;

    const delta = Math.abs(line - sourceLine);
    if (delta < closestDelta) {
      closestDelta = delta;
      closest = el;
      closestLine = line;
    }
    // Elements are in document order, so once we pass the target we can stop
    if (line > sourceLine) break;
  }

  return closest ? { element: closest, line: closestLine } : null;
}

/**
 * Get the first visible data-source-line element in the preview container.
 * Returns the source line number (0-based from markdown-it).
 */
export function getVisiblePreviewLine(previewContainer: Element): number | null {
  const containerRect = previewContainer.getBoundingClientRect();
  const elements = previewContainer.querySelectorAll('[data-source-line]');

  for (const el of elements) {
    const rect = el.getBoundingClientRect();
    // Element is visible if its top is within or just below the container top
    if (rect.top >= containerRect.top - 10 && rect.top <= containerRect.bottom) {
      const lineStr = el.getAttribute('data-source-line');
      if (lineStr) {
        const line = parseInt(lineStr, 10);
        if (!isNaN(line)) return line;
      }
    }
  }
  return null;
}

/** Scroll the preview so that the element for the given source line is visible. */
export function scrollPreviewToLine(
  previewContainer: Element,
  sourceLine: number,
): void {
  const match = findPreviewElementForLine(previewContainer, sourceLine);
  if (!match) return;

  const containerRect = previewContainer.getBoundingClientRect();
  const elementRect = match.element.getBoundingClientRect();
  const offset = elementRect.top - containerRect.top;
  previewContainer.scrollTop += offset;
}

/**
 * Scroll CodeMirror so that the given source line (0-based from markdown-it)
 * is visible near the top of the viewport.
 */
export function scrollSourceToLine(view: EditorView, sourceLine: number): void {
  // markdown-it lines are 0-based, CodeMirror lines are 1-based
  const cmLine = sourceLine + 1;
  const lineCount = view.state.doc.lines;
  if (cmLine < 1 || cmLine > lineCount) return;

  const line = view.state.doc.line(cmLine);
  const block = view.lineBlockAt(line.from);

  // Scroll so this line is near the top
  view.scrollDOM.scrollTop = block.top;
}

export interface ScrollSyncCleanup {
  destroy: () => void;
}

/**
 * Set up bidirectional scroll synchronization between a CodeMirror
 * EditorView and a preview pane DOM element.
 *
 * Returns a cleanup object. Call destroy() to remove listeners.
 */
export function setupScrollSync(
  view: EditorView,
  previewContainer: Element,
): ScrollSyncCleanup {
  let syncing = false;
  let sourceTimer: ReturnType<typeof setTimeout> | null = null;
  let previewTimer: ReturnType<typeof setTimeout> | null = null;

  const onSourceScroll = () => {
    if (syncing) return;
    if (sourceTimer) clearTimeout(sourceTimer);

    sourceTimer = setTimeout(() => {
      syncing = true;
      PerfLogger.start('scroll:sync');

      try {
        const sourceLine = getVisibleSourceLine(view);
        scrollPreviewToLine(previewContainer, sourceLine);

        PerfLogger.end('scroll:sync', {
          direction: 'source-to-preview',
          sourceLine,
        });
      } catch {
        PerfLogger.end('scroll:sync', { direction: 'source-to-preview', error: true });
      }

      // Release the syncing lock after a frame to avoid feedback loops
      requestAnimationFrame(() => {
        syncing = false;
      });
    }, SCROLL_SYNC_DEBOUNCE_MS);
  };

  const onPreviewScroll = () => {
    if (syncing) return;
    if (previewTimer) clearTimeout(previewTimer);

    previewTimer = setTimeout(() => {
      syncing = true;
      PerfLogger.start('scroll:sync');

      try {
        const previewLine = getVisiblePreviewLine(previewContainer);
        if (previewLine != null) {
          scrollSourceToLine(view, previewLine);
        }

        PerfLogger.end('scroll:sync', {
          direction: 'preview-to-source',
          previewLine,
        });
      } catch {
        PerfLogger.end('scroll:sync', { direction: 'preview-to-source', error: true });
      }

      requestAnimationFrame(() => {
        syncing = false;
      });
    }, SCROLL_SYNC_DEBOUNCE_MS);
  };

  // CodeMirror's scroll container is view.scrollDOM
  view.scrollDOM.addEventListener('scroll', onSourceScroll, { passive: true });
  previewContainer.addEventListener('scroll', onPreviewScroll, { passive: true });

  return {
    destroy() {
      if (sourceTimer) clearTimeout(sourceTimer);
      if (previewTimer) clearTimeout(previewTimer);
      view.scrollDOM.removeEventListener('scroll', onSourceScroll);
      previewContainer.removeEventListener('scroll', onPreviewScroll);
    },
  };
}
