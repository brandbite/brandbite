// -----------------------------------------------------------------------------
// @file: components/blocks/admin/SiteHeaderBlockForm.tsx
// @purpose: Admin form for the SITE_HEADER block — manages the nav-link
//           list shown between the brand logo and the Sign in button on
//           every marketing page.
//
//           Saves via PUT /api/admin/page-blocks/global/SITE_HEADER.
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

import type { SiteHeaderData } from "@/lib/blocks/types";

type SiteHeaderBlockFormProps = {
  initial: SiteHeaderData;
};

const MIN_LINKS = 1;
const MAX_LINKS = 10;

type LinkDraft = { label: string; href: string };

export function SiteHeaderBlockForm({ initial }: SiteHeaderBlockFormProps) {
  const { showToast } = useToast();

  const [navLinks, setNavLinks] = useState<LinkDraft[]>(
    initial.navLinks.map((l) => ({ label: l.label, href: l.href })),
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateLink = (idx: number, patch: Partial<LinkDraft>) => {
    setNavLinks((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const addLink = () => {
    if (navLinks.length >= MAX_LINKS) return;
    setNavLinks((prev) => [...prev, { label: "", href: "" }]);
  };

  const removeLink = (idx: number) => {
    if (navLinks.length <= MIN_LINKS) return;
    setNavLinks((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveLink = (idx: number, direction: -1 | 1) => {
    const target = idx + direction;
    if (target < 0 || target >= navLinks.length) return;
    setNavLinks((prev) => {
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

    if (navLinks.length < MIN_LINKS) {
      setError("At least one nav link is required.");
      return;
    }
    for (let i = 0; i < navLinks.length; i++) {
      const l = navLinks[i];
      if (!l.label.trim()) {
        setError(`Link ${i + 1} needs a label.`);
        return;
      }
      if (!l.href.trim()) {
        setError(`Link ${i + 1} needs a destination.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const data: SiteHeaderData = {
        navLinks: navLinks.map((l) => ({ label: l.label.trim(), href: l.href.trim() })),
      };

      const res = await fetch(`/api/admin/page-blocks/global/SITE_HEADER`, {
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
        title: "Header saved",
        description: "Reload any marketing page to see your changes.",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--bb-secondary)]">
            Navigation links ({navLinks.length}/{MAX_LINKS})
          </h3>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addLink}
            disabled={navLinks.length >= MAX_LINKS}
          >
            Add link
          </Button>
        </div>

        {navLinks.map((link, idx) => (
          <div
            key={idx}
            className="rounded-xl border border-[var(--bb-border-subtle)] bg-[var(--bb-bg-warm)] px-4 py-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold tracking-[0.12em] text-[var(--bb-text-tertiary)] uppercase">
                Link {idx + 1}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => moveLink(idx, -1)}
                  disabled={idx === 0}
                  aria-label={`Move link ${idx + 1} up`}
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => moveLink(idx, 1)}
                  disabled={idx === navLinks.length - 1}
                  aria-label={`Move link ${idx + 1} down`}
                >
                  ↓
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeLink(idx)}
                  disabled={navLinks.length <= MIN_LINKS}
                  aria-label={`Remove link ${idx + 1}`}
                >
                  Remove
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor={`hdr-label-${idx}`}
                  className="mb-1 block text-xs font-semibold text-[var(--bb-secondary)]"
                >
                  Label <span className="text-[var(--bb-primary)]">*</span>
                </label>
                <FormInput
                  id={`hdr-label-${idx}`}
                  value={link.label}
                  onChange={(e) => updateLink(idx, { label: e.target.value })}
                  placeholder="How it works?"
                  maxLength={40}
                />
              </div>
              <div>
                <label
                  htmlFor={`hdr-href-${idx}`}
                  className="mb-1 block text-xs font-semibold text-[var(--bb-secondary)]"
                >
                  Destination <span className="text-[var(--bb-primary)]">*</span>
                </label>
                <FormInput
                  id={`hdr-href-${idx}`}
                  value={link.href}
                  onChange={(e) => updateLink(idx, { href: e.target.value })}
                  placeholder="/how-it-works"
                  maxLength={200}
                />
              </div>
            </div>
          </div>
        ))}
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
          Save header
        </Button>
      </div>
    </form>
  );
}
