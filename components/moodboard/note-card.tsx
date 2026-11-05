"use client";

import React, { useState, useRef, useEffect } from "react";
import DOMPurify from "isomorphic-dompurify";
import type { NoteCardData } from "@/lib/moodboard";

type NoteCardProps = {
  data: NoteCardData;
  onUpdate: (data: NoteCardData) => void;
};

const ALLOWED_TAGS = ["p", "br", "strong", "em", "ul", "ol", "li", "a"];
const ALLOWED_ATTR = ["href", "target", "rel"];

export function NoteCard({ data, onUpdate }: NoteCardProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(data.title ?? "");
  const [body, setBody] = useState(data.body);
  const titleRef = useRef<HTMLInputElement>(null);

  // Sync from parent when data changes externally
  useEffect(() => {
    if (!editing) {
      setTitle(data.title ?? "");
      setBody(data.body);
    }
  }, [data, editing]);

  function enterEdit() {
    setEditing(true);
    // Focus the title input after render
    setTimeout(() => titleRef.current?.focus(), 0);
  }

  function saveAndExit() {
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();

    // Only call onUpdate if something changed
    if (trimmedTitle !== (data.title ?? "") || trimmedBody !== data.body) {
      onUpdate({
        title: trimmedTitle || undefined,
        body: trimmedBody,
      });
    }
    setEditing(false);
  }

  if (editing) {
    return (
      <div
        className="p-4"
        onBlur={(e) => {
          // Only save if focus leaves the entire card editing area
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            saveAndExit();
          }
        }}
      >
        <input
          ref={titleRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional)"
          className="mb-2 w-full border-none bg-transparent text-sm font-semibold text-[var(--av2-text)] outline-none placeholder:text-[var(--av2-text-2)]"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write something..."
          rows={4}
          className="w-full resize-none border-none bg-transparent text-sm text-[var(--av2-text-2)] outline-none placeholder:text-[var(--av2-text-2)]"
        />
      </div>
    );
  }

  const sanitizedBody = DOMPurify.sanitize(data.body, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  });

  return (
    <div className="h-full min-h-[4rem] p-4" onClick={enterEdit}>
      {data.title && (
        <h3 className="mb-1 text-[13px] leading-snug font-semibold text-[var(--av2-text)]">
          {data.title}
        </h3>
      )}
      {data.body ? (
        <div
          className="bb-rich-text text-[13px] leading-relaxed text-[var(--av2-text-2)]"
          dangerouslySetInnerHTML={{ __html: sanitizedBody }}
        />
      ) : (
        <p className="text-sm text-[var(--av2-text-2)] italic">Click to add a note...</p>
      )}
    </div>
  );
}
