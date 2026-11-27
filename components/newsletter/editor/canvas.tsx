// -----------------------------------------------------------------------------
// @file: components/newsletter/editor/canvas.tsx
// @purpose: The newsletter editor's middle: the newsletter itself, drawn with
//           the same HTML the email gets, where each block can be picked,
//           dragged to a new place, and dropped onto from the block list.
//           Also the block list (palette) and the glyph of each block type.
// -----------------------------------------------------------------------------

"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { TOOL_FOCUS } from "@/components/tools/tool-ui";
import {
  blockTypeInfo,
  canPlace,
  NEWSLETTER_BLOCK_TYPES,
  slotId,
  type BlockSlot,
  type ColumnsBlock,
  type LeafBlock,
  type NewsletterBlock,
  type NewsletterBlockType,
  type NewsletterData,
} from "@/lib/newsletter/newsletter";
import {
  blockFragmentHtml,
  columnWidths,
  editBoxStyle,
  footerFragmentHtml,
  headerFragmentHtml,
  inlineEditStyle,
  isFieldBlock,
  isInlineBlock,
  isRichFieldBlock,
  RICH_FIELD_PLACEHOLDER,
  type InlineBlock,
  NEWSLETTER_GAP,
  NEWSLETTER_WIDTH,
  type RenderOptions,
} from "@/lib/newsletter/render";
import type { RichNode } from "@/lib/newsletter/rich";
import type { SavedBlock } from "@/lib/newsletter/saved";

import { builderImageSrc } from "@/lib/newsletter/templates";

import { RICH_CSS, RichEditor, RichText } from "./rich-text";

/** Pictures come through our own address (the site's policy stops other websites' pictures), icons from this site. */
const RENDER: RenderOptions = { imageSrc: builderImageSrc, assetBase: "", preview: true };
/** The same, for a picked part whose words are typed in place. */
const EDITABLE: RenderOptions = { ...RENDER, editable: true };

// ---------------------------------------------------------------------------
// Block glyphs
// ---------------------------------------------------------------------------

const GLYPHS: Record<NewsletterBlockType, string> = {
  heading: "M6 5v14M18 5v14M6 12h12",
  text: "M4 7h16M4 12h16M4 17h10",
  image: "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15.5 9.5h.01",
  button: "M4 9h16v6H4zM9 12h6",
  divider: "M4 12h16",
  spacer: "M12 4v16M8 8l4-4 4 4M8 16l4 4 4-4",
  columns: "M4 5h7v14H4zM13 5h7v14h-7z",
  story: "M4 6h7v7H4zM14 7h6M14 11h6M4 17h16",
  product: "M5 4h14v16H5zM5 13h14M9 16.5h6",
  quote: "M6 17v-5a4 4 0 0 1 4-4M14 17v-5a4 4 0 0 1 4-4",
  event: "M4 6h16v14H4zM4 10h16M8 4v4M16 4v4",
  video: "M4 5h16v14H4zM10 9l5 3-5 3z",
  social:
    "M7 12a2 2 0 1 0 0 .01M17 6a2 2 0 1 0 0 .01M17 18a2 2 0 1 0 0 .01M8.8 11l6.4-4M8.8 13l6.4 4",
};

export function BlockGlyph({ type, size = 18 }: { type: NewsletterBlockType; size?: number }) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={GLYPHS[type]} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

/** A small drawing of what a basic block is, on its tile in the list. */
function TileArt({ type }: { type: NewsletterBlockType }) {
  switch (type) {
    case "heading":
      return <span className="text-[22px] leading-7 font-bold">Aa</span>;
    case "button":
      return <span className="block h-6 w-16 rounded-md bg-[var(--cs-brand)]" />;
    case "divider":
      return <span className="my-3 block h-0.5 w-16 rounded bg-[var(--cs-text)]" />;
    case "image":
      return (
        <span className="flex h-8 w-14 items-center justify-center rounded-md bg-[#FFE9DF] text-[#C2410C]">
          <BlockGlyph type={type} size={18} />
        </span>
      );
    default:
      return <BlockGlyph type={type} size={24} />;
  }
}

/** The tile color of each ready-made block's icon. */
const TILE_TONES: Partial<Record<NewsletterBlockType, string>> = {
  story: "bg-[#E3F1E4] text-[#1F6B3A]",
  product: "bg-[#FFE9DF] text-[#C2410C]",
  quote: "bg-[#E3F1E4] text-[#1F6B3A]",
  event: "bg-[#FFE9DF] text-[#C2410C]",
  video: "bg-[#ECE4FF] text-[#4C1D95]",
  social: "bg-[#E3F1E4] text-[#1F6B3A]",
  columns: "bg-[#ECE4FF] text-[#4C1D95]",
};

