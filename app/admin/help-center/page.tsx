// -----------------------------------------------------------------------------
// @file: app/admin/help-center/page.tsx
// @purpose: Admin CMS for managing help center categories and articles
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-02-23
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";
import { DataTable, THead, TH, TD } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import { useToast } from "@/components/ui/toast-provider";
import { Button } from "@/components/ui/button";
import { FormInput, FormSelect, FormTextarea } from "@/components/ui/form-field";
import { LoadingState } from "@/components/ui/loading-state";
import { Badge } from "@/components/ui/badge";
import { Modal, ModalHeader, ModalFooter } from "@/components/ui/modal";
import { RichTextEditor } from "@/components/ui/rich-text-editor";

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

type HelpCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  targetRole: string;
  published: boolean;
  articleCount: number;
  createdAt: string;
  updatedAt: string;
};

type HelpArticle = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content?: string;
  categoryId: string;
  categoryName: string;
  targetRole: string;
  published: boolean;
  sortOrder: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
};

type Tab = "categories" | "articles";

const TARGET_ROLE_OPTIONS = [
  { value: "ALL", label: "All roles" },
  { value: "CUSTOMER", label: "Customer only" },
  { value: "DESIGNER", label: "Designer only" },
];

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function AdminHelpCenterPage() {
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>("categories");

  // --- Categories state ---
  const [categories, setCategories] = useState<HelpCategory[]>([]);
  const [catLoading, setCatLoading] = useState(true);
  const [catError, setCatError] = useState<string | null>(null);
  const [selectedCat, setSelectedCat] = useState<HelpCategory | null>(null);
  const [catForm, setCatForm] = useState({
    name: "",
    slug: "",
    description: "",
    icon: "",
    sortOrder: "0",
    targetRole: "ALL",
    published: true,
  });
  const [catSaving, setCatSaving] = useState(false);

  // --- Articles state ---
  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [artLoading, setArtLoading] = useState(true);
  const [artError, setArtError] = useState<string | null>(null);
  const [artFilterCat, setArtFilterCat] = useState("");
  const [artModalOpen, setArtModalOpen] = useState(false);
  const [selectedArt, setSelectedArt] = useState<HelpArticle | null>(null);
  const [artForm, setArtForm] = useState({
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    categoryId: "",
    targetRole: "ALL",
    published: true,
    sortOrder: "0",
  });
  const [artSaving, setArtSaving] = useState(false);

  // ---------------------------------------------------------------------------
  // Load data
  // ---------------------------------------------------------------------------

  const loadCategories = async () => {
    setCatLoading(true);
    setCatError(null);
    try {
      const res = await fetch("/api/admin/help-categories", { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Failed to load categories");
      setCategories(json.categories);
    } catch (err: any) {
      setCatError(err?.message || "Failed to load categories");
    } finally {
      setCatLoading(false);
    }
  };

  const loadArticles = async () => {
    setArtLoading(true);
    setArtError(null);
    try {
      const url = artFilterCat
        ? `/api/admin/help-articles?categoryId=${artFilterCat}`
        : "/api/admin/help-articles";
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Failed to load articles");
      setArticles(json.articles);
    } catch (err: any) {
      setArtError(err?.message || "Failed to load articles");
    } finally {
      setArtLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
    loadArticles();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadArticles();
  }, [artFilterCat]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Category form handlers
  // ---------------------------------------------------------------------------

  const resetCatForm = () => {
    setSelectedCat(null);
    setCatForm({
      name: "",
      slug: "",
      description: "",
      icon: "",
      sortOrder: "0",
      targetRole: "ALL",
      published: true,
    });
  };

  const selectCategory = (cat: HelpCategory) => {
    setSelectedCat(cat);
    setCatForm({
      name: cat.name,
      slug: cat.slug,
      description: cat.description ?? "",
      icon: cat.icon ?? "",
      sortOrder: String(cat.sortOrder),
      targetRole: cat.targetRole,
      published: cat.published,
    });
  };

  const handleCatSave = async () => {
    setCatSaving(true);
    try {
      const payload = {
        name: catForm.name,
        slug: catForm.slug,
        description: catForm.description || null,
        icon: catForm.icon || null,
        sortOrder: parseInt(catForm.sortOrder, 10) || 0,
        targetRole: catForm.targetRole,
        published: catForm.published,
      };

      if (selectedCat) {
        const res = await fetch(`/api/admin/help-categories/${selectedCat.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error || "Failed to update category");
        showToast({ title: "Category updated", type: "success" });
      } else {
        const res = await fetch("/api/admin/help-categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error || "Failed to create category");
        showToast({ title: "Category created", type: "success" });
      }

      resetCatForm();
      await loadCategories();
    } catch (err: any) {
      showToast({ title: err?.message || "Save failed", type: "error" });
    } finally {
      setCatSaving(false);
    }
  };

  const handleCatDelete = async () => {
    if (!selectedCat) return;
    if (!window.confirm(`Delete category "${selectedCat.name}"? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/admin/help-categories/${selectedCat.id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Failed to delete category");
      showToast({ title: "Category deleted", type: "success" });
      resetCatForm();
      await loadCategories();
    } catch (err: any) {
      showToast({ title: err?.message || "Delete failed", type: "error" });
    }
  };

  // ---------------------------------------------------------------------------
  // Article form handlers
  // ---------------------------------------------------------------------------

  const resetArtForm = () => {
    setSelectedArt(null);
    setArtForm({
      title: "",
      slug: "",
      excerpt: "",
      content: "",
      categoryId: categories[0]?.id ?? "",
      targetRole: "ALL",
      published: true,
      sortOrder: "0",
    });
  };

  const openNewArticle = () => {
    resetArtForm();
    setArtModalOpen(true);
  };

  const openEditArticle = async (art: HelpArticle) => {
    // Fetch full article with content
    try {
      const res = await fetch(`/api/admin/help-articles/${art.id}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Failed to load article");
      const full = json.article as HelpArticle;
      setSelectedArt(full);
      setArtForm({
        title: full.title,
        slug: full.slug,
        excerpt: full.excerpt ?? "",
        content: full.content ?? "",
        categoryId: full.categoryId,
        targetRole: full.targetRole,
        published: full.published,
        sortOrder: String(full.sortOrder),
      });
      setArtModalOpen(true);
    } catch (err: any) {
      showToast({ title: err?.message || "Failed to load article", type: "error" });
    }
  };

  const handleArtSave = async () => {
    setArtSaving(true);
    try {
      const payload = {
        title: artForm.title,
        slug: artForm.slug,
        excerpt: artForm.excerpt || null,
        content: artForm.content,
        categoryId: artForm.categoryId,
        targetRole: artForm.targetRole,
        published: artForm.published,
        sortOrder: parseInt(artForm.sortOrder, 10) || 0,
      };

      if (selectedArt) {
        const res = await fetch(`/api/admin/help-articles/${selectedArt.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error || "Failed to update article");
        showToast({ title: "Article updated", type: "success" });
      } else {
        const res = await fetch("/api/admin/help-articles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error || "Failed to create article");
        showToast({ title: "Article created", type: "success" });
      }

      setArtModalOpen(false);
      resetArtForm();
      await loadArticles();
    } catch (err: any) {
      showToast({ title: err?.message || "Save failed", type: "error" });
    } finally {
      setArtSaving(false);
    }
  };

  const handleArtDelete = async () => {
    if (!selectedArt) return;
    if (!window.confirm(`Delete article "${selectedArt.title}"? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/admin/help-articles/${selectedArt.id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Failed to delete article");
      showToast({ title: "Article deleted", type: "success" });
      setArtModalOpen(false);
      resetArtForm();
      await loadArticles();
    } catch (err: any) {
      showToast({ title: err?.message || "Delete failed", type: "error" });
    }
  };

  // ---------------------------------------------------------------------------
  // Auto-slug
  // ---------------------------------------------------------------------------

  const handleCatNameChange = (name: string) => {
    const autoSlug = !selectedCat && !catForm.slug;
    setCatForm((f) => ({
      ...f,
      name,
      ...(autoSlug ? { slug: generateSlug(name) } : {}),
    }));
  };

  const handleArtTitleChange = (title: string) => {
    const autoSlug = !selectedArt && !artForm.slug;
    setArtForm((f) => ({
      ...f,
      title,
      ...(autoSlug ? { slug: generateSlug(title) } : {}),
    }));
  };

  // ---------------------------------------------------------------------------
  // Filtered articles
  // ---------------------------------------------------------------------------

  const filteredArticles = useMemo(() => {
    if (!artFilterCat) return articles;
    return articles.filter((a) => a.categoryId === artFilterCat);
  }, [articles, artFilterCat]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const roleBadge = (role: string) => {
    switch (role) {
      case "CUSTOMER":
        return <Badge variant="info">Customer</Badge>;
      case "DESIGNER":
        return <Badge variant="primary">Designer</Badge>;
      default:
        return <Badge variant="neutral">All</Badge>;
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-brand text-2xl font-semibold tracking-tight text-[var(--bb-secondary)]">
          Help Center
        </h1>
        <p className="mt-1 text-sm text-[var(--bb-text-secondary)]">
          Manage help categories and articles for customers and designers.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-2">
        <button
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            tab === "categories"
              ? "bg-[var(--bb-primary)] text-white"
              : "bg-[var(--bb-bg-card)] text-[var(--bb-text-secondary)] hover:text-[var(--bb-secondary)]"
          }`}
          onClick={() => setTab("categories")}
        >
          Categories ({categories.length})
        </button>
        <button
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            tab === "articles"
              ? "bg-[var(--bb-primary)] text-white"
              : "bg-[var(--bb-bg-card)] text-[var(--bb-text-secondary)] hover:text-[var(--bb-secondary)]"
          }`}
          onClick={() => setTab("articles")}
        >
          Articles ({articles.length})
        </button>
      </div>

      {/* ===================================================================== */}
      {/* CATEGORIES TAB                                                        */}
      {/* ===================================================================== */}

      {tab === "categories" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* Table */}
          <div>
            {catLoading ? (
              <LoadingState message="Loading categories..." />
            ) : catError ? (
              <InlineAlert variant="error">{catError}</InlineAlert>
            ) : categories.length === 0 ? (
              <EmptyState
                title="No categories yet"
                description="Create your first help category to get started."
              />
            ) : (
              <DataTable>
                <THead>
                  <tr>
                    <TH>Icon</TH>
                    <TH>Name</TH>
                    <TH>Slug</TH>
                    <TH>Target</TH>
                    <TH align="center">Articles</TH>
                    <TH align="center">Order</TH>
                    <TH align="center">Published</TH>
                  </tr>
                </THead>
                <tbody>
                  {categories.map((cat) => (
                    <tr
                      key={cat.id}
                      onClick={() => selectCategory(cat)}
                      className={`cursor-pointer transition-colors hover:bg-[var(--bb-bg-warm)] ${
                        selectedCat?.id === cat.id ? "bg-[var(--bb-primary-light)]" : ""
                      }`}
                    >
                      <TD>{cat.icon || "—"}</TD>
                      <TD>
                        <span className="font-medium">{cat.name}</span>
                      </TD>
                      <TD>
                        <span className="text-xs text-[var(--bb-text-tertiary)]">{cat.slug}</span>
                      </TD>
                      <TD>{roleBadge(cat.targetRole)}</TD>
                      <TD align="center">{cat.articleCount}</TD>
                      <TD align="center">{cat.sortOrder}</TD>
                      <TD align="center">
                        {cat.published ? (
                          <Badge variant="success">Yes</Badge>
                        ) : (
                          <Badge variant="neutral">No</Badge>
                        )}
                      </TD>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            )}
          </div>

          {/* Form */}
          <div className="rounded-2xl border border-[var(--bb-border)] bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold text-[var(--bb-secondary)]">
              {selectedCat ? "Edit category" : "New category"}
            </h2>

            <div className="space-y-3">
              <FormInput
                placeholder="Category name"
                value={catForm.name}
                onChange={(e) => handleCatNameChange(e.target.value)}
              />
              <FormInput
                placeholder="Slug"
                value={catForm.slug}
                onChange={(e) => setCatForm((f) => ({ ...f, slug: e.target.value }))}
              />
              <FormTextarea
                placeholder="Description (optional)"
                value={catForm.description}
                onChange={(e) => setCatForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
              />
              <FormInput
                placeholder="Icon (emoji)"
                value={catForm.icon}
                onChange={(e) => setCatForm((f) => ({ ...f, icon: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormInput
                  type="number"
                  placeholder="Sort order"
                  value={catForm.sortOrder}
                  onChange={(e) => setCatForm((f) => ({ ...f, sortOrder: e.target.value }))}
                />
                <FormSelect
                  value={catForm.targetRole}
                  onChange={(e) => setCatForm((f) => ({ ...f, targetRole: e.target.value }))}
                >
                  {TARGET_ROLE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </FormSelect>
              </div>

              <label className="flex items-center gap-2 text-sm text-[var(--bb-text-secondary)]">
                <input
                  type="checkbox"
                  checked={catForm.published}
                  onChange={(e) => setCatForm((f) => ({ ...f, published: e.target.checked }))}
                  className="accent-[var(--bb-primary)]"
                />
                Published
              </label>
            </div>

            <div className="mt-4 flex gap-2">
              <Button
                variant="primary"
                size="sm"
                loading={catSaving}
                loadingText="Saving..."
                onClick={handleCatSave}
                disabled={!catForm.name.trim()}
              >
                {selectedCat ? "Update" : "Create"}
              </Button>
              {selectedCat && (
                <>
                  <Button variant="ghost" size="sm" onClick={resetCatForm}>
                    Cancel
                  </Button>
                  <Button variant="danger" size="sm" onClick={handleCatDelete}>
                    Delete
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* ARTICLES TAB                                                          */}
      {/* ===================================================================== */}

      {tab === "articles" && (
        <div>
          {/* Top bar */}
          <div className="mb-4 flex items-center gap-3">
            <FormSelect
              value={artFilterCat}
              onChange={(e) => setArtFilterCat(e.target.value)}
              size="sm"
            >
              <option value="">All categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon ? `${cat.icon} ` : ""}{cat.name}
                </option>
              ))}
            </FormSelect>
            <Button variant="primary" size="sm" onClick={openNewArticle}>
              New article
            </Button>
          </div>

          {artLoading ? (
            <LoadingState message="Loading articles..." />
          ) : artError ? (
            <InlineAlert variant="error">{artError}</InlineAlert>
          ) : filteredArticles.length === 0 ? (
            <EmptyState
              title="No articles yet"
              description="Create your first help article to populate the help center."
            />
          ) : (
            <DataTable>
              <THead>
                <tr>
                  <TH>Title</TH>
                  <TH>Category</TH>
                  <TH>Target</TH>
                  <TH align="center">Published</TH>
                  <TH align="center">Views</TH>
                  <TH align="center">Order</TH>
                </tr>
              </THead>
              <tbody>
                {filteredArticles.map((art) => (
                  <tr
                    key={art.id}
                    onClick={() => openEditArticle(art)}
                    className="cursor-pointer transition-colors hover:bg-[var(--bb-bg-warm)]"
                  >
                    <TD>
                      <span className="font-medium">{art.title}</span>
                      {art.excerpt && (
                        <p className="mt-0.5 text-xs text-[var(--bb-text-tertiary)] line-clamp-1">
                          {art.excerpt}
                        </p>
                      )}
                    </TD>
                    <TD>{art.categoryName}</TD>
                    <TD>{roleBadge(art.targetRole)}</TD>
                    <TD align="center">
                      {art.published ? (
                        <Badge variant="success">Yes</Badge>
                      ) : (
                        <Badge variant="neutral">Draft</Badge>
                      )}
                    </TD>
                    <TD align="center">{art.viewCount}</TD>
                    <TD align="center">{art.sortOrder}</TD>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}

          {/* Article edit/create modal */}
          <Modal
            open={artModalOpen}
            onClose={() => {
              setArtModalOpen(false);
              resetArtForm();
            }}
            size="full"
            scrollable
          >
            <ModalHeader
              title={selectedArt ? "Edit article" : "New article"}
              onClose={() => {
                setArtModalOpen(false);
                resetArtForm();
              }}
            />

            <div className="space-y-4 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormInput
                  placeholder="Article title"
                  value={artForm.title}
                  onChange={(e) => handleArtTitleChange(e.target.value)}
                />
                <FormInput
                  placeholder="Slug"
                  value={artForm.slug}
                  onChange={(e) => setArtForm((f) => ({ ...f, slug: e.target.value }))}
                />
              </div>

              <FormTextarea
                placeholder="Excerpt / short description (optional)"
                value={artForm.excerpt}
                onChange={(e) => setArtForm((f) => ({ ...f, excerpt: e.target.value }))}
                rows={2}
              />

              <div className="grid gap-4 sm:grid-cols-3">
                <FormSelect
                  value={artForm.categoryId}
                  onChange={(e) => setArtForm((f) => ({ ...f, categoryId: e.target.value }))}
                >
                  <option value="" disabled>
                    Select category
                  </option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon ? `${cat.icon} ` : ""}{cat.name}
                    </option>
                  ))}
                </FormSelect>
                <FormSelect
                  value={artForm.targetRole}
                  onChange={(e) => setArtForm((f) => ({ ...f, targetRole: e.target.value }))}
                >
                  {TARGET_ROLE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </FormSelect>
                <FormInput
                  type="number"
                  placeholder="Sort order"
                  value={artForm.sortOrder}
                  onChange={(e) => setArtForm((f) => ({ ...f, sortOrder: e.target.value }))}
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-[var(--bb-text-secondary)]">
                <input
                  type="checkbox"
                  checked={artForm.published}
                  onChange={(e) => setArtForm((f) => ({ ...f, published: e.target.checked }))}
                  className="accent-[var(--bb-primary)]"
                />
                Published
              </label>

              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--bb-text-secondary)]">
                  Content
                </label>
                <RichTextEditor
                  value={artForm.content}
                  onChange={(html) => setArtForm((f) => ({ ...f, content: html }))}
                  placeholder="Write the article content..."
                  minHeight="250px"
                  enableHeadings
                />
              </div>
            </div>

            <ModalFooter>
              <div className="flex items-center gap-2">
                {selectedArt && (
                  <Button variant="danger" size="sm" onClick={handleArtDelete}>
                    Delete
                  </Button>
                )}
                <div className="flex-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setArtModalOpen(false);
                    resetArtForm();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  loading={artSaving}
                  loadingText="Saving..."
                  onClick={handleArtSave}
                  disabled={!artForm.title.trim() || !artForm.content.trim() || !artForm.categoryId}
                >
                  {selectedArt ? "Update" : "Create"}
                </Button>
              </div>
            </ModalFooter>
          </Modal>
        </div>
      )}
    </div>
  );
}
