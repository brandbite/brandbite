// -----------------------------------------------------------------------------
// @file: components/colors/studio/saved-palettes-view.tsx
// @purpose: The /colors/saved collection: search, filter, sort, a scrolling palette
//           list, duplicate, delete with undo, backup export/import, and moving
//           browser palettes to an account. Details live in SavedPaletteDetail.
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { useToast } from "@/components/ui/toast-provider";
import { duplicateStudioPalette, type StudioPalette, type StudioSource } from "@/lib/colors";

import { ActionMenu } from "./action-menu";
import {
  CheckCircleIcon,
  CheckIcon,
  CloseIcon,
  DownloadIcon,
  GridIcon,
  InfoIcon,
  ListIcon,
  SearchIcon,
  UploadIcon,
} from "./icons";
import { usePaletteOpener } from "./open-palette";
import { downloadText, IconToggle, STUDIO_FIELD, StudioSelect } from "./palette-parts";
import { SavedPaletteDetail, SOURCE_LABELS } from "./saved-palette-detail";
import { StudioButton, studioButtonClasses } from "./studio-button";
import { useSavedPalettes } from "./use-saved-palettes";

type SortKey = "updated" | "oldest" | "name";

/** The list scrolls after this many rows; its height classes below fit exactly this. */
const VISIBLE_ROWS = 3;

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

function ColorStrip({ palette }: { palette: StudioPalette }) {
  return (
    <span className="flex h-10 min-h-10 min-w-0 flex-1 overflow-hidden rounded-[10px] border border-[var(--cs-border)]">
      {palette.colors.map((color) => (
        <span key={color.id} className="flex-1" style={{ backgroundColor: color.hex }} />
      ))}
    </span>
  );
}

