"use client";

import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

import { BoardToolbar } from "@/components/moodboard/board-toolbar";
import { BoardHeader } from "@/components/moodboard/board-header";
import { LinkJobModal } from "@/components/moodboard/link-job-modal";
import { BoardCanvas, type BoardCanvasHandle } from "@/components/moodboard/board-canvas";
import { useIsPhone } from "@/components/moodboard/use-is-phone";
import { useToast } from "@/components/ui/toast-provider";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/upload-helpers";
import { AddLinkModal } from "@/components/moodboard/add-link-modal";
import { AddEmbedModal } from "@/components/moodboard/add-embed-modal";
import {
  buildClipboard,
  diffBoards,
  isEmptyDiff,
  parseClipboard,
  serializeClipboard,
  type BoardClipboard,
  type BoardSnapshot,
} from "@/components/moodboard/board-history";
import { shiftPath } from "@/components/moodboard/canvas-math";
import { nextPosition, restack } from "@/components/moodboard/stacking";
import { exportFileName, type ExportFormat } from "@/components/moodboard/export-board";

import type {
  MoodboardClient,
  MoodboardItemClient,
  MoodboardItemData,
  LinkCardData,
  ImageCardData,
  FileCardData,
  EmbedCardData,
  DrawingCardData,
  MoodboardConnection,
  PenKind,
  ShapeKind,
} from "@/lib/moodboard";
import {
  createConnection,
  defaultTodoData,
  DRAW_COLORS,
  DRAW_SIZES,
  HIGHLIGHTER_DEFAULT_COLOR,
  newClientId,
  PEN_PRESETS,
  SECTION_COLORS,
  SHAPE_FILLS,
  STICKY_COLORS,
} from "@/lib/moodboard";
import type { CreatableKind, ToolMode } from "@/components/moodboard/board-toolbar";

type MoodboardViewProps = {
  moodboardId: string;
  basePath: string;
};

type ModalType = "link" | "embed" | null;

type Point = { x: number; y: number };

/** How long the Undo offer stays on screen after deleting. */
const UNDO_MS = 8000;
const CASCADE_PX = 24;
/** Most files added by one drop or paste. */
const MAX_FILES_AT_ONCE = 10;
const MAX_HISTORY = 100;
/** Repeats of the same small change this close together are one undo step. */
const COALESCE_MS = 1000;

/** Kept outside the page so a copy can be pasted on another board in this tab. */
let lastCopy: BoardClipboard | null = null;

function withShiftedDrawing(item: MoodboardItemClient, x: number, y: number) {
  if (item.type !== "DRAWING") return { x, y };
  const data = item.data as DrawingCardData;
  return { x, y, data: { ...data, pathData: shiftPath(data.pathData, x - item.x, y - item.y) } };
}

/** The middle of the view, stepped diagonally so new cards don't stack exactly. */
function placeNear(
  center: Point,
  items: MoodboardItemClient[],
  width: number,
  height: number,
): Point {
  let x = Math.round(center.x - width / 2);
  let y = Math.round(center.y - (height || 100) / 2);
  while (items.some((i) => Math.abs(i.x - x) < CASCADE_PX && Math.abs(i.y - y) < CASCADE_PX)) {
    x += CASCADE_PX;
    y += CASCADE_PX;
  }
  return { x, y };
}

