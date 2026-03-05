import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isCursorVisible, createScrollGuard } from './scroll-guard';
import type { EditorView } from '@tiptap/pm/view';

// ---- Mock helpers ----

function mockRect(overrides: Partial<DOMRect> = {}): DOMRect {
  return {
    top: 0,
    bottom: 600,
    left: 0,
    right: 800,
    width: 800,
    height: 600,
    x: 0,
    y: 0,
    toJSON: () => ({}),
    ...overrides,
  };
}

function mockScrollContainer(scrollTop = 0, rect?: Partial<DOMRect>): Element {
  const el = document.createElement('div');
  Object.defineProperty(el, 'scrollTop', {
    get: () => scrollTop,
    set: (v: number) => {
      scrollTop = v;
    },
    configurable: true,
  });
  Object.defineProperty(el, 'getBoundingClientRect', {
    value: () => mockRect(rect),
    configurable: true,
  });
  return el;
}

interface MockViewOptions {
  selectionFrom?: number;
  coordsTop?: number;
  coordsBottom?: number;
  throwOnCoordsAtPos?: boolean;
}

function mockView(opts: MockViewOptions = {}): EditorView {
  const { selectionFrom = 0, coordsTop = 100, coordsBottom = 120, throwOnCoordsAtPos = false } = opts;

  const container = mockScrollContainer();
  const dom = document.createElement('div');
  dom.closest = vi.fn().mockReturnValue(container);

  return {
    state: {
      selection: { from: selectionFrom },
    },
    coordsAtPos: throwOnCoordsAtPos
      ? vi.fn().mockImplementation(() => { throw new Error('not mounted'); })
      : vi.fn().mockReturnValue({ top: coordsTop, bottom: coordsBottom }),
    dom,
    dispatch: vi.fn(),
  } as unknown as EditorView;
}

// ---- Tests ----

describe('isCursorVisible', () => {
  it('returns true when cursor coords are within container bounds', () => {
    const view = mockView({ coordsTop: 100, coordsBottom: 120 });
    const container = mockScrollContainer(0, { top: 0, bottom: 600 });
    expect(isCursorVisible(view, container)).toBe(true);
  });

  it('returns false when cursor is above container', () => {
    const view = mockView({ coordsTop: -20, coordsBottom: -5 });
    const container = mockScrollContainer(0, { top: 0, bottom: 600 });
    expect(isCursorVisible(view, container)).toBe(false);
  });

  it('returns false when cursor is below container', () => {
    const view = mockView({ coordsTop: 610, coordsBottom: 630 });
    const container = mockScrollContainer(0, { top: 0, bottom: 600 });
    expect(isCursorVisible(view, container)).toBe(false);
  });

  it('returns true when cursor is exactly at container edges', () => {
    const view = mockView({ coordsTop: 0, coordsBottom: 600 });
    const container = mockScrollContainer(0, { top: 0, bottom: 600 });
    expect(isCursorVisible(view, container)).toBe(true);
  });

  it('returns false when coordsAtPos throws', () => {
    const view = mockView({ throwOnCoordsAtPos: true });
    const container = mockScrollContainer(0, { top: 0, bottom: 600 });
    expect(isCursorVisible(view, container)).toBe(false);
  });
});

