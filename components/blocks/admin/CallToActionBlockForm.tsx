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

import { Field, TextArea, TextInput } from "@/components/admin/v2/ui";
import { useToast } from "@/components/ui/toast-provider";

import { BlockSaveFooter, Code, FormSection, Req, useDirtyBaseline } from "./block-form-ui";

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

  // Presentation only: drives the SaveBar status + disables Save when clean.
  const { dirty, markSaved } = useDirtyBaseline(
    JSON.stringify([headline, subhead, ctaLabel, ctaHref]),
  );

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

      markSaved();
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
      <FormSection title="Content">
        <div className="space-y-5">
          <Field
            label={
              <>
                Headline
                <Req />
              </>
            }
            htmlFor="cta-headline"
          >
            <TextInput
              id="cta-headline"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="Ready to start your first creative request?"
              maxLength={200}
            />
          </Field>
          <Field label="Subhead (optional)" htmlFor="cta-subhead">
            <TextArea
              id="cta-subhead"
              value={subhead}
              onChange={(e) => setSubhead(e.target.value)}
              placeholder="Pause or cancel anytime. Your work and assets stay yours."
              rows={2}
              maxLength={400}
            />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Button">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field
            label={
              <>
                CTA label
                <Req />
              </>
            }
            htmlFor="cta-label"
          >
            <TextInput
              id="cta-label"
              value={ctaLabel}
              onChange={(e) => setCtaLabel(e.target.value)}
              placeholder="Get Started"
              maxLength={50}
            />
          </Field>
          <Field
            label={
              <>
                CTA destination
                <Req />
              </>
            }
            htmlFor="cta-href"
            hint={
              <>
                Internal path like <Code>/login</Code>, anchor like <Code>#pricing</Code>, or full
                URL.
              </>
            }
          >
            <TextInput
              id="cta-href"
              value={ctaHref}
              onChange={(e) => setCtaHref(e.target.value)}
              placeholder="/login"
              maxLength={200}
            />
          </Field>
        </div>
      </FormSection>

      <BlockSaveFooter
        error={error}
        dirty={dirty}
        submitting={submitting}
        label="Save call-to-action"
      />
    </form>
  );
}