const PLAN_BADGE =
  "rounded-md bg-[var(--cs-soft)] px-1.5 text-[11px] leading-5 font-semibold text-[var(--cs-soft-text)]";

function PaletteItem({
  type,
  locked,
  onAdd,
  onLocked,
}: {
  type: NewsletterBlockType;
  locked: boolean;
  onAdd: (type: NewsletterBlockType) => void;
  onLocked: () => void;
}) {
  const info = blockTypeInfo(type);
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `palette:${type}`,
    data: { kind: "new", type },
    disabled: locked,
  });
  const shared = `relative touch-none rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] text-[13px] leading-5 font-semibold transition-colors hover:border-[var(--cs-text)] ${TOOL_FOCUS} ${
    locked ? "" : "cursor-grab active:cursor-grabbing"
  } ${isDragging ? "opacity-40" : ""}`;
  // The plan mark is for people without a plan only; with one, every block is simply there.
  const badge = locked ? (
    <span aria-hidden className={PLAN_BADGE}>
      Plan
    </span>
  ) : null;
  const common = {
    ref: setNodeRef,
    type: "button" as const,
    ...listeners,
    ...attributes,
    "aria-label": locked ? `${info.label}: comes with a brandbite plan` : `Add ${info.label}`,
    title: info.note,
    onClick: () => (locked ? onLocked() : onAdd(type)),
  };

  if (info.group === "basic") {
    return (
      <button
        {...common}
        className={`${shared} flex min-h-[88px] flex-col items-start justify-between gap-2 p-3`}
      >
        <span className="flex min-h-8 items-center">
          <TileArt type={type} />
        </span>
        {info.label}
      </button>
    );
  }
  return (
    <button
      {...common}
      className={`${shared} flex min-h-14 items-center gap-2.5 p-2.5 text-left ${
        info.group === "layout" ? "col-span-2" : ""
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TILE_TONES[type] ?? ""}`}
      >
        <BlockGlyph type={type} size={18} />
      </span>
      <span className="min-w-0 flex-1 truncate">{info.label}</span>
      {info.group === "layout" ? (
        badge
      ) : badge ? (
        <span className="absolute -top-2 right-1.5">{badge}</span>
      ) : null}
    </button>
  );
}

const PALETTE_GROUPS: { id: "basic" | "layout" | "content"; label: string }[] = [
  { id: "basic", label: "Basics" },
  { id: "layout", label: "Layout" },
  { id: "content", label: "Ready-made" },
];

/** A block the company kept, in the list: dragged or clicked into the newsletter like a new one. */
function SavedItem({
  saved,
  onAdd,
  onDelete,
}: {
  saved: SavedBlock;
  onAdd: (saved: SavedBlock) => void;
  onDelete: (id: string) => void;
}) {
  const [asking, setAsking] = useState(false);
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `saved:${saved.id}`,
    data: { kind: "saved", type: saved.block.type, savedId: saved.id },
  });
  return (
    <li className="flex items-center gap-1">
      <button
        ref={setNodeRef}
        type="button"
        {...listeners}
        {...attributes}
        aria-label={`Add ${saved.name}`}
        onClick={() => onAdd(saved)}
        className={`flex min-h-11 min-w-0 flex-1 cursor-grab touch-none items-center gap-2 rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] px-2.5 text-left text-[13px] leading-4 font-semibold hover:border-[var(--cs-text)] active:cursor-grabbing ${TOOL_FOCUS} ${isDragging ? "opacity-40" : ""}`}
      >
        <BlockGlyph type={saved.block.type} size={16} />
        <span className="truncate">{saved.name}</span>
      </button>
      {asking ? (
        <button
          type="button"
          onClick={() => onDelete(saved.id)}
          onBlur={() => setAsking(false)}
          className={`min-h-11 rounded-lg border border-[var(--cs-danger)] px-2 text-[12px] font-semibold text-[var(--cs-danger)] ${TOOL_FOCUS}`}
        >
          Delete?
        </button>
      ) : (
        <button
          type="button"
          aria-label={`Delete ${saved.name}`}
          title="Delete"
          onClick={() => setAsking(true)}
          className={`flex h-11 w-8 items-center justify-center rounded-lg text-[var(--cs-muted)] hover:text-[var(--cs-text)] ${TOOL_FOCUS}`}
        >
          <span aria-hidden>×</span>
        </button>
      )}
    </li>
  );
}

