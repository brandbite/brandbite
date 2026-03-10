"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

import { BoardToolbar } from "@/components/moodboard/board-toolbar";
import { BoardHeader } from "@/components/moodboard/board-header";
import { BoardCanvas } from "@/components/moodboard/board-canvas";
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
} from "@/lib/moodboard";
import { CANVAS_DEFAULTS, createConnection, DRAW_COLORS, DRAW_SIZES } from "@/lib/moodboard";
import type { ToolMode } from "@/components/moodboard/board-toolbar";

type MoodboardViewProps = {
  moodboardId: string;
};

type ModalType = "note" | "color" | "link" | "todo" | "embed" | null;

/** Find a non-overlapping position for a new item near the center of existing content. */
function findOpenPosition(items: MoodboardItemClient[], width: number): { x: number; y: number } {
  // Place the first item with breathing room from the canvas origin so it feels centered
  if (items.length === 0) return { x: 400, y: 260 };

  // Find bounding box of existing items
  let minX = Infinity;
  let maxY = 0;
  for (const item of items) {
    minX = Math.min(minX, item.x);
    maxY = Math.max(maxY, item.y + (item.height || 200));
  }

  const gap = CANVAS_DEFAULTS.GAP;
  const colBase = Math.max(40, minX); // Align new items with leftmost existing item
  const candidate = { x: colBase, y: maxY + gap };

  // Place below existing content in a grid, checking for overlap
  for (let row = 0; row < 20; row++) {
    for (let col = 0; col < 4; col++) {
      const cx = colBase + col * (CANVAS_DEFAULTS.CARD_WIDTH + gap);
      const cy = maxY + gap + row * (220 + gap);
      const overlaps = items.some(
        (item) =>
          cx < item.x + item.width + gap &&
          cx + width + gap > item.x &&
          cy < item.y + (item.height || 200) + gap &&
          cy + 200 + gap > item.y,
      );
      if (!overlaps) return { x: cx, y: cy };
    }
  }

  return candidate;
}

export function MoodboardView({ moodboardId }: MoodboardViewProps) {
  const router = useRouter();

  const [moodboard, setMoodboard] = useState<MoodboardClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [toolMode, setToolMode] = useState<ToolMode>("select");
  const [drawColor, setDrawColor] = useState<string>(DRAW_COLORS[0]);
  const [drawSize, setDrawSize] = useState<number>(DRAW_SIZES[1]); // 4px default

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
    const { x, y } = findOpenPosition(items, width);

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

  async function handleResizeItem(itemId: string, width: number, height: number) {
    setMoodboard((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((item) => (item.id === itemId ? { ...item, width, height } : item)),
      };
    });

    try {
      const res = await fetch(`/api/customer/moodboards/${moodboardId}/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ width, height }),
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
      <div className="flex h-[calc(100vh-64px)] items-center justify-center bg-[var(--bb-bg-page)]">
        <div className="text-sm text-[var(--bb-text-secondary)]">Loading moodboard...</div>
      </div>
    );
  }

  if (!moodboard) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center bg-[var(--bb-bg-page)]">
        <div className="text-center">
          <h3 className="text-sm font-semibold text-[var(--bb-secondary)]">Moodboard not found</h3>
          <button
            onClick={() => router.push("/customer/moodboards")}
            className="mt-2 text-sm text-[var(--bb-primary)] hover:underline"
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
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-[var(--bb-bg-page)]">
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

      <div className="flex flex-1 flex-col overflow-hidden">
        <BoardHeader
          title={moodboard.title}
          onTitleChange={handleUpdateTitle}
          projectName={moodboard.project?.name ?? undefined}
          onBack={() => router.push("/customer/moodboards")}
          onDelete={handleDeleteBoard}
        />

        <BoardCanvas
          items={moodboard.items}
          connections={moodboard.connections}
          toolMode={toolMode}
          drawColor={drawColor}
          drawSize={drawSize}
          onUpdateItem={handleUpdateItem}
          onDeleteItem={handleDeleteItem}
          onMoveItem={handleMoveItem}
          onResizeItem={handleResizeItem}
          onAddConnection={handleAddConnection}
          onDeleteConnection={handleDeleteConnection}
          onAddDrawing={handleAddDrawing}
        />
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
