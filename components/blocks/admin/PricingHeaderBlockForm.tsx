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

import { Callout, Field, TextInput } from "@/components/admin/v2/ui";
import { useToast } from "@/components/ui/toast-provider";

import { BlockSaveFooter, FormSection, useDirtyBaseline } from "./block-form-ui";

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

  // Presentation only: drives the SaveBar status + disables Save when clean.
  const { dirty, markSaved } = useDirtyBaseline(
    JSON.stringify([eyebrow, title, subtitle, contactNote, contactLabel, contactHref]),
  );

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

      markSaved();
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
      <Callout title="Header copy only">
        Per-plan prices come from Stripe; per-plan name and tokens are managed in{" "}
        <Link
          href="/admin/plans"
          className="font-semibold text-[var(--av2-link)] underline-offset-2 hover:underline"
        >
          Catalog → Plans
        </Link>
        . Per-plan tagline / feature copy will become editable in a follow-up.
      </Callout>

      {/* Left side — header copy ------------------------------------- */}
      <FormSection title="Header copy" description="All optional.">
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Eyebrow (optional)" htmlFor="pr-eyebrow">
              <TextInput
                id="pr-eyebrow"
                value={eyebrow}
                onChange={(e) => setEyebrow(e.target.value)}
                placeholder="Start now your"
                maxLength={50}
              />
            </Field>
            <Field label="Title (optional)" htmlFor="pr-title">
              <TextInput
                id="pr-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="creative plan"
                maxLength={120}
              />
            </Field>
          </div>
          <Field label="Subtitle (optional)" htmlFor="pr-subtitle">
            <TextInput
              id="pr-subtitle"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Optional descriptive paragraph below the title."
              maxLength={300}
            />
          </Field>
        </div>
      </FormSection>

      {/* Right side — contact triad ---------------------------------- */}
      <FormSection
        title="Right-side contact prompt (optional)"
        description={
          <>
            Renders on the right of the header band as{" "}
            <em>&ldquo;Need a custom plan? Let&apos;s talk&rdquo;</em>. Set all three fields to
            show, or leave all three blank to hide.
          </>
        }
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <Field label="Note text" htmlFor="pr-contact-note">
            <TextInput
              id="pr-contact-note"
              value={contactNote}
              onChange={(e) => setContactNote(e.target.value)}
              placeholder="Need a custom plan?"
              maxLength={120}
            />
          </Field>
          <Field label="Link label" htmlFor="pr-contact-label">
            <TextInput
              id="pr-contact-label"
              value={contactLabel}
              onChange={(e) => setContactLabel(e.target.value)}
              placeholder="Let's talk"
              maxLength={50}
            />
          </Field>
          <Field label="Link destination" htmlFor="pr-contact-href">
            <TextInput
              id="pr-contact-href"
              value={contactHref}
              onChange={(e) => setContactHref(e.target.value)}
              placeholder="mailto:hello@brandbite.studio"
              maxLength={200}
            />
          </Field>
        </div>
      </FormSection>

      <BlockSaveFooter
        error={error}
        dirty={dirty}
        submitting={submitting}
        label="Save pricing header"
      />
    </form>
  );
}
