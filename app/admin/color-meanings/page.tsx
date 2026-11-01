// -----------------------------------------------------------------------------
// @file: app/admin/color-meanings/page.tsx
// @purpose: Admin CMS for the color-meanings encyclopedia. Colour list on the
//           left, editor panel on the right with Basics / Meaning / Palettes /
//           SEO & publishing tabs.
// @version: v2.0.0
// @status: active
// @lastUpdate: 2026-11-01
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { useToast } from "@/components/ui/toast-provider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { normalizeHex, formatHex } from "@/lib/colors";
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

type ColorMeaning = {
  id: string;
  name: string;
  slug: string;
  hex: string;
  summary: string | null;
  meaning: string | null;
  associations: string[];
  samplePalettes: string[][];
  metaTitle: string | null;
  metaDescription: string | null;
  status: "DRAFT" | "PUBLISHED";
  sortOrder: number;
};

type EditorTab = "basics" | "meaning" | "palettes" | "publishing";
type StatusFilter = "ALL" | "PUBLISHED" | "DRAFT";

const emptyForm = {
  name: "",
  slug: "",
  hex: "#c0392b",
  summary: "",
  associations: "",
  samplePalettes: "",
  metaTitle: "",
  metaDescription: "",
  status: "DRAFT" as "DRAFT" | "PUBLISHED",
  sortOrder: "0",
};

type FormState = typeof emptyForm;

/** Each line is one palette of comma-separated hex values. */
function parseSamplePalettes(text: string): string[][] {
  return text
    .split("\n")
    .map((line) =>
      line
        .split(",")
        .map((c) => normalizeHex(c.trim()))
        .filter((c): c is string => Boolean(c)),
    )
    .filter((row) => row.length > 0);
}

/** Tokens that parseSamplePalettes() silently drops, for an inline warning. */
function invalidPaletteTokens(text: string): string[] {
  return text
    .split("\n")
    .flatMap((line) => line.split(","))
    .map((c) => c.trim())
    .filter((c) => c !== "" && !normalizeHex(c));
}

function stringifySamplePalettes(rows: string[][]): string {
  return rows.map((row) => row.map((c) => formatHex(c)).join(", ")).join("\n");
}

const formFromItem = (m: ColorMeaning): FormState => ({
  name: m.name,
  slug: m.slug,
  hex: m.hex,
  summary: m.summary ?? "",
  associations: m.associations.join(", "),
  samplePalettes: stringifySamplePalettes(m.samplePalettes),
  metaTitle: m.metaTitle ?? "",
  metaDescription: m.metaDescription ?? "",
  status: m.status,
  sortOrder: String(m.sortOrder),
});

const sameForm = (a: FormState, b: FormState) =>
  (Object.keys(a) as (keyof FormState)[]).every((k) => a[k] === b[k]);

