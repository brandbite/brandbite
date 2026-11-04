// -----------------------------------------------------------------------------
// @file: components/blocks/admin/FeatureGridBlockForm.tsx
// @purpose: Admin form for editing the FEATURE_GRID block. Title +
//           subtitle + 1-12 items (each with title + optional body +
//           optional emoji) + optional supporting image + optional CTA
//           pair. Saves via PUT /api/admin/page-blocks/[pageKey]/FEATURE_GRID.
//
//           Cap of 12 items mirrors the Zod schema. Past that the visual
//           grid breaks down; below 1 there's nothing to render. The CTA
//           pair is enforced both client-side (clear message) and server-
//           side (Zod superRefine).
// -----------------------------------------------------------------------------
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-04-30
// -----------------------------------------------------------------------------

"use client";

import { useState } from "react";

import { Field, TextArea, TextInput } from "@/components/admin/v2/ui";
import { CmsImageUpload } from "@/components/ui/cms-image-upload";
import { useToast } from "@/components/ui/toast-provider";

import {
  AddButton,
  BlockSaveFooter,
  Code,
  FormSection,
  RepeaterItem,
  ReorderActions,
  Req,
  useDirtyBaseline,
} from "./block-form-ui";

import type { FeatureGridData } from "@/lib/blocks/types";

type FeatureGridBlockFormProps = {
  /** Initial values — DB row's data when present, defaults otherwise. */
  initial: FeatureGridData;
  /** Page key the block belongs to (e.g. "home"). */
  pageKey: string;
};

const MIN_ITEMS = 1;
const MAX_ITEMS = 12;

type ItemDraft = { title: string; body: string; emoji: string };

