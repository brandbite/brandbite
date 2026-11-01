// -----------------------------------------------------------------------------
// @file: components/blocks/admin/FaqBlockForm.tsx
// @purpose: Picker for the landing-page FAQ section. Fetches the central
//           FAQ list (/api/admin/faq for site-owner; falls back to /api/faq)
//           and lets the admin tick which FAQs to display + reorder them.
//
//           This replaces the inline "add question / remove question"
//           editor from PR #190 — questions themselves now live in the
//           central /admin/faq page; this form only chooses which ones to
//           surface on the landing page.
// -----------------------------------------------------------------------------
// @version: v2.0.0
// @status: active
// @lastUpdate: 2026-04-30
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  Badge,
  Button,
  Callout,
  Field,
  FilterChips,
  SearchInput,
  Skeleton,
  TextInput,
} from "@/components/admin/v2/ui";
import { useToast } from "@/components/ui/toast-provider";

import {
  BlockSaveFooter,
  Code,
  FormSection,
  ReorderActions,
  useDirtyBaseline,
} from "./block-form-ui";

import { DEFAULT_FAQ_FALLBACK_LIMIT } from "@/lib/blocks/defaults";
import type { FaqData } from "@/lib/blocks/types";

type FaqBlockFormProps = {
  /** Initial values — DB row's data when present, defaults otherwise. */
  initial: FaqData;
  /** Page key the block belongs to (e.g. "home"). */
  pageKey: string;
};

type CentralFaq = {
  id: string;
  question: string;
  answer: string;
  category: string;
  isActive?: boolean;
};

type AdminFaqApiResponse = { faqs: CentralFaq[]; categories: string[] };

const ALL_LABEL = "All";
const MAX_PICKED = 40;

