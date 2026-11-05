"use client";

import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

import { BoardToolbar } from "@/components/moodboard/board-toolbar";
import { BoardHeader } from "@/components/moodboard/board-header";
import { LinkJobModal } from "@/components/moodboard/link-job-modal";
import { BoardCanvas, type BoardCanvasHandle } from "@/components/moodboard/board-canvas";
import { useIsPhone } from "@/components/moodboard/use-is-phone";
import { useToast } from "@/components/ui/toast-provider";
import { AddLinkModal } from "@/components/moodboard/add-link-modal";
import { AddEmbedModal } from "@/components/moodboard/add-embed-modal";

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

type DeletedItem = { item: MoodboardItemClient; connections: MoodboardConnection[] };

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

  const [deleted, setDeleted] = useState<DeletedItem | null>(null);

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
  /** Where the object from a file picker or dialog should land. */
  const pendingPoint = useRef<Point | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---------------------------------------------------------------------------
  // Fetch moodboard
  // ---------------------------------------------------------------------------

  const fetchMoodboard = useCallback(async () => {
    try {
      const res = await fetch(`/api/moodboards/${moodboardId}`);
      if (!res.ok) throw new Error("Failed to load moodboard");

      const json = await res.json();
      setMoodboard(json.moodboard);
    } catch (err) {
      console.error("[moodboard-view] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [moodboardId]);

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
    if (!deleted) return;
    const timer = setTimeout(() => setDeleted(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [deleted]);

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
      position: items.length,
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
    setMoodboard((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((item) => (item.id === itemId ? { ...item, data } : item)),
      };
    });

    try {
      const sid = await serverId(itemId);
      const res = await fetch(`/api/moodboards/${moodboardId}/items/${sid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });

      if (!res.ok) throw new Error("Failed to update item");
    } catch (err) {
      console.error("[moodboard-view] update item error:", err);
      fetchMoodboard();
    }
  }

  // ---------------------------------------------------------------------------
  // Delete item
  // ---------------------------------------------------------------------------

  async function handleDeleteItem(itemId: string) {
    const item = moodboard?.items.find((i) => i.id === itemId);

    // Also remove any connections referencing this item
    const orphanedConns = (moodboard?.connections ?? []).filter(
      (c) => c.sourceItemId === itemId || c.targetItemId === itemId,
    );
    const cleanedConnections = (moodboard?.connections ?? []).filter(
      (c) => c.sourceItemId !== itemId && c.targetItemId !== itemId,
    );

    setMoodboard((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.filter((item) => item.id !== itemId),
        connections: cleanedConnections,
      };
    });
    if (item) setDeleted({ item, connections: orphanedConns });

    try {
      const sid = await serverId(itemId);
      const res = await fetch(`/api/moodboards/${moodboardId}/items/${sid}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete item");

      // If connections were cleaned up, persist that too
      if (orphanedConns.length > 0) {
        await saveConnections(cleanedConnections);
      }
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
      const sid = await serverId(itemId);
      await fetch(`/api/moodboards/${moodboardId}/items/${sid}`, { method: "DELETE" });
    } catch (err) {
      console.error("[moodboard-view] remove empty item error:", err);
    }
  }

  // Deleting is one key away on the canvas, so the last delete can be taken back.
  // The card comes back as a new row, with its arrows pointed at the new id.
  async function handleUndoDelete() {
    if (!deleted) return;
    const { item, connections } = deleted;
    setDeleted(null);

    try {
      const res = await fetch(`/api/moodboards/${moodboardId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: item.type,
          data: item.data,
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
        }),
      });
      if (!res.ok) throw new Error("Failed to restore item");
      const restored: MoodboardItemClient = (await res.json()).item;

      const relinked = connections.map((c) => ({
        ...c,
        sourceItemId: c.sourceItemId === item.id ? restored.id : c.sourceItemId,
        targetItemId: c.targetItemId === item.id ? restored.id : c.targetItemId,
      }));
      const nextConnections = [...(moodboard?.connections ?? []), ...relinked];

      setMoodboard((prev) =>
        prev ? { ...prev, items: [...prev.items, restored], connections: nextConnections } : prev,
      );

      if (relinked.length > 0) {
        await saveConnections(nextConnections);
      }
    } catch (err) {
      console.error("[moodboard-view] undo delete error:", err);
      fetchMoodboard();
    }
  }

  // ---------------------------------------------------------------------------
  // Move item (canvas drag)
  // ---------------------------------------------------------------------------

  async function handleMoveItem(itemId: string, x: number, y: number) {
    setMoodboard((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((item) => (item.id === itemId ? { ...item, x, y } : item)),
      };
    });

    try {
      const sid = await serverId(itemId);
      const res = await fetch(`/api/moodboards/${moodboardId}/items/${sid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x, y }),
      });

      if (!res.ok) throw new Error("Failed to move item");
    } catch (err) {
      console.error("[moodboard-view] move item error:", err);
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
      const sid = await serverId(itemId);
      const res = await fetch(`/api/moodboards/${moodboardId}/items/${sid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x, y, width, height }),
      });

      if (!res.ok) throw new Error("Failed to resize item");
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
      await fetchMoodboard();
    } catch (err) {
      console.error("[moodboard-view] sharing error:", err);
      showToast({ type: "error", title: "We couldn't update sharing. Please try again." });
    }
  }

  /** Saved with server ids, since temporary ones mean nothing after a reload. */
  async function saveConnections(connections: MoodboardConnection[]) {
    const resolved = await Promise.all(
      connections.map(async (c) => ({
        ...c,
        sourceItemId: await serverId(c.sourceItemId),
        targetItemId: await serverId(c.targetItemId),
      })),
    );
    return fetch(`/api/moodboards/${moodboardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connections: resolved }),
    });
  }

  async function handleAddConnection(sourceId: string, targetId: string) {
    const newConn = createConnection(sourceId, targetId);
    const updatedConnections = [...(moodboard?.connections ?? []), newConn];

    // Optimistic update
    setMoodboard((prev) => {
      if (!prev) return prev;
      return { ...prev, connections: updatedConnections };
    });

    // Persist to API
    try {
      const res = await saveConnections(updatedConnections);

      if (!res.ok) throw new Error("Failed to save connection");
    } catch (err) {
      console.error("[moodboard-view] add connection error:", err);
      fetchMoodboard();
    }
  }

  async function handleDeleteConnection(connectionId: string) {
    const updatedConnections = (moodboard?.connections ?? []).filter((c) => c.id !== connectionId);

    // Optimistic update
    setMoodboard((prev) => {
      if (!prev) return prev;
      return { ...prev, connections: updatedConnections };
    });

    // Persist to API
    try {
      const res = await saveConnections(updatedConnections);

      if (!res.ok) throw new Error("Failed to delete connection");
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
      position: moodboard?.items.length ?? 0,
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

  async function handleUploadFile(file: File, type: "IMAGE" | "FILE") {
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
        handleAddItem("IMAGE", data, { width: 280, height: 0, at: pendingPoint.current });
      } else {
        const data: FileCardData = {
          url: url ?? "",
          storageKey,
          originalName: originalName ?? file.name,
          mimeType: mimeType ?? file.type,
          bytes: bytes ?? file.size,
        };
        handleAddItem("FILE", data, { width: 280, height: 0, at: pendingPoint.current });
      }
    } catch (err) {
      console.error("[moodboard-view] upload error:", err);
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
        onResizeItem={handleResizeItem}
        onAddConnection={handleAddConnection}
        onDeleteConnection={handleDeleteConnection}
        onAddDrawing={handleAddDrawing}
        onUndoDelete={handleUndoDelete}
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

      {deleted && (
        <div
          role="status"
          className="absolute top-16 left-3 z-30 flex items-center gap-3 rounded-xl border border-[var(--av2-border)] bg-[var(--av2-surface)] py-1 pr-1 pl-4 text-sm text-[var(--av2-text)] shadow-sm"
        >
          Deleted
          <button
            type="button"
            onClick={handleUndoDelete}
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
