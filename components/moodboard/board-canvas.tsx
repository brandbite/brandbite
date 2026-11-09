"use client";

// -----------------------------------------------------------------------------
// @file: components/moodboard/board-canvas.tsx
// @purpose: The infinite moodboard canvas. One set of pointer handlers drives
//           panning, pinching, box selection, and moving and resizing cards. During a gesture
//           styles are written directly to the element, so React only re-renders
//           when the gesture ends and the new position is committed.
// -----------------------------------------------------------------------------

import React, {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { CanvasControls } from "@/components/moodboard/canvas-controls";
import { CardWrapper, type ResizeCorner } from "@/components/moodboard/card-wrapper";
import { ColorCard } from "@/components/moodboard/color-card";
import { ConnectionLayer } from "@/components/moodboard/connection-layer";
import { DrawingLayer } from "@/components/moodboard/drawing-layer";
import { EmbedCard } from "@/components/moodboard/embed-card";
import { FileCard } from "@/components/moodboard/file-card";
import { ImageCard } from "@/components/moodboard/image-card";
import { LinkCard } from "@/components/moodboard/link-card";
import { NoteCard } from "@/components/moodboard/note-card";
import { TodoCard } from "@/components/moodboard/todo-card";
import { ShapeCard } from "@/components/moodboard/shape-card";
import { TextCard } from "@/components/moodboard/text-card";
import { useCanvasTransform } from "@/components/moodboard/use-canvas-transform";
import type { CreatableKind, ToolMode } from "@/components/moodboard/board-toolbar";
import type {
  DrawingCardData,
  MoodboardConnection,
  MoodboardItemClient,
  MoodboardItemData,
  NoteCardData,
  ShapeCardData,
  ShapeKind,
} from "@/lib/moodboard";
import {
  CANVAS_DEFAULTS,
  isColorData,
  isEmbedData,
  isFileData,
  isImageData,
  isLinkData,
  isNoteData,
  isShapeData,
  isTextData,
  isTodoData,
  SHAPE_FILLS,
  STICKY_COLORS,
} from "@/lib/moodboard";

import { rectsIntersect, resizeFromCorner, zoomAtPoint, type CanvasRect } from "./canvas-math";
import { createCardOverrideStore } from "./card-override-store";
import { SNAP_SCREEN_PX, snapBox, unionBox, type Box, type Guide } from "./snapping";

const { MIN_WIDTH, MIN_HEIGHT } = CANVAS_DEFAULTS;

/** Pointer travel before a press becomes a drag, in screen pixels. */
const DRAG_THRESHOLD = 4;
const NUDGE_PX = 10;
const NUDGE_LARGE_PX = 50;
/** How long to wait for the browser's own paste event before using the last copy. */
const PASTE_FALLBACK_MS = 60;
/** These keep their own click and typing behaviour inside a card. */
const INTERACTIVE = "input, textarea, select, button, iframe";

export type Selection =
  | { kind: "card" | "drawing" | "connection"; id: string }
  | { kind: "multi"; ids: string[] }
  | null;

/** The cards and drawings in a selection. An arrow isn't one of them. */
function selectedItemIds(selection: Selection): string[] {
  if (!selection || selection.kind === "connection") return [];
  return selection.kind === "multi" ? selection.ids : [selection.id];
}

export type BoardCanvasHandle = {
  viewCenter: () => { x: number; y: number };
  /** The canvas point under this spot on screen, or null if it's off the canvas. */
  clientToCanvas: (clientX: number, clientY: number) => { x: number; y: number } | null;
  selectCard: (id: string, options?: { edit?: boolean }) => void;
  selectItems: (ids: string[]) => void;
  clearSelection: () => void;
};

type BoardCanvasProps = {
  items: MoodboardItemClient[];
  connections: MoodboardConnection[];
  toolMode: ToolMode;
  drawColor: string;
  drawSize: number;
  drawOpacity: number;
  placing: CreatableKind | null;
  /** Look around only: nothing can be selected or changed. */
  readOnly?: boolean;
  isPhone?: boolean;
  keyboardOpen?: boolean;
  /** Another row is using that spot above the toolbar. */
  hideObjectToolbar?: boolean;
  handleRef?: React.RefObject<BoardCanvasHandle | null>;
  onSetToolMode: (mode: ToolMode) => void;
  onPlace: (kind: CreatableKind, point: { x: number; y: number }) => void;
  onPick: (kind: CreatableKind) => void;
  onCancelPlacing: () => void;
  onRemoveEmpty: (itemId: string) => void;
  onUpdateItem: (itemId: string, data: MoodboardItemData) => void;
  onDeleteItem: (itemId: string) => void;
  onMoveItem: (itemId: string, x: number, y: number) => void;
  /** Several at once. A nudge from the arrow keys is one undo step, however many presses. */
  onMoveItems: (moves: ItemMove[], options?: { nudge?: boolean }) => void;
  onDeleteItems: (itemIds: string[]) => void;
  onDuplicateItems: (itemIds: string[]) => void;
  /** Remembers these items and returns the text for the clipboard. */
  onCopyItems: (itemIds: string[]) => string;
  /** False if the clipboard holds something other than board items. */
  onPasteText: (text: string | null) => boolean;
  /** The last copy, for browsers that don't report a paste with nothing to paste into. */
  onPasteLastCopy: () => void;
  /** Files dropped on the board or pasted (screenshots); `at` is where, in canvas units. */
  onAddFiles: (files: File[], at: { x: number; y: number } | null) => void;
  onResizeItem: (itemId: string, x: number, y: number, width: number, height: number) => void;
  onAddConnection: (sourceId: string, targetId: string) => void;
  onDeleteConnection: (id: string) => void;
  onAddDrawing: (
    data: DrawingCardData,
    bounds: { x: number; y: number; w: number; h: number },
  ) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
};

export type ItemMove = { id: string; x: number; y: number };

/** True when a drag from outside the page carries files (not text or a link). */
function hasFiles(transfer: DataTransfer | null): boolean {
  return !!transfer && Array.from(transfer.types).includes("Files");
}

type Gesture =
  | {
      kind: "connect";
      pointerId: number;
      sourceId: string;
      startX: number;
      startY: number;
      moved: boolean;
    }
  | { kind: "pan"; pointerId: number; startX: number; startY: number; panX: number; panY: number }
  | {
      kind: "pinch";
      distance: number;
      centerX: number;
      centerY: number;
    }
  | {
      kind: "card";
      pointerId: number;
      id: string;
      el: HTMLElement;
      startX: number;
      startY: number;
      origin: { x: number; y: number };
      moved: boolean;
      wasSelected: boolean;
      /** Offset so far in canvas units, after snapping. */
      dx: number;
      dy: number;
    }
  | {
      kind: "group";
      pointerId: number;
      clickedId: string;
      members: { id: string; el: Element; isDrawing: boolean; x: number; y: number }[];
      startX: number;
      startY: number;
      moved: boolean;
    }
  | {
      kind: "marquee";
      pointerId: number;
      startX: number;
      startY: number;
      /** Already selected, when Shift adds to a selection. */
      base: string[];
      moved: boolean;
    }
  | {
      kind: "resize";
      pointerId: number;
      id: string;
      el: HTMLElement;
      corner: ResizeCorner;
      startX: number;
      startY: number;
      origin: CanvasRect;
      next: CanvasRect;
    };

function CardContent({
  item,
  editRequest,
  onUpdateItem,
  onRemoveEmpty,
}: {
  item: MoodboardItemClient;
  editRequest: number;
  onUpdateItem: (id: string, data: MoodboardItemData) => void;
  onRemoveEmpty: (id: string) => void;
}) {
  const { id, type, data } = item;
  const update = (next: MoodboardItemData) => onUpdateItem(id, next);

  if (isNoteData(type, data)) {
    return <NoteCard data={data} onUpdate={update} editRequest={editRequest} />;
  }
  if (isShapeData(type, data)) {
    return <ShapeCard data={data} onUpdate={update} editRequest={editRequest} />;
  }
  if (isTextData(type, data)) {
    return (
      <TextCard
        data={data}
        onUpdate={update}
        onEmpty={() => onRemoveEmpty(id)}
        editRequest={editRequest}
      />
    );
  }
  if (isImageData(type, data)) return <ImageCard data={data} onUpdate={update} />;
  if (isColorData(type, data)) return <ColorCard data={data} onUpdate={update} />;
  if (isLinkData(type, data)) return <LinkCard data={data} />;
  if (isFileData(type, data)) return <FileCard data={data} />;
  if (isTodoData(type, data)) return <TodoCard data={data} onUpdate={update} />;
  if (isEmbedData(type, data)) return <EmbedCard data={data} />;
  return null;
}

/** Color and shape controls in the selected object's floating toolbar. */
function ObjectControls({
  item,
  onUpdateItem,
}: {
  item: MoodboardItemClient;
  onUpdateItem: (id: string, data: MoodboardItemData) => void;
}) {
  const swatch = (color: string, active: boolean, onClick: () => void) => (
    <button
      key={color}
      type="button"
      aria-label={`Color ${color}`}
      aria-pressed={active}
      onClick={onClick}
      className="flex h-9 w-8 items-center justify-center rounded-lg hover:bg-[var(--av2-bg)] focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none"
    >
      <span
        className={`h-5 w-5 rounded-full border border-black/10 ${active ? "ring-2 ring-[var(--av2-accent)] ring-offset-1 ring-offset-[var(--av2-surface)]" : ""}`}
        style={{ backgroundColor: color }}
      />
    </button>
  );

  if (isNoteData(item.type, item.data)) {
    const data: NoteCardData = item.data;
    const current = data.color ?? STICKY_COLORS[0];
    return (
      <>
        {STICKY_COLORS.map((c) =>
          swatch(c, c === current, () => onUpdateItem(item.id, { ...data, color: c })),
        )}
      </>
    );
  }

  if (isShapeData(item.type, item.data)) {
    const data: ShapeCardData = item.data;
    const kinds: { kind: ShapeKind; label: string }[] = [
      { kind: "rect", label: "Square" },
      { kind: "ellipse", label: "Circle" },
      { kind: "diamond", label: "Diamond" },
    ];
    return (
      <>
        {SHAPE_FILLS.map((c) =>
          swatch(c, c === data.fill, () => onUpdateItem(item.id, { ...data, fill: c })),
        )}
        <div aria-hidden className="mx-1 h-5 w-px bg-[var(--av2-border)]" />
        {kinds.map(({ kind, label }) => (
          <button
            key={kind}
            type="button"
            aria-pressed={data.kind === kind}
            onClick={() => onUpdateItem(item.id, { ...data, kind })}
            className={`flex h-9 items-center rounded-lg px-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none ${
              data.kind === kind
                ? "bg-[var(--av2-selected)] text-[var(--av2-link)]"
                : "text-[var(--av2-text)] hover:bg-[var(--av2-bg)]"
            }`}
          >
            {label}
          </button>
        ))}
      </>
    );
  }

  return null;
}

const MemoCardContent = memo(CardContent);

/** Shows one member of a dragged group at its offset. Zero puts it back. */
function moveMember(member: { el: Element; isDrawing: boolean }, dx: number, dy: number) {
  const still = dx === 0 && dy === 0;
  if (member.isDrawing) {
    if (still) member.el.removeAttribute("transform");
    else member.el.setAttribute("transform", `translate(${dx} ${dy})`);
    return;
  }
  const el = member.el as HTMLElement;
  el.style.translate = still ? "" : `${dx}px ${dy}px`;
  el.style.zIndex = still ? "" : "50";
}

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el?.tagName) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