export function FeatureGridBlockForm({ initial, pageKey }: FeatureGridBlockFormProps) {
  const { showToast } = useToast();

  const [title, setTitle] = useState<string>(initial.title ?? "");
  const [subtitle, setSubtitle] = useState<string>(initial.subtitle ?? "");
  const [items, setItems] = useState<ItemDraft[]>(
    initial.items.map((i) => ({
      title: i.title,
      body: i.body ?? "",
      emoji: i.emoji ?? "",
    })),
  );
  const [image, setImage] = useState<{ storageKey: string; url: string } | null>(
    initial.image?.storageKey && initial.image?.url
      ? { storageKey: initial.image.storageKey, url: initial.image.url }
      : null,
  );
  const [ctaLabel, setCtaLabel] = useState<string>(initial.ctaLabel ?? "");
  const [ctaHref, setCtaHref] = useState<string>(initial.ctaHref ?? "");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Presentation only: drives the SaveBar status + disables Save when clean.
  const { dirty, markSaved } = useDirtyBaseline(
    JSON.stringify([title, subtitle, items, image, ctaLabel, ctaHref]),
  );

  const updateItem = (idx: number, patch: Partial<ItemDraft>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const addItem = () => {
    if (items.length >= MAX_ITEMS) return;
    setItems((prev) => [...prev, { title: "", body: "", emoji: "" }]);
  };

  const removeItem = (idx: number) => {
    if (items.length <= MIN_ITEMS) return;
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveItem = (idx: number, direction: -1 | 1) => {
    const target = idx + direction;
    if (target < 0 || target >= items.length) return;
    setItems((prev) => {
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

    if (items.length < MIN_ITEMS) {
      setError("At least one item is required.");
      return;
    }
    for (let i = 0; i < items.length; i++) {
      if (!items[i].title.trim()) {
        setError(`Item ${i + 1} needs a title.`);
        return;
      }
    }

    // CTA pair check (matches the schema's superRefine).
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
      const data: FeatureGridData = {
        ...(title.trim() ? { title: title.trim() } : {}),
        ...(subtitle.trim() ? { subtitle: subtitle.trim() } : {}),
        items: items.map((it) => ({
          title: it.title.trim(),
          ...(it.body.trim() ? { body: it.body.trim() } : {}),
          ...(it.emoji.trim() ? { emoji: it.emoji.trim() } : {}),
        })),
        ...(image ? { image: { storageKey: image.storageKey, url: image.url } } : {}),
        ...(trimmedLabel ? { ctaLabel: trimmedLabel } : {}),
        ...(trimmedHref ? { ctaHref: trimmedHref } : {}),
      };

      const res = await fetch(`/api/admin/page-blocks/${pageKey}/FEATURE_GRID`, {
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
        title: "Feature grid saved",
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
      <FormSection title="Section heading" description="Both optional.">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Section title (optional)" htmlFor="fg-title">
            <TextInput
              id="fg-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Why brandbite"
              maxLength={120}
            />
          </Field>
          <Field label="Subtitle (optional)" htmlFor="fg-subtitle">
            <TextInput
              id="fg-subtitle"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Why brands choose brandbite over freelancers."
              maxLength={300}
            />
          </Field>
        </div>
      </FormSection>

      {/* Items list --------------------------------------------------- */}
      <FormSection
        title="Items"
        count={`${items.length} / ${MAX_ITEMS}`}
        description="Items without an emoji render with a brand-colour check icon."
        action={
          <AddButton onClick={addItem} disabled={items.length >= MAX_ITEMS}>
            Add item
          </AddButton>
        }
      >
        <div className="space-y-3">
          {items.map((item, idx) => (
            <RepeaterItem
              key={idx}
              label={`Item ${idx + 1}`}
              actions={
                <ReorderActions
                  noun={`item ${idx + 1}`}
                  index={idx}
                  count={items.length}
                  onMove={(d) => moveItem(idx, d)}
                  onRemove={() => removeItem(idx)}
                  removeDisabled={items.length <= MIN_ITEMS}
                />
              }
            >
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[88px_1fr]">
                  <Field label="Emoji" htmlFor={`fg-item-emoji-${idx}`}>
                    <TextInput
                      id={`fg-item-emoji-${idx}`}
                      value={item.emoji}
                      onChange={(e) => updateItem(idx, { emoji: e.target.value })}
                      placeholder="⚡"
                      maxLength={8}
                    />
                  </Field>
                  <Field
                    label={
                      <>
                        Title
                        <Req />
                      </>
                    }
                    htmlFor={`fg-item-title-${idx}`}
                  >
                    <TextInput
                      id={`fg-item-title-${idx}`}
                      value={item.title}
                      onChange={(e) => updateItem(idx, { title: e.target.value })}
                      placeholder="Fast turnaround (1 to 2 days per request)"
                      maxLength={120}
                    />
                  </Field>
                </div>
                <Field label="Body (optional)" htmlFor={`fg-item-body-${idx}`}>
                  <TextArea
                    id={`fg-item-body-${idx}`}
                    value={item.body}
                    onChange={(e) => updateItem(idx, { body: e.target.value })}
                    placeholder="Optional supporting paragraph."
                    rows={2}
                    maxLength={400}
                    className="min-h-20"
                  />
                </Field>
              </div>
            </RepeaterItem>
          ))}
        </div>
      </FormSection>

      {/* Optional supporting image ------------------------------------ */}
      <FormSection
        title="Media"
        description="When set, the section renders 2-column with this image on the left and the items on the right. Leave blank for a centered single-column layout."
      >
        <CmsImageUpload
          type="page-block"
          value={image}
          onChange={setImage}
          label="Side image (optional)"
          aspectRatio="4/3"
        />
      </FormSection>

      {/* CTA pair (optional) ------------------------------------------ */}
      <FormSection
        title="Button"
        description="Clear both label and destination to hide the button."
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="CTA label (optional)" htmlFor="fg-cta-label">
            <TextInput
              id="fg-cta-label"
              value={ctaLabel}
              onChange={(e) => setCtaLabel(e.target.value)}
              placeholder="Explore Pricing"
              maxLength={50}
            />
          </Field>
          <Field
            label="CTA destination (optional)"
            htmlFor="fg-cta-href"
            hint={
              <>
                Anchor like <Code>#pricing</Code>, internal path like <Code>/pricing</Code>, or full
                URL.
              </>
            }
          >
            <TextInput
              id="fg-cta-href"
              value={ctaHref}
              onChange={(e) => setCtaHref(e.target.value)}
              placeholder="#pricing"
              maxLength={200}
            />
          </Field>
        </div>
      </FormSection>

      <BlockSaveFooter
        error={error}
        dirty={dirty}
        submitting={submitting}
        label="Save feature grid"
      />
    </form>
  );
}
