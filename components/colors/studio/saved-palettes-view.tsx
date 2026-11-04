// -----------------------------------------------------------------------------
// @file: components/colors/studio/saved-palettes-view.tsx
// @purpose: The /colors/saved collection: search, filter, sort, palette detail
//           with roles and preview, rename, duplicate, delete with undo, backup
//           export/import, and moving browser palettes to an account.
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { useToast } from "@/components/ui/toast-provider";
import {
  duplicateStudioPalette,
  formatHex,
  studioPaletteToCss,
  type StudioPalette,
  type StudioSource,
} from "@/lib/colors";

import { CheckIcon, CloseIcon, CopyIcon, EditIcon } from "./icons";
import { usePaletteOpener } from "./open-palette";
import { RoleFields } from "./palette-parts";
import { PalettePreview } from "./palette-preview";
import { SharePaletteButton } from "./share-palette";
import { StudioButton, studioButtonClasses } from "./studio-button";
import { useSavedPalettes } from "./use-saved-palettes";
import { useStudioCopy } from "./use-studio-copy";

const SOURCE_LABELS: Record<StudioSource, string> = {
  generator: "Palette generator",
  wheel: "Color wheel",
  tailwind: "Tailwind shades",
  ideas: "Palette ideas",
  meanings: "Color meanings",
  contrast: "Contrast checker",
  image: "Image to palette",
  shared: "Shared palette",
};

type SortKey = "updated" | "oldest" | "name";

const FIELD =
  "h-12 rounded-[10px] border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-sm leading-5";

function formatUpdated(iso: string, now: number): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  const format = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

