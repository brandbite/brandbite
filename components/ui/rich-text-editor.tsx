// -----------------------------------------------------------------------------
// @file: components/ui/rich-text-editor.tsx
// @purpose: Tiptap-based rich text editor with basic formatting toolbar
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-12-28
// -----------------------------------------------------------------------------

"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useCallback } from "react";

/* -------------------------------------------------------------------------- */
/*  Props                                                                      */
/* -------------------------------------------------------------------------- */

type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  minHeight?: string;
};

/* -------------------------------------------------------------------------- */
/*  Toolbar button                                                             */
/* -------------------------------------------------------------------------- */

function ToolbarButton({
  onClick,
  active = false,
  disabled = false,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-[var(--bb-bg-card)] text-[var(--bb-secondary)]"
          : "text-[var(--bb-text-muted)] hover:text-[var(--bb-secondary)] hover:bg-[var(--bb-bg-warm)]"
      } disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  Toolbar                                                                    */
/* -------------------------------------------------------------------------- */

function Toolbar({
  editor,
  disabled,
}: {
  editor: ReturnType<typeof useEditor>;
  disabled: boolean;
}) {
  if (!editor) return null;

  const handleLink = () => {
    if (disabled) return;

    const previousUrl = editor.getAttributes("link").href ?? "";
    const url = window.prompt("Link URL:", previousUrl);

    // User cancelled
    if (url === null) return;

    // Empty string → remove link
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    // Add https:// if no protocol
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;

    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href })
      .run();
  };

  return (
    <div className="flex items-center gap-0.5 border-b border-[var(--bb-border-subtle)] px-2 py-1.5">
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive("bold")}
        disabled={disabled}
        title="Bold"
      >
        <strong>B</strong>
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive("italic")}
        disabled={disabled}
        title="Italic"
      >
        <em>I</em>
      </ToolbarButton>

      <div className="mx-1 h-4 w-px bg-[var(--bb-border-subtle)]" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive("bulletList")}
        disabled={disabled}
        title="Bullet list"
      >
        • List
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive("orderedList")}
        disabled={disabled}
        title="Numbered list"
      >
        1. List
      </ToolbarButton>

      <div className="mx-1 h-4 w-px bg-[var(--bb-border-subtle)]" />

      <ToolbarButton
        onClick={handleLink}
        active={editor.isActive("link")}
        disabled={disabled}
        title="Add link"
      >
        Link
      </ToolbarButton>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Editor                                                                     */
/* -------------------------------------------------------------------------- */

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  disabled = false,
  className = "",
  minHeight = "100px",
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        code: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-[var(--bb-primary)] underline",
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
      Placeholder.configure({
        placeholder: placeholder ?? "",
      }),
    ],
    content: value,
    editable: !disabled,
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
    // Prevent SSR mismatch — render on client only
    immediatelyRender: false,
  });

  // Sync editable state when disabled prop changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled);
    }
  }, [editor, disabled]);

  // Sync value prop when it changes externally (e.g., edit mode populating form)
  const syncContent = useCallback(() => {
    if (!editor) return;
    // Only update if the external value differs from what the editor has
    // This prevents cursor jumps during typing
    const currentHtml = editor.getHTML();
    if (value !== currentHtml) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  useEffect(() => {
    syncContent();
  }, [syncContent]);

  // SSR placeholder — editor is null on first render
  if (!editor) {
    return (
      <div
        className={`bb-rich-text rounded-md border border-[var(--bb-border-input)] bg-[var(--bb-bg-page)] ${className}`}
      >
        <div className="border-b border-[var(--bb-border-subtle)] px-2 py-1.5">
          <div className="h-6" />
        </div>
        <div
          className="px-3 py-2 text-sm text-[var(--bb-text-muted)]"
          style={{ minHeight }}
        >
          {placeholder}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bb-rich-text rounded-md border border-[var(--bb-border-input)] bg-[var(--bb-bg-page)] transition-colors focus-within:border-[var(--bb-primary)] focus-within:ring-1 focus-within:ring-[var(--bb-primary)] ${
        disabled ? "opacity-50 cursor-not-allowed" : ""
      } ${className}`}
    >
      <Toolbar editor={editor} disabled={disabled} />
      <div className="px-3 py-2 text-sm text-[var(--bb-secondary)]" style={{ minHeight }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