describe('createScrollGuard', () => {
  let rafCallback: FrameRequestCallback | null = null;

  beforeEach(() => {
    rafCallback = null;
    vi.stubGlobal('requestAnimationFrame', vi.fn((cb: FrameRequestCallback) => {
      rafCallback = cb;
      return 1;
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('wraps view.dispatch', () => {
    const view = mockView();
    const origDispatch = view.dispatch;
    createScrollGuard(view, '.editor-area');
    expect(view.dispatch).not.toBe(origDispatch);
  });

  it('cleanup restores original dispatch', () => {
    const view = mockView();
    // createScrollGuard saves origDispatch via view.dispatch.bind(view),
    // so we can't compare by reference. Instead verify dispatch is no
    // longer the guard wrapper by checking it doesn't trigger rAF.
    const cleanup = createScrollGuard(view, '.editor-area');
    const wrappedDispatch = view.dispatch;
    cleanup();
    // After cleanup, dispatch should differ from the wrapped version
    expect(view.dispatch).not.toBe(wrappedDispatch);
    // And calling it should not trigger rAF (guard removed)
    const fakeTr = {} as unknown as Parameters<typeof view.dispatch>[0];
    view.dispatch(fakeTr);
    expect(rafCallback).toBeNull();
  });

  it('passes transaction through to original dispatch', () => {
    const origDispatch = vi.fn();
    const view = mockView();
    view.dispatch = origDispatch;

    createScrollGuard(view, '.editor-area');

    const fakeTr = { docChanged: true } as unknown as Parameters<typeof view.dispatch>[0];
    view.dispatch(fakeTr);

    expect(origDispatch).toHaveBeenCalledWith(fakeTr);
  });

  it('restores scroll position when cursor was visible and scroll jumped', () => {
    let scrollTop = 500;
    const container = document.createElement('div');
    Object.defineProperty(container, 'scrollTop', {
      get: () => scrollTop,
      set: (v: number) => { scrollTop = v; },
      configurable: true,
    });
    Object.defineProperty(container, 'getBoundingClientRect', {
      value: () => mockRect({ top: 0, bottom: 600 }),
      configurable: true,
    });

    const view = mockView({ coordsTop: 200, coordsBottom: 220 });
    view.dom.closest = vi.fn().mockReturnValue(container);

    const origDispatch = vi.fn().mockImplementation(() => {
      // Simulate browser scroll jump during dispatch
      scrollTop = 100;
    });
    view.dispatch = origDispatch;

    createScrollGuard(view, '.editor-area');
    const fakeTr = {} as unknown as Parameters<typeof view.dispatch>[0];
    view.dispatch(fakeTr);

    // Trigger rAF callback
    expect(rafCallback).not.toBeNull();
    rafCallback!(0);

    // scrollTop should be restored to 500
    expect(scrollTop).toBe(500);
  });

  it('does not restore scroll when cursor was NOT visible', () => {
    let scrollTop = 500;
    const container = document.createElement('div');
    Object.defineProperty(container, 'scrollTop', {
      get: () => scrollTop,
      set: (v: number) => { scrollTop = v; },
      configurable: true,
    });
    Object.defineProperty(container, 'getBoundingClientRect', {
      value: () => mockRect({ top: 0, bottom: 600 }),
      configurable: true,
    });

    // Cursor is below the container
    const view = mockView({ coordsTop: 700, coordsBottom: 720 });
    view.dom.closest = vi.fn().mockReturnValue(container);

    const origDispatch = vi.fn().mockImplementation(() => {
      scrollTop = 100;
    });
    view.dispatch = origDispatch;

    createScrollGuard(view, '.editor-area');
    const fakeTr = {} as unknown as Parameters<typeof view.dispatch>[0];
    view.dispatch(fakeTr);

    // rAF should not be called when cursor was not visible
    expect(rafCallback).toBeNull();
    // scrollTop stays at post-dispatch value
    expect(scrollTop).toBe(100);
  });

  it('does not restore scroll when delta is within threshold', () => {
    let scrollTop = 500;
    const container = document.createElement('div');
    Object.defineProperty(container, 'scrollTop', {
      get: () => scrollTop,
      set: (v: number) => { scrollTop = v; },
      configurable: true,
    });
    Object.defineProperty(container, 'getBoundingClientRect', {
      value: () => mockRect({ top: 0, bottom: 600 }),
      configurable: true,
    });

    const view = mockView({ coordsTop: 200, coordsBottom: 220 });
    view.dom.closest = vi.fn().mockReturnValue(container);

    const origDispatch = vi.fn().mockImplementation(() => {
      // Only 3px change — under threshold (5)
      scrollTop = 503;
    });
    view.dispatch = origDispatch;

    createScrollGuard(view, '.editor-area');
    const fakeTr = {} as unknown as Parameters<typeof view.dispatch>[0];
    view.dispatch(fakeTr);

    // Trigger rAF
    expect(rafCallback).not.toBeNull();
    rafCallback!(0);

    // scroll should NOT be restored — delta was within threshold
    expect(scrollTop).toBe(503);
  });

  it('falls through to original dispatch when no scroll container found', () => {
    const view = mockView();
    view.dom.closest = vi.fn().mockReturnValue(null);

    const origDispatch = vi.fn();
    view.dispatch = origDispatch;

    createScrollGuard(view, '.editor-area');
    const fakeTr = {} as unknown as Parameters<typeof view.dispatch>[0];
    view.dispatch(fakeTr);

    expect(origDispatch).toHaveBeenCalledWith(fakeTr);
  });

  it('returns noop when requestAnimationFrame is unavailable', () => {
    vi.stubGlobal('requestAnimationFrame', undefined);

    const view = mockView();
    const origDispatch = view.dispatch;
    const cleanup = createScrollGuard(view);

    // dispatch should not be wrapped
    expect(view.dispatch).toBe(origDispatch);
    // cleanup is a noop
    cleanup();
  });
});
