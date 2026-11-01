// -----------------------------------------------------------------------------
// @file: app/admin/docs/page.tsx
// @purpose: Admin CMS page for managing documentation categories & articles
//           (admin design language v1). Categories tab: ordered list with
//           audience + article count, editor panel with the category's
//           articles. Articles tab: filterable list and a tabbed editor
//           (Content / Settings / SEO & publish).
// @version: v2.0.0
// @status: active
// @lastUpdate: 2026-11-01
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast-provider";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import {
  Badge,
  Button,
  Callout,
  Card,
  DASH,
  DetailPanel,
  EmptyState,
  Field,
  FilterBar,
  PageHeader,
  Pager,
  PanelSection,
  SaveBar,
  SearchInput,
  Select,
  Skeleton,
  SplitView,
  Switch,
  TabPanel,
  Table,
  TableFooter,
  Tabs,
  Td,
  TextArea,
  TextInput,
  TextLink,
  Th,
  Tr,
  fmt,
  plural,
  type Tone,
} from "@/components/admin/v2/ui";
import { useUnsavedChanges } from "@/components/admin/v2/unsaved-changes";
import { IconDocument } from "@/components/admin/v2/icons";

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

type Audience = "CREATIVE" | "CUSTOMER" | "GENERAL";

type DocCategory = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  icon: string | null;
  audience: Audience;
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

type CatForm = {
  title: string;
  description: string;
  icon: string;
  audience: string;
  sortOrder: string;
};

type ArtForm = {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  categoryId: string;
  authorName: string;
  sortOrder: string;
  metaTitle: string;
  metaDescription: string;
  published: boolean;
};

