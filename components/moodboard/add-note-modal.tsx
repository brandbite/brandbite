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
          className="w-full rounded-lg border border-[var(--av2-border)] bg-[var(--av2-surface)] px-3 py-2 text-sm text-[var(--av2-text)] outline-none placeholder:text-[var(--av2-text-2)] focus:border-[var(--av2-accent)]"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write something..."
          rows={5}
          className="w-full resize-none rounded-lg border border-[var(--av2-border)] bg-[var(--av2-surface)] px-3 py-2 text-sm text-[var(--av2-text)] outline-none placeholder:text-[var(--av2-text-2)] focus:border-[var(--av2-accent)]"
        />
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={handleClose}
          className="rounded-lg border border-[var(--av2-border)] px-4 py-2 text-sm font-medium text-[var(--av2-text)] transition-colors hover:bg-[var(--av2-bg)]"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!body.trim()}
          className="rounded-lg bg-[var(--av2-accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--av2-accent-strong)] disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </Modal>
  );
}
