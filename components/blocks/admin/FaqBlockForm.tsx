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

import { Button } from "@/components/ui/button";
import { FormInput } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { useToast } from "@/components/ui/toast-provider";

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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="faq-block-title"
            className="mb-1 block text-xs font-semibold text-[var(--bb-secondary)]"
          >
            Section title (optional)
          </label>
          <FormInput
            id="faq-block-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="FAQ"
            maxLength={120}
          />
          <p className="mt-1 text-xs text-[var(--bb-text-muted)]">
            Defaults to <code>FAQ</code> when blank.
          </p>
        </div>
        <div>
          <label
            htmlFor="faq-block-subtitle"
            className="mb-1 block text-xs font-semibold text-[var(--bb-secondary)]"
          >
            Subtitle (optional)
          </label>
          <FormInput
            id="faq-block-subtitle"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="Frequently asked questions."
            maxLength={300}
          />
        </div>
      </div>

      {/* "See all" CTA pair (optional, paired) ------------------------ */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="faq-block-cta-label"
            className="mb-1 block text-xs font-semibold text-[var(--bb-secondary)]"
          >
            CTA label (optional)
          </label>
          <FormInput
            id="faq-block-cta-label"
            value={ctaLabel}
            onChange={(e) => setCtaLabel(e.target.value)}
            placeholder="See all questions"
            maxLength={50}
          />
          <p className="mt-1 text-xs text-[var(--bb-text-muted)]">
            Shown below the accordion. Clear both label and destination to hide the button.
          </p>
        </div>
        <div>
          <label
            htmlFor="faq-block-cta-href"
            className="mb-1 block text-xs font-semibold text-[var(--bb-secondary)]"
          >
            CTA destination (optional)
          </label>
          <FormInput
            id="faq-block-cta-href"
            value={ctaHref}
            onChange={(e) => setCtaHref(e.target.value)}
            placeholder="/faq"
            maxLength={200}
          />
          <p className="mt-1 text-xs text-[var(--bb-text-muted)]">
            Internal path like <code>/faq</code> or full URL.
          </p>
        </div>
      </div>

      {/* Where the FAQs live notice ----------------------------------- */}
      <InlineAlert variant="info" size="sm">
        Question text and answers are managed in{" "}
        <Link href="/admin/faq" className="underline">
          Content → FAQ
        </Link>
        . This form only chooses which questions to surface on the landing page.
      </InlineAlert>

      {loadError && (
        <InlineAlert variant="error" size="sm">
          {loadError}
        </InlineAlert>
      )}

      {/* Selection summary -------------------------------------------- */}
      <div className="rounded-xl border border-[var(--bb-border)] bg-[var(--bb-bg-warm)] px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-[var(--bb-secondary)]">
              {pickedIds.length === 0
                ? "Nothing picked yet"
                : `${pickedIds.length} ${pickedIds.length === 1 ? "FAQ" : "FAQs"} selected`}
            </p>
            <p className="mt-0.5 text-xs text-[var(--bb-text-muted)]">
              {pickedIds.length === 0
                ? `Empty selection falls back to the first ${DEFAULT_FAQ_FALLBACK_LIMIT} active FAQs in category order.`
                : "Drag-equivalent reorder via ↑ / ↓ on each row."}
            </p>
          </div>
          {pickedIds.length > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={clearAllPicked}>
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
                    className="flex items-center justify-between rounded-md border border-dashed border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-3 py-2 text-xs text-[var(--bb-text-tertiary)]"
                  >
                    <span>Removed from store ({id})</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removePicked(id)}
                    >
                      Drop
                    </Button>
                  </li>
                );
              }
              return (
                <li
                  key={id}
                  className="flex items-center justify-between gap-2 rounded-md bg-[var(--bb-bg-page)] px-3 py-2"
                >
                  <span className="min-w-0 flex-1 text-xs">
                    <span className="font-mono text-[10px] text-[var(--bb-text-muted)]">
                      {idx + 1}.
                    </span>{" "}
                    <span className="font-semibold text-[var(--bb-secondary)]">{faq.question}</span>{" "}
                    <span className="text-[var(--bb-text-muted)]">— {faq.category}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => movePicked(idx, -1)}
                      disabled={idx === 0}
                      aria-label="Move up"
                    >
                      ↑
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => movePicked(idx, 1)}
                      disabled={idx === pickedIds.length - 1}
                      aria-label="Move down"
                    >
                      ↓
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removePicked(id)}
                    >
                      Remove
                    </Button>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* Available pool ----------------------------------------------- */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--bb-secondary)]">Available FAQs</h3>
          <span className="text-xs text-[var(--bb-text-muted)]">
            {filteredFaqs.length} {filteredFaqs.length === 1 ? "match" : "matches"}
          </span>
        </div>

        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <FormInput
              id="faq-block-search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search question or answer text…"
            />
          </div>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {categories.map((cat) => (
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

        {allFaqs === null ? (
          <p className="rounded-xl border border-dashed border-[var(--bb-border)] bg-[var(--bb-bg-warm)] px-4 py-6 text-center text-xs text-[var(--bb-text-muted)]">
            Loading FAQs…
          </p>
        ) : filteredFaqs.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--bb-border)] bg-[var(--bb-bg-warm)] px-4 py-6 text-center text-xs text-[var(--bb-text-muted)]">
            No FAQs match this filter. Add new ones in{" "}
            <Link href="/admin/faq" className="underline">
              Content → FAQ
            </Link>
            .
          </p>
        ) : (
          <ul className="max-h-[420px] space-y-1.5 overflow-auto rounded-xl border border-[var(--bb-border-subtle)] bg-[var(--bb-bg-page)] p-2">
            {filteredFaqs.map((faq) => {
              const checked = isPicked(faq.id);
              const inactiveHint = faq.isActive === false ? " (Hidden — won't render)" : "";
              return (
                <li key={faq.id}>
                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-md px-3 py-2 transition-colors ${
                      checked ? "bg-[var(--bb-primary-light)]" : "hover:bg-[var(--bb-bg-warm)]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePicked(faq.id)}
                      disabled={!checked && pickedIds.length >= MAX_PICKED}
                      className="mt-1 h-4 w-4 rounded border-[var(--bb-border-input)] text-[var(--bb-primary)] focus:ring-[var(--bb-primary)]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-[var(--bb-secondary)]">
                        {faq.question}
                        {inactiveHint && (
                          <span className="ml-1 text-xs font-normal text-[var(--bb-warning-text)]">
                            {inactiveHint}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-xs text-[var(--bb-text-muted)]">
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

      {/* Error + submit ---------------------------------------------- */}
      {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}

      <div className="flex justify-end gap-3 pt-2">
        <Button
          type="submit"
          variant="primary"
          loading={submitting}
          loadingText="Saving…"
          disabled={submitting}
        >
          Save FAQ section
        </Button>
      </div>
    </form>
  );
}
