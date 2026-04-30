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

import { Button } from "@/components/ui/button";
import { CmsImageUpload } from "@/components/ui/cms-image-upload";
import { FormInput } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { useToast } from "@/components/ui/toast-provider";

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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="fg-title"
            className="mb-1 block text-xs font-semibold text-[var(--bb-secondary)]"
          >
            Section title (optional)
          </label>
          <FormInput
            id="fg-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Why Brandbite"
            maxLength={120}
          />
        </div>
        <div>
          <label
            htmlFor="fg-subtitle"
            className="mb-1 block text-xs font-semibold text-[var(--bb-secondary)]"
          >
            Subtitle (optional)
          </label>
          <FormInput
            id="fg-subtitle"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="Why brands choose Brandbite over freelancers."
            maxLength={300}
          />
        </div>
      </div>

      {/* Items list --------------------------------------------------- */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--bb-secondary)]">
            Items ({items.length}/{MAX_ITEMS})
          </h3>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addItem}
            disabled={items.length >= MAX_ITEMS}
          >
            Add item
          </Button>
        </div>

        {items.map((item, idx) => (
          <div
            key={idx}
            className="rounded-xl border border-[var(--bb-border-subtle)] bg-[var(--bb-bg-warm)] px-4 py-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold tracking-[0.12em] text-[var(--bb-text-tertiary)] uppercase">
                Item {idx + 1}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => moveItem(idx, -1)}
                  disabled={idx === 0}
                  aria-label={`Move item ${idx + 1} up`}
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => moveItem(idx, 1)}
                  disabled={idx === items.length - 1}
                  aria-label={`Move item ${idx + 1} down`}
                >
                  ↓
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeItem(idx)}
                  disabled={items.length <= MIN_ITEMS}
                  aria-label={`Remove item ${idx + 1}`}
                >
                  Remove
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[80px_1fr]">
              <div>
                <label
                  htmlFor={`fg-item-emoji-${idx}`}
                  className="mb-1 block text-xs font-semibold text-[var(--bb-secondary)]"
                >
                  Emoji
                </label>
                <FormInput
                  id={`fg-item-emoji-${idx}`}
                  value={item.emoji}
                  onChange={(e) => updateItem(idx, { emoji: e.target.value })}
                  placeholder="⚡"
                  maxLength={8}
                />
              </div>
              <div>
                <label
                  htmlFor={`fg-item-title-${idx}`}
                  className="mb-1 block text-xs font-semibold text-[var(--bb-secondary)]"
                >
                  Title <span className="text-[var(--bb-primary)]">*</span>
                </label>
                <FormInput
                  id={`fg-item-title-${idx}`}
                  value={item.title}
                  onChange={(e) => updateItem(idx, { title: e.target.value })}
                  placeholder="Fast turnaround (1 to 2 days per request)"
                  maxLength={120}
                />
              </div>
            </div>

            <div className="mt-3">
              <label
                htmlFor={`fg-item-body-${idx}`}
                className="mb-1 block text-xs font-semibold text-[var(--bb-secondary)]"
              >
                Body (optional)
              </label>
              <textarea
                id={`fg-item-body-${idx}`}
                value={item.body}
                onChange={(e) => updateItem(idx, { body: e.target.value })}
                placeholder="Optional supporting paragraph."
                rows={2}
                maxLength={400}
                className="w-full rounded-md border border-[var(--bb-border-input)] bg-[var(--bb-bg-page)] px-3 py-2 text-sm text-[var(--bb-secondary)] outline-none focus:border-[var(--bb-primary)] focus:ring-1 focus:ring-[var(--bb-primary)]"
              />
              <p className="mt-1 text-xs text-[var(--bb-text-muted)]">
                Items without an emoji render with a brand-colour check icon.
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Optional supporting image ------------------------------------ */}
      <div>
        <CmsImageUpload
          type="page-block"
          value={image}
          onChange={setImage}
          label="Side image (optional)"
          aspectRatio="4/3"
        />
        <p className="mt-1 text-xs text-[var(--bb-text-muted)]">
          When set, the section renders 2-column with this image on the left and the items on the
          right. Leave blank for a centered single-column layout.
        </p>
      </div>

      {/* CTA pair (optional) ------------------------------------------ */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="fg-cta-label"
            className="mb-1 block text-xs font-semibold text-[var(--bb-secondary)]"
          >
            CTA label (optional)
          </label>
          <FormInput
            id="fg-cta-label"
            value={ctaLabel}
            onChange={(e) => setCtaLabel(e.target.value)}
            placeholder="Explore Pricing"
            maxLength={50}
          />
          <p className="mt-1 text-xs text-[var(--bb-text-muted)]">
            Clear both label and destination to hide the button.
          </p>
        </div>
        <div>
          <label
            htmlFor="fg-cta-href"
            className="mb-1 block text-xs font-semibold text-[var(--bb-secondary)]"
          >
            CTA destination (optional)
          </label>
          <FormInput
            id="fg-cta-href"
            value={ctaHref}
            onChange={(e) => setCtaHref(e.target.value)}
            placeholder="#pricing"
            maxLength={200}
          />
          <p className="mt-1 text-xs text-[var(--bb-text-muted)]">
            Anchor like <code>#pricing</code>, internal path like <code>/pricing</code>, or full
            URL.
          </p>
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
          Save feature grid
        </Button>
      </div>
    </form>
  );
}
