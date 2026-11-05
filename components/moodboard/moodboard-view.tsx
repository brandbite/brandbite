"use client";

import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

import { BoardToolbar } from "@/components/moodboard/board-toolbar";
import { BoardHeader } from "@/components/moodboard/board-header";
import { BoardCanvas, type BoardCanvasHandle } from "@/components/moodboard/board-canvas";
import { AddNoteModal } from "@/components/moodboard/add-note-modal";
import { AddColorModal } from "@/components/moodboard/add-color-modal";
import { AddLinkModal } from "@/components/moodboard/add-link-modal";
import { AddTodoModal } from "@/components/moodboard/add-todo-modal";
import { AddEmbedModal } from "@/components/moodboard/add-embed-modal";

import type {
  MoodboardClient,
  MoodboardItemClient,
  MoodboardItemData,
  NoteCardData,
  ColorCardData,
  LinkCardData,
  TodoCardData,
  ImageCardData,
  FileCardData,
  EmbedCardData,
  DrawingCardData,
  MoodboardConnection,
} from "@/lib/moodboard";
import { CANVAS_DEFAULTS, createConnection, DRAW_COLORS, DRAW_SIZES } from "@/lib/moodboard";
import type { ToolMode } from "@/components/moodboard/board-toolbar";

type MoodboardViewProps = {
  moodboardId: string;
};

type ModalType = "note" | "color" | "link" | "todo" | "embed" | null;

/** How long the Undo offer stays on screen after deleting. */
const UNDO_MS = 8000;
const CASCADE_PX = 24;

type DeletedItem = { item: MoodboardItemClient; connections: MoodboardConnection[] };

/** The middle of the view, stepped diagonally so new cards don't stack exactly. */
function placeNear(
  center: { x: number; y: number },
  items: MoodboardItemClient[],
  width: number,
): { x: number; y: number } {
  let x = Math.round(center.x - width / 2);
  let y = Math.round(center.y - 100);
  while (items.some((i) => Math.abs(i.x - x) < CASCADE_PX && Math.abs(i.y - y) < CASCADE_PX)) {
    x += CASCADE_PX;
    y += CASCADE_PX;
  }
  return { x, y };
}

