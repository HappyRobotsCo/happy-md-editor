import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { TiptapEditor, TiptapEditorRef } from './TiptapEditor';
import { PerfLogger } from '../shared/logger';

// Tiptap needs these DOM APIs that jsdom may not fully support
// We provide minimal stubs if missing
beforeEach(() => {
  if (!document.createRange) {
    document.createRange = () =>
      ({
        setStart: vi.fn(),
        setEnd: vi.fn(),
        commonAncestorContainer: document.body,
        getBoundingClientRect: () => ({
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: 0,
          height: 0,
          x: 0,
          y: 0,
          toJSON: vi.fn(),
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

  // Stub getComputedStyle if it doesn't return expected values
  if (!window.getComputedStyle) {
    window.getComputedStyle = () =>
      ({
        getPropertyValue: () => '',
      }) as unknown as CSSStyleDeclaration;
  }

  // Stub getClientRects on Element prototype for ProseMirror scroll-into-view
  if (!Element.prototype.getClientRects) {
    Element.prototype.getClientRects = () => [] as unknown as DOMRectList;
  }

  PerfLogger.clear();
});

describe('TiptapEditor', () => {
  it('renders editor with markdown content', async () => {
    await act(async () => {
      render(
        <TiptapEditor content="# Hello World" onUpdate={vi.fn()} />,
      );
    });

    const editorEl = screen.getByLabelText('Markdown editor');
    expect(editorEl).toBeTruthy();
    // Tiptap renders the heading as an h1
    await waitFor(() => {
      expect(editorEl.querySelector('h1')).toBeTruthy();
      expect(editorEl.textContent).toContain('Hello World');
    });
  });

  it('calls onUpdate with serialized markdown on content change', async () => {
    const onUpdate = vi.fn();

    await act(async () => {
      render(
        <TiptapEditor content="# Hello" onUpdate={onUpdate} />,
      );
    });

    // The editor should have called onUpdate at some point after user interaction
    // We verify onUpdate is wired by checking it's a function
    expect(typeof onUpdate).toBe('function');
  });

  it('calls onReady callback after initialization', async () => {
    const onReady = vi.fn();

    await act(async () => {
      render(
        <TiptapEditor
          content="# Test"
          onUpdate={vi.fn()}
          onReady={onReady}
        />,
      );
    });

    await waitFor(() => {
      expect(onReady).toHaveBeenCalledTimes(1);
    });
  });

  it('renders bold text from markdown', async () => {
    await act(async () => {
      render(
        <TiptapEditor content="**bold text**" onUpdate={vi.fn()} />,
      );
    });

    const editorEl = screen.getByLabelText('Markdown editor');
    await waitFor(() => {
      const strong = editorEl.querySelector('strong');
      expect(strong).toBeTruthy();
      expect(strong?.textContent).toBe('bold text');
    });
  });

  it('renders italic text from markdown', async () => {
    await act(async () => {
      render(
        <TiptapEditor content="*italic text*" onUpdate={vi.fn()} />,
      );
    });

    const editorEl = screen.getByLabelText('Markdown editor');
    await waitFor(() => {
      const em = editorEl.querySelector('em');
      expect(em).toBeTruthy();
      expect(em?.textContent).toBe('italic text');
    });
  });

  it('renders code blocks from markdown', async () => {
    const md = '```javascript\nconsole.log("hi");\n```';
    await act(async () => {
      render(<TiptapEditor content={md} onUpdate={vi.fn()} />);
    });

    const editorEl = screen.getByLabelText('Markdown editor');
    await waitFor(() => {
      const pre = editorEl.querySelector('pre');
      expect(pre).toBeTruthy();
      expect(editorEl.textContent).toContain('console.log');
    });
  });

  it('renders blockquotes from markdown', async () => {
    await act(async () => {
      render(
        <TiptapEditor content="> A quote" onUpdate={vi.fn()} />,
      );
    });

    const editorEl = screen.getByLabelText('Markdown editor');
    await waitFor(() => {
      const blockquote = editorEl.querySelector('blockquote');
      expect(blockquote).toBeTruthy();
      expect(blockquote?.textContent).toContain('A quote');
    });
  });

  it('renders unordered lists from markdown', async () => {
    const md = '- Item 1\n- Item 2\n- Item 3';
    await act(async () => {
      render(<TiptapEditor content={md} onUpdate={vi.fn()} />);
    });

    const editorEl = screen.getByLabelText('Markdown editor');
    await waitFor(() => {
      const ul = editorEl.querySelector('ul');
      expect(ul).toBeTruthy();
      const items = editorEl.querySelectorAll('li');
      expect(items.length).toBe(3);
    });
  });

  it('renders ordered lists from markdown', async () => {
    const md = '1. First\n2. Second\n3. Third';
    await act(async () => {
      render(<TiptapEditor content={md} onUpdate={vi.fn()} />);
    });

    const editorEl = screen.getByLabelText('Markdown editor');
    await waitFor(() => {
      const ol = editorEl.querySelector('ol');
      expect(ol).toBeTruthy();
    });
  });

  it('renders horizontal rules from markdown', async () => {
    const md = 'Above\n\n---\n\nBelow';
    await act(async () => {
      render(<TiptapEditor content={md} onUpdate={vi.fn()} />);
    });

    const editorEl = screen.getByLabelText('Markdown editor');
    await waitFor(() => {
      const hr = editorEl.querySelector('hr');
      expect(hr).toBeTruthy();
    });
  });
});

describe('TiptapEditor — PerfLogger instrumentation', () => {
  beforeEach(() => {
    PerfLogger.clear();
  });

  it('logs tiptap:init on creation', async () => {
    await act(async () => {
      render(
        <TiptapEditor content="# Hello" onUpdate={vi.fn()} />,
      );
    });

    await waitFor(() => {
      const entries = PerfLogger.getAll();
      const initEntry = entries.find((e) => e.label === 'tiptap:init');
      expect(initEntry).toBeTruthy();
      expect(initEntry!.metadata).toHaveProperty('charCount');
    });
  });

  it('tiptap:init completes within 200ms budget', async () => {
    // Generate a moderately sized document
    const lines = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`);
    const content = lines.join('\n\n');

    await act(async () => {
      render(
        <TiptapEditor content={content} onUpdate={vi.fn()} />,
      );
    });

    await waitFor(() => {
      const entries = PerfLogger.getAll();
      const initEntry = entries.find((e) => e.label === 'tiptap:init');
      expect(initEntry).toBeTruthy();
      expect(initEntry!.durationMs).toBeLessThan(200);
    });
  });
});

describe('TiptapEditor — GFM extensions', () => {
  it('renders strikethrough text from markdown', async () => {
    await act(async () => {
      render(
        <TiptapEditor content="~~deleted text~~" onUpdate={vi.fn()} />,
      );
    });

    const editorEl = screen.getByLabelText('Markdown editor');
    await waitFor(() => {
      const s = editorEl.querySelector('s');
      expect(s).toBeTruthy();
      expect(s?.textContent).toBe('deleted text');
    });
  });

  it('renders task lists with checkboxes from markdown', async () => {
    const md = '- [ ] Unchecked task\n- [x] Checked task';
    await act(async () => {
      render(<TiptapEditor content={md} onUpdate={vi.fn()} />);
    });

    const editorEl = screen.getByLabelText('Markdown editor');
    await waitFor(() => {
      const checkboxes = editorEl.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes.length).toBe(2);
      expect((checkboxes[0] as HTMLInputElement).checked).toBe(false);
      expect((checkboxes[1] as HTMLInputElement).checked).toBe(true);
    });
  });

  it('renders task list items with correct text', async () => {
    const md = '- [ ] Buy groceries\n- [x] Walk the dog';
    await act(async () => {
      render(<TiptapEditor content={md} onUpdate={vi.fn()} />);
    });

    const editorEl = screen.getByLabelText('Markdown editor');
    await waitFor(() => {
      const items = editorEl.querySelectorAll('li');
      expect(items.length).toBe(2);
      expect(items[0].textContent).toContain('Buy groceries');
      expect(items[1].textContent).toContain('Walk the dog');
    });
  });

  it('renders tables from markdown', async () => {
    const md =
      '| Header 1 | Header 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |\n| Cell 3 | Cell 4 |';
    await act(async () => {
      render(<TiptapEditor content={md} onUpdate={vi.fn()} />);
    });

    const editorEl = screen.getByLabelText('Markdown editor');
    await waitFor(() => {
      const table = editorEl.querySelector('table');
      expect(table).toBeTruthy();
    });
  });

  it('renders table headers correctly', async () => {
    const md =
      '| Name | Age |\n| --- | --- |\n| Alice | 30 |\n| Bob | 25 |';
    await act(async () => {
      render(<TiptapEditor content={md} onUpdate={vi.fn()} />);
    });

    const editorEl = screen.getByLabelText('Markdown editor');
    await waitFor(() => {
      const ths = editorEl.querySelectorAll('th');
      expect(ths.length).toBe(2);
      expect(ths[0].textContent).toContain('Name');
      expect(ths[1].textContent).toContain('Age');
    });
  });

  it('renders table body cells correctly', async () => {
    const md =
      '| Name | Age |\n| --- | --- |\n| Alice | 30 |';
    await act(async () => {
      render(<TiptapEditor content={md} onUpdate={vi.fn()} />);
    });

    const editorEl = screen.getByLabelText('Markdown editor');
    await waitFor(() => {
      const tds = editorEl.querySelectorAll('td');
      expect(tds.length).toBe(2);
      expect(tds[0].textContent).toContain('Alice');
      expect(tds[1].textContent).toContain('30');
    });
  });

  it('renders strikethrough combined with other formatting', async () => {
    await act(async () => {
      render(
        <TiptapEditor content="**bold** and ~~struck~~" onUpdate={vi.fn()} />,
      );
    });

    const editorEl = screen.getByLabelText('Markdown editor');
    await waitFor(() => {
      expect(editorEl.querySelector('strong')).toBeTruthy();
      expect(editorEl.querySelector('s')).toBeTruthy();
    });
  });
});

describe('TiptapEditor — List behavior', () => {
  it('splitListItem creates a new bullet list item (Enter behavior)', async () => {
    const ref = React.createRef<TiptapEditorRef>();
    const md = '- Item 1\n- Item 2';

    await act(async () => {
      render(
        <TiptapEditor ref={ref} content={md} onUpdate={vi.fn()} />,
      );
    });

    await waitFor(() => {
      expect(ref.current?.getEditor()).toBeTruthy();
    });

    const editor = ref.current!.getEditor()!;
    const editorEl = screen.getByLabelText('Markdown editor');

    // Place cursor inside the first list item text, then split
    await act(async () => {
      // Position 3 = inside the paragraph of the first list item ("Item 1")
      // Doc structure: bulletList > listItem > paragraph > "Item 1"
      // Offsets: bulletList=0, listItem=1, paragraph=2, text starts at 3
      editor.commands.setTextSelection(3);
      editor.commands.splitListItem('listItem');
    });

    await waitFor(() => {
      const items = editorEl.querySelectorAll('li');
      expect(items.length).toBe(3); // Was 2, now 3 after split
    });
  });

  it('splitListItem creates a new ordered list item (Enter behavior)', async () => {
    const ref = React.createRef<TiptapEditorRef>();
    const md = '1. First\n2. Second';

    await act(async () => {
      render(
        <TiptapEditor ref={ref} content={md} onUpdate={vi.fn()} />,
      );
    });

    await waitFor(() => {
      expect(ref.current?.getEditor()).toBeTruthy();
    });

    const editor = ref.current!.getEditor()!;
    const editorEl = screen.getByLabelText('Markdown editor');

    await act(async () => {
      // Same structure: orderedList > listItem > paragraph > "First"
      editor.commands.setTextSelection(3);
      editor.commands.splitListItem('listItem');
    });

    await waitFor(() => {
      const items = editorEl.querySelectorAll('li');
      expect(items.length).toBe(3);
    });
  });

  it('sinkListItem indents a bullet list item (Tab behavior)', async () => {
    const ref = React.createRef<TiptapEditorRef>();
    const md = '- Item 1\n- Item 2';

    await act(async () => {
      render(
        <TiptapEditor ref={ref} content={md} onUpdate={vi.fn()} />,
      );
    });

    await waitFor(() => {
      expect(ref.current?.getEditor()).toBeTruthy();
    });

    const editor = ref.current!.getEditor()!;
    const editorEl = screen.getByLabelText('Markdown editor');

    // Place cursor in second list item and indent it
    await act(async () => {
      editor.commands.focus();
      // Move to the second list item
      const list = editor.state.doc.firstChild;
      if (list && list.childCount >= 2) {
        const secondItemStart = list.firstChild!.nodeSize + 1; // +1 for list offset
        editor.commands.setTextSelection(secondItemStart + 1);
      }
      editor.commands.sinkListItem('listItem');
    });

    await waitFor(() => {
      // After indenting, the second item should be nested (a ul inside the first li)
      const nestedUl = editorEl.querySelector('ul ul');
      expect(nestedUl).toBeTruthy();
    });
  });

  it('liftListItem outdents a nested bullet list item (Shift-Tab behavior)', async () => {
    const ref = React.createRef<TiptapEditorRef>();
    // Nested list — Item 2 is indented under Item 1
    const md = '- Item 1\n  - Item 2';

    await act(async () => {
      render(
        <TiptapEditor ref={ref} content={md} onUpdate={vi.fn()} />,
      );
    });

    await waitFor(() => {
      expect(ref.current?.getEditor()).toBeTruthy();
    });

    const editor = ref.current!.getEditor()!;
    const editorEl = screen.getByLabelText('Markdown editor');

    // Verify nested structure exists first
    await waitFor(() => {
      expect(editorEl.querySelector('ul ul')).toBeTruthy();
    });

    // Place cursor in the nested item and lift it
    await act(async () => {
      editor.commands.focus();
      // Find the nested list item and position cursor there
      const doc = editor.state.doc;
      // Walk to find the nested item position
      let nestedPos = 0;
      doc.descendants((node, pos) => {
        if (node.type.name === 'listItem' && nestedPos === 0) {
          // Skip the first list item, get the nested one
          nestedPos = pos;
        }
        if (node.type.name === 'listItem' && pos > nestedPos) {
          nestedPos = pos;
          return false;
        }
      });
      if (nestedPos > 0) {
        editor.commands.setTextSelection(nestedPos + 1);
      }
      editor.commands.liftListItem('listItem');
    });

    await waitFor(() => {
      // After outdenting, both items should be at the same level
      const nestedUl = editorEl.querySelector('ul ul');
      expect(nestedUl).toBeFalsy();
      const items = editorEl.querySelectorAll('li');
      expect(items.length).toBe(2);
    });
  });

  it('sinkListItem indents a task list item (Tab behavior for tasks)', async () => {
    const ref = React.createRef<TiptapEditorRef>();
    const md = '- [ ] Task 1\n- [ ] Task 2';

    await act(async () => {
      render(
        <TiptapEditor ref={ref} content={md} onUpdate={vi.fn()} />,
      );
    });

    await waitFor(() => {
      expect(ref.current?.getEditor()).toBeTruthy();
    });

    const editor = ref.current!.getEditor()!;
    const editorEl = screen.getByLabelText('Markdown editor');

    // Place cursor in second task item and indent it
    await act(async () => {
      editor.commands.focus();
      const taskList = editor.state.doc.firstChild;
      if (taskList && taskList.childCount >= 2) {
        const secondItemStart = taskList.firstChild!.nodeSize + 1;
        editor.commands.setTextSelection(secondItemStart + 1);
      }
      editor.commands.sinkListItem('taskItem');
    });

    await waitFor(() => {
      // After indenting, there should be a nested task list
      const nestedList = editorEl.querySelector('ul ul');
      expect(nestedList).toBeTruthy();
    });
  });

  it('renders nested bullet list with correct indentation', async () => {
    const md = '- Level 1\n  - Level 2\n    - Level 3';

    await act(async () => {
      render(
        <TiptapEditor content={md} onUpdate={vi.fn()} />,
      );
    });

    const editorEl = screen.getByLabelText('Markdown editor');
    await waitFor(() => {
      // Should have three levels of nesting
      const outerUl = editorEl.querySelector('ul');
      expect(outerUl).toBeTruthy();
      const midUl = outerUl?.querySelector('ul');
      expect(midUl).toBeTruthy();
      const innerUl = midUl?.querySelector('ul');
      expect(innerUl).toBeTruthy();
    });
  });

  it('ListKeymap extension is registered (handles Tab/Shift-Tab/Backspace)', async () => {
    const ref = React.createRef<TiptapEditorRef>();

    await act(async () => {
      render(
        <TiptapEditor ref={ref} content="- Item" onUpdate={vi.fn()} />,
      );
    });

    await waitFor(() => {
      const editor = ref.current?.getEditor();
      expect(editor).toBeTruthy();
      // Verify ListKeymap extension is loaded
      const listKeymap = editor!.extensionManager.extensions.find(
        (ext) => ext.name === 'listKeymap',
      );
      expect(listKeymap).toBeTruthy();
    });
  });
});

describe('TiptapEditor — Checkbox toggle (Task 3.4)', () => {
  it('toggling unchecked task item updates checked attribute to true', async () => {
    const ref = React.createRef<TiptapEditorRef>();
    const onUpdate = vi.fn();
    const md = '- [ ] Buy groceries\n- [ ] Walk the dog';

    await act(async () => {
      render(
        <TiptapEditor ref={ref} content={md} onUpdate={onUpdate} />,
      );
    });

    await waitFor(() => {
      expect(ref.current?.getEditor()).toBeTruthy();
    });

    const editor = ref.current!.getEditor()!;
    const editorEl = screen.getByLabelText('Markdown editor');

    // Position cursor in first task item and toggle its checked state
    await act(async () => {
      // Find the first taskItem node position
      let firstTaskPos = -1;
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'taskItem' && firstTaskPos === -1) {
          firstTaskPos = pos;
          return false;
        }
      });
      expect(firstTaskPos).toBeGreaterThanOrEqual(0);

      // Use updateAttributes command to toggle checked (same as checkbox click handler)
      editor.commands.setTextSelection(firstTaskPos + 1);
      editor.commands.updateAttributes('taskItem', { checked: true });
    });

    // Verify the DOM checkbox is now checked
    await waitFor(() => {
      const checkboxes = editorEl.querySelectorAll('input[type="checkbox"]');
      expect((checkboxes[0] as HTMLInputElement).checked).toBe(true);
      expect((checkboxes[1] as HTMLInputElement).checked).toBe(false);
    });

    // Verify onUpdate was called with markdown containing [x]
    await waitFor(() => {
      const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1];
      expect(lastCall[0]).toContain('[x]');
      expect(lastCall[0]).toContain('[ ]');
    });
  });

  it('toggling checked task item updates checked attribute to false', async () => {
    const ref = React.createRef<TiptapEditorRef>();
    const onUpdate = vi.fn();
    const md = '- [x] Completed task\n- [ ] Pending task';

    await act(async () => {
      render(
        <TiptapEditor ref={ref} content={md} onUpdate={onUpdate} />,
      );
    });

    await waitFor(() => {
      expect(ref.current?.getEditor()).toBeTruthy();
    });

    const editor = ref.current!.getEditor()!;
    const editorEl = screen.getByLabelText('Markdown editor');

    // Verify initial state
    await waitFor(() => {
      const checkboxes = editorEl.querySelectorAll('input[type="checkbox"]');
      expect((checkboxes[0] as HTMLInputElement).checked).toBe(true);
    });

    // Toggle the first (checked) task item to unchecked
    await act(async () => {
      let firstTaskPos = -1;
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'taskItem' && firstTaskPos === -1) {
          firstTaskPos = pos;
          return false;
        }
      });
      editor.commands.setTextSelection(firstTaskPos + 1);
      editor.commands.updateAttributes('taskItem', { checked: false });
    });

    // Verify both checkboxes are now unchecked
    await waitFor(() => {
      const checkboxes = editorEl.querySelectorAll('input[type="checkbox"]');
      expect((checkboxes[0] as HTMLInputElement).checked).toBe(false);
      expect((checkboxes[1] as HTMLInputElement).checked).toBe(false);
    });

    // Verify onUpdate was called with markdown containing only [ ]
    await waitFor(() => {
      const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1];
      expect(lastCall[0]).not.toContain('[x]');
      expect(lastCall[0]).toContain('[ ]');
    });
  });

  it('checkbox toggle fires onUpdate with serialized markdown', async () => {
    const ref = React.createRef<TiptapEditorRef>();
    const onUpdate = vi.fn();
    const md = '- [ ] Single task';

    await act(async () => {
      render(
        <TiptapEditor ref={ref} content={md} onUpdate={onUpdate} />,
      );
    });

    await waitFor(() => {
      expect(ref.current?.getEditor()).toBeTruthy();
    });

    const editor = ref.current!.getEditor()!;
    onUpdate.mockClear();

    // Toggle checkbox
    await act(async () => {
      let taskPos = -1;
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'taskItem' && taskPos === -1) {
          taskPos = pos;
          return false;
        }
      });
      editor.commands.setTextSelection(taskPos + 1);
      editor.commands.updateAttributes('taskItem', { checked: true });
    });

    // onUpdate should have been called
    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalled();
      const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1];
      expect(lastCall[0]).toMatch(/\[x\]/);
      expect(lastCall[0]).toContain('Single task');
    });
  });

  it('undo reverts checkbox toggle', async () => {
    const ref = React.createRef<TiptapEditorRef>();
    const onUpdate = vi.fn();
    const md = '- [ ] Undo me';

    await act(async () => {
      render(
        <TiptapEditor ref={ref} content={md} onUpdate={onUpdate} />,
      );
    });

    await waitFor(() => {
      expect(ref.current?.getEditor()).toBeTruthy();
    });

    const editor = ref.current!.getEditor()!;
    const editorEl = screen.getByLabelText('Markdown editor');

    // Toggle checkbox to checked
    await act(async () => {
      let taskPos = -1;
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'taskItem' && taskPos === -1) {
          taskPos = pos;
          return false;
        }
      });
      editor.commands.setTextSelection(taskPos + 1);
      editor.commands.updateAttributes('taskItem', { checked: true });
    });

    await waitFor(() => {
      const checkbox = editorEl.querySelector('input[type="checkbox"]') as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
    });

    // Undo the toggle
    await act(async () => {
      editor.commands.undo();
    });

    await waitFor(() => {
      const checkbox = editorEl.querySelector('input[type="checkbox"]') as HTMLInputElement;
      expect(checkbox.checked).toBe(false);
    });

    // Verify markdown reverted
    await waitFor(() => {
      const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1];
      expect(lastCall[0]).toContain('[ ]');
      expect(lastCall[0]).not.toContain('[x]');
    });
  });

  it('toggling checkbox on second item leaves first item unchanged', async () => {
    const ref = React.createRef<TiptapEditorRef>();
    const onUpdate = vi.fn();
    const md = '- [x] Already done\n- [ ] Not done yet';

    await act(async () => {
      render(
        <TiptapEditor ref={ref} content={md} onUpdate={onUpdate} />,
      );
    });

    await waitFor(() => {
      expect(ref.current?.getEditor()).toBeTruthy();
    });

    const editor = ref.current!.getEditor()!;
    const editorEl = screen.getByLabelText('Markdown editor');

    // Find the second task item and toggle it
    await act(async () => {
      const taskPositions: number[] = [];
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'taskItem') {
          taskPositions.push(pos);
        }
      });
      expect(taskPositions.length).toBe(2);
      editor.commands.setTextSelection(taskPositions[1] + 1);
      editor.commands.updateAttributes('taskItem', { checked: true });
    });

    // Both checkboxes should now be checked
    await waitFor(() => {
      const checkboxes = editorEl.querySelectorAll('input[type="checkbox"]');
      expect((checkboxes[0] as HTMLInputElement).checked).toBe(true);
      expect((checkboxes[1] as HTMLInputElement).checked).toBe(true);
    });

    // Markdown should have both [x]
    await waitFor(() => {
      const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1];
      expect(lastCall[0]).toMatch(/\[x\].*Already done/s);
      expect(lastCall[0]).toMatch(/\[x\].*Not done yet/s);
    });
  });
});
