"use client";

import React, { useState, useRef, useEffect } from "react";
import type { ColorCardData } from "@/lib/moodboard";

type ColorCardProps = {
  data: ColorCardData;
  onUpdate: (data: ColorCardData) => void;
};

export function ColorCard({ data, onUpdate }: ColorCardProps) {
  const [editing, setEditing] = useState(false);
  const [hex, setHex] = useState(data.hex);
  const [name, setName] = useState(data.name ?? "");
  const hexRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) {
      setHex(data.hex);
      setName(data.name ?? "");
    }
  }, [data, editing]);

  useEffect(() => {
    if (editing) {
      hexRef.current?.focus();
    }
  }, [editing]);

  function saveAndExit() {
    const trimmedHex = hex.trim();
    const trimmedName = name.trim();

    // Validate hex — must be 3 or 6 hex digits with leading #
    const validHex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmedHex);
    const finalHex = validHex ? trimmedHex.toUpperCase() : data.hex;

    if (finalHex !== data.hex || trimmedName !== (data.name ?? "")) {
      onUpdate({
        hex: finalHex,
        name: trimmedName || undefined,
      });
    }
    setEditing(false);
  }

  return (
    <div>
      {/* Color swatch */}
      <div
        className="h-24 rounded-t-xl cursor-pointer border-b border-[var(--bb-border)]"
        style={{ backgroundColor: data.hex }}
        onClick={() => setEditing(true)}
      />

      {/* Info / editor area */}
      <div className="p-3">
        {editing ? (
          <div
            className="flex flex-col gap-2"
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                saveAndExit();
              }
            }}
          >
            <input
              ref={hexRef}
              type="text"
              value={hex}
              onChange={(e) => setHex(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveAndExit();
                if (e.key === "Escape") setEditing(false);
              }}
              placeholder="#F15B2B"
              className="text-sm font-mono text-[var(--bb-secondary)] bg-gray-50 rounded-lg px-2 py-1 border border-[var(--bb-border)] outline-none focus:border-[var(--bb-primary)]"
            />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveAndExit();
                if (e.key === "Escape") setEditing(false);
              }}
              placeholder="Color name (optional)"
              className="text-sm text-[var(--bb-secondary)] bg-gray-50 rounded-lg px-2 py-1 border border-[var(--bb-border)] outline-none focus:border-[var(--bb-primary)]"
            />
          </div>
        ) : (
          <div>
            <p className="text-sm font-mono text-[var(--bb-secondary)]">
              {data.hex}
            </p>
            {data.name && (
              <p className="text-xs text-[var(--bb-text-secondary)] mt-0.5">
                {data.name}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