function IconPlus() {
  return (
    <svg
      width={18}
      height={18}
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

function IconDroplet() {
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
      <path d="M12 3.5s6 6.4 6 10.5a6 6 0 0 1-12 0c0-4.1 6-10.5 6-10.5Z" />
    </svg>
  );
}

const StatusBadge = ({ status }: { status: ColorMeaning["status"] }) =>
  status === "PUBLISHED" ? <Badge tone="green">Published</Badge> : <Badge>Draft</Badge>;

export default function AdminColorMeaningsPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState<ColorMeaning[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState<ColorMeaning | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [meaningHtml, setMeaningHtml] = useState("");
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<EditorTab>("basics");
  const [nameError, setNameError] = useState<string | null>(null);
  const [hexSubmitError, setHexSubmitError] = useState(false);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const [pendingDelete, setPendingDelete] = useState<ColorMeaning | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/color-meanings");
      const json = await res.json().catch(() => null);
      if (res.ok && Array.isArray(json?.meanings)) {
        setItems(
          json.meanings.map((m: any) => ({
            ...m,
            associations: Array.isArray(m.associations) ? m.associations : [],
            samplePalettes: Array.isArray(m.samplePalettes) ? m.samplePalettes : [],
          })),
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
    return items.filter((m) => {
      if (statusFilter !== "ALL" && m.status !== statusFilter) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.slug.toLowerCase().includes(q) ||
        m.hex.toLowerCase().includes(q)
      );
    });
  }, [items, query, statusFilter]);

  const publishedCount = items.filter((m) => m.status === "PUBLISHED").length;
  const draftCount = items.length - publishedCount;
  const filtersActive = query.trim() !== "" || statusFilter !== "ALL";
  const resetFilters = () => {
    setQuery("");
    setStatusFilter("ALL");
  };

  const baselineForm = selected ? formFromItem(selected) : emptyForm;
  const baselineMeaning = selected ? (selected.meaning ?? "") : "";
  const dirty = !sameForm(form, baselineForm) || meaningHtml !== baselineMeaning;

  const clearErrors = () => {
    setNameError(null);
    setHexSubmitError(false);
  };

  const resetForm = () => {
    setSelected(null);
    setForm(emptyForm);
    setMeaningHtml("");
    setTab("basics");
    clearErrors();
  };

  const editItem = (m: ColorMeaning) => {
    setSelected(m);
    setForm(formFromItem(m));
    setMeaningHtml(m.meaning ?? "");
    clearErrors();
  };

  const save = async () => {
    clearErrors();
    if (!form.name.trim()) {
      setNameError("Name is required.");
      setTab("basics");
      showToast({ type: "error", title: "Name is required" });
      return;
    }
    if (!normalizeHex(form.hex)) {
      setHexSubmitError(true);
      setTab("basics");
      showToast({ type: "error", title: "Valid hex is required" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim() || undefined,
        hex: form.hex,
        summary: form.summary.trim() || null,
        meaning: meaningHtml || null,
        associations: form.associations
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        samplePalettes: parseSamplePalettes(form.samplePalettes),
        metaTitle: form.metaTitle.trim() || null,
        metaDescription: form.metaDescription.trim() || null,
        status: form.status,
        sortOrder: Number(form.sortOrder) || 0,
      };
      const res = selected
        ? await fetch(`/api/admin/color-meanings/${selected.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/admin/color-meanings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      if (!res.ok) throw new Error();
      showToast({ type: "success", title: selected ? "Updated" : "Created" });
      resetForm();
      await load();
    } catch {
      showToast({ type: "error", title: "Couldn't save" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (m: ColorMeaning) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/color-meanings/${m.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      showToast({ type: "success", title: "Deleted" });
      if (selected?.id === m.id) resetForm();
      await load();
    } catch {
      showToast({ type: "error", title: "Couldn't delete" });
    } finally {
      setDeleting(false);
    }
  };

  const normalizedHex = normalizeHex(form.hex);
  const hexPreview = normalizedHex ?? "#000000";
  const hexError =
    !normalizedHex && (hexSubmitError || form.hex.trim() !== "")
      ? "Enter a valid hex value, e.g. #C0392B."
      : undefined;

  const parsedPalettes = parseSamplePalettes(form.samplePalettes);
  const droppedTokens = invalidPaletteTokens(form.samplePalettes);
  const associationList = form.associations
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  // ---------------------------------------------------------------------------
  // Editor panel
  // ---------------------------------------------------------------------------

  const tabIds = "color-meaning-editor";

  const panelTitle = (
    <span className="flex min-w-0 flex-wrap items-center gap-3">
      <span className="truncate">{selected ? selected.name : "New color"}</span>
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
        onClose={selected ? resetForm : undefined}
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
                    : "New entry · not saved"
                  : selected
                    ? "No unsaved changes"
                    : "New entry · nothing entered yet"
            }
          >
            {dirty && (
              <Button
                variant="ghost"
                disabled={saving}
                onClick={() => {
                  setForm(baselineForm);
                  setMeaningHtml(baselineMeaning);
                  clearErrors();
                }}
              >
                {selected ? "Discard" : "Cancel"}
              </Button>
            )}
            <Button type="submit" variant="primary" disabled={!dirty || saving}>
              {saving ? "Saving…" : selected ? "Save changes" : "Create color"}
            </Button>
          </SaveBar>
        }
      >
        <Tabs
          idPrefix={tabIds}
          label="Color settings"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "basics", label: "Basics" },
            { value: "meaning", label: "Meaning" },
            {
              value: "palettes",
              label: parsedPalettes.length ? `Palettes · ${parsedPalettes.length}` : "Palettes",
            },
            { value: "publishing", label: "Publish" },
          ]}
        />

        <div className="pt-5">
          {tab === "basics" && (
            <TabPanel idPrefix={tabIds} value="basics">
              <div className="space-y-5">
                <Field label="Name" htmlFor="cm-name" error={nameError ?? undefined}>
                  <TextInput
                    id="cm-name"
                    value={form.name}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, name: e.target.value }));
                      setNameError(null);
                    }}
                    aria-invalid={!!nameError}
                    placeholder="Red"
                  />
                </Field>

                <Field label="Hex color" htmlFor="cm-hex" error={hexError}>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={hexPreview}
                      onChange={(e) => {
                        setForm((f) => ({ ...f, hex: e.target.value }));
                        setHexSubmitError(false);
                      }}
                      className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-[var(--av2-border)] bg-[var(--av2-surface)] p-1"
                      aria-label="Pick color"
                    />
                    <TextInput
                      id="cm-hex"
                      value={form.hex}
                      onChange={(e) => {
                        setForm((f) => ({ ...f, hex: e.target.value }));
                        setHexSubmitError(false);
                      }}
                      aria-invalid={!!hexError}
                      className="font-mono uppercase"
                      spellCheck={false}
                    />
                  </div>
                </Field>

                <Field
                  label="Slug (optional)"
                  htmlFor="cm-slug"
                  hint="Leave blank to generate from the name."
                >
                  <TextInput
                    id="cm-slug"
                    value={form.slug}
                    onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                    placeholder="red"
                    spellCheck={false}
                  />
                </Field>

                <Field label="Summary" htmlFor="cm-summary">
                  <TextArea
                    id="cm-summary"
                    value={form.summary}
                    onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
                    rows={2}
                    placeholder="Short introduction shown in the encyclopedia."
                  />
                </Field>

                <PanelSection title="Color preview">
                  <div className="flex items-center gap-4 rounded-xl border border-[var(--av2-border)] bg-[var(--av2-bg)] p-4">
                    <span
                      aria-hidden
                      className="h-16 w-24 shrink-0 rounded-lg border border-[var(--av2-border)]"
                      style={
                        normalizedHex
                          ? { backgroundColor: normalizedHex }
                          : {
                              backgroundImage:
                                "repeating-linear-gradient(45deg, var(--av2-track) 0 4px, var(--av2-surface) 4px 8px)",
                            }
                      }
                    />
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold">
                        {form.name.trim() || "Untitled color"}
                      </p>
                      <p className="font-mono text-sm text-[var(--av2-text-2)]">
                        {normalizedHex ? formatHex(normalizedHex) : "Invalid hex"}
                      </p>
                    </div>
                  </div>
                </PanelSection>
              </div>
            </TabPanel>
          )}

          {tab === "meaning" && (
            <TabPanel idPrefix={tabIds} value="meaning">
              <div className="space-y-5">
                <div>
                  <p className="mb-1.5 text-sm font-medium">Meaning &amp; psychology</p>
                  <RichTextEditor
                    value={meaningHtml}
                    onChange={setMeaningHtml}
                    placeholder="What this color communicates…"
                  />
                </div>

                <Field
                  label="Associations"
                  htmlFor="cm-associations"
                  hint="Comma-separated, e.g. passion, energy, urgency."
                >
                  <TextInput
                    id="cm-associations"
                    value={form.associations}
                    onChange={(e) => setForm((f) => ({ ...f, associations: e.target.value }))}
                    placeholder="passion, energy, urgency"
                  />
                </Field>
                {associationList.length > 0 && (
                  <div className="-mt-2 flex flex-wrap gap-2">
                    {associationList.map((a, i) => (
                      <Badge key={`${a}-${i}`} tone="lavender">
                        {a}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </TabPanel>
          )}

          {tab === "palettes" && (
            <TabPanel idPrefix={tabIds} value="palettes">
              <div className="space-y-5">
                <Field
                  label="Sample palettes"
                  htmlFor="cm-sample-palettes"
                  hint="One palette per line, comma-separated hex values."
                  error={
                    droppedTokens.length > 0
                      ? `Not valid hex, will be skipped: ${droppedTokens.slice(0, 5).join(", ")}${
                          droppedTokens.length > 5 ? "…" : ""
                        }`
                      : undefined
                  }
                >
                  <TextArea
                    id="cm-sample-palettes"
                    value={form.samplePalettes}
                    onChange={(e) => setForm((f) => ({ ...f, samplePalettes: e.target.value }))}
                    rows={5}
                    aria-invalid={droppedTokens.length > 0}
                    className="font-mono"
                    spellCheck={false}
                    placeholder={"#c0392b, #ecf0f1, #2c3e50\n#e74c3c, #f39c12, #ffffff"}
                  />
                </Field>

                <PanelSection title="Preview">
                  {parsedPalettes.length === 0 ? (
                    <p className="text-sm text-[var(--av2-text-2)]">
                      No sample palettes yet. Add a line above to see it here.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {parsedPalettes.map((row, i) => (
                        <li key={i} className="flex items-center gap-3">
                          <span className="w-6 shrink-0 text-xs text-[var(--av2-text-2)] tabular-nums">
                            {i + 1}
                          </span>
                          <span
                            role="img"
                            aria-label={`Palette ${i + 1}: ${row.join(", ")}`}
                            className="flex h-10 flex-1 overflow-hidden rounded-lg border border-[var(--av2-border)]"
                          >
                            {row.map((c, j) => (
                              <span key={j} className="flex-1" style={{ backgroundColor: c }} />
                            ))}
                          </span>
                          <span className="w-16 shrink-0 text-right text-xs text-[var(--av2-text-2)] tabular-nums">
                            {fmt(row.length)} {plural(row.length, "colour", "colours")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </PanelSection>
              </div>
            </TabPanel>
          )}

          {tab === "publishing" && (
            <TabPanel idPrefix={tabIds} value="publishing">
              <div className="space-y-5">
                <Field label="Meta title (SEO)" htmlFor="cm-meta-title">
                  <TextInput
                    id="cm-meta-title"
                    value={form.metaTitle}
                    onChange={(e) => setForm((f) => ({ ...f, metaTitle: e.target.value }))}
                  />
                </Field>
                <Field label="Meta description (SEO)" htmlFor="cm-meta-description">
                  <TextInput
                    id="cm-meta-description"
                    value={form.metaDescription}
                    onChange={(e) => setForm((f) => ({ ...f, metaDescription: e.target.value }))}
                  />
                </Field>

                <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_140px]">
                  <Field label="Status" htmlFor="cm-status">
                    <Select
                      id="cm-status"
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
                  <Field label="Sort order" htmlFor="cm-sort-order">
                    <TextInput
                      id="cm-sort-order"
                      type="number"
                      inputMode="numeric"
                      value={form.sortOrder}
                      onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                    />
                  </Field>
                </div>

                {selected && (
                  <PanelSection title="Danger zone">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm text-[var(--av2-text-2)]">
                        Deleting removes this entry permanently.
                      </p>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={deleting || saving}
                        onClick={() => setPendingDelete(selected)}
                      >
                        Delete color
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
        title="Color meanings"
        description="Encyclopedia entries shown at /colors/color-meanings."
        meta={
          loaded && !loadError ? (
            <span className="tabular-nums">
              {fmt(items.length)} {plural(items.length, "color", "colors")} · {fmt(publishedCount)}{" "}
              published · {fmt(draftCount)} {plural(draftCount, "draft", "drafts")}
            </span>
          ) : undefined
        }
        actions={
          <Button variant="primary" onClick={resetForm}>
            <IconPlus />
            New color
          </Button>
        }
      />

      {loadError && (
        <div className="mb-6">
          <Callout
            tone="error"
            title="Couldn't load colors"
            action={
              <Button size="sm" onClick={() => void load()}>
                Retry
              </Button>
            }
          >
            The color list request failed. Try again.
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
                placeholder="Search colors"
                label="Search colors by name, slug or hex"
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
                <span className="sr-only">Loading colors…</span>
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : items.length === 0 ? (
              loadError ? null : (
                <EmptyState
                  icon={<IconDroplet />}
                  title="No colors yet"
                  description="Create the first encyclopedia entry with the New color button."
                />
              )
            ) : filtered.length === 0 ? (
              <EmptyState
                title="No colors match these filters"
                description="Try a different search or status."
                action={<Button onClick={resetFilters}>Clear filters</Button>}
              />
            ) : (
              <ul className="space-y-2" aria-label="Colors">
                {filtered.map((m) => {
                  const active = selected?.id === m.id;
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => editItem(m)}
                        aria-pressed={active}
                        className={`flex w-full items-center gap-4 rounded-xl border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none ${
                          active
                            ? "border-[var(--av2-accent)] bg-[var(--av2-selected)] shadow-[inset_3px_0_0_var(--av2-accent)]"
                            : "border-[var(--av2-border)] hover:bg-[var(--av2-bg)]"
                        }`}
                      >
                        <span
                          aria-hidden
                          className="h-10 w-10 shrink-0 rounded-lg border border-[var(--av2-border)]"
                          style={{ backgroundColor: m.hex }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{m.name}</span>
                          <span className="block font-mono text-xs text-[var(--av2-text-2)] uppercase">
                            {m.hex}
                          </span>
                        </span>
                        <StatusBadge status={m.status} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {loaded && items.length > 0 && (
            <TableFooter>
              <span className="tabular-nums">
                Showing {fmt(filtered.length)} of {fmt(items.length)}{" "}
                {plural(items.length, "color", "colors")}
              </span>
              {filtersActive ? (
                <Button size="sm" variant="ghost" onClick={resetFilters}>
                  Clear filters
                </Button>
              ) : (
                <span>Select a color to edit it.</span>
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
        title="Delete this color?"
        description={
          pendingDelete
            ? `Delete "${pendingDelete.name}"? It will be removed from the encyclopedia.`
            : undefined
        }
        confirmLabel="Delete"
      />
    </>
  );
}
