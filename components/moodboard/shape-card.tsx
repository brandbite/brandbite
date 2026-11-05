"use client";

import React, { useEffect, useRef, useState } from "react";

import type { ShapeCardData, ShapeKind } from "@/lib/moodboard";

type ShapeCardProps = {
  data: ShapeCardData;
  onUpdate: (data: ShapeCardData) => void;
  editRequest?: number;
};

/** Drawn in a 100x100 box that stretches with the object. The stroke doesn't scale. */
export function ShapeOutline({ kind, fill }: { kind: ShapeKind; fill: string }) {
  const common = {
    fill,
    stroke: "#4A4A4A",
    strokeWidth: 2,
    vectorEffect: "non-scaling-stroke" as const,
  };
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full overflow-visible"
    >
      {kind === "ellipse" && <ellipse cx="50" cy="50" rx="50" ry="50" {...common} />}
      {kind === "diamond" && <polygon points="50,0 100,50 50,100 0,50" {...common} />}
      {kind === "rect" && <rect x="0" y="0" width="100" height="100" rx="4" {...common} />}
    </svg>
  );
}

export function ShapeCard({ data, onUpdate, editRequest = 0 }: ShapeCardProps) {
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
    if (next !== data.text) onUpdate({ ...data, text: next });
    setEditing(false);
  }

  return (
    <div
      className="relative flex h-full w-full items-center justify-center text-[#292827]"
      onClick={() => setEditing(true)}
    >
      <ShapeOutline kind={data.kind} fill={data.fill} />
      <div className="relative flex w-[72%] items-center justify-center text-center text-base">
        {editing ? (
          <textarea
            ref={ref}
            value={text}
            rows={Math.max(1, text.split("\n").length)}
            onChange={(e) => setText(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Escape") e.currentTarget.blur();
            }}
            aria-label="Shape text"
            className="w-full resize-none bg-transparent text-center outline-none!"
          />
        ) : (
          <span className="break-words whitespace-pre-wrap">{data.text}</span>
        )}
      </div>
    </div>
  );
}
