// -----------------------------------------------------------------------------
// @file: components/newsletter/editor/rich-text.tsx
// @purpose: A picked text block on the newsletter canvas: its words are typed
//           and formatted in place (bold, italic, underline, links, bulleted
//           and numbered lists), in the font, size and color the email uses.
//           What is typed is stored as lib/newsletter/rich.ts describes, so
//           only that formatting can ever reach the email.
// -----------------------------------------------------------------------------

"use client";

import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import type { NewsletterData, TextBlock } from "@/lib/newsletter/newsletter";
import { PERSONAL_FIELDS, personalToken } from "@/lib/newsletter/personal";
import { inlineEditStyle } from "@/lib/newsletter/render";
import { builderImageSrc } from "@/lib/newsletter/templates";
import {
  plainToRich,
  richFromEditor,
  richLink,
  richToEditor,
  type RichNode,
} from "@/lib/newsletter/rich";

/**
 * How formatted text looks while it is typed: the email's own paragraph and
 * list spacing. Written with the studio's selector so it wins over the
 * studio's focus outline and the page's list reset.
 */
export const RICH_CSS = `
.color-studio .nl-rich .ProseMirror{outline:none;white-space:pre-wrap;}
.color-studio .nl-rich p{margin:0 0 12px 0;}
.color-studio .nl-rich p:last-child{margin:0;}
.color-studio .nl-rich ul,.color-studio .nl-rich ol{margin:0 0 12px 0;padding:0 0 0 24px;}
.color-studio .nl-rich ul{list-style:disc;}
.color-studio .nl-rich ol{list-style:decimal;}
.color-studio .nl-rich li{margin:0 0 4px 0;}
.color-studio .nl-rich li p{margin:0;}
.color-studio .nl-rich a{color:var(--nl-accent);text-decoration:underline;cursor:text;}
.color-studio [data-quoted] .nl-rich .ProseMirror>p:first-child:not(.is-editor-empty)::before{content:"\\201C";}
.color-studio [data-quoted] .nl-rich .ProseMirror>p:last-child:not(.is-editor-empty)::after{content:"\\201D";}
.color-studio .nl-rich p.is-editor-empty:first-child::before{content:attr(data-placeholder);color:#8a8780;float:left;height:0;pointer-events:none;}
`;

