// @file: app/admin/blog/page.tsx
// @purpose: Admin CMS page for managing blog posts

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormInput, FormTextarea, FormSelect } from "@/components/ui/form-field";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast-provider";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { CmsImageUpload } from "@/components/ui/cms-image-upload";

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

type BlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  authorName: string | null;
  category: string | null;
  tags: string[];
  body: string | null;
  heroStorageKey: string | null;
  heroUrl: string | null;
  thumbnailStorageKey: string | null;
  thumbnailUrl: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  status: "PUBLISHED" | "DRAFT";
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type BlogPostsResponse = {
  posts: BlogPost[];
};

type ImageValue = { storageKey: string; url: string } | null;

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "\u2014";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "\u2014";
  }
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function AdminBlogPage() {
  const { showToast } = useToast();

  // ---- Data state ----
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---- Modal state ----
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);

  // ---- Form field states ----
  const [formTitle, setFormTitle] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formExcerpt, setFormExcerpt] = useState("");
  const [formAuthorName, setFormAuthorName] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formTags, setFormTags] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formMetaTitle, setFormMetaTitle] = useState("");
  const [formMetaDescription, setFormMetaDescription] = useState("");
  const [formStatus, setFormStatus] = useState(false);
  const [formHeroImage, setFormHeroImage] = useState<ImageValue>(null);
  const [formThumbnail, setFormThumbnail] = useState<ImageValue>(null);

  // ---- Action states ----
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ---- Filters ----
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PUBLISHED" | "DRAFT">("ALL");

  // ---- Derived data ----
  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      // Status filter
      if (statusFilter !== "ALL" && post.status !== statusFilter) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const titleMatch = post.title.toLowerCase().includes(q);
        const authorMatch = post.authorName?.toLowerCase().includes(q) ?? false;
        const categoryMatch = post.category?.toLowerCase().includes(q) ?? false;
        if (!titleMatch && !authorMatch && !categoryMatch) return false;
      }

      return true;
    });
  }, [posts, statusFilter, searchQuery]);

  const publishedCount = posts.filter((p) => p.status === "PUBLISHED").length;
  const draftCount = posts.length - publishedCount;

  // --------------------------------------------------------------------------
  //  API: Fetch posts
  // --------------------------------------------------------------------------

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/blog", { cache: "no-store" });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("You must be signed in as an admin to view this page.");
        }
        if (res.status === 403) {
          throw new Error("You do not have permission to manage blog posts.");
        }
        throw new Error(json?.error || `Request failed with status ${res.status}`);
      }

      setPosts((json as BlogPostsResponse).posts);
    } catch (err: any) {
      console.error("[admin/blog] fetch error:", err);
      setError(err?.message || "Failed to load blog posts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // --------------------------------------------------------------------------
  //  Form helpers
  // --------------------------------------------------------------------------

  const clearForm = () => {
    setFormTitle("");
    setFormSlug("");
    setFormExcerpt("");
    setFormAuthorName("");
    setFormCategory("");
    setFormTags("");
    setFormBody("");
    setFormMetaTitle("");
    setFormMetaDescription("");
    setFormStatus(false);
    setFormHeroImage(null);
    setFormThumbnail(null);
  };

  const openCreateModal = () => {
    clearForm();
    setEditingPost(null);
    setModalOpen(true);
  };

  const openEditModal = (post: BlogPost) => {
    setEditingPost(post);
    setFormTitle(post.title);
    setFormSlug(post.slug);
    setFormExcerpt(post.excerpt ?? "");
    setFormAuthorName(post.authorName ?? "");
    setFormCategory(post.category ?? "");
    setFormTags(Array.isArray(post.tags) ? post.tags.join(", ") : "");
    setFormBody(post.body ?? "");
    setFormMetaTitle(post.metaTitle ?? "");
    setFormMetaDescription(post.metaDescription ?? "");
    setFormStatus(post.status === "PUBLISHED");
    setFormHeroImage(
      post.heroStorageKey && post.heroUrl
        ? { storageKey: post.heroStorageKey, url: post.heroUrl }
        : null,
    );
    setFormThumbnail(
      post.thumbnailStorageKey && post.thumbnailUrl
        ? { storageKey: post.thumbnailStorageKey, url: post.thumbnailUrl }
        : null,
    );
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
  };

  // --------------------------------------------------------------------------
  //  API: Save (create / update)
  // --------------------------------------------------------------------------

  const handleSave = async () => {
    if (!formTitle.trim()) {
      showToast({ type: "error", title: "Title is required." });
      return;
    }

    setSaving(true);

    try {
      const payload: Record<string, unknown> = {
        title: formTitle.trim(),
        slug: formSlug.trim() || undefined,
        excerpt: formExcerpt.trim() || null,
        authorName: formAuthorName.trim() || null,
        category: formCategory.trim() || null,
        tags: formTags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        body: formBody || null,
        metaTitle: formMetaTitle.trim() || null,
        metaDescription: formMetaDescription.trim() || null,
        status: formStatus ? "PUBLISHED" : "DRAFT",
        heroStorageKey: formHeroImage?.storageKey ?? null,
        heroUrl: formHeroImage?.url ?? null,
        thumbnailStorageKey: formThumbnail?.storageKey ?? null,
        thumbnailUrl: formThumbnail?.url ?? null,
      };

      const isEditing = !!editingPost;
      const url = isEditing ? `/api/admin/blog/${editingPost!.id}` : "/api/admin/blog";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || `Request failed with status ${res.status}`);
      }

      const msg = isEditing ? "Blog post updated successfully." : "Blog post created successfully.";
      showToast({ type: "success", title: msg });
      await fetchPosts();
      closeModal();
    } catch (err: any) {
      console.error("[admin/blog] save error:", err);
      const errMsg = err?.message || "Failed to save blog post.";
      showToast({ type: "error", title: errMsg });
    } finally {
      setSaving(false);
    }
  };

  // --------------------------------------------------------------------------
  //  API: Delete
  // --------------------------------------------------------------------------

  const handleDelete = async (postId: string) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this blog post? This action cannot be undone.",
      )
    ) {
      return;
    }

    setDeleting(true);

    try {
      const res = await fetch(`/api/admin/blog/${postId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || `Delete failed with status ${res.status}`);
      }

      showToast({ type: "success", title: "Blog post deleted." });
      await fetchPosts();
      if (modalOpen) closeModal();
    } catch (err: any) {
      console.error("[admin/blog] delete error:", err);
      showToast({ type: "error", title: err?.message || "Failed to delete blog post." });
    } finally {
      setDeleting(false);
    }
  };

  // --------------------------------------------------------------------------
  //  Render
  // --------------------------------------------------------------------------

  return (
    <>
      {/* ------ Page header ------ */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Blog Posts</h1>
          <Badge variant="neutral">{posts.length}</Badge>
        </div>
        <Button onClick={openCreateModal}>New Post</Button>
      </div>

      {/* ------ Error banner ------ */}
      {error && (
        <div className="mb-4 rounded-xl border border-[var(--bb-danger-border)] bg-[var(--bb-danger-bg)] px-4 py-3 text-sm text-[var(--bb-danger-text)]">
          {error}
        </div>
      )}

      {/* ------ Summary cards ------ */}
      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-4 shadow-sm">
          <p className="text-xs font-medium tracking-[0.12em] text-[var(--bb-text-tertiary)] uppercase">
            Total
          </p>
          <p className="mt-2 text-3xl font-semibold text-[var(--bb-secondary)]">
            {loading ? "\u2014" : posts.length}
          </p>
          <p className="mt-1 text-xs text-[var(--bb-text-tertiary)]">All blog posts.</p>
        </div>
        <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-4 shadow-sm">
          <p className="text-xs font-medium tracking-[0.12em] text-[var(--bb-text-tertiary)] uppercase">
            Published
          </p>
          <p className="mt-2 text-3xl font-semibold text-[var(--bb-secondary)]">
            {loading ? "\u2014" : publishedCount}
          </p>
          <p className="mt-1 text-xs text-[var(--bb-text-tertiary)]">Live on the website.</p>
        </div>
        <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-4 shadow-sm">
          <p className="text-xs font-medium tracking-[0.12em] text-[var(--bb-text-tertiary)] uppercase">
            Draft
          </p>
          <p className="mt-2 text-3xl font-semibold text-[var(--bb-secondary)]">
            {loading ? "\u2014" : draftCount}
          </p>
          <p className="mt-1 text-xs text-[var(--bb-text-tertiary)]">Unpublished drafts.</p>
        </div>
      </section>

      {/* ------ Action row: search + filter ------ */}
      <section className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm min-w-[200px] flex-1">
          <svg
            className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--bb-text-tertiary)]"
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
            placeholder="Search posts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-[var(--bb-border)] bg-[var(--bb-bg-page)] py-2 pr-3 pl-10 text-sm text-[var(--bb-secondary)] transition-colors outline-none placeholder:text-[var(--bb-text-tertiary)] focus:border-[var(--bb-primary)] focus:ring-1 focus:ring-[var(--bb-primary)]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-[var(--bb-text-tertiary)] hover:text-[var(--bb-secondary)]"
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
        <FormSelect
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "ALL" | "PUBLISHED" | "DRAFT")}
          size="sm"
          className="w-auto"
        >
          <option value="ALL">All Status</option>
          <option value="PUBLISHED">Published</option>
          <option value="DRAFT">Draft</option>
        </FormSelect>
        <p className="text-xs text-[var(--bb-text-tertiary)]">
          Showing {filteredPosts.length} of {posts.length}
        </p>
      </section>

      {/* ------ Data table ------ */}
      <section className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-4 py-4 shadow-sm">
        {loading ? (
          <LoadingState message="Loading blog posts..." />
        ) : filteredPosts.length === 0 ? (
          <EmptyState
            title={
              searchQuery || statusFilter !== "ALL"
                ? "No blog posts match your filters."
                : "No blog posts yet."
            }
            description={
              !searchQuery && statusFilter === "ALL"
                ? "Create your first post to get started."
                : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--bb-border)] text-xs tracking-[0.08em] text-[var(--bb-text-tertiary)] uppercase">
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Author</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2 text-center">Status</th>
                  <th className="px-3 py-2">Published</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPosts.map((post) => (
                  <tr
                    key={post.id}
                    className="border-b border-[var(--bb-border-subtle)] last:border-b-0"
                  >
                    <td className="px-3 py-2.5">
                      <span className="font-semibold text-[var(--bb-secondary)]">{post.title}</span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-[var(--bb-text-secondary)]">
                      {post.authorName || "\u2014"}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-[var(--bb-text-secondary)]">
                      {post.category || "\u2014"}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <Badge variant={post.status === "PUBLISHED" ? "success" : "warning"}>
                        {post.status === "PUBLISHED" ? "Published" : "Draft"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-[var(--bb-text-secondary)]">
                      {formatDate(post.publishedAt)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEditModal(post)}>
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleDelete(post.id)}
                          disabled={deleting}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ================================================================== */}
      {/*  Full-screen modal (create / edit)                                  */}
      {/* ================================================================== */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50"
          onClick={(e) => {
            // Close when clicking the backdrop
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="mx-auto my-8 max-h-[calc(100vh-4rem)] max-w-5xl overflow-y-auto rounded-xl bg-white shadow-2xl">
            {/* Modal header */}
            <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-xl border-b border-[var(--bb-border)] bg-white px-6 py-4">
              <h2 className="text-lg font-semibold text-[var(--bb-secondary)]">
                {editingPost ? "Edit Blog Post" : "New Blog Post"}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--bb-text-muted)] transition-colors hover:bg-[var(--bb-bg-warm)] hover:text-[var(--bb-secondary)]"
                aria-label="Close modal"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal body: two-column grid */}
            <div className="grid grid-cols-1 gap-6 p-6 xl:grid-cols-[3fr_2fr]">
              {/* ---- Left column: content ---- */}
              <div className="space-y-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-[var(--bb-secondary)]">
                    Title <span className="text-[var(--bb-danger-text)]">*</span>
                  </label>
                  <FormInput
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Post title"
                    required
                    className="text-lg font-semibold"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-[var(--bb-secondary)]">Body</label>
                  <RichTextEditor
                    value={formBody}
                    onChange={setFormBody}
                    placeholder="Write your blog post..."
                    minHeight="400px"
                    enableHeadings
                  />
                </div>
              </div>

              {/* ---- Right column: metadata ---- */}
              <div className="space-y-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-[var(--bb-secondary)]">Slug</label>
                  <FormInput
                    type="text"
                    value={formSlug}
                    onChange={(e) => setFormSlug(e.target.value)}
                    placeholder="auto-generated-from-title"
                  />
                  <p className="text-[10px] text-[var(--bb-text-muted)]">
                    Leave blank to auto-generate from title.
                  </p>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-[var(--bb-secondary)]">Excerpt</label>
                  <FormTextarea
                    value={formExcerpt}
                    onChange={(e) => setFormExcerpt(e.target.value)}
                    rows={3}
                    placeholder="Short summary for listing cards..."
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-[var(--bb-secondary)]">
                    Author Name
                  </label>
                  <FormInput
                    type="text"
                    value={formAuthorName}
                    onChange={(e) => setFormAuthorName(e.target.value)}
                    placeholder="Author name"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-[var(--bb-secondary)]">Category</label>
                  <FormInput
                    type="text"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    placeholder="e.g. Design, Marketing"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-[var(--bb-secondary)]">Tags</label>
                  <FormInput
                    type="text"
                    value={formTags}
                    onChange={(e) => setFormTags(e.target.value)}
                    placeholder="design, branding, tips"
                  />
                  <p className="text-[10px] text-[var(--bb-text-muted)]">Comma-separated list.</p>
                </div>

                <CmsImageUpload
                  type="blog"
                  value={formHeroImage}
                  onChange={setFormHeroImage}
                  label="Hero Image"
                  aspectRatio="16/9"
                />

                <CmsImageUpload
                  type="blog"
                  value={formThumbnail}
                  onChange={setFormThumbnail}
                  label="Thumbnail"
                  aspectRatio="4/3"
                />

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
                      placeholder="SEO title (defaults to post title)"
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
                      placeholder="SEO description for search engines..."
                    />
                  </div>
                </div>

                {/* Status checkbox */}
                <label className="flex items-center gap-2 text-xs font-medium text-[var(--bb-secondary)]">
                  <input
                    type="checkbox"
                    checked={formStatus}
                    onChange={(e) => setFormStatus(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-[var(--bb-border-input)] text-[var(--bb-primary)] focus:ring-[var(--bb-primary)]"
                  />
                  Published
                </label>
              </div>
            </div>

            {/* Modal footer */}
            <div className="sticky bottom-0 flex items-center justify-between rounded-b-xl border-t border-[var(--bb-border)] bg-white px-6 py-4">
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleSave}
                  loading={saving}
                  loadingText="Saving..."
                  disabled={saving || deleting}
                >
                  Save
                </Button>
                {editingPost && (
                  <Button
                    variant="danger"
                    onClick={() => handleDelete(editingPost.id)}
                    disabled={saving || deleting}
                    loading={deleting}
                    loadingText="Deleting..."
                  >
                    Delete
                  </Button>
                )}
              </div>
              <Button variant="ghost" onClick={closeModal} disabled={saving || deleting}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
