"use client";

import React, { useState } from "react";
import { Modal, ModalHeader } from "@/components/ui/modal";
import type { NoteCardData } from "@/lib/moodboard";

type AddNoteModalProps = {
  open: boolean;
  onClose: () => void;
  onSave: (data: NoteCardData) => void;
};

export function AddNoteModal({ open, onClose, onSave }: AddNoteModalProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  function handleClose() {
    setTitle("");
    setBody("");
    onClose();
  }

  function handleSave() {
    const trimmedBody = body.trim();
    if (!trimmedBody) return;

    onSave({
      title: title.trim() || undefined,
      body: trimmedBody,
    });

    setTitle("");
    setBody("");
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} size="md">
      <ModalHeader title="Add Note" onClose={handleClose} />

      <div className="space-y-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional)"
          className="w-full rounded-lg border border-[var(--bb-border)] bg-white px-3 py-2 text-sm text-[var(--bb-secondary)] outline-none placeholder:text-gray-400 focus:border-[var(--bb-primary)]"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write something..."
          rows={5}
          className="w-full rounded-lg border border-[var(--bb-border)] bg-white px-3 py-2 text-sm text-[var(--bb-secondary)] outline-none placeholder:text-gray-400 focus:border-[var(--bb-primary)] resize-none"
        />
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={handleClose}
          className="rounded-lg border border-[var(--bb-border)] px-4 py-2 text-sm font-medium text-[var(--bb-secondary)] transition-colors hover:bg-[var(--bb-bg-warm)]"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!body.trim()}
          className="rounded-lg bg-[var(--bb-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--bb-primary-hover)] disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </Modal>
  );
}
