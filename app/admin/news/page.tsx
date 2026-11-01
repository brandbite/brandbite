// -----------------------------------------------------------------------------
// @file: app/admin/news/page.tsx
// @purpose: Admin CMS page for managing news articles. Searchable article
//           list on the left, tabbed editor (Basics / Content / Media /
//           Publish) on the right. Below xl the two swap: the list, or the
//           editor with a "Back to articles" control, so the rich-text editor
//           keeps its width. Mirrors the Blog page (app/admin/blog/page.tsx).
// @version: v2.0.0
// @status: active
// @lastUpdate: 2026-11-01
// -----------------------------------------------------------------------------

"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useToast } from "@/components/ui/toast-provider";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { CmsImageUpload } from "@/components/ui/cms-image-upload";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Badge,
  Button,
  Callout,
  Card,
  DASH,
  EmptyState,
  Field,
  KeyValueList,
  PageHeader,
  Pager,
  PanelSection,
  SaveBar,
  SearchInput,
  Select,
  Skeleton,
  Switch,
  TabPanel,
  TableFooter,
  Tabs,
  TextArea,
  TextInput,
  TextLink,
  fmt,
  plural,
} from "@/components/admin/v2/ui";
import { IconDocument } from "@/components/admin/v2/icons";
import { IconX } from "@/components/navigation/nav-icons";
import { useUnsavedChanges } from "@/components/admin/v2/unsaved-changes";

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

type NewsArticle = {
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

type ImageValue = { storageKey: string; url: string } | null;

type StatusFilter = "ALL" | "PUBLISHED" | "DRAFT";
type EditorTab = "basics" | "content" | "media" | "publish";

type FormState = {
  title: string;
  slug: string;
  excerpt: string;
  authorName: string;
  category: string;
  tags: string;
  body: string;
  metaTitle: string;
  metaDescription: string;
  published: boolean;
  heroImage: ImageValue;
  thumbnail: ImageValue;
};

const EMPTY_FORM: FormState = {
  title: "",
  slug: "",
  excerpt: "",
  authorName: "",
  category: "",
  tags: "",
  body: "",
  metaTitle: "",
  metaDescription: "",
  published: false,
  heroImage: null,
  thumbnail: null,
};

const PAGE_SIZE = 10;
const TAB_IDS = "news-editor";
const LIST_TAB_IDS = "news-status";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const cx = (...c: unknown[]) =>
  c.filter((x): x is string => typeof x === "string" && x.length > 0).join(" ");

function formatDate(dateStr: string | null): string {
  if (!dateStr) return DASH;
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return DASH;
  }
}

function formFromArticle(article: NewsArticle): FormState {
  return {
    title: article.title,
    slug: article.slug,
    excerpt: article.excerpt ?? "",
    authorName: article.authorName ?? "",
    category: article.category ?? "",
    tags: Array.isArray(article.tags) ? article.tags.join(", ") : "",
    body: article.body ?? "",
    metaTitle: article.metaTitle ?? "",
    metaDescription: article.metaDescription ?? "",
    published: article.status === "PUBLISHED",
    heroImage:
      article.heroStorageKey && article.heroUrl
        ? { storageKey: article.heroStorageKey, url: article.heroUrl }
        : null,
    thumbnail:
      article.thumbnailStorageKey && article.thumbnailUrl
        ? { storageKey: article.thumbnailStorageKey, url: article.thumbnailUrl }
        : null,
  };
}

const sameForm = (a: FormState, b: FormState) => JSON.stringify(a) === JSON.stringify(b);

function StatusBadge({ status }: { status: NewsArticle["status"] }) {
  return status === "PUBLISHED" ? (
    <Badge tone="green">Published</Badge>
  ) : (
    <Badge tone="amber">Draft</Badge>
  );
}

function IconPlus() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function IconArrowLeft() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