export function Palette({
  pro,
  saved,
  onAdd,
  onAddSaved,
  onDeleteSaved,
}: {
  pro: boolean;
  /** Blocks the company kept for reuse. */
  saved: SavedBlock[];
  onAdd: (type: NewsletterBlockType) => void;
  onAddSaved: (saved: SavedBlock) => void;
  onDeleteSaved: (id: string) => void;
}) {
  const [notice, setNotice] = useState(false);
  const [tab, setTab] = useState<"blocks" | "saved">("blocks");
  const [query, setQuery] = useState("");
  const words = query.trim().toLowerCase();
  const matches = (text: string) => !words || text.toLowerCase().includes(words);
  const groups = PALETTE_GROUPS.map((group) => ({
    ...group,
    types: NEWSLETTER_BLOCK_TYPES.filter(
      (type) => type.group === group.id && matches(`${type.label} ${type.note}`),
    ),
  })).filter((group) => group.types.length);
  const savedShown = saved.filter((item) => matches(item.name));
  const heading = "text-sm leading-5 font-bold";

  return (
    <div className="flex min-h-full flex-col gap-4 p-4">
      <div role="tablist" aria-label="Block lists" className="grid grid-cols-2 gap-1">
        {(
          [
            { id: "blocks", label: "Blocks" },
            { id: "saved", label: "Saved" },
          ] as const
        ).map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={tab === option.id}
            onClick={() => setTab(option.id)}
            className={`h-11 rounded-xl text-sm font-semibold ${TOOL_FOCUS} ${
              tab === option.id
                ? "bg-[var(--cs-soft)] text-[var(--cs-soft-text)]"
                : "border border-[var(--cs-border)] text-[var(--cs-muted)] hover:text-[var(--cs-text)]"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <label className="relative block">
        <span className="sr-only">
          {tab === "blocks" ? "Search blocks" : "Search saved blocks"}
        </span>
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--cs-muted)]">
          <svg
            aria-hidden
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM20 20l-4-4" />
          </svg>
        </span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search blocks…"
          className={`h-11 w-full rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)] pr-3 pl-9 text-sm ${TOOL_FOCUS}`}
        />
      </label>

      {tab === "blocks" ? (
        <>
          {groups.map((group) => (
            <section key={group.id}>
              <h3 className={heading}>{group.label}</h3>
              <div
                className={`mt-2 grid grid-cols-2 gap-2 ${group.id === "content" ? "gap-y-3 pt-1" : ""}`}
              >
                {group.types.map((type) => (
                  <PaletteItem
                    key={type.id}
                    type={type.id}
                    locked={type.pro && !pro}
                    onAdd={onAdd}
                    onLocked={() => setNotice(true)}
                  />
                ))}
              </div>
            </section>
          ))}
          {groups.length === 0 ? (
            <p className="text-[13px] leading-5 text-[var(--cs-muted)]">No block matches.</p>
          ) : null}
          {!pro ? (
            <p
              role="status"
              className={`rounded-xl border border-[var(--cs-border)] p-3 text-[13px] leading-5 text-[var(--cs-muted)] ${notice ? "ring-2 ring-[var(--cs-selected)]" : ""}`}
            >
              Blocks marked Plan come with a brandbite plan, together with AI writing, image upload,
              saved newsletters and test emails.
            </p>
          ) : null}
        </>
      ) : pro ? (
        <section>
          <h3 className={heading}>Your blocks</h3>
          {savedShown.length ? (
            <ul className="mt-2 flex flex-col gap-1.5">
              {savedShown.map((item) => (
                <SavedItem key={item.id} saved={item} onAdd={onAddSaved} onDelete={onDeleteSaved} />
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[13px] leading-5 text-[var(--cs-muted)]">
              {saved.length
                ? "No saved block matches."
                : "Nothing saved yet. Pick a block in the newsletter and press Save on its bar to keep it here for your other newsletters."}
            </p>
          )}
        </section>
      ) : (
        <p className="rounded-xl border border-[var(--cs-border)] p-3 text-[13px] leading-5 text-[var(--cs-muted)]">
          With a brandbite plan you can save any block here and use it again in your other
          newsletters.
        </p>
      )}

      <p className="mt-auto flex items-center gap-3 rounded-xl bg-[var(--cs-soft)] px-4 py-3 text-[13px] leading-5 font-medium text-[var(--cs-soft-text)]">
        <svg aria-hidden width="14" height="18" viewBox="0 0 14 18" fill="currentColor">
          <circle cx="3" cy="3" r="1.6" />
          <circle cx="11" cy="3" r="1.6" />
          <circle cx="3" cy="9" r="1.6" />
          <circle cx="11" cy="9" r="1.6" />
          <circle cx="3" cy="15" r="1.6" />
          <circle cx="11" cy="15" r="1.6" />
        </svg>
        Drag to add, or click to insert.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Canvas
// ---------------------------------------------------------------------------

export type CanvasActions = {
  onSelect: (target: string | null) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  /** Keep a block to use again in other newsletters; left out for people who can't keep any. */
  onKeep?: (id: string) => void;
  /** Words typed straight onto a block. */
  onText: (id: string, text: string) => void;
  /** A text block's words and formatting, typed on the canvas; null when it was emptied. */
  onRich: (id: string, rich: RichNode[] | null) => void;
  /** Words typed into one of a block's several pieces of text. */
  onField: (id: string, field: string, text: string) => void;
  /** Words typed into the header or the footer: the brand name, the note, the address. */
  onRegionField: (field: string, text: string) => void;
};

/** What is being dragged, so drop places know whether they can take it. */
export type Dragging = { type: NewsletterBlockType; id: string | null } | null;

/** Whether what is being dragged may land in a place. */
export function slotTakes(slot: BlockSlot, dragging: Dragging): boolean {
  return (
    dragging !== null &&
    canPlace(dragging.type, slot) &&
    // A block that is being moved can't land inside itself.
    !(dragging.id !== null && slot.columnsId === dragging.id)
  );
}

/**
 * A place between two blocks where a dragged block can land. Takes no room.
 * It is always there to be measured, so a quick drag finds it; whether it
 * takes the block is decided by slotTakes, here and when the block is let go.
 */
function Slot({ slot, dragging }: { slot: BlockSlot; dragging: Dragging }) {
  const { setNodeRef, isOver } = useDroppable({ id: slotId(slot), data: { slot } });
  return (
    <div ref={setNodeRef} data-slot={slotId(slot)} className="relative h-0">
      {isOver && slotTakes(slot, dragging) ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-[2px] z-20 h-1 rounded-full bg-[var(--cs-selected)]"
        />
      ) : null}
    </div>
  );
}

function ToolbarButton({
  label,
  text,
  onClick,
  disabled,
  children,
}: {
  label: string;
  /** The word shown beside the icon; left out where there is no room for words. */
  text?: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={`flex h-8 items-center justify-center gap-1.5 rounded-md font-sans text-[13px] leading-4 font-semibold text-[#242528] hover:bg-[#f1eefc] focus-visible:ring-2 focus-visible:ring-[#242528] focus-visible:outline-none disabled:opacity-35 disabled:hover:bg-transparent ${
        text ? "px-2" : "w-8"
      }`}
    >
      {children}
      {text}
    </button>
  );
}

const icon = (d: string) => (
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
    <path d={d} />
  </svg>
);

function CanvasBlock({
  block,
  data,
  nestedWidth,
  first,
  last,
  selected,
  dragging,
  actions,
}: {
  block: NewsletterBlock;
  data: NewsletterData;
  /** The column's width when the block sits inside a columns block; null at the top level. */
  nestedWidth: number | null;
  first: boolean;
  last: boolean;
  selected: string | null;
  dragging: Dragging;
  actions: CanvasActions;
}) {
  const info = blockTypeInfo(block.type);
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `block:${block.id}`,
    data: { kind: "move", type: block.type, id: block.id },
  });
  const isSelected = selected === block.id;
  // A block inside a column is too narrow for a bar with words; it gets the icons alone.
  const words = nestedWidth === null;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      aria-label={`${info.label} block${isSelected ? ", selected" : ""}`}
      aria-pressed={isSelected}
      onClick={(event) => {
        event.stopPropagation();
        actions.onSelect(block.id);
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          actions.onSelect(block.id);
        }
      }}
      className={`group/block relative cursor-pointer touch-none outline-none ${isDragging ? "opacity-40" : ""}`}
    >
      {block.type === "columns" ? (
        <ColumnsView
          block={block}
          data={data}
          selected={selected}
          dragging={dragging}
          actions={actions}
        />
      ) : isSelected && block.type === "text" ? (
        <RichText
          block={block}
          data={data}
          nestedWidth={nestedWidth}
          onRich={(rich) => actions.onRich(block.id, rich)}
          onDone={() => actions.onSelect(null)}
        />
      ) : isSelected && isInlineBlock(block) ? (
        <InlineText
          block={block}
          data={data}
          nestedWidth={nestedWidth}
          onText={(text) => actions.onText(block.id, text)}
          onDone={() => actions.onSelect(null)}
        />
      ) : isSelected && isFieldBlock(block) ? (
        <EditableHtml
          html={blockFragmentHtml(data, block, nestedWidth, EDITABLE)}
          rich={
            isRichFieldBlock(block)
              ? {
                  value: block.rich,
                  text: block.text,
                  placeholder: RICH_FIELD_PLACEHOLDER[block.type],
                  onRich: (rich) => actions.onRich(block.id, rich),
                }
              : undefined
          }
          onField={(field, text) => actions.onField(block.id, field, text)}
          onDone={() => actions.onSelect(null)}
        />
      ) : (
        <div
          className="pointer-events-none"
          // Built by lib/newsletter/render.ts, which escapes every value.
          dangerouslySetInnerHTML={{
            __html: blockFragmentHtml(data, block as LeafBlock, nestedWidth, RENDER),
          }}
        />
      )}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 z-10 border-2 ${
          isSelected
            ? "border-[var(--cs-selected)]"
            : "border-transparent group-hover/block:border-[var(--cs-selected)]/40 group-focus-visible/block:border-[var(--cs-text)]"
        }`}
      />
      {block.show !== "all" ? (
        <span className="pointer-events-none absolute top-1 left-1 z-20 rounded-md bg-[#242528] px-1.5 py-0.5 font-sans text-[11px] leading-4 font-semibold text-white">
          {block.show === "phone" ? "Phones only" : "Not on phones"}
        </span>
      ) : null}
      {isSelected ? (
        <div className="absolute right-0 bottom-full z-30 mb-1.5 flex items-center gap-0.5 rounded-xl border border-[#e3e0dc] bg-white p-1 shadow-[0_6px_20px_rgba(36,37,40,0.14)]">
          <ToolbarButton
            label="Move up"
            disabled={first}
            onClick={() => actions.onMove(block.id, -1)}
          >
            {icon("M12 19V5M6 11l6-6 6 6")}
          </ToolbarButton>
          <ToolbarButton
            label="Move down"
            disabled={last}
            onClick={() => actions.onMove(block.id, 1)}
          >
            {icon("M12 5v14M6 13l6 6 6-6")}
          </ToolbarButton>
          <span aria-hidden className="mx-0.5 h-5 w-px bg-[#e3e0dc]" />
          <ToolbarButton
            label="Duplicate"
            text={words ? "Duplicate" : undefined}
            onClick={() => actions.onDuplicate(block.id)}
          >
            {icon("M9 9h10v10H9zM5 15V5h10")}
          </ToolbarButton>
          {actions.onKeep ? (
            <ToolbarButton
              label="Save to use again"
              text={words ? "Save" : undefined}
              onClick={() => actions.onKeep?.(block.id)}
            >
              {icon("M7 4h10v16l-5-4-5 4z")}
            </ToolbarButton>
          ) : null}
          <ToolbarButton
            label="Delete"
            text={words ? "Delete" : undefined}
            onClick={() => actions.onRemove(block.id)}
          >
            {icon("M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13")}
          </ToolbarButton>
        </div>
      ) : null}
    </div>
  );
}

