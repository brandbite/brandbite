// -----------------------------------------------------------------------------
// @file: app/admin/color-meanings/page.tsx
// @purpose: Admin CMS for the color-meanings encyclopedia (list + inline editor).
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormInput, FormTextarea, FormSelect } from "@/components/ui/form-field";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { useToast } from "@/components/ui/toast-provider";
import { normalizeHex, formatHex, readableTextOn } from "@/lib/colors";

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

function stringifySamplePalettes(rows: string[][]): string {
  return rows.map((row) => row.map((c) => formatHex(c)).join(", ")).join("\n");
}

export default function AdminColorMeaningsPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState<ColorMeaning[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ColorMeaning | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [meaningHtml, setMeaningHtml] = useState("");
  const [saving, setSaving] = useState(false);

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
    setMeaningHtml("");
  };

  const editItem = (m: ColorMeaning) => {
    setSelected(m);
    setForm({
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
    setMeaningHtml(m.meaning ?? "");
  };

  const save = async () => {
    if (!form.name.trim()) {
      showToast({ type: "error", title: "Name is required" });
      return;
    }
    if (!normalizeHex(form.hex)) {
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
    if (!window.confirm(`Delete "${m.name}"?`)) return;
    try {
      const res = await fetch(`/api/admin/color-meanings/${m.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      showToast({ type: "success", title: "Deleted" });
      if (selected?.id === m.id) resetForm();
      await load();
    } catch {
      showToast({ type: "error", title: "Couldn't delete" });
    }
  };

  const hexPreview = normalizeHex(form.hex) ?? "#000000";

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--bb-secondary)]">Color Meanings</h1>
          <p className="text-sm text-[var(--bb-text-tertiary)]">
            Encyclopedia entries shown at /colors/color-meanings.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={resetForm}>
          + New color
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.4fr]">
        {/* List */}
        <div className="space-y-2">
          {loading ? (
            <p className="text-sm text-[var(--bb-text-tertiary)]">Loading…</p>
          ) : items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[var(--bb-border)] px-4 py-8 text-center text-sm text-[var(--bb-text-tertiary)]">
              No colors yet.
            </p>
          ) : (
            items.map((m) => (
              <div
                key={m.id}
                className={`flex items-center gap-3 rounded-xl border p-3 ${
                  selected?.id === m.id ? "border-[var(--bb-primary)]" : "border-[var(--bb-border)]"
                }`}
              >
                <span
                  className="h-8 w-8 rounded-md"
                  style={{ backgroundColor: m.hex }}
                  title={m.hex}
                />
                <button type="button" onClick={() => editItem(m)} className="flex-1 text-left">
                  <span className="text-sm font-medium text-[var(--bb-secondary)]">{m.name}</span>
                  <span className="ml-2 text-[10px] tracking-wide text-[var(--bb-text-muted)] uppercase">
                    {m.status}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => remove(m)}
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
            {selected ? "Edit color" : "New color"}
          </h2>

          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-medium text-[var(--bb-text-secondary)]">Name</label>
              <FormInput
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Red"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--bb-text-secondary)]">Hex</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={hexPreview}
                  onChange={(e) => setForm((f) => ({ ...f, hex: e.target.value }))}
                  className="h-9 w-12 cursor-pointer rounded border border-[var(--bb-border)]"
                  aria-label="Pick color"
                />
                <FormInput
                  value={form.hex}
                  onChange={(e) => setForm((f) => ({ ...f, hex: e.target.value }))}
                  className="w-28"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--bb-text-secondary)]">
              Slug (optional)
            </label>
            <FormInput
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              placeholder="red"
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

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--bb-text-secondary)]">
              Meaning &amp; psychology
            </label>
            <RichTextEditor
              value={meaningHtml}
              onChange={setMeaningHtml}
              placeholder="What this color communicates…"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--bb-text-secondary)]">
              Associations (comma-separated)
            </label>
            <FormInput
              value={form.associations}
              onChange={(e) => setForm((f) => ({ ...f, associations: e.target.value }))}
              placeholder="passion, energy, urgency"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--bb-text-secondary)]">
              Sample palettes (one per line, comma-separated hex)
            </label>
            <FormTextarea
              value={form.samplePalettes}
              onChange={(e) => setForm((f) => ({ ...f, samplePalettes: e.target.value }))}
              rows={3}
              placeholder="#c0392b, #ecf0f1, #2c3e50&#10;#e74c3c, #f39c12, #ffffff"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--bb-text-secondary)]">
                Meta title (SEO)
              </label>
              <FormInput
                value={form.metaTitle}
                onChange={(e) => setForm((f) => ({ ...f, metaTitle: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--bb-text-secondary)]">
                Meta description (SEO)
              </label>
              <FormInput
                value={form.metaDescription}
                onChange={(e) => setForm((f) => ({ ...f, metaDescription: e.target.value }))}
              />
            </div>
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
              {selected ? "Save changes" : "Create color"}
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
