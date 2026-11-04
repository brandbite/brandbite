// -----------------------------------------------------------------------------
// @file: components/colors/studio/palette-parts.tsx
// @purpose: Pieces several Color Studio tools share: role fields, the save action,
//           the saved-palettes strip, copyable value rows, and a segmented control.
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";

import { Modal, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast-provider";
import {
  COLOR_ROLES,
  formatHex,
  setStudioRole,
  type ColorRole,
  type StudioPalette,
  type StudioSource,
} from "@/lib/colors";

import { CheckIcon, CopyIcon } from "./icons";
import { StudioButton } from "./studio-button";
import type { useSavedPalettes } from "./use-saved-palettes";
import { useStudioCopy } from "./use-studio-copy";

type SavedPalettesStore = ReturnType<typeof useSavedPalettes>;

export const STUDIO_FIELD =
  "h-12 rounded-[10px] border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-sm leading-5";

const ROLE_LABELS: Record<ColorRole, string> = {
  background: "Background",
  text: "Text",
  primary: "Primary",
  accent: "Accent",
  surface: "Surface",
};

/** Assign each design role to a palette color. One color may hold several roles. */
export function RoleFields({
  palette,
  onChange,
}: {
  palette: StudioPalette;
  onChange: (palette: StudioPalette) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 max-[479px]:grid-cols-1">
      {COLOR_ROLES.map((role) => {
        const assigned = palette.colors.find((c) => c.id === palette.roles[role]);
        return (
          <label key={role} className="text-sm leading-5 font-medium">
            {ROLE_LABELS[role]}
            <span className="mt-1 flex items-center gap-2">
              <span
                className="h-8 w-8 shrink-0 rounded-lg border border-[var(--cs-border)]"
                style={{ backgroundColor: assigned?.hex ?? "transparent" }}
              />
              <select
                value={palette.roles[role] ?? ""}
                onChange={(event) =>
                  onChange(setStudioRole(palette, role, event.target.value || null))
                }
                className={`${STUDIO_FIELD} block w-full min-w-0 font-mono`}
              >
                <option value="">Not set</option>
                {palette.colors.map((color) => (
                  <option key={color.id} value={color.id}>
                    {formatHex(color.hex)}
                  </option>
                ))}
              </select>
            </span>
          </label>
        );
      })}
    </div>
  );
}

/**
 * Saves straight away if the palette is already in the collection; otherwise asks
 * for a name first. Success is only reported after the store confirms the write.
 */
export function SavePaletteAction({
  palette,
  store,
  onSaved,
  variant = "secondary",
}: {
  palette: StudioPalette;
  store: SavedPalettesStore;
  onSaved?: (saved: StudioPalette) => void;
  variant?: "primary" | "secondary";
}) {
  const nameId = useId();
  const { showToast } = useToast();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exists = store.palettes.some((p) => p.id === palette.id);

  const commit = async (toSave: StudioPalette) => {
    setSaving(true);
    setError(null);
    const result = await store.save({ ...toSave, updatedAt: new Date().toISOString() });
    setSaving(false);
    if (result.ok) {
      setNaming(false);
      showToast({ type: "success", title: "Palette saved", durationMs: 3000 });
      onSaved?.(result.value);
    } else {
      setError(result.message);
    }
  };

  return (
    <>
      <StudioButton
        variant={variant}
        loading={saving && !naming}
        disabled={store.status !== "ready"}
        onClick={() => {
          if (exists) {
            void commit(palette);
          } else {
            setName(palette.name);
            setError(null);
            setNaming(true);
          }
        }}
      >
        {exists ? "Save changes" : "Save palette"}
      </StudioButton>
      {error && !naming ? (
        <p role="alert" className="w-full text-sm leading-5 text-[var(--cs-danger)]">
          {error}
        </p>
      ) : null}
      <Modal open={naming} onClose={() => setNaming(false)} size="sm">
        <ModalHeader
          title="Save this palette"
          subtitle={
            store.mode === "account"
              ? "It will be saved to your account."
              : "It will be saved in this browser."
          }
          onClose={() => setNaming(false)}
        />
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = name.trim();
            if (trimmed) void commit({ ...palette, name: trimmed });
          }}
        >
          <label htmlFor={nameId} className="mb-2 block text-sm leading-5 font-medium">
            Palette name
          </label>
          <input
            id={nameId}
            value={name}
            maxLength={80}
            autoFocus
            onChange={(event) => setName(event.target.value)}
            className={`${STUDIO_FIELD} w-full`}
          />
          {error ? (
            <p role="alert" className="mt-2 text-sm leading-5 text-[var(--cs-danger)]">
              {error}
            </p>
          ) : null}
          <ModalFooter>
            <StudioButton variant="secondary" onClick={() => setNaming(false)}>
              Cancel
            </StudioButton>
            <StudioButton type="submit" loading={saving} disabled={!name.trim()}>
              Save
            </StudioButton>
          </ModalFooter>
        </form>
      </Modal>
    </>
  );
}

