// @file: app/admin/pages/page.tsx
// @purpose: Admin CMS page editor for single pages (About, Contact, Documentation)

"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormInput, FormTextarea } from "@/components/ui/form-field";
import { LoadingState } from "@/components/ui/loading-state";
import { useToast } from "@/components/ui/toast-provider";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { CmsImageUpload } from "@/components/ui/cms-image-upload";

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

type CmsPage = {
  id: string;
  pageKey: string;
  title: string;
  subtitle: string | null;
  heroStorageKey: string | null;
  heroUrl: string | null;
  body: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  updatedAt: string;
};

type ImageValue = { storageKey: string; url: string } | null;

const PAGE_LABELS: Record<string, string> = {
  about: "About",
  contact: "Contact",
  documentation: "Documentation",
};

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function AdminPagesPage() {
  const { showToast } = useToast();

  const [pages, setPages] = useState<CmsPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // Form fields
  const [formTitle, setFormTitle] = useState("");
  const [formSubtitle, setFormSubtitle] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formHeroImage, setFormHeroImage] = useState<ImageValue>(null);
  const [formMetaTitle, setFormMetaTitle] = useState("");
  const [formMetaDescription, setFormMetaDescription] = useState("");
  const [saving, setSaving] = useState(false);

  // --------------------------------------------------------------------------
  //  Fetch all pages
  // --------------------------------------------------------------------------

  const fetchPages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/pages", { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Failed to load pages.");
      const data = (json?.pages ?? []) as CmsPage[];
      setPages(data);
      // Auto-select first page if none selected
      if (!selectedKey && data.length > 0) {
        setSelectedKey(data[0].pageKey);
        loadFormFromPage(data[0]);
      }
    } catch (err: any) {
      showToast({ type: "error", title: err?.message || "Failed to load pages." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  // --------------------------------------------------------------------------
  //  Load form from page data
  // --------------------------------------------------------------------------

  function loadFormFromPage(page: CmsPage) {
    setFormTitle(page.title);
    setFormSubtitle(page.subtitle ?? "");
    setFormBody(page.body ?? "");
    setFormHeroImage(
      page.heroStorageKey && page.heroUrl
        ? { storageKey: page.heroStorageKey, url: page.heroUrl }
        : null,
    );
    setFormMetaTitle(page.metaTitle ?? "");
    setFormMetaDescription(page.metaDescription ?? "");
  }

  function selectPage(key: string) {
    setSelectedKey(key);
    const page = pages.find((p) => p.pageKey === key);
    if (page) loadFormFromPage(page);
  }

  // --------------------------------------------------------------------------
  //  Save
  // --------------------------------------------------------------------------

  const handleSave = async () => {
    if (!selectedKey) return;
    if (!formTitle.trim()) {
      showToast({ type: "error", title: "Title is required." });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: formTitle.trim(),
        subtitle: formSubtitle.trim() || null,
        body: formBody || null,
        heroStorageKey: formHeroImage?.storageKey ?? null,
        heroUrl: formHeroImage?.url ?? null,
        metaTitle: formMetaTitle.trim() || null,
        metaDescription: formMetaDescription.trim() || null,
      };

      const res = await fetch(`/api/admin/pages/${selectedKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Failed to save page.");

      showToast({
        type: "success",
        title: `${PAGE_LABELS[selectedKey] ?? selectedKey} page saved.`,
      });
      await fetchPages();
    } catch (err: any) {
      showToast({ type: "error", title: err?.message || "Failed to save page." });
    } finally {
      setSaving(false);
    }
  };

  // --------------------------------------------------------------------------
  //  Render
  // --------------------------------------------------------------------------

  const selectedPage = pages.find((p) => p.pageKey === selectedKey);

  return (
    <>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Pages</h1>
        <p className="mt-1 text-sm text-[var(--bb-text-secondary)]">
          Edit content for static marketing pages.
        </p>
      </div>

      {loading ? (
        <LoadingState message="Loading pages..." />
      ) : pages.length === 0 ? (
        <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-10 text-center">
          <p className="text-sm text-[var(--bb-text-secondary)]">
            No CMS pages found. Pages will appear here once they are seeded in the database.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_1fr]">
          {/* Left sidebar — page list */}
          <div className="space-y-1">
            {pages.map((page) => (
              <button
                key={page.pageKey}
                type="button"
                onClick={() => selectPage(page.pageKey)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                  selectedKey === page.pageKey
                    ? "bg-[var(--bb-primary-light)] text-[var(--bb-primary)]"
                    : "text-[var(--bb-text-secondary)] hover:bg-[var(--bb-bg-warm)]"
                }`}
              >
                {PAGE_LABELS[page.pageKey] ?? page.pageKey}
              </button>
            ))}
          </div>

          {/* Right panel — edit form */}
          {selectedPage && (
            <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] p-6 shadow-sm">
              <div className="space-y-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-[var(--bb-secondary)]">
                    Title <span className="text-[var(--bb-danger-text)]">*</span>
                  </label>
                  <FormInput
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Page title"
                    required
                    className="text-lg font-semibold"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-[var(--bb-secondary)]">Subtitle</label>
                  <FormInput
                    type="text"
                    value={formSubtitle}
                    onChange={(e) => setFormSubtitle(e.target.value)}
                    placeholder="Optional subtitle"
                  />
                </div>

                <CmsImageUpload
                  type="blog"
                  value={formHeroImage}
                  onChange={setFormHeroImage}
                  label="Hero Image"
                  aspectRatio="16/9"
                />

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-[var(--bb-secondary)]">
                    Page Content
                  </label>
                  <RichTextEditor
                    value={formBody}
                    onChange={setFormBody}
                    placeholder="Write page content..."
                    minHeight="300px"
                    enableHeadings
                  />
                </div>

                {/* SEO section */}
                <div className="space-y-3 rounded-xl border border-[var(--bb-border-subtle)] bg-[var(--bb-bg-warm)] px-4 py-3">
                  <p className="text-xs font-semibold tracking-[0.08em] text-[var(--bb-text-tertiary)] uppercase">
                    SEO
                  </p>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-[var(--bb-secondary)]">
                      Meta Title
                    </label>
                    <FormInput
                      type="text"
                      value={formMetaTitle}
                      onChange={(e) => setFormMetaTitle(e.target.value)}
                      placeholder="SEO title"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-[var(--bb-secondary)]">
                      Meta Description
                    </label>
                    <FormTextarea
                      value={formMetaDescription}
                      onChange={(e) => setFormMetaDescription(e.target.value)}
                      rows={2}
                      placeholder="SEO description..."
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    onClick={handleSave}
                    loading={saving}
                    loadingText="Saving..."
                    disabled={saving}
                  >
                    Save Page
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
