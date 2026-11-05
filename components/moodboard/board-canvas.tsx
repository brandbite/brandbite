"use client";

// -----------------------------------------------------------------------------
// @file: components/moodboard/board-canvas.tsx
// @purpose: The infinite moodboard canvas. One set of pointer handlers drives
//           panning, pinching, and moving and resizing cards. During a gesture
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
import { useCanvasTransform } from "@/components/moodboard/use-canvas-transform";
import type { ToolMode } from "@/components/moodboard/board-toolbar";
import type {
  DrawingCardData,
  MoodboardConnection,
  MoodboardItemClient,
  MoodboardItemData,
} from "@/lib/moodboard";
import {
  CANVAS_DEFAULTS,
  isColorData,
  isEmbedData,
  isFileData,
  isImageData,
  isLinkData,
  isNoteData,
  isTodoData,
} from "@/lib/moodboard";

import { resizeFromCorner, zoomAtPoint, type CanvasRect } from "./canvas-math";
import { createCardOverrideStore } from "./card-override-store";

const { MIN_WIDTH, MIN_HEIGHT } = CANVAS_DEFAULTS;

/** Pointer travel before a press becomes a drag, in screen pixels. */
const DRAG_THRESHOLD = 4;
const NUDGE_PX = 10;
const NUDGE_LARGE_PX = 50;
/** These keep their own click and typing behaviour inside a card. */
const INTERACTIVE = "input, textarea, select, button, iframe";

export type Selection = { kind: "card" | "drawing" | "connection"; id: string } | null;

export type BoardCanvasHandle = {
  viewCenter: () => { x: number; y: number };
  selectCard: (id: string) => void;
};

type BoardCanvasProps = {
  items: MoodboardItemClient[];
  connections: MoodboardConnection[];
  toolMode: ToolMode;
  drawColor: string;
  drawSize: number;
  handleRef?: React.RefObject<BoardCanvasHandle | null>;
  onSetToolMode: (mode: ToolMode) => void;
  onUpdateItem: (itemId: string, data: MoodboardItemData) => void;
  onDeleteItem: (itemId: string) => void;
  onMoveItem: (itemId: string, x: number, y: number) => void;
  onResizeItem: (itemId: string, x: number, y: number, width: number, height: number) => void;
  onAddConnection: (sourceId: string, targetId: string) => void;
  onDeleteConnection: (id: string) => void;
  onAddDrawing: (
    data: DrawingCardData,
    bounds: { x: number; y: number; w: number; h: number },
  ) => void;
  onUndoDelete: () => void;
};

type Gesture =
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
      dx: number;
      dy: number;
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
  onUpdateItem,
}: {
  item: MoodboardItemClient;
  onUpdateItem: (id: string, data: MoodboardItemData) => void;
}) {
  const { id, type, data } = item;
  const update = (next: MoodboardItemData) => onUpdateItem(id, next);

  if (isNoteData(type, data)) return <NoteCard data={data} onUpdate={update} />;
  if (isImageData(type, data)) return <ImageCard data={data} onUpdate={update} />;
  if (isColorData(type, data)) return <ColorCard data={data} onUpdate={update} />;
  if (isLinkData(type, data)) return <LinkCard data={data} />;
  if (isFileData(type, data)) return <FileCard data={data} />;
  if (isTodoData(type, data)) return <TodoCard data={data} onUpdate={update} />;
  if (isEmbedData(type, data)) return <EmbedCard data={data} />;
  return null;
}

const MemoCardContent = memo(CardContent);

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el?.tagName) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

function cardLabel(item: MoodboardItemClient) {
  const names: Record<string, string> = {
    NOTE: "Note",
    IMAGE: "Image",
    COLOR: "Color",
    LINK: "Link",
  };
  const extra: Record<string, string> = { FILE: "File", TODO: "Checklist", EMBED: "Video" };
  return names[item.type] ?? extra[item.type] ?? "Card";
}

