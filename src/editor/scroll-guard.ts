/**
 * Scroll Guard for ProseMirror/Tiptap editors.
 *
 * Problem: When ProseMirror dispatches transactions that remove or replace DOM
 * nodes, the browser may independently scroll the container to keep the focused
 * element visible. This happens OUTSIDE ProseMirror's own scrollIntoView logic
 * (which we control via handleScrollToSelection), causing unwanted viewport jumps.
 *
 * Solution: Wrap view.dispatch to save the scroll container's scrollTop before
 * each transaction and restore it in a rAF callback if the cursor was already
 * visible on screen. This catches browser-native scroll adjustments while still
 * allowing intentional scrolls (e.g., cursor moves off-screen).
 *
 * Returns a cleanup function that restores the original dispatch.
 */

import type { EditorView } from '@tiptap/pm/view';

export interface ScrollGuardOptions {
  /** CSS selector for the scroll container. Default: '.editor-area' */
  scrollContainerSelector: string;
  /** Pixel threshold — ignore scroll changes smaller than this. Default: 5 */
  threshold: number;
}

const DEFAULTS: ScrollGuardOptions = {
  scrollContainerSelector: '.editor-area',
  threshold: 5,
};

/**
 * Determine if the cursor (selection head) is within the visible bounds
 * of the scroll container.
 */
export function isCursorVisible(
  view: EditorView,
  scrollContainer: Element,
): boolean {
  try {
    const coords = view.coordsAtPos(view.state.selection.from);
    const rect = scrollContainer.getBoundingClientRect();
    return coords.top >= rect.top && coords.bottom <= rect.bottom;
  } catch {
    // coordsAtPos can throw if the view isn't fully rendered
    return false;
  }
}

/**
 * Install a scroll guard on a ProseMirror EditorView.
 *
 * @param view - The ProseMirror EditorView
 * @param scrollContainerSelector - CSS selector for the scroll container
 * @param options - Optional overrides
 * @returns Cleanup function that restores original dispatch
 */
export function createScrollGuard(
  view: EditorView,
  scrollContainerSelector?: string,
  options?: Partial<ScrollGuardOptions>,
): () => void {
  const opts = { ...DEFAULTS, ...options };
  const selector = scrollContainerSelector ?? opts.scrollContainerSelector;
  const origDispatch = view.dispatch.bind(view);

  // Skip in test environments where layout APIs are unavailable
  if (typeof window !== 'undefined' && !window.requestAnimationFrame) {
    return () => {};
  }

  view.dispatch = (tr) => {
    const scrollParent = view.dom.closest(selector);
    if (!scrollParent) return origDispatch(tr);

    const savedScroll = scrollParent.scrollTop;
    const cursorWasVisible = isCursorVisible(view, scrollParent);

    origDispatch(tr);

    if (cursorWasVisible) {
      // Use rAF to catch the browser's post-mutation scroll adjustment
      requestAnimationFrame(() => {
        const delta = Math.abs(scrollParent.scrollTop - savedScroll);
        if (delta > opts.threshold) {
          scrollParent.scrollTop = savedScroll;
        }
      });
    }
  };

  return () => {
    view.dispatch = origDispatch;
  };
}
