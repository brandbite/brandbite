// -----------------------------------------------------------------------------
// @file: app/admin/faq/page.tsx
// @purpose: Admin CRUD for the central Faq table. Two-column layout:
//           filterable list on the left, edit/create form on the right.
//           Mirrors the /admin/plans pattern so admins who already know
//           that page have zero learning curve here.
//
//           Rows are grouped by category in the list. Each row carries
//           up/down reorder buttons (within its category), an Active
//           toggle, and an inline Delete (with browser confirm).
// -----------------------------------------------------------------------------
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-04-28
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { OwnerOnlyBanner } from "@/components/admin/owner-only-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FormInput } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { LoadingState } from "@/components/ui/loading-state";
import { useToast } from "@/components/ui/toast-provider";

type Faq = {
  id: string;
  question: string;
  answer: string;
  category: string;
  position: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type FaqApiResponse = { faqs: Faq[]; categories: string[] };

const ALL_LABEL = "All";

export default function AdminFaqPage() {
  const { showToast } = useToast();

  const [data, setData] = useState<FaqApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filter pill state. Mirrors the public /faq filter, but here it's a
  // pure list filter — admin sees inactive items too.
  const [filterCategory, setFilterCategory] = useState<string>(ALL_LABEL);

  // Form state. `selectedId === null` means "creating new"; otherwise
  // the form is editing the row with that id.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [category, setCategory] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ---- Load ---------------------------------------------------------

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/admin/faq", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as
        | FaqApiResponse
        | { error?: string }
        | null;
      if (!res.ok) {
        if (res.status === 401) throw new Error("Sign in as admin to manage FAQs.");
        if (res.status === 403) throw new Error("You don't have permission to manage FAQs.");
        const errMsg = (json as { error?: string } | null)?.error;
        throw new Error(errMsg || `Request failed (${res.status}).`);
      }
      setData(json as FaqApiResponse);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load FAQs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // ---- Form helpers -------------------------------------------------

  const resetForm = () => {
    setSelectedId(null);
    setQuestion("");
    setAnswer("");
    // Default new rows into the currently-filtered category if one is
    // active; otherwise default to the first category we know about so
    // the dropdown isn't blank. Falls back to "General" for an empty DB.
    const seedCategory =
      filterCategory !== ALL_LABEL ? filterCategory : (data?.categories[0] ?? "General");
    setCategory(seedCategory);
    setIsActive(true);
    setSubmitError(null);
  };

  const fillFormFromRow = (row: Faq) => {
    setSelectedId(row.id);
    setQuestion(row.question);
    setAnswer(row.answer);
    setCategory(row.category);
    setIsActive(row.isActive);
    setSubmitError(null);
  };

  // Initial form seed once data first lands.
  useEffect(() => {
    if (data && !selectedId && question === "") {
      // Triggered once on first load — fills the dropdown so an admin can
      // hit "Save" without first clicking "New".
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // ---- Save ---------------------------------------------------------

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitError(null);

    if (!question.trim()) return setSubmitError("Question is required.");
    if (!answer.trim()) return setSubmitError("Answer is required.");
    if (!category.trim()) return setSubmitError("Category is required.");

    setSubmitting(true);
    try {
      const isEdit = selectedId !== null;
      const url = isEdit ? `/api/admin/faq/${selectedId}` : "/api/admin/faq";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          answer: answer.trim(),
          category: category.trim(),
          isActive,
        }),
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
        title: isEdit ? "FAQ updated" : "FAQ created",
      });

      await load();
      if (!isEdit) resetForm();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Inline row actions -------------------------------------------

  const toggleActive = async (row: Faq) => {
    try {
      const res = await fetch(`/api/admin/faq/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      if (!res.ok) throw new Error("Toggle failed.");
      await load();
    } catch (err) {
      showToast({
        type: "error",
        title: err instanceof Error ? err.message : "Toggle failed.",
      });
    }
  };

  const moveRow = async (row: Faq, direction: -1 | 1) => {
    if (!data) return;
    // Find the neighbour in the same category so we can swap positions.
    const sameCategory = data.faqs
      .filter((f) => f.category === row.category)
      .sort((a, b) => a.position - b.position);
    const idx = sameCategory.findIndex((f) => f.id === row.id);
    const neighbour = sameCategory[idx + direction];
    if (!neighbour) return;

    try {
      // Swap positions in two PATCHes. We do them sequentially so a
      // mid-flight failure leaves at most one row mid-swap (which is
      // recoverable on next save) rather than both partial.
      const r1 = await fetch(`/api/admin/faq/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position: neighbour.position }),
      });
      if (!r1.ok) throw new Error("Reorder failed.");
      const r2 = await fetch(`/api/admin/faq/${neighbour.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position: row.position }),
      });
      if (!r2.ok) throw new Error("Reorder failed.");
      await load();
    } catch (err) {
      showToast({
        type: "error",
        title: err instanceof Error ? err.message : "Reorder failed.",
      });
    }
  };

  const deleteRow = async (row: Faq) => {
    if (!confirm(`Delete this FAQ permanently?\n\n"${row.question}"`)) return;
    try {
      const res = await fetch(`/api/admin/faq/${row.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed.");
      showToast({ type: "success", title: "FAQ deleted" });
      if (selectedId === row.id) resetForm();
      await load();
    } catch (err) {
      showToast({
        type: "error",
        title: err instanceof Error ? err.message : "Delete failed.",
      });
    }
  };

  // ---- Derived ------------------------------------------------------

  const allCategories = useMemo<string[]>(() => {
    return [ALL_LABEL, ...(data?.categories ?? [])];
  }, [data?.categories]);

  const visibleFaqs = useMemo<Faq[]>(() => {
    if (!data) return [];
    if (filterCategory === ALL_LABEL) return data.faqs;
    return data.faqs.filter((f) => f.category === filterCategory);
  }, [data, filterCategory]);

  const counts = useMemo(() => {
    const total = data?.faqs.length ?? 0;
    const active = data?.faqs.filter((f) => f.isActive).length ?? 0;
    const inactive = total - active;
    return { total, active, inactive };
  }, [data]);

  // ---- Render -------------------------------------------------------

  return (
    <>
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">FAQ</h1>
          <p className="mt-1 text-sm text-[var(--bb-text-secondary)]">
            Central question/answer store. Powers <code>/faq</code>, the dashboard FAQ pages, and
            the landing-page FAQ block.
          </p>
        </div>
        <Button onClick={resetForm}>New FAQ</Button>
      </div>

      <OwnerOnlyBanner action="manage FAQs" />

      {loadError && (
        <InlineAlert variant="error" title="Error" className="mb-4">
          {loadError}
        </InlineAlert>
      )}

      {/* Summary cards */}
      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <SummaryCard
          label="Total"
          value={loading ? "—" : counts.total}
          hint="All FAQs in the store."
        />
        <SummaryCard
          label="Active"
          value={loading ? "—" : counts.active}
          hint="Visible to visitors."
        />
        <SummaryCard
          label="Hidden"
          value={loading ? "—" : counts.inactive}
          hint="Inactive — kept for restore but hidden from public."
        />
      </section>

      {/* List + Form */}
      <section className="grid gap-4 xl:grid-cols-[3fr_2fr]">
        {/* List */}
        <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-4 py-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold tracking-tight">FAQ list</h2>
            <p className="text-xs text-[var(--bb-text-tertiary)]">Click a row to edit.</p>
          </div>

          {/* Category filter pills */}
          <div className="mb-3 flex flex-wrap gap-2">
            {allCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setFilterCategory(cat)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  filterCategory === cat
                    ? "bg-[var(--bb-primary)] text-white"
                    : "bg-[var(--bb-bg-warm)] text-[var(--bb-text-secondary)] hover:bg-[#eae6f1]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {loading ? (
            <LoadingState message="Loading FAQs…" />
          ) : visibleFaqs.length === 0 ? (
            <EmptyState title="No FAQs in this category." />
          ) : (
            <ul className="space-y-2">
              {visibleFaqs.map((row) => {
                const sameCategoryCount =
                  data?.faqs.filter((f) => f.category === row.category).length ?? 0;
                const sameCategorySorted = (data?.faqs ?? [])
                  .filter((f) => f.category === row.category)
                  .sort((a, b) => a.position - b.position);
                const idxInCategory = sameCategorySorted.findIndex((f) => f.id === row.id);
                const isFirst = idxInCategory === 0;
                const isLast = idxInCategory === sameCategoryCount - 1;
                const isSelected = selectedId === row.id;

                return (
                  <li
                    key={row.id}
                    className={`rounded-xl border px-3 py-2.5 transition-colors ${
                      isSelected
                        ? "border-[var(--bb-primary)] bg-[var(--bb-primary-light)]"
                        : "border-[var(--bb-border-subtle)] bg-[var(--bb-bg-page)] hover:bg-[var(--bb-bg-warm)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => fillFormFromRow(row)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="neutral">{row.category}</Badge>
                          {!row.isActive && <Badge variant="warning">Hidden</Badge>}
                        </div>
                        <p className="mt-1.5 text-sm font-semibold text-[var(--bb-secondary)]">
                          {row.question}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs text-[var(--bb-text-secondary)]">
                          {row.answer}
                        </p>
                      </button>

                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => moveRow(row, -1)}
                            disabled={isFirst}
                            aria-label="Move up"
                          >
                            ↑
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => moveRow(row, 1)}
                            disabled={isLast}
                            aria-label="Move down"
                          >
                            ↓
                          </Button>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleActive(row)}
                          >
                            {row.isActive ? "Hide" : "Show"}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteRow(row)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Form */}
        <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-4 shadow-sm">
          <h2 className="text-sm font-semibold tracking-tight">
            {selectedId ? "Edit FAQ" : "Create FAQ"}
          </h2>
          <p className="mt-1 text-xs text-[var(--bb-text-secondary)]">
            Active FAQs render on every public surface. Hidden FAQs stay in the store but don&apos;t
            show up on the public site.
          </p>

          {submitError && (
            <InlineAlert variant="error" size="sm" className="mt-3">
              {submitError}
            </InlineAlert>
          )}

          <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-1">
              <label
                htmlFor="faq-category"
                className="text-xs font-medium text-[var(--bb-secondary)]"
              >
                Category <span className="text-[var(--bb-primary)]">*</span>
              </label>
              <input
                id="faq-category"
                list="faq-category-options"
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. General, Pricing & Billing"
                maxLength={80}
                required
                className="w-full rounded-md border border-[var(--bb-border-input)] bg-[var(--bb-bg-page)] px-3 py-2 text-sm text-[var(--bb-secondary)] outline-none focus:border-[var(--bb-primary)] focus:ring-1 focus:ring-[var(--bb-primary)]"
              />
              <datalist id="faq-category-options">
                {data?.categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              <p className="text-xs text-[var(--bb-text-muted)]">
                Pick an existing bucket or type a new one.
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="faq-question"
                className="text-xs font-medium text-[var(--bb-secondary)]"
              >
                Question <span className="text-[var(--bb-primary)]">*</span>
              </label>
              <FormInput
                id="faq-question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="How fast will I get my creatives?"
                maxLength={300}
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="faq-answer"
                className="text-xs font-medium text-[var(--bb-secondary)]"
              >
                Answer <span className="text-[var(--bb-primary)]">*</span>
              </label>
              <textarea
                id="faq-answer"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Most requests are completed within 1 to 2 days…"
                rows={6}
                maxLength={5000}
                required
                className="w-full rounded-md border border-[var(--bb-border-input)] bg-[var(--bb-bg-page)] px-3 py-2 text-sm text-[var(--bb-secondary)] outline-none focus:border-[var(--bb-primary)] focus:ring-1 focus:ring-[var(--bb-primary)]"
              />
              <p className="text-xs text-[var(--bb-text-muted)]">
                Line breaks are preserved on the public page.
              </p>
            </div>

            <label className="flex items-center gap-2 text-xs font-medium text-[var(--bb-secondary)]">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-3 w-3 rounded border-[var(--bb-border-input)] text-[var(--bb-primary)] focus:ring-[var(--bb-primary)]"
              />
              Active (visible on public surfaces)
            </label>

            <div className="flex items-center justify-between pt-2">
              {selectedId ? (
                <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
                  Cancel edit
                </Button>
              ) : (
                <span />
              )}
              <Button
                type="submit"
                loading={submitting}
                loadingText="Saving…"
                disabled={submitting}
              >
                {selectedId ? "Save changes" : "Create FAQ"}
              </Button>
            </div>
          </form>
        </div>
      </section>
    </>
  );
}

// -----------------------------------------------------------------------------
// Inline summary card. Same shape as the cards on /admin/plans for a
// consistent admin look without pulling in a shared SummaryCard component
// (would be over-abstraction for two pages).
// -----------------------------------------------------------------------------

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-4 shadow-sm">
      <p className="text-xs font-medium tracking-[0.12em] text-[var(--bb-text-tertiary)] uppercase">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold text-[var(--bb-secondary)]">{value}</p>
      <p className="mt-1 text-xs text-[var(--bb-text-tertiary)]">{hint}</p>
    </div>
  );
}