export function MoodboardView({ moodboardId }: MoodboardViewProps) {
  const router = useRouter();

  const [moodboard, setMoodboard] = useState<MoodboardClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [toolMode, setToolMode] = useState<ToolMode>("select");
  const [drawColor, setDrawColor] = useState<string>(DRAW_COLORS[0]);
  const [drawSize, setDrawSize] = useState<number>(DRAW_SIZES[1]); // 4px default

  const [deleted, setDeleted] = useState<DeletedItem | null>(null);

  const canvasHandle = useRef<BoardCanvasHandle | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---------------------------------------------------------------------------
  // Fetch moodboard
  // ---------------------------------------------------------------------------

  const fetchMoodboard = useCallback(async () => {
    try {
      const res = await fetch(`/api/customer/moodboards/${moodboardId}`);
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
    if (!root) return;
    const fit = () => {
      const top = root.getBoundingClientRect().top + window.scrollY;
      const bottomGap = parseFloat(getComputedStyle(root.parentElement!).paddingBottom) || 0;
      root.style.height = `${Math.max(420, window.innerHeight - top - bottomGap)}px`;
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [loading]);

  useEffect(() => {
    if (!deleted) return;
    const timer = setTimeout(() => setDeleted(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [deleted]);

  // ---------------------------------------------------------------------------
  // Add item (with canvas position)
  // ---------------------------------------------------------------------------

  async function handleAddItem(
    type: string,
    data: MoodboardItemData,
    opts?: { width?: number; height?: number },
  ) {
    const items = moodboard?.items ?? [];
    const width = opts?.width ?? CANVAS_DEFAULTS.CARD_WIDTH;
    const height = opts?.height ?? CANVAS_DEFAULTS.CARD_HEIGHT;
    const center = canvasHandle.current?.viewCenter() ?? { x: 400, y: 260 };
    const { x, y } = placeNear(center, items, width);

    try {
      const res = await fetch(`/api/customer/moodboards/${moodboardId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, data, x, y, width, height }),
      });

      if (!res.ok) throw new Error("Failed to add item");

      const json = await res.json();
      const newItem: MoodboardItemClient = json.item;

      setMoodboard((prev) => {
        if (!prev) return prev;
        return { ...prev, items: [...prev.items, newItem] };
      });
      canvasHandle.current?.selectCard(newItem.id);
    } catch (err) {
      console.error("[moodboard-view] add item error:", err);
    }
  }

  // ---------------------------------------------------------------------------
  // Update item data
  // ---------------------------------------------------------------------------

  async function handleUpdateItem(itemId: string, data: MoodboardItemData) {
    setMoodboard((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((item) => (item.id === itemId ? { ...item, data } : item)),
      };
    });

    try {
      const res = await fetch(`/api/customer/moodboards/${moodboardId}/items/${itemId}`, {
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
      const res = await fetch(`/api/customer/moodboards/${moodboardId}/items/${itemId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete item");

      // If connections were cleaned up, persist that too
      if (orphanedConns.length > 0) {
        await fetch(`/api/customer/moodboards/${moodboardId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connections: cleanedConnections }),
        });
      }
    } catch (err) {
      console.error("[moodboard-view] delete item error:", err);
      fetchMoodboard();
    }
  }

  // Deleting is one key away on the canvas, so the last delete can be taken back.
  // The card comes back as a new row, with its arrows pointed at the new id.
  async function handleUndoDelete() {
    if (!deleted) return;
    const { item, connections } = deleted;
    setDeleted(null);

    try {
      const res = await fetch(`/api/customer/moodboards/${moodboardId}/items`, {
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
        await fetch(`/api/customer/moodboards/${moodboardId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connections: nextConnections }),
        });
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
      const res = await fetch(`/api/customer/moodboards/${moodboardId}/items/${itemId}`, {
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
      const res = await fetch(`/api/customer/moodboards/${moodboardId}/items/${itemId}`, {
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
      const res = await fetch(`/api/customer/moodboards/${moodboardId}`, {
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
      const res = await fetch(`/api/customer/moodboards/${moodboardId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete moodboard");

      router.push("/customer/moodboards");
    } catch (err) {
      console.error("[moodboard-view] delete board error:", err);
    }
  }

  // ---------------------------------------------------------------------------
  // Connections (arrows between cards)
  // ---------------------------------------------------------------------------

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
      const res = await fetch(`/api/customer/moodboards/${moodboardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connections: updatedConnections }),
      });

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
      const res = await fetch(`/api/customer/moodboards/${moodboardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connections: updatedConnections }),
      });

      if (!res.ok) throw new Error("Failed to delete connection");
    } catch (err) {
      console.error("[moodboard-view] delete connection error:", err);
      fetchMoodboard();
    }
  }

  // ---------------------------------------------------------------------------
  // Freehand drawing
  // ---------------------------------------------------------------------------

  async function handleAddDrawing(
    data: DrawingCardData,
    bounds: { x: number; y: number; w: number; h: number },
  ) {
    try {
      const res = await fetch(`/api/customer/moodboards/${moodboardId}/items`, {
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
      });

      if (!res.ok) throw new Error("Failed to save drawing");

      const json = await res.json();
      const newItem: MoodboardItemClient = json.item;

      setMoodboard((prev) => {
        if (!prev) return prev;
        return { ...prev, items: [...prev.items, newItem] };
      });
    } catch (err) {
      console.error("[moodboard-view] add drawing error:", err);
    }
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
        await handleAddItem("IMAGE", data);
      } else {
        const data: FileCardData = {
          url: url ?? "",
          storageKey,
          originalName: originalName ?? file.name,
          mimeType: mimeType ?? file.type,
          bytes: bytes ?? file.size,
        };
        await handleAddItem("FILE", data);
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

  function handleAddNoteData(data: NoteCardData) {
    handleAddItem("NOTE", data);
  }

  function handleAddColorData(data: ColorCardData) {
    handleAddItem("COLOR", data, { width: 200, height: 160 });
  }

  function handleAddLinkData(data: LinkCardData) {
    handleAddItem("LINK", data);
  }

  function handleAddTodoData(data: TodoCardData) {
    handleAddItem("TODO", data);
  }

  function handleAddEmbedData(data: EmbedCardData) {
    handleAddItem("EMBED", data, { width: 420, height: 280 });
  }

  function handleImageClick() {
    imageInputRef.current?.click();
  }

  function handleFileClick() {
    fileInputRef.current?.click();
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
            onClick={() => router.push("/customer/moodboards")}
            className="mt-2 min-h-10 text-sm font-medium text-[var(--av2-link)] hover:underline"
          >
            Back to moodboards
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div ref={rootRef} className="flex flex-col gap-4">
      <BoardHeader
        title={moodboard.title}
        itemCount={moodboard.items.filter((i) => i.type !== "DRAWING").length}
        onTitleChange={handleUpdateTitle}
        onBack={() => router.push("/customer/moodboards")}
        onDelete={handleDeleteBoard}
      />

      <BoardToolbar
        onAddNote={() => setActiveModal("note")}
        onAddImage={handleImageClick}
        onAddColor={() => setActiveModal("color")}
        onAddLink={() => setActiveModal("link")}
        onAddFile={handleFileClick}
        onAddTodo={() => setActiveModal("todo")}
        onAddEmbed={() => setActiveModal("embed")}
        toolMode={toolMode}
        onSetToolMode={setToolMode}
        drawColor={drawColor}
        drawSize={drawSize}
        onSetDrawColor={setDrawColor}
        onSetDrawSize={setDrawSize}
      />

      <div className="relative flex min-h-0 flex-1 flex-col">
        <BoardCanvas
          items={moodboard.items}
          connections={moodboard.connections}
          toolMode={toolMode}
          drawColor={drawColor}
          drawSize={drawSize}
          handleRef={canvasHandle}
          onSetToolMode={setToolMode}
          onUpdateItem={handleUpdateItem}
          onDeleteItem={handleDeleteItem}
          onMoveItem={handleMoveItem}
          onResizeItem={handleResizeItem}
          onAddConnection={handleAddConnection}
          onDeleteConnection={handleDeleteConnection}
          onAddDrawing={handleAddDrawing}
          onUndoDelete={handleUndoDelete}
        />

        {deleted && (
          <div
            role="status"
            className="absolute bottom-4 left-4 z-20 flex items-center gap-3 rounded-xl border border-[var(--av2-border)] bg-[var(--av2-surface)] py-1 pr-1 pl-4 text-sm text-[var(--av2-text)] shadow-sm"
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
      </div>

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
      <AddNoteModal open={activeModal === "note"} onClose={closeModal} onSave={handleAddNoteData} />
      <AddColorModal
        open={activeModal === "color"}
        onClose={closeModal}
        onSave={handleAddColorData}
      />
      <AddLinkModal open={activeModal === "link"} onClose={closeModal} onSave={handleAddLinkData} />
      <AddTodoModal open={activeModal === "todo"} onClose={closeModal} onSave={handleAddTodoData} />
      <AddEmbedModal
        open={activeModal === "embed"}
        onClose={closeModal}
        onSave={handleAddEmbedData}
      />
    </div>
  );
}
