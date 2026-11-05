"use client";

import React, { useEffect, useRef, useState } from "react";

import type { TextCardData } from "@/lib/moodboard";

type TextCardProps = {
  data: TextCardData;
  onUpdate: (data: TextCardData) => void;
  /** Text left empty disappears, since nothing would be left to click on. */
  onEmpty: () => void;
  editRequest?: number;
};

export function TextCard({ data, onUpdate, onEmpty, editRequest = 0 }: TextCardProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(data.text);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) setText(data.text);
  }, [data.text, editing]);

  useEffect(() => {
    if (editRequest) setEditing(true);
  }, [editRequest]);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  function save() {
    const next = text.trim();
    setEditing(false);
    if (!next) onEmpty();
    else if (next !== data.text) onUpdate({ text: next });
  }

  const typography = "w-full text-xl leading-7 font-medium text-[var(--av2-text)]";

  if (editing) {
    return (
      <textarea
        ref={ref}
        value={text}
        rows={Math.max(1, text.split("\n").length)}
        onChange={(e) => setText(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Escape") e.currentTarget.blur();
        }}
        placeholder="Type something…"
        aria-label="Text"
        className={`${typography} block resize-none bg-transparent outline-none! placeholder:text-[var(--av2-text-2)]`}
      />
    );
  }

  return (
    <div
      className={`${typography} break-words whitespace-pre-wrap`}
      onClick={() => setEditing(true)}
    >
      {data.text}
    </div>
  );
}