/**
 * A picked heading, text or button, with a text field where its words are:
 * the same font, size, color and spacing as in the email, so typing happens
 * in place. The field holds the words as they are stored (an empty line
 * between two paragraphs, a web address as typed).
 */
function InlineText({
  block,
  data,
  nestedWidth,
  onText,
  onDone,
}: {
  block: InlineBlock;
  data: NewsletterData;
  nestedWidth: number | null;
  onText: (text: string) => void;
  onDone: () => void;
}) {
  const style = inlineEditStyle(data, block, nestedWidth, builderImageSrc);
  const value = block.type === "button" ? block.label : block.text;
  const field = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);

  // Typing starts at once, at the end of what is there.
  useEffect(() => {
    const node = field.current;
    if (!node) return;
    node.focus({ preventScroll: true });
    const end = node.value.length;
    node.setSelectionRange(end, end);
  }, []);

  // A text field doesn't grow with its words by itself.
  useLayoutEffect(() => {
    const node = field.current;
    if (!(node instanceof HTMLTextAreaElement)) return;
    node.style.height = "auto";
    node.style.height = `${node.scrollHeight}px`;
  }, [value, style.text.fontSize, style.text.fontFamily, nestedWidth]);

  const shared = {
    value,
    spellCheck: true,
    // Pressing inside the words places the caret; it doesn't start a drag.
    onPointerDown: (event: React.PointerEvent) => event.stopPropagation(),
    onClick: (event: React.MouseEvent) => event.stopPropagation(),
    className:
      "m-0 block w-full resize-none overflow-hidden border-0 bg-transparent p-0 outline-none placeholder:text-[#8a8780]",
  };
  const onKeyDown = (event: React.KeyboardEvent, single: boolean) => {
    if (event.key === "Escape" || (single && event.key === "Enter")) {
      event.preventDefault();
      onDone();
    }
  };

  if (block.type === "button" && style.button) {
    const justify =
      block.align === "center" ? "center" : block.align === "right" ? "flex-end" : "flex-start";
    return (
      <div style={style.box}>
        <div className="flex" style={{ ...style.inner, justifyContent: justify }}>
          <span
            className="block"
            style={{
              background: style.button.background,
              border: style.button.border ?? undefined,
              borderRadius: style.button.borderRadius,
              padding: style.button.padding,
              width: style.button.full ? "100%" : undefined,
            }}
          >
            <input
              {...shared}
              ref={(node) => {
                field.current = node;
              }}
              aria-label="Button text"
              placeholder="Button"
              maxLength={60}
              onChange={(event) => onText(event.target.value)}
              onKeyDown={(event) => onKeyDown(event, true)}
              style={{
                ...style.text,
                outline: "none",
                textAlign: "center",
                height: style.text.lineHeight,
                width: style.button.full ? "100%" : `${Math.max(value.length, 6) + 1.5}ch`,
              }}
            />
          </span>
        </div>
      </div>
    );
  }

  const heading = block.type === "heading";
  return (
    <div style={style.box}>
      <div style={style.inner ?? undefined}>
        <textarea
          {...shared}
          ref={(node) => {
            field.current = node;
          }}
          rows={1}
          aria-label={heading ? "Heading" : "Text"}
          placeholder={heading ? "Heading" : "Write your text here."}
          maxLength={heading ? 300 : 4000}
          onChange={(event) =>
            // A heading is one line; a pasted line break becomes a space.
            onText(heading ? event.target.value.replace(/\s*\n\s*/g, " ") : event.target.value)
          }
          onKeyDown={(event) => onKeyDown(event, heading)}
          // The selection frame already shows where the caret is.
          style={{ ...style.text, outline: "none" }}
        />
      </div>
    </div>
  );
}

