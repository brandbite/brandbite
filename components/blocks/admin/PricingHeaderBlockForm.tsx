// -----------------------------------------------------------------------------
// @file: components/blocks/admin/PricingHeaderBlockForm.tsx
// @purpose: Admin form for the PRICING block. Edits only the section
//           header band — eyebrow, title, optional subtitle, and an
//           optional 3-field contact prompt on the right side. Per-plan
//           tagline/features/CTA copy lives on the Plan model and is
//           edited via /admin/plans (PR 2 of the pricing rework).
//
//           Saves via PUT /api/admin/page-blocks/[pageKey]/PRICING.
// -----------------------------------------------------------------------------
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-04-30
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FormInput } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { useToast } from "@/components/ui/toast-provider";

import type { PricingData } from "@/lib/blocks/types";

type PricingHeaderBlockFormProps = {
  /** Initial values — DB row's data when present, defaults otherwise. */
  initial: PricingData;
  /** Page key the block belongs to (e.g. "home"). */
  pageKey: string;
};

export function PricingHeaderBlockForm({ initial, pageKey }: PricingHeaderBlockFormProps) {
  const { showToast } = useToast();

  const [eyebrow, setEyebrow] = useState<string>(initial.eyebrow ?? "");
  const [title, setTitle] = useState<string>(initial.title ?? "");
  const [subtitle, setSubtitle] = useState<string>(initial.subtitle ?? "");
  const [contactNote, setContactNote] = useState<string>(initial.contactNote ?? "");
  const [contactLabel, setContactLabel] = useState<string>(initial.contactLabel ?? "");
  const [contactHref, setContactHref] = useState<string>(initial.contactHref ?? "");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    // Contact triad must be all-or-nothing (matches schema's superRefine).
    const tNote = contactNote.trim();
    const tLabel = contactLabel.trim();
    const tHref = contactHref.trim();
    const setCount = [tNote, tLabel, tHref].filter(Boolean).length;
    if (setCount > 0 && setCount < 3) {
      setError(
        "Contact note, label, and destination must all be set together (or all blank to hide).",
      );
      return;
    }

    setSubmitting(true);
    try {
      const data: PricingData = {
        ...(eyebrow.trim() ? { eyebrow: eyebrow.trim() } : {}),
        ...(title.trim() ? { title: title.trim() } : {}),
        ...(subtitle.trim() ? { subtitle: subtitle.trim() } : {}),
        ...(tNote ? { contactNote: tNote } : {}),
        ...(tLabel ? { contactLabel: tLabel } : {}),
        ...(tHref ? { contactHref: tHref } : {}),
      };

      const res = await fetch(`/api/admin/page-blocks/${pageKey}/PRICING`, {
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
        title: "Pricing header saved",
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
      <InlineAlert variant="info" size="sm">
        This form only edits the <strong>section header</strong> above the plan-card grid. Per-plan
        prices come from Stripe; per-plan name and tokens are managed in{" "}
        <Link href="/admin/plans" className="underline">
          Catalog → Plans
        </Link>
        . Per-plan tagline / feature copy will become editable in a follow-up.
      </InlineAlert>

      {/* Left side — header copy ------------------------------------- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="pr-eyebrow"
            className="mb-1 block text-xs font-semibold text-[var(--bb-secondary)]"
          >
            Eyebrow (optional)
          </label>
          <FormInput
            id="pr-eyebrow"
            value={eyebrow}
            onChange={(e) => setEyebrow(e.target.value)}
            placeholder="Start now your"
            maxLength={50}
          />
        </div>
        <div>
          <label
            htmlFor="pr-title"
            className="mb-1 block text-xs font-semibold text-[var(--bb-secondary)]"
          >
            Title (optional)
          </label>
          <FormInput
            id="pr-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="creative plan"
            maxLength={120}
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="pr-subtitle"
          className="mb-1 block text-xs font-semibold text-[var(--bb-secondary)]"
        >
          Subtitle (optional)
        </label>
        <FormInput
          id="pr-subtitle"
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          placeholder="Optional descriptive paragraph below the title."
          maxLength={300}
        />
      </div>

      {/* Right side — contact triad ---------------------------------- */}
      <fieldset className="rounded-xl border border-[var(--bb-border-subtle)] bg-[var(--bb-bg-warm)] px-4 py-4">
        <legend className="px-2 text-xs font-semibold tracking-[0.12em] text-[var(--bb-text-tertiary)] uppercase">
          Right-side contact prompt (optional)
        </legend>
        <p className="mt-1 text-xs text-[var(--bb-text-muted)]">
          Renders on the right of the header band as
          <em> &ldquo;Need a custom plan? Let&apos;s talk&rdquo;</em>. Set all three fields to
          show, or leave all three blank to hide.
        </p>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label
              htmlFor="pr-contact-note"
              className="mb-1 block text-xs font-semibold text-[var(--bb-secondary)]"
            >
              Note text
            </label>
            <FormInput
              id="pr-contact-note"
              value={contactNote}
              onChange={(e) => setContactNote(e.target.value)}
              placeholder="Need a custom plan?"
              maxLength={120}
            />
          </div>
          <div>
            <label
              htmlFor="pr-contact-label"
              className="mb-1 block text-xs font-semibold text-[var(--bb-secondary)]"
            >
              Link label
            </label>
            <FormInput
              id="pr-contact-label"
              value={contactLabel}
              onChange={(e) => setContactLabel(e.target.value)}
              placeholder="Let's talk"
              maxLength={50}
            />
          </div>
          <div>
            <label
              htmlFor="pr-contact-href"
              className="mb-1 block text-xs font-semibold text-[var(--bb-secondary)]"
            >
              Link destination
            </label>
            <FormInput
              id="pr-contact-href"
              value={contactHref}
              onChange={(e) => setContactHref(e.target.value)}
              placeholder="mailto:hello@brandbite.io"
              maxLength={200}
            />
          </div>
        </div>
      </fieldset>

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
          Save pricing header
        </Button>
      </div>
    </form>
  );
}
