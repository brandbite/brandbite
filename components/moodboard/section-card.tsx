"use client";

// -----------------------------------------------------------------------------
// @file: components/moodboard/section-card.tsx
// @purpose: A section: a named, tinted area that groups what's inside it.
//           Only the title tab takes the pointer; the area itself lets clicks
//           through, so objects inside stay easy to pick and a box selection
//           can start anywhere in it. Moving the section moves its contents
//           (BoardCanvas works out what's inside when the move starts).
// -----------------------------------------------------------------------------

import React, { useEffect, useRef, useState } from "react";

import type { SectionCardData } from "@/lib/moodboard";

type SectionCardProps = {
  data: SectionCardData;
  onUpdate: (data: SectionCardData) => void;
  editRequest?: number;
  readOnly?: boolean;
};

export function SectionCard({
  data,
  onUpdate,
  editRequest = 0,
  readOnly = false,
}: SectionCardProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(data.title);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setTitle(data.title);
  }, [data.title, editing]);

  useEffect(() => {
    if (editRequest && !readOnly) setEditing(true);
  }, [editRequest, readOnly]);

  useEffect(() => {
    if (editing) ref.current?.select();
  }, [editing]);

  function save() {
    const next = title.trim() || "Section";
    setEditing(false);
    if (next !== data.title) onUpdate({ ...data, title: next });
  }

  return (
    <div className="relative h-full w-full">
      <div
        aria-hidden
        className="h-full w-full rounded-2xl border-2"
        style={{
          backgroundColor: `${data.color}33`,
          borderColor: `${data.color}`,
        }}
      />
      <div
        data-mb-section-title
        className="pointer-events-auto absolute bottom-full left-0 mb-1.5 max-w-full origin-bottom-left"
        style={{ transform: "scale(var(--mb-inverse-zoom, 1))" }}
        onDoubleClick={() => !readOnly && setEditing(true)}
      >
        {editing ? (
          <input
            ref={ref}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
            }}
            aria-label="Section name"
            maxLength={80}
            className="h-8 w-64 rounded-lg border border-[var(--av2-accent)] bg-[var(--av2-surface)] px-2.5 text-sm font-semibold text-[var(--av2-text)] outline-none"
          />
        ) : (
          <span
            className="inline-flex h-8 max-w-full cursor-grab items-center truncate rounded-lg px-2.5 text-sm font-semibold text-[#292827]"
            style={{ backgroundColor: data.color }}
          >
            {data.title}
          </span>
        )}
      </div>
    </div>
  );
}
