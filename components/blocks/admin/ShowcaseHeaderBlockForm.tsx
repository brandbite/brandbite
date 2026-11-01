// -----------------------------------------------------------------------------
// @file: components/blocks/admin/ShowcaseHeaderBlockForm.tsx
// @purpose: Admin form for the SHOWCASE block. Edits only the section
//           header band — title, subtitle, and the right-side
//           "View the full gallery" CTA pair. Gallery items themselves
//           live in the Showcase table and are managed via /admin/showcase.
//
//           Saves via PUT /api/admin/page-blocks/[pageKey]/SHOWCASE.
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

import type { ShowcaseData } from "@/lib/blocks/types";

type ShowcaseHeaderBlockFormProps = {
  /** Initial values — DB row's data when present, defaults otherwise. */
  initial: ShowcaseData;
  /** Page key the block belongs to (e.g. "home"). */
  pageKey: string;
};

export function ShowcaseHeaderBlockForm({ initial, pageKey }: ShowcaseHeaderBlockFormProps) {
  const { showToast } = useToast();

  const [title, setTitle] = useState<string>(initial.title ?? "");
  const [subtitle, setSubtitle] = useState<string>(initial.subtitle ?? "");
  const [ctaLabel, setCtaLabel] = useState<string>(initial.ctaLabel ?? "");
  const [ctaHref, setCtaHref] = useState<string>(initial.ctaHref ?? "");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Presentation only: drives the SaveBar status + disables Save when clean.
  const { dirty, markSaved } = useDirtyBaseline(
    JSON.stringify([title, subtitle, ctaLabel, ctaHref]),
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    const tLabel = ctaLabel.trim();
    const tHref = ctaHref.trim();
    if (Boolean(tLabel) !== Boolean(tHref)) {
      setError(
        tLabel
          ? "Add a destination for the CTA, or clear the label to hide it."
          : "Add a label for the CTA, or clear the destination to hide it.",
      );
      return;
    }

    setSubmitting(true);
    try {
      const data: ShowcaseData = {
        ...(title.trim() ? { title: title.trim() } : {}),
        ...(subtitle.trim() ? { subtitle: subtitle.trim() } : {}),
        ...(tLabel ? { ctaLabel: tLabel } : {}),
        ...(tHref ? { ctaHref: tHref } : {}),
      };

      const res = await fetch(`/api/admin/page-blocks/${pageKey}/SHOWCASE`, {
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
        title: "Showcase header saved",
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
        Gallery items themselves are managed in{" "}
        <Link
          href="/admin/showcase"
          className="font-semibold text-[var(--av2-link)] underline-offset-2 hover:underline"
        >
          Content → Showcase
        </Link>
        .
      </Callout>

      {/* Title + subtitle (left side) -------------------------------- */}
      <FormSection title="Header copy" description="Both optional.">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Title (optional)" htmlFor="sh-title">
            <TextInput
              id="sh-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Showcase"
              maxLength={120}
            />
          </Field>
          <Field label="Subtitle (optional)" htmlFor="sh-subtitle">
            <TextInput
              id="sh-subtitle"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Creatives that speak louder than words."
              maxLength={300}
            />
          </Field>
        </div>
      </FormSection>

      {/* CTA pair (right side) --------------------------------------- */}
      <FormSection
        title="Gallery button"
        description="Clear both label and destination to hide the button."
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="CTA label (optional)" htmlFor="sh-cta-label">
            <TextInput
              id="sh-cta-label"
              value={ctaLabel}
              onChange={(e) => setCtaLabel(e.target.value)}
              placeholder="View the full gallery"
              maxLength={50}
            />
          </Field>
          <Field label="CTA destination (optional)" htmlFor="sh-cta-href">
            <TextInput
              id="sh-cta-href"
              value={ctaHref}
              onChange={(e) => setCtaHref(e.target.value)}
              placeholder="/showcase"
              maxLength={200}
            />
          </Field>
        </div>
      </FormSection>

      <BlockSaveFooter
        error={error}
        dirty={dirty}
        submitting={submitting}
        label="Save showcase header"
      />
    </form>
  );
}
