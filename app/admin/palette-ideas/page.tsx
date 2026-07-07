// -----------------------------------------------------------------------------
// @file: app/admin/palette-ideas/page.tsx
// @purpose: Admin CMS for curated palette ideas (list + inline editor).
//           Mirrors the showcase split-view pattern.
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormInput, FormTextarea, FormSelect } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast-provider";
import { normalizeHex, formatHex, readableTextOn } from "@/lib/colors";

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

const emptyForm = {
  title: "",
  slug: "",
  summary: "",
  tags: "",
  status: "DRAFT" as "DRAFT" | "PUBLISHED",
  sortOrder: "0",
};

export default function AdminPaletteIdeasPage() {
  const { showToast } = useToast();
  const [ideas, setIdeas] = useState<PaletteIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PaletteIdea | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [colors, setColors] = useState<string[]>([]);
  const [colorDraft, setColorDraft] = useState("#f15b2b");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/palette-ideas");
      const json = await res.json().catch(() => null);
      if (res.ok && Array.isArray(json?.ideas)) {
        setIdeas(
          json.ideas.map((i: any) => ({ ...i, colors: Array.isArray(i.colors) ? i.colors : [] })),
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const resetForm = () => {
    setSelected(null);
    setForm(emptyForm);
    setColors([]);
  };

  const editIdea = (idea: PaletteIdea) => {
    setSelected(idea);
    setForm({
      title: idea.title,
      slug: idea.slug,
      summary: idea.summary ?? "",
      tags: idea.tags.join(", "),
      status: idea.status,
      sortOrder: String(idea.sortOrder),
    });
    setColors(idea.colors);
  };

  const addColor = () => {
    const hex = normalizeHex(colorDraft);
    if (!hex) {
      showToast({ type: "error", title: "Invalid hex" });
      return;
    }
    if (colors.length >= 12) return;
    setColors((prev) => [...prev, hex]);
  };

  const save = async () => {
    if (!form.title.trim()) {
      showToast({ type: "error", title: "Title is required" });
      return;
    }
    if (colors.length === 0) {
      showToast({ type: "error", title: "Add at least one color" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        slug: form.slug.trim() || undefined,
        summary: form.summary.trim() || null,
        colors,
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
    if (!window.confirm(`Delete "${idea.title}"?`)) return;
    try {
      const res = await fetch(`/api/admin/palette-ideas/${idea.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      showToast({ type: "success", title: "Deleted" });
      if (selected?.id === idea.id) resetForm();
      await load();
    } catch {
      showToast({ type: "error", title: "Couldn't delete" });
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--bb-secondary)]">Palette Ideas</h1>
          <p className="text-sm text-[var(--bb-text-tertiary)]">
            Curated palettes shown in the public /colors/color-palette-ideas gallery.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={resetForm}>
          + New palette
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.2fr]">
        {/* List */}
        <div className="space-y-2">
          {loading ? (
            <p className="text-sm text-[var(--bb-text-tertiary)]">Loading…</p>
          ) : ideas.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[var(--bb-border)] px-4 py-8 text-center text-sm text-[var(--bb-text-tertiary)]">
              No palettes yet.
            </p>
          ) : (
            ideas.map((idea) => (
              <div
                key={idea.id}
                className={`flex items-center gap-3 rounded-xl border p-3 ${
                  selected?.id === idea.id
                    ? "border-[var(--bb-primary)]"
                    : "border-[var(--bb-border)]"
                }`}
              >
                <div className="flex h-8 w-24 overflow-hidden rounded-md">
                  {idea.colors.map((c, i) => (
                    <div key={i} className="flex-1" style={{ backgroundColor: c }} />
                  ))}
                </div>
                <button type="button" onClick={() => editIdea(idea)} className="flex-1 text-left">
                  <span className="text-sm font-medium text-[var(--bb-secondary)]">
                    {idea.title}
                  </span>
                  <span className="ml-2 text-[10px] tracking-wide text-[var(--bb-text-muted)] uppercase">
                    {idea.status}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => remove(idea)}
                  className="text-xs text-[var(--bb-danger-text)] hover:underline"
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>

        {/* Editor */}
        <div className="space-y-4 rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)] p-5">
          <h2 className="text-sm font-semibold text-[var(--bb-secondary)]">
            {selected ? "Edit palette" : "New palette"}
          </h2>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--bb-text-secondary)]">Title</label>
            <FormInput
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Autumn warmth"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--bb-text-secondary)]">
              Slug (optional — auto-generated)
            </label>
            <FormInput
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              placeholder="autumn-warmth"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--bb-text-secondary)]">Summary</label>
            <FormTextarea
              value={form.summary}
              onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
              rows={2}
            />
          </div>

          {/* Colors editor */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-[var(--bb-text-secondary)]">
              Colors ({colors.length}/12)
            </label>
            <div className="flex flex-wrap gap-2">
              {colors.map((c, i) => (
                <span
                  key={`${c}-${i}`}
                  className="flex items-center gap-1 rounded-full border border-[var(--bb-border)] py-1 pr-2 pl-1"
                >
                  <span
                    className="h-5 w-5 rounded-full"
                    style={{ backgroundColor: c, color: readableTextOn(c) }}
                  />
                  <span className="font-mono text-xs">{formatHex(c)}</span>
                  <button
                    type="button"
                    onClick={() => setColors((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-[var(--bb-text-muted)] hover:text-[var(--bb-danger-text)]"
                    aria-label={`Remove ${c}`}
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={colors.length < 12 ? colorDraft : "#000000"}
                onChange={(e) => setColorDraft(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-[var(--bb-border)]"
                aria-label="Pick a color"
              />
              <FormInput
                value={colorDraft}
                onChange={(e) => setColorDraft(e.target.value)}
                className="w-32"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={addColor}
                disabled={colors.length >= 12}
              >
                Add color
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--bb-text-secondary)]">
              Tags (comma-separated)
            </label>
            <FormInput
              value={form.tags}
              onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              placeholder="Vintage, Warm, Autumn"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-medium text-[var(--bb-text-secondary)]">Status</label>
              <FormSelect
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value as "DRAFT" | "PUBLISHED" }))
                }
              >
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
              </FormSelect>
            </div>
            <div className="w-28 space-y-1.5">
              <label className="text-xs font-medium text-[var(--bb-text-secondary)]">
                Sort order
              </label>
              <FormInput
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="primary" size="sm" loading={saving} onClick={save}>
              {selected ? "Save changes" : "Create palette"}
            </Button>
            {selected ? (
              <Button variant="ghost" size="sm" onClick={resetForm}>
                Cancel
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