export function MoodboardView({ moodboardId, basePath }: MoodboardViewProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const isPhone = useIsPhone();
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [jobPickerOpen, setJobPickerOpen] = useState(false);

  const [moodboard, setMoodboard] = useState<MoodboardClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [toolMode, setToolMode] = useState<ToolMode>("select");
  const [drawColor, setDrawColor] = useState<string>(DRAW_COLORS[0]);
  const [drawSize, setDrawSize] = useState<number>(DRAW_SIZES[1]); // 4px default
  const [penKind, setPenKind] = useState<PenKind>("marker");
  const [shapeKind, setShapeKind] = useState<ShapeKind>("rect");
  const [placing, setPlacing] = useState<CreatableKind | null>(null);

  const [deletedCount, setDeletedCount] = useState(0);
  const [historySize, setHistorySize] = useState({ undo: 0, redo: 0 });

  const canvasHandle = useRef<BoardCanvasHandle | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  // New objects appear at once under a temporary id, and that id stays in use on
  // screen. Each server call resolves it first, so editing or moving something
  // that's still being saved just waits its turn.
  const serverIds = useRef(new Map<string, Promise<string>>());
  const serverId = useCallback(
    (id: string) => serverIds.current.get(id) ?? Promise.resolve(id),
    [],
  );
  /**
   * Writes to one object go out in order, so an undo right after a delete can't
   * reach the server first. The arrows have a line of their own.
   */
  const writes = useRef(new Map<string, Promise<unknown>>());
  const enqueue = useCallback(<T,>(key: string, write: () => Promise<T>): Promise<T> => {
    const next = (writes.current.get(key) ?? Promise.resolve()).catch(() => {}).then(write);
    writes.current.set(key, next);
    return next;
  }, []);

  const boardRef = useRef<MoodboardClient | null>(null);
  const past = useRef<BoardSnapshot[]>([]);
  const future = useRef<BoardSnapshot[]>([]);
  const lastRecord = useRef<{ key: string; at: number } | null>(null);
  const pasteCount = useRef(0);

  /** Where the object from a file picker or dialog should land. */
  const pendingPoint = useRef<Point | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---------------------------------------------------------------------------
  // Fetch moodboard
  // ---------------------------------------------------------------------------

  const clearHistory = useCallback(() => {
    past.current = [];
    future.current = [];
    lastRecord.current = null;
    setHistorySize({ undo: 0, redo: 0 });
  }, []);

  /** A fresh copy from the server replaces what's on screen, so history starts over. */
  const fetchMoodboard = useCallback(async () => {
    try {
      const res = await fetch(`/api/moodboards/${moodboardId}`);
      if (!res.ok) throw new Error("Failed to load moodboard");

      const json = await res.json();
      serverIds.current.clear();
      clearHistory();
      setMoodboard(json.moodboard);
    } catch (err) {
      console.error("[moodboard-view] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [moodboardId, clearHistory]);

  useEffect(() => {
    fetchMoodboard();
  }, [fetchMoodboard]);

  // The canvas fills the rest of the window, so the page itself never scrolls and
  // can't compete with the canvas. Measured, because banners change where it starts.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || isPhone) return;
    const fit = () => {
      const top = root.getBoundingClientRect().top + window.scrollY;
      const bottomGap = parseFloat(getComputedStyle(root.parentElement!).paddingBottom) || 0;
      root.style.height = `${Math.max(420, window.innerHeight - top - bottomGap)}px`;
    };
    fit();
    window.addEventListener("resize", fit);
    return () => {
      window.removeEventListener("resize", fit);
      root.style.height = "";
    };
  }, [loading, isPhone]);

  // Phones get the canvas alone: the page behind it is locked, so nothing but the
  // canvas can move, and Safari's own pinch zoom can't take over.
  useEffect(() => {
    if (!isPhone || loading) return;
    const { documentElement: html, body } = document;
    const previous = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyOverscroll: body.style.overscrollBehavior,
    };
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";

    const blockGesture = (e: Event) => e.preventDefault();
    document.addEventListener("gesturestart", blockGesture);
    return () => {
      html.style.overflow = previous.htmlOverflow;
      body.style.overflow = previous.bodyOverflow;
      body.style.overscrollBehavior = previous.bodyOverscroll;
      document.removeEventListener("gesturestart", blockGesture);
    };
  }, [isPhone, loading]);

  // The board is sized to the visible area, not to the page. Safari can lay a page
  // out wider than the screen when something on it overflows, and the on-screen
  // keyboard shrinks only the visible area, so what's typed on stays above it.
  // A layout effect, so the canvas's first fit measures the final size.
  useLayoutEffect(() => {
    const viewport = window.visualViewport;
    const root = rootRef.current;
    if (!isPhone || !viewport || !root) return;
    const follow = () => {
      root.style.width = `${viewport.width}px`;
      root.style.height = `${viewport.height}px`;
      root.style.left = `${viewport.offsetLeft}px`;
      root.style.top = `${viewport.offsetTop}px`;
      setKeyboardOpen(window.innerHeight - viewport.height > 120);
    };
    follow();
    viewport.addEventListener("resize", follow);
    viewport.addEventListener("scroll", follow);
    return () => {
      viewport.removeEventListener("resize", follow);
      viewport.removeEventListener("scroll", follow);
      root.style.width = "";
      root.style.height = "";
      root.style.left = "";
      root.style.top = "";
      setKeyboardOpen(false);
    };
  }, [isPhone, loading]);

  useEffect(() => {
    if (!deletedCount) return;
    const timer = setTimeout(() => setDeletedCount(0), UNDO_MS);
    return () => clearTimeout(timer);
  }, [deletedCount]);

  useLayoutEffect(() => {
    boardRef.current = moodboard;
  });

  // ---------------------------------------------------------------------------
  // Undo and redo
  // ---------------------------------------------------------------------------

  /** Call just before changing the board. A key merges repeats into one step. */
  function record(key?: string) {
    const board = boardRef.current;
    if (!board) return;
    const now = Date.now();
    if (key && lastRecord.current?.key === key && now - lastRecord.current.at < COALESCE_MS) {
      lastRecord.current.at = now;
      return;
    }
    past.current.push({ items: board.items, connections: board.connections });
    if (past.current.length > MAX_HISTORY) past.current.shift();
    future.current = [];
    lastRecord.current = key ? { key, at: now } : null;
    setHistorySize({ undo: past.current.length, redo: 0 });
    setDeletedCount(0);
  }

  /** One request about one object, sent after any earlier ones about it. */
  function writeItem(itemId: string, method: "PATCH" | "DELETE", body?: unknown) {
    return enqueue(itemId, async () => {
      const sid = await serverId(itemId);
      const res = await fetch(`/api/moodboards/${moodboardId}/items/${sid}`, {
        method,
        ...(body
          ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
          : {}),
      });
      if (!res.ok) throw new Error(`${method} item failed: ${res.status}`);
    });
  }

  function step(from: BoardSnapshot[], to: BoardSnapshot[]) {
    const board = boardRef.current;
    if (!board) return;
    lastRecord.current = null;
    setDeletedCount(0);

    // A step that changes nothing on screen, like text removed for being empty, is skipped.
    let target: BoardSnapshot | undefined;
    let diff = null;
    while ((target = from.pop())) {
      diff = diffBoards(board, target);
      if (!isEmptyDiff(diff)) break;
      target = undefined;
    }
    setHistorySize({
      undo: from === past.current ? from.length : to.length + (target ? 1 : 0),
      redo: from === future.current ? from.length : to.length + (target ? 1 : 0),
    });
    if (!target || !diff) return;

    to.push({ items: board.items, connections: board.connections });
    canvasHandle.current?.clearSelection();
    const { items, connections } = target;
    setMoodboard((prev) => (prev ? { ...prev, items, connections } : prev));

    Promise.all([
      ...diff.remove.map((id) => writeItem(id, "DELETE")),
      ...diff.restore.map((id) => writeItem(id, "PATCH", { restore: true })),
      ...diff.change.map(({ id, x, y, width, height, data, position, locked, groupId }) =>
        writeItem(id, "PATCH", {
          x,
          y,
          width,
          height,
          data,
          position,
          locked: locked ?? false,
          groupId: groupId ?? null,
        }),
      ),
      ...(diff.connectionsChanged ? [saveConnections(connections)] : []),
    ]).catch((err) => {
      console.error("[moodboard-view] undo error:", err);
      showToast({ type: "error", title: "We couldn't undo that. The board has been reloaded." });
      fetchMoodboard();
    });
  }

  function handleUndo() {
    step(past.current, future.current);
  }

  function handleRedo() {
    step(future.current, past.current);
  }

  // ---------------------------------------------------------------------------
  // Copy, paste and duplicate
  // ---------------------------------------------------------------------------

  function handleCopyItems(ids: string[]) {
    const board = boardRef.current;
    if (!board) return "";
    lastCopy = buildClipboard(moodboardId, board, ids);
    pasteCount.current = 0;
    return serializeClipboard(lastCopy);
  }

  function addCopies(clipboard: BoardClipboard, shift: (bounds: Point) => Point) {
    // A file belongs to the board it was uploaded to.
    const sameBoard = clipboard.moodboardId === moodboardId;
    const sources = sameBoard
      ? clipboard.items
      : clipboard.items.filter((i) => i.type !== "IMAGE" && i.type !== "FILE");
    if (sources.length < clipboard.items.length) {
      showToast({
        type: "warning",
        title: "Images and files can only be copied within the same moodboard.",
      });
    }
    if (sources.length === 0) return;

    record();
    const board = boardRef.current;
    const position = nextPosition(board?.items ?? []);
    const now = new Date().toISOString();
    const offset = shift({
      x: Math.min(...sources.map((i) => i.x)),
      y: Math.min(...sources.map((i) => i.y)),
    });

    const newIds = new Map<string, string>();
    // Copies of a group form a group of their own.
    const newGroups = new Map<string, string>();
    const copyGroup = (groupId: string | null | undefined) => {
      if (!groupId) return null;
      if (!newGroups.has(groupId)) newGroups.set(groupId, newClientId());
      return newGroups.get(groupId)!;
    };
    const copies = sources.map((source, index) => {
      const id = `tmp_${newClientId()}`;
      newIds.set(source.id, id);
      return {
        ...source,
        ...withShiftedDrawing(
          source as MoodboardItemClient,
          source.x + offset.x,
          source.y + offset.y,
        ),
        id,
        position: position + index,
        locked: false,
        groupId: copyGroup(source.groupId),
        colSpan: 1,
        createdById: "",
        createdAt: now,
        updatedAt: now,
      } as MoodboardItemClient;
    });
    const copiedArrows = clipboard.connections
      .filter((c) => newIds.has(c.sourceItemId) && newIds.has(c.targetItemId))
      .map((c) => ({
        ...c,
        id: newClientId(),
        sourceItemId: newIds.get(c.sourceItemId)!,
        targetItemId: newIds.get(c.targetItemId)!,
      }));
    const nextConnections = [...(board?.connections ?? []), ...copiedArrows];

    setMoodboard((prev) =>
      prev ? { ...prev, items: [...prev.items, ...copies], connections: nextConnections } : prev,
    );
    requestAnimationFrame(() => canvasHandle.current?.selectItems(copies.map((c) => c.id)));

    for (const copy of copies) {
      const { type, data, x, y, width, height, groupId } = copy;
      const saved = fetch(`/api/moodboards/${moodboardId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, data, x, y, width, height, groupId }),
      }).then(async (res) => {
        if (!res.ok) throw new Error("Failed to add copy");
        return (await res.json()).item.id as string;
      });
      serverIds.current.set(copy.id, saved);
      saved.catch((err) => {
        console.error("[moodboard-view] copy error:", err);
        showToast({ type: "error", title: "We couldn't save that copy. Please try again." });
        fetchMoodboard();
      });
    }
    if (copiedArrows.length > 0) {
      saveConnections(nextConnections).catch((err) => {
        console.error("[moodboard-view] copy arrows error:", err);
        fetchMoodboard();
      });
    }
  }

  function pasteClipboard(clipboard: BoardClipboard) {
    pasteCount.current += 1;
    const step = CASCADE_PX * pasteCount.current;
    addCopies(clipboard, (corner) => {
      if (clipboard.moodboardId === moodboardId) return { x: step, y: step };
      const center = canvasHandle.current?.viewCenter() ?? { x: 400, y: 260 };
      return { x: center.x - corner.x + step, y: center.y - corner.y + step };
    });
  }

  function handlePasteText(text: string | null) {
    const clipboard = parseClipboard(text);
    if (!clipboard) return false;
    pasteClipboard(clipboard);
    return true;
  }

  function handlePasteLastCopy() {
    if (lastCopy) pasteClipboard(lastCopy);
  }

  function handleDuplicateItems(ids: string[]) {
    const board = boardRef.current;
    if (!board) return;
    addCopies(buildClipboard(moodboardId, board, ids), () => ({ x: CASCADE_PX, y: CASCADE_PX }));
  }

  // ---------------------------------------------------------------------------
  // Add item (with canvas position)
  // ---------------------------------------------------------------------------

  function handleAddItem(
    type: string,
    data: MoodboardItemData,
    opts: { width: number; height: number; at?: Point | null; edit?: boolean },
  ) {
    const items = moodboard?.items ?? [];
    const { width, height } = opts;
    const center = opts.at ?? canvasHandle.current?.viewCenter() ?? { x: 400, y: 260 };
    const { x, y } = placeNear(center, items, width, height);

    record();
    const id = `tmp_${newClientId()}`;
    const now = new Date().toISOString();
    const item = {
      id,
      type,
      data,
      x,
      y,
      width,
      height,
      position: nextPosition(items),
      colSpan: 1,
      createdById: "",
      createdAt: now,
      updatedAt: now,
    } as MoodboardItemClient;

    setMoodboard((prev) => (prev ? { ...prev, items: [...prev.items, item] } : prev));
    setPlacing(null);
    // The card has to be on screen before it can be selected and edited.
    requestAnimationFrame(() => {
      canvasHandle.current?.selectCard(id, { edit: opts.edit });
    });

    const saved = fetch(`/api/moodboards/${moodboardId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, data, x, y, width, height }),
    }).then(async (res) => {
      if (!res.ok) throw new Error("Failed to add item");
      return (await res.json()).item.id as string;
    });
    serverIds.current.set(id, saved);

    saved.catch((err) => {
      console.error("[moodboard-view] add item error:", err);
      showToast({ type: "error", title: "We couldn't save that. Please try again." });
      setMoodboard((prev) =>
        prev ? { ...prev, items: prev.items.filter((i) => i.id !== id) } : prev,
      );
    });
  }

  function createAt(kind: CreatableKind, at: Point | null) {
    setPlacing(null);
    pendingPoint.current = at;

    switch (kind) {
      case "note":
        handleAddItem(
          "NOTE",
          { body: "", color: STICKY_COLORS[0] },
          { width: 240, height: 240, at, edit: true },
        );
        return;
      case "shape":
        handleAddItem(
          "SHAPE",
          { kind: shapeKind, text: "", fill: SHAPE_FILLS[0] },
          { width: 200, height: 200, at, edit: true },
        );
        return;
      case "text":
        handleAddItem("TEXT", { text: "" }, { width: 280, height: 0, at, edit: true });
        return;
      case "section":
        handleAddItem(
          "SECTION",
          { title: "Section", color: SECTION_COLORS[0] },
          { width: 640, height: 420, at, edit: true },
        );
        return;
      case "color":
        handleAddItem("COLOR", { hex: "#F15B2B" }, { width: 200, height: 160, at });
        return;
      case "todo":
        handleAddItem("TODO", defaultTodoData(), { width: 280, height: 0, at });
        return;
      case "image":
        imageInputRef.current?.click();
        return;
      case "file":
        fileInputRef.current?.click();
        return;
      case "link":
        setActiveModal("link");
        return;
      case "video":
        setActiveModal("embed");
        return;
    }
  }

  /** Clicked in the dock: place it with the next click, or ask for what it needs. */
  function handlePick(kind: CreatableKind) {
    if (kind === "image" || kind === "file" || kind === "link" || kind === "video") {
      createAt(kind, null);
      return;
    }
    setToolMode("select");
    setPlacing((current) => (current === kind ? null : kind));
  }

  function handleDropAt(kind: CreatableKind, clientX: number, clientY: number) {
    const point = canvasHandle.current?.clientToCanvas(clientX, clientY);
    if (point) createAt(kind, point);
  }

  function handleSetToolMode(mode: ToolMode) {
    setPlacing(null);
    setToolMode(mode);
  }

  // ---------------------------------------------------------------------------
  // Update item data
  // ---------------------------------------------------------------------------

  async function handleUpdateItem(itemId: string, data: MoodboardItemData) {
    if (!moodboard?.access.canEdit) return;
    record(`data:${itemId}`);
    setMoodboard((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((item) => (item.id === itemId ? { ...item, data } : item)),
      };
    });

    try {
      await writeItem(itemId, "PATCH", { data });
    } catch (err) {
      console.error("[moodboard-view] update item error:", err);
      fetchMoodboard();
    }
  }

  // ---------------------------------------------------------------------------
  // Delete item
  // ---------------------------------------------------------------------------

  function handleDeleteItem(itemId: string) {
    handleDeleteItems([itemId]);
  }

  async function handleDeleteItems(itemIds: string[]) {
    const board = boardRef.current;
    if (!board) return;
    const chosen = new Set(itemIds);
    const remaining = board.connections.filter(
      (c) => !chosen.has(c.sourceItemId) && !chosen.has(c.targetItemId),
    );
    const orphaned = remaining.length !== board.connections.length;

    // Strokes erased in one swipe come back together.
    const onlyDrawings = board.items
      .filter((i) => chosen.has(i.id))
      .every((i) => i.type === "DRAWING");
    record(onlyDrawings && itemIds.length === 1 ? "erase" : undefined);

    setMoodboard((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.filter((item) => !chosen.has(item.id)),
            connections: prev.connections.filter(
              (c) => !chosen.has(c.sourceItemId) && !chosen.has(c.targetItemId),
            ),
          }
        : prev,
    );
    setDeletedCount(itemIds.length);

    try {
      await Promise.all([
        ...itemIds.map((id) => writeItem(id, "DELETE")),
        ...(orphaned ? [saveConnections(remaining)] : []),
      ]);
    } catch (err) {
      console.error("[moodboard-view] delete item error:", err);
      fetchMoodboard();
    }
  }

  /** Text left empty: nothing worth offering to restore. */
  async function handleRemoveEmpty(itemId: string) {
    setMoodboard((prev) =>
      prev ? { ...prev, items: prev.items.filter((i) => i.id !== itemId) } : prev,
    );
    try {
      await writeItem(itemId, "DELETE");
    } catch (err) {
      console.error("[moodboard-view] remove empty item error:", err);
    }
  }

  // ---------------------------------------------------------------------------
  // Move item (canvas drag)
  // ---------------------------------------------------------------------------

  function handleMoveItem(itemId: string, x: number, y: number) {
    handleMoveItems([{ id: itemId, x, y }]);
  }

  async function handleMoveItems(
    moves: { id: string; x: number; y: number }[],
    options?: { nudge?: boolean },
  ) {
    const board = boardRef.current;
    if (!board) return;
    record(options?.nudge ? `nudge:${moves.map((m) => m.id).join()}` : undefined);

    // A drawing's path holds its own coordinates, so they move with it.
    const updates = moves.flatMap(({ id, x, y }) => {
      const item = board.items.find((i) => i.id === id);
      return item ? [{ id, change: withShiftedDrawing(item, x, y) }] : [];
    });
    const byId = new Map(updates.map((u) => [u.id, u.change]));

    setMoodboard((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((item) => {
              const change = byId.get(item.id);
              return change ? ({ ...item, ...change } as MoodboardItemClient) : item;
            }),
          }
        : prev,
    );

    try {
      await Promise.all(updates.map(({ id, change }) => writeItem(id, "PATCH", change)));
    } catch (err) {
      console.error("[moodboard-view] move item error:", err);
      fetchMoodboard();
    }
  }

  // ---------------------------------------------------------------------------
  // Lock and group
  // ---------------------------------------------------------------------------

  /** Saves the same few fields on several objects as one undo step. */
  async function patchItems(changes: Map<string, Pick<MoodboardItemClient, "locked" | "groupId">>) {
    if (changes.size === 0) return;
    record();
    setMoodboard((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((item) =>
              changes.has(item.id) ? { ...item, ...changes.get(item.id) } : item,
            ),
          }
        : prev,
    );
    try {
      await Promise.all([...changes].map(([id, change]) => writeItem(id, "PATCH", change)));
    } catch (err) {
      console.error("[moodboard-view] lock/group error:", err);
      fetchMoodboard();
    }
  }

  function handleSetLocked(ids: string[], locked: boolean) {
    const items = boardRef.current?.items ?? [];
    const changes = new Map<string, { locked: boolean }>();
    for (const item of items) {
      if (ids.includes(item.id) && (item.locked ?? false) !== locked) {
        changes.set(item.id, { locked });
      }
    }
    patchItems(changes);
  }

  function handleGroup(ids: string[]) {
    if (ids.length < 2) return;
    const groupId = newClientId();
    patchItems(new Map(ids.map((id) => [id, { groupId }])));
  }

  /** Ungroups every group the selection touches, wholly. */
  function handleUngroup(ids: string[]) {
    const items = boardRef.current?.items ?? [];
    const groups = new Set(
      items.filter((i) => ids.includes(i.id) && i.groupId).map((i) => i.groupId),
    );
    patchItems(
      new Map(
        items
          .filter((i) => i.groupId && groups.has(i.groupId))
          .map((i) => [i.id, { groupId: null }]),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Stacking order
  // ---------------------------------------------------------------------------

  /** Puts these objects above or below everything else, keeping their own order. */
  async function handleReorderItems(ids: string[], where: "front" | "back") {
    const board = boardRef.current;
    if (!board || ids.length === 0) return;
    const changes = restack(board.items, ids, where);
    if (changes.size === 0) return;
    record();
    setMoodboard((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((item) =>
              changes.has(item.id) ? { ...item, position: changes.get(item.id)! } : item,
            ),
          }
        : prev,
    );
    try {
      await Promise.all([...changes].map(([id, position]) => writeItem(id, "PATCH", { position })));
    } catch (err) {
      console.error("[moodboard-view] reorder error:", err);
      fetchMoodboard();
    }
  }

  // ---------------------------------------------------------------------------
  // Resize item
  // ---------------------------------------------------------------------------

  async function handleResizeItem(
    itemId: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    record();
    setMoodboard((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((item) =>
          item.id === itemId ? { ...item, x, y, width, height } : item,
        ),
      };
    });

    try {
      await writeItem(itemId, "PATCH", { x, y, width, height });
    } catch (err) {
      console.error("[moodboard-view] resize item error:", err);
      fetchMoodboard();
    }
  }

  // ---------------------------------------------------------------------------
  // Update title
  // ---------------------------------------------------------------------------

  async function handleUpdateTitle(title: string) {
    setMoodboard((prev) => {
      if (!prev) return prev;
      return { ...prev, title };
    });

    try {
      const res = await fetch(`/api/moodboards/${moodboardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });

      if (!res.ok) throw new Error("Failed to update title");
    } catch (err) {
      console.error("[moodboard-view] update title error:", err);
      fetchMoodboard();
    }
  }

  // ---------------------------------------------------------------------------
  // Delete board
  // ---------------------------------------------------------------------------

  async function handleExport(format: ExportFormat) {
    const title = boardRef.current?.title ?? "moodboard";
    try {
      const blob = await canvasHandle.current?.exportImage(format);
      if (!blob) {
        showToast({ type: "info", title: "Add something to the board first." });
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = exportFileName(title, format);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (err) {
      console.error("[moodboard-view] export error:", err);
      showToast({ type: "error", title: "We couldn't make the download. Please try again." });
    }
  }

  async function handleDeleteBoard() {
    const confirmed = window.confirm(
      "Are you sure you want to delete this moodboard? This cannot be undone.",
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/moodboards/${moodboardId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete moodboard");

      router.push(basePath);
    } catch (err) {
      console.error("[moodboard-view] delete board error:", err);
    }
  }

  // ---------------------------------------------------------------------------
  // Connections (arrows between cards)
  // ---------------------------------------------------------------------------

  async function patchSharing(body: { ticketId?: string | null; sharedWithCustomer?: boolean }) {
    try {
      const res = await fetch(`/api/moodboards/${moodboardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      // Sharing doesn't touch the canvas, so what's on it and its undo history stay.
      const fresh = await fetch(`/api/moodboards/${moodboardId}`);
      if (!fresh.ok) throw new Error(`Request failed: ${fresh.status}`);
      const { moodboard: next } = await fresh.json();
      setMoodboard((prev) =>
        prev ? { ...next, items: prev.items, connections: prev.connections } : next,
      );
    } catch (err) {
      console.error("[moodboard-view] sharing error:", err);
      showToast({ type: "error", title: "We couldn't update sharing. Please try again." });
    }
  }

  /** Saved with server ids, since temporary ones mean nothing after a reload. */
  function saveConnections(connections: MoodboardConnection[]) {
    return enqueue("connections", async () => {
      const resolved = await Promise.all(
        connections.map(async (c) => ({
          ...c,
          sourceItemId: await serverId(c.sourceItemId),
          targetItemId: await serverId(c.targetItemId),
        })),
      );
      const res = await fetch(`/api/moodboards/${moodboardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connections: resolved }),
      });
      if (!res.ok) throw new Error(`Saving arrows failed: ${res.status}`);
    });
  }

  async function handleAddConnection(sourceId: string, targetId: string) {
    record();
    const newConn = createConnection(sourceId, targetId);
    const updatedConnections = [...(moodboard?.connections ?? []), newConn];

    // Optimistic update
    setMoodboard((prev) => {
      if (!prev) return prev;
      return { ...prev, connections: updatedConnections };
    });

    // Persist to API
    try {
      await saveConnections(updatedConnections);
    } catch (err) {
      console.error("[moodboard-view] add connection error:", err);
      fetchMoodboard();
    }
  }

  async function handleDeleteConnection(connectionId: string) {
    record();
    const updatedConnections = (moodboard?.connections ?? []).filter((c) => c.id !== connectionId);

    // Optimistic update
    setMoodboard((prev) => {
      if (!prev) return prev;
      return { ...prev, connections: updatedConnections };
    });

    // Persist to API
    try {
      await saveConnections(updatedConnections);
    } catch (err) {
      console.error("[moodboard-view] delete connection error:", err);
      fetchMoodboard();
    }
  }

  // ---------------------------------------------------------------------------
  // Freehand drawing
  // ---------------------------------------------------------------------------

  function handleAddDrawing(
    data: DrawingCardData,
    bounds: { x: number; y: number; w: number; h: number },
  ) {
    record();
    const id = `tmp_${newClientId()}`;
    const now = new Date().toISOString();
    const item = {
      id,
      type: "DRAWING",
      data,
      x: bounds.x,
      y: bounds.y,
      width: bounds.w,
      height: bounds.h,
      position: nextPosition(moodboard?.items ?? []),
      colSpan: 1,
      createdById: "",
      createdAt: now,
      updatedAt: now,
    } as MoodboardItemClient;
    setMoodboard((prev) => (prev ? { ...prev, items: [...prev.items, item] } : prev));

    const saved = fetch(`/api/moodboards/${moodboardId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "DRAWING",
        data,
        x: bounds.x,
        y: bounds.y,
        width: bounds.w,
        height: bounds.h,
      }),
    }).then(async (res) => {
      if (!res.ok) throw new Error("Failed to save drawing");
      return (await res.json()).item.id as string;
    });
    serverIds.current.set(id, saved);
    saved.catch((err) => {
      console.error("[moodboard-view] add drawing error:", err);
      showToast({ type: "error", title: "We couldn't save that drawing. Please try again." });
      setMoodboard((prev) =>
        prev ? { ...prev, items: prev.items.filter((i) => i.id !== id) } : prev,
      );
    });
  }

  // ---------------------------------------------------------------------------
  // File upload (image or file)
  // ---------------------------------------------------------------------------

  async function handleUploadFile(
    file: File,
    type: "IMAGE" | "FILE",
    at: Point | null = pendingPoint.current,
  ) {
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("moodboardId", moodboardId);

      const uploadRes = await fetch("/api/uploads/r2/moodboard-presign", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) throw new Error("Failed to upload file");

      const { url, storageKey, mimeType, originalName, bytes } = await uploadRes.json();

      if (type === "IMAGE") {
        const data: ImageCardData = {
          url: url ?? "",
          storageKey,
          originalName: originalName ?? file.name,
          mimeType: mimeType ?? file.type,
          bytes: bytes ?? file.size,
        };
        handleAddItem("IMAGE", data, { width: 280, height: 0, at });
      } else {
        const data: FileCardData = {
          url: url ?? "",
          storageKey,
          originalName: originalName ?? file.name,
          mimeType: mimeType ?? file.type,
          bytes: bytes ?? file.size,
        };
        handleAddItem("FILE", data, { width: 280, height: 0, at });
      }
    } catch (err) {
      console.error("[moodboard-view] upload error:", err);
      showToast({ type: "error", title: `We couldn't upload ${file.name || "that file"}.` });
    }
  }

  /** Files dropped on the board or pasted: images become pictures, the rest files. */
  async function handleAddFiles(files: File[], at: Point | null) {
    if (!moodboard?.access.canEdit || files.length === 0) return;
    const batch = files.slice(0, MAX_FILES_AT_ONCE);
    if (files.length > batch.length) {
      showToast({
        type: "warning",
        title: `Only the first ${MAX_FILES_AT_ONCE} files were added. Add the rest in another go.`,
      });
    }
    const tooBig = batch.filter((f) => f.size > MAX_UPLOAD_BYTES);
    if (tooBig.length > 0) {
      showToast({
        type: "error",
        title:
          tooBig.length === 1
            ? `${tooBig[0].name || "That file"} is over ${MAX_UPLOAD_LABEL}.`
            : `${tooBig.length} files are over ${MAX_UPLOAD_LABEL} and were skipped.`,
      });
    }
    const uploads = batch.filter((f) => f.size <= MAX_UPLOAD_BYTES);
    if (uploads.length === 0) return;
    showToast({
      type: "info",
      title: uploads.length === 1 ? "Uploading 1 file…" : `Uploading ${uploads.length} files…`,
    });
    // One at a time, so each lands beside the one before instead of on top.
    for (const file of uploads) {
      await handleUploadFile(file, file.type.startsWith("image/") ? "IMAGE" : "FILE", at);
    }
  }

  // ---------------------------------------------------------------------------
  // Modal / toolbar handlers
  // ---------------------------------------------------------------------------

  function closeModal() {
    setActiveModal(null);
  }

  function handleAddLinkData(data: LinkCardData) {
    handleAddItem("LINK", data, { width: 280, height: 0, at: pendingPoint.current });
  }

  function handleAddEmbedData(data: EmbedCardData) {
    handleAddItem("EMBED", data, { width: 420, height: 280, at: pendingPoint.current });
  }

  function onImageInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleUploadFile(file, "IMAGE");
    e.target.value = "";
  }

  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleUploadFile(file, "FILE");
    e.target.value = "";
  }

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center" role="status">
        <span className="text-sm text-[var(--av2-text-2)]">Loading moodboard…</span>
      </div>
    );
  }

  if (!moodboard) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <h1 className="text-base font-semibold text-[var(--av2-text)]">Moodboard not found</h1>
          <button
            type="button"
            onClick={() => router.push(basePath)}
            className="mt-2 min-h-10 text-sm font-medium text-[var(--av2-link)] hover:underline"
          >
            Back to moodboards
          </button>
        </div>
      </div>
    );
  }

  const canEdit = moodboard.access.canEdit;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      ref={rootRef}
      className={
        isPhone
          ? "fixed top-0 left-0 z-45 flex h-dvh w-dvw flex-col overflow-hidden bg-[var(--av2-surface)]"
          : "relative flex flex-col"
      }
      style={isPhone ? { touchAction: "none" } : undefined}
      onPointerDownCapture={(e) => {
        // Touching anything outside the toolbar closes its "more" row.
        if (moreOpen && !(e.target as Element).closest("[data-mb-dock]")) setMoreOpen(false);
      }}
    >
      <BoardCanvas
        items={moodboard.items}
        connections={moodboard.connections}
        toolMode={toolMode}
        drawColor={drawColor}
        drawSize={drawSize * PEN_PRESETS[penKind].widthFactor}
        drawOpacity={PEN_PRESETS[penKind].opacity}
        placing={placing}
        readOnly={!canEdit}
        handleRef={canvasHandle}
        isPhone={isPhone}
        keyboardOpen={keyboardOpen}
        hideObjectToolbar={moreOpen}
        onSetToolMode={handleSetToolMode}
        onPlace={createAt}
        onPick={handlePick}
        onCancelPlacing={() => setPlacing(null)}
        onRemoveEmpty={handleRemoveEmpty}
        onUpdateItem={handleUpdateItem}
        onDeleteItem={handleDeleteItem}
        onMoveItem={handleMoveItem}
        onMoveItems={handleMoveItems}
        onDeleteItems={handleDeleteItems}
        onDuplicateItems={handleDuplicateItems}
        onCopyItems={handleCopyItems}
        onPasteText={handlePasteText}
        onPasteLastCopy={handlePasteLastCopy}
        onAddFiles={handleAddFiles}
        onReorderItems={handleReorderItems}
        onSetLocked={handleSetLocked}
        onGroup={handleGroup}
        onUngroup={handleUngroup}
        onResizeItem={handleResizeItem}
        onAddConnection={handleAddConnection}
        onDeleteConnection={handleDeleteConnection}
        onAddDrawing={handleAddDrawing}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={historySize.undo > 0}
        canRedo={historySize.redo > 0}
      />

      {isPhone && placing && (
        <div
          role="status"
          className="pointer-events-none absolute top-16 left-1/2 z-30 -translate-x-1/2 rounded-full bg-[var(--av2-text)] px-4 py-2 text-sm font-medium whitespace-nowrap text-[var(--av2-surface)]"
        >
          Tap where you want it
        </div>
      )}

      <BoardHeader
        title={moodboard.title}
        itemCount={moodboard.items.filter((i) => i.type !== "DRAWING").length}
        onTitleChange={handleUpdateTitle}
        readOnly={!canEdit}
        canDelete={moodboard.access.canDelete}
        canShare={moodboard.access.canShare}
        shared={moodboard.sharedWithCustomer}
        jobTitle={moodboard.ticketTitle}
        onPickJob={() => setJobPickerOpen(true)}
        onToggleShared={() => patchSharing({ sharedWithCustomer: !moodboard.sharedWithCustomer })}
        onBack={() => router.push(basePath)}
        onDelete={handleDeleteBoard}
        onExport={handleExport}
      />

      {canEdit && (
        <BoardToolbar
          isPhone={isPhone}
          moreOpen={moreOpen}
          onSetMoreOpen={setMoreOpen}
          hidden={keyboardOpen}
          toolMode={toolMode}
          placing={placing}
          onSetToolMode={handleSetToolMode}
          onPick={handlePick}
          onDropAt={handleDropAt}
          penKind={penKind}
          drawColor={drawColor}
          drawSize={drawSize}
          shapeKind={shapeKind}
          onSetPenKind={(kind) => {
            setPenKind(kind);
            if (kind === "highlighter" && drawColor === DRAW_COLORS[0]) {
              setDrawColor(HIGHLIGHTER_DEFAULT_COLOR);
            }
          }}
          onSetDrawColor={setDrawColor}
          onSetDrawSize={setDrawSize}
          onSetShapeKind={setShapeKind}
        />
      )}

      {deletedCount > 0 && (
        <div
          role="status"
          className="absolute top-16 left-3 z-30 flex items-center gap-3 rounded-xl border border-[var(--av2-border)] bg-[var(--av2-surface)] py-1 pr-1 pl-4 text-sm text-[var(--av2-text)] shadow-sm"
        >
          {deletedCount > 1 ? `${deletedCount} deleted` : "Deleted"}
          <button
            type="button"
            onClick={handleUndo}
            className="flex min-h-10 items-center rounded-lg px-3 font-semibold text-[var(--av2-link)] hover:bg-[var(--av2-bg)] focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none"
          >
            Undo
          </button>
        </div>
      )}

      {moodboard.access.canShare && (
        <LinkJobModal
          open={jobPickerOpen}
          currentTicketId={moodboard.ticketId}
          onClose={() => setJobPickerOpen(false)}
          onPick={(ticketId) => {
            setJobPickerOpen(false);
            patchSharing({ ticketId });
          }}
        />
      )}

      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onImageInputChange}
      />
      <input ref={fileInputRef} type="file" className="hidden" onChange={onFileInputChange} />

      {/* Modals */}
      <AddLinkModal open={activeModal === "link"} onClose={closeModal} onSave={handleAddLinkData} />
      <AddEmbedModal
        open={activeModal === "embed"}
        onClose={closeModal}
        onSave={handleAddEmbedData}
      />
    </div>
  );
}