/** Editor card: header (title + actions), tabs, scrolling body, sticky save bar. */
function EditorPanel({
  header,
  tabs,
  footer,
  children,
}: {
  header: ReactNode;
  tabs: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-2xl border border-[var(--av2-border)] bg-[var(--av2-surface)] xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)]">
      <div className="px-6 pt-5">
        {header}
        <div className="mt-4">{tabs}</div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">{children}</div>
      <div className="border-t border-[var(--av2-border)] px-6 py-4">{footer}</div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function AdminNewsPage() {
  const { showToast } = useToast();

  // ---- Data state ----
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- Editor state ----
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<NewsArticle | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [tab, setTab] = useState<EditorTab>("basics");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // ---- Action states ----
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<NewsArticle | null>(null);

  // The rich-text editor re-emits the loaded body as normalised HTML right
  // after it mounts. Until the user interacts with it, that output is treated
  // as the saved value so merely opening an article doesn't count as an edit.
  const [bodyBaseline, setBodyBaseline] = useState<string | null>(null);
  const bodyTouchedRef = useRef(false);

  // ---- Filters ----
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [page, setPage] = useState(1);

  // ---- Derived data ----
  const categories = useMemo(
    () =>
      Array.from(
        new Set(articles.map((p) => p.category?.trim()).filter((c): c is string => !!c)),
      ).sort((a, b) => a.localeCompare(b)),
    [articles],
  );

  const filteredArticles = useMemo(() => {
    return articles.filter((article) => {
      // Status filter
      if (statusFilter !== "ALL" && article.status !== statusFilter) return false;

      // Category filter
      if (categoryFilter !== "ALL" && (article.category?.trim() ?? "") !== categoryFilter) {
        return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const titleMatch = article.title.toLowerCase().includes(q);
        const authorMatch = article.authorName?.toLowerCase().includes(q) ?? false;
        const categoryMatch = article.category?.toLowerCase().includes(q) ?? false;
        if (!titleMatch && !authorMatch && !categoryMatch) return false;
      }

      return true;
    });
  }, [articles, statusFilter, categoryFilter, searchQuery]);

  const publishedCount = articles.filter((p) => p.status === "PUBLISHED").length;
  const draftCount = articles.length - publishedCount;

  const pageCount = Math.max(1, Math.ceil(filteredArticles.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageRows = filteredArticles.slice(pageStart, pageStart + PAGE_SIZE);

  const filtersActive =
    searchQuery.trim() !== "" || statusFilter !== "ALL" || categoryFilter !== "ALL";
  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilter("ALL");
    setCategoryFilter("ALL");
    setPage(1);
  };

  const savedForm = editingArticle ? formFromArticle(editingArticle) : EMPTY_FORM;
  const baseline = bodyBaseline === null ? savedForm : { ...savedForm, body: bodyBaseline };
  const dirty = editorOpen && !sameForm(form, baseline);
  const confirmDiscard = useUnsavedChanges(dirty, "News article");

  // --------------------------------------------------------------------------
  //  API: Fetch articles
  // --------------------------------------------------------------------------

  const fetchArticles = useCallback(async (): Promise<NewsArticle[] | null> => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/news", { cache: "no-store" });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 401) throw new Error("You must be signed in as an admin.");
        if (res.status === 403) throw new Error("You do not have permission to manage news.");
        throw new Error(json?.error || `Request failed with status ${res.status}`);
      }

      const fresh: NewsArticle[] = json?.articles ?? [];
      setArticles(fresh);
      setLoaded(true);
      return fresh;
    } catch (err: any) {
      setError(err?.message || "Failed to load news articles.");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  // --------------------------------------------------------------------------
  //  Editor helpers
  // --------------------------------------------------------------------------

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (key === "title") setTitleError(null);
    setSaveSuccess(null);
  };

  /** Below xl the list hides while editing; bring the editor into view. */
  const scrollToEditorOnSmallScreens = () => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1279px)").matches) {
      window.scrollTo({ top: 0 });
    }
  };

  const resetBodyTracking = () => {
    setBodyBaseline(null);
    bodyTouchedRef.current = false;
  };

  const handleBodyChange = (html: string) => {
    if (bodyTouchedRef.current) {
      set("body", html);
    } else {
      setBodyBaseline(html);
      setForm((f) => ({ ...f, body: html }));
    }
  };

  const markBodyTouched = () => {
    bodyTouchedRef.current = true;
  };

  const openCreate = () => {
    resetBodyTracking();
    setEditingArticle(null);
    setForm(EMPTY_FORM);
    setTab("basics");
    setTitleError(null);
    setSaveSuccess(null);
    setEditorOpen(true);
    scrollToEditorOnSmallScreens();
  };

  const openEdit = (article: NewsArticle, keepTab = false) => {
    resetBodyTracking();
    setEditingArticle(article);
    setForm(formFromArticle(article));
    if (!keepTab) setTab("basics");
    setTitleError(null);
    if (!keepTab) setSaveSuccess(null);
    setEditorOpen(true);
    if (!keepTab) scrollToEditorOnSmallScreens();
  };

  const closeEditor = () => {
    resetBodyTracking();
    setEditorOpen(false);
    setEditingArticle(null);
    setForm(EMPTY_FORM);
    setTitleError(null);
    setSaveSuccess(null);
  };

  /** Run `fn` now, or after the user agrees to drop unsaved edits. */
  const guard = async (fn: () => void) => {
    if (await confirmDiscard()) fn();
  };

  // --------------------------------------------------------------------------
  //  API: Save (create / update)
  // --------------------------------------------------------------------------

  const handleSave = async (e?: FormEvent) => {
    e?.preventDefault();

    if (!form.title.trim()) {
      setTitleError("Title is required.");
      setTab("basics");
      showToast({ type: "error", title: "Title is required." });
      return;
    }

    setSaving(true);

    try {
      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        slug: form.slug.trim() || undefined,
        excerpt: form.excerpt.trim() || null,
        authorName: form.authorName.trim() || null,
        category: form.category.trim() || null,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        body: form.body || null,
        metaTitle: form.metaTitle.trim() || null,
        metaDescription: form.metaDescription.trim() || null,
        status: form.published ? "PUBLISHED" : "DRAFT",
        heroStorageKey: form.heroImage?.storageKey ?? null,
        heroUrl: form.heroImage?.url ?? null,
        thumbnailStorageKey: form.thumbnail?.storageKey ?? null,
        thumbnailUrl: form.thumbnail?.url ?? null,
      };

      const isEditing = !!editingArticle;
      const url = isEditing ? `/api/admin/news/${editingArticle!.id}` : "/api/admin/news";
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

      const msg = isEditing ? "News article updated." : "News article created.";
      showToast({ type: "success", title: msg });

      const fresh = await fetchArticles();
      // Re-sync the editor with the saved record so the dirty state clears
      // (a new article opens for further editing with its generated slug).
      const savedId: string | undefined = isEditing ? editingArticle!.id : json?.article?.id;
      const saved = savedId ? fresh?.find((p) => p.id === savedId) : undefined;
      if (saved) {
        openEdit(saved, true);
        setSaveSuccess(msg);
      } else {
        closeEditor();
      }
    } catch (err: any) {
      showToast({ type: "error", title: err?.message || "Failed to save." });
    } finally {
      setSaving(false);
    }
  };

  // --------------------------------------------------------------------------
  //  API: Delete
  // --------------------------------------------------------------------------

  const handleDelete = async (articleId: string) => {
    setDeleting(true);

    try {
      const res = await fetch(`/api/admin/news/${articleId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || `Delete failed with status ${res.status}`);
      }

      showToast({ type: "success", title: "Article deleted." });
      setDeleteTarget(null);
      await fetchArticles();
      if (editingArticle?.id === articleId) closeEditor();
    } catch (err: any) {
      showToast({ type: "error", title: err?.message || "Failed to delete." });
    } finally {
      setDeleting(false);
    }
  };

  // --------------------------------------------------------------------------
  //  Render: list
  // --------------------------------------------------------------------------

  const list = (
    <Card padding="none">
      <div className="px-6 pt-4">
        <Tabs
          idPrefix={LIST_TAB_IDS}
          label="Filter articles by status"
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
          tabs={[
            { value: "ALL", label: `All (${loaded ? fmt(articles.length) : DASH})` },
            { value: "PUBLISHED", label: `Published (${loaded ? fmt(publishedCount) : DASH})` },
            { value: "DRAFT", label: `Drafts (${loaded ? fmt(draftCount) : DASH})` },
          ]}
        />
        <div className="flex flex-wrap items-center gap-3 py-4">
          <SearchInput
            className="min-w-[200px] flex-1"
            value={searchQuery}
            onChange={(v) => {
              setSearchQuery(v);
              setPage(1);
            }}
            placeholder="Search articles"
            label="Search articles by title, author or category"
          />
          {categories.length > 0 && (
            <div className="w-full sm:w-44">
              <Select
                aria-label="Filter by category"
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>
      </div>

      <TabPanel idPrefix={LIST_TAB_IDS} value={statusFilter}>
        {loading && !loaded ? (
          <div className="space-y-3 border-t border-[var(--av2-border)] px-6 py-5" role="status">
            <span className="sr-only">Loading news articles…</span>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : articles.length === 0 ? (
          <div className="border-t border-[var(--av2-border)]">
            <EmptyState
              icon={<IconDocument width={28} height={28} />}
              title="No news articles yet"
              description="Create your first article with the New article button."
            />
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="border-t border-[var(--av2-border)]">
            <EmptyState
              title="No articles match these filters"
              description="Try a different search, status or category."
              action={<Button onClick={resetFilters}>Clear filters</Button>}
            />
          </div>
        ) : (
          <ul className="border-t border-[var(--av2-border)]" aria-label="News articles">
            {pageRows.map((article) => {
              const active = editorOpen && editingArticle?.id === article.id;
              const meta = [article.authorName, article.category].filter(Boolean).join(" · ");
              return (
                <li
                  key={article.id}
                  className="border-b border-[var(--av2-border)] last:border-b-0"
                >
                  <button
                    type="button"
                    aria-current={active ? "true" : undefined}
                    onClick={() => {
                      if (active) return;
                      void guard(() => openEdit(article));
                    }}
                    className={cx(
                      "flex w-full items-start gap-4 px-6 py-4 text-left transition-colors",
                      "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--av2-accent)]",
                      active
                        ? "bg-[var(--av2-selected)] shadow-[inset_3px_0_0_var(--av2-accent)]"
                        : "hover:bg-[var(--av2-bg)]",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-base leading-6 font-semibold">
                        {article.title}
                      </p>
                      <p className="mt-1 truncate text-sm text-[var(--av2-text-2)]">
                        {meta || "No author or category"}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <StatusBadge status={article.status} />
                      <span className="text-sm whitespace-nowrap text-[var(--av2-text-2)] tabular-nums">
                        {article.status === "PUBLISHED"
                          ? formatDate(article.publishedAt)
                          : `Updated ${formatDate(article.updatedAt)}`}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </TabPanel>

      {loaded && articles.length > 0 && (
        <TableFooter>
          <span className="tabular-nums">
            {filteredArticles.length === 0
              ? `Showing 0 of ${fmt(articles.length)} ${plural(articles.length, "article", "articles")}`
              : `Showing ${fmt(pageStart + 1)}–${fmt(
                  Math.min(pageStart + PAGE_SIZE, filteredArticles.length),
                )} of ${fmt(filteredArticles.length)} ${plural(
                  filteredArticles.length,
                  "article",
                  "articles",
                )}`}
          </span>
          {pageCount > 1 ? (
            <Pager page={currentPage} pageCount={pageCount} onPage={setPage} />
          ) : filtersActive ? (
            <Button size="sm" variant="ghost" onClick={resetFilters}>
              Clear filters
            </Button>
          ) : null}
        </TableFooter>
      )}
    </Card>
  );

  // --------------------------------------------------------------------------
  //  Render: editor
  // --------------------------------------------------------------------------

  const publicHref =
    editingArticle && editingArticle.status === "PUBLISHED" ? `/news/${editingArticle.slug}` : null;
  const previewMeta = [form.authorName.trim(), form.category.trim()].filter(Boolean);

  const editorHeader = (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <button
          type="button"
          onClick={() => void guard(closeEditor)}
          className="mb-3 inline-flex items-center gap-1.5 rounded text-sm font-semibold text-[var(--av2-text-2)] hover:text-[var(--av2-text)] focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none xl:hidden"
        >
          <IconArrowLeft />
          Back to articles
        </button>
        <h2 className="flex flex-wrap items-center gap-3 text-xl leading-7 font-semibold">
          {editingArticle ? "Edit article" : "New article"}
          {editingArticle ? (
            <StatusBadge status={editingArticle.status} />
          ) : (
            <Badge>Not saved yet</Badge>
          )}
        </h2>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {publicHref && (
          <span className="hidden sm:inline-flex">
            <TextLink href={publicHref} external>
              View on site
            </TextLink>
          </span>
        )}
        {editingArticle && (
          <Button
            size="sm"
            variant="danger"
            onClick={() => setDeleteTarget(editingArticle)}
            disabled={saving || deleting}
          >
            Delete
          </Button>
        )}
        <button
          type="button"
          onClick={() => void guard(closeEditor)}
          aria-label="Close editor"
          className="hidden h-9 w-9 items-center justify-center rounded-lg text-[var(--av2-text-2)] hover:bg-[var(--av2-bg)] focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none xl:flex"
        >
          <IconX width={18} height={18} />
        </button>
      </div>
    </div>
  );

  const editorTabs = (
    <Tabs
      idPrefix={TAB_IDS}
      label="Article editor sections"
      value={tab}
      onChange={setTab}
      tabs={[
        {
          value: "basics",
          label: titleError ? (
            <span className="inline-flex items-center gap-1.5">
              Basics
              <span
                aria-label="has an error"
                className="h-2 w-2 rounded-full bg-[var(--av2-error)]"
              />
            </span>
          ) : (
            "Basics"
          ),
        },
        { value: "content", label: "Content" },
        { value: "media", label: "Media" },
        { value: "publish", label: "Publish & SEO" },
      ]}
    />
  );

  const editorFooter = (
    <SaveBar
      dirty={dirty}
      status={
        saving
          ? "Saving…"
          : dirty
            ? "Unsaved changes"
            : saveSuccess
              ? saveSuccess
              : editingArticle
                ? "No unsaved changes"
                : "Add a title to create the article"
      }
    >
      {dirty && (
        <Button
          variant="ghost"
          disabled={saving || deleting}
          onClick={() => {
            setForm(baseline);
            setTitleError(null);
            bodyTouchedRef.current = false;
          }}
        >
          Discard
        </Button>
      )}
      <Button type="submit" variant="primary" disabled={!dirty || saving || deleting}>
        {saving ? "Saving…" : editingArticle ? "Save changes" : "Create article"}
      </Button>
    </SaveBar>
  );

  // Panels stay mounted (hidden) so the rich-text editor keeps its state and
  // every field remains part of the form while another tab is showing.
  const editor = (
    <form onSubmit={handleSave} noValidate>
      <EditorPanel header={editorHeader} tabs={editorTabs} footer={editorFooter}>
        <div hidden={tab !== "basics"}>
          <TabPanel idPrefix={TAB_IDS} value="basics">
            <div className="space-y-5">
              <Field label="Title" htmlFor="news-title" error={titleError ?? undefined}>
                <TextInput
                  id="news-title"
                  type="text"
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="Article title"
                  required
                  aria-required
                  aria-invalid={!!titleError}
                />
              </Field>

              <Field label="Slug" htmlFor="news-slug" hint="Leave blank to auto-generate.">
                <TextInput
                  id="news-slug"
                  type="text"
                  value={form.slug}
                  onChange={(e) => set("slug", e.target.value)}
                  placeholder="auto-generated-from-title"
                />
              </Field>

              <Field label="Excerpt" htmlFor="news-excerpt">
                <TextArea
                  id="news-excerpt"
                  value={form.excerpt}
                  onChange={(e) => set("excerpt", e.target.value)}
                  rows={3}
                  placeholder="Short summary for listing cards..."
                />
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Author name" htmlFor="news-author">
                  <TextInput
                    id="news-author"
                    type="text"
                    value={form.authorName}
                    onChange={(e) => set("authorName", e.target.value)}
                    placeholder="Author name"
                  />
                </Field>
                <Field label="Category" htmlFor="news-category">
                  <TextInput
                    id="news-category"
                    type="text"
                    value={form.category}
                    onChange={(e) => set("category", e.target.value)}
                    placeholder="e.g. Company, Product"
                  />
                </Field>
              </div>

              <Field label="Tags" htmlFor="news-tags" hint="Comma-separated list.">
                <TextInput
                  id="news-tags"
                  type="text"
                  value={form.tags}
                  onChange={(e) => set("tags", e.target.value)}
                  placeholder="news, update, launch"
                />
              </Field>

              <div className="overflow-hidden rounded-xl border border-[var(--av2-border)]">
                <p className="border-b border-[var(--av2-border)] bg-[var(--av2-bg)] px-4 py-3 text-sm font-semibold">
                  Listing preview
                </p>
                <div className="flex gap-4 px-4 py-4">
                  {form.thumbnail?.url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={form.thumbnail.url}
                      alt=""
                      className="h-16 w-20 shrink-0 rounded-lg object-cover"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-lg leading-7 font-semibold break-words">
                      {form.title.trim() || (
                        <span className="text-[var(--av2-text-2)]">Untitled article</span>
                      )}
                    </p>
                    {form.excerpt.trim() && (
                      <p className="mt-1 line-clamp-2 text-sm text-[var(--av2-text-2)]">
                        {form.excerpt.trim()}
                      </p>
                    )}
                    <p className="mt-1 text-sm text-[var(--av2-text-2)]">
                      {[...previewMeta, formatDate(editingArticle?.publishedAt ?? null)].join(
                        " · ",
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </TabPanel>
        </div>

        <div hidden={tab !== "content"}>
          <TabPanel idPrefix={TAB_IDS} value="content">
            <p className="mb-1.5 text-sm font-medium">Body</p>
            <div
              onKeyDownCapture={markBodyTouched}
              onMouseDownCapture={markBodyTouched}
              onPasteCapture={markBodyTouched}
              onDropCapture={markBodyTouched}
              onCompositionStartCapture={markBodyTouched}
            >
              <RichTextEditor
                value={form.body}
                onChange={handleBodyChange}
                placeholder="Write your article..."
                minHeight="400px"
                enableHeadings
                className="rounded-lg! border-[var(--av2-border)]! bg-[var(--av2-surface)]!"
              />
            </div>
          </TabPanel>
        </div>

        <div hidden={tab !== "media"}>
          <TabPanel idPrefix={TAB_IDS} value="media">
            <p className="mb-5 text-sm text-[var(--av2-text-2)]">
              The hero image leads the article page; the thumbnail is used on listing cards.
            </p>
            <div className="grid gap-6 sm:grid-cols-2">
              <CmsImageUpload
                type="blog"
                value={form.heroImage}
                onChange={(v) => set("heroImage", v)}
                label="Hero Image"
                aspectRatio="16/9"
              />
              <CmsImageUpload
                type="blog"
                value={form.thumbnail}
                onChange={(v) => set("thumbnail", v)}
                label="Thumbnail"
                aspectRatio="4/3"
              />
            </div>
          </TabPanel>
        </div>

        <div hidden={tab !== "publish"}>
          <TabPanel idPrefix={TAB_IDS} value="publish">
            <PanelSection title="Visibility">
              <Switch
                checked={form.published}
                onChange={(v) => set("published", v)}
                label="Published"
              />
              <p className="mt-2 text-sm text-[var(--av2-text-2)]">
                {form.published
                  ? "Live on the website once saved."
                  : "Draft. Only visible here until you publish it."}
              </p>
              <div className="mt-5">
                <KeyValueList
                  rows={[
                    {
                      label: "Published on",
                      value: editingArticle?.publishedAt
                        ? formatDate(editingArticle.publishedAt)
                        : form.published
                          ? "Set when you save"
                          : DASH,
                    },
                    { label: "Created", value: formatDate(editingArticle?.createdAt ?? null) },
                    { label: "Last updated", value: formatDate(editingArticle?.updatedAt ?? null) },
                  ]}
                />
              </div>
            </PanelSection>

            <PanelSection title="SEO">
              <div className="space-y-5">
                <Field label="Meta title" htmlFor="news-meta-title">
                  <TextInput
                    id="news-meta-title"
                    type="text"
                    value={form.metaTitle}
                    onChange={(e) => set("metaTitle", e.target.value)}
                    placeholder="SEO title"
                  />
                </Field>
                <Field label="Meta description" htmlFor="news-meta-description">
                  <TextArea
                    id="news-meta-description"
                    value={form.metaDescription}
                    onChange={(e) => set("metaDescription", e.target.value)}
                    rows={2}
                    placeholder="SEO description..."
                  />
                </Field>
              </div>
            </PanelSection>
          </TabPanel>
        </div>
      </EditorPanel>
    </form>
  );

  const editorPlaceholder = (
    <Card>
      <EmptyState
        icon={<IconDocument width={28} height={28} />}
        title="Select an article to edit"
        description="Pick an article from the list, or start a new one."
        action={<Button onClick={() => openCreate()}>New article</Button>}
      />
    </Card>
  );

  // --------------------------------------------------------------------------
  //  Render
  // --------------------------------------------------------------------------

  return (
    <>
      <PageHeader
        title="News"
        description="Manage news articles shown on the website."
        actions={
          <Button variant="primary" onClick={() => void guard(openCreate)}>
            <IconPlus />
            New article
          </Button>
        }
      />

      {error && (
        <div className="mb-6">
          <Callout tone="error" title="Couldn't load news articles">
            {error}
          </Callout>
        </div>
      )}

      {/* List and editor side by side on xl; one at a time below that. */}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className={cx("min-w-0", editorOpen && "hidden xl:block")}>{list}</div>
        <div className={cx("min-w-0", !editorOpen && "hidden xl:block")}>
          {editorOpen ? editor : editorPlaceholder}
        </div>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => !deleting && setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget.id)}
        loading={deleting}
        variant="danger"
        title="Delete this article?"
        description={
          deleteTarget
            ? `"${deleteTarget.title}" will be removed permanently. This action cannot be undone.`
            : undefined
        }
        confirmLabel="Delete article"
      />
    </>
  );
}
