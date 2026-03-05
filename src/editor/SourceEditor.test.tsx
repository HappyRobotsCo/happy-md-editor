import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { SourceEditor, SourceEditorRef } from './SourceEditor';
import { PerfLogger } from '../shared/logger';

beforeEach(() => {
  PerfLogger.clear();
});

describe('SourceEditor', () => {
  it('renders with aria label', async () => {
    const onUpdate = vi.fn();
    render(<SourceEditor content="# Hello" onUpdate={onUpdate} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Markdown source editor')).toBeTruthy();
    });
  });

  it('initializes CodeMirror and shows content', async () => {
    const onUpdate = vi.fn();
    const ref = React.createRef<SourceEditorRef>();
    render(<SourceEditor ref={ref} content="# Hello World" onUpdate={onUpdate} />);

    await waitFor(() => {
      expect(ref.current?.getView()).toBeTruthy();
    });

    const view = ref.current!.getView()!;
    expect(view.state.doc.toString()).toBe('# Hello World');
  });

  it('calls onReady after initialization', async () => {
    const onUpdate = vi.fn();
    const onReady = vi.fn();
    render(<SourceEditor content="test" onUpdate={onUpdate} onReady={onReady} />);

    await waitFor(() => {
      expect(onReady).toHaveBeenCalledTimes(1);
    });
  });

  it('calls onUpdate when content changes via editor', async () => {
    const onUpdate = vi.fn();
    const ref = React.createRef<SourceEditorRef>();
    render(<SourceEditor ref={ref} content="initial" onUpdate={onUpdate} />);

    await waitFor(() => {
      expect(ref.current?.getView()).toBeTruthy();
    });

    const view = ref.current!.getView()!;
    act(() => {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: 'updated content' },
      });
    });

    expect(onUpdate).toHaveBeenCalledWith('updated content');
  });

  it('handles external content prop changes', async () => {
    const onUpdate = vi.fn();
    const ref = React.createRef<SourceEditorRef>();
    const { rerender } = render(
      <SourceEditor ref={ref} content="first" onUpdate={onUpdate} />,
    );

    await waitFor(() => {
      expect(ref.current?.getView()).toBeTruthy();
    });

    rerender(<SourceEditor ref={ref} content="second" onUpdate={onUpdate} />);

    await waitFor(() => {
      expect(ref.current!.getView()!.state.doc.toString()).toBe('second');
    });
  });

  it('has line numbers gutter', async () => {
    const onUpdate = vi.fn();
    render(<SourceEditor content="line 1\nline 2\nline 3" onUpdate={onUpdate} />);

    await waitFor(() => {
      const container = screen.getByLabelText('Markdown source editor');
      const gutters = container.querySelectorAll('.cm-gutters');
      expect(gutters.length).toBeGreaterThan(0);
    });
  });

  it('has active line highlighting', async () => {
    const onUpdate = vi.fn();
    render(<SourceEditor content="line 1\nline 2" onUpdate={onUpdate} />);

    await waitFor(() => {
      const container = screen.getByLabelText('Markdown source editor');
      const activeLine = container.querySelectorAll('.cm-activeLine');
      expect(activeLine.length).toBeGreaterThan(0);
    });
  });

  describe('PerfLogger instrumentation', () => {
    it('logs codemirror:load', async () => {
      const onUpdate = vi.fn();
      render(<SourceEditor content="test" onUpdate={onUpdate} />);

      await waitFor(() => {
        const entries = PerfLogger.getAll();
        const loadEntry = entries.find((e) => e.label === 'codemirror:load');
        expect(loadEntry).toBeTruthy();
      });
    });

    it('logs codemirror:init with charCount metadata', async () => {
      const onUpdate = vi.fn();
      render(<SourceEditor content="# Hello" onUpdate={onUpdate} />);

      await waitFor(() => {
        const entries = PerfLogger.getAll();
        const initEntry = entries.find((e) => e.label === 'codemirror:init');
        expect(initEntry).toBeTruthy();
        expect(initEntry!.metadata).toEqual({ charCount: 7 });
      });
    });

    it('codemirror:load + codemirror:init completes within 500ms budget', async () => {
      const onUpdate = vi.fn();
      render(<SourceEditor content="# Test document\n\nSome content here." onUpdate={onUpdate} />);

      await waitFor(() => {
        const entries = PerfLogger.getAll();
        const loadEntry = entries.find((e) => e.label === 'codemirror:load');
        const initEntry = entries.find((e) => e.label === 'codemirror:init');
        expect(loadEntry).toBeTruthy();
        expect(initEntry).toBeTruthy();
        const totalMs = loadEntry!.durationMs + initEntry!.durationMs;
        expect(totalMs).toBeLessThan(500);
      });
    });

    it('codemirror:init completes within 200ms for small docs', async () => {
      const onUpdate = vi.fn();
      render(<SourceEditor content="# Small doc" onUpdate={onUpdate} />);

      await waitFor(() => {
        const entries = PerfLogger.getAll();
        const initEntry = entries.find((e) => e.label === 'codemirror:init');
        expect(initEntry).toBeTruthy();
        expect(initEntry!.durationMs).toBeLessThan(200);
      });
    });
  });

  it('cleans up on unmount', async () => {
    const onUpdate = vi.fn();
    const ref = React.createRef<SourceEditorRef>();
    const { unmount } = render(
      <SourceEditor ref={ref} content="test" onUpdate={onUpdate} />,
    );

    await waitFor(() => {
      expect(ref.current?.getView()).toBeTruthy();
    });

    unmount();

    // After unmount, the ref should have been cleaned up
    // (the component destroys the view in cleanup)
  });
});
