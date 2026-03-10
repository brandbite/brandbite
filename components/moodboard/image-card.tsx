"use client";

import React, { useState, useRef, useEffect } from "react";
import type { ImageCardData } from "@/lib/moodboard";

type ImageCardProps = {
  data: ImageCardData;
  onUpdate: (data: ImageCardData) => void;
};

export function ImageCard({ data, onUpdate }: ImageCardProps) {
  const [editingCaption, setEditingCaption] = useState(false);
  const [caption, setCaption] = useState(data.caption ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editingCaption) {
      setCaption(data.caption ?? "");
    }
  }, [data.caption, editingCaption]);

  useEffect(() => {
    if (editingCaption) {
      inputRef.current?.focus();
    }
  }, [editingCaption]);

  function saveCaption() {
    const trimmed = caption.trim();
    if (trimmed !== (data.caption ?? "")) {
      onUpdate({ ...data, caption: trimmed || undefined });
    }
    setEditingCaption(false);
  }

  return (
    <div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={data.url}
        alt={data.caption || data.originalName || "Moodboard image"}
        className="w-full object-cover"
        style={{ aspectRatio: "auto" }}
      />

      <div className="px-4 py-2.5">
        {editingCaption ? (
          <input
            ref={inputRef}
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            onBlur={saveCaption}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveCaption();
              if (e.key === "Escape") setEditingCaption(false);
            }}
            placeholder="Add a caption..."
            className="w-full border-none bg-transparent text-sm text-[var(--bb-secondary)] outline-none placeholder:text-gray-400"
          />
        ) : (
          <p
            className="min-h-[1.25rem] cursor-pointer text-sm text-[var(--bb-text-secondary)]"
            onClick={() => setEditingCaption(true)}
          >
            {data.caption || <span className="text-gray-400 italic">Add a caption...</span>}
          </p>
        )}
      </div>
    </div>
  );
}