/** The typed words of a marked element: one line unless it takes several. */
function typedText(node: HTMLElement): string {
  // An emptied element keeps a stray line break; that is not text.
  const text = node.innerText
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "")
    .replace(/\n+$/, "");
  if (!text.trim()) return "";
  return node.dataset.lines ? text.slice(0, 4000) : text.replace(/\s*\n\s*/g, " ").slice(0, 200);
}

/**
 * A picked part made of several pieces of text: a story, product, quote,
 * event or video block, the header or the footer. It is drawn with the email's
 * own HTML, in which each piece is marked; the marked pieces are made typable
 * where they stand. While
 * someone is typing, the page leaves that HTML alone (redrawing it would move
 * the caret); it is drawn again when they leave the block's text.
 */
function EditableHtml({
  html,
  rich,
  onField,
  onDone,
}: {
  /** The email's own HTML for this part, drawn with its pieces of text marked. */
  html: string;
  /** The part's formatted text, typed in a text editor put where the HTML leaves room for it. */
  rich?: {
    value: RichNode[] | null;
    text: string;
    placeholder: string;
    onRich: (rich: RichNode[] | null) => void;
  };
  onField: (field: string, text: string) => void;
  onDone: () => void;
}) {
  /** The place in the drawn HTML that takes the text editor; it is new after every redraw. */
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const frame = useRef<HTMLDivElement | null>(null);
  const typing = useRef(false);
  const drawn = useRef("");
  const [tick, redraw] = useState(0);

  useLayoutEffect(() => {
    const node = frame.current;
    if (!node || typing.current || drawn.current === html) return;
    // Built by lib/newsletter/render.ts, which escapes every value.
    node.innerHTML = html;
    drawn.current = html;
    for (const piece of node.querySelectorAll<HTMLElement>("[data-edit]")) {
      // Plain text only where the browser offers it, so pasted formatting never gets in.
      piece.contentEditable = "plaintext-only";
      if (piece.contentEditable !== "plaintext-only") piece.contentEditable = "true";
      piece.spellcheck = true;
    }
    setSlot(node.querySelector<HTMLElement>("[data-rich-slot]"));
    // `tick` runs this again when typing ends, to draw what was typed meanwhile.
  }, [html, tick]);

  return (
    // The pieces of text inside are the controls; this only passes on what happens in them.

    <div
      ref={frame}
      className="nl-fields"
      onInput={(event) => {
        const piece = (event.target as HTMLElement).closest<HTMLElement>("[data-edit]");
        if (!piece?.dataset.edit) return;
        typing.current = true;
        const text = typedText(piece);
        // An emptied piece keeps a stray line break; without it the placeholder shows again.
        if (!text) piece.textContent = "";
        onField(piece.dataset.edit, text);
      }}
      onPaste={(event) => {
        const piece = (event.target as HTMLElement).closest<HTMLElement>("[data-edit]");
        if (!piece || piece.contentEditable === "plaintext-only") return;
        event.preventDefault();
        document.execCommand("insertText", false, event.clipboardData.getData("text/plain"));
      }}
      onKeyDown={(event) => {
        const piece = (event.target as HTMLElement).closest<HTMLElement>("[data-edit]");
        if (!piece) return;
        if (event.key === "Escape") {
          event.preventDefault();
          onDone();
        } else if (event.key === "Enter" && !piece.dataset.lines) {
          event.preventDefault();
          piece.blur();
        }
      }}
      onBlur={(event) => {
        // Moving from one piece to another of the same block is still typing.
        if (frame.current?.contains(event.relatedTarget as Node | null)) return;
        if (!typing.current) return;
        typing.current = false;
        redraw((tick) => tick + 1);
      }}
      onPointerDown={(event) => {
        // Pressing inside the words places the caret; anywhere else on the block still drags it.
        if ((event.target as HTMLElement).closest("[data-edit]")) event.stopPropagation();
      }}
      onClick={(event) => {
        // Links in the block don't open while it is being edited.
        if ((event.target as HTMLElement).closest("a")) event.preventDefault();
      }}
    >
      {rich && slot
        ? createPortal(
            <RichEditor
              value={rich.value}
              text={rich.text}
              placeholder={rich.placeholder}
              onRich={rich.onRich}
              onDone={onDone}
            />,
            slot,
          )
        : null}
    </div>
  );
}

