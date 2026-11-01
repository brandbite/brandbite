// -----------------------------------------------------------------------------
// @file: app/admin/palette-ideas/page.tsx
// @purpose: Admin CMS for curated palette ideas. Palette list (swatch strips)
//           on the left, editor panel on the right with Details / Colours /
//           Publishing tabs. The Colours tab shows a live preview strip next
//           to editable hex rows.
// @version: v2.0.0
// @status: active
// @lastUpdate: 2026-11-01
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ui/toast-provider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { normalizeHex } from "@/lib/colors";
import {
  Badge,
  Button,
  Callout,
  Card,
  DetailPanel,
  EmptyState,
  Field,
  FilterBar,
  PageHeader,
  PanelSection,
  SaveBar,
  SearchInput,
  Select,
  Skeleton,
  SplitView,
  TabPanel,
  TableFooter,
  Tabs,
  TextArea,
  TextInput,
  fmt,
  plural,
} from "@/components/admin/v2/ui";
import { IconAlertCircle } from "@/components/admin/v2/icons";
import { useUnsavedChanges } from "@/components/admin/v2/unsaved-changes";

type PaletteIdea = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  colors: string[];
  tags: string[];
  status: "DRAFT" | "PUBLISHED";
  sortOrder: number;
};

type EditorTab = "details" | "colours" | "publishing";
type StatusFilter = "ALL" | "PUBLISHED" | "DRAFT";

const MAX_COLORS = 12;

const emptyForm = {
  title: "",
  slug: "",
  summary: "",
  tags: "",
  status: "DRAFT" as "DRAFT" | "PUBLISHED",
  sortOrder: "0",
};

type FormState = typeof emptyForm;

const formFromIdea = (idea: PaletteIdea): FormState => ({
  title: idea.title,
  slug: idea.slug,
  summary: idea.summary ?? "",
  tags: idea.tags.join(", "),
  status: idea.status,
  sortOrder: String(idea.sortOrder),
});

const sameForm = (a: FormState, b: FormState) =>
  (Object.keys(a) as (keyof FormState)[]).every((k) => a[k] === b[k]);

const sameColors = (a: string[], b: string[]) =>
  a.length === b.length && a.every((c, i) => c === b[i]);

/* ---------------------------------------------------------------------------
 * Small local pieces
 * ------------------------------------------------------------------------- */

function IconPlus({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function IconArrow({ dir }: { dir: "up" | "down" }) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {dir === "up" ? <path d="M12 19V5M6 11l6-6 6 6" /> : <path d="M12 5v14M6 13l6 6 6-6" />}
    </svg>
  );
}

function IconTrash() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    </svg>
  );
}

function IconPalette() {
  return (
    <svg
      width={28}
      height={28}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.7-.8 1.7-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.7-1.7H16a5 5 0 0 0 5-5c0-4-4-7.2-9-7.2Z" />
      <circle cx="7.5" cy="11" r="1" />
      <circle cx="10.5" cy="7.5" r="1" />
      <circle cx="15" cy="7.5" r="1" />
    </svg>
  );
}

/** Swatch strip. Invalid entries render as a hatched cell. */
function SwatchStrip({
  colors,
  className,
  label,
}: {
  colors: string[];
  className: string;
  label?: string;
}) {
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`flex shrink-0 overflow-hidden border border-[var(--av2-border)] ${className}`}
    >
      {colors.length === 0 ? (
        <span className="flex-1 bg-[var(--av2-bg)]" />
      ) : (
        colors.map((c, i) => {
          const hex = normalizeHex(c);
          return (
            <span
              key={i}
              className="flex-1"
              style={
                hex
                  ? { backgroundColor: hex }
                  : {
                      backgroundImage:
                        "repeating-linear-gradient(45deg, var(--av2-track) 0 4px, var(--av2-surface) 4px 8px)",
                    }
              }
            />
          );
        })
      )}
    </span>
  );
}

const StatusBadge = ({ status }: { status: PaletteIdea["status"] }) =>
  status === "PUBLISHED" ? <Badge tone="green">Published</Badge> : <Badge>Draft</Badge>;

