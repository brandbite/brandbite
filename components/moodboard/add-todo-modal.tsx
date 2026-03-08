"use client";

import React, { useState } from "react";
import { Modal, ModalHeader } from "@/components/ui/modal";
import type { TodoCardData } from "@/lib/moodboard";

type AddTodoModalProps = {
  open: boolean;
  onClose: () => void;
  onSave: (data: TodoCardData) => void;
};

export function AddTodoModal({ open, onClose, onSave }: AddTodoModalProps) {
  const [title, setTitle] = useState("");
  const [items, setItems] = useState(["", "", ""]);

  function handleClose() {
    setTitle("");
    setItems(["", "", ""]);
    onClose();
  }

  function handleSave() {
    const validItems = items
      .map((text) => text.trim())
      .filter((text) => text.length > 0);

    if (validItems.length === 0) return;

    onSave({
      title: title.trim() || undefined,
      items: validItems.map((text) => ({
        id: crypto.randomUUID(),
        text,
        checked: false,
      })),
    });

    setTitle("");
    setItems(["", "", ""]);
    onClose();
  }

  function updateItem(index: number, value: string) {
    setItems((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function addItem() {
    setItems((prev) => [...prev, ""]);
  }

  function removeItem(index: number) {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const hasValidItems = items.some((text) => text.trim().length > 0);

  return (
    <Modal open={open} onClose={handleClose} size="md" scrollable>
      <ModalHeader title="Add Checklist" onClose={handleClose} />

      <div className="space-y-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="List title (optional)"
          className="w-full rounded-lg border border-[var(--bb-border)] bg-white px-3 py-2 text-sm text-[var(--bb-secondary)] outline-none placeholder:text-gray-400 focus:border-[var(--bb-primary)]"
        />

        <div className="space-y-2">
          <p className="text-xs font-medium text-[var(--bb-text-secondary)]">
            Items
          </p>
          {items.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border border-gray-300">
                <div className="h-2 w-2 rounded-sm bg-gray-200" />
              </div>
              <input
                type="text"
                value={item}
                onChange={(e) => updateItem(index, e.target.value)}
                placeholder={`Item ${index + 1}`}
                className="flex-1 rounded-lg border border-[var(--bb-border)] bg-white px-3 py-1.5 text-sm text-[var(--bb-secondary)] outline-none placeholder:text-gray-400 focus:border-[var(--bb-primary)]"
              />
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                  aria-label="Remove item"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path
                      d="M3.5 3.5L10.5 10.5M10.5 3.5L3.5 10.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addItem}
          className="text-xs font-medium text-[var(--bb-primary)] transition-colors hover:underline"
        >
          + Add item
        </button>
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
          disabled={!hasValidItems}
          className="rounded-lg bg-[var(--bb-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--bb-primary-hover)] disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </Modal>
  );
}