function ColumnsView({
  block,
  data,
  selected,
  dragging,
  actions,
}: {
  block: ColumnsBlock;
  data: NewsletterData;
  selected: string | null;
  dragging: Dragging;
  actions: CanvasActions;
}) {
  const around = editBoxStyle(data, block, null, builderImageSrc);
  const widths = columnWidths(block.layout, around.width);
  return (
    <div style={around.outer}>
      <div
        className="flex"
        style={{
          ...around.inner,
          gap: NEWSLETTER_GAP,
          alignItems: block.valign === "middle" ? "center" : "flex-start",
        }}
      >
        {block.cells.map((cell, cellIndex) => (
          <div
            key={cellIndex}
            className={`relative min-h-[72px] shrink-0 ${
              cell.length === 0 || dragging
                ? "outline outline-1 outline-[#b9b5ae] outline-dashed"
                : ""
            }`}
            style={{ width: widths[cellIndex] }}
          >
            <Slot slot={{ columnsId: block.id, cell: cellIndex, index: 0 }} dragging={dragging} />
            {cell.map((inner, index) => (
              <Fragment key={inner.id}>
                <CanvasBlock
                  block={inner}
                  data={data}
                  nestedWidth={widths[cellIndex]}
                  first={index === 0}
                  last={index === cell.length - 1}
                  selected={selected}
                  dragging={dragging}
                  actions={actions}
                />
                <Slot
                  slot={{ columnsId: block.id, cell: cellIndex, index: index + 1 }}
                  dragging={dragging}
                />
              </Fragment>
            ))}
            {cell.length === 0 ? (
              <p className="flex h-[72px] items-center justify-center px-2 text-center font-sans text-[12px] leading-4 text-[#8a8780]">
                Drop a block here
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/** A fixed part of the newsletter (header, footer) that can be picked but not moved. */
function Region({
  id,
  label,
  html,
  editHtml,
  rounding,
  selected,
  onSelect,
  onField,
}: {
  id: "header" | "footer";
  label: string;
  html: string;
  /** The same part with its pieces of text marked, drawn while it is picked. */
  editHtml: string;
  /** Rounds this part's outer corners, where the newsletter's own corners are round. */
  rounding: string;
  selected: string | null;
  onSelect: (target: string | null) => void;
  onField: (field: string, text: string) => void;
}) {
  const isSelected = selected === id;
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${label}${isSelected ? ", selected" : ""}`}
      aria-pressed={isSelected}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(id);
      }}
      onKeyDown={(event) => {
        // Keys pressed while typing inside belong to the words.
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(id);
        }
      }}
      className={`group/region relative cursor-pointer overflow-hidden outline-none ${rounding}`}
    >
      {isSelected ? (
        <EditableHtml html={editHtml} onField={onField} onDone={() => onSelect(null)} />
      ) : (
        // Built by lib/newsletter/render.ts, which escapes every value.
        <div className="pointer-events-none" dangerouslySetInnerHTML={{ __html: html }} />
      )}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 z-10 border-2 ${
          isSelected
            ? "border-[var(--cs-selected)]"
            : "border-transparent group-hover/region:border-[var(--cs-selected)]/40 group-focus-visible/region:border-[var(--cs-text)]"
        }`}
      />
      {isSelected ? (
        <span className="absolute top-1 right-1 z-30 rounded-lg bg-[var(--cs-selected)] px-2.5 py-1.5 text-[12px] leading-4 font-semibold text-white shadow-md">
          {label}
        </span>
      ) : null}
    </div>
  );
}

/**
 * How the typable pieces of a picked block behave: a text caret, no focus
 * frame of their own (the block's frame shows where you are), and their
 * placeholder while empty. Written with the studio's own selector so it wins
 * over the studio's focus outline.
 */
const FIELD_CSS = `
.color-studio .nl-fields [data-edit]{cursor:text;outline:none;min-width:1ch;}
.color-studio .nl-fields span[data-edit]{display:inline-block;}
.color-studio .nl-fields span[data-edit][data-lines]{display:inline;}
.color-studio .nl-fields [data-edit]:empty::before{content:attr(data-placeholder);color:#8a8780;font-weight:inherit;}
`;

export function Canvas({
  data,
  selected,
  dragging,
  actions,
}: {
  data: NewsletterData;
  selected: string | null;
  dragging: Dragging;
  actions: CanvasActions;
}) {
  // The newsletter is always 600 pixels wide; a narrower window shows it smaller.
  const frame = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    const fit = () =>
      setScale(Math.min(1, Math.max(0.4, (node.clientWidth - 32) / NEWSLETTER_WIDTH)));
    const observer = new ResizeObserver(fit);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const root = (index: number): BlockSlot => ({ columnsId: null, cell: 0, index });

  return (
    // Clicking the page around the newsletter lets go of the picked block.
    <div
      ref={frame}
      className="h-full overflow-auto px-4 pt-12 pb-24"
      style={{ background: data.theme.page }}
      onClick={() => actions.onSelect(null)}
    >
      <style>{FIELD_CSS + RICH_CSS}</style>
      <div
        className="mx-auto shadow-[0_1px_3px_rgba(0,0,0,0.08),0_8px_24px_rgba(0,0,0,0.06)]"
        style={{
          width: NEWSLETTER_WIDTH,
          zoom: scale,
          background: data.theme.card,
          borderRadius: data.theme.rounded ? 16 : 0,
        }}
      >
        {data.header.show ? (
          <Region
            id="header"
            label="Header"
            rounding={data.theme.rounded ? "rounded-t-[16px]" : ""}
            html={headerFragmentHtml(data, RENDER)}
            editHtml={headerFragmentHtml(data, EDITABLE)}
            selected={selected}
            onSelect={actions.onSelect}
            onField={actions.onRegionField}
          />
        ) : (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              actions.onSelect("header");
            }}
            className={`block w-full border-b border-dashed border-[#b9b5ae] py-2 text-center font-sans text-[12px] leading-4 text-[#8a8780] hover:text-[#292827] ${TOOL_FOCUS}`}
          >
            The header is hidden. Click to change it.
          </button>
        )}

        <Slot slot={root(0)} dragging={dragging} />
        {data.blocks.map((block, index) => (
          <Fragment key={block.id}>
            <CanvasBlock
              block={block}
              data={data}
              nestedWidth={null}
              first={index === 0}
              last={index === data.blocks.length - 1}
              selected={selected}
              dragging={dragging}
              actions={actions}
            />
            <Slot slot={root(index + 1)} dragging={dragging} />
          </Fragment>
        ))}
        {data.blocks.length === 0 ? (
          <p className="mx-10 my-8 flex h-40 items-center justify-center rounded-lg border-2 border-dashed border-[#b9b5ae] px-6 text-center font-sans text-sm leading-5 text-[#8a8780]">
            Drag a block here, or click one in the list to add it.
          </p>
        ) : null}

        <Region
          id="footer"
          label="Footer"
          rounding={data.theme.rounded ? "rounded-b-[16px]" : ""}
          html={footerFragmentHtml(data, RENDER)}
          editHtml={footerFragmentHtml(data, EDITABLE)}
          selected={selected}
          onSelect={actions.onSelect}
          onField={actions.onRegionField}
        />
      </div>
    </div>
  );
}