export function SavedPalettesView() {
  const store = useSavedPalettes();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const selectedRowRef = useRef<HTMLLIElement>(null);

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
  const selectedRowId = selected?.id ?? null;

  // A duplicated palette may land outside the scrolled part of the list. This moves
  // only the list, because scrollIntoView would also scroll the page.
  useEffect(() => {
    const list = listRef.current;
    const row = selectedRowRef.current;
    if (!list || !row) return;
    if (row.offsetTop < list.scrollTop) {
      list.scrollTop = row.offsetTop;
    } else if (row.offsetTop + row.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = row.offsetTop + row.offsetHeight - list.clientHeight;
    }
  }, [selectedRowId]);

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
    downloadText(
      `brandbite-palettes-${date}.json`,
      serializeBackup(store.palettes),
      "application/json",
    );
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

  const total = store.palettes.length;
  const isFiltered = visible.length !== total;
  const countLabel = `${isFiltered ? `${visible.length} of ${total}` : total} saved ${
    total === 1 ? "palette" : "palettes"
  }`;

  return (
    <>
      {store.mode === "account" ? (
        <p className="-mt-2 flex items-center gap-2 text-sm leading-5 text-[var(--cs-muted)]">
          <span className="text-[var(--cs-success)]">
            <CheckCircleIcon />
          </span>
          Saved to your account. Available on any device.
        </p>
      ) : (
        <p className="-mt-2 flex items-start gap-2 text-sm leading-5 text-[var(--cs-muted)]">
          <InfoIcon />
          <span>
            Saved in this browser. Export a backup to keep a copy, or{" "}
            <Link
              href="/login?redirect=/colors/saved"
              className="font-medium text-[var(--cs-brand-strong)] underline"
            >
              sign in
            </Link>{" "}
            to keep palettes on your account.
          </span>
        </p>
      )}

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

          <section className="rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-6 max-[767px]:p-5">
            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-[220px] flex-1 text-sm leading-5 font-medium">
                Search saved palettes
                <span className="relative mt-1 block">
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--cs-muted)]">
                    <SearchIcon />
                  </span>
                  <input
                    type="search"
                    value={query}
                    placeholder="Search saved palettes..."
                    onChange={(event) => setQuery(event.target.value)}
                    className={`${STUDIO_FIELD} block w-full pl-10`}
                  />
                </span>
              </label>
              <label className="text-sm leading-5 font-medium">
                Tool
                <StudioSelect
                  value={tool}
                  onChange={(event) => setTool(event.target.value as StudioSource | "all")}
                >
                  <option value="all">All tools</option>
                  {usedTools.map((source) => (
                    <option key={source} value={source}>
                      {SOURCE_LABELS[source]}
                    </option>
                  ))}
                </StudioSelect>
              </label>
              <label className="text-sm leading-5 font-medium">
                Sort by
                <StudioSelect
                  value={sort}
                  onChange={(event) => setSort(event.target.value as SortKey)}
                >
                  <option value="updated">Recently updated</option>
                  <option value="oldest">Oldest first</option>
                  <option value="name">Name</option>
                </StudioSelect>
              </label>
              <IconToggle
                label="Layout"
                value={layout}
                onChange={setLayout}
                activeClassName="border-transparent bg-[var(--cs-text)] text-white"
                options={[
                  { value: "list", label: "List", icon: <ListIcon /> },
                  { value: "grid", label: "Grid", icon: <GridIcon /> },
                ]}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-base leading-6 font-semibold">{total > 0 ? countLabel : null}</p>
              <div className="flex flex-wrap gap-2">
                <StudioButton
                  variant="secondary"
                  icon={<UploadIcon />}
                  disabled={total === 0}
                  onClick={() => void exportBackup()}
                >
                  Export backup
                </StudioButton>
                <StudioButton
                  variant="secondary"
                  icon={<DownloadIcon />}
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
            </div>

            {actionError ? (
              <p role="alert" className="mt-4 text-sm leading-5 text-[var(--cs-danger)]">
                {actionError}
              </p>
            ) : null}

            {total === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-[var(--cs-border)] p-8 text-center">
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
              <div className="mt-4 rounded-2xl border border-dashed border-[var(--cs-border)] p-8 text-center">
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
              <>
                <ul
                  ref={listRef}
                  className={`relative mt-4 overflow-y-auto p-0.5 ${
                    layout === "grid"
                      ? "grid max-h-[420px] grid-cols-3 gap-2 max-[1199px]:grid-cols-2 max-[767px]:grid-cols-1"
                      : "flex max-h-[206px] flex-col gap-2 max-[767px]:max-h-[350px]"
                  }`}
                >
                  {visible.map((palette) => {
                    const isSelected = palette.id === selected?.id;
                    return (
                      <li
                        key={palette.id}
                        ref={isSelected ? selectedRowRef : undefined}
                        className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 ${
                          isSelected
                            ? "border-[var(--cs-selected)] bg-[var(--cs-soft)]"
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
                            className="flex w-2/5 min-w-0 shrink-0 items-center gap-2 max-[767px]:w-full"
                            style={layout === "grid" ? { width: "100%" } : undefined}
                          >
                            {isSelected ? <CheckIcon /> : null}
                            <span className="min-w-0">
                              <span className="block truncate text-base leading-6 font-semibold">
                                {palette.name}
                              </span>
                              <span className="block truncate text-sm leading-5 text-[var(--cs-muted)]">
                                {SOURCE_LABELS[palette.sourceTool]} · Updated{" "}
                                {formatUpdated(palette.updatedAt, now)}
                              </span>
                            </span>
                          </span>
                          <ColorStrip palette={palette} />
                        </button>
                        <ActionMenu
                          label={`Actions for ${palette.name}`}
                          buttonClassName={studioButtonClasses("secondary")}
                          items={[
                            {
                              label: "Rename",
                              onSelect: () => {
                                setSelectedId(palette.id);
                                setRenaming(true);
                              },
                            },
                            { label: "Duplicate", onSelect: () => void duplicate(palette) },
                            {
                              label: "Delete palette",
                              danger: true,
                              onSelect: () => void removePalette(palette),
                            },
                          ]}
                        >
                          <span aria-hidden="true">•••</span>
                        </ActionMenu>
                      </li>
                    );
                  })}
                </ul>
                {layout === "list" && visible.length > VISIBLE_ROWS ? (
                  <p className="mt-2 text-sm leading-5 text-[var(--cs-muted)]">
                    Showing {VISIBLE_ROWS} of {visible.length} · Scroll to browse your palettes
                  </p>
                ) : null}
              </>
            )}
          </section>

          {selected ? (
            <SavedPaletteDetail
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
