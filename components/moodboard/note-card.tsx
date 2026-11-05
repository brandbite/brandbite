"use client";

import React, { useEffect, useRef, useState } from "react";
import DOMPurify from "isomorphic-dompurify";

import { STICKY_COLORS, type NoteCardData } from "@/lib/moodboard";

type NoteCardProps = {
  data: NoteCardData;
  onUpdate: (data: NoteCardData) => void;
  /** Changes when the canvas asks this note to start editing, as on creation. */
  editRequest?: number;
};

const ALLOWED_TAGS = ["p", "br", "strong", "em", "ul", "ol", "li", "a"];
const ALLOWED_ATTR = ["href", "target", "rel"];

/** Short notes read big, long ones shrink to fit, like a real sticky. */
function textSize(length: number) {
  if (length <= 40) return "text-xl leading-7";
  if (length <= 140) return "text-base leading-6";
  return "text-sm leading-5";
}

export function NoteCard({ data, onUpdate, editRequest = 0 }: NoteCardProps) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(data.body);
  const [title, setTitle] = useState(data.title ?? "");
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) {
      setBody(data.body);
      setTitle(data.title ?? "");
    }
  }, [data, editing]);

  useEffect(() => {
    if (editRequest) setEditing(true);
  }, [editRequest]);

  useEffect(() => {
    if (!editing) return;
    const el = bodyRef.current;
    el?.focus();
    el?.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);

  function save() {
    const nextBody = body.trim();
    const nextTitle = title.trim();
    if (nextBody !== data.body || nextTitle !== (data.title ?? "")) {
      onUpdate({ ...data, body: nextBody, title: nextTitle || undefined });
    }
    setEditing(false);
  }

  const color = data.color ?? STICKY_COLORS[0];
  // Sticky colors stay light in dark mode too, so the text on them stays dark.
  const sticky =
    "flex h-full flex-col rounded-[4px] p-5 text-[#292827] shadow-[0_6px_16px_rgba(0,0,0,0.16)]";

  if (editing) {
    return (
      <div
        className={sticky}
        style={{ backgroundColor: color }}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) save();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") (e.target as HTMLElement).blur();
        }}
      >
        {data.title !== undefined && data.title !== "" && (
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Note title"
            className="mb-1 w-full bg-transparent text-base font-semibold outline-none!"
          />
        )}
        <textarea
          ref={bodyRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Type something…"
          aria-label="Note text"
          className={`min-h-0 w-full flex-1 resize-none bg-transparent outline-none! placeholder:text-[#292827]/50 ${textSize(body.length)}`}
        />
      </div>
    );
  }

  const sanitizedBody = DOMPurify.sanitize(data.body, { ALLOWED_TAGS, ALLOWED_ATTR });

  return (
    <div className={sticky} style={{ backgroundColor: color }} onClick={() => setEditing(true)}>
      {data.title && <h3 className="mb-1 text-base font-semibold">{data.title}</h3>}
      {data.body ? (
        <div
          className={`min-h-0 overflow-hidden break-words whitespace-pre-wrap [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 ${textSize(data.body.length)}`}
          dangerouslySetInnerHTML={{ __html: sanitizedBody }}
        />
      ) : (
        <p className="text-base text-[#292827]/50">Type something…</p>
      )}
    </div>
  );
}
