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

import { Field, Select, TextArea, TextInput } from "@/components/admin/v2/ui";
import { CmsImageUpload } from "@/components/ui/cms-image-upload";
import { useToast } from "@/components/ui/toast-provider";

import { BlockSaveFooter, Code, FormSection, Req, useDirtyBaseline } from "./block-form-ui";

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

  // Presentation only: drives the SaveBar status + disables Save when clean.
  const { dirty, markSaved } = useDirtyBaseline(
    JSON.stringify([
      variant,
      headline,
      subhead,
      ctaLabel,
      ctaHref,
      secondaryCtaLabel,
      secondaryCtaHref,
      image,
    ]),
  );

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

      markSaved();
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
      <FormSection>
        <Field label="Layout variant" htmlFor="hero-variant" hint={VARIANT_HELPS[variant]}>
          <Select
            id="hero-variant"
            value={variant}
            onChange={(e) => setVariant(e.target.value as HeroData["variant"])}
          >
            {HERO_VARIANTS.map((v) => (
              <option key={v} value={v}>
                {VARIANT_LABELS[v]}
              </option>
            ))}
          </Select>
        </Field>
      </FormSection>

      <FormSection title="Content">
        <div className="space-y-5">
          <Field
            label={
              <>
                Headline
                <Req />
              </>
            }
            htmlFor="hero-headline"
          >
            <TextInput
              id="hero-headline"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="All your creatives, one subscription."
              maxLength={200}
            />
          </Field>

          <Field label="Subhead" htmlFor="hero-subhead">
            <TextArea
              id="hero-subhead"
              value={subhead}
              onChange={(e) => setSubhead(e.target.value)}
              placeholder="Optional supporting paragraph below the headline."
              rows={2}
              maxLength={500}
            />
          </Field>
        </div>
      </FormSection>

      <FormSection
        title="Buttons"
        description="A label without a destination can't be saved. Leave both blank to hide a button."
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Primary CTA label" htmlFor="hero-cta-label">
              <TextInput
                id="hero-cta-label"
                value={ctaLabel}
                onChange={(e) => setCtaLabel(e.target.value)}
                placeholder="Get Started"
                maxLength={50}
              />
            </Field>
            <Field
              label="Primary CTA destination"
              htmlFor="hero-cta-href"
              hint={
                <>
                  Internal path like <Code>/login</Code> or full URL starting with{" "}
                  <Code>https://</Code>.
                </>
              }
            >
              <TextInput
                id="hero-cta-href"
                value={ctaHref}
                onChange={(e) => setCtaHref(e.target.value)}
                placeholder="/login"
                maxLength={200}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Secondary CTA label (optional)" htmlFor="hero-secondary-label">
              <TextInput
                id="hero-secondary-label"
                value={secondaryCtaLabel}
                onChange={(e) => setSecondaryCtaLabel(e.target.value)}
                placeholder="See the showcase"
                maxLength={50}
              />
            </Field>
            <Field label="Secondary CTA destination" htmlFor="hero-secondary-href">
              <TextInput
                id="hero-secondary-href"
                value={secondaryCtaHref}
                onChange={(e) => setSecondaryCtaHref(e.target.value)}
                placeholder="/showcase"
                maxLength={200}
              />
            </Field>
          </div>
        </div>
      </FormSection>

      {/* Hero image (only shown for variants that use one) ------------ */}
      {variantNeedsImage ? (
        <FormSection
          title="Media"
          description="For full-bleed, use a high-resolution image (≥1600px wide). The renderer adds a dark gradient overlay so light photos stay legible."
        >
          <CmsImageUpload
            type="page-block"
            value={image}
            onChange={setImage}
            label="Hero image"
            aspectRatio={variant === "full-bleed" ? "21/9" : "4/3"}
          />
        </FormSection>
      ) : null}

      <BlockSaveFooter error={error} dirty={dirty} submitting={submitting} label="Save hero" />
    </form>
  );
}
