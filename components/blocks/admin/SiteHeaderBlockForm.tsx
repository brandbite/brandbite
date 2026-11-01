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

import { TextInput } from "@/components/admin/v2/ui";
import { useToast } from "@/components/ui/toast-provider";

import {
  AddButton,
  BlockSaveFooter,
  FormSection,
  LinkList,
  LinkRow,
  ReorderActions,
  useDirtyBaseline,
} from "./block-form-ui";

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

  // Presentation only: drives the SaveBar status + disables Save when clean.
  const { dirty, markSaved } = useDirtyBaseline(JSON.stringify(navLinks));

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

      markSaved();
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
      <FormSection
        title="Navigation links"
        count={`${navLinks.length} / ${MAX_LINKS}`}
        description="Label and destination are required for every link."
        action={
          <AddButton onClick={addLink} disabled={navLinks.length >= MAX_LINKS}>
            Add link
          </AddButton>
        }
      >
        <LinkList>
          {navLinks.map((link, idx) => (
            <LinkRow
              key={idx}
              actions={
                <ReorderActions
                  noun={`link ${idx + 1}`}
                  index={idx}
                  count={navLinks.length}
                  onMove={(d) => moveLink(idx, d)}
                  onRemove={() => removeLink(idx)}
                  removeDisabled={navLinks.length <= MIN_LINKS}
                />
              }
            >
              <TextInput
                id={`hdr-label-${idx}`}
                aria-label={`Link ${idx + 1} label`}
                value={link.label}
                onChange={(e) => updateLink(idx, { label: e.target.value })}
                placeholder="How it works?"
                maxLength={40}
              />
              <TextInput
                id={`hdr-href-${idx}`}
                aria-label={`Link ${idx + 1} destination`}
                value={link.href}
                onChange={(e) => updateLink(idx, { href: e.target.value })}
                placeholder="/how-it-works"
                maxLength={200}
              />
            </LinkRow>
          ))}
        </LinkList>
      </FormSection>

      <BlockSaveFooter error={error} dirty={dirty} submitting={submitting} label="Save header" />
    </form>
  );
}
