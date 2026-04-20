// @file: app/admin/showcase/page.tsx
// @purpose: Admin CMS page for managing showcase portfolio works

"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormInput, FormTextarea, FormSelect } from "@/components/ui/form-field";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast-provider";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { CmsImageUpload } from "@/components/ui/cms-image-upload";
import { CmsGalleryUpload } from "@/components/ui/cms-gallery-upload";

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

type ImageRef = { storageKey: string; url: string };
type GalleryImage = { storageKey: string; url: string; alt?: string };

type ShowcaseWork = {
  id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  clientName: string | null;
  category: string | null;
  tags: string[];
  thumbnailStorageKey: string | null;
  thumbnailUrl: string | null;
  heroStorageKey: string | null;
  heroUrl: string | null;
  galleryImages: GalleryImage[] | null;
  description: string | null;
  status: "PUBLISHED" | "DRAFT";
  publishedAt: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

type ShowcaseListResponse = {
  works: ShowcaseWork[];
};

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function generateSlugFromTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleDateString();
}

/* -------------------------------------------------------------------------- */
/*  Page Component                                                             */
/* -------------------------------------------------------------------------- */

export default function AdminShowcasePage() {
  const { showToast } = useToast();

  // ---- List state ----
  const [data, setData] = useState<ShowcaseListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---- Filters ----
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PUBLISHED" | "DRAFT">("ALL");

  // ---- Selection / editing ----
  const [selected, setSelected] = useState<ShowcaseWork | null>(null);

  // ---- Form fields ----
  const [formTitle, setFormTitle] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formSubtitle, setFormSubtitle] = useState("");
  const [formClientName, setFormClientName] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formTags, setFormTags] = useState("");
  const [formThumbnail, setFormThumbnail] = useState<ImageRef | null>(null);
  const [formHero, setFormHero] = useState<ImageRef | null>(null);
  const [formGallery, setFormGallery] = useState<GalleryImage[]>([]);
  const [formDescription, setFormDescription] = useState("");
  const [formPublished, setFormPublished] = useState(false);
  const [formSortOrder, setFormSortOrder] = useState("0");

  // ---- Mutation state ----
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  /* ---------------------------------------------------------------------- */
  /*  Derived data                                                           */
  /* ---------------------------------------------------------------------- */

  const works = data?.works ?? [];

  const filteredWorks = useMemo(() => {
    return works.filter((w) => {
      // Status filter
      if (statusFilter === "PUBLISHED" && w.status !== "PUBLISHED") return false;
      if (statusFilter === "DRAFT" && w.status !== "DRAFT") return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const titleMatch = w.title.toLowerCase().includes(q);
        const clientMatch = w.clientName?.toLowerCase().includes(q) ?? false;
        const categoryMatch = w.category?.toLowerCase().includes(q) ?? false;
        if (!titleMatch && !clientMatch && !categoryMatch) return false;
      }

      return true;
    });
  }, [works, statusFilter, searchQuery]);

  const totalCount = works.length;
  const publishedCount = works.filter((w) => w.status === "PUBLISHED").length;
  const draftCount = totalCount - publishedCount;

  /* ---------------------------------------------------------------------- */
  /*  Form helpers                                                           */
  /* ---------------------------------------------------------------------- */

  const resetForm = () => {
    setSelected(null);
    setFormTitle("");
    setFormSlug("");
    setFormSubtitle("");
    setFormClientName("");
    setFormCategory("");
    setFormTags("");
    setFormThumbnail(null);
    setFormHero(null);
    setFormGallery([]);
    setFormDescription("");
    setFormPublished(false);
    setFormSortOrder("0");
  };

  const fillFormFromWork = (work: ShowcaseWork) => {
    setSelected(work);
    setFormTitle(work.title);
    setFormSlug(work.slug);
    setFormSubtitle(work.subtitle ?? "");
    setFormClientName(work.clientName ?? "");
    setFormCategory(work.category ?? "");
    setFormTags(work.tags.join(", "));
    setFormThumbnail(
      work.thumbnailStorageKey && work.thumbnailUrl
        ? { storageKey: work.thumbnailStorageKey, url: work.thumbnailUrl }
        : null,
    );
    setFormHero(
      work.heroStorageKey && work.heroUrl
        ? { storageKey: work.heroStorageKey, url: work.heroUrl }
        : null,
    );
    setFormGallery((work.galleryImages as GalleryImage[]) ?? []);
    setFormDescription(work.description ?? "");
    setFormPublished(work.status === "PUBLISHED");
    setFormSortOrder(String(work.sortOrder));
  };

  /* ---------------------------------------------------------------------- */
  /*  API: Fetch list                                                        */
  /* ---------------------------------------------------------------------- */

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/showcase", { cache: "no-store" });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("You must be signed in as an admin to view this page.");
        }
        if (res.status === 403) {
          throw new Error("You do not have permission to manage showcase works.");
        }
        throw new Error(json?.error || `Request failed with status ${res.status}`);
      }

      setData(json as ShowcaseListResponse);
    } catch (err: any) {
      console.error("[AdminShowcasePage] fetch error:", err);
      setError(err?.message || "Failed to load showcase works.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      await load();
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ---------------------------------------------------------------------- */
  /*  API: Save (Create / Update)                                            */
  /* ---------------------------------------------------------------------- */

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const tags = formTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const payload: Record<string, unknown> = {
        title: formTitle.trim(),
        slug: formSlug.trim() || undefined,
        subtitle: formSubtitle.trim() || null,
        clientName: formClientName.trim() || null,
        category: formCategory.trim() || null,
        tags,
        thumbnailStorageKey: formThumbnail?.storageKey ?? null,
        thumbnailUrl: formThumbnail?.url ?? null,
        heroStorageKey: formHero?.storageKey ?? null,
        heroUrl: formHero?.url ?? null,
        galleryImages: formGallery.length > 0 ? formGallery : null,
        description: formDescription || null,
        status: formPublished ? "PUBLISHED" : "DRAFT",
        sortOrder: parseInt(formSortOrder, 10) || 0,
      };

      const isEditing = !!selected;

      const url = isEditing ? `/api/admin/showcase/${selected.id}` : "/api/admin/showcase";

      const res = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || `Request failed with status ${res.status}`);
      }

      const msg = isEditing
        ? "Showcase work updated successfully."
        : "Showcase work created successfully.";
      showToast({ type: "success", title: msg });

      await load();

      if (!isEditing) {
        resetForm();
      } else if (json?.work) {
        // Re-select the updated work so the form stays populated
        fillFormFromWork(json.work as ShowcaseWork);
      }
    } catch (err: any) {
      console.error("[AdminShowcasePage] save error:", err);
      const errMsg = err?.message || "Failed to save showcase work.";
      showToast({ type: "error", title: errMsg });
    } finally {
      setSaving(false);
    }
  };

  /* ---------------------------------------------------------------------- */
  /*  API: Delete                                                            */
  /* ---------------------------------------------------------------------- */

  const handleDelete = async () => {
    if (!selected) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${selected.title}"? This action cannot be undone.`,
    );
    if (!confirmed) return;

    setDeleting(true);

    try {
      const res = await fetch(`/api/admin/showcase/${selected.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || `Delete failed with status ${res.status}`);
      }

      showToast({ type: "success", title: "Showcase work deleted." });
      resetForm();
      await load();
    } catch (err: any) {
      console.error("[AdminShowcasePage] delete error:", err);
      showToast({ type: "error", title: err?.message || "Failed to delete." });
    } finally {
      setDeleting(false);
    }
  };

  /* ---------------------------------------------------------------------- */
  /*  Event handlers                                                         */
  /* ---------------------------------------------------------------------- */

  const handleRowClick = (work: ShowcaseWork) => {
    fillFormFromWork(work);
  };

  const handleNewClick = () => {
    resetForm();
  };

  /* ---------------------------------------------------------------------- */
  /*  Render                                                                 */
  /* ---------------------------------------------------------------------- */

  return (
    <>
      {/* Page header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4 px-6 pt-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Showcase Works</h1>
          <p className="mt-1 text-sm text-[var(--bb-text-secondary)]">
            Manage your portfolio showcase items. Create, edit, and publish works.
          </p>
        </div>
        <Button onClick={handleNewClick}>New Work</Button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-6 mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Summary cards */}
      <section className="mb-6 grid gap-4 px-6 md:grid-cols-3">
        <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-4 shadow-sm">
          <p className="text-xs font-medium tracking-[0.12em] text-[var(--bb-text-muted)] uppercase">
            Total
          </p>
          <p className="mt-2 text-3xl font-semibold text-[var(--bb-secondary)]">
            {loading ? "\u2014" : totalCount}
          </p>
          <p className="mt-1 text-xs text-[var(--bb-text-muted)]">All showcase works.</p>
        </div>
        <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-4 shadow-sm">
          <p className="text-xs font-medium tracking-[0.12em] text-[var(--bb-text-muted)] uppercase">
            Published
          </p>
          <p className="mt-2 text-2xl font-semibold text-[var(--bb-secondary)]">
            {loading ? "\u2014" : publishedCount}
          </p>
          <p className="mt-1 text-xs text-[var(--bb-text-muted)]">
            Visible on the public showcase.
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-4 shadow-sm">
          <p className="text-xs font-medium tracking-[0.12em] text-[var(--bb-text-muted)] uppercase">
            Draft
          </p>
          <p className="mt-2 text-2xl font-semibold text-[var(--bb-secondary)]">
            {loading ? "\u2014" : draftCount}
          </p>
          <p className="mt-1 text-xs text-[var(--bb-text-muted)]">Unpublished works in progress.</p>
        </div>
      </section>

      {/* Split-view grid: list + form */}
      <section className="grid grid-cols-1 gap-6 px-6 pb-6 xl:grid-cols-[3fr_2fr]">
        {/* ---------------------------------------------------------------- */}
        {/*  Left Panel: List                                                 */}
        {/* ---------------------------------------------------------------- */}
        <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-4 py-4 shadow-sm">
          {/* Search bar */}
          <div className="mb-3">
            <div className="relative">
              <svg
                className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--bb-text-muted)]"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                />
              </svg>
              <input
                type="text"
                placeholder="Search by title, client, or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-[var(--bb-border)] bg-[var(--bb-bg-page)] py-2 pr-3 pl-10 text-sm text-[var(--bb-secondary)] transition-colors outline-none placeholder:text-[var(--bb-text-muted)] focus:border-[var(--bb-primary)] focus:ring-1 focus:ring-[var(--bb-primary)]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-[var(--bb-text-muted)] hover:text-[var(--bb-secondary)]"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Filters row */}
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-tight">Works</h2>
              <Badge variant="info">{filteredWorks.length}</Badge>
              <FormSelect
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "ALL" | "PUBLISHED" | "DRAFT")}
                size="sm"
                className="w-auto"
              >
                <option value="ALL">All status</option>
                <option value="PUBLISHED">Published</option>
                <option value="DRAFT">Draft</option>
              </FormSelect>
            </div>
            <p className="text-xs text-[var(--bb-text-muted)]">
              Showing {filteredWorks.length} of {totalCount}
            </p>
          </div>

          {/* Table */}
          {loading ? (
            <LoadingState message="Loading showcase works..." />
          ) : filteredWorks.length === 0 ? (
            <EmptyState
              title={searchQuery ? "No works match your search." : "No showcase works found."}
            />
          ) : (
            <div className="max-h-[520px] overflow-x-auto overflow-y-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--bb-border)] text-xs tracking-[0.08em] text-[var(--bb-text-muted)] uppercase">
                    <th className="w-[40px] px-2 py-2" />
                    <th className="px-2 py-2">Title</th>
                    <th className="px-2 py-2">Client</th>
                    <th className="px-2 py-2">Category</th>
                    <th className="px-2 py-2 text-center">Status</th>
                    <th className="px-2 py-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWorks.map((work) => (
                    <tr
                      key={work.id}
                      onClick={() => handleRowClick(work)}
                      className={`cursor-pointer border-b border-[var(--bb-border-subtle)] text-xs transition-colors last:border-b-0 ${
                        selected?.id === work.id
                          ? "border-l-2 border-l-[var(--bb-primary)] bg-[var(--bb-bg-warm)]"
                          : "bg-[var(--bb-bg-page)] hover:bg-[var(--bb-bg-warm)]"
                      }`}
                    >
                      {/* Thumbnail */}
                      <td className="px-2 py-2">
                        {work.thumbnailUrl ? (
                          <img
                            src={work.thumbnailUrl}
                            alt=""
                            className="h-10 w-10 rounded object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded bg-[var(--bb-bg-card)] text-[var(--bb-text-muted)]">
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={1.5}
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z"
                              />
                            </svg>
                          </div>
                        )}
                      </td>

                      {/* Title */}
                      <td className="px-2 py-2 align-top">
                        <div className="font-semibold text-[var(--bb-secondary)]">{work.title}</div>
                        {work.subtitle && (
                          <div className="mt-0.5 line-clamp-1 text-[10px] text-[var(--bb-text-secondary)]">
                            {work.subtitle}
                          </div>
                        )}
                      </td>

                      {/* Client */}
                      <td className="px-2 py-2 align-top text-[var(--bb-text-secondary)]">
                        {work.clientName || "\u2014"}
                      </td>

                      {/* Category */}
                      <td className="px-2 py-2 align-top text-[var(--bb-text-secondary)]">
                        {work.category || "\u2014"}
                      </td>

                      {/* Status */}
                      <td className="px-2 py-2 text-center align-top">
                        <Badge variant={work.status === "PUBLISHED" ? "success" : "neutral"}>
                          {work.status === "PUBLISHED" ? "Published" : "Draft"}
                        </Badge>
                      </td>

                      {/* Date */}
                      <td className="px-2 py-2 align-top text-[var(--bb-text-muted)]">
                        {formatDate(work.updatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/*  Right Panel: Form                                                */}
        {/* ---------------------------------------------------------------- */}
        <div className="self-start rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-4 shadow-sm">
          <h2 className="text-sm font-semibold tracking-tight">
            {selected ? `Edit: ${selected.title}` : "Create work"}
          </h2>
          <p className="mt-1 text-xs text-[var(--bb-text-secondary)]">
            {selected
              ? "Update the fields below and save your changes."
              : "Fill in the details to create a new showcase work."}
          </p>

          <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
            {/* Title */}
            <div className="flex flex-col gap-1">
              <label
                htmlFor="showcase-title"
                className="text-xs font-medium text-[var(--bb-secondary)]"
              >
                Title <span className="text-[var(--bb-primary)]">*</span>
              </label>
              <FormInput
                id="showcase-title"
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                required
                placeholder="e.g. Acme Corp Brand Identity"
              />
            </div>

            {/* Slug */}
            <div className="flex flex-col gap-1">
              <label
                htmlFor="showcase-slug"
                className="text-xs font-medium text-[var(--bb-secondary)]"
              >
                Slug
              </label>
              <FormInput
                id="showcase-slug"
                type="text"
                value={formSlug}
                onChange={(e) => setFormSlug(e.target.value)}
                placeholder={
                  formTitle ? generateSlugFromTitle(formTitle) : "auto-generated-from-title"
                }
              />
              <p className="text-[10px] text-[var(--bb-text-muted)]">
                Leave blank to auto-generate from the title.
              </p>
            </div>

            {/* Subtitle */}
            <div className="flex flex-col gap-1">
              <label
                htmlFor="showcase-subtitle"
                className="text-xs font-medium text-[var(--bb-secondary)]"
              >
                Subtitle
              </label>
              <FormInput
                id="showcase-subtitle"
                type="text"
                value={formSubtitle}
                onChange={(e) => setFormSubtitle(e.target.value)}
                placeholder="e.g. A complete brand overhaul"
              />
            </div>

            {/* Client Name */}
            <div className="flex flex-col gap-1">
              <label
                htmlFor="showcase-client"
                className="text-xs font-medium text-[var(--bb-secondary)]"
              >
                Client name
              </label>
              <FormInput
                id="showcase-client"
                type="text"
                value={formClientName}
                onChange={(e) => setFormClientName(e.target.value)}
                placeholder="e.g. Acme Corp"
              />
            </div>

            {/* Category */}
            <div className="flex flex-col gap-1">
              <label
                htmlFor="showcase-category"
                className="text-xs font-medium text-[var(--bb-secondary)]"
              >
                Category
              </label>
              <FormInput
                id="showcase-category"
                type="text"
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                placeholder="e.g. Brand Identity, Web Design"
              />
            </div>

            {/* Tags */}
            <div className="flex flex-col gap-1">
              <label
                htmlFor="showcase-tags"
                className="text-xs font-medium text-[var(--bb-secondary)]"
              >
                Tags
              </label>
              <FormInput
                id="showcase-tags"
                type="text"
                value={formTags}
                onChange={(e) => setFormTags(e.target.value)}
                placeholder="e.g. branding, logo, identity"
              />
              <p className="text-[10px] text-[var(--bb-text-muted)]">
                Comma-separated list of tags.
              </p>
            </div>

            {/* Thumbnail */}
            <div className="flex flex-col gap-1">
              <CmsImageUpload
                type="showcase"
                value={formThumbnail}
                onChange={setFormThumbnail}
                label="Thumbnail"
                aspectRatio="4/3"
              />
            </div>

            {/* Hero Image */}
            <div className="flex flex-col gap-1">
              <CmsImageUpload
                type="showcase"
                value={formHero}
                onChange={setFormHero}
                label="Hero Image"
                aspectRatio="16/9"
              />
            </div>

            {/* Gallery */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[var(--bb-text-secondary)]">Gallery</label>
              <CmsGalleryUpload value={formGallery} onChange={setFormGallery} />
            </div>

            {/* Description (Rich Text) */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[var(--bb-secondary)]">Description</label>
              <RichTextEditor
                value={formDescription}
                onChange={setFormDescription}
                placeholder="Write a detailed description of this work..."
                minHeight="200px"
                enableHeadings
              />
            </div>

            {/* Published toggle */}
            <label className="flex items-center gap-2 text-xs font-medium text-[var(--bb-secondary)]">
              <input
                type="checkbox"
                checked={formPublished}
                onChange={(e) => setFormPublished(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-[var(--bb-border)] text-[var(--bb-primary)] focus:ring-[var(--bb-primary)]"
              />
              Published
            </label>

            {/* Sort Order */}
            <div className="flex flex-col gap-1">
              <label
                htmlFor="showcase-sort-order"
                className="text-xs font-medium text-[var(--bb-secondary)]"
              >
                Sort Order
              </label>
              <FormInput
                id="showcase-sort-order"
                type="number"
                value={formSortOrder}
                onChange={(e) => setFormSortOrder(e.target.value)}
                placeholder="0"
              />
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-2">
              <Button type="submit" loading={saving} loadingText="Saving...">
                {selected ? "Save changes" : "Create work"}
              </Button>

              {selected && (
                <Button
                  type="button"
                  variant="danger"
                  onClick={handleDelete}
                  loading={deleting}
                  loadingText="Deleting..."
                >
                  Delete
                </Button>
              )}

              <Button type="button" variant="ghost" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </section>
    </>
  );
}
