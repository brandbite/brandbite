"use client";

import React, { useState, useRef, useEffect } from "react";
import type { TodoCardData, TodoItem } from "@/lib/moodboard";

type TodoCardProps = {
  data: TodoCardData;
  onUpdate: (data: TodoCardData) => void;
};

export function TodoCard({ data, onUpdate }: TodoCardProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(data.title ?? "");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemText, setEditingItemText] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);
  const itemRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingTitle) {
      titleRef.current?.focus();
    }
  }, [editingTitle]);

  useEffect(() => {
    if (editingItemId) {
      itemRef.current?.focus();
    }
  }, [editingItemId]);

  const checkedCount = data.items.filter((item) => item.checked).length;
  const totalCount = data.items.length;

  function toggleItem(id: string) {
    const updatedItems = data.items.map((item) =>
      item.id === id ? { ...item, checked: !item.checked } : item,
    );
    onUpdate({ ...data, items: updatedItems });
  }

  function saveTitle() {
    const trimmed = title.trim();
    if (trimmed !== (data.title ?? "")) {
      onUpdate({ ...data, title: trimmed || undefined });
    }
    setEditingTitle(false);
  }

  function startEditItem(item: TodoItem) {
    setEditingItemId(item.id);
    setEditingItemText(item.text);
  }

  function saveItem() {
    if (!editingItemId) return;
    const trimmed = editingItemText.trim();
    const updatedItems = data.items.map((item) =>
      item.id === editingItemId ? { ...item, text: trimmed } : item,
    );
    onUpdate({ ...data, items: updatedItems });
    setEditingItemId(null);
    setEditingItemText("");
  }

  function addItem() {
    const newItem: TodoItem = {
      id: crypto.randomUUID(),
      text: "",
      checked: false,
    };
    const updatedData = { ...data, items: [...data.items, newItem] };
    onUpdate(updatedData);
    // Start editing the new item
    setEditingItemId(newItem.id);
    setEditingItemText("");
  }

  return (
    <div className="p-4">
      {/* Title */}
      {editingTitle ? (
        <input
          ref={titleRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveTitle();
            if (e.key === "Escape") setEditingTitle(false);
          }}
          placeholder="List title (optional)"
          className="mb-2 w-full border-none bg-transparent text-sm font-semibold text-[var(--bb-secondary)] outline-none placeholder:text-gray-400"
        />
      ) : (
        <div
          className="mb-2 min-h-[1.25rem] cursor-pointer"
          onClick={() => {
            setTitle(data.title ?? "");
            setEditingTitle(true);
          }}
        >
          {data.title ? (
            <h3 className="text-sm font-semibold text-[var(--bb-secondary)]">{data.title}</h3>
          ) : (
            <p className="text-xs text-gray-400 italic">Click to add title...</p>
          )}
        </div>
      )}

      {/* Items */}
      <ul className="space-y-1.5">
        {data.items.map((item) => (
          <li key={item.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={item.checked}
              onChange={() => toggleItem(item.id)}
              className="h-4 w-4 flex-shrink-0 cursor-pointer rounded accent-[var(--bb-primary)]"
            />

            {editingItemId === item.id ? (
              <input
                ref={itemRef}
                type="text"
                value={editingItemText}
                onChange={(e) => setEditingItemText(e.target.value)}
                onBlur={saveItem}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveItem();
                  if (e.key === "Escape") {
                    setEditingItemId(null);
                    setEditingItemText("");
                  }
                }}
                placeholder="Item text..."
                className="flex-1 border-none bg-transparent text-sm text-[var(--bb-secondary)] outline-none placeholder:text-gray-400"
              />
            ) : (
              <span
                className={`flex-1 cursor-pointer text-sm ${
                  item.checked
                    ? "text-[var(--bb-text-secondary)] line-through"
                    : "text-[var(--bb-secondary)]"
                }`}
                onClick={() => startEditItem(item)}
              >
                {item.text || <span className="text-gray-400 italic">Empty item</span>}
              </span>
            )}
          </li>
        ))}
      </ul>

      {/* Footer: Add item + progress */}
      <div className="mt-3 flex items-center justify-between border-t border-[var(--bb-border)] pt-2">
        <button
          onClick={addItem}
          className="text-xs font-medium text-[var(--bb-primary)] hover:underline"
        >
          + Add item
        </button>
        <span className="text-xs text-[var(--bb-text-secondary)]">
          {checkedCount}/{totalCount} done
        </span>
      </div>
    </div>
  );
}
