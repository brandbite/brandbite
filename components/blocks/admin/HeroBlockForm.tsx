// -----------------------------------------------------------------------------
// @file: components/blocks/admin/HeroBlockForm.tsx
// @purpose: Admin form for editing the HERO block. Variant selector +
//           typed text fields + R2 image upload (reusing the existing
//           CmsImageUpload component). Saves via
//           PUT /api/admin/page-blocks/[pageKey]/HERO.
//
//           Designed to feel like a normal admin form, not a Wix-style
//           drag-drop. Pre-launch we prefer constrained editing — the
//           variant dropdown gives you 4 layouts that all look right,
//           rather than infinite knobs that can produce broken pages.
// -----------------------------------------------------------------------------

"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { CmsImageUpload } from "@/components/ui/cms-image-upload";
import { FormInput } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { useToast } from "@/components/ui/toast-provider";

import { HERO_VARIANTS, type HeroData } from "@/lib/blocks/types";

type HeroBlockFormProps = {
  /** Initial values — DB row's data when present, defaults otherwise. */
  initial: HeroData;
  /** Page key the block belongs to (e.g. "home"). */
  pageKey: string;
};

const VARIANT_LABELS: Record<(typeof HERO_VARIANTS)[number], string> = {
  centered: "Centered text (current)",
  "image-right": "Text left, image right",
  "image-left": "Image left, text right",
  "full-bleed": "Full-bleed background image",
};

const VARIANT_HELPS: Record<(typeof HERO_VARIANTS)[number], string> = {
  centered: "Big headline above the fold, no image. The current shipped layout.",
  "image-right": "Two-column on desktop. Headline + CTA on the left, image on the right.",
  "image-left": "Two-column on desktop, mirrored. Image left, headline + CTA on the right.",
  "full-bleed": "Edge-to-edge background image with text overlay. Best for product photography.",
};

