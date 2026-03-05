import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Editor } from '@tiptap/core';
import { PerfLogger } from '../shared/logger';

export interface LinkPopoverProps {
  editor: Editor;
  onClose: () => void;
}

export const LinkPopover: React.FC<LinkPopoverProps> = ({ editor, onClose }) => {
  const attrs = editor.getAttributes('link');
  const [url, setUrl] = useState(attrs.href ?? '');
  const urlInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    urlInputRef.current?.focus();
  }, []);

  const handleApply = useCallback(() => {
    PerfLogger.start('toolbar:action');
    const trimmed = url.trim();
    if (trimmed) {
      editor.chain().focus().setLink({ href: trimmed }).run();
    } else {
      editor.chain().focus().unsetLink().run();
    }
    PerfLogger.end('toolbar:action', { action: 'link', source: 'popover' });
    onClose();
  }, [editor, url, onClose]);

  const handleRemove = useCallback(() => {
    PerfLogger.start('toolbar:action');
    editor.chain().focus().unsetLink().run();
    PerfLogger.end('toolbar:action', { action: 'unlink', source: 'popover' });
    onClose();
  }, [editor, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleApply();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [handleApply, onClose],
  );

  const isEditing = !!attrs.href;

  return (
    <div
      className="link-popover"
      role="dialog"
      aria-label="Edit link"
      onKeyDown={handleKeyDown}
    >
      <input
        ref={urlInputRef}
        type="url"
        className="link-popover-input"
        placeholder="https://example.com"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        aria-label="URL"
      />
      <div className="link-popover-actions">
        <button
          className="toolbar-btn link-popover-btn"
          onClick={handleApply}
          aria-label="Apply link"
        >
          Apply
        </button>
        {isEditing && (
          <button
            className="toolbar-btn link-popover-btn"
            onClick={handleRemove}
            aria-label="Remove link"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
};