/** A filtered view of the shared collection, not a separate list. */
export function SavedPalettesStrip({
  store,
  source,
  onOpen,
}: {
  store: SavedPalettesStore;
  source?: StudioSource;
  onOpen: (palette: StudioPalette) => void;
}) {
  if (store.status !== "ready") return null;
  const matching = source ? store.palettes.filter((p) => p.sourceTool === source) : store.palettes;
  if (matching.length === 0) return null;

  return (
    <section className="rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-8 max-[767px]:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-2xl leading-8 font-semibold">Saved palettes</h2>
        <Link
          href="/colors/saved"
          className="text-sm leading-5 font-medium text-[var(--cs-brand-strong)] underline"
        >
          View all
        </Link>
      </div>
      <ul className="grid grid-cols-3 gap-3 max-[1199px]:grid-cols-2 max-[767px]:grid-cols-1">
        {matching.slice(0, 3).map((palette) => (
          <li
            key={palette.id}
            className="flex min-w-0 flex-col gap-3 rounded-2xl border border-[var(--cs-border)] p-3"
          >
            <span className="flex h-10 overflow-hidden rounded-[10px] border border-[var(--cs-border)]">
              {palette.colors.map((color) => (
                <span key={color.id} className="flex-1" style={{ backgroundColor: color.hex }} />
              ))}
            </span>
            <span className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-sm leading-5 font-semibold">
                {palette.name}
              </span>
              <StudioButton variant="secondary" onClick={() => onOpen(palette)}>
                Open
              </StudioButton>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CopyRow({ label, value }: { label: string; value: string }) {
  const { copy, isCopied } = useStudioCopy();
  return (
    <div className="flex items-center gap-2 border-b border-[var(--cs-border)] py-0.5 last:border-b-0">
      <span className="w-10 shrink-0 text-sm leading-5 font-medium text-[var(--cs-muted)]">
        {label}
      </span>
      <span className="min-w-0 flex-1 truncate font-mono text-sm leading-5 select-text">
        {value}
      </span>
      <button
        type="button"
        aria-label={`Copy ${label} ${value}`}
        onClick={() => void copy(value, "value")}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] text-[var(--cs-muted)] hover:text-[var(--cs-text)]"
      >
        {isCopied("value") ? <CheckIcon /> : <CopyIcon />}
      </button>
    </div>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex max-w-full flex-wrap gap-1 rounded-[12px] bg-[var(--cs-background)] p-1"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`h-11 rounded-[10px] px-4 text-sm leading-5 font-semibold whitespace-nowrap transition-colors ${
              active
                ? "bg-[var(--cs-text)] text-white"
                : "text-[var(--cs-text)] hover:bg-[var(--cs-surface)]"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Download text as a file. */
export function downloadText(filename: string, text: string, type = "text/plain"): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