const ICON_BTN =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--av2-border)] bg-[var(--av2-surface)] text-[var(--av2-text)] hover:bg-[var(--av2-bg)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[var(--av2-surface)] focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none";

/* ---------------------------------------------------------------------------
 * Page
 * ------------------------------------------------------------------------- */

export default function AdminPaletteIdeasPage() {
  const { showToast } = useToast();
  const [ideas, setIdeas] = useState<PaletteIdea[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PaletteIdea | null>(null);
  const [form, setForm] = useState(emptyForm);
  // Raw text per colour row, so a mistyped hex can be shown inline.
  const [colors, setColors] = useState<string[]>([]);
  const [colorDraft, setColorDraft] = useState("#f15b2b");
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<EditorTab>("details");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [colorsError, setColorsError] = useState<string | null>(null);
  const [showRowErrors, setShowRowErrors] = useState(false);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const [pendingDelete, setPendingDelete] = useState<PaletteIdea | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/palette-ideas");
      const json = await res.json().catch(() => null);
      if (res.ok && Array.isArray(json?.ideas)) {
        setIdeas(
          json.ideas.map((i: any) => ({ ...i, colors: Array.isArray(i.colors) ? i.colors : [] })),
        );
        setLoadError(false);
      } else {
        setLoadError(true);
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ideas.filter((i) => {
      if (statusFilter !== "ALL" && i.status !== statusFilter) return false;
      if (!q) return true;
      return (
        i.title.toLowerCase().includes(q) ||
        i.slug.toLowerCase().includes(q) ||
        i.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [ideas, query, statusFilter]);

  const publishedCount = ideas.filter((i) => i.status === "PUBLISHED").length;
  const draftCount = ideas.length - publishedCount;
  const filtersActive = query.trim() !== "" || statusFilter !== "ALL";
  const resetFilters = () => {
    setQuery("");
    setStatusFilter("ALL");
  };

  const baselineForm = selected ? formFromIdea(selected) : emptyForm;
  const baselineColors = selected ? selected.colors : [];
  const dirty = !sameForm(form, baselineForm) || !sameColors(colors, baselineColors);
  const confirmDiscard = useUnsavedChanges(dirty, "Palette idea");

  /** Run `fn` now, or after the user agrees to drop unsaved edits. */
  const guarded = async (fn: () => void) => {
    if (await confirmDiscard()) fn();
  };

  const clearErrors = () => {
    setTitleError(null);
    setColorsError(null);
    setShowRowErrors(false);
  };

  const resetForm = () => {
    setSelected(null);
    setForm(emptyForm);
    setColors([]);
    setTab("details");
    clearErrors();
  };

  const editIdea = (idea: PaletteIdea) => {
    setSelected(idea);
    setForm(formFromIdea(idea));
    setColors(idea.colors);
    clearErrors();
  };

  const draftValid = normalizeHex(colorDraft) !== null;
  const draftError =
    colorDraft.trim() !== "" && !draftValid ? "Enter a hex value like #1D3557." : undefined;

  const addColor = () => {
    const hex = normalizeHex(colorDraft);
    if (!hex) {
      showToast({ type: "error", title: "Invalid hex" });
      return;
    }
    if (colors.length >= MAX_COLORS) return;
    setColors((prev) => [...prev, hex]);
    setColorsError(null);
  };

  const updateColor = (index: number, value: string) =>
    setColors((prev) => prev.map((c, i) => (i === index ? value : c)));

  const moveColor = (index: number, delta: -1 | 1) =>
    setColors((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const removeColor = (index: number) =>
    setColors((prev) => prev.filter((_, idx) => idx !== index));

  const invalidRows = colors.map((c, i) => (normalizeHex(c) ? -1 : i)).filter((i) => i >= 0);

  const save = async () => {
    clearErrors();
    if (!form.title.trim()) {
      setTitleError("Title is required.");
      setTab("details");
      showToast({ type: "error", title: "Title is required" });
      return;
    }
    if (colors.length === 0) {
      setColorsError("Add at least one colour.");
      setTab("colours");
      showToast({ type: "error", title: "Add at least one color" });
      return;
    }
    if (invalidRows.length > 0) {
      setShowRowErrors(true);
      setTab("colours");
      showToast({ type: "error", title: "Invalid hex" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        slug: form.slug.trim() || undefined,
        summary: form.summary.trim() || null,
        colors: colors.map((c) => normalizeHex(c) as string),
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        status: form.status,
        sortOrder: Number(form.sortOrder) || 0,
      };
      const res = selected
        ? await fetch(`/api/admin/palette-ideas/${selected.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/admin/palette-ideas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      if (!res.ok) throw new Error("save failed");
      showToast({ type: "success", title: selected ? "Updated" : "Created" });
      resetForm();
      await load();
    } catch {
      showToast({ type: "error", title: "Couldn't save" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (idea: PaletteIdea) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/palette-ideas/${idea.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      showToast({ type: "success", title: "Deleted" });
      if (selected?.id === idea.id) resetForm();
      await load();
    } catch {
      showToast({ type: "error", title: "Couldn't delete" });
    } finally {
      setDeleting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Editor panel
  // ---------------------------------------------------------------------------

  const tabIds = "palette-editor";

  const panelTitle = (
    <span className="flex min-w-0 flex-wrap items-center gap-3">
      <span className="truncate">{selected ? selected.title : "New palette"}</span>
      {selected ? <StatusBadge status={selected.status} /> : <Badge tone="peach">Not saved</Badge>}
    </span>
  );

  const panel = (
    <form
      noValidate
      className="contents"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <DetailPanel
        title={panelTitle}
        onClose={selected ? () => void guarded(resetForm) : undefined}
        closeLabel="Clear selection"
        footer={
          <SaveBar
            dirty={dirty}
            status={
              saving
                ? "Saving…"
                : dirty
                  ? selected
                    ? "Unsaved changes"
                    : "New palette · not saved"
                  : selected
                    ? "No unsaved changes"
                    : "New palette · nothing entered yet"
            }
          >
            {dirty && (
              <Button
                variant="ghost"
                disabled={saving}
                onClick={() => {
                  setForm(baselineForm);
                  setColors(baselineColors);
                  clearErrors();
                }}
              >
                {selected ? "Discard" : "Cancel"}
              </Button>
            )}
            <Button type="submit" variant="primary" disabled={!dirty || saving}>
              {saving ? "Saving…" : selected ? "Save changes" : "Create palette"}
            </Button>
          </SaveBar>
        }
      >
        <Tabs
          idPrefix={tabIds}
          label="Palette settings"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "details", label: "Details" },
            { value: "colours", label: `Colours · ${colors.length}` },
            { value: "publishing", label: "Publishing" },
          ]}
        />

        <div className="pt-5">
          {tab === "details" && (
            <TabPanel idPrefix={tabIds} value="details">
              <div className="space-y-5">
                <Field label="Title" htmlFor="palette-title" error={titleError ?? undefined}>
                  <TextInput
                    id="palette-title"
                    value={form.title}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, title: e.target.value }));
                      setTitleError(null);
                    }}
                    aria-invalid={!!titleError}
                    placeholder="Autumn warmth"
                  />
                </Field>

                <Field
                  label="Slug"
                  htmlFor="palette-slug"
                  hint="Optional — auto-generated from the title when blank."
                >
                  <TextInput
                    id="palette-slug"
                    value={form.slug}
                    onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                    placeholder="autumn-warmth"
                    spellCheck={false}
                  />
                </Field>

                <Field label="Summary" htmlFor="palette-summary">
                  <TextArea
                    id="palette-summary"
                    value={form.summary}
                    onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
                    rows={2}
                  />
                </Field>

                <Field label="Tags" htmlFor="palette-tags" hint="Comma-separated.">
                  <TextInput
                    id="palette-tags"
                    value={form.tags}
                    onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                    placeholder="Vintage, Warm, Autumn"
                  />
                </Field>
              </div>
            </TabPanel>
          )}

          {tab === "colours" && (
            <TabPanel idPrefix={tabIds} value="colours">
              <h3 className="mb-3 text-base font-semibold">Palette preview</h3>
              <SwatchStrip
                colors={colors}
                className="h-16 w-full rounded-xl"
                label={
                  colors.length
                    ? `Preview: ${colors.map((c) => normalizeHex(c) ?? "invalid").join(", ")}`
                    : "Empty palette"
                }
              />

              <div className="mt-6 mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-base font-semibold">
                  Colours{" "}
                  <span className="font-normal text-[var(--av2-text-2)] tabular-nums">
                    ({colors.length}/{MAX_COLORS})
                  </span>
                </h3>
                <p className="text-xs text-[var(--av2-text-2)]">Colours appear in this order.</p>
              </div>

              {colorsError && (
                <p className="mb-3 flex items-start gap-1.5 text-xs text-[var(--av2-error-text)]">
                  <IconAlertCircle width={14} height={14} className="mt-px shrink-0" />
                  {colorsError}
                </p>
              )}

              {colors.length > 0 && (
                <ol className="space-y-2">
                  {colors.map((c, i) => {
                    const hex = normalizeHex(c);
                    const rowError = hex
                      ? undefined
                      : showRowErrors
                        ? "Not a valid hex colour. Fix or remove it before saving."
                        : "Not a valid hex colour.";
                    const inputId = `palette-color-${i}`;
                    return (
                      <li key={i}>
                        <div className="flex items-center gap-2">
                          <span
                            aria-hidden
                            className="h-10 w-10 shrink-0 rounded-lg border border-[var(--av2-border)]"
                            style={
                              hex
                                ? { backgroundColor: hex }
                                : {
                                    backgroundImage:
                                      "repeating-linear-gradient(45deg, var(--av2-track) 0 4px, var(--av2-surface) 4px 8px)",
                                  }
                            }
                          />
                          <label htmlFor={inputId} className="sr-only">
                            Colour {i + 1} hex
                          </label>
                          <TextInput
                            id={inputId}
                            value={c}
                            onChange={(e) => updateColor(i, e.target.value)}
                            aria-invalid={!!rowError}
                            aria-describedby={rowError ? `${inputId}-err` : undefined}
                            className="min-w-0 font-mono uppercase"
                            spellCheck={false}
                          />
                          <button
                            type="button"
                            className={ICON_BTN}
                            onClick={() => moveColor(i, -1)}
                            disabled={i === 0}
                            aria-label={`Move colour ${i + 1} up`}
                          >
                            <IconArrow dir="up" />
                          </button>
                          <button
                            type="button"
                            className={ICON_BTN}
                            onClick={() => moveColor(i, 1)}
                            disabled={i === colors.length - 1}
                            aria-label={`Move colour ${i + 1} down`}
                          >
                            <IconArrow dir="down" />
                          </button>
                          <button
                            type="button"
                            className={`${ICON_BTN} hover:text-[var(--av2-error-text)]`}
                            onClick={() => removeColor(i)}
                            aria-label={`Remove colour ${i + 1}`}
                          >
                            <IconTrash />
                          </button>
                        </div>
                        {rowError && (
                          <p
                            id={`${inputId}-err`}
                            className="mt-1.5 ml-12 flex items-start gap-1.5 text-xs text-[var(--av2-error-text)]"
                          >
                            <IconAlertCircle width={14} height={14} className="mt-px shrink-0" />
                            {rowError}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}

              <div className="mt-5 border-t border-[var(--av2-border)] pt-5">
                <Field
                  label="Add colour"
                  htmlFor="palette-color-draft"
                  error={draftError}
                  hint={
                    colors.length >= MAX_COLORS
                      ? `A palette holds up to ${MAX_COLORS} colours.`
                      : "Pick a colour or type a hex value."
                  }
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={draftValid ? (normalizeHex(colorDraft) as string) : "#000000"}
                      onChange={(e) => setColorDraft(e.target.value)}
                      className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-[var(--av2-border)] bg-[var(--av2-surface)] p-1"
                      aria-label="Pick a colour"
                      disabled={colors.length >= MAX_COLORS}
                    />
                    <TextInput
                      id="palette-color-draft"
                      value={colorDraft}
                      onChange={(e) => setColorDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addColor();
                        }
                      }}
                      aria-invalid={!!draftError}
                      className="min-w-0 font-mono uppercase"
                      spellCheck={false}
                    />
                    <Button onClick={addColor} disabled={colors.length >= MAX_COLORS}>
                      <IconPlus size={16} />
                      Add
                    </Button>
                  </div>
                </Field>
              </div>
            </TabPanel>
          )}

          {tab === "publishing" && (
            <TabPanel idPrefix={tabIds} value="publishing">
              <div className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_140px]">
                  <Field label="Status" htmlFor="palette-status">
                    <Select
                      id="palette-status"
                      value={form.status}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          status: e.target.value as "DRAFT" | "PUBLISHED",
                        }))
                      }
                    >
                      <option value="DRAFT">Draft</option>
                      <option value="PUBLISHED">Published</option>
                    </Select>
                  </Field>
                  <Field label="Sort order" htmlFor="palette-sort-order">
                    <TextInput
                      id="palette-sort-order"
                      type="number"
                      inputMode="numeric"
                      value={form.sortOrder}
                      onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                    />
                  </Field>
                </div>
                <p className="text-xs text-[var(--av2-text-2)]">
                  Published palettes appear in the public /colors/color-palette-ideas gallery,
                  lowest sort order first.
                </p>

                {selected && (
                  <PanelSection title="Danger zone">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm text-[var(--av2-text-2)]">
                        Deleting removes this palette permanently.
                      </p>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={deleting || saving}
                        onClick={() => setPendingDelete(selected)}
                      >
                        Delete palette
                      </Button>
                    </div>
                  </PanelSection>
                )}
              </div>
            </TabPanel>
          )}
        </div>
      </DetailPanel>
    </form>
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <PageHeader
        title="Palette ideas"
        description="Curated palettes shown in the public /colors/color-palette-ideas gallery."
        meta={
          loaded && !loadError ? (
            <span className="tabular-nums">
              {fmt(ideas.length)} {plural(ideas.length, "palette", "palettes")} ·{" "}
              {fmt(publishedCount)} published · {fmt(draftCount)}{" "}
              {plural(draftCount, "draft", "drafts")}
            </span>
          ) : undefined
        }
        actions={
          <Button variant="primary" onClick={() => void guarded(resetForm)}>
            <IconPlus />
            New palette
          </Button>
        }
      />

      {loadError && (
        <div className="mb-6">
          <Callout
            tone="error"
            title="Couldn't load palettes"
            action={
              <Button size="sm" onClick={() => void load()}>
                Retry
              </Button>
            }
          >
            The palette list request failed. Try again.
          </Callout>
        </div>
      )}

      <SplitView panel={panel}>
        <Card padding="none">
          <div className="px-6 pt-5">
            <FilterBar>
              <SearchInput
                className="min-w-[200px] flex-1"
                value={query}
                onChange={setQuery}
                placeholder="Search palettes"
                label="Search palettes by title, slug or tag"
              />
              <div className="w-full sm:w-40">
                <Select
                  aria-label="Filter by status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                >
                  <option value="ALL">All statuses</option>
                  <option value="PUBLISHED">Published</option>
                  <option value="DRAFT">Draft</option>
                </Select>
              </div>
            </FilterBar>
          </div>

          <div className="px-6 pb-5">
            {loading && !loaded ? (
              <div className="space-y-2" role="status">
                <span className="sr-only">Loading palettes…</span>
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : ideas.length === 0 ? (
              loadError ? null : (
                <EmptyState
                  icon={<IconPalette />}
                  title="No palettes yet"
                  description="Create the first palette with the New palette button."
                />
              )
            ) : filtered.length === 0 ? (
              <EmptyState
                title="No palettes match these filters"
                description="Try a different search or status."
                action={<Button onClick={resetFilters}>Clear filters</Button>}
              />
            ) : (
              <ul className="space-y-2" aria-label="Palettes">
                {filtered.map((idea) => {
                  const active = selected?.id === idea.id;
                  return (
                    <li key={idea.id}>
                      <button
                        type="button"
                        onClick={() => {
                          if (active) return;
                          void guarded(() => editIdea(idea));
                        }}
                        aria-pressed={active}
                        className={`flex w-full items-center gap-4 rounded-xl border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none ${
                          active
                            ? "border-[var(--av2-accent)] bg-[var(--av2-selected)] shadow-[inset_3px_0_0_var(--av2-accent)]"
                            : "border-[var(--av2-border)] hover:bg-[var(--av2-bg)]"
                        }`}
                      >
                        <SwatchStrip colors={idea.colors} className="h-10 w-28 rounded-lg" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{idea.title}</span>
                          <span className="block text-xs text-[var(--av2-text-2)] tabular-nums">
                            {fmt(idea.colors.length)}{" "}
                            {plural(idea.colors.length, "colour", "colours")}
                            {idea.tags.length > 0 && ` · ${idea.tags.slice(0, 3).join(", ")}`}
                          </span>
                        </span>
                        <StatusBadge status={idea.status} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {loaded && ideas.length > 0 && (
            <TableFooter>
              <span className="tabular-nums">
                Showing {fmt(filtered.length)} of {fmt(ideas.length)}{" "}
                {plural(ideas.length, "palette", "palettes")}
              </span>
              {filtersActive ? (
                <Button size="sm" variant="ghost" onClick={resetFilters}>
                  Clear filters
                </Button>
              ) : (
                <span>Select a palette to edit it.</span>
              )}
            </TableFooter>
          )}
        </Card>
      </SplitView>

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => !deleting && setPendingDelete(null)}
        onConfirm={async () => {
          if (pendingDelete) await remove(pendingDelete);
          setPendingDelete(null);
        }}
        loading={deleting}
        variant="danger"
        title="Delete this palette?"
        description={
          pendingDelete
            ? `Delete "${pendingDelete.title}"? It will be removed from the public gallery.`
            : undefined
        }
        confirmLabel="Delete"
      />
    </>
  );
}
