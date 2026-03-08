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
} from "@/lib/moodboard";

type MoodboardViewProps = {
  moodboardId: string;
};

type ModalType = "note" | "color" | "link" | "todo" | null;

export function MoodboardView({ moodboardId }: MoodboardViewProps) {
  const router = useRouter();

  const [moodboard, setMoodboard] = useState<MoodboardClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState<ModalType>(null);

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
  // Add item (generic)
  // ---------------------------------------------------------------------------

  async function handleAddItem(
    type: string,
    data: MoodboardItemData,
    colSpan?: number,
  ) {
    try {
      const res = await fetch(
        `/api/customer/moodboards/${moodboardId}/items`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, data, colSpan }),
        },
      );

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
  // Update item
  // ---------------------------------------------------------------------------

  async function handleUpdateItem(itemId: string, data: MoodboardItemData) {
    // Optimistic update
    setMoodboard((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((item) =>
          item.id === itemId ? { ...item, data } : item,
        ),
      };
    });

    try {
      const res = await fetch(
        `/api/customer/moodboards/${moodboardId}/items/${itemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data }),
        },
      );

      if (!res.ok) throw new Error("Failed to update item");
    } catch (err) {
      console.error("[moodboard-view] update item error:", err);
      // Refetch on error to restore correct state
      fetchMoodboard();
    }
  }

  // ---------------------------------------------------------------------------
  // Delete item
  // ---------------------------------------------------------------------------

  async function handleDeleteItem(itemId: string) {
    // Optimistic update
    setMoodboard((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.filter((item) => item.id !== itemId),
      };
    });

    try {
      const res = await fetch(
        `/api/customer/moodboards/${moodboardId}/items/${itemId}`,
        { method: "DELETE" },
      );

      if (!res.ok) throw new Error("Failed to delete item");
    } catch (err) {
      console.error("[moodboard-view] delete item error:", err);
      fetchMoodboard();
    }
  }

  // ---------------------------------------------------------------------------
  // Toggle item width
  // ---------------------------------------------------------------------------

  async function handleToggleItemWidth(itemId: string) {
    const item = moodboard?.items.find((i) => i.id === itemId);
    if (!item) return;

    const newColSpan = item.colSpan === 1 ? 2 : 1;

    // Optimistic update
    setMoodboard((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((i) =>
          i.id === itemId ? { ...i, colSpan: newColSpan } : i,
        ),
      };
    });

    try {
      const res = await fetch(
        `/api/customer/moodboards/${moodboardId}/items/${itemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ colSpan: newColSpan }),
        },
      );

      if (!res.ok) throw new Error("Failed to toggle width");
    } catch (err) {
      console.error("[moodboard-view] toggle width error:", err);
      fetchMoodboard();
    }
  }

  // ---------------------------------------------------------------------------
  // Reorder items
  // ---------------------------------------------------------------------------

  async function handleReorder(orderedIds: string[]) {
    // Optimistic reorder
    setMoodboard((prev) => {
      if (!prev) return prev;
      const itemMap = new Map(prev.items.map((item) => [item.id, item]));
      const reordered = orderedIds
        .map((id) => itemMap.get(id))
        .filter((item): item is MoodboardItemClient => !!item);

      return { ...prev, items: reordered };
    });

    try {
      const res = await fetch(
        `/api/customer/moodboards/${moodboardId}/items/reorder`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderedItemIds: orderedIds }),
        },
      );

      if (!res.ok) throw new Error("Failed to reorder");
    } catch (err) {
      console.error("[moodboard-view] reorder error:", err);
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
  // File upload (image or file)
  // ---------------------------------------------------------------------------

  async function handleUploadFile(file: File, type: "IMAGE" | "FILE") {
    try {
      // Step 1: Get presigned URL
      const presignRes = await fetch("/api/uploads/r2/moodboard-presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moodboardId,
          contentType: file.type,
          bytes: file.size,
          originalName: file.name,
        }),
      });

      if (!presignRes.ok) throw new Error("Failed to get presigned URL");

      const { uploadUrl, storageKey } = await presignRes.json();

      // Step 2: Upload to R2
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadRes.ok) throw new Error("Failed to upload file");

      // Step 3: Build public URL
      const publicUrl = `${process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL || ""}/${storageKey}`;

      // Step 4: Create the moodboard item
      if (type === "IMAGE") {
        const data: ImageCardData = {
          url: publicUrl,
          storageKey,
          originalName: file.name,
          mimeType: file.type,
          bytes: file.size,
        };
        await handleAddItem("IMAGE", data);
      } else {
        const data: FileCardData = {
          url: publicUrl,
          storageKey,
          originalName: file.name,
          mimeType: file.type,
          bytes: file.size,
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
    handleAddItem("COLOR", data);
  }

  function handleAddLinkData(data: LinkCardData) {
    handleAddItem("LINK", data);
  }

  function handleAddTodoData(data: TodoCardData) {
    handleAddItem("TODO", data);
  }

  function handleImageClick() {
    imageInputRef.current?.click();
  }

  function handleFileClick() {
    fileInputRef.current?.click();
  }

  function onImageInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      handleUploadFile(file, "IMAGE");
    }
    // Reset so the same file can be selected again
    e.target.value = "";
  }

  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      handleUploadFile(file, "FILE");
    }
    e.target.value = "";
  }

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center bg-[var(--bb-bg-page)]">
        <div className="text-sm text-[var(--bb-text-secondary)]">
          Loading moodboard...
        </div>
      </div>
    );
  }

  if (!moodboard) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center bg-[var(--bb-bg-page)]">
        <div className="text-center">
          <h3 className="text-sm font-semibold text-[var(--bb-secondary)]">
            Moodboard not found
          </h3>
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
    <div className="flex h-[calc(100vh-64px)] bg-[var(--bb-bg-page)]">
      <BoardToolbar
        onAddNote={() => setActiveModal("note")}
        onAddImage={handleImageClick}
        onAddColor={() => setActiveModal("color")}
        onAddLink={() => setActiveModal("link")}
        onAddFile={handleFileClick}
        onAddTodo={() => setActiveModal("todo")}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <BoardHeader
          title={moodboard.title}
          onTitleChange={handleUpdateTitle}
          projectName={moodboard.project?.name ?? undefined}
          onBack={() => router.push("/customer/moodboards")}
          onDelete={handleDeleteBoard}
        />

        <div className="flex-1 overflow-auto">
          <BoardCanvas
            items={moodboard.items}
            onReorder={handleReorder}
            onUpdateItem={handleUpdateItem}
            onDeleteItem={handleDeleteItem}
            onToggleItemWidth={handleToggleItemWidth}
          />
        </div>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onImageInputChange}
      />
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={onFileInputChange}
      />

      {/* Modals */}
      <AddNoteModal
        open={activeModal === "note"}
        onClose={closeModal}
        onSave={handleAddNoteData}
      />
      <AddColorModal
        open={activeModal === "color"}
        onClose={closeModal}
        onSave={handleAddColorData}
      />
      <AddLinkModal
        open={activeModal === "link"}
        onClose={closeModal}
        onSave={handleAddLinkData}
      />
      <AddTodoModal
        open={activeModal === "todo"}
        onClose={closeModal}
        onSave={handleAddTodoData}
      />
    </div>
  );
}