export function FaqBlockForm({ initial, pageKey }: FaqBlockFormProps) {
  const { showToast } = useToast();

  const [title, setTitle] = useState<string>(initial.title ?? "");
  const [subtitle, setSubtitle] = useState<string>(initial.subtitle ?? "");
  const [pickedIds, setPickedIds] = useState<string[]>([...initial.selectedFaqIds]);
  const [ctaLabel, setCtaLabel] = useState<string>(initial.ctaLabel ?? "");
  const [ctaHref, setCtaHref] = useState<string>(initial.ctaHref ?? "");

  const [allFaqs, setAllFaqs] = useState<CentralFaq[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>(ALL_LABEL);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Presentation only: drives the SaveBar status + disables Save when clean.
  const { dirty, markSaved } = useDirtyBaseline(
    JSON.stringify([title, subtitle, pickedIds, ctaLabel, ctaHref]),
  );

  // Fetch the central FAQ list from the admin endpoint so the picker
  // can show inactive items (with a "Hidden" hint) — the public list
  // would silently drop those, which is confusing for the picker.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/faq", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          // Site-admin gate may reject site-owner-only contexts. Fall
          // back to the public endpoint so the picker still works,
          // just without inactive rows surfacing.
          if (res.status === 403 || res.status === 401) {
            const fallback = await fetch("/api/faq");
            if (!fallback.ok) throw new Error(`/api/faq returned ${fallback.status}`);
            return fallback.json();
          }
          throw new Error(`/api/admin/faq returned ${res.status}`);
        }
        return res.json();
      })
      .then((json: AdminFaqApiResponse) => {
        if (cancelled) return;
        setAllFaqs(Array.isArray(json.faqs) ? json.faqs : []);
      })
      .catch((err) => {
        console.error("[FaqBlockForm] failed to load FAQs", err);
        if (cancelled) return;
        setLoadError("Couldn't load FAQs. Try refreshing.");
        setAllFaqs([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Distinct category list. Plus the "All" filter pill in front.
  const categories = useMemo<string[]>(() => {
    if (!allFaqs) return [ALL_LABEL];
    const seen = new Set<string>();
    for (const f of allFaqs) seen.add(f.category);
    return [ALL_LABEL, ...Array.from(seen)];
  }, [allFaqs]);

  // Apply search + category filter to the available pool.
  const filteredFaqs = useMemo<CentralFaq[]>(() => {
    if (!allFaqs) return [];
    const q = searchQuery.trim().toLowerCase();
    return allFaqs.filter((f) => {
      if (filterCategory !== ALL_LABEL && f.category !== filterCategory) return false;
      if (q && !f.question.toLowerCase().includes(q) && !f.answer.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [allFaqs, filterCategory, searchQuery]);

  // Map for fast picked-row resolution.
  const faqsById = useMemo(() => {
    const m = new Map<string, CentralFaq>();
    for (const f of allFaqs ?? []) m.set(f.id, f);
    return m;
  }, [allFaqs]);

  const isPicked = (id: string) => pickedIds.includes(id);

  const togglePicked = (id: string) => {
    setPickedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_PICKED) return prev;
      return [...prev, id];
    });
  };

  const movePicked = (idx: number, direction: -1 | 1) => {
    const target = idx + direction;
    if (target < 0 || target >= pickedIds.length) return;
    setPickedIds((prev) => {
      const next = prev.slice();
      const [moved] = next.splice(idx, 1);
      next.splice(target, 0, moved);
      return next;
    });
  };

  const removePicked = (id: string) => {
    setPickedIds((prev) => prev.filter((x) => x !== id));
  };

  const clearAllPicked = () => setPickedIds([]);

  // ---- Save ---------------------------------------------------------

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    // CTA fields are paired — schema enforces this server-side too,
    // but failing fast in the form gives a clearer message than the
    // generic Zod error.
    const trimmedLabel = ctaLabel.trim();
    const trimmedHref = ctaHref.trim();
    if (Boolean(trimmedLabel) !== Boolean(trimmedHref)) {
      setError(
        trimmedLabel
          ? "Add a destination for the CTA, or clear the label to hide it."
          : "Add a label for the CTA, or clear the destination to hide it.",
      );
      return;
    }

    setSubmitting(true);
    try {
      const data: FaqData = {
        ...(title.trim() ? { title: title.trim() } : {}),
        ...(subtitle.trim() ? { subtitle: subtitle.trim() } : {}),
        selectedFaqIds: pickedIds,
        ...(trimmedLabel ? { ctaLabel: trimmedLabel } : {}),
        ...(trimmedHref ? { ctaHref: trimmedHref } : {}),
      };

      const res = await fetch(`/api/admin/page-blocks/${pageKey}/FAQ`, {
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
        title: "FAQ section saved",
        description:
          pickedIds.length === 0
            ? `No FAQs selected — landing page falls back to the first ${DEFAULT_FAQ_FALLBACK_LIMIT}.`
            : "Reload the landing page to see your changes.",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Title + subtitle (both optional) ----------------------------- */}
      <FormSection title="Section heading" description="Both optional.">
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field
              label="Section title (optional)"
              htmlFor="faq-block-title"
              hint={
                <>
                  Defaults to <Code>FAQ</Code> when blank.
                </>
              }
            >
              <TextInput
                id="faq-block-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="FAQ"
                maxLength={120}
              />
            </Field>
            <Field label="Subtitle (optional)" htmlFor="faq-block-subtitle">
              <TextInput
                id="faq-block-subtitle"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Frequently asked questions."
                maxLength={300}
              />
            </Field>
          </div>

          {/* "See all" CTA pair (optional, paired) ------------------------ */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field
              label="CTA label (optional)"
              htmlFor="faq-block-cta-label"
              hint="Shown below the accordion. Clear both label and destination to hide the button."
            >
              <TextInput
                id="faq-block-cta-label"
                value={ctaLabel}
                onChange={(e) => setCtaLabel(e.target.value)}
                placeholder="See all questions"
                maxLength={50}
              />
            </Field>
            <Field
              label="CTA destination (optional)"
              htmlFor="faq-block-cta-href"
              hint={
                <>
                  Internal path like <Code>/faq</Code> or full URL.
                </>
              }
            >
              <TextInput
                id="faq-block-cta-href"
                value={ctaHref}
                onChange={(e) => setCtaHref(e.target.value)}
                placeholder="/faq"
                maxLength={200}
              />
            </Field>
          </div>
        </div>
      </FormSection>

      <FormSection
        title="Questions"
        count={`${pickedIds.length} / ${MAX_PICKED}`}
        description={
          <>
            Question text and answers are managed in{" "}
            <Link
              href="/admin/faq"
              className="font-semibold text-[var(--av2-link)] underline-offset-2 hover:underline"
            >
              Content → FAQ
            </Link>
            . This form only chooses which questions to surface on the landing page.
          </>
        }
      >
        <div className="space-y-5">
          {loadError && <Callout tone="error" title={loadError} />}

          {/* Selection summary -------------------------------------------- */}
          <div className="rounded-xl border border-[var(--av2-border)] bg-[var(--av2-bg)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">
                  {pickedIds.length === 0
                    ? "Nothing picked yet"
                    : `${pickedIds.length} ${pickedIds.length === 1 ? "FAQ" : "FAQs"} selected`}
                </p>
                <p className="mt-0.5 text-sm text-[var(--av2-text-2)]">
                  {pickedIds.length === 0
                    ? `Empty selection falls back to the first ${DEFAULT_FAQ_FALLBACK_LIMIT} active FAQs in category order.`
                    : "Reorder with the arrows on each row."}
                </p>
              </div>
              {pickedIds.length > 0 && (
                <Button size="sm" variant="ghost" onClick={clearAllPicked}>
                  Clear selection
                </Button>
              )}
            </div>

            {pickedIds.length > 0 && (
              <ol className="mt-3 space-y-1.5">
                {pickedIds.map((id, idx) => {
                  const faq = faqsById.get(id);
                  if (!faq) {
                    return (
                      <li
                        key={id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-[var(--av2-border)] bg-[var(--av2-surface)] py-1 pr-1 pl-3 text-sm text-[var(--av2-text-2)]"
                      >
                        <span className="min-w-0 truncate">Removed from store ({id})</span>
                        <Button size="sm" variant="ghost" onClick={() => removePicked(id)}>
                          Drop
                        </Button>
                      </li>
                    );
                  }
                  return (
                    <li
                      key={id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-[var(--av2-border)] bg-[var(--av2-surface)] py-1 pr-1 pl-3"
                    >
                      <span className="min-w-0 flex-1 text-sm">
                        <span className="mr-1.5 text-[var(--av2-text-2)] tabular-nums">
                          {idx + 1}.
                        </span>
                        <span className="font-medium">{faq.question}</span>{" "}
                        <span className="text-[var(--av2-text-2)]">— {faq.category}</span>
                      </span>
                      <ReorderActions
                        noun={`question ${idx + 1}`}
                        index={idx}
                        count={pickedIds.length}
                        onMove={(d) => movePicked(idx, d)}
                        onRemove={() => removePicked(id)}
                      />
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          {/* Available pool ----------------------------------------------- */}
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold">Available FAQs</h4>
              <span className="text-sm text-[var(--av2-text-2)] tabular-nums">
                {filteredFaqs.length} {filteredFaqs.length === 1 ? "match" : "matches"}
              </span>
            </div>

            <div className="mb-3">
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search question or answer text…"
                label="Search FAQs"
              />
            </div>

            <div className="mb-3">
              <FilterChips
                label="Filter FAQs by category"
                value={filterCategory}
                onChange={setFilterCategory}
                options={categories.map((cat) => ({ value: cat, label: cat }))}
              />
            </div>

            {allFaqs === null ? (
              <div className="space-y-2" aria-label="Loading FAQs">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            ) : filteredFaqs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--av2-border)] px-4 py-8 text-center text-sm text-[var(--av2-text-2)]">
                No FAQs match this filter. Add new ones in{" "}
                <Link
                  href="/admin/faq"
                  className="font-semibold text-[var(--av2-link)] underline-offset-2 hover:underline"
                >
                  Content → FAQ
                </Link>
                .
              </div>
            ) : (
              <ul className="max-h-[420px] space-y-1 overflow-auto rounded-xl border border-[var(--av2-border)] p-2">
                {filteredFaqs.map((faq) => {
                  const checked = isPicked(faq.id);
                  const inactiveHint = faq.isActive === false;
                  return (
                    <li key={faq.id}>
                      <label
                        className={`flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                          checked ? "bg-[var(--av2-selected)]" : "hover:bg-[var(--av2-bg)]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePicked(faq.id)}
                          disabled={!checked && pickedIds.length >= MAX_PICKED}
                          className="mt-0.5 h-4 w-4 shrink-0 rounded accent-[var(--av2-accent-strong)]"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                            {faq.question}
                            {inactiveHint && <Badge tone="amber">Hidden — won&apos;t render</Badge>}
                          </span>
                          <span className="mt-0.5 block text-xs text-[var(--av2-text-2)]">
                            {faq.category}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </FormSection>

      <BlockSaveFooter
        error={error}
        dirty={dirty}
        submitting={submitting}
        label="Save FAQ section"
      />
    </form>
  );
}