type PendingDelete = { kind: "category" | "article"; id: string; title: string } | null;

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function formatDate(dateStr: string | null): string {
  if (!dateStr) return DASH;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return DASH;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

const AUDIENCE_OPTIONS: { value: Audience; label: string; hint: string }[] = [
  {
    value: "GENERAL",
    label: "General",
    hint: "Listed for everyone, under every audience tab in the help centre.",
  },
  {
    value: "CREATIVE",
    label: "For Creatives",
    hint: "Listed under the For Creatives tab in the help centre.",
  },
  {
    value: "CUSTOMER",
    label: "For Customers",
    hint: "Listed under the For Customers tab in the help centre.",
  },
];

const AUDIENCE_TONE: Record<string, Tone> = {
  GENERAL: "neutral",
  CREATIVE: "blue",
  CUSTOMER: "green",
};

const audienceLabel = (a: string) => AUDIENCE_OPTIONS.find((o) => o.value === a)?.label ?? a;

const PAGE_SIZE = 10;
const ALL = "ALL";

const EMPTY_CAT: CatForm = {
  title: "",
  description: "",
  icon: "",
  audience: "GENERAL",
  sortOrder: "0",
};

const catSnapshot = (c: DocCategory): CatForm => ({
  title: c.title,
  description: c.description ?? "",
  icon: c.icon ?? "",
  audience: c.audience,
  sortOrder: String(c.sortOrder),
});

const artSnapshot = (a: DocArticle): ArtForm => ({
  title: a.title,
  slug: a.slug,
  excerpt: a.excerpt ?? "",
  body: a.body ?? "",
  categoryId: a.categoryId,
  authorName: a.authorName ?? "",
  sortOrder: String(a.sortOrder),
  metaTitle: a.metaTitle ?? "",
  metaDescription: a.metaDescription ?? "",
  published: a.status === "PUBLISHED",
});

function artSnapshotEmpty(categoryId: string): ArtForm {
  return {
    title: "",
    slug: "",
    excerpt: "",
    body: "",
    categoryId,
    authorName: "",
    sortOrder: "0",
    metaTitle: "",
    metaDescription: "",
    published: false,
  };
}

const sameForm = <T extends Record<string, unknown>>(a: T, b: T) =>
  (Object.keys(a) as (keyof T)[]).every((k) => a[k] === b[k]);

/** Tiptap reports an empty document as "<p></p>"; treat it as empty. */
const normBody = (html: string) => (html === "<p></p>" ? "" : html);

function CategoryIcon({ icon, size = 36 }: { icon: string | null; size?: number }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: Math.round(size * 0.5) }}
      className="inline-flex shrink-0 items-center justify-center rounded-lg bg-[var(--av2-bg)] text-[var(--av2-text-2)]"
    >
      {icon || <IconDocument width={size * 0.5} height={size * 0.5} />}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function AdminDocsPage() {
  const { showToast } = useToast();
  const [tab, setTab] = useState<"categories" | "articles">("categories");

  // ---- Categories state --------------------------------------------------

  const [categories, setCategories] = useState<DocCategory[]>([]);
  const [catLoading, setCatLoading] = useState(true);
  const [catLoaded, setCatLoaded] = useState(false);
  const [catError, setCatError] = useState<string | null>(null);
  const [editingCat, setEditingCat] = useState<DocCategory | null>(null);
  const [catForm, setCatForm] = useState<CatForm>(EMPTY_CAT);
  const [catTitleError, setCatTitleError] = useState<string | null>(null);
  const [catSaving, setCatSaving] = useState(false);
  const [catPanelTab, setCatPanelTab] = useState<"details" | "display" | "articles">("details");
  const [catSearch, setCatSearch] = useState("");
  const [catAudienceFilter, setCatAudienceFilter] = useState<string>(ALL);

  // ---- Articles state ----------------------------------------------------

  const [articles, setArticles] = useState<DocArticle[]>([]);
  const [artLoading, setArtLoading] = useState(true);
  const [artLoaded, setArtLoaded] = useState(false);
  const [artError, setArtError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingArt, setEditingArt] = useState<DocArticle | null>(null);
  const [artForm, setArtForm] = useState<ArtForm>(() => artSnapshotEmpty(""));
  const [artBaseline, setArtBaseline] = useState<ArtForm>(() => artSnapshotEmpty(""));
  // See app/admin/pages: adopt the editor's first non-user normalisation of
  // the body as the baseline so opening an article doesn't read as dirty.
  const bodyInteracted = useRef(false);
  const [artErrors, setArtErrors] = useState<{ title?: string; categoryId?: string }>({});
  const [artTab, setArtTab] = useState<"content" | "settings" | "publish">("content");
  const [artSaving, setArtSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PUBLISHED" | "DRAFT">("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [artPage, setArtPage] = useState(1);

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

  useEffect(() => {
    setArtPage(1);
  }, [statusFilter, categoryFilter, searchQuery]);

  const artFiltersActive = statusFilter !== "ALL" || categoryFilter !== "ALL" || !!searchQuery;
  const resetArtFilters = () => {
    setStatusFilter("ALL");
    setCategoryFilter("ALL");
    setSearchQuery("");
  };

  const artPageCount = Math.max(1, Math.ceil(filteredArticles.length / PAGE_SIZE));
  const artCurrentPage = Math.min(artPage, artPageCount);
  const artPageStart = (artCurrentPage - 1) * PAGE_SIZE;
  const artPageRows = filteredArticles.slice(artPageStart, artPageStart + PAGE_SIZE);

  const publishedCount = articles.filter((a) => a.status === "PUBLISHED").length;
  const draftCount = articles.length - publishedCount;

  const sortedCategories = useMemo(
    () =>
      [...categories].sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title)),
    [categories],
  );

  const filteredCategories = useMemo(() => {
    const q = catSearch.trim().toLowerCase();
    return sortedCategories.filter((c) => {
      if (catAudienceFilter !== ALL && c.audience !== catAudienceFilter) return false;
      if (
        q &&
        !c.title.toLowerCase().includes(q) &&
        !(c.description ?? "").toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [sortedCategories, catSearch, catAudienceFilter]);

  const catFiltersActive = catAudienceFilter !== ALL || !!catSearch.trim();

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
      setCatLoaded(true);
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
      setArtLoaded(true);
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

  // Keep the selected category object fresh after reloads (article counts).
  useEffect(() => {
    if (!editingCat) return;
    const fresh = categories.find((c) => c.id === editingCat.id);
    if (fresh && fresh !== editingCat) setEditingCat(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  // ======================================================================
  //  Category helpers
  // ======================================================================

  const setCat = <K extends keyof CatForm>(k: K, v: CatForm[K]) =>
    setCatForm((f) => ({ ...f, [k]: v }));

  const clearCatForm = () => {
    setEditingCat(null);
    setCatForm(EMPTY_CAT);
    setCatTitleError(null);
    setCatPanelTab("details");
  };

  const selectCategory = (cat: DocCategory) => {
    setEditingCat(cat);
    setCatForm(catSnapshot(cat));
    setCatTitleError(null);
  };

  const catBaseline = editingCat ? catSnapshot(editingCat) : EMPTY_CAT;
  const catDirty = !sameForm(catForm, catBaseline);

  const handleSaveCategory = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!catForm.title.trim()) {
      setCatTitleError("Title is required.");
      setCatPanelTab("details");
      showToast({ type: "error", title: "Title is required." });
      requestAnimationFrame(() => document.getElementById("cat-title")?.focus());
      return;
    }
    setCatTitleError(null);

    setCatSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: catForm.title.trim(),
        description: catForm.description.trim() || null,
        icon: catForm.icon.trim() || null,
        audience: catForm.audience,
        sortOrder: parseInt(catForm.sortOrder, 10) || 0,
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
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/docs/categories/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.message || json?.error || "Delete failed.");
      showToast({ type: "success", title: "Category deleted." });
      clearCatForm();
      await fetchCategories();
    } catch (err: any) {
      showToast({ type: "error", title: err?.message || "Failed to delete." });
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  };

  // ======================================================================
  //  Article helpers
  // ======================================================================

  const setArt = <K extends keyof ArtForm>(k: K, v: ArtForm[K]) =>
    setArtForm((f) => ({ ...f, [k]: v }));

  const openCreateEditor = (categoryId?: string) => {
    const empty = artSnapshotEmpty(categoryId ?? categories[0]?.id ?? "");
    setEditingArt(null);
    setArtForm(empty);
    setArtBaseline(empty);
    bodyInteracted.current = false;
    setArtErrors({});
    setArtTab("content");
    setTab("articles");
    setEditorOpen(true);
  };

  const openEditEditor = (art: DocArticle) => {
    const snap = artSnapshot(art);
    setEditingArt(art);
    setArtForm(snap);
    setArtBaseline(snap);
    bodyInteracted.current = false;
    setArtErrors({});
    setArtTab("content");
    setTab("articles");
    setEditorOpen(true);
  };

  const closeEditor = () => setEditorOpen(false);

  const onBodyChange = (html: string) => {
    if (!bodyInteracted.current) setArtBaseline((b) => ({ ...b, body: html }));
    setArt("body", html);
  };
  const markBodyInteracted = () => {
    bodyInteracted.current = true;
  };

  const artDirty = !sameForm(
    { ...artForm, body: normBody(artForm.body) },
    { ...artBaseline, body: normBody(artBaseline.body) },
  );

  // Both forms register with the admin-wide unsaved-changes guard. The article
  // draft only counts while its editor is open (closing it drops the draft).
  // Switching Categories / Articles tabs keeps both drafts in page state, so
  // it doesn't confirm.
  const artOpenDirty = editorOpen && artDirty;
  const confirmDiscard = useUnsavedChanges(catDirty, "Category form");
  useUnsavedChanges(artOpenDirty, "Article editor");

  /** Run `fn` now, or — when `wouldDrop` holds a draft — after the user agrees to discard it. */
  const guarded = async (wouldDrop: boolean, fn: () => void) => {
    if (wouldDrop && !(await confirmDiscard())) return;
    fn();
  };

  const handleSaveArticle = async () => {
    const errs: { title?: string; categoryId?: string } = {};
    if (!artForm.title.trim()) errs.title = "Title is required.";
    if (!artForm.categoryId) errs.categoryId = "Category is required.";
    setArtErrors(errs);
    if (errs.title) {
      setArtTab("content");
      showToast({ type: "error", title: "Title is required." });
      requestAnimationFrame(() => document.getElementById("art-title")?.focus());
      return;
    }
    if (errs.categoryId) {
      setArtTab("settings");
      showToast({ type: "error", title: "Category is required." });
      requestAnimationFrame(() => document.getElementById("art-category")?.focus());
      return;
    }

    setArtSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: artForm.title.trim(),
        slug: artForm.slug.trim() || undefined,
        excerpt: artForm.excerpt.trim() || null,
        body: artForm.body || null,
        categoryId: artForm.categoryId,
        authorName: artForm.authorName.trim() || null,
        sortOrder: parseInt(artForm.sortOrder, 10) || 0,
        metaTitle: artForm.metaTitle.trim() || null,
        metaDescription: artForm.metaDescription.trim() || null,
        status: artForm.published ? "PUBLISHED" : "DRAFT",
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
      closeEditor();
    } catch (err: any) {
      showToast({ type: "error", title: err?.message || "Failed to save." });
    } finally {
      setArtSaving(false);
    }
  };

  const handleDeleteArticle = async (id: string) => {
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
      if (editorOpen) closeEditor();
    } catch (err: any) {
      showToast({ type: "error", title: err?.message || "Failed to delete." });
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  };

  const confirmPendingDelete = () => {
    if (!pendingDelete) return;
    if (pendingDelete.kind === "category") void handleDeleteCategory(pendingDelete.id);
    else void handleDeleteArticle(pendingDelete.id);
  };

  // ======================================================================
  //  Categories tab
  // ======================================================================

  const catTabIds = "doc-cat";
  const editingCatArticles = useMemo(
    () =>
      editingCat
        ? articles
            .filter((a) => a.categoryId === editingCat.id)
            .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title))
        : [],
    [articles, editingCat],
  );
  const audienceHint = AUDIENCE_OPTIONS.find((o) => o.value === catForm.audience)?.hint;
  const previewCount = editingCat ? editingCat._count.articles : null;

  const categoryPanel = (
    <form onSubmit={handleSaveCategory} noValidate className="contents">
      <DetailPanel
        title={
          <span className="flex min-w-0 items-center gap-3">
            {editingCat && <CategoryIcon icon={editingCat.icon} size={40} />}
            <span className="min-w-0">
              <span className="block break-words">
                {editingCat ? editingCat.title : "New category"}
              </span>
              {editingCat && (
                <span className="block text-sm font-normal text-[var(--av2-text-2)]">
                  {fmt(editingCat._count.articles)}{" "}
                  {plural(editingCat._count.articles, "article", "articles")}
                </span>
              )}
            </span>
          </span>
        }
        onClose={editingCat ? () => void guarded(catDirty, clearCatForm) : undefined}
        closeLabel="Clear selection"
        footer={
          <SaveBar
            dirty={catDirty}
            status={catSaving ? "Saving…" : catDirty ? "Unsaved changes" : "No unsaved changes"}
          >
            {catDirty && (
              <Button
                variant="ghost"
                disabled={catSaving}
                onClick={() => {
                  setCatForm(catBaseline);
                  setCatTitleError(null);
                }}
              >
                Discard
              </Button>
            )}
            <Button
              type="submit"
              variant="primary"
              disabled={!catDirty || catSaving}
              aria-busy={catSaving}
            >
              {catSaving ? "Saving…" : editingCat ? "Save category" : "Create category"}
            </Button>
          </SaveBar>
        }
      >
        <Tabs
          idPrefix={catTabIds}
          label="Category sections"
          value={catPanelTab}
          onChange={setCatPanelTab}
          tabs={[
            { value: "details", label: "Details" },
            { value: "display", label: "Display" },
            ...(editingCat
              ? [
                  {
                    value: "articles" as const,
                    label: `Articles (${fmt(editingCatArticles.length)})`,
                  },
                ]
              : []),
          ]}
        />

        <div className="pt-5">
          <div hidden={catPanelTab !== "details"}>
            <TabPanel idPrefix={catTabIds} value="details">
              <div className="space-y-4">
                <Field
                  label={
                    <>
                      Title <span className="text-[var(--av2-error-text)]">*</span>
                    </>
                  }
                  htmlFor="cat-title"
                  error={catTitleError}
                >
                  <TextInput
                    id="cat-title"
                    type="text"
                    value={catForm.title}
                    onChange={(e) => {
                      setCat("title", e.target.value);
                      if (catTitleError && e.target.value.trim()) setCatTitleError(null);
                    }}
                    placeholder="e.g. Getting Started"
                    aria-invalid={catTitleError ? true : undefined}
                  />
                </Field>
                <Field
                  label="Description"
                  htmlFor="cat-description"
                  hint="Short description for the category card."
                >
                  <TextArea
                    id="cat-description"
                    value={catForm.description}
                    onChange={(e) => setCat("description", e.target.value)}
                    rows={3}
                    placeholder="Short description for the category card..."
                  />
                </Field>
              </div>

              {editingCat && (
                <div className="mt-6 border-t border-[var(--av2-border)] pt-5">
                  <h3 className="text-base font-semibold">Danger zone</h3>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                    <p className="min-w-0 flex-1 text-sm text-[var(--av2-text-2)]">
                      {editingCat._count.articles > 0
                        ? "Articles must be removed before this category can be deleted."
                        : "Deleting removes this category permanently."}
                    </p>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() =>
                        setPendingDelete({
                          kind: "category",
                          id: editingCat.id,
                          title: editingCat.title,
                        })
                      }
                    >
                      Delete category
                    </Button>
                  </div>
                </div>
              )}
            </TabPanel>
          </div>

          <div hidden={catPanelTab !== "display"}>
            <TabPanel idPrefix={catTabIds} value="display">
              <div className="space-y-4">
                <Field label="Icon" htmlFor="cat-icon" hint="An emoji works best.">
                  <div className="flex items-center gap-3">
                    <CategoryIcon icon={catForm.icon.trim() || null} size={40} />
                    <div className="min-w-0 flex-1">
                      <TextInput
                        id="cat-icon"
                        type="text"
                        value={catForm.icon}
                        onChange={(e) => setCat("icon", e.target.value)}
                        placeholder="e.g. emoji"
                      />
                    </div>
                  </div>
                </Field>
                <Field label="Audience" htmlFor="cat-audience" hint={audienceHint}>
                  <Select
                    id="cat-audience"
                    value={catForm.audience}
                    onChange={(e) => setCat("audience", e.target.value)}
                  >
                    {AUDIENCE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label="Display order"
                  htmlFor="cat-sort"
                  hint="Lower numbers appear first in the help centre."
                >
                  <TextInput
                    id="cat-sort"
                    type="number"
                    value={catForm.sortOrder}
                    onChange={(e) => setCat("sortOrder", e.target.value)}
                    className="tabular-nums"
                  />
                </Field>

                <div className="rounded-xl border border-[var(--av2-border)]">
                  <p className="border-b border-[var(--av2-border)] bg-[var(--av2-bg)] px-4 py-2.5 text-sm font-semibold">
                    Category preview
                  </p>
                  <div className="flex items-start gap-3 p-4">
                    <CategoryIcon icon={catForm.icon.trim() || null} size={40} />
                    <div className="min-w-0">
                      <p className="text-base font-semibold break-words">
                        {catForm.title.trim() || (
                          <span className="text-[var(--av2-text-2)]">Category title</span>
                        )}
                      </p>
                      <p className="mt-0.5 text-sm text-[var(--av2-text-2)]">
                        {audienceLabel(catForm.audience)}
                        {previewCount != null &&
                          ` · ${fmt(previewCount)} ${plural(previewCount, "article", "articles")}`}
                      </p>
                      {catForm.description.trim() && (
                        <p className="mt-1 text-sm break-words text-[var(--av2-text-2)]">
                          {catForm.description.trim()}
                        </p>
                      )}
                      {editingCat && (
                        <div className="mt-2">
                          <TextLink href={`/documentation/${editingCat.slug}`} external>
                            View in help centre
                          </TextLink>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </TabPanel>
          </div>

          {editingCat && (
            <div hidden={catPanelTab !== "articles"}>
              <TabPanel idPrefix={catTabIds} value="articles">
                {editingCatArticles.length === 0 ? (
                  <p className="text-sm text-[var(--av2-text-2)]">
                    No articles in this category yet.
                  </p>
                ) : (
                  <ul className="divide-y divide-[var(--av2-border)] rounded-xl border border-[var(--av2-border)]">
                    {editingCatArticles.map((a) => (
                      <li key={a.id}>
                        <button
                          type="button"
                          onClick={() => {
                            if (editorOpen && editingArt?.id === a.id) {
                              setTab("articles");
                              return;
                            }
                            void guarded(artOpenDirty, () => openEditEditor(a));
                          }}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[var(--av2-bg)] focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none focus-visible:ring-inset"
                        >
                          <span className="w-6 shrink-0 text-sm text-[var(--av2-text-2)] tabular-nums">
                            {fmt(a.sortOrder)}
                          </span>
                          <span className="min-w-0 flex-1 text-sm font-medium break-words">
                            {a.title}
                          </span>
                          <Badge tone={a.status === "PUBLISHED" ? "green" : "amber"}>
                            {a.status === "PUBLISHED" ? "Published" : "Draft"}
                          </Badge>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-4">
                  <Button
                    size="sm"
                    onClick={() =>
                      void guarded(artOpenDirty, () => openCreateEditor(editingCat.id))
                    }
                  >
                    <span aria-hidden>+</span> New article in this category
                  </Button>
                </div>
              </TabPanel>
            </div>
          )}
        </div>
      </DetailPanel>
    </form>
  );

  const categoriesView = (
    <SplitView panel={categoryPanel}>
      <Card padding="none">
        <div className="px-6 pt-5">
          <FilterBar>
            <SearchInput
              className="w-full min-w-[200px] flex-1"
              value={catSearch}
              onChange={setCatSearch}
              placeholder="Search categories…"
              label="Search categories"
            />
            <div className="w-full sm:w-48">
              <Select
                aria-label="Filter by audience"
                value={catAudienceFilter}
                onChange={(e) => setCatAudienceFilter(e.target.value)}
              >
                <option value={ALL}>All audiences</option>
                {AUDIENCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
          </FilterBar>
        </div>

        {catError && (
          <div className="px-6 pb-4">
            <Callout
              tone="error"
              title="Couldn’t load categories"
              action={
                <Button size="sm" onClick={() => void fetchCategories()}>
                  Try again
                </Button>
              }
            >
              {catError}
            </Callout>
          </div>
        )}

        {catLoading && !catLoaded ? (
          <div className="space-y-3 border-t border-[var(--av2-border)] px-6 py-5" role="status">
            <span className="sr-only">Loading categories…</span>
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !catLoaded ? null : categories.length === 0 ? (
          <div className="border-t border-[var(--av2-border)]">
            <EmptyState
              icon={<IconDocument width={28} height={28} />}
              title="No categories yet"
              description="Create your first documentation category with the editor on the right."
            />
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="border-t border-[var(--av2-border)]">
            <EmptyState
              title="No categories match these filters"
              description="Try a different search or audience."
              action={
                <Button
                  onClick={() => {
                    setCatSearch("");
                    setCatAudienceFilter(ALL);
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          </div>
        ) : (
          <Table label="Documentation categories">
            <thead>
              <tr>
                <Th className="w-20">Order</Th>
                <Th>Category</Th>
                <Th>Audience</Th>
                <Th align="right">Articles</Th>
              </tr>
            </thead>
            <tbody>
              {filteredCategories.map((cat) => (
                <Tr
                  key={cat.id}
                  selected={editingCat?.id === cat.id}
                  onSelect={() => {
                    if (editingCat?.id === cat.id) return;
                    void guarded(catDirty, () => selectCategory(cat));
                  }}
                  label={`${cat.title}, ${audienceLabel(cat.audience)}, ${cat._count.articles} articles`}
                >
                  <Td className="text-[var(--av2-text-2)] tabular-nums">{fmt(cat.sortOrder)}</Td>
                  <Td className="min-w-[220px]">
                    <div className="flex items-center gap-3">
                      <CategoryIcon icon={cat.icon} />
                      <div className="min-w-0">
                        <div className="font-semibold break-words">{cat.title}</div>
                        {cat.description && (
                          <div className="mt-0.5 line-clamp-1 text-xs text-[var(--av2-text-2)]">
                            {cat.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <Badge tone={AUDIENCE_TONE[cat.audience] ?? "neutral"}>
                      {audienceLabel(cat.audience)}
                    </Badge>
                  </Td>
                  <Td align="right">{fmt(cat._count.articles)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}

        {catLoaded && categories.length > 0 && filteredCategories.length > 0 && (
          <TableFooter>
            <span className="tabular-nums">
              Showing {fmt(filteredCategories.length)} of {fmt(categories.length)}{" "}
              {plural(categories.length, "category", "categories")}
            </span>
            <span>Order controls how categories appear in the help centre.</span>
          </TableFooter>
        )}
      </Card>
    </SplitView>
  );

  // ======================================================================
  //  Articles tab
  // ======================================================================

  const artTabIds = "doc-art";

  const statChip = (label: string, value: number) => (
    <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--av2-border)] bg-[var(--av2-surface)] px-3 text-sm">
      <span className="font-semibold tabular-nums">{artLoaded ? fmt(value) : DASH}</span>
      {label}
    </span>
  );

  const articlesList = (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        {statChip("total", articles.length)}
        {statChip("published", publishedCount)}
        {statChip("draft", draftCount)}
      </div>

      {artError && (
        <div className="mb-4">
          <Callout
            tone="error"
            title="Couldn’t load articles"
            action={
              <Button size="sm" onClick={() => void fetchArticles()}>
                Try again
              </Button>
            }
          >
            {artError}
          </Callout>
        </div>
      )}

      <Card padding="none">
        <div className="px-6 pt-5">
          <FilterBar>
            <SearchInput
              className="w-full max-w-sm min-w-[200px] flex-1"
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search articles…"
              label="Search articles by title"
            />
            <div className="w-full sm:w-40">
              <Select
                aria-label="Filter by status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "ALL" | "PUBLISHED" | "DRAFT")}
              >
                <option value="ALL">All statuses</option>
                <option value="PUBLISHED">Published</option>
                <option value="DRAFT">Draft</option>
              </Select>
            </div>
            <div className="w-full sm:w-52">
              <Select
                aria-label="Filter by category"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="ALL">All categories</option>
                {sortedCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </Select>
            </div>
          </FilterBar>
        </div>

        {artLoading && !artLoaded ? (
          <div className="space-y-3 border-t border-[var(--av2-border)] px-6 py-5" role="status">
            <span className="sr-only">Loading articles…</span>
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !artLoaded ? null : articles.length === 0 ? (
          <div className="border-t border-[var(--av2-border)]">
            <EmptyState
              icon={<IconDocument width={28} height={28} />}
              title="No doc articles yet"
              description="Create your first article to get started."
              action={
                <Button variant="primary" onClick={() => openCreateEditor()}>
                  New article
                </Button>
              }
            />
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="border-t border-[var(--av2-border)]">
            <EmptyState
              title="No articles match your filters"
              description="Try a different search, status or category."
              action={<Button onClick={resetArtFilters}>Clear filters</Button>}
            />
          </div>
        ) : (
          <Table label="Documentation articles">
            <thead>
              <tr>
                <Th>Title</Th>
                <Th>Category</Th>
                <Th align="right">Order</Th>
                <Th>Status</Th>
                <Th>Published</Th>
              </tr>
            </thead>
            <tbody>
              {artPageRows.map((art) => (
                <Tr key={art.id} onSelect={() => openEditEditor(art)} label={`Edit ${art.title}`}>
                  <Td className="min-w-[240px]">
                    <div className="font-semibold break-words">{art.title}</div>
                    {art.excerpt && (
                      <div className="mt-0.5 line-clamp-1 text-xs text-[var(--av2-text-2)]">
                        {art.excerpt}
                      </div>
                    )}
                  </Td>
                  <Td className="text-[var(--av2-text-2)]">{art.category?.title || DASH}</Td>
                  <Td align="right" className="text-[var(--av2-text-2)]">
                    {fmt(art.sortOrder)}
                  </Td>
                  <Td>
                    <Badge tone={art.status === "PUBLISHED" ? "green" : "amber"}>
                      {art.status === "PUBLISHED" ? "Published" : "Draft"}
                    </Badge>
                  </Td>
                  <Td className="whitespace-nowrap text-[var(--av2-text-2)]">
                    {formatDate(art.publishedAt)}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}

        {artLoaded && filteredArticles.length > 0 && (
          <TableFooter>
            <span className="tabular-nums">
              Showing {fmt(artPageStart + 1)}–{fmt(artPageStart + artPageRows.length)} of{" "}
              {fmt(filteredArticles.length)}
              {artFiltersActive && ` (filtered from ${fmt(articles.length)})`}
            </span>
            <div className="flex flex-wrap items-center gap-3">
              {artFiltersActive && (
                <Button size="sm" variant="ghost" onClick={resetArtFilters}>
                  Clear filters
                </Button>
              )}
              <Pager page={artCurrentPage} pageCount={artPageCount} onPage={setArtPage} />
            </div>
          </TableFooter>
        )}
      </Card>
    </>
  );

  const editorCategory = categories.find((c) => c.id === artForm.categoryId);

  const articleEditor = (
    <Card padding="none">
      <div className="px-6 pt-5">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void guarded(artOpenDirty, closeEditor)}
          className="-ml-3"
        >
          <span aria-hidden>←</span> All articles
        </Button>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="text-2xl leading-8 font-bold break-words">
            {editingArt ? editingArt.title : "New article"}
          </h2>
          {editingArt && (
            <Badge tone={editingArt.status === "PUBLISHED" ? "green" : "amber"}>
              {editingArt.status === "PUBLISHED" ? "Published" : "Draft"}
            </Badge>
          )}
        </div>
        <p className="mt-1 text-sm text-[var(--av2-text-2)]">
          {editingArt
            ? `${editingArt.category?.title ?? DASH} · /${editingArt.slug}`
            : "Write the article, choose its category, then publish when ready."}
        </p>
        <div className="mt-4">
          <Tabs
            idPrefix={artTabIds}
            label="Article editor sections"
            value={artTab}
            onChange={setArtTab}
            tabs={[
              { value: "content", label: "Content" },
              { value: "settings", label: "Settings" },
              { value: "publish", label: "SEO & publish" },
            ]}
          />
        </div>
      </div>

      <div className="px-6 py-6">
        <div hidden={artTab !== "content"}>
          <TabPanel idPrefix={artTabIds} value="content">
            <div className="space-y-5">
              <Field
                label={
                  <>
                    Title <span className="text-[var(--av2-error-text)]">*</span>
                  </>
                }
                htmlFor="art-title"
                error={artErrors.title}
              >
                <TextInput
                  id="art-title"
                  type="text"
                  value={artForm.title}
                  onChange={(e) => {
                    setArt("title", e.target.value);
                    if (artErrors.title && e.target.value.trim())
                      setArtErrors((x) => ({ ...x, title: undefined }));
                  }}
                  placeholder="Article title"
                  aria-invalid={artErrors.title ? true : undefined}
                />
              </Field>
              <Field
                label="Excerpt"
                htmlFor="art-excerpt"
                hint="Short description shown in article lists."
              >
                <TextArea
                  id="art-excerpt"
                  value={artForm.excerpt}
                  onChange={(e) => setArt("excerpt", e.target.value)}
                  rows={2}
                  className="min-h-20"
                  placeholder="Short description..."
                />
              </Field>
              <div
                onKeyDownCapture={markBodyInteracted}
                onMouseDownCapture={markBodyInteracted}
                onPasteCapture={markBodyInteracted}
                onDropCapture={markBodyInteracted}
                onCutCapture={markBodyInteracted}
              >
                <p className="mb-1.5 text-sm font-medium">Body</p>
                <RichTextEditor
                  value={artForm.body}
                  onChange={onBodyChange}
                  placeholder="Write your article..."
                  minHeight="400px"
                  enableHeadings
                />
              </div>
            </div>
          </TabPanel>
        </div>

        <div hidden={artTab !== "settings"}>
          <TabPanel idPrefix={artTabIds} value="settings">
            <div className="grid max-w-3xl gap-5 sm:grid-cols-2">
              <Field
                label={
                  <>
                    Category <span className="text-[var(--av2-error-text)]">*</span>
                  </>
                }
                htmlFor="art-category"
                error={artErrors.categoryId}
                hint={
                  editorCategory ? `Audience: ${audienceLabel(editorCategory.audience)}` : undefined
                }
              >
                <Select
                  id="art-category"
                  value={artForm.categoryId}
                  onChange={(e) => {
                    setArt("categoryId", e.target.value);
                    if (e.target.value) setArtErrors((x) => ({ ...x, categoryId: undefined }));
                  }}
                  aria-invalid={artErrors.categoryId ? true : undefined}
                >
                  <option value="">Select category...</option>
                  {sortedCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon ? `${c.icon} ` : ""}
                      {c.title}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Slug" htmlFor="art-slug" hint="Leave blank to auto-generate.">
                <TextInput
                  id="art-slug"
                  type="text"
                  value={artForm.slug}
                  onChange={(e) => setArt("slug", e.target.value)}
                  placeholder="auto-generated-from-title"
                />
              </Field>
              <Field label="Author name" htmlFor="art-author">
                <TextInput
                  id="art-author"
                  type="text"
                  value={artForm.authorName}
                  onChange={(e) => setArt("authorName", e.target.value)}
                  placeholder="Author name"
                />
              </Field>
              <Field
                label="Sort order"
                htmlFor="art-sort"
                hint="Lower numbers appear first within the category."
              >
                <TextInput
                  id="art-sort"
                  type="number"
                  value={artForm.sortOrder}
                  onChange={(e) => setArt("sortOrder", e.target.value)}
                  className="tabular-nums"
                />
              </Field>
            </div>

            {editingArt && (
              <div className="mt-8 max-w-3xl border-t border-[var(--av2-border)] pt-5">
                <h3 className="text-base font-semibold">Danger zone</h3>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                  <p className="min-w-0 flex-1 text-sm text-[var(--av2-text-2)]">
                    Deleting removes this article permanently. This cannot be undone.
                  </p>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={artSaving || deleting}
                    onClick={() =>
                      setPendingDelete({
                        kind: "article",
                        id: editingArt.id,
                        title: editingArt.title,
                      })
                    }
                  >
                    Delete article
                  </Button>
                </div>
              </div>
            )}
          </TabPanel>
        </div>

        <div hidden={artTab !== "publish"}>
          <TabPanel idPrefix={artTabIds} value="publish">
            <div className="max-w-2xl space-y-6">
              <div className="flex items-start justify-between gap-4 rounded-xl border border-[var(--av2-border)] p-4">
                <div>
                  <p id="art-published-label" className="text-sm font-medium">
                    Published
                  </p>
                  <p id="art-published-hint" className="mt-0.5 text-xs text-[var(--av2-text-2)]">
                    Published articles are live in the help centre. Drafts stay hidden.
                  </p>
                </div>
                <Switch
                  checked={artForm.published}
                  onChange={(v) => setArt("published", v)}
                  labelledBy="art-published-label"
                  describedBy="art-published-hint"
                />
              </div>

              <PanelSection title="SEO">
                <div className="space-y-4">
                  <Field label="Meta title" htmlFor="art-meta-title">
                    <TextInput
                      id="art-meta-title"
                      type="text"
                      value={artForm.metaTitle}
                      onChange={(e) => setArt("metaTitle", e.target.value)}
                      placeholder="SEO title"
                    />
                  </Field>
                  <Field label="Meta description" htmlFor="art-meta-description">
                    <TextArea
                      id="art-meta-description"
                      value={artForm.metaDescription}
                      onChange={(e) => setArt("metaDescription", e.target.value)}
                      rows={3}
                      placeholder="SEO description..."
                    />
                  </Field>
                </div>
              </PanelSection>
            </div>
          </TabPanel>
        </div>
      </div>

      <div className="border-t border-[var(--av2-border)] px-6 py-4">
        <SaveBar
          dirty={artDirty}
          status={artSaving ? "Saving…" : artDirty ? "Unsaved changes" : "No unsaved changes"}
        >
          <Button
            variant="ghost"
            onClick={() => void guarded(artOpenDirty, closeEditor)}
            disabled={artSaving || deleting}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleSaveArticle()}
            disabled={!artDirty || artSaving || deleting}
            aria-busy={artSaving}
          >
            {artSaving ? "Saving…" : editingArt ? "Save article" : "Create article"}
          </Button>
        </SaveBar>
      </div>
    </Card>
  );

  // ======================================================================
  //  Render
  // ======================================================================

  return (
    <div>
      <PageHeader
        title="Documentation"
        description="Organise help centre articles by topic and audience."
        actions={
          tab === "categories" ? (
            <Button variant="primary" onClick={() => void guarded(catDirty, clearCatForm)}>
              <span aria-hidden className="text-lg leading-none">
                +
              </span>
              New category
            </Button>
          ) : editorOpen ? undefined : (
            <Button variant="primary" onClick={() => openCreateEditor()}>
              <span aria-hidden className="text-lg leading-none">
                +
              </span>
              New article
            </Button>
          )
        }
      />

      <div className="mb-6">
        <Tabs
          idPrefix="docs-main"
          label="Documentation sections"
          value={tab}
          onChange={setTab}
          tabs={[
            {
              value: "categories",
              label: `Categories${catLoaded ? ` (${fmt(categories.length)})` : ""}`,
            },
            {
              value: "articles",
              label: `Articles${artLoaded ? ` (${fmt(articles.length)})` : ""}`,
            },
          ]}
        />
      </div>

      {tab === "categories" && (
        <TabPanel idPrefix="docs-main" value="categories">
          {categoriesView}
        </TabPanel>
      )}

      {tab === "articles" && (
        <TabPanel idPrefix="docs-main" value="articles">
          {editorOpen ? articleEditor : articlesList}
        </TabPanel>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmPendingDelete}
        loading={deleting}
        title={
          pendingDelete?.kind === "category" ? "Delete this category?" : "Delete this article?"
        }
        description={
          pendingDelete?.kind === "category"
            ? `“${pendingDelete.title}” will be deleted. Articles must be removed first.`
            : pendingDelete
              ? `“${pendingDelete.title}” will be deleted. This cannot be undone.`
              : undefined
        }
        confirmLabel="Delete"
      />
    </div>
  );
}
