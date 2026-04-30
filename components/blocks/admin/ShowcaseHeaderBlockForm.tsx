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

import { Button } from "@/components/ui/button";
import { FormInput } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { useToast } from "@/components/ui/toast-provider";

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
      <InlineAlert variant="info" size="sm">
        This form only edits the <strong>section header</strong> above the gallery grid. Gallery
        items themselves are managed in{" "}
        <Link href="/admin/showcase" className="underline">
          Content → Showcase
        </Link>
        .
      </InlineAlert>

      {/* Title + subtitle (left side) -------------------------------- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="sh-title"
            className="mb-1 block text-xs font-semibold text-[var(--bb-secondary)]"
          >
            Title (optional)
          </label>
          <FormInput
            id="sh-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Showcase"
            maxLength={120}
          />
        </div>
        <div>
          <label
            htmlFor="sh-subtitle"
            className="mb-1 block text-xs font-semibold text-[var(--bb-secondary)]"
          >
            Subtitle (optional)
          </label>
          <FormInput
            id="sh-subtitle"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="Creatives that speak louder than words."
            maxLength={300}
          />
        </div>
      </div>

      {/* CTA pair (right side) --------------------------------------- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="sh-cta-label"
            className="mb-1 block text-xs font-semibold text-[var(--bb-secondary)]"
          >
            CTA label (optional)
          </label>
          <FormInput
            id="sh-cta-label"
            value={ctaLabel}
            onChange={(e) => setCtaLabel(e.target.value)}
            placeholder="View the full gallery"
            maxLength={50}
          />
          <p className="mt-1 text-xs text-[var(--bb-text-muted)]">
            Clear both label and destination to hide the button.
          </p>
        </div>
        <div>
          <label
            htmlFor="sh-cta-href"
            className="mb-1 block text-xs font-semibold text-[var(--bb-secondary)]"
          >
            CTA destination (optional)
          </label>
          <FormInput
            id="sh-cta-href"
            value={ctaHref}
            onChange={(e) => setCtaHref(e.target.value)}
            placeholder="/showcase"
            maxLength={200}
          />
        </div>
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
          Save showcase header
        </Button>
      </div>
    </form>
  );
}
