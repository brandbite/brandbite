// -----------------------------------------------------------------------------
// @file: app/admin/faq/page.tsx
// @purpose: Admin CRUD for the central Faq table (admin design language v1).
//           Short, paginated question list on the left (question + category
//           and visibility badges); the selected record opens in the editor
//           panel on the right with the answer, visibility, a read-only
//           visitor preview, ordering within its category and delete.
// -----------------------------------------------------------------------------
// @version: v2.0.0
// @status: active
// @lastUpdate: 2026-11-01
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { OwnerOnlyBanner } from "@/components/admin/owner-only-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast-provider";
import {
  Badge,
  Button,
  Callout,
  Card,
  DASH,
  DetailPanel,
  EmptyState,
  Field,
  FilterBar,
  PageHeader,
  Pager,
  PanelSection,
  SaveBar,
  SearchInput,
  Select,
  Skeleton,
  SplitView,
  StatusDot,
  Switch,
  Table,
  TableFooter,
  Td,
  TextArea,
  TextInput,
  Th,
  Tr,
  fmt,
  plural,
} from "@/components/admin/v2/ui";
import { IconChevronDown } from "@/components/admin/v2/icons";
import { IconFaq } from "@/components/navigation/nav-icons";
import { useUnsavedChanges } from "@/components/admin/v2/unsaved-changes";

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

type StatusFilter = "ALL" | "ACTIVE" | "HIDDEN";

const ALL = "__all__";
const PAGE_SIZE = 10;

type FormSnapshot = {
  question: string;
  answer: string;
  category: string;
  isActive: boolean;
};

type FieldErrors = Partial<Record<"question" | "answer" | "category", string>>;

