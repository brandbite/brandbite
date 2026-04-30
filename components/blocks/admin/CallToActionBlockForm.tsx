// -----------------------------------------------------------------------------
// @file: components/blocks/admin/CallToActionBlockForm.tsx
// @purpose: Admin form for editing the CALL_TO_ACTION block — the full-width
//           conversion band rendered between sections on the landing page.
//           Headline + optional subhead + required CTA pair.
//
//           Saves via PUT /api/admin/page-blocks/[pageKey]/CALL_TO_ACTION.
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

import type { CallToActionData } from "@/lib/blocks/types";

type CallToActionBlockFormProps = {
  /** Initial values — DB row's data when present, defaults otherwise. */
  initial: CallToActionData;
  /** Page key the block belongs to (e.g. "home"). */
  pageKey: string;
};

export function CallToActionBlockForm({ initial, pageKey }: CallToActionBlockFormProps) {
  const { showToast } = useToast();

  const [headline, setHeadline] = useState<string>(initial.headline);
  const [subhead, setSubhead] = useState<string>(initial.subhead ?? "");
  const [ctaLabel, setCtaLabel] = useState<string>(initial.ctaLabel);
  const [ctaHref, setCtaHref] = useState<string>(initial.ctaHref);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (!headline.trim()) {
      setError("Headline is required.");
      return;
    }
    if (!ctaLabel.trim()) {
      setError("CTA label is required.");
      return;
    }
    if (!ctaHref.trim()) {
      setError("CTA destination is required.");
      return;
    }

    setSubmitting(true);
    try {
      const data: CallToActionData = {
        headline: headline.trim(),
        ...(subhead.trim() ? { subhead: subhead.trim() } : {}),
        ctaLabel: ctaLabel.trim(),
        ctaHref: ctaHref.trim(),
      };

      const res = await fetch(`/api/admin/page-blocks/${pageKey}/CALL_TO_ACTION`, {
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
        title: "Call-to-action saved",
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
      <div>
        <label
          htmlFor="cta-headline"
          className="mb-1 block text-xs font-semibold text-[var(--bb-secondary)]"
        >
          Headline <span className="text-[var(--bb-primary)]">*</span>
        </label>
        <FormInput
          id="cta-headline"
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          placeholder="Ready to start your first creative request?"
          maxLength={200}
        />
      </div>

      <div>
        <label
          htmlFor="cta-subhead"
          className="mb-1 block text-xs font-semibold text-[var(--bb-secondary)]"
        >
          Subhead (optional)
        </label>
        <textarea
          id="cta-subhead"
          value={subhead}
          onChange={(e) => setSubhead(e.target.value)}
          placeholder="Pause or cancel anytime. Your work and assets stay yours."
          rows={2}
          maxLength={400}
          className="w-full rounded-md border border-[var(--bb-border-input)] bg-[var(--bb-bg-page)] px-3 py-2 text-sm text-[var(--bb-secondary)] outline-none focus:border-[var(--bb-primary)] focus:ring-1 focus:ring-[var(--bb-primary)]"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="cta-label"
            className="mb-1 block text-xs font-semibold text-[var(--bb-secondary)]"
          >
            CTA label <span className="text-[var(--bb-primary)]">*</span>
          </label>
          <FormInput
            id="cta-label"
            value={ctaLabel}
            onChange={(e) => setCtaLabel(e.target.value)}
            placeholder="Get Started"
            maxLength={50}
          />
        </div>
        <div>
          <label
            htmlFor="cta-href"
            className="mb-1 block text-xs font-semibold text-[var(--bb-secondary)]"
          >
            CTA destination <span className="text-[var(--bb-primary)]">*</span>
          </label>
          <FormInput
            id="cta-href"
            value={ctaHref}
            onChange={(e) => setCtaHref(e.target.value)}
            placeholder="/login"
            maxLength={200}
          />
          <p className="mt-1 text-xs text-[var(--bb-text-muted)]">
            Internal path like <code>/login</code>, anchor like <code>#pricing</code>, or full URL.
          </p>
        </div>
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
          Save call-to-action
        </Button>
      </div>
    </form>
  );
}