export function HeroBlockForm({ initial, pageKey }: HeroBlockFormProps) {
  const { showToast } = useToast();

  // One useState per field so the form is fully controlled and dirty-state
  // detection is trivial. Compose into a HeroData on save.
  const [variant, setVariant] = useState<HeroData["variant"]>(initial.variant);
  const [headline, setHeadline] = useState<string>(initial.headline);
  const [subhead, setSubhead] = useState<string>(initial.subhead ?? "");
  const [ctaLabel, setCtaLabel] = useState<string>(initial.ctaLabel ?? "");
  const [ctaHref, setCtaHref] = useState<string>(initial.ctaHref ?? "");
  const [secondaryCtaLabel, setSecondaryCtaLabel] = useState<string>(
    initial.secondaryCtaLabel ?? "",
  );
  const [secondaryCtaHref, setSecondaryCtaHref] = useState<string>(initial.secondaryCtaHref ?? "");
  const [image, setImage] = useState<{ storageKey: string; url: string } | null>(
    initial.image?.storageKey && initial.image?.url
      ? { storageKey: initial.image.storageKey, url: initial.image.url }
      : null,
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const variantNeedsImage =
    variant === "image-left" || variant === "image-right" || variant === "full-bleed";

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setError(null);

    if (!headline.trim()) {
      setError("Headline is required.");
      return;
    }
    if (variantNeedsImage && !image) {
      setError("This variant needs a hero image. Upload one or switch to the Centered variant.");
      return;
    }
    if (ctaLabel.trim() && !ctaHref.trim()) {
      setError("CTA label has no link. Add a destination or clear the label.");
      return;
    }
    if (secondaryCtaLabel.trim() && !secondaryCtaHref.trim()) {
      setError("Secondary CTA label has no link. Add one or clear the label.");
      return;
    }

    setSubmitting(true);
    try {
      const data: HeroData = {
        variant,
        headline: headline.trim(),
        ...(subhead.trim() ? { subhead: subhead.trim() } : {}),
        ...(ctaLabel.trim() ? { ctaLabel: ctaLabel.trim() } : {}),
        ...(ctaHref.trim() ? { ctaHref: ctaHref.trim() } : {}),
        ...(secondaryCtaLabel.trim() ? { secondaryCtaLabel: secondaryCtaLabel.trim() } : {}),
        ...(secondaryCtaHref.trim() ? { secondaryCtaHref: secondaryCtaHref.trim() } : {}),
        ...(image
          ? {
              image: { storageKey: image.storageKey, url: image.url },
            }
          : {}),
      };

      const res = await fetch(`/api/admin/page-blocks/${pageKey}/HERO`, {
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
        title: "Hero saved",
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
      {/* Variant ------------------------------------------------------- */}
      <div>
        <label
          htmlFor="hero-variant"
          className="mb-1 block text-xs font-semibold text-[var(--bb-secondary)]"
        >
          Layout variant
        </label>
        <select
          id="hero-variant"
          value={variant}
          onChange={(e) => setVariant(e.target.value as HeroData["variant"])}
          className="w-full rounded-md border border-[var(--bb-border-input)] bg-[var(--bb-bg-page)] px-3 py-2 text-sm text-[var(--bb-secondary)] outline-none focus:border-[var(--bb-primary)] focus:ring-1 focus:ring-[var(--bb-primary)]"
        >
          {HERO_VARIANTS.map((v) => (
            <option key={v} value={v}>
              {VARIANT_LABELS[v]}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-[var(--bb-text-secondary)]">{VARIANT_HELPS[variant]}</p>
      </div>

      {/* Headline ----------------------------------------------------- */}
      <div>
        <label
          htmlFor="hero-headline"
          className="mb-1 block text-xs font-semibold text-[var(--bb-secondary)]"
        >
          Headline <span className="text-[var(--bb-primary)]">*</span>
        </label>
        <FormInput
          id="hero-headline"
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          placeholder="All your creatives, one subscription."
          maxLength={200}
        />
      </div>

      {/* Subhead ------------------------------------------------------- */}
      <div>
        <label
          htmlFor="hero-subhead"
          className="mb-1 block text-xs font-semibold text-[var(--bb-secondary)]"
        >
          Subhead
        </label>
        <textarea
          id="hero-subhead"
          value={subhead}
          onChange={(e) => setSubhead(e.target.value)}
          placeholder="Optional supporting paragraph below the headline."
          rows={2}
          maxLength={500}
          className="w-full rounded-md border border-[var(--bb-border-input)] bg-[var(--bb-bg-page)] px-3 py-2 text-sm text-[var(--bb-secondary)] outline-none focus:border-[var(--bb-primary)] focus:ring-1 focus:ring-[var(--bb-primary)]"
        />
      </div>

      {/* CTA pair ------------------------------------------------------ */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="hero-cta-label"
            className="mb-1 block text-xs font-semibold text-[var(--bb-secondary)]"
          >
            Primary CTA label
          </label>
          <FormInput
            id="hero-cta-label"
            value={ctaLabel}
            onChange={(e) => setCtaLabel(e.target.value)}
            placeholder="Get Started"
            maxLength={50}
          />
        </div>
        <div>
          <label
            htmlFor="hero-cta-href"
            className="mb-1 block text-xs font-semibold text-[var(--bb-secondary)]"
          >
            Primary CTA destination
          </label>
          <FormInput
            id="hero-cta-href"
            value={ctaHref}
            onChange={(e) => setCtaHref(e.target.value)}
            placeholder="/login"
            maxLength={200}
          />
          <p className="mt-1 text-xs text-[var(--bb-text-muted)]">
            Internal path like <code>/login</code> or full URL starting with <code>https://</code>.
          </p>
        </div>
      </div>

      {/* Secondary CTA (optional) -------------------------------------- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="hero-secondary-label"
            className="mb-1 block text-xs font-semibold text-[var(--bb-secondary)]"
          >
            Secondary CTA label (optional)
          </label>
          <FormInput
            id="hero-secondary-label"
            value={secondaryCtaLabel}
            onChange={(e) => setSecondaryCtaLabel(e.target.value)}
            placeholder="See the showcase"
            maxLength={50}
          />
        </div>
        <div>
          <label
            htmlFor="hero-secondary-href"
            className="mb-1 block text-xs font-semibold text-[var(--bb-secondary)]"
          >
            Secondary CTA destination
          </label>
          <FormInput
            id="hero-secondary-href"
            value={secondaryCtaHref}
            onChange={(e) => setSecondaryCtaHref(e.target.value)}
            placeholder="/showcase"
            maxLength={200}
          />
        </div>
      </div>

      {/* Hero image (only shown for variants that use one) ------------ */}
      {variantNeedsImage ? (
        <div>
          <CmsImageUpload
            type="page-block"
            value={image}
            onChange={setImage}
            label="Hero image"
            aspectRatio={variant === "full-bleed" ? "21/9" : "4/3"}
          />
          <p className="mt-1 text-xs text-[var(--bb-text-muted)]">
            For full-bleed, use a high-resolution image (≥1600px wide). The renderer adds a dark
            gradient overlay so light photos stay legible.
          </p>
        </div>
      ) : null}

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
          Save hero
        </Button>
      </div>
    </form>
  );
}
