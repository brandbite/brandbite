// -----------------------------------------------------------------------------
// @file: components/blocks/admin/SiteFooterBlockForm.tsx
// @purpose: Admin form for the SITE_FOOTER block — manages the brand
//           statement, multi-column link grid, and bottom legal-link
//           strip on every marketing page.
//
//           Saves via PUT /api/admin/page-blocks/global/SITE_FOOTER.
// -----------------------------------------------------------------------------
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-04-30
// -----------------------------------------------------------------------------

"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FormInput } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { useToast } from "@/components/ui/toast-provider";

import type { SiteFooterData } from "@/lib/blocks/types";

type SiteFooterBlockFormProps = {
  initial: SiteFooterData;
};

const MIN_COLUMNS = 1;
const MAX_COLUMNS = 6;
const MIN_LINKS_PER_COL = 1;
const MAX_LINKS_PER_COL = 10;
const MAX_LEGAL_LINKS = 10;

type LinkDraft = { label: string; href: string };
type ColumnDraft = { title: string; links: LinkDraft[] };

export function SiteFooterBlockForm({ initial }: SiteFooterBlockFormProps) {
  const { showToast } = useToast();

  const [brandStatement, setBrandStatement] = useState<string>(initial.brandStatement ?? "");
  const [columns, setColumns] = useState<ColumnDraft[]>(
    initial.columns.map((c) => ({
      title: c.title,
      links: c.links.map((l) => ({ label: l.label, href: l.href })),
    })),
  );
  const [legalLinks, setLegalLinks] = useState<LinkDraft[]>(
    (initial.legalLinks ?? []).map((l) => ({ label: l.label, href: l.href })),
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- Column-level operations --------------------------------------

  const addColumn = () => {
    if (columns.length >= MAX_COLUMNS) return;
    setColumns((prev) => [...prev, { title: "", links: [{ label: "", href: "" }] }]);
  };

  const removeColumn = (idx: number) => {
    if (columns.length <= MIN_COLUMNS) return;
    setColumns((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveColumn = (idx: number, direction: -1 | 1) => {
    const target = idx + direction;
    if (target < 0 || target >= columns.length) return;
    setColumns((prev) => {
      const next = prev.slice();
      const [moved] = next.splice(idx, 1);
      next.splice(target, 0, moved);
      return next;
    });
  };

  const updateColumnTitle = (idx: number, title: string) => {
    setColumns((prev) => prev.map((c, i) => (i === idx ? { ...c, title } : c)));
  };

  // ---- Link-within-column operations --------------------------------

  const updateLink = (colIdx: number, linkIdx: number, patch: Partial<LinkDraft>) => {
    setColumns((prev) =>
      prev.map((c, i) =>
        i === colIdx
          ? { ...c, links: c.links.map((l, j) => (j === linkIdx ? { ...l, ...patch } : l)) }
          : c,
      ),
    );
  };

  const addLink = (colIdx: number) => {
    setColumns((prev) =>
      prev.map((c, i) => {
        if (i !== colIdx) return c;
        if (c.links.length >= MAX_LINKS_PER_COL) return c;
        return { ...c, links: [...c.links, { label: "", href: "" }] };
      }),
    );
  };

  const removeLink = (colIdx: number, linkIdx: number) => {
    setColumns((prev) =>
      prev.map((c, i) => {
        if (i !== colIdx) return c;
        if (c.links.length <= MIN_LINKS_PER_COL) return c;
        return { ...c, links: c.links.filter((_, j) => j !== linkIdx) };
      }),
    );
  };

  const moveLink = (colIdx: number, linkIdx: number, direction: -1 | 1) => {
    setColumns((prev) =>
      prev.map((c, i) => {
        if (i !== colIdx) return c;
        const target = linkIdx + direction;
        if (target < 0 || target >= c.links.length) return c;
        const nextLinks = c.links.slice();
        const [moved] = nextLinks.splice(linkIdx, 1);
        nextLinks.splice(target, 0, moved);
        return { ...c, links: nextLinks };
      }),
    );
  };

  // ---- Legal-link operations ----------------------------------------

  const updateLegalLink = (idx: number, patch: Partial<LinkDraft>) => {
    setLegalLinks((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const addLegalLink = () => {
    if (legalLinks.length >= MAX_LEGAL_LINKS) return;
    setLegalLinks((prev) => [...prev, { label: "", href: "" }]);
  };

  const removeLegalLink = (idx: number) => {
    setLegalLinks((prev) => prev.filter((_, i) => i !== idx));
  };

  // ---- Save ---------------------------------------------------------

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (columns.length < MIN_COLUMNS) {
      setError("At least one footer column is required.");
      return;
    }
    for (let i = 0; i < columns.length; i++) {
      const c = columns[i];
      if (!c.title.trim()) {
        setError(`Column ${i + 1} needs a title.`);
        return;
      }
      if (c.links.length < MIN_LINKS_PER_COL) {
        setError(`Column ${i + 1} needs at least one link.`);
        return;
      }
      for (let j = 0; j < c.links.length; j++) {
        if (!c.links[j].label.trim()) {
          setError(`Column ${i + 1}, link ${j + 1} needs a label.`);
          return;
        }
        if (!c.links[j].href.trim()) {
          setError(`Column ${i + 1}, link ${j + 1} needs a destination.`);
          return;
        }
      }
    }
    for (let i = 0; i < legalLinks.length; i++) {
      const l = legalLinks[i];
      if (!l.label.trim() || !l.href.trim()) {
        setError(`Legal link ${i + 1} needs both a label and destination.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const trimmedLegal = legalLinks
        .map((l) => ({ label: l.label.trim(), href: l.href.trim() }))
        .filter((l) => l.label && l.href);

      const data: SiteFooterData = {
        ...(brandStatement.trim() ? { brandStatement: brandStatement.trim() } : {}),
        columns: columns.map((c) => ({
          title: c.title.trim(),
          links: c.links.map((l) => ({ label: l.label.trim(), href: l.href.trim() })),
        })),
        ...(trimmedLegal.length > 0 ? { legalLinks: trimmedLegal } : {}),
      };

      const res = await fetch(`/api/admin/page-blocks/global/SITE_FOOTER`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });
      const json = (await res.json().catch(() => null)) as {
        error?: string;
        reason?: string;
      } | null;
      if (!res.ok) {
        throw new Error(json?.reason || json?.error || "Save failed.");
      }

      showToast({
        type: "success",
        title: "Footer saved",
        description: "Reload any marketing page to see your changes.",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Render -------------------------------------------------------

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Brand statement -------------------------------------------- */}
      <div>
        <label
          htmlFor="ftr-brand-statement"
          className="mb-1 block text-xs font-semibold text-[var(--bb-secondary)]"
        >
          Brand statement (optional)
        </label>
        <FormInput
          id="ftr-brand-statement"
          value={brandStatement}
          onChange={(e) => setBrandStatement(e.target.value)}
          placeholder="All your creatives, one subscription"
          maxLength={200}
        />
        <p className="mt-1 text-xs text-[var(--bb-text-muted)]">
          Renders below the logo. The text after the last comma is highlighted in the brand colour.
        </p>
      </div>

      {/* Columns ---------------------------------------------------- */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--bb-secondary)]">
            Link columns ({columns.length}/{MAX_COLUMNS})
          </h3>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addColumn}
            disabled={columns.length >= MAX_COLUMNS}
          >
            Add column
          </Button>
        </div>

        {columns.map((col, colIdx) => (
          <div
            key={colIdx}
            className="rounded-xl border border-[var(--bb-border-subtle)] bg-[var(--bb-bg-warm)] px-4 py-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold tracking-[0.12em] text-[var(--bb-text-tertiary)] uppercase">
                Column {colIdx + 1}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => moveColumn(colIdx, -1)}
                  disabled={colIdx === 0}
                  aria-label={`Move column ${colIdx + 1} left`}
                >
                  ←
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => moveColumn(colIdx, 1)}
                  disabled={colIdx === columns.length - 1}
                  aria-label={`Move column ${colIdx + 1} right`}
                >
                  →
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeColumn(colIdx)}
                  disabled={columns.length <= MIN_COLUMNS}
                  aria-label={`Remove column ${colIdx + 1}`}
                >
                  Remove
                </Button>
              </div>
            </div>

            <div className="mb-3">
              <label
                htmlFor={`ftr-col-title-${colIdx}`}
                className="mb-1 block text-xs font-semibold text-[var(--bb-secondary)]"
              >
                Column title <span className="text-[var(--bb-primary)]">*</span>
              </label>
              <FormInput
                id={`ftr-col-title-${colIdx}`}
                value={col.title}
                onChange={(e) => updateColumnTitle(colIdx, e.target.value)}
                placeholder="Platform"
                maxLength={40}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--bb-secondary)]">
                  Links ({col.links.length}/{MAX_LINKS_PER_COL})
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => addLink(colIdx)}
                  disabled={col.links.length >= MAX_LINKS_PER_COL}
                >
                  Add link
                </Button>
              </div>

              {col.links.map((link, linkIdx) => (
                <div key={linkIdx} className="rounded-md bg-[var(--bb-bg-page)] px-3 py-2">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <FormInput
                      value={link.label}
                      onChange={(e) => updateLink(colIdx, linkIdx, { label: e.target.value })}
                      placeholder="Label"
                      maxLength={40}
                    />
                    <FormInput
                      value={link.href}
                      onChange={(e) => updateLink(colIdx, linkIdx, { href: e.target.value })}
                      placeholder="/path"
                      maxLength={200}
                    />
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => moveLink(colIdx, linkIdx, -1)}
                        disabled={linkIdx === 0}
                        aria-label="Move link up"
                      >
                        ↑
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => moveLink(colIdx, linkIdx, 1)}
                        disabled={linkIdx === col.links.length - 1}
                        aria-label="Move link down"
                      >
                        ↓
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLink(colIdx, linkIdx)}
                        disabled={col.links.length <= MIN_LINKS_PER_COL}
                        aria-label="Remove link"
                      >
                        ✕
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Legal-link strip ------------------------------------------- */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--bb-secondary)]">
            Bottom legal-link bar ({legalLinks.length}/{MAX_LEGAL_LINKS})
          </h3>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addLegalLink}
            disabled={legalLinks.length >= MAX_LEGAL_LINKS}
          >
            Add legal link
          </Button>
        </div>
        <p className="text-xs text-[var(--bb-text-muted)]">
          The orange strip at the very bottom. Leave empty to hide it.
        </p>

        {legalLinks.length === 0 ? (
          <p className="rounded-md border border-dashed border-[var(--bb-border)] bg-[var(--bb-bg-warm)] px-3 py-3 text-center text-xs text-[var(--bb-text-muted)]">
            No legal links. The orange bottom strip will only show the copyright line.
          </p>
        ) : (
          legalLinks.map((link, idx) => (
            <div key={idx} className="rounded-md bg-[var(--bb-bg-warm)] px-3 py-2">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <FormInput
                  value={link.label}
                  onChange={(e) => updateLegalLink(idx, { label: e.target.value })}
                  placeholder="Privacy Policy"
                  maxLength={40}
                />
                <FormInput
                  value={link.href}
                  onChange={(e) => updateLegalLink(idx, { href: e.target.value })}
                  placeholder="/privacy"
                  maxLength={200}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeLegalLink(idx)}
                  aria-label="Remove legal link"
                >
                  ✕
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}

      <div className="flex justify-end gap-3 pt-2">
        <Button
          type="submit"
          variant="primary"
          loading={submitting}
          loadingText="Saving…"
          disabled={submitting}
        >
          Save footer
        </Button>
      </div>
    </form>
  );
}
