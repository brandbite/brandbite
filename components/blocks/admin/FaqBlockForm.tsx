// -----------------------------------------------------------------------------
// @file: components/blocks/admin/FaqBlockForm.tsx
// @purpose: Admin form for editing the FAQ block. Optional title +
//           subtitle above a list of 1-to-40 question/answer pairs.
//           Saves via PUT /api/admin/page-blocks/[pageKey]/FAQ.
//
//           Cap of 40 mirrors the Zod schema in lib/blocks/types.ts —
//           past that the accordion gets unwieldy and the page bloats.
//           In practice 4-12 Q&As is the realistic range.
// -----------------------------------------------------------------------------
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-04-28
// -----------------------------------------------------------------------------

"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FormInput } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { useToast } from "@/components/ui/toast-provider";

import type { FaqData } from "@/lib/blocks/types";

type FaqBlockFormProps = {
  /** Initial values — DB row's data when present, defaults otherwise. */
  initial: FaqData;
  /** Page key the block belongs to (e.g. "home"). */
  pageKey: string;
};

/** Hard caps on rows. Mirrors the Zod schema in lib/blocks/types.ts so
 *  the client can fail fast before a save round-trip. */
const MIN_QAS = 1;
const MAX_QAS = 40;

type QaDraft = { q: string; a: string };

export function FaqBlockForm({ initial, pageKey }: FaqBlockFormProps) {
  const { showToast } = useToast();

  const [title, setTitle] = useState<string>(initial.title ?? "");
  const [subtitle, setSubtitle] = useState<string>(initial.subtitle ?? "");
  const [qas, setQas] = useState<QaDraft[]>(
    // Defensive deep-copy so React state updates don't accidentally
    // mutate the caller's defaults.
    initial.qas.map((qa) => ({ q: qa.q, a: qa.a })),
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateQa = (idx: number, patch: Partial<QaDraft>) => {
    setQas((prev) => prev.map((qa, i) => (i === idx ? { ...qa, ...patch } : qa)));
  };

  const addQa = () => {
    if (qas.length >= MAX_QAS) return;
    setQas((prev) => [...prev, { q: "", a: "" }]);
  };

  const removeQa = (idx: number) => {
    if (qas.length <= MIN_QAS) return;
    setQas((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveQa = (idx: number, direction: -1 | 1) => {
    const target = idx + direction;
    if (target < 0 || target >= qas.length) return;
    setQas((prev) => {
      const next = prev.slice();
      const [moved] = next.splice(idx, 1);
      next.splice(target, 0, moved);
      return next;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setError(null);

    if (qas.length < MIN_QAS) {
      setError("At least one question is required.");
      return;
    }
    if (qas.length > MAX_QAS) {
      setError(`No more than ${MAX_QAS} questions allowed.`);
      return;
    }
    for (let i = 0; i < qas.length; i++) {
      const qa = qas[i];
      if (!qa.q.trim()) {
        setError(`Question ${i + 1} needs text.`);
        return;
      }
      if (!qa.a.trim()) {
        setError(`Question ${i + 1} needs an answer.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const data: FaqData = {
        ...(title.trim() ? { title: title.trim() } : {}),
        ...(subtitle.trim() ? { subtitle: subtitle.trim() } : {}),
        qas: qas.map((qa) => ({ q: qa.q.trim(), a: qa.a.trim() })),
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
        title: "FAQ saved",
        description: "Reload the landing page to see your changes.",
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
            htmlFor="faq-title"
            className="mb-1 block text-xs font-semibold text-[var(--bb-secondary)]"
          >
            Section title (optional)
          </label>
          <FormInput
            id="faq-title"
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
            htmlFor="faq-subtitle"
            className="mb-1 block text-xs font-semibold text-[var(--bb-secondary)]"
          >
            Subtitle (optional)
          </label>
          <FormInput
            id="faq-subtitle"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="Frequently asked questions."
            maxLength={300}
          />
        </div>
      </div>

      {/* Q&A list ----------------------------------------------------- */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--bb-secondary)]">
            Questions ({qas.length}/{MAX_QAS})
          </h3>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addQa}
            disabled={qas.length >= MAX_QAS}
          >
            Add question
          </Button>
        </div>

        {qas.map((qa, idx) => (
          <div
            key={idx}
            className="rounded-xl border border-[var(--bb-border-subtle)] bg-[var(--bb-bg-warm)] px-4 py-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold tracking-[0.12em] text-[var(--bb-text-tertiary)] uppercase">
                Question {idx + 1}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => moveQa(idx, -1)}
                  disabled={idx === 0}
                  aria-label={`Move question ${idx + 1} up`}
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => moveQa(idx, 1)}
                  disabled={idx === qas.length - 1}
                  aria-label={`Move question ${idx + 1} down`}
                >
                  ↓
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeQa(idx)}
                  disabled={qas.length <= MIN_QAS}
                  aria-label={`Remove question ${idx + 1}`}
                >
                  Remove
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label
                  htmlFor={`faq-q-${idx}`}
                  className="mb-1 block text-xs font-semibold text-[var(--bb-secondary)]"
                >
                  Question <span className="text-[var(--bb-primary)]">*</span>
                </label>
                <FormInput
                  id={`faq-q-${idx}`}
                  value={qa.q}
                  onChange={(e) => updateQa(idx, { q: e.target.value })}
                  placeholder="How fast will I get my creatives?"
                  maxLength={200}
                />
              </div>
              <div>
                <label
                  htmlFor={`faq-a-${idx}`}
                  className="mb-1 block text-xs font-semibold text-[var(--bb-secondary)]"
                >
                  Answer <span className="text-[var(--bb-primary)]">*</span>
                </label>
                <textarea
                  id={`faq-a-${idx}`}
                  value={qa.a}
                  onChange={(e) => updateQa(idx, { a: e.target.value })}
                  placeholder="Most requests are completed within 1 to 2 days."
                  rows={4}
                  maxLength={2000}
                  className="w-full rounded-md border border-[var(--bb-border-input)] bg-[var(--bb-bg-page)] px-3 py-2 text-sm text-[var(--bb-secondary)] outline-none focus:border-[var(--bb-primary)] focus:ring-1 focus:ring-[var(--bb-primary)]"
                />
                <p className="mt-1 text-xs text-[var(--bb-text-muted)]">
                  Line breaks are preserved on the public page.
                </p>
              </div>
            </div>
          </div>
        ))}
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
          Save FAQ
        </Button>
      </div>
    </form>
  );
}
