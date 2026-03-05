import React, { useCallback, useState, useEffect } from 'react';
import { BubbleMenu } from '@tiptap/react/menus';
import type { Editor } from '@tiptap/core';
import { PerfLogger } from '../shared/logger';
import { LinkPopover } from './LinkPopover';
import { LINK_EDIT_EVENT } from './TiptapEditor';

export interface FloatingToolbarProps {
  editor: Editor | null;
}

export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({ editor }) => {
  const [showLinkPopover, setShowLinkPopover] = useState(false);

  const runAction = useCallback(
    (name: string, fn: () => void) => {
      PerfLogger.start('toolbar:action');
      fn();
      PerfLogger.end('toolbar:action', { action: name, source: 'floating' });
    },
    [],
  );

  const handleLinkClick = useCallback(() => {
    setShowLinkPopover((prev) => !prev);
  }, []);

  const handleLinkClose = useCallback(() => {
    setShowLinkPopover(false);
  }, []);

  // Listen for Cmd/Ctrl+K shortcut event from TiptapEditor
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    const handler = () => setShowLinkPopover(true);
    dom.addEventListener(LINK_EDIT_EVENT, handler);
    return () => dom.removeEventListener(LINK_EDIT_EVENT, handler);
  }, [editor]);

  if (!editor) return null;

  // Compute active states with PerfLogger instrumentation
  PerfLogger.start('toolbar:state-sync');
  const isBold = editor.isActive('bold');
  const isItalic = editor.isActive('italic');
  const isStrike = editor.isActive('strike');
  const isCode = editor.isActive('code');
  const isLink = editor.isActive('link');
  PerfLogger.end('toolbar:state-sync');

  return (
    <BubbleMenu
      editor={editor}
      options={{
        onShow: () => {
          PerfLogger.start('toolbar:floating:show');
          PerfLogger.end('toolbar:floating:show');
        },
        onHide: () => {
          PerfLogger.start('toolbar:floating:hide');
          PerfLogger.end('toolbar:floating:hide');
          setShowLinkPopover(false);
        },
      }}
    >
      <div
        className="floating-toolbar"
        role="toolbar"
        aria-label="Inline formatting toolbar"
      >
        <button
          className={`toolbar-btn${isBold ? ' active' : ''}`}
          onClick={() =>
            runAction('bold', () => editor.chain().focus().toggleBold().run())
          }
          aria-label="Bold"
          aria-pressed={isBold}
        >
          B
        </button>
        <button
          className={`toolbar-btn${isItalic ? ' active' : ''}`}
          onClick={() =>
            runAction('italic', () => editor.chain().focus().toggleItalic().run())
          }
          aria-label="Italic"
          aria-pressed={isItalic}
        >
          I
        </button>
        <button
          className={`toolbar-btn${isStrike ? ' active' : ''}`}
          onClick={() =>
            runAction('strikethrough', () => editor.chain().focus().toggleStrike().run())
          }
          aria-label="Strikethrough"
          aria-pressed={isStrike}
        >
          S
        </button>
        <button
          className={`toolbar-btn${isCode ? ' active' : ''}`}
          onClick={() =>
            runAction('inline-code', () => editor.chain().focus().toggleCode().run())
          }
          aria-label="Inline code"
          aria-pressed={isCode}
        >
          {'<>'}
        </button>
        <span className="toolbar-separator" />
        <button
          className={`toolbar-btn${isLink ? ' active' : ''}`}
          onClick={handleLinkClick}
          aria-label="Link"
          aria-pressed={isLink}
        >
          🔗
        </button>
      </div>
      {showLinkPopover && (
        <LinkPopover editor={editor} onClose={handleLinkClose} />
      )}
    </BubbleMenu>
  );
};