function cardLabel(item: MoodboardItemClient) {
  const names: Record<string, string> = {
    NOTE: "Sticky note",
    SHAPE: "Shape",
    TEXT: "Text",
    IMAGE: "Image",
    COLOR: "Color",
    LINK: "Link",
    FILE: "File",
    TODO: "Checklist",
    EMBED: "Video",
  };
  return names[item.type] ?? "Card";
}

export function BoardCanvas({
  items,
  connections,
  toolMode,
  drawColor,
  drawSize,
  drawOpacity,
  placing,
  readOnly = false,
  isPhone = false,
  keyboardOpen = false,
  hideObjectToolbar = false,
  handleRef,
  onSetToolMode,
  onPlace,
  onPick,
  onCancelPlacing,
  onRemoveEmpty,
  onUpdateItem,
  onDeleteItem,
  onMoveItem,
  onMoveItems,
  onDeleteItems,
  onDuplicateItems,
  onCopyItems,
  onPasteText,
  onPasteLastCopy,
  onAddFiles,
  onResizeItem,
  onAddConnection,
  onDeleteConnection,
  onAddDrawing,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
}: BoardCanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const marqueeRef = useRef<HTMLDivElement>(null);

  const canvas = useCanvasTransform(viewportRef, worldRef, gridRef);
  const overrides = useMemo(() => createCardOverrideStore(), []);

  const [selection, setSelection] = useState<Selection>(null);
  const [arrowSourceId, setArrowSourceId] = useState<string | null>(null);
  const [pendingTarget, setPendingTarget] = useState<{ x: number; y: number } | null>(null);
  const [pendingTargetId, setPendingTargetId] = useState<string | null>(null);
  const [editRequest, setEditRequest] = useState<{ id: string; nonce: number } | null>(null);
  const [prevToolMode, setPrevToolMode] = useState(toolMode);
  const [measuredHeights, setMeasuredHeights] = useState<Map<string, number>>(new Map());
  /** Alignment guides shown while objects are being moved. */
  const [guides, setGuides] = useState<Guide[]>([]);
  const guidesKey = useRef("");

  // Handlers change on every parent render; going through a ref keeps the
  // callbacks stable, so memoized cards don't re-render.
  const latest = useRef({
    items,
    measuredHeights,
    selection,
    toolMode,
    placing,
    readOnly,
    arrowSourceId,
    onSetToolMode,
    onPlace,
    onPick,
    onCancelPlacing,
    onAddConnection,
    onRemoveEmpty,
    onUpdateItem,
    onDeleteItem,
    onMoveItem,
    onMoveItems,
    onDeleteItems,
    onDuplicateItems,
    onCopyItems,
    onPasteText,
    onPasteLastCopy,
    onAddFiles,
    onResizeItem,
    onDeleteConnection,
    onUndo,
    onRedo,
  });
  useLayoutEffect(() => {
    latest.current = {
      items,
      measuredHeights,
      selection,
      toolMode,
      placing,
      readOnly,
      arrowSourceId,
      onSetToolMode,
      onPlace,
      onPick,
      onCancelPlacing,
      onAddConnection,
      onRemoveEmpty,
      onUpdateItem,
      onDeleteItem,
      onMoveItem,
      onMoveItems,
      onDeleteItems,
      onDuplicateItems,
      onCopyItems,
      onPasteText,
      onPasteLastCopy,
      onAddFiles,
      onResizeItem,
      onDeleteConnection,
      onUndo,
      onRedo,
    };
  });

  const updateItem = useCallback(
    (id: string, data: MoodboardItemData) => latest.current.onUpdateItem(id, data),
    [],
  );
  const removeEmpty = useCallback((id: string) => {
    latest.current.onRemoveEmpty(id);
    setSelection(null);
  }, []);
  const deleteCard = useCallback((id: string) => {
    latest.current.onDeleteItem(id);
    setSelection(null);
  }, []);

  const duplicateCard = useCallback((id: string) => {
    latest.current.onDuplicateItems([id]);
  }, []);

  /** One id is an ordinary selection, with that object's own controls. */
  const selectIds = useCallback((ids: string[]) => {
    if (ids.length === 0) setSelection(null);
    else if (ids.length > 1) setSelection({ kind: "multi", ids });
    else {
      const item = latest.current.items.find((i) => i.id === ids[0]);
      setSelection({ kind: item?.type === "DRAWING" ? "drawing" : "card", id: ids[0] });
    }
  }, []);

  const cardItems = useMemo(() => items.filter((i) => i.type !== "DRAWING"), [items]);
  const drawings = useMemo(() => items.filter((i) => i.type === "DRAWING"), [items]);

  // One observer for every card, for the arrows' sake: auto-height cards only
  // know their height once they're in the DOM.
  const resizeObserver = useRef<ResizeObserver | null>(null);
  const registerCard = useCallback((node: HTMLDivElement | null) => {
    if (node) resizeObserver.current?.observe(node);
  }, []);
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      setMeasuredHeights((prev) => {
        let next = prev;
        for (const entry of entries) {
          const el = entry.target as HTMLElement;
          const id = el.dataset.mbCardId;
          const height = el.offsetHeight;
          if (!id || !height || prev.get(id) === height) continue;
          if (next === prev) next = new Map(prev);
          next.set(id, height);
        }
        return next;
      });
    });
    resizeObserver.current = observer;
    // Cards rendered before this effect ran have already called registerCard.
    viewportRef.current
      ?.querySelectorAll("[data-mb-card-id]")
      .forEach((card) => observer.observe(card));
    return () => {
      observer.disconnect();
      resizeObserver.current = null;
    };
  }, []);

  const enrichedCardItems = useMemo(
    () =>
      cardItems.map((item) => {
        if (item.height > 0) return item;
        const measured = measuredHeights.get(item.id);
        return measured ? { ...item, height: measured } : item;
      }),
    [cardItems, measuredHeights],
  );

  // Reset transient state when the tool changes.
  if (prevToolMode !== toolMode) {
    setPrevToolMode(toolMode);
    if (toolMode !== "arrow") {
      setArrowSourceId(null);
      setPendingTarget(null);
      setPendingTargetId(null);
    }
    if (toolMode !== "select") setSelection(null);
  }

  useEffect(() => {
    if (!keyboardOpen || selection?.kind !== "card") return;
    const frame = requestAnimationFrame(() => {
      const viewport = viewportRef.current?.getBoundingClientRect();
      const card = viewportRef.current
        ?.querySelector(`[data-mb-card-id="${selection.id}"]`)
        ?.getBoundingClientRect();
      if (!viewport || !card) return;
      // Up far enough to clear the keyboard, but never under the floating header.
      const overflow = card.bottom - viewport.bottom + 16;
      if (overflow <= 0) return;
      const shift = Math.max(-overflow, viewport.top + 72 - card.top);
      const current = canvas.getTransform();
      if (shift) canvas.animateTo({ ...current, panY: current.panY + shift });
    });
    return () => cancelAnimationFrame(frame);
  }, [keyboardOpen, selection, canvas]);

  // Fit once, on opening. This is a passive effect because the page sets the
  // canvas height in its own layout effect, which runs after a child's. A board
  // that opens empty stays put, so the first card lands where it's placed.
  const didInitialFit = useRef(false);
  useEffect(() => {
    if (didInitialFit.current) return;
    const size = viewportRef.current?.getBoundingClientRect();
    if (!size?.width || !size.height) return;
    didInitialFit.current = true;
    if (items.length > 0) canvas.fit(items);
    if (worldRef.current) worldRef.current.style.visibility = "";
  }, [items, canvas]);

  useEffect(() => {
    if (!handleRef) return;
    handleRef.current = {
      viewCenter: canvas.viewCenter,
      clientToCanvas: (clientX, clientY) => {
        const rect = viewportRef.current?.getBoundingClientRect();
        if (
          !rect ||
          clientX < rect.left ||
          clientX > rect.right ||
          clientY < rect.top ||
          clientY > rect.bottom
        ) {
          return null;
        }
        const { panX, panY, zoom } = canvas.getTransform();
        return { x: (clientX - rect.left - panX) / zoom, y: (clientY - rect.top - panY) / zoom };
      },
      selectCard: (id, options) => {
        onSetToolMode("select");
        setSelection({ kind: "card", id });
        if (options?.edit) setEditRequest({ id, nonce: Date.now() });
      },
      selectItems: (ids) => {
        onSetToolMode("select");
        selectIds(ids);
      },
      clearSelection: () => setSelection(null),
    };
    return () => {
      handleRef.current = null;
    };
  }, [handleRef, canvas, onSetToolMode, selectIds]);

  // ---------------------------------------------------------------------------
  // Gestures
  // ---------------------------------------------------------------------------

  const gesture = useRef<Gesture | null>(null);
  const spaceHeld = useRef(false);
  const suppressClick = useRef(false);
  const pasteSeen = useRef(false);
  /** Last mouse position over the board, so a pasted screenshot lands there. */
  const hoverClient = useRef<{ x: number; y: number } | null>(null);
  const [dropActive, setDropActive] = useState(false);

  /** A screen point as canvas units, or null when it's outside the board. */
  const toCanvas = useCallback(
    (clientX: number, clientY: number) => {
      const rect = viewportRef.current?.getBoundingClientRect();
      if (
        !rect ||
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      ) {
        return null;
      }
      const { panX, panY, zoom } = canvas.getTransform();
      return { x: (clientX - rect.left - panX) / zoom, y: (clientY - rect.top - panY) / zoom };
    },
    [canvas],
  );
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const frame = useRef<number | null>(null);

  const setCursor = useCallback((cursor: string) => {
    if (viewportRef.current) viewportRef.current.style.cursor = cursor;
  }, []);

  const idleCursor = useCallback(() => {
    if (spaceHeld.current) return "grab";
    if (latest.current.placing) return "crosshair";
    const mode = latest.current.toolMode;
    if (mode === "hand") return "grab";
    if (mode === "arrow" || mode === "draw") return "crosshair";
    if (mode === "eraser") return "none";
    return "default";
  }, []);

  useEffect(() => {
    setCursor(idleCursor());
  }, [toolMode, placing, setCursor, idleCursor]);

  const startPan = useCallback(
    (e: React.PointerEvent) => {
      const { panX, panY } = canvas.getTransform();
      gesture.current = {
        kind: "pan",
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        panX,
        panY,
      };
    },
    [canvas],
  );

  /** Abandon a card gesture, as when a second finger turns it into a pinch. */
  const cancelCardGesture = useCallback(() => {
    guidesKey.current = "";
    setGuides([]);
    const g = gesture.current;
    if (g?.kind === "group") {
      for (const member of g.members) moveMember(member, 0, 0);
      overrides.set(null);
      return;
    }
    if (g?.kind === "marquee" && marqueeRef.current) marqueeRef.current.style.display = "none";
    if (!g || (g.kind !== "card" && g.kind !== "resize")) return;
    g.el.style.translate = "";
    g.el.style.zIndex = "";
    if (g.kind === "resize") {
      g.el.style.left = `${g.origin.x}px`;
      g.el.style.top = `${g.origin.y}px`;
      g.el.style.width = `${g.origin.width}px`;
      const original = latest.current.items.find((i) => i.id === g.id);
      g.el.style.height = original && original.height > 0 ? `${original.height}px` : "";
    }
    overrides.set(null);
  }, [overrides]);

  const onPointerDownCapture = (e: React.PointerEvent<HTMLDivElement>) => {
    suppressClick.current = false;

    if (e.pointerType === "touch") {
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.current.size === 2) {
        cancelCardGesture();
        const [a, b] = [...touches.current.values()];
        const rect = viewportRef.current!.getBoundingClientRect();
        gesture.current = {
          kind: "pinch",
          distance: Math.hypot(a.x - b.x, a.y - b.y),
          centerX: (a.x + b.x) / 2 - rect.left,
          centerY: (a.y + b.y) / 2 - rect.top,
        };
        suppressClick.current = true;
        e.stopPropagation();
        return;
      }
    }

    // Middle button or space + drag moves the canvas from anywhere, even over a card.
    if (e.button === 1 || (e.button === 0 && spaceHeld.current)) {
      e.preventDefault();
      e.stopPropagation();
      startPan(e);
      setCursor("grabbing");
    }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || gesture.current) return;
    const target = e.target as Element;
    const mode = latest.current.toolMode;

    if (target.closest("[data-mb-canvas-ui], [data-mb-card-toolbar]")) return;

    // Viewers can only move around. A link still opens, unless the press became a pan.
    if (latest.current.readOnly) {
      startPan(e);
      return;
    }

    const placingKind = latest.current.placing;
    if (placingKind) {
      const rect = viewportRef.current!.getBoundingClientRect();
      const { panX, panY, zoom } = canvas.getTransform();
      latest.current.onPlace(placingKind, {
        x: (e.clientX - rect.left - panX) / zoom,
        y: (e.clientY - rect.top - panY) / zoom,
      });
      suppressClick.current = true;
      return;
    }

    if (mode === "hand") {
      startPan(e);
      setCursor("grabbing");
      return;
    }

    const cardEl = target.closest<HTMLElement>("[data-mb-card-id]");

    const beginConnect = (sourceId: string) => {
      suppressClick.current = true;
      setArrowSourceId(sourceId);
      gesture.current = {
        kind: "connect",
        pointerId: e.pointerId,
        sourceId,
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
      };
    };

    // Pulling a dot on a selected object's edge starts an arrow from it.
    const connector = target.closest("[data-mb-connector]");
    if (connector && cardEl?.dataset.mbCardId) {
      e.stopPropagation();
      beginConnect(cardEl.dataset.mbCardId);
      return;
    }

    if (mode === "arrow" && cardEl?.dataset.mbCardId) {
      beginConnect(latest.current.arrowSourceId ?? cardEl.dataset.mbCardId);
      return;
    }

    /** Starts moving everything selected, or just this object if it's on its own. */
    const beginGroup = (clickedId: string, ids: string[]) => {
      const members = ids.flatMap((id) => {
        const item = latest.current.items.find((i) => i.id === id);
        const isDrawing = item?.type === "DRAWING";
        const el = viewportRef.current?.querySelector(
          isDrawing ? `[data-mb-drawing-group="${id}"]` : `[data-mb-card-id="${id}"]`,
        );
        return item && el ? [{ id, el, isDrawing, x: item.x, y: item.y }] : [];
      });
      gesture.current = {
        kind: "group",
        pointerId: e.pointerId,
        clickedId,
        members,
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
      };
    };

    /** Shift adds an object to the selection, or takes it back out. */
    const toggle = (id: string) => {
      const ids = selectedItemIds(latest.current.selection);
      selectIds(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
      suppressClick.current = true;
    };

    const drawingId = target.closest("[data-mb-drawing-id]")?.getAttribute("data-mb-drawing-id");
    if (!cardEl && drawingId && mode === "select") {
      if (e.shiftKey) {
        toggle(drawingId);
        return;
      }
      const chosen = selectedItemIds(latest.current.selection);
      if (chosen.includes(drawingId)) {
        beginGroup(drawingId, chosen);
      } else {
        setSelection({ kind: "drawing", id: drawingId });
        beginGroup(drawingId, [drawingId]);
      }
      return;
    }

    if (!cardEl) {
      if (mode === "arrow") {
        setArrowSourceId(null);
        setPendingTarget(null);
        setPendingTargetId(null);
      }
      const base = e.shiftKey ? selectedItemIds(latest.current.selection) : [];
      if (!e.shiftKey) setSelection(null);
      (document.activeElement as HTMLElement | null)?.blur?.();
      // A finger moves the canvas; a mouse draws a box, and moves it with Space or the Hand.
      if (mode === "select" && e.pointerType !== "touch") {
        gesture.current = {
          kind: "marquee",
          pointerId: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          base,
          moved: false,
        };
        return;
      }
      startPan(e);
      return;
    }

    if (mode !== "select") return;

    const id = cardEl.dataset.mbCardId!;
    const item = latest.current.items.find((i) => i.id === id);
    if (!item) return;

    if (e.shiftKey) {
      toggle(id);
      return;
    }

    const selected = latest.current.selection;
    if (selected?.kind === "multi" && selected.ids.includes(id)) {
      beginGroup(id, selected.ids);
      return;
    }

    const handle = target.closest<HTMLElement>("[data-mb-handle]");
    if (handle) {
      e.stopPropagation();
      const origin = {
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height || cardEl.offsetHeight,
      };
      gesture.current = {
        kind: "resize",
        pointerId: e.pointerId,
        id,
        el: cardEl,
        corner: handle.dataset.mbHandle as ResizeCorner,
        startX: e.clientX,
        startY: e.clientY,
        origin,
        next: origin,
      };
      return;
    }

    const current = latest.current.selection;
    const wasSelected = current?.kind === "card" && current.id === id;
    setSelection({ kind: "card", id });

    if (target.closest(INTERACTIVE)) return;

    gesture.current = {
      kind: "card",
      pointerId: e.pointerId,
      id,
      el: cardEl,
      startX: e.clientX,
      startY: e.clientY,
      origin: { x: item.x, y: item.y },
      moved: false,
      wasSelected,
      dx: 0,
      dy: 0,
    };
  };

  // Writes the latest pointer state to the DOM, at most once per frame.
  const pointer = useRef({ x: 0, y: 0, free: false });

  const showGuides = useCallback((next: Guide[]) => {
    const key = next.map((g) => `${g.axis}${g.at}:${g.from}-${g.to}`).join("|");
    if (key === guidesKey.current) return;
    guidesKey.current = key;
    setGuides(next);
  }, []);

  /**
   * Where a moved card or group lands for this pointer position, in canvas
   * units: the pointer's travel, lined up with nearby objects unless Ctrl or
   * Cmd is held (free).
   */
  const dragOffset = useCallback(
    (ids: string[], startX: number, startY: number, x: number, y: number, free: boolean) => {
      const { zoom } = canvas.getTransform();
      const dx = (x - startX) / zoom;
      const dy = (y - startY) / zoom;
      if (free) return { dx, dy, guides: [] as Guide[] };
      const { items: all, measuredHeights: heights } = latest.current;
      const boxOf = (i: (typeof all)[number]): Box => ({
        x: i.x,
        y: i.y,
        width: i.width,
        height: i.height || heights.get(i.id) || 100,
      });
      const moving = unionBox(all.filter((i) => ids.includes(i.id)).map(boxOf));
      if (!moving) return { dx, dy, guides: [] as Guide[] };
      const others = all.filter((i) => !ids.includes(i.id)).map(boxOf);
      const snap = snapBox(
        { ...moving, x: moving.x + dx, y: moving.y + dy },
        others,
        SNAP_SCREEN_PX / zoom,
      );
      return { dx: dx + snap.dx, dy: dy + snap.dy, guides: snap.guides };
    },
    [canvas],
  );
  /** The object under this spot on screen, other than the arrow's own source. */
  const objectAt = useCallback((clientX: number, clientY: number, sourceId: string | null) => {
    const el = document.elementFromPoint(clientX, clientY);
    const id = el?.closest<HTMLElement>("[data-mb-card-id]")?.dataset.mbCardId ?? null;
    return id && id !== sourceId ? id : null;
  }, []);

  const updatePendingArrow = useCallback(
    (clientX: number, clientY: number, sourceId: string) => {
      if (!viewportRef.current) return;
      const rect = viewportRef.current.getBoundingClientRect();
      const { panX, panY, zoom } = canvas.getTransform();
      setPendingTarget({
        x: (clientX - rect.left - panX) / zoom,
        y: (clientY - rect.top - panY) / zoom,
      });
      setPendingTargetId(objectAt(clientX, clientY, sourceId));
    },
    [canvas, objectAt],
  );

  const paintGesture = useCallback(() => {
    frame.current = null;
    const g = gesture.current;
    if (!g) return;
    const { x, y } = pointer.current;
    const { zoom } = canvas.getTransform();

    if (g.kind === "connect") {
      updatePendingArrow(x, y, g.sourceId);
      return;
    }

    if (g.kind === "pan") {
      canvas.setTransform({
        panX: g.panX + (x - g.startX),
        panY: g.panY + (y - g.startY),
        zoom,
      });
    } else if (g.kind === "card" && g.moved) {
      const at = dragOffset([g.id], g.startX, g.startY, x, y, pointer.current.free);
      g.dx = at.dx;
      g.dy = at.dy;
      showGuides(at.guides);
      g.el.style.translate = `${g.dx}px ${g.dy}px`;
      overrides.set([{ id: g.id, x: g.origin.x + g.dx, y: g.origin.y + g.dy }]);
    } else if (g.kind === "group" && g.moved) {
      const at = dragOffset(
        g.members.map((m) => m.id),
        g.startX,
        g.startY,
        x,
        y,
        pointer.current.free,
      );
      const { dx, dy } = at;
      showGuides(at.guides);
      for (const member of g.members) moveMember(member, dx, dy);
      overrides.set(g.members.map((m) => ({ id: m.id, x: m.x + dx, y: m.y + dy })));
    } else if (g.kind === "marquee" && g.moved) {
      const box = marqueeRef.current;
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!box || !rect) return;
      const left = Math.min(x, g.startX) - rect.left;
      const top = Math.min(y, g.startY) - rect.top;
      const width = Math.abs(x - g.startX);
      const height = Math.abs(y - g.startY);
      box.style.display = "block";
      box.style.left = `${left}px`;
      box.style.top = `${top}px`;
      box.style.width = `${width}px`;
      box.style.height = `${height}px`;

      const { panX, panY } = canvas.getTransform();
      const area = {
        x: (left - panX) / zoom,
        y: (top - panY) / zoom,
        width: width / zoom,
        height: height / zoom,
      };
      const { items: all, measuredHeights: heights, selection: now } = latest.current;
      const hits = all
        .filter((i) =>
          rectsIntersect(area, {
            x: i.x,
            y: i.y,
            width: i.width,
            height: i.height || heights.get(i.id) || 100,
          }),
        )
        .map((i) => i.id);
      const next = [...new Set([...g.base, ...hits])];
      if (next.join() !== selectedItemIds(now).join()) selectIds(next);
    } else if (g.kind === "resize") {
      const next = resizeFromCorner(
        g.origin,
        g.corner,
        (x - g.startX) / zoom,
        (y - g.startY) / zoom,
        MIN_WIDTH,
        MIN_HEIGHT,
      );
      g.next = next;
      g.el.style.left = `${next.x}px`;
      g.el.style.top = `${next.y}px`;
      g.el.style.width = `${next.width}px`;
      g.el.style.height = `${next.height}px`;
      overrides.set([{ id: g.id, x: next.x, y: next.y, width: next.width, height: next.height }]);
    }
  }, [canvas, dragOffset, overrides, selectIds, showGuides, updatePendingArrow]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch" && touches.current.has(e.pointerId)) {
        touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }

      const g = gesture.current;
      if (!g) return;

      if (g.kind === "pinch") {
        if (touches.current.size < 2) return;
        const [a, b] = [...touches.current.values()];
        const rect = viewportRef.current!.getBoundingClientRect();
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        const centerX = (a.x + b.x) / 2 - rect.left;
        const centerY = (a.y + b.y) / 2 - rect.top;
        const current = canvas.getTransform();
        const zoomed = zoomAtPoint(
          current,
          current.zoom * (distance / g.distance),
          centerX,
          centerY,
        );
        canvas.setTransform({
          ...zoomed,
          panX: zoomed.panX + (centerX - g.centerX),
          panY: zoomed.panY + (centerY - g.centerY),
        });
        g.distance = distance;
        g.centerX = centerX;
        g.centerY = centerY;
        return;
      }

      if (e.pointerId !== g.pointerId) return;
      pointer.current = { x: e.clientX, y: e.clientY, free: e.ctrlKey || e.metaKey };

      if (g.kind === "connect" && !g.moved) {
        if (Math.hypot(e.clientX - g.startX, e.clientY - g.startY) < DRAG_THRESHOLD) return;
        g.moved = true;
      }

      if (g.kind === "card" && !g.moved) {
        if (Math.hypot(e.clientX - g.startX, e.clientY - g.startY) < DRAG_THRESHOLD) return;
        g.moved = true;
        g.el.style.zIndex = "50";
        setCursor("grabbing");
      }
      if (g.kind === "group" && !g.moved) {
        if (Math.hypot(e.clientX - g.startX, e.clientY - g.startY) < DRAG_THRESHOLD) return;
        g.moved = true;
        setCursor("grabbing");
      }
      if (g.kind === "marquee" && !g.moved) {
        if (Math.hypot(e.clientX - g.startX, e.clientY - g.startY) < DRAG_THRESHOLD) return;
        g.moved = true;
        suppressClick.current = true;
      }
      if (
        g.kind === "pan" &&
        Math.hypot(e.clientX - g.startX, e.clientY - g.startY) >= DRAG_THRESHOLD
      ) {
        suppressClick.current = true;
        setCursor("grabbing");
      }

      if (frame.current === null) frame.current = requestAnimationFrame(paintGesture);
    };

    const onEnd = (e: PointerEvent) => {
      touches.current.delete(e.pointerId);
      const g = gesture.current;
      if (!g) return;

      if (g.kind === "pinch") {
        if (touches.current.size < 2) gesture.current = null;
        return;
      }
      if (e.pointerId !== g.pointerId) return;

      gesture.current = null;
      if (frame.current !== null) {
        cancelAnimationFrame(frame.current);
        frame.current = null;
      }
      setCursor(idleCursor());
      showGuides([]);

      if (e.type === "pointercancel") {
        gesture.current = g;
        cancelCardGesture();
        gesture.current = null;
        return;
      }

      if (g.kind === "connect") {
        const targetId = objectAt(e.clientX, e.clientY, g.sourceId);
        if (targetId) {
          latest.current.onAddConnection(g.sourceId, targetId);
          setArrowSourceId(null);
          setPendingTarget(null);
          setPendingTargetId(null);
          latest.current.onSetToolMode("select");
        } else if (!g.moved && latest.current.toolMode === "arrow") {
          // A click with the Arrow tool picks the start; the next click picks the end.
          updatePendingArrow(e.clientX, e.clientY, g.sourceId);
        } else {
          setArrowSourceId(null);
          setPendingTarget(null);
          setPendingTargetId(null);
        }
        return;
      }

      if (g.kind === "marquee") {
        if (marqueeRef.current) marqueeRef.current.style.display = "none";
        return;
      }

      if (g.kind === "group") {
        if (!g.moved) {
          // A plain click on one of several narrows the selection to it.
          if (g.members.length > 1) {
            selectIds([g.clickedId]);
            suppressClick.current = true;
          }
          return;
        }
        suppressClick.current = true;
        const at = dragOffset(
          g.members.map((m) => m.id),
          g.startX,
          g.startY,
          e.clientX,
          e.clientY,
          e.ctrlKey || e.metaKey,
        );
        const dx = Math.round(at.dx);
        const dy = Math.round(at.dy);
        for (const member of g.members) {
          moveMember(member, 0, 0);
          if (!member.isDrawing) {
            (member.el as HTMLElement).style.left = `${member.x + dx}px`;
            (member.el as HTMLElement).style.top = `${member.y + dy}px`;
          }
        }
        latest.current.onMoveItems(g.members.map((m) => ({ id: m.id, x: m.x + dx, y: m.y + dy })));
        overrides.set(null);
        return;
      }

      if (g.kind === "card") {
        if (!g.moved) {
          // First click selects; only a click on a selected card reaches its content.
          suppressClick.current = !g.wasSelected;
          return;
        }
        suppressClick.current = true;
        const at = dragOffset(
          [g.id],
          g.startX,
          g.startY,
          e.clientX,
          e.clientY,
          e.ctrlKey || e.metaKey,
        );
        const x = Math.round(g.origin.x + at.dx);
        const y = Math.round(g.origin.y + at.dy);
        // Cleared here and committed in the same tick, so nothing paints in between.
        g.el.style.translate = "";
        g.el.style.zIndex = "";
        g.el.style.left = `${x}px`;
        g.el.style.top = `${y}px`;
        latest.current.onMoveItem(g.id, x, y);
        overrides.set(null);
      } else if (g.kind === "resize") {
        suppressClick.current = true;
        const { x, y, width, height } = g.next;
        if (
          x !== g.origin.x ||
          y !== g.origin.y ||
          width !== g.origin.width ||
          height !== g.origin.height
        ) {
          latest.current.onResizeItem(
            g.id,
            Math.round(x),
            Math.round(y),
            Math.round(width),
            Math.round(height),
          );
        }
        overrides.set(null);
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
    };
  }, [
    canvas,
    cancelCardGesture,
    dragOffset,
    idleCursor,
    objectAt,
    overrides,
    paintGesture,
    selectIds,
    setCursor,
    showGuides,
    updatePendingArrow,
  ]);

  // Swallows the click that ends a drag, or the first click that only selects.
  const onClickCapture = (e: React.MouseEvent) => {
    if (!suppressClick.current) return;
    suppressClick.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  // ---------------------------------------------------------------------------
  // Keyboard
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;

      // These replace the browser's page zoom, wherever focus is.
      if (mod && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        canvas.zoomIn();
        return;
      }
      if (mod && e.key === "-") {
        e.preventDefault();
        canvas.zoomOut();
        return;
      }
      if (mod && e.key === "0") {
        e.preventDefault();
        canvas.resetZoom();
        return;
      }

      if (isTyping(e.target) || document.querySelector('[role="dialog"]')) return;

      if (e.code === "Space") {
        e.preventDefault();
        if (!e.repeat) {
          spaceHeld.current = true;
          setCursor("grab");
        }
        return;
      }

      if (latest.current.readOnly) {
        if (e.shiftKey && e.code === "Digit1") {
          e.preventDefault();
          canvas.fit(latest.current.items, { animate: true });
        }
        return;
      }

      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) latest.current.onRedo();
        else latest.current.onUndo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        latest.current.onRedo();
        return;
      }
      if (mod && e.key.toLowerCase() === "a") {
        e.preventDefault();
        latest.current.onSetToolMode("select");
        selectIds(latest.current.items.map((i) => i.id));
        return;
      }
      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        const ids = selectedItemIds(latest.current.selection);
        if (ids.length > 0) latest.current.onDuplicateItems(ids);
        return;
      }
      if (mod && e.key.toLowerCase() === "v") {
        // The paste event below handles it where the browser sends one.
        pasteSeen.current = false;
        setTimeout(() => {
          if (!pasteSeen.current) latest.current.onPasteLastCopy();
        }, PASTE_FALLBACK_MS);
        return;
      }
      if (mod && e.key.toLowerCase() === "c") {
        const ids = selectedItemIds(latest.current.selection);
        if (ids.length > 0) latest.current.onCopyItems(ids);
        return;
      }
      if (e.shiftKey && e.code === "Digit1") {
        e.preventDefault();
        canvas.fit(latest.current.items, { animate: true });
        return;
      }

      const current = latest.current.selection;

      if (e.key === "Enter" && current?.kind === "card") {
        e.preventDefault();
        setEditRequest({ id: current.id, nonce: Date.now() });
        return;
      }

      if (e.key === "Escape") {
        setSelection(null);
        setArrowSourceId(null);
        setPendingTarget(null);
        setPendingTargetId(null);
        latest.current.onCancelPlacing();
        if (latest.current.toolMode !== "select") latest.current.onSetToolMode("select");
        return;
      }

      if ((e.key === "Delete" || e.key === "Backspace") && current) {
        e.preventDefault();
        if (current.kind === "connection") latest.current.onDeleteConnection(current.id);
        else if (current.kind === "multi") latest.current.onDeleteItems(current.ids);
        else latest.current.onDeleteItem(current.id);
        setSelection(null);
        return;
      }

      const nudged = selectedItemIds(current);
      if (nudged.length > 0 && e.key.startsWith("Arrow")) {
        e.preventDefault();
        const step = e.shiftKey ? NUDGE_LARGE_PX : NUDGE_PX;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        latest.current.onMoveItems(
          latest.current.items
            .filter((i) => nudged.includes(i.id))
            .map((i) => ({ id: i.id, x: i.x + dx, y: i.y + dy })),
          { nudge: true },
        );
        return;
      }

      if (mod || e.altKey) return;
      const key = e.key.toLowerCase();
      const tools: Record<string, ToolMode> = {
        v: "select",
        h: "hand",
        l: "arrow",
        m: "draw",
        e: "eraser",
      };
      const creators: Record<string, CreatableKind> = { s: "note", r: "shape", t: "text" };
      if (tools[key]) {
        latest.current.onCancelPlacing();
        latest.current.onSetToolMode(tools[key]);
      } else if (creators[key]) {
        latest.current.onPick(creators[key]);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      spaceHeld.current = false;
      setCursor(idleCursor());
    };

    // Copying through these events reaches other tabs, and needs no permission.
    const boardHasFocus = (e: Event) =>
      !isTyping(e.target) && !document.querySelector('[role="dialog"]') && !latest.current.readOnly;

    const onCopy = (e: ClipboardEvent) => {
      if (!boardHasFocus(e)) return;
      const ids = selectedItemIds(latest.current.selection);
      if (ids.length === 0) return;
      e.clipboardData?.setData("text/plain", latest.current.onCopyItems(ids));
      e.preventDefault();
    };
    const onCut = (e: ClipboardEvent) => {
      onCopy(e);
      if (!boardHasFocus(e)) return;
      const ids = selectedItemIds(latest.current.selection);
      if (ids.length === 0) return;
      latest.current.onDeleteItems(ids);
      setSelection(null);
    };
    const onPaste = (e: ClipboardEvent) => {
      pasteSeen.current = true;
      if (!boardHasFocus(e)) return;
      if (latest.current.onPasteText(e.clipboardData?.getData("text/plain") ?? null)) {
        e.preventDefault();
        return;
      }
      // A screenshot or copied file lands where the mouse is, or mid-screen.
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.length > 0) {
        e.preventDefault();
        const at = hoverClient.current
          ? toCanvas(hoverClient.current.x, hoverClient.current.y)
          : null;
        latest.current.onAddFiles(files, at);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("copy", onCopy);
    window.addEventListener("cut", onCut);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("copy", onCopy);
      window.removeEventListener("cut", onCut);
      window.removeEventListener("paste", onPaste);
    };
  }, [canvas, idleCursor, selectIds, setCursor, toCanvas]);

  // ---------------------------------------------------------------------------
  // Arrow tool
  // ---------------------------------------------------------------------------

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    hoverClient.current = { x: e.clientX, y: e.clientY };
    // Only between the two clicks; while dragging, the gesture handles this.
    if (toolMode !== "arrow" || !arrowSourceId || gesture.current) return;
    updatePendingArrow(e.clientX, e.clientY, arrowSourceId);
  };

  const handleFit = useCallback(() => {
    canvas.fit(latest.current.items, { animate: true });
  }, [canvas]);

  // Keyboard focus selects a card. The browser may also scroll this clipped box
  // to reveal the focused card, which would throw off every coordinate.
  const onFocus = (e: React.FocusEvent<HTMLDivElement>) => {
    const el = e.target as HTMLElement;
    const viewport = viewportRef.current;
    if (viewport && (viewport.scrollLeft || viewport.scrollTop)) {
      viewport.scrollLeft = 0;
      viewport.scrollTop = 0;
    }
    if (
      !latest.current.readOnly &&
      el.dataset?.mbCardId &&
      el.matches(":focus-visible") &&
      !selectedItemIds(latest.current.selection).includes(el.dataset.mbCardId)
    ) {
      setSelection({ kind: "card", id: el.dataset.mbCardId });
    }
  };

  const groupIds = useMemo(
    () => new Set(selection?.kind === "multi" ? selection.ids : []),
    [selection],
  );
  const selectConnection = useCallback(
    (id: string) => setSelection({ kind: "connection", id }),
    [],
  );
  const deleteDrawing = useCallback((id: string) => {
    latest.current.onDeleteItem(id);
    setSelection(null);
  }, []);
  const deleteConnection = useCallback((id: string) => {
    latest.current.onDeleteConnection(id);
    setSelection(null);
  }, []);

  return (
    <div
      ref={viewportRef}
      data-testid="moodboard-viewport"
      className={`relative min-h-0 flex-1 overflow-hidden bg-[var(--av2-surface)] select-none [&_input]:select-text [&_textarea]:select-text ${
        readOnly
          ? "[&_[data-mb-card-id]_*]:pointer-events-none [&_[data-mb-card-id]_a]:pointer-events-auto"
          : ""
      }${
        isPhone
          ? "[&_input]:text-base! [&_textarea]:text-base!"
          : "rounded-2xl border border-[var(--av2-border)]"
      }`}
      style={{ touchAction: "none" }}
      onPointerDownCapture={onPointerDownCapture}
      onPointerDown={onPointerDown}
      onClickCapture={onClickCapture}
      onMouseMove={handleMouseMove}
      onFocus={onFocus}
      onDragStart={(e) => e.preventDefault()}
      onMouseLeave={() => {
        hoverClient.current = null;
      }}
      onDragOver={(e) => {
        if (readOnly || !hasFiles(e.dataTransfer)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        if (!dropActive) setDropActive(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropActive(false);
      }}
      onDrop={(e) => {
        if (readOnly || !hasFiles(e.dataTransfer)) return;
        e.preventDefault();
        setDropActive(false);
        latest.current.onAddFiles(Array.from(e.dataTransfer.files), toCanvas(e.clientX, e.clientY));
      }}
    >
      <div
        ref={gridRef}
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(circle, var(--av2-border) 1px, transparent 1px)",
        }}
      />

      <div
        ref={worldRef}
        className="absolute top-0 left-0"
        // Hidden until the first fit, so cards don't flash at the wrong zoom.
        style={{ transformOrigin: "0 0", width: 0, height: 0, visibility: "hidden" }}
      >
        {cardItems.map((item) => (
          <CardWrapper
            key={item.id}
            id={item.id}
            x={item.x}
            y={item.y}
            width={item.width}
            height={item.height}
            selected={selection?.kind === "card" && selection.id === item.id}
            inGroup={groupIds.has(item.id)}
            bare={item.type === "NOTE" || item.type === "SHAPE" || item.type === "TEXT"}
            label={cardLabel(item)}
            registerCard={registerCard}
            toolbar={
              selection?.kind === "card" && selection.id === item.id ? (
                <ObjectControls item={item} onUpdateItem={updateItem} />
              ) : undefined
            }
            hideToolbar={isPhone}
            onDelete={deleteCard}
            onDuplicate={duplicateCard}
          >
            <MemoCardContent
              item={item}
              editRequest={editRequest?.id === item.id ? editRequest.nonce : 0}
              onUpdateItem={updateItem}
              onRemoveEmpty={removeEmpty}
            />
          </CardWrapper>
        ))}

        <DrawingLayer
          drawings={drawings}
          active={toolMode === "draw"}
          eraserActive={toolMode === "eraser"}
          strokeColor={drawColor}
          strokeWidth={drawSize}
          strokeOpacity={drawOpacity}
          getTransform={canvas.getTransform}
          viewportRef={viewportRef}
          onStrokeComplete={onAddDrawing}
          selectedDrawingId={selection?.kind === "drawing" ? selection.id : null}
          highlightedIds={groupIds}
          onDeleteDrawing={
            toolMode === "select" || toolMode === "eraser" ? deleteDrawing : undefined
          }
        />

        <ConnectionLayer
          connections={connections}
          items={enrichedCardItems}
          overrides={overrides}
          selectedId={selection?.kind === "connection" ? selection.id : null}
          interactive={toolMode === "select" && !readOnly}
          onSelectConnection={selectConnection}
          onDeleteConnection={deleteConnection}
          pendingSourceId={arrowSourceId}
          pendingTarget={pendingTarget}
          pendingTargetId={pendingTargetId}
        />

        {guides.map((guide) => (
          <div
            key={`${guide.axis}-${guide.at}`}
            aria-hidden
            data-mb-guide
            className="pointer-events-none absolute z-50 bg-[var(--av2-accent)]"
            style={
              guide.axis === "x"
                ? {
                    left: guide.at,
                    top: guide.from,
                    height: guide.to - guide.from,
                    width: "calc(1px * var(--mb-inverse-zoom, 1))",
                    translate: "-50% 0",
                  }
                : {
                    top: guide.at,
                    left: guide.from,
                    width: guide.to - guide.from,
                    height: "calc(1px * var(--mb-inverse-zoom, 1))",
                    translate: "0 -50%",
                  }
            }
          />
        ))}

        {enrichedCardItems
          .filter((item) => item.id === arrowSourceId || item.id === pendingTargetId)
          .map((item) => (
            <div
              key={`arrow-end-${item.id}`}
              aria-hidden
              className="pointer-events-none absolute z-40 rounded-2xl bg-[var(--av2-accent)]/10"
              style={{
                left: item.x,
                top: item.y,
                width: item.width,
                height: item.height || 200,
                boxShadow: "0 0 0 calc(2px * var(--mb-inverse-zoom, 1)) var(--av2-accent)",
              }}
            />
          ))}
      </div>

      {items.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
          <h2 className="text-base font-semibold text-[var(--av2-text)]">
            Your moodboard is empty
          </h2>
          <p className="mt-1 text-sm text-[var(--av2-text-2)]">
            {readOnly
              ? "Nothing has been added yet."
              : "Drag something from the toolbar below, or click one and then click here."}
          </p>
        </div>
      )}

      {dropActive && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-3 z-40 flex items-center justify-center rounded-2xl border-2 border-dashed border-[var(--av2-accent)] bg-[var(--av2-accent)]/5"
        >
          <span className="rounded-full bg-[var(--av2-surface)] px-4 py-2 text-sm font-semibold shadow-md">
            Drop to add to the board
          </span>
        </div>
      )}

      <div
        ref={marqueeRef}
        aria-hidden
        className="pointer-events-none absolute z-20 rounded-sm border border-[var(--av2-accent)] bg-[var(--av2-accent)]/10"
        style={{ display: "none" }}
      />

      {!keyboardOpen && !hideObjectToolbar && selection?.kind === "multi" && (
        <div
          data-mb-canvas-ui
          className="absolute bottom-[calc(5rem+env(safe-area-inset-bottom))] left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-[var(--av2-border)] bg-[var(--av2-surface)] p-1 whitespace-nowrap shadow-md"
        >
          <span role="status" className="px-3 text-sm font-medium text-[var(--av2-text)]">
            {selection.ids.length} selected
          </span>
          <div aria-hidden className="mx-1 h-5 w-px bg-[var(--av2-border)]" />
          <button
            type="button"
            onClick={() => latest.current.onDuplicateItems(selection.ids)}
            className="flex h-9 items-center rounded-lg px-3 text-sm font-medium text-[var(--av2-text)] hover:bg-[var(--av2-bg)] focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none"
          >
            Duplicate
          </button>
          <button
            type="button"
            onClick={() => {
              latest.current.onDeleteItems(selection.ids);
              setSelection(null);
            }}
            className="flex h-9 items-center rounded-lg px-3 text-sm font-medium text-[var(--av2-error-text)] hover:bg-[var(--av2-bg)] focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none"
          >
            Delete
          </button>
        </div>
      )}

      {isPhone &&
        !keyboardOpen &&
        !hideObjectToolbar &&
        selection?.kind === "card" &&
        (() => {
          const item = cardItems.find((i) => i.id === selection.id);
          if (!item) return null;
          return (
            <div
              data-mb-canvas-ui
              className="absolute bottom-[calc(5rem+env(safe-area-inset-bottom))] left-1/2 z-30 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-xl border border-[var(--av2-border)] bg-[var(--av2-surface)] p-1 whitespace-nowrap shadow-md [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <ObjectControls item={item} onUpdateItem={updateItem} />
              <button
                type="button"
                onClick={() => duplicateCard(item.id)}
                aria-label={`Duplicate ${cardLabel(item)}`}
                className="flex h-9 shrink-0 items-center rounded-lg px-3 text-sm font-medium text-[var(--av2-text)]"
              >
                Duplicate
              </button>
              <button
                type="button"
                onClick={() => deleteCard(item.id)}
                aria-label={`Delete ${cardLabel(item)}`}
                className="flex h-9 shrink-0 items-center rounded-lg px-3 text-sm font-medium text-[var(--av2-error-text)]"
              >
                Delete
              </button>
            </div>
          );
        })()}

      <div data-mb-canvas-ui>
        {!keyboardOpen && (
          <CanvasControls
            canvas={canvas}
            onFitToContent={handleFit}
            hasItems={items.length > 0}
            history={readOnly ? undefined : { canUndo, canRedo, onUndo, onRedo }}
          />
        )}
      </div>
    </div>
  );
}