export function BoardCanvas({
  items,
  connections,
  toolMode,
  drawColor,
  drawSize,
  handleRef,
  onSetToolMode,
  onUpdateItem,
  onDeleteItem,
  onMoveItem,
  onResizeItem,
  onAddConnection,
  onDeleteConnection,
  onAddDrawing,
  onUndoDelete,
}: BoardCanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const canvas = useCanvasTransform(viewportRef, worldRef, gridRef);
  const overrides = useMemo(() => createCardOverrideStore(), []);

  const [selection, setSelection] = useState<Selection>(null);
  const [arrowSourceId, setArrowSourceId] = useState<string | null>(null);
  const [pendingTarget, setPendingTarget] = useState<{ x: number; y: number } | null>(null);
  const [prevToolMode, setPrevToolMode] = useState(toolMode);
  const [measuredHeights, setMeasuredHeights] = useState<Map<string, number>>(new Map());

  // Handlers change on every parent render; going through a ref keeps the
  // callbacks stable, so memoized cards don't re-render.
  const latest = useRef({
    items,
    selection,
    toolMode,
    onSetToolMode,
    onUpdateItem,
    onDeleteItem,
    onMoveItem,
    onResizeItem,
    onDeleteConnection,
    onUndoDelete,
  });
  useLayoutEffect(() => {
    latest.current = {
      items,
      selection,
      toolMode,
      onSetToolMode,
      onUpdateItem,
      onDeleteItem,
      onMoveItem,
      onResizeItem,
      onDeleteConnection,
      onUndoDelete,
    };
  });

  const updateItem = useCallback(
    (id: string, data: MoodboardItemData) => latest.current.onUpdateItem(id, data),
    [],
  );
  const deleteCard = useCallback((id: string) => {
    latest.current.onDeleteItem(id);
    setSelection(null);
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
    }
    if (toolMode !== "select") setSelection(null);
  }

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
      selectCard: (id) => {
        onSetToolMode("select");
        setSelection({ kind: "card", id });
      },
    };
    return () => {
      handleRef.current = null;
    };
  }, [handleRef, canvas, onSetToolMode]);

  // ---------------------------------------------------------------------------
  // Gestures
  // ---------------------------------------------------------------------------

  const gesture = useRef<Gesture | null>(null);
  const spaceHeld = useRef(false);
  const suppressClick = useRef(false);
  const touches = useRef(new Map<number, { x: number; y: number }>());
  const frame = useRef<number | null>(null);

  const setCursor = useCallback((cursor: string) => {
    if (viewportRef.current) viewportRef.current.style.cursor = cursor;
  }, []);

  const idleCursor = useCallback(() => {
    if (spaceHeld.current) return "grab";
    const mode = latest.current.toolMode;
    if (mode === "arrow" || mode === "draw") return "crosshair";
    if (mode === "eraser") return "none";
    return "default";
  }, []);

  useEffect(() => {
    setCursor(idleCursor());
  }, [toolMode, setCursor, idleCursor]);

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
    const g = gesture.current;
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

    const cardEl = target.closest<HTMLElement>("[data-mb-card-id]");

    if (!cardEl) {
      if (target.closest("[data-mb-canvas-ui]")) return;
      setSelection(null);
      (document.activeElement as HTMLElement | null)?.blur?.();
      startPan(e);
      return;
    }

    if (mode !== "select") return;

    const id = cardEl.dataset.mbCardId!;
    const item = latest.current.items.find((i) => i.id === id);
    if (!item) return;

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
  const pointer = useRef({ x: 0, y: 0 });
  const paintGesture = useCallback(() => {
    frame.current = null;
    const g = gesture.current;
    if (!g) return;
    const { x, y } = pointer.current;
    const { zoom } = canvas.getTransform();

    if (g.kind === "pan") {
      canvas.setTransform({
        panX: g.panX + (x - g.startX),
        panY: g.panY + (y - g.startY),
        zoom,
      });
    } else if (g.kind === "card" && g.moved) {
      g.dx = (x - g.startX) / zoom;
      g.dy = (y - g.startY) / zoom;
      g.el.style.translate = `${g.dx}px ${g.dy}px`;
      overrides.set({ id: g.id, x: g.origin.x + g.dx, y: g.origin.y + g.dy });
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
      overrides.set({ id: g.id, x: next.x, y: next.y, width: next.width, height: next.height });
    }
  }, [canvas, overrides]);

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
      pointer.current = { x: e.clientX, y: e.clientY };

      if (g.kind === "card" && !g.moved) {
        if (Math.hypot(e.clientX - g.startX, e.clientY - g.startY) < DRAG_THRESHOLD) return;
        g.moved = true;
        g.el.style.zIndex = "50";
        setCursor("grabbing");
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

      if (e.type === "pointercancel") {
        gesture.current = g;
        cancelCardGesture();
        gesture.current = null;
        return;
      }

      if (g.kind === "card") {
        if (!g.moved) {
          // First click selects; only a click on a selected card reaches its content.
          suppressClick.current = !g.wasSelected;
          return;
        }
        suppressClick.current = true;
        const { zoom } = canvas.getTransform();
        const x = Math.round(g.origin.x + (e.clientX - g.startX) / zoom);
        const y = Math.round(g.origin.y + (e.clientY - g.startY) / zoom);
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
  }, [canvas, cancelCardGesture, idleCursor, overrides, paintGesture, setCursor]);

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

      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        latest.current.onUndoDelete();
        return;
      }
      if (e.shiftKey && e.code === "Digit1") {
        e.preventDefault();
        canvas.fit(latest.current.items, { animate: true });
        return;
      }

      const current = latest.current.selection;

      if (e.key === "Escape") {
        setSelection(null);
        setArrowSourceId(null);
        setPendingTarget(null);
        if (latest.current.toolMode !== "select") latest.current.onSetToolMode("select");
        return;
      }

      if ((e.key === "Delete" || e.key === "Backspace") && current) {
        e.preventDefault();
        if (current.kind === "connection") latest.current.onDeleteConnection(current.id);
        else latest.current.onDeleteItem(current.id);
        setSelection(null);
        return;
      }

      if (current?.kind === "card" && e.key.startsWith("Arrow")) {
        const item = latest.current.items.find((i) => i.id === current.id);
        if (!item) return;
        e.preventDefault();
        const step = e.shiftKey ? NUDGE_LARGE_PX : NUDGE_PX;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        latest.current.onMoveItem(current.id, item.x + dx, item.y + dy);
        return;
      }

      if (mod || e.altKey) return;
      const tools: Record<string, ToolMode> = { v: "select", l: "arrow", m: "draw", e: "eraser" };
      const tool = tools[e.key.toLowerCase()];
      if (tool) latest.current.onSetToolMode(tool);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      spaceHeld.current = false;
      setCursor(idleCursor());
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [canvas, idleCursor, setCursor]);

  // ---------------------------------------------------------------------------
  // Arrow tool
  // ---------------------------------------------------------------------------

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (toolMode !== "arrow" || !arrowSourceId || !viewportRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    const { panX, panY, zoom } = canvas.getTransform();
    setPendingTarget({
      x: (e.clientX - rect.left - panX) / zoom,
      y: (e.clientY - rect.top - panY) / zoom,
    });
  };

  function handleArrowCardClick(itemId: string) {
    if (!arrowSourceId) {
      setArrowSourceId(itemId);
    } else if (arrowSourceId !== itemId) {
      onAddConnection(arrowSourceId, itemId);
      setArrowSourceId(null);
      setPendingTarget(null);
    }
  }

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
    if (el.dataset?.mbCardId && el.matches(":focus-visible")) {
      setSelection({ kind: "card", id: el.dataset.mbCardId });
    }
  };

  const selectDrawing = useCallback((id: string) => setSelection({ kind: "drawing", id }), []);
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
      className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-[var(--av2-border)] bg-[var(--av2-surface)] select-none [&_input]:select-text [&_textarea]:select-text"
      style={{ touchAction: "none" }}
      onPointerDownCapture={onPointerDownCapture}
      onPointerDown={onPointerDown}
      onClickCapture={onClickCapture}
      onMouseMove={handleMouseMove}
      onFocus={onFocus}
      onDragStart={(e) => e.preventDefault()}
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
            label={cardLabel(item)}
            registerCard={registerCard}
            onDelete={deleteCard}
          >
            <MemoCardContent item={item} onUpdateItem={updateItem} />
          </CardWrapper>
        ))}

        <DrawingLayer
          drawings={drawings}
          active={toolMode === "draw"}
          eraserActive={toolMode === "eraser"}
          strokeColor={drawColor}
          strokeWidth={drawSize}
          getTransform={canvas.getTransform}
          viewportRef={viewportRef}
          onStrokeComplete={onAddDrawing}
          onSelectDrawing={toolMode === "select" ? selectDrawing : undefined}
          selectedDrawingId={selection?.kind === "drawing" ? selection.id : null}
          onDeleteDrawing={
            toolMode === "select" || toolMode === "eraser" ? deleteDrawing : undefined
          }
        />

        <ConnectionLayer
          connections={connections}
          items={enrichedCardItems}
          overrides={overrides}
          selectedId={selection?.kind === "connection" ? selection.id : null}
          interactive={toolMode === "select"}
          onSelectConnection={selectConnection}
          onDeleteConnection={deleteConnection}
          pendingSourceId={arrowSourceId}
          pendingTarget={pendingTarget}
        />

        {toolMode === "arrow" &&
          enrichedCardItems.map((item) => (
            <div
              key={`arrow-target-${item.id}`}
              className={`absolute rounded-2xl border-2 transition-colors ${
                arrowSourceId === item.id
                  ? "border-[var(--av2-accent)] bg-[var(--av2-accent)]/10"
                  : "border-transparent hover:border-[var(--av2-accent)]/50 hover:bg-[var(--av2-accent)]/5"
              }`}
              style={{
                left: item.x,
                top: item.y,
                width: item.width,
                height: item.height || 200,
                zIndex: 100,
                cursor: "crosshair",
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleArrowCardClick(item.id);
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
            Use the toolbar to add notes, images, colors and more.
          </p>
        </div>
      )}

      <div data-mb-canvas-ui>
        <CanvasControls canvas={canvas} onFitToContent={handleFit} hasItems={items.length > 0} />
      </div>
    </div>
  );
}