export default function AdminFaqPage() {
  const { showToast } = useToast();

  const [data, setData] = useState<FaqApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // List filters — admin sees inactive items too.
  const [filterCategory, setFilterCategory] = useState<string>(ALL);
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Form state. `selectedId === null` means "creating new"; otherwise
  // the form is editing the row with that id.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [category, setCategory] = useState("");
  const [isActive, setIsActive] = useState(true);
  // Baseline for the "new FAQ" form (seeded category), used for dirty state.
  const [newBaseline, setNewBaseline] = useState<FormSnapshot>({
    question: "",
    answer: "",
    category: "",
    isActive: true,
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [reordering, setReordering] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<Faq | null>(null);
  const [deleting, setDeleting] = useState(false);

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
      return json as FaqApiResponse;
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load FAQs.");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // ---- Form helpers -------------------------------------------------

  const applySnapshot = (s: FormSnapshot) => {
    setQuestion(s.question);
    setAnswer(s.answer);
    setCategory(s.category);
    setIsActive(s.isActive);
  };

  const resetForm = () => {
    setSelectedId(null);
    // Default new rows into the currently-filtered category if one is
    // active; otherwise default to the first category we know about so
    // the field isn't blank. Falls back to "General" for an empty DB.
    const seedCategory =
      filterCategory !== ALL ? filterCategory : (data?.categories[0] ?? "General");
    const seed = { question: "", answer: "", category: seedCategory, isActive: true };
    setNewBaseline(seed);
    applySnapshot(seed);
    setSubmitError(null);
    setFieldErrors({});
  };

  const fillFormFromRow = (row: Faq) => {
    setSelectedId(row.id);
    applySnapshot({
      question: row.question,
      answer: row.answer,
      category: row.category,
      isActive: row.isActive,
    });
    setSubmitError(null);
    setFieldErrors({});
  };

  // Initial form seed once data first lands.
  useEffect(() => {
    if (data && !selectedId && question === "") {
      // Triggered once on first load — fills the category so an admin can
      // hit "Create" without first clicking "New".
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const selectedRow = useMemo(
    () => (selectedId ? (data?.faqs.find((f) => f.id === selectedId) ?? null) : null),
    [data, selectedId],
  );

  const baseline: FormSnapshot = selectedRow
    ? {
        question: selectedRow.question,
        answer: selectedRow.answer,
        category: selectedRow.category,
        isActive: selectedRow.isActive,
      }
    : newBaseline;

  const dirty =
    question !== baseline.question ||
    answer !== baseline.answer ||
    category !== baseline.category ||
    isActive !== baseline.isActive;
  const confirmDiscard = useUnsavedChanges(dirty, "FAQ editor");

  /** Run `fn` now, or after the user agrees to drop unsaved edits. */
  const guarded = async (fn: () => void) => {
    if (await confirmDiscard()) fn();
  };

  // ---- Save ---------------------------------------------------------

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitError(null);

    const errs: FieldErrors = {};
    if (!category.trim()) errs.category = "Category is required.";
    if (!question.trim()) errs.question = "Question is required.";
    if (!answer.trim()) errs.answer = "Answer is required.";
    setFieldErrors(errs);
    const firstInvalid = (["category", "question", "answer"] as const).find((k) => errs[k]);
    if (firstInvalid) {
      document.getElementById(`faq-${firstInvalid}`)?.focus();
      return;
    }

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

      const fresh = await load();
      if (!isEdit) {
        resetForm();
      } else {
        // Re-sync with the saved (trimmed) row so the editor reads clean.
        const saved = fresh?.faqs.find((f) => f.id === selectedId);
        if (saved) fillFormFromRow(saved);
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Row actions --------------------------------------------------

  const moveRow = async (row: Faq, direction: -1 | 1) => {
    if (!data) return;
    // Find the neighbour in the same category so we can swap positions.
    const sameCategory = data.faqs
      .filter((f) => f.category === row.category)
      .sort((a, b) => a.position - b.position);
    const idx = sameCategory.findIndex((f) => f.id === row.id);
    const neighbour = sameCategory[idx + direction];
    if (!neighbour) return;

    setReordering(true);
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
    } finally {
      setReordering(false);
    }
  };

  const confirmDelete = async () => {
    const row = pendingDelete;
    if (!row) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/faq/${row.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed.");
      showToast({ type: "success", title: "FAQ deleted" });
      if (selectedId === row.id) resetForm();
      setPendingDelete(null);
      await load();
    } catch (err) {
      showToast({
        type: "error",
        title: err instanceof Error ? err.message : "Delete failed.",
      });
    } finally {
      setDeleting(false);
    }
  };

  // ---- Derived ------------------------------------------------------

  const faqs = useMemo(() => data?.faqs ?? [], [data]);

  const filteredFaqs = useMemo<Faq[]>(() => {
    const q = search.trim().toLowerCase();
    return faqs.filter((f) => {
      if (filterCategory !== ALL && f.category !== filterCategory) return false;
      if (filterStatus === "ACTIVE" && !f.isActive) return false;
      if (filterStatus === "HIDDEN" && f.isActive) return false;
      if (q && !f.question.toLowerCase().includes(q) && !f.answer.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [faqs, filterCategory, filterStatus, search]);

  useEffect(() => {
    setPage(1);
  }, [filterCategory, filterStatus, search]);

  const pageCount = Math.max(1, Math.ceil(filteredFaqs.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageRows = filteredFaqs.slice(pageStart, pageStart + PAGE_SIZE);

  const filtersActive = filterCategory !== ALL || filterStatus !== "ALL" || !!search.trim();
  const resetFilters = () => {
    setFilterCategory(ALL);
    setFilterStatus("ALL");
    setSearch("");
  };

  const counts = useMemo(() => {
    const total = faqs.length;
    const active = faqs.filter((f) => f.isActive).length;
    return { total, active, inactive: total - active };
  }, [faqs]);

  // Position of the selected FAQ within its (saved) category.
  const orderInfo = useMemo(() => {
    if (!selectedRow) return null;
    const same = faqs
      .filter((f) => f.category === selectedRow.category)
      .sort((a, b) => a.position - b.position);
    const idx = same.findIndex((f) => f.id === selectedRow.id);
    return { index: idx, total: same.length };
  }, [faqs, selectedRow]);

  // ---- Editor panel -------------------------------------------------

  const previewQuestion = question.trim();
  const previewAnswer = answer.trim();

  const panel = (
    <form onSubmit={handleSubmit} noValidate className="contents">
      <DetailPanel
        title={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {selectedRow ? "Edit FAQ" : "New FAQ"}
            {selectedRow && (
              <Badge tone={selectedRow.isActive ? "green" : "neutral"}>
                {selectedRow.isActive ? "Active" : "Hidden"}
              </Badge>
            )}
          </span>
        }
        onClose={selectedRow ? () => void guarded(resetForm) : undefined}
        closeLabel="Clear selection"
        footer={
          <SaveBar
            dirty={dirty}
            status={submitting ? "Saving…" : dirty ? "Unsaved changes" : "No unsaved changes"}
          >
            {dirty && (
              <Button
                variant="ghost"
                disabled={submitting}
                onClick={() => {
                  applySnapshot(baseline);
                  setFieldErrors({});
                  setSubmitError(null);
                }}
              >
                Discard
              </Button>
            )}
            <Button
              type="submit"
              variant="primary"
              disabled={!dirty || submitting}
              aria-busy={submitting}
            >
              {submitting ? "Saving…" : selectedRow ? "Save FAQ" : "Create FAQ"}
            </Button>
          </SaveBar>
        }
      >
        <p className="-mt-1 mb-5 text-sm text-[var(--av2-text-2)]">
          Active FAQs render on every public surface. Hidden FAQs stay in the store but don&apos;t
          show up on the public site.
        </p>

        {submitError && (
          <div className="mb-5">
            <Callout tone="error" title="Couldn’t save the FAQ">
              {submitError}
            </Callout>
          </div>
        )}

        <PanelSection>
          <div className="space-y-4">
            <Field
              label="Category"
              htmlFor="faq-category"
              hint="Pick an existing category or type a new one."
              error={fieldErrors.category}
            >
              <TextInput
                id="faq-category"
                list="faq-category-options"
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. General, Pricing & Billing"
                maxLength={80}
                required
                aria-invalid={fieldErrors.category ? true : undefined}
              />
              <datalist id="faq-category-options">
                {data?.categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>

            <Field label="Question" htmlFor="faq-question" error={fieldErrors.question}>
              <TextInput
                id="faq-question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="How fast will I get my creatives?"
                maxLength={300}
                required
                aria-invalid={fieldErrors.question ? true : undefined}
              />
            </Field>

            <Field
              label="Answer"
              htmlFor="faq-answer"
              hint="Line breaks are preserved on the public page."
              error={fieldErrors.answer}
            >
              <TextArea
                id="faq-answer"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Most requests are completed within 1 to 2 days…"
                rows={5}
                maxLength={5000}
                required
                aria-invalid={fieldErrors.answer ? true : undefined}
              />
            </Field>

            <div className="flex items-start justify-between gap-4">
              <div>
                <p id="faq-visible-label" className="text-sm font-medium">
                  Visible to visitors
                </p>
                <p id="faq-visible-hint" className="mt-0.5 text-xs text-[var(--av2-text-2)]">
                  Hidden questions stay saved and can be restored.
                </p>
              </div>
              <Switch
                checked={isActive}
                onChange={setIsActive}
                labelledBy="faq-visible-label"
                describedBy="faq-visible-hint"
              />
            </div>
          </div>
        </PanelSection>

        <PanelSection>
          <details open className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded text-base font-semibold focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none [&::-webkit-details-marker]:hidden">
              Visitor preview
              <IconChevronDown className="text-[var(--av2-text-2)] transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-3 rounded-xl border border-[var(--av2-border)] bg-[var(--av2-bg)] p-4">
              {!isActive && (
                <div className="mb-2">
                  <Badge tone="neutral">Hidden — not shown to visitors</Badge>
                </div>
              )}
              <p className="text-base font-semibold break-words">
                {previewQuestion || (
                  <span className="text-[var(--av2-text-2)]">Your question appears here</span>
                )}
              </p>
              <p className="mt-1 text-sm break-words whitespace-pre-line text-[var(--av2-text-2)]">
                {previewAnswer || "The answer appears here."}
              </p>
            </div>
          </details>
        </PanelSection>

        {selectedRow && orderInfo && (
          <PanelSection title="Order in category">
            <p className="text-sm text-[var(--av2-text-2)]">
              Position{" "}
              <span className="font-semibold text-[var(--av2-text)] tabular-nums">
                {orderInfo.index >= 0 ? fmt(orderInfo.index + 1) : DASH}
              </span>{" "}
              of {fmt(orderInfo.total)} in “{selectedRow.category}”.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => void moveRow(selectedRow, -1)}
                disabled={reordering || orderInfo.index <= 0}
              >
                <span aria-hidden>↑</span> Move up
              </Button>
              <Button
                size="sm"
                onClick={() => void moveRow(selectedRow, 1)}
                disabled={reordering || orderInfo.index >= orderInfo.total - 1}
              >
                <span aria-hidden>↓</span> Move down
              </Button>
            </div>
          </PanelSection>
        )}

        {selectedRow && (
          <PanelSection title="Danger zone">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="min-w-0 flex-1 text-sm text-[var(--av2-text-2)]">
                Deleting removes this FAQ permanently. To keep it, hide it instead.
              </p>
              <Button variant="danger" size="sm" onClick={() => setPendingDelete(selectedRow)}>
                Delete FAQ
              </Button>
            </div>
          </PanelSection>
        )}
      </DetailPanel>
    </form>
  );

  // ---- Render -------------------------------------------------------

  const stat = (label: string, value: number) => (
    <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--av2-border)] bg-[var(--av2-surface)] px-3 text-sm">
      <span className="font-semibold text-[var(--av2-text)] tabular-nums">
        {data ? fmt(value) : DASH}
      </span>
      {label}
    </span>
  );

  return (
    <div>
      <PageHeader
        title="FAQ"
        description={
          <>
            Central question and answer store. Powers <code>/faq</code>, the dashboard FAQ pages and
            the landing-page FAQ block.
          </>
        }
        meta={
          <div className="flex flex-wrap gap-2">
            {stat("total", counts.total)}
            {stat("active", counts.active)}
            {stat("hidden", counts.inactive)}
          </div>
        }
        actions={
          <Button variant="primary" onClick={() => void guarded(resetForm)}>
            <span aria-hidden className="text-lg leading-none">
              +
            </span>
            New FAQ
          </Button>
        }
      />

      <OwnerOnlyBanner action="manage FAQs" />

      {loadError && (
        <div className="mb-6">
          <Callout
            tone="error"
            title="Couldn’t load FAQs"
            action={
              <Button size="sm" onClick={() => void load()}>
                Try again
              </Button>
            }
          >
            {loadError}
          </Callout>
        </div>
      )}

      <SplitView panel={panel}>
        <Card padding="none">
          <div className="px-6 pt-5">
            <h2 className="mb-4 text-xl leading-7 font-semibold">All questions</h2>
            <FilterBar>
              <SearchInput
                className="w-full min-w-[200px] flex-1"
                value={search}
                onChange={setSearch}
                placeholder="Search questions…"
                label="Search questions and answers"
              />
              <div className="w-full sm:w-52">
                <Select
                  aria-label="Filter by category"
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                >
                  <option value={ALL}>All categories</option>
                  {data?.categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="w-full sm:w-40">
                <Select
                  aria-label="Filter by visibility"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as StatusFilter)}
                >
                  <option value="ALL">All statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="HIDDEN">Hidden</option>
                </Select>
              </div>
            </FilterBar>
          </div>

          {loading && !data ? (
            <div className="space-y-3 border-t border-[var(--av2-border)] px-6 py-5" role="status">
              <span className="sr-only">Loading FAQs…</span>
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !data ? null : faqs.length === 0 ? (
            <div className="border-t border-[var(--av2-border)]">
              <EmptyState
                icon={<IconFaq width={28} height={28} />}
                title="No FAQs yet"
                description="Write the first question with the editor on the right."
              />
            </div>
          ) : filteredFaqs.length === 0 ? (
            <div className="border-t border-[var(--av2-border)]">
              <EmptyState
                title={
                  search.trim()
                    ? "No questions match your search"
                    : "No questions match these filters"
                }
                description="Try a different search, category or status."
                action={<Button onClick={resetFilters}>Clear filters</Button>}
              />
            </div>
          ) : (
            <Table label="FAQs">
              <thead>
                <tr>
                  <Th>Question</Th>
                  <Th className="w-28">Visibility</Th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => (
                  <Tr
                    key={row.id}
                    selected={selectedId === row.id}
                    onSelect={() => {
                      if (row.id === selectedId) return;
                      void guarded(() => fillFormFromRow(row));
                    }}
                    label={`${row.question}, ${row.category}, ${row.isActive ? "active" : "hidden"}`}
                  >
                    <Td>
                      <div className="font-semibold break-words">{row.question}</div>
                      <div className="mt-1.5">
                        <Badge tone="neutral">{row.category}</Badge>
                      </div>
                    </Td>
                    <Td className="whitespace-nowrap">
                      <StatusDot
                        tone={row.isActive ? "green" : "neutral"}
                        label={row.isActive ? "Active" : "Hidden"}
                      />
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}

          {data && filteredFaqs.length > 0 && (
            <TableFooter>
              <span className="tabular-nums">
                Showing {fmt(pageStart + 1)}–{fmt(pageStart + pageRows.length)} of{" "}
                {fmt(filteredFaqs.length)} {plural(filteredFaqs.length, "question", "questions")}
                {filtersActive && ` (filtered from ${fmt(faqs.length)})`}
              </span>
              <div className="flex flex-wrap items-center gap-3">
                {filtersActive && (
                  <Button size="sm" variant="ghost" onClick={resetFilters}>
                    Clear filters
                  </Button>
                )}
                <Pager page={currentPage} pageCount={pageCount} onPage={setPage} />
              </div>
            </TableFooter>
          )}
        </Card>

        {data && faqs.length > 0 && (
          <p className="mt-4 text-sm text-[var(--av2-text-2)]">
            Select a question to edit it. Order is managed within each category from the editor.
          </p>
        )}
      </SplitView>

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
        loading={deleting}
        title="Delete this FAQ permanently?"
        description={pendingDelete ? `“${pendingDelete.question}”` : undefined}
        confirmLabel="Delete"
      />
    </div>
  );
}
