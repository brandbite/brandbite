// -----------------------------------------------------------------------------
// @file: components/ui/tag-multi-select.tsx
// @purpose: Custom multi-select dropdown for ticket tags with inline creation
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-12-18
// -----------------------------------------------------------------------------

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { TagBadge } from "@/components/ui/tag-badge";
import {
  TAG_COLORS,
  TAG_COLOR_KEYS,
  type TagColorKey,
} from "@/lib/tag-colors";

export type TagOption = {
  id: string;
  name: string;
  color: TagColorKey;
};

type TagMultiSelectProps = {
  availableTags: TagOption[];
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
  onCreateTag?: (
    name: string,
    color: TagColorKey,
  ) => Promise<TagOption | null>;
  maxTags?: number;
  disabled?: boolean;
  canCreate?: boolean;
};

export function TagMultiSelect({
  availableTags,
  selectedTagIds,
  onChange,
  onCreateTag,
  maxTags = 5,
  disabled = false,
  canCreate = false,
}: TagMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<TagColorKey>("BLUE");
  const [saving, setSaving] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const atMax = selectedTagIds.length >= maxTags;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setCreating(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Focus search when opened
  useEffect(() => {
    if (open && searchRef.current) {
      searchRef.current.focus();
    }
  }, [open]);

  const toggleTag = useCallback(
    (tagId: string) => {
      if (selectedTagIds.includes(tagId)) {
        onChange(selectedTagIds.filter((id) => id !== tagId));
      } else if (!atMax) {
        onChange([...selectedTagIds, tagId]);
      }
    },
    [selectedTagIds, onChange, atMax],
  );

  const removeTag = useCallback(
    (tagId: string) => {
      onChange(selectedTagIds.filter((id) => id !== tagId));
    },
    [selectedTagIds, onChange],
  );

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed || !onCreateTag || saving) return;
    setSaving(true);
    try {
      const created = await onCreateTag(trimmed, newColor);
      if (created && !atMax) {
        onChange([...selectedTagIds, created.id]);
      }
      setNewName("");
      setNewColor("BLUE");
      setCreating(false);
    } finally {
      setSaving(false);
    }
  };

  const filteredTags = search.trim()
    ? availableTags.filter((t) =>
        t.name.toLowerCase().includes(search.trim().toLowerCase()),
      )
    : availableTags;

  const selectedTags = selectedTagIds
    .map((id) => availableTags.find((t) => t.id === id))
    .filter(Boolean) as TagOption[];

  return (
    <div ref={containerRef} className="relative">
      {/* Selected pills + trigger */}
      <div
        className={`flex min-h-[36px] flex-wrap items-center gap-1.5 rounded-lg border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-2.5 py-1.5 ${
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
        }`}
        onClick={() => {
          if (!disabled) setOpen(!open);
        }}
      >
        {selectedTags.map((tag) => (
          <TagBadge
            key={tag.id}
            name={tag.name}
            color={tag.color}
            onRemove={
              disabled ? undefined : () => removeTag(tag.id)
            }
          />
        ))}
        {selectedTags.length === 0 && (
          <span className="text-[13px] text-[var(--bb-text-tertiary)]">Add tags…</span>
        )}
        {!disabled && selectedTags.length > 0 && !atMax && (
          <span className="text-[11px] text-[var(--bb-text-tertiary)]">+ Tag</span>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[240px] rounded-lg border border-[var(--bb-border)] bg-[var(--bb-bg-page)] shadow-lg">
          {/* Search */}
          <div className="border-b border-[var(--bb-border)] px-3 py-2">
            <input
              ref={searchRef}
              type="text"
              placeholder="Search tags…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setOpen(false);
                  setCreating(false);
                  setSearch("");
                }
              }}
              className="w-full border-none bg-transparent text-[13px] text-[var(--bb-secondary)] placeholder:text-[var(--bb-text-tertiary)] focus:outline-none"
            />
          </div>

          {/* Tag list */}
          <div className="max-h-[200px] overflow-y-auto py-1">
            {filteredTags.length === 0 && (
              <div className="px-3 py-2 text-center text-[12px] text-[var(--bb-text-tertiary)]">
                No tags found
              </div>
            )}
            {filteredTags.map((tag) => {
              const selected = selectedTagIds.includes(tag.id);
              const disabledItem = atMax && !selected;

              return (
                <button
                  key={tag.id}
                  type="button"
                  disabled={disabledItem}
                  onClick={() => toggleTag(tag.id)}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] transition-colors ${
                    disabledItem
                      ? "cursor-not-allowed opacity-40"
                      : "hover:bg-[var(--bb-bg-card)]"
                  }`}
                >
                  {/* Checkbox indicator */}
                  <span
                    className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                      selected
                        ? "border-[var(--bb-primary)] bg-[var(--bb-primary)]"
                        : "border-[var(--bb-border-input)] bg-[var(--bb-bg-page)]"
                    }`}
                  >
                    {selected && (
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 10 10"
                        fill="none"
                      >
                        <path
                          d="M2 5L4 7L8 3"
                          stroke="white"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </span>
                  <TagBadge name={tag.name} color={tag.color} />
                </button>
              );
            })}
          </div>

          {/* Max tags notice */}
          {atMax && (
            <div className="border-t border-[var(--bb-border)] px-3 py-1.5 text-center text-[11px] text-[var(--bb-text-tertiary)]">
              Maximum {maxTags} tags reached
            </div>
          )}

          {/* Inline creation */}
          {canCreate && onCreateTag && (
            <div className="border-t border-[var(--bb-border)]">
              {!creating ? (
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-[12px] font-medium text-[var(--bb-primary)] hover:bg-[var(--bb-bg-card)]"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                  >
                    <path
                      d="M6 2.5V9.5M2.5 6H9.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                  Create new tag
                </button>
              ) : (
                <div className="space-y-2 px-3 py-2.5">
                  <input
                    type="text"
                    placeholder="Tag name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    maxLength={30}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleCreate();
                      }
                      if (e.key === "Escape") {
                        setCreating(false);
                        setNewName("");
                      }
                    }}
                    className="w-full rounded border border-[var(--bb-border)] px-2 py-1 text-[13px] text-[var(--bb-secondary)] focus:border-[var(--bb-primary)] focus:outline-none"
                    autoFocus
                  />
                  {/* Color picker */}
                  <div className="flex gap-1.5">
                    {TAG_COLOR_KEYS.map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setNewColor(key)}
                        className={`h-5 w-5 rounded-full border-2 transition-transform ${
                          newColor === key
                            ? "scale-110 border-[var(--bb-secondary)]"
                            : "border-transparent hover:scale-105"
                        }`}
                        style={{ backgroundColor: TAG_COLORS[key].dot }}
                        title={TAG_COLORS[key].label}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCreate}
                      disabled={!newName.trim() || saving}
                      className="rounded bg-[var(--bb-primary)] px-2.5 py-1 text-[12px] font-medium text-white hover:bg-[var(--bb-primary-hover)] disabled:opacity-50"
                    >
                      {saving ? "Creating…" : "Create"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCreating(false);
                        setNewName("");
                      }}
                      className="text-[12px] text-[var(--bb-text-tertiary)] hover:text-[var(--bb-secondary)]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
