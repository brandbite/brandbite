// @file: app/admin/docs/page.tsx
// @purpose: Admin CMS page for managing documentation categories & articles

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormInput, FormTextarea, FormSelect } from "@/components/ui/form-field";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast-provider";
import { RichTextEditor } from "@/components/ui/rich-text-editor";

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

type DocCategory = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  icon: string | null;
  audience: "CREATIVE" | "CUSTOMER" | "GENERAL";
  sortOrder: number;
  _count: { articles: number };
  createdAt: string;
  updatedAt: string;
};

type DocArticle = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body: string | null;
  categoryId: string;
  category: { id: string; title: string; slug: string; audience: string };
  authorName: string | null;
  status: "PUBLISHED" | "DRAFT";
  sortOrder: number;
  publishedAt: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  createdAt: string;
  updatedAt: string;
};

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

const AUDIENCE_OPTIONS = [
  { value: "GENERAL", label: "General" },
  { value: "CREATIVE", label: "For Creatives" },
  { value: "CUSTOMER", label: "For Customers" },
];

const AUDIENCE_BADGE: Record<string, string> = {
  GENERAL: "neutral",
  CREATIVE: "info",
  CUSTOMER: "success",
};

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function AdminDocsPage() {
  const { showToast } = useToast();
  const [tab, setTab] = useState<"categories" | "articles">("categories");

  // ---- Categories state --------------------------------------------------

  const [categories, setCategories] = useState<DocCategory[]>([]);
  const [catLoading, setCatLoading] = useState(true);
  const [catError, setCatError] = useState<string | null>(null);
  const [editingCat, setEditingCat] = useState<DocCategory | null>(null);
  const [catTitle, setCatTitle] = useState("");
  const [catDescription, setCatDescription] = useState("");
  const [catIcon, setCatIcon] = useState("");
  const [catAudience, setCatAudience] = useState("GENERAL");
  const [catSortOrder, setCatSortOrder] = useState("0");
  const [catSaving, setCatSaving] = useState(false);

  // ---- Articles state ----------------------------------------------------

  const [articles, setArticles] = useState<DocArticle[]>([]);
  const [artLoading, setArtLoading] = useState(true);
  const [artError, setArtError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingArt, setEditingArt] = useState<DocArticle | null>(null);

  const [formTitle, setFormTitle] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formExcerpt, setFormExcerpt] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formAuthorName, setFormAuthorName] = useState("");
  const [formSortOrder, setFormSortOrder] = useState("0");
  const [formMetaTitle, setFormMetaTitle] = useState("");
  const [formMetaDescription, setFormMetaDescription] = useState("");
  const [formStatus, setFormStatus] = useState(false);
  const [artSaving, setArtSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PUBLISHED" | "DRAFT">("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  const filteredArticles = useMemo(() => {
    return articles.filter((a) => {
      if (statusFilter !== "ALL" && a.status !== statusFilter) return false;
      if (categoryFilter !== "ALL" && a.categoryId !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        if (!a.title.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [articles, statusFilter, categoryFilter, searchQuery]);

  const publishedCount = articles.filter((a) => a.status === "PUBLISHED").length;
  const draftCount = articles.length - publishedCount;

  // ======================================================================
  //  Fetch helpers
  // ======================================================================

  const fetchCategories = useCallback(async () => {
    setCatLoading(true);
    setCatError(null);
    try {
      const res = await fetch("/api/admin/docs/categories", { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Failed to load categories.");
      setCategories(json.categories ?? []);
    } catch (err: any) {
      setCatError(err?.message || "Failed to load categories.");
    } finally {
      setCatLoading(false);
    }
  }, []);

  const fetchArticles = useCallback(async () => {
    setArtLoading(true);
    setArtError(null);
    try {
      const res = await fetch("/api/admin/docs/articles", { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Failed to load articles.");
      setArticles(json.articles ?? []);
    } catch (err: any) {
      setArtError(err?.message || "Failed to load articles.");
    } finally {
      setArtLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
    fetchArticles();
  }, [fetchCategories, fetchArticles]);

  // ======================================================================
  //  Category helpers
  // ======================================================================

  const clearCatForm = () => {
    setEditingCat(null);
    setCatTitle("");
    setCatDescription("");
    setCatIcon("");
    setCatAudience("GENERAL");
    setCatSortOrder("0");
  };

  const selectCategory = (cat: DocCategory) => {
    setEditingCat(cat);
    setCatTitle(cat.title);
    setCatDescription(cat.description ?? "");
    setCatIcon(cat.icon ?? "");
    setCatAudience(cat.audience);
    setCatSortOrder(String(cat.sortOrder));
  };

  const handleSaveCategory = async () => {
    if (!catTitle.trim()) {
      showToast({ type: "error", title: "Title is required." });
      return;
    }

    setCatSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: catTitle.trim(),
        description: catDescription.trim() || null,
        icon: catIcon.trim() || null,
        audience: catAudience,
        sortOrder: parseInt(catSortOrder, 10) || 0,
      };

      const isEditing = !!editingCat;
      const url = isEditing
        ? `/api/admin/docs/categories/${editingCat!.id}`
        : "/api/admin/docs/categories";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Save failed.");

      showToast({
        type: "success",
        title: isEditing ? "Category updated." : "Category created.",
      });
      clearCatForm();
      await fetchCategories();
    } catch (err: any) {
      showToast({ type: "error", title: err?.message || "Failed to save." });
    } finally {
      setCatSaving(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!window.confirm("Delete this category? Articles must be removed first.")) return;

    try {
      const res = await fetch(`/api/admin/docs/categories/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.message || json?.error || "Delete failed.");
      showToast({ type: "success", title: "Category deleted." });
      clearCatForm();
      await fetchCategories();
    } catch (err: any) {
      showToast({ type: "error", title: err?.message || "Failed to delete." });
    }
  };

  // ======================================================================
  //  Article helpers
  // ======================================================================

  const clearArtForm = () => {
    setFormTitle("");
    setFormSlug("");
    setFormExcerpt("");
    setFormBody("");
    setFormCategoryId(categories[0]?.id ?? "");
    setFormAuthorName("");
    setFormSortOrder("0");
    setFormMetaTitle("");
    setFormMetaDescription("");
    setFormStatus(false);
  };

  const openCreateModal = () => {
    clearArtForm();
    setEditingArt(null);
    setModalOpen(true);
  };

  const openEditModal = (art: DocArticle) => {
    setEditingArt(art);
    setFormTitle(art.title);
    setFormSlug(art.slug);
    setFormExcerpt(art.excerpt ?? "");
    setFormBody(art.body ?? "");
    setFormCategoryId(art.categoryId);
    setFormAuthorName(art.authorName ?? "");
    setFormSortOrder(String(art.sortOrder));
    setFormMetaTitle(art.metaTitle ?? "");
    setFormMetaDescription(art.metaDescription ?? "");
    setFormStatus(art.status === "PUBLISHED");
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const handleSaveArticle = async () => {
    if (!formTitle.trim()) {
      showToast({ type: "error", title: "Title is required." });
      return;
    }
    if (!formCategoryId) {
      showToast({ type: "error", title: "Category is required." });
      return;
    }

    setArtSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: formTitle.trim(),
        slug: formSlug.trim() || undefined,
        excerpt: formExcerpt.trim() || null,
        body: formBody || null,
        categoryId: formCategoryId,
        authorName: formAuthorName.trim() || null,
        sortOrder: parseInt(formSortOrder, 10) || 0,
        metaTitle: formMetaTitle.trim() || null,
        metaDescription: formMetaDescription.trim() || null,
        status: formStatus ? "PUBLISHED" : "DRAFT",
      };

      const isEditing = !!editingArt;
      const url = isEditing
        ? `/api/admin/docs/articles/${editingArt!.id}`
        : "/api/admin/docs/articles";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Save failed.");

      showToast({
        type: "success",
        title: isEditing ? "Article updated." : "Article created.",
      });
      await fetchArticles();
      await fetchCategories();
      closeModal();
    } catch (err: any) {
      showToast({ type: "error", title: err?.message || "Failed to save." });
    } finally {
      setArtSaving(false);
    }
  };

  const handleDeleteArticle = async (id: string) => {
    if (!window.confirm("Delete this article? This cannot be undone.")) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/docs/articles/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || "Delete failed.");
      }
      showToast({ type: "success", title: "Article deleted." });
      await fetchArticles();
      await fetchCategories();
      if (modalOpen) closeModal();
    } catch (err: any) {
      showToast({ type: "error", title: err?.message || "Failed to delete." });
    } finally {
      setDeleting(false);
    }
  };

  // ======================================================================
  //  Render
  // ======================================================================

  return (
    <>
      {/* Header + tab bar */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Documentation</h1>
        <p className="mt-1 text-sm text-[var(--bb-text-tertiary)]">
          Manage help center categories and articles.
        </p>
        <div className="mt-4 flex gap-1 rounded-lg bg-[var(--bb-bg-warm)] p-1">
          {(["categories", "articles"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                tab === t
                  ? "bg-white text-[var(--bb-secondary)] shadow-sm"
                  : "text-[var(--bb-text-tertiary)] hover:text-[var(--bb-secondary)]"
              }`}
            >
              {t === "categories" ? "Categories" : "Articles"}
            </button>
          ))}
        </div>
      </div>

      {/* ================================================================ */}
      {/*  CATEGORIES TAB                                                   */}
      {/* ================================================================ */}

      {tab === "categories" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
          {/* Table */}
          <section className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-4 py-4 shadow-sm">
            {catError && (
              <div className="mb-4 rounded-xl border border-[var(--bb-danger-border)] bg-[var(--bb-danger-bg)] px-4 py-3 text-sm text-[var(--bb-danger-text)]">
                {catError}
              </div>
            )}
            {catLoading ? (
              <LoadingState message="Loading categories..." />
            ) : categories.length === 0 ? (
              <EmptyState
                title="No categories yet."
                description="Create your first documentation category."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--bb-border)] text-xs tracking-[0.08em] text-[var(--bb-text-tertiary)] uppercase">
                      <th className="px-3 py-2">Icon</th>
                      <th className="px-3 py-2">Title</th>
                      <th className="px-3 py-2">Audience</th>
                      <th className="px-3 py-2 text-center">Articles</th>
                      <th className="px-3 py-2 text-center">Order</th>
                      <th className="px-3 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((cat) => (
                      <tr
                        key={cat.id}
                        className={`cursor-pointer border-b border-[var(--bb-border-subtle)] transition-colors last:border-b-0 ${
                          editingCat?.id === cat.id
                            ? "bg-[var(--bb-primary-light)]"
                            : "hover:bg-[var(--bb-bg-warm)]"
                        }`}
                        onClick={() => selectCategory(cat)}
                      >
                        <td className="px-3 py-2.5 text-lg">{cat.icon || "\u2014"}</td>
                        <td className="px-3 py-2.5 font-semibold text-[var(--bb-secondary)]">
                          {cat.title}
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge variant={AUDIENCE_BADGE[cat.audience] as any}>
                            {AUDIENCE_OPTIONS.find((o) => o.value === cat.audience)?.label ??
                              cat.audience}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-center text-xs text-[var(--bb-text-secondary)]">
                          {cat._count.articles}
                        </td>
                        <td className="px-3 py-2.5 text-center text-xs text-[var(--bb-text-secondary)]">
                          {cat.sortOrder}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCategory(cat.id);
                            }}
                          >
                            Delete
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Side form */}
          <section className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-[var(--bb-secondary)]">
              {editingCat ? "Edit Category" : "New Category"}
            </h2>
            <div className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[var(--bb-secondary)]">
                  Title <span className="text-[var(--bb-danger-text)]">*</span>
                </label>
                <FormInput
                  type="text"
                  value={catTitle}
                  onChange={(e) => setCatTitle(e.target.value)}
                  placeholder="e.g. Getting Started"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[var(--bb-secondary)]">
                  Description
                </label>
                <FormTextarea
                  value={catDescription}
                  onChange={(e) => setCatDescription(e.target.value)}
                  rows={3}
                  placeholder="Short description for the category card..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-[var(--bb-secondary)]">Icon</label>
                  <FormInput
                    type="text"
                    value={catIcon}
                    onChange={(e) => setCatIcon(e.target.value)}
                    placeholder="e.g. emoji"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-[var(--bb-secondary)]">
                    Sort Order
                  </label>
                  <FormInput
                    type="number"
                    value={catSortOrder}
                    onChange={(e) => setCatSortOrder(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[var(--bb-secondary)]">Audience</label>
                <FormSelect value={catAudience} onChange={(e) => setCatAudience(e.target.value)}>
                  {AUDIENCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </FormSelect>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Button onClick={handleSaveCategory} loading={catSaving} loadingText="Saving...">
                  {editingCat ? "Update" : "Create"}
                </Button>
                {editingCat && (
                  <Button variant="ghost" onClick={clearCatForm}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ================================================================ */}
      {/*  ARTICLES TAB                                                     */}
      {/* ================================================================ */}

      {tab === "articles" && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <Badge variant="neutral">{articles.length} articles</Badge>
            <Button onClick={openCreateModal}>New Article</Button>
          </div>

          {artError && (
            <div className="mb-4 rounded-xl border border-[var(--bb-danger-border)] bg-[var(--bb-danger-bg)] px-4 py-3 text-sm text-[var(--bb-danger-text)]">
              {artError}
            </div>
          )}

          {/* Summary cards */}
          <section className="mb-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-4 shadow-sm">
              <p className="text-xs font-medium tracking-[0.12em] text-[var(--bb-text-tertiary)] uppercase">
                Total
              </p>
              <p className="mt-2 text-3xl font-semibold text-[var(--bb-secondary)]">
                {artLoading ? "\u2014" : articles.length}
              </p>
              <p className="mt-1 text-xs text-[var(--bb-text-tertiary)]">All doc articles.</p>
            </div>
            <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-4 shadow-sm">
              <p className="text-xs font-medium tracking-[0.12em] text-[var(--bb-text-tertiary)] uppercase">
                Published
              </p>
              <p className="mt-2 text-3xl font-semibold text-[var(--bb-secondary)]">
                {artLoading ? "\u2014" : publishedCount}
              </p>
              <p className="mt-1 text-xs text-[var(--bb-text-tertiary)]">Live on the website.</p>
            </div>
            <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-4 shadow-sm">
              <p className="text-xs font-medium tracking-[0.12em] text-[var(--bb-text-tertiary)] uppercase">
                Draft
              </p>
              <p className="mt-2 text-3xl font-semibold text-[var(--bb-secondary)]">
                {artLoading ? "\u2014" : draftCount}
              </p>
              <p className="mt-1 text-xs text-[var(--bb-text-tertiary)]">Unpublished drafts.</p>
            </div>
          </section>

          {/* Filters */}
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
                placeholder="Search articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-[var(--bb-border)] bg-[var(--bb-bg-page)] py-2 pr-3 pl-10 text-sm text-[var(--bb-secondary)] transition-colors outline-none placeholder:text-[var(--bb-text-tertiary)] focus:border-[var(--bb-primary)] focus:ring-1 focus:ring-[var(--bb-primary)]"
              />
            </div>
            <FormSelect
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              size="sm"
              className="w-auto"
            >
              <option value="ALL">All Status</option>
              <option value="PUBLISHED">Published</option>
              <option value="DRAFT">Draft</option>
            </FormSelect>
            <FormSelect
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              size="sm"
              className="w-auto"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </FormSelect>
            <p className="text-xs text-[var(--bb-text-tertiary)]">
              Showing {filteredArticles.length} of {articles.length}
            </p>
          </section>

          {/* Table */}
          <section className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-4 py-4 shadow-sm">
            {artLoading ? (
              <LoadingState message="Loading articles..." />
            ) : filteredArticles.length === 0 ? (
              <EmptyState
                title={
                  searchQuery || statusFilter !== "ALL" || categoryFilter !== "ALL"
                    ? "No articles match your filters."
                    : "No doc articles yet."
                }
                description={
                  !searchQuery && statusFilter === "ALL" && categoryFilter === "ALL"
                    ? "Create your first article to get started."
                    : undefined
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--bb-border)] text-xs tracking-[0.08em] text-[var(--bb-text-tertiary)] uppercase">
                      <th className="px-3 py-2">Title</th>
                      <th className="px-3 py-2">Category</th>
                      <th className="px-3 py-2 text-center">Status</th>
                      <th className="px-3 py-2">Published</th>
                      <th className="px-3 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredArticles.map((art) => (
                      <tr
                        key={art.id}
                        className="border-b border-[var(--bb-border-subtle)] last:border-b-0"
                      >
                        <td className="px-3 py-2.5 font-semibold text-[var(--bb-secondary)]">
                          {art.title}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-[var(--bb-text-secondary)]">
                          {art.category?.title || "\u2014"}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <Badge variant={art.status === "PUBLISHED" ? "success" : "warning"}>
                            {art.status === "PUBLISHED" ? "Published" : "Draft"}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-[var(--bb-text-secondary)]">
                          {formatDate(art.publishedAt)}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => openEditModal(art)}>
                              Edit
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleDeleteArticle(art.id)}
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

          {/* Article modal */}
          {modalOpen && (
            <div
              className="fixed inset-0 z-50 bg-black/50"
              onClick={(e) => {
                if (e.target === e.currentTarget) closeModal();
              }}
            >
              <div className="mx-auto my-8 max-h-[calc(100vh-4rem)] max-w-5xl overflow-y-auto rounded-xl bg-white shadow-2xl">
                <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-xl border-b border-[var(--bb-border)] bg-white px-6 py-4">
                  <h2 className="text-lg font-semibold text-[var(--bb-secondary)]">
                    {editingArt ? "Edit Article" : "New Article"}
                  </h2>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--bb-text-muted)] transition-colors hover:bg-[var(--bb-bg-warm)] hover:text-[var(--bb-secondary)]"
                    aria-label="Close"
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

                <div className="grid grid-cols-1 gap-6 p-6 xl:grid-cols-[3fr_2fr]">
                  {/* Left — content */}
                  <div className="space-y-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-[var(--bb-secondary)]">
                        Title <span className="text-[var(--bb-danger-text)]">*</span>
                      </label>
                      <FormInput
                        type="text"
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        placeholder="Article title"
                        required
                        className="text-lg font-semibold"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-[var(--bb-secondary)]">Body</label>
                      <RichTextEditor
                        value={formBody}
                        onChange={setFormBody}
                        placeholder="Write your article..."
                        minHeight="400px"
                        enableHeadings
                      />
                    </div>
                  </div>

                  {/* Right — metadata */}
                  <div className="space-y-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-[var(--bb-secondary)]">
                        Category <span className="text-[var(--bb-danger-text)]">*</span>
                      </label>
                      <FormSelect
                        value={formCategoryId}
                        onChange={(e) => setFormCategoryId(e.target.value)}
                      >
                        <option value="">Select category...</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.icon ? `${c.icon} ` : ""}
                            {c.title}
                          </option>
                        ))}
                      </FormSelect>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-[var(--bb-secondary)]">Slug</label>
                      <FormInput
                        type="text"
                        value={formSlug}
                        onChange={(e) => setFormSlug(e.target.value)}
                        placeholder="auto-generated-from-title"
                      />
                      <p className="text-[10px] text-[var(--bb-text-muted)]">
                        Leave blank to auto-generate.
                      </p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-[var(--bb-secondary)]">
                        Excerpt
                      </label>
                      <FormTextarea
                        value={formExcerpt}
                        onChange={(e) => setFormExcerpt(e.target.value)}
                        rows={3}
                        placeholder="Short description..."
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
                      <label className="text-xs font-medium text-[var(--bb-secondary)]">
                        Sort Order
                      </label>
                      <FormInput
                        type="number"
                        value={formSortOrder}
                        onChange={(e) => setFormSortOrder(e.target.value)}
                      />
                    </div>
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

                <div className="sticky bottom-0 flex items-center justify-between rounded-b-xl border-t border-[var(--bb-border)] bg-white px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handleSaveArticle}
                      loading={artSaving}
                      loadingText="Saving..."
                      disabled={artSaving || deleting}
                    >
                      Save
                    </Button>
                    {editingArt && (
                      <Button
                        variant="danger"
                        onClick={() => handleDeleteArticle(editingArt.id)}
                        disabled={artSaving || deleting}
                        loading={deleting}
                        loadingText="Deleting..."
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                  <Button variant="ghost" onClick={closeModal} disabled={artSaving || deleting}>
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
