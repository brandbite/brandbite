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

import { Button, Field, TextInput } from "@/components/admin/v2/ui";
import { useToast } from "@/components/ui/toast-provider";

import {
  AddButton,
  BlockSaveFooter,
  FormSection,
  IconTrash,
  LinkList,
  LinkRow,
  ReorderActions,
  Req,
  useDirtyBaseline,
} from "./block-form-ui";

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

  // Presentation only: drives the SaveBar status + disables Save when clean.
  const { dirty, markSaved } = useDirtyBaseline(
    JSON.stringify([brandStatement, columns, legalLinks]),
  );
  const [selectedCol, setSelectedCol] = useState(0);

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

      markSaved();
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

  // ---- Column selection (presentation only) -------------------------
  // Only one column's links are shown at a time; every column stays in
  // `columns` state and is validated + saved together as before.

  const sel = Math.min(selectedCol, columns.length - 1);
  const selectedColumn = columns[sel];

  const handleAddColumn = () => {
    if (columns.length >= MAX_COLUMNS) return;
    addColumn();
    setSelectedCol(columns.length);
  };

  const handleRemoveColumn = (idx: number) => {
    if (columns.length <= MIN_COLUMNS) return;
    removeColumn(idx);
    setSelectedCol((s) => (idx < s || s === columns.length - 1 ? Math.max(0, s - 1) : s));
  };

  const handleMoveColumn = (idx: number, direction: -1 | 1) => {
    const target = idx + direction;
    if (target < 0 || target >= columns.length) return;
    moveColumn(idx, direction);
    setSelectedCol((s) => (s === idx ? target : s === target ? idx : s));
  };

  // ---- Render -------------------------------------------------------

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Brand statement -------------------------------------------- */}
      <FormSection>
        <Field
          label="Brand statement (optional)"
          htmlFor="ftr-brand-statement"
          hint="Renders below the logo. The text after the last comma is highlighted in the brand colour."
        >
          <TextInput
            id="ftr-brand-statement"
            value={brandStatement}
            onChange={(e) => setBrandStatement(e.target.value)}
            placeholder="All your creatives, one subscription"
            maxLength={200}
          />
        </Field>
      </FormSection>

      {/* Columns ---------------------------------------------------- */}
      <FormSection
        title="Footer columns"
        count={`${columns.length} / ${MAX_COLUMNS}`}
        description="Select a column to edit its title and links."
        action={
          <AddButton onClick={handleAddColumn} disabled={columns.length >= MAX_COLUMNS}>
            Add column
          </AddButton>
        }
      >
        <div className="grid items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <ul aria-label="Footer columns" className="space-y-2">
            {columns.map((col, colIdx) => {
              const active = colIdx === sel;
              return (
                <li
                  key={colIdx}
                  className={`flex items-center gap-1 rounded-xl border py-1 pr-1 pl-1 transition-colors ${
                    active
                      ? "border-[var(--av2-accent)]/40 bg-[var(--av2-selected)]"
                      : "border-[var(--av2-border)] bg-[var(--av2-surface)] hover:bg-[var(--av2-bg)]"
                  }`}
                >
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedCol(colIdx)}
                    className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg px-3 py-2 text-left focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none"
                  >
                    <span
                      className={`truncate text-sm font-semibold ${
                        active ? "text-[var(--av2-link)]" : ""
                      } ${col.title.trim() ? "" : "text-[var(--av2-text-2)] italic"}`}
                    >
                      {col.title.trim() || `Column ${colIdx + 1} (untitled)`}
                    </span>
                    <span className="shrink-0 text-xs text-[var(--av2-text-2)] tabular-nums">
                      {col.links.length} {col.links.length === 1 ? "link" : "links"}
                    </span>
                  </button>
                  <ReorderActions
                    noun={`column ${colIdx + 1}`}
                    index={colIdx}
                    count={columns.length}
                    onMove={(d) => handleMoveColumn(colIdx, d)}
                  />
                </li>
              );
            })}
          </ul>

          {selectedColumn && (
            <div className="min-w-0 rounded-xl border border-[var(--av2-border)] p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h4 className="truncate text-lg font-semibold">
                  {selectedColumn.title.trim() || `Column ${sel + 1}`}
                </h4>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => handleRemoveColumn(sel)}
                  disabled={columns.length <= MIN_COLUMNS}
                  aria-label={`Remove column ${sel + 1}`}
                >
                  <IconTrash width={16} height={16} />
                  Remove column
                </Button>
              </div>

              <Field
                label={
                  <>
                    Column title
                    <Req />
                  </>
                }
                htmlFor={`ftr-col-title-${sel}`}
              >
                <TextInput
                  id={`ftr-col-title-${sel}`}
                  value={selectedColumn.title}
                  onChange={(e) => updateColumnTitle(sel, e.target.value)}
                  placeholder="Platform"
                  maxLength={40}
                />
              </Field>

              <div className="mt-5 mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">
                  Links
                  <span className="ml-2 font-medium text-[var(--av2-text-2)] tabular-nums">
                    {selectedColumn.links.length} / {MAX_LINKS_PER_COL}
                  </span>
                </p>
                <AddButton
                  onClick={() => addLink(sel)}
                  disabled={selectedColumn.links.length >= MAX_LINKS_PER_COL}
                >
                  Add link
                </AddButton>
              </div>

              <LinkList>
                {selectedColumn.links.map((link, linkIdx) => (
                  <LinkRow
                    key={`${sel}-${linkIdx}`}
                    actions={
                      <ReorderActions
                        noun={`link ${linkIdx + 1}`}
                        index={linkIdx}
                        count={selectedColumn.links.length}
                        onMove={(d) => moveLink(sel, linkIdx, d)}
                        onRemove={() => removeLink(sel, linkIdx)}
                        removeDisabled={selectedColumn.links.length <= MIN_LINKS_PER_COL}
                      />
                    }
                  >
                    <TextInput
                      aria-label={`Link ${linkIdx + 1} label`}
                      value={link.label}
                      onChange={(e) => updateLink(sel, linkIdx, { label: e.target.value })}
                      placeholder="Label"
                      maxLength={40}
                    />
                    <TextInput
                      aria-label={`Link ${linkIdx + 1} destination`}
                      value={link.href}
                      onChange={(e) => updateLink(sel, linkIdx, { href: e.target.value })}
                      placeholder="/path"
                      maxLength={200}
                    />
                  </LinkRow>
                ))}
              </LinkList>
            </div>
          )}
        </div>
      </FormSection>

      {/* Legal-link strip ------------------------------------------- */}
      <FormSection
        title="Legal bar"
        count={`${legalLinks.length} / ${MAX_LEGAL_LINKS}`}
        description="The orange strip at the very bottom. Leave empty to hide it. Saved together with the footer."
        action={
          <AddButton onClick={addLegalLink} disabled={legalLinks.length >= MAX_LEGAL_LINKS}>
            Add legal link
          </AddButton>
        }
      >
        {legalLinks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--av2-border)] px-4 py-6 text-center text-sm text-[var(--av2-text-2)]">
            No legal links. The orange bottom strip will only show the copyright line.
          </div>
        ) : (
          <LinkList>
            {legalLinks.map((link, idx) => (
              <LinkRow
                key={idx}
                actions={
                  <ReorderActions
                    noun={`legal link ${idx + 1}`}
                    index={idx}
                    count={legalLinks.length}
                    onRemove={() => removeLegalLink(idx)}
                  />
                }
              >
                <TextInput
                  aria-label={`Legal link ${idx + 1} label`}
                  value={link.label}
                  onChange={(e) => updateLegalLink(idx, { label: e.target.value })}
                  placeholder="Privacy Policy"
                  maxLength={40}
                />
                <TextInput
                  aria-label={`Legal link ${idx + 1} destination`}
                  value={link.href}
                  onChange={(e) => updateLegalLink(idx, { href: e.target.value })}
                  placeholder="/privacy"
                  maxLength={200}
                />
              </LinkRow>
            ))}
          </LinkList>
        )}
      </FormSection>

      <BlockSaveFooter error={error} dirty={dirty} submitting={submitting} label="Save footer" />
    </form>
  );
}