function BarButton({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      // Keeps the caret and the selection in the text while the button is pressed.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-[13px] leading-none focus-visible:ring-2 focus-visible:ring-[#242528] focus-visible:outline-none ${
        active ? "bg-[#242528] text-white" : "text-[#242528] hover:bg-[#f0eeea]"
      }`}
    >
      {children}
    </button>
  );
}

const listIcon = (numbered: boolean) => (
  <svg
    aria-hidden
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
  >
    <path d="M10 6h10M10 12h10M10 18h10" />
    {numbered ? (
      <path d="M4 5v3M3.5 11.5h1.5l-1.5 2H5M3.5 16.5H5v3H3.5" strokeWidth={1.4} />
    ) : (
      <path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" strokeWidth={3} />
    )}
  </svg>
);

/** A picked text block: the block's own spacing around the editor for its words. */
export function RichText({
  block,
  data,
  nestedWidth,
  onRich,
  onDone,
}: {
  block: TextBlock;
  data: NewsletterData;
  nestedWidth: number | null;
  /** The text as it is now; null when it was emptied. */
  onRich: (rich: RichNode[] | null) => void;
  onDone: () => void;
}) {
  const style = inlineEditStyle(data, block, nestedWidth, builderImageSrc);
  return (
    <div style={style.box}>
      <div style={style.inner ?? undefined}>
        <RichEditor
          value={block.rich}
          text={block.text}
          textStyle={{ ...style.text, "--nl-accent": data.theme.accent } as CSSProperties}
          placeholder="Write your text here."
          autoFocus
          onRich={onRich}
          onDone={onDone}
        />
      </div>
    </div>
  );
}

/**
 * The editor itself: words typed and formatted in place, with the bar of
 * formatting buttons under the block. Used for a text block, and for the text
 * inside a story, product or event block (where it is put into the block's
 * own HTML, which already carries the font, size and color).
 */
export function RichEditor({
  value,
  text,
  boxStyle,
  textStyle,
  placeholder,
  autoFocus = false,
  onRich,
  onDone,
}: {
  /** The formatted text; null while it is plain. */
  value: RichNode[] | null;
  /** The same words without formatting, used while `value` is null. */
  text: string;
  boxStyle?: CSSProperties;
  textStyle?: CSSProperties;
  placeholder: string;
  /** Put the caret at the end as soon as it is drawn. */
  autoFocus?: boolean;
  onRich: (rich: RichNode[] | null) => void;
  onDone: () => void;
}) {
  const content = value ?? plainToRich(text);
  const wanted = JSON.stringify(content);
  /** What the editor last showed or reported, to tell its own changes from changes made elsewhere. */
  const shown = useRef(wanted);
  const [linking, setLinking] = useState(false);
  const [fields, setFields] = useState(false);
  const [address, setAddress] = useState("");

  const editor = useEditor({
    // Drawn in the browser only; the canvas is never part of the server's HTML.
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
        strike: false,
        dropcursor: false,
        gapcursor: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: richToEditor(content),
    autofocus: autoFocus ? "end" : false,
    editorProps: {
      attributes: { "aria-label": "Text", spellcheck: "true" },
      handleKeyDown: (_view, event) => {
        if (event.key !== "Escape") return false;
        onDone();
        return true;
      },
    },
    onUpdate: ({ editor: current }) => {
      const rich = richFromEditor(current.getJSON());
      shown.current = JSON.stringify(rich ?? []);
      onRich(rich);
    },
  });

  // A change made elsewhere (undo, the AI rewrite) is put into the editor.
  useEffect(() => {
    if (!editor || wanted === shown.current) return;
    shown.current = wanted;
    editor.commands.setContent(richToEditor(JSON.parse(wanted) as RichNode[]), {
      emitUpdate: false,
    });
  }, [editor, wanted]);

  /** The words that were selected when the link field opened; typing the address moves focus away from them. */
  const linkRange = useRef<{ from: number; to: number } | null>(null);
  const openLink = () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    linkRange.current = { from, to };
    setAddress((editor.getAttributes("link").href as string | undefined) ?? "");
    setLinking(true);
  };
  const applyLink = () => {
    if (!editor) return;
    const href = richLink(address);
    const range = linkRange.current ?? editor.state.selection;
    const inLink = editor.isActive("link");
    const chain = editor.chain().focus().setTextSelection(range);
    if (!href) chain.extendMarkRange("link").unsetLink().run();
    else if (range.from === range.to && !inLink) {
      // No words were selected: the address itself becomes the linked words.
      chain
        .insertContent({
          type: "text",
          text: address.trim().replace(/^https?:\/\//i, ""),
          marks: [{ type: "link", attrs: { href } }],
        })
        .run();
    } else chain.extendMarkRange("link").setLink({ href }).run();
    setLinking(false);
  };

  return (
    // Pressing inside the words places the caret; it doesn't start a drag or pick the block again.

    <div
      style={boxStyle}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <EditorContent editor={editor} className="nl-rich" style={textStyle} />

      {editor ? (
        <div
          role="toolbar"
          aria-label="Text formatting"
          className="absolute top-full left-0 z-30 mt-1 flex flex-wrap items-center gap-0.5 rounded-lg border border-[#e3e0dc] bg-white p-1 font-sans shadow-lg"
        >
          {linking ? (
            <form
              className="flex items-center gap-1"
              onSubmit={(event) => {
                event.preventDefault();
                applyLink();
              }}
            >
              <input
                // The field opens because the person asked to type a link.

                autoFocus
                aria-label="Link address"
                value={address}
                placeholder="yourcompany.com/page"
                maxLength={500}
                onChange={(event) => setAddress(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.stopPropagation();
                    setLinking(false);
                    editor.commands.focus();
                  }
                }}
                className="h-8 w-[200px] rounded-md border border-[#e3e0dc] px-2 text-[13px] text-[#242528] outline-none focus:border-[#242528]"
              />
              <button
                type="submit"
                className="h-8 rounded-md bg-[#242528] px-3 text-[13px] font-semibold text-white"
              >
                {address.trim() ? "Apply" : "Remove link"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setLinking(false);
                  editor.commands.focus();
                }}
                className="h-8 rounded-md px-2 text-[13px] font-medium text-[#6c6d75] hover:text-[#242528]"
              >
                Cancel
              </button>
            </form>
          ) : (
            <>
              <BarButton
                label="Bold"
                active={editor.isActive("bold")}
                onClick={() => editor.chain().focus().toggleBold().run()}
              >
                <strong>B</strong>
              </BarButton>
              <BarButton
                label="Italic"
                active={editor.isActive("italic")}
                onClick={() => editor.chain().focus().toggleItalic().run()}
              >
                <em className="font-serif">I</em>
              </BarButton>
              <BarButton
                label="Underline"
                active={editor.isActive("underline")}
                onClick={() => editor.chain().focus().toggleUnderline().run()}
              >
                <span className="underline">U</span>
              </BarButton>
              <BarButton label="Link" active={editor.isActive("link")} onClick={openLink}>
                <svg
                  aria-hidden
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
                </svg>
              </BarButton>
              <span aria-hidden className="mx-0.5 h-5 w-px bg-[#e3e0dc]" />
              <BarButton
                label="Bulleted list"
                active={editor.isActive("bulletList")}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
              >
                {listIcon(false)}
              </BarButton>
              <BarButton
                label="Numbered list"
                active={editor.isActive("orderedList")}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
              >
                {listIcon(true)}
              </BarButton>
              <span aria-hidden className="mx-0.5 h-5 w-px bg-[#e3e0dc]" />
              <BarButton
                label="Add a personal field"
                active={fields}
                onClick={() => setFields((open) => !open)}
              >
                <span className="px-0.5 text-[12px] font-semibold">{"{ } Name"}</span>
              </BarButton>
              {fields ? (
                <div className="absolute top-full left-0 z-40 mt-1 flex w-[220px] flex-col rounded-lg border border-[#e3e0dc] bg-white p-1 shadow-lg">
                  {PERSONAL_FIELDS.map((field) => (
                    <button
                      key={field.id}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        editor.chain().focus().insertContent(personalToken(field.id)).run();
                        setFields(false);
                      }}
                      className="rounded-md px-2 py-1.5 text-left text-[13px] text-[#242528] hover:bg-[#f0eeea]"
                    >
                      {field.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