function downloadJson(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function ColorStrip({ palette }: { palette: StudioPalette }) {
  return (
    <span className="flex h-10 min-w-0 flex-1 overflow-hidden rounded-[10px] border border-[var(--cs-border)]">
      {palette.colors.map((color) => (
        <span key={color.id} className="flex-1" style={{ backgroundColor: color.hex }} />
      ))}
    </span>
  );
}

function RowMenu({
  palette,
  onRename,
  onDuplicate,
  onDelete,
}: {
  palette: StudioPalette;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const item = (label: string, action: () => void, danger = false) => (
    <li>
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          action();
        }}
        className={`flex h-11 w-full items-center rounded-[10px] px-3 text-left text-sm leading-5 font-medium hover:bg-[var(--cs-soft)] ${
          danger ? "text-[var(--cs-danger)]" : ""
        }`}
      >
        {label}
      </button>
    </li>
  );

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Actions for ${palette.name}`}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        className={studioButtonClasses("secondary")}
      >
        <span aria-hidden="true">•••</span>
      </button>
      <ul
        id={menuId}
        hidden={!open}
        className="absolute top-full right-0 z-20 mt-2 min-w-[160px] rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-2 shadow-lg"
      >
        {item("Rename", onRename)}
        {item("Duplicate", onDuplicate)}
        {item("Delete palette", onDelete, true)}
      </ul>
    </div>
  );
}

function PaletteDetail({
  palette,
  renaming,
  onRenamingChange,
  onSave,
  onOpen,
}: {
  palette: StudioPalette;
  renaming: boolean;
  onRenamingChange: (renaming: boolean) => void;
  onSave: (palette: StudioPalette) => Promise<boolean>;
  onOpen: (href: string, selectedColorId?: string) => void;
}) {
  const { copy, isCopied } = useStudioCopy();
  const nameId = useId();
  const [selectedColorId, setSelectedColorId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState(palette.name);
  const [nameError, setNameError] = useState<string | null>(null);
  const [lastPaletteId, setLastPaletteId] = useState(palette.id);

  if (palette.id !== lastPaletteId) {
    setLastPaletteId(palette.id);
    setSelectedColorId(null);
    setDraftName(palette.name);
    setNameError(null);
  }

  const selected = palette.colors.find((c) => c.id === selectedColorId) ?? palette.colors[0];

  const submitName = async () => {
    const name = draftName.trim();
    if (!name || name.length > 80) {
      setNameError("Enter a name of 1 to 80 characters.");
      return;
    }
    setNameError(null);
    if (name === palette.name || (await onSave({ ...palette, name }))) onRenamingChange(false);
  };

  return (
    <div className="grid grid-cols-2 gap-6 max-[1199px]:grid-cols-1">
      <section
        aria-label={`${palette.name} details`}
        className="min-w-0 rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-8 max-[767px]:p-5"
      >
        {renaming ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submitName();
            }}
          >
            <label htmlFor={nameId} className="mb-2 block text-sm leading-5 font-medium">
              Palette name
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                id={nameId}
                value={draftName}
                maxLength={80}
                autoFocus
                aria-invalid={nameError ? true : undefined}
                onChange={(event) => setDraftName(event.target.value)}
                className={`${FIELD} min-w-0 flex-1`}
              />
              <StudioButton type="submit">Save name</StudioButton>
              <StudioButton
                variant="secondary"
                onClick={() => {
                  setDraftName(palette.name);
                  setNameError(null);
                  onRenamingChange(false);
                }}
              >
                Cancel
              </StudioButton>
            </div>
            {nameError ? (
              <p className="mt-2 text-sm leading-5 text-[var(--cs-danger)]">{nameError}</p>
            ) : null}
          </form>
        ) : (
          <div className="flex items-center gap-1">
            <h2 className="min-w-0 text-2xl leading-8 font-semibold break-words">{palette.name}</h2>
            <button
              type="button"
              aria-label={`Rename ${palette.name}`}
              onClick={() => {
                setDraftName(palette.name);
                onRenamingChange(true);
              }}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] text-[var(--cs-muted)] hover:text-[var(--cs-text)]"
            >
              <EditIcon />
            </button>
          </div>
        )}
        <p className="mt-1 text-sm leading-5 text-[var(--cs-muted)]">
          From {SOURCE_LABELS[palette.sourceTool]}
        </p>

        <ul className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-3">
          {palette.colors.map((color) => {
            const label = formatHex(color.hex);
            const isSelected = color.id === selected.id;
            return (
              <li key={color.id}>
                <button
                  type="button"
                  aria-pressed={isSelected}
                  aria-label={`Select ${label}`}
                  onClick={() => setSelectedColorId(color.id)}
                  className={`block h-20 w-full rounded-[10px] border ${
                    isSelected
                      ? "border-[var(--cs-text)] outline-2 outline-offset-2 outline-[var(--cs-text)]"
                      : "border-[var(--cs-border)]"
                  }`}
                  style={{ backgroundColor: color.hex }}
                />
                <div className="mt-1 flex items-center justify-between">
                  <span className="font-mono text-sm leading-5 select-text">{label}</span>
                  <button
                    type="button"
                    aria-label={`Copy ${label}`}
                    onClick={() => void copy(label, color.id)}
                    className="flex h-11 w-11 items-center justify-center rounded-[10px] text-[var(--cs-muted)] hover:text-[var(--cs-text)]"
                  >
                    {isCopied(color.id) ? <CheckIcon /> : <CopyIcon />}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <h3 className="mt-6 text-lg leading-[26px] font-semibold">Color roles</h3>
        <div className="mt-3">
          <RoleFields palette={palette} onChange={(next) => void onSave(next)} />
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <StudioButton onClick={() => onOpen("/colors/color-palette-generator", selected.id)}>
            Open in generator
          </StudioButton>
          <StudioButton variant="secondary" onClick={() => onOpen("/colors/contrast-checker")}>
            Check contrast
          </StudioButton>
          <StudioButton
            variant="secondary"
            onClick={() => onOpen("/colors/tailwind-color-generator", selected.id)}
          >
            Create shades
          </StudioButton>
          <StudioButton
            variant="secondary"
            onClick={() =>
              void copy(
                palette.colors.map((c) => formatHex(c.hex)).join(", "),
                "hex-list",
                "all HEX values",
              )
            }
          >
            Copy HEX
          </StudioButton>
          <StudioButton
            variant="secondary"
            onClick={() => void copy(studioPaletteToCss(palette), "css", "CSS variables")}
          >
            Copy CSS
          </StudioButton>
          <SharePaletteButton palette={palette} />
        </div>
      </section>

      <section
        aria-label="Preview with assigned roles"
        className="min-w-0 rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-8 max-[767px]:p-5"
      >
        <h2 className="text-2xl leading-8 font-semibold">Preview with assigned roles</h2>
        <p className="mt-1 mb-4 text-sm leading-5 text-[var(--cs-muted)]">
          Roles you haven&apos;t set use a suggested color from the palette.
        </p>
        <PalettePreview palette={palette} />
      </section>
    </div>
  );
}

export function SavedPalettesView() {
  const store = useSavedPalettes();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [tool, setTool] = useState<StudioSource | "all">("all");
  const [sort, setSort] = useState<SortKey>("updated");
  const [layout, setLayout] = useState<"list" | "grid">("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [deleted, setDeleted] = useState<StudioPalette | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [moving, setMoving] = useState(false);
  const [now] = useState(() => Date.now());

  const usedTools = useMemo(
    () => Array.from(new Set(store.palettes.map((p) => p.sourceTool))),
    [store.palettes],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = store.palettes.filter(
      (p) =>
        (tool === "all" || p.sourceTool === tool) &&
        (!q || p.name.toLowerCase().includes(q) || p.tags.some((t) => t.toLowerCase().includes(q))),
    );
    return [...filtered].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      const difference = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      return sort === "oldest" ? difference : -difference;
    });
  }, [store.palettes, query, tool, sort]);

  const selected = visible.find((p) => p.id === selectedId) ?? visible[0] ?? null;

  const report = (message: string) => setActionError(message);

  const savePalette = async (palette: StudioPalette): Promise<boolean> => {
    setActionError(null);
    const result = await store.save({ ...palette, updatedAt: new Date().toISOString() });
    if (!result.ok) report(result.message);
    return result.ok;
  };

  const duplicate = async (palette: StudioPalette) => {
    setActionError(null);
    const result = await store.createMany([
      duplicateStudioPalette(palette, `${palette.name} copy`.slice(0, 80)),
    ]);
    if (result.ok) {
      setSelectedId(result.value[0].id);
      showToast({ type: "success", title: "Palette duplicated", durationMs: 3000 });
    } else {
      report(result.message);
    }
  };

  const removePalette = async (palette: StudioPalette) => {
    setActionError(null);
    const result = await store.remove(palette.id);
    if (result.ok) setDeleted(palette);
    else report(result.message);
  };

  const undoDelete = async () => {
    if (!deleted) return;
    setActionError(null);
    const result = await store.createMany([deleted]);
    if (result.ok) {
      setDeleted(null);
      setSelectedId(result.value[0].id);
    } else {
      report(result.message);
    }
  };

  const opener = usePaletteOpener(savePalette);

  const exportBackup = async () => {
    const { serializeBackup } = await import("@/lib/colors/backup");
    const date = new Date().toISOString().slice(0, 10);
    downloadJson(`brandbite-palettes-${date}.json`, serializeBackup(store.palettes));
  };

  const importBackup = async (file: File) => {
    setActionError(null);
    setImporting(true);
    try {
      const { MAX_BACKUP_BYTES, parseBackup } = await import("@/lib/colors/backup");
      if (file.size > MAX_BACKUP_BYTES) {
        report("That backup is too large. Backups can be up to 5 MB.");
        return;
      }
      const parsed = parseBackup(await file.text());
      if (!parsed.ok) {
        report(
          parsed.error === "not-json"
            ? "That file isn't a Color Studio backup. Choose a .json file exported from this page."
            : "That backup has invalid or unsupported data, so nothing was imported.",
        );
        return;
      }
      if (parsed.palettes.length === 0) {
        report("That backup has no palettes in it.");
        return;
      }
      const result = await store.createMany(parsed.palettes);
      if (result.ok) {
        showToast({
          type: "success",
          title: `Imported ${result.value.length} ${result.value.length === 1 ? "palette" : "palettes"}`,
          durationMs: 3000,
        });
      } else {
        report(result.message);
      }
    } catch {
      report("That file couldn't be read.");
    } finally {
      setImporting(false);
    }
  };

  const moveToAccount = async () => {
    setActionError(null);
    setMoving(true);
    const result = await store.moveLocalToAccount();
    setMoving(false);
    if (result.ok) {
      showToast({
        type: "success",
        title: `Moved ${result.value} ${result.value === 1 ? "palette" : "palettes"} to your account`,
        durationMs: 3000,
      });
    } else {
      report(result.message);
    }
  };

  if (store.status === "loading") {
    return (
      <section
        aria-busy="true"
        className="rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-8 text-sm leading-5 text-[var(--cs-muted)]"
      >
        Loading your palettes…
      </section>
    );
  }

  return (
    <>
      <p className="-mt-2 text-sm leading-5 text-[var(--cs-muted)]">
        {store.mode === "account" ? (
          "Saved to your account, so they're available on any device."
        ) : (
          <>
            Saved in this browser. Export a backup to keep a copy, or{" "}
            <Link
              href="/login?redirect=/colors/saved"
              className="font-medium text-[var(--cs-brand-strong)] underline"
            >
              sign in
            </Link>{" "}
            to keep palettes on your account.
          </>
        )}
      </p>

      {store.status === "error" ? (
        <section
          role="alert"
          className="rounded-2xl border border-[var(--cs-danger)] bg-[var(--cs-surface)] p-8 max-[767px]:p-5"
        >
          <p className="text-base leading-6">{store.errorMessage}</p>
          {store.errorKind === "corrupt" ? (
            <div className="mt-4">
              <StudioButton variant="danger" onClick={store.clearCorruptLocal}>
                Clear saved data
              </StudioButton>
            </div>
          ) : null}
        </section>
      ) : (
        <>
          {deleted ? (
            <section
              role="status"
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--cs-soft)] p-4"
            >
              <p className="min-w-0 text-sm leading-5">
                <span className="font-semibold">{deleted.name}</span> was deleted.
              </p>
              <div className="flex items-center gap-1">
                <StudioButton variant="secondary" onClick={() => void undoDelete()}>
                  Undo
                </StudioButton>
                <button
                  type="button"
                  aria-label="Dismiss"
                  onClick={() => setDeleted(null)}
                  className="flex h-11 w-11 items-center justify-center rounded-[10px]"
                >
                  <CloseIcon />
                </button>
              </div>
            </section>
          ) : null}

          {store.mode === "account" && store.localCount > 0 ? (
            <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[var(--cs-soft)] p-4">
              <p className="text-sm leading-5">
                This browser has {store.localCount} saved{" "}
                {store.localCount === 1 ? "palette" : "palettes"} that aren&apos;t on your account.
              </p>
              <StudioButton loading={moving} onClick={() => void moveToAccount()}>
                Move to my account
              </StudioButton>
            </section>
          ) : null}

          <section className="rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-8 max-[767px]:p-5">
            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-[220px] flex-1 text-sm leading-5 font-medium">
                Search saved palettes
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className={`${FIELD} mt-1 block w-full`}
                />
              </label>
              <label className="text-sm leading-5 font-medium">
                Tool
                <select
                  value={tool}
                  onChange={(event) => setTool(event.target.value as StudioSource | "all")}
                  className={`${FIELD} mt-1 block`}
                >
                  <option value="all">All tools</option>
                  {usedTools.map((source) => (
                    <option key={source} value={source}>
                      {SOURCE_LABELS[source]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm leading-5 font-medium">
                Sort by
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as SortKey)}
                  className={`${FIELD} mt-1 block`}
                >
                  <option value="updated">Recently updated</option>
                  <option value="oldest">Oldest first</option>
                  <option value="name">Name</option>
                </select>
              </label>
              <div role="group" aria-label="Layout" className="flex gap-1">
                <StudioButton
                  variant={layout === "list" ? "primary" : "secondary"}
                  aria-pressed={layout === "list"}
                  onClick={() => setLayout("list")}
                >
                  List
                </StudioButton>
                <StudioButton
                  variant={layout === "grid" ? "primary" : "secondary"}
                  aria-pressed={layout === "grid"}
                  onClick={() => setLayout("grid")}
                >
                  Grid
                </StudioButton>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <StudioButton
                variant="secondary"
                disabled={store.palettes.length === 0}
                onClick={() => void exportBackup()}
              >
                Export backup
              </StudioButton>
              <StudioButton
                variant="secondary"
                loading={importing}
                onClick={() => fileInputRef.current?.click()}
              >
                Import backup
              </StudioButton>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                aria-label="Backup file"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.currentTarget.value = "";
                  if (file) void importBackup(file);
                }}
              />
            </div>

            {actionError ? (
              <p role="alert" className="mt-4 text-sm leading-5 text-[var(--cs-danger)]">
                {actionError}
              </p>
            ) : null}

            {store.palettes.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-[var(--cs-border)] p-8 text-center">
                <p className="text-base leading-6 font-medium">No saved palettes yet.</p>
                <p className="mt-1 text-sm leading-5 text-[var(--cs-muted)]">
                  Create your first one, and it will appear here.
                </p>
                <Link
                  href="/colors/color-palette-generator"
                  className={`mt-4 ${studioButtonClasses("primary")}`}
                >
                  Create a palette
                </Link>
              </div>
            ) : visible.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-[var(--cs-border)] p-8 text-center">
                <p className="text-base leading-6 font-medium">No palettes match your search.</p>
                <div className="mt-4">
                  <StudioButton
                    variant="secondary"
                    onClick={() => {
                      setQuery("");
                      setTool("all");
                    }}
                  >
                    Clear filters
                  </StudioButton>
                </div>
              </div>
            ) : (
              <ul
                className={`mt-6 ${
                  layout === "grid"
                    ? "grid grid-cols-3 gap-3 max-[1199px]:grid-cols-2 max-[767px]:grid-cols-1"
                    : "flex flex-col gap-3"
                }`}
              >
                {visible.map((palette) => {
                  const isSelected = palette.id === selected?.id;
                  return (
                    <li
                      key={palette.id}
                      className={`flex items-center gap-2 rounded-2xl border p-3 ${
                        isSelected
                          ? "border-[var(--cs-text)] bg-[var(--cs-soft)]"
                          : "border-[var(--cs-border)]"
                      }`}
                    >
                      <button
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => {
                          setSelectedId(palette.id);
                          setRenaming(false);
                        }}
                        className={`flex min-w-0 flex-1 items-center gap-4 rounded-[10px] text-left ${
                          layout === "grid"
                            ? "flex-col items-stretch gap-2"
                            : "max-[767px]:flex-col max-[767px]:items-stretch max-[767px]:gap-2"
                        }`}
                      >
                        <span
                          className="w-1/3 min-w-0 shrink-0 max-[767px]:w-full"
                          style={layout === "grid" ? { width: "100%" } : undefined}
                        >
                          <span className="flex items-center gap-1.5 text-base leading-6 font-semibold">
                            {isSelected ? <CheckIcon /> : null}
                            <span className="truncate">{palette.name}</span>
                          </span>
                          <span className="block truncate text-sm leading-5 text-[var(--cs-muted)]">
                            {SOURCE_LABELS[palette.sourceTool]} · Updated{" "}
                            {formatUpdated(palette.updatedAt, now)}
                          </span>
                        </span>
                        <ColorStrip palette={palette} />
                      </button>
                      <RowMenu
                        palette={palette}
                        onRename={() => {
                          setSelectedId(palette.id);
                          setRenaming(true);
                        }}
                        onDuplicate={() => void duplicate(palette)}
                        onDelete={() => void removePalette(palette)}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {selected ? (
            <PaletteDetail
              palette={selected}
              renaming={renaming}
              onRenamingChange={setRenaming}
              onSave={savePalette}
              onOpen={(href, colorId) => opener.requestOpen(selected, href, colorId)}
            />
          ) : null}
        </>
      )}

      {opener.dialog}
    </>
  );
}
