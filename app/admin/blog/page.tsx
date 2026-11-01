// -----------------------------------------------------------------------------
// @file: app/admin/blog/page.tsx
// @purpose: Admin CMS page for managing blog posts. Searchable post list on
//           the left, tabbed editor (Basics / Content / Media / Publish) on
//           the right. Below xl the two swap: the list, or the editor with a
//           "Back to posts" control, so the rich-text editor keeps its width.
//           News (app/admin/news/page.tsx) mirrors this structure.
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
const TAB_IDS = "blog-editor";
const LIST_TAB_IDS = "blog-status";

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

function formFromPost(post: BlogPost): FormState {
  return {
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt ?? "",
    authorName: post.authorName ?? "",
    category: post.category ?? "",
    tags: Array.isArray(post.tags) ? post.tags.join(", ") : "",
    body: post.body ?? "",
    metaTitle: post.metaTitle ?? "",
    metaDescription: post.metaDescription ?? "",
    published: post.status === "PUBLISHED",
    heroImage:
      post.heroStorageKey && post.heroUrl
        ? { storageKey: post.heroStorageKey, url: post.heroUrl }
        : null,
    thumbnail:
      post.thumbnailStorageKey && post.thumbnailUrl
        ? { storageKey: post.thumbnailStorageKey, url: post.thumbnailUrl }
        : null,
  };
}

const sameForm = (a: FormState, b: FormState) => JSON.stringify(a) === JSON.stringify(b);

function StatusBadge({ status }: { status: BlogPost["status"] }) {
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

export default function AdminBlogPage() {
  const { showToast } = useToast();

  // ---- Data state ----
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- Editor state ----
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [tab, setTab] = useState<EditorTab>("basics");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // ---- Action states ----
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BlogPost | null>(null);
  const [pendingNav, setPendingNav] = useState<(() => void) | null>(null);

  // The rich-text editor re-emits the loaded body as normalised HTML right
  // after it mounts. Until the user interacts with it, that output is treated
  // as the saved value so merely opening a post doesn't count as an edit.
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
        new Set(posts.map((p) => p.category?.trim()).filter((c): c is string => !!c)),
      ).sort((a, b) => a.localeCompare(b)),
    [posts],
  );

  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      // Status filter
      if (statusFilter !== "ALL" && post.status !== statusFilter) return false;

      // Category filter
      if (categoryFilter !== "ALL" && (post.category?.trim() ?? "") !== categoryFilter) {
        return false;
      }

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
  }, [posts, statusFilter, categoryFilter, searchQuery]);

  const publishedCount = posts.filter((p) => p.status === "PUBLISHED").length;
  const draftCount = posts.length - publishedCount;

  const pageCount = Math.max(1, Math.ceil(filteredPosts.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageRows = filteredPosts.slice(pageStart, pageStart + PAGE_SIZE);

  const filtersActive =
    searchQuery.trim() !== "" || statusFilter !== "ALL" || categoryFilter !== "ALL";
  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilter("ALL");
    setCategoryFilter("ALL");
    setPage(1);
  };

  const savedForm = editingPost ? formFromPost(editingPost) : EMPTY_FORM;
  const baseline = bodyBaseline === null ? savedForm : { ...savedForm, body: bodyBaseline };
  const dirty = editorOpen && !sameForm(form, baseline);

  // --------------------------------------------------------------------------
  //  API: Fetch posts
  // --------------------------------------------------------------------------

  const fetchPosts = useCallback(async (): Promise<BlogPost[] | null> => {
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

      const fresh = (json as BlogPostsResponse).posts;
      setPosts(fresh);
      setLoaded(true);
      return fresh;
    } catch (err: any) {
      console.error("[admin/blog] fetch error:", err);
      setError(err?.message || "Failed to load blog posts.");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

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
    setEditingPost(null);
    setForm(EMPTY_FORM);
    setTab("basics");
    setTitleError(null);
    setSaveSuccess(null);
    setEditorOpen(true);
    scrollToEditorOnSmallScreens();
  };

  const openEdit = (post: BlogPost, keepTab = false) => {
    resetBodyTracking();
    setEditingPost(post);
    setForm(formFromPost(post));
    if (!keepTab) setTab("basics");
    setTitleError(null);
    if (!keepTab) setSaveSuccess(null);
    setEditorOpen(true);
    if (!keepTab) scrollToEditorOnSmallScreens();
  };

  const closeEditor = () => {
    resetBodyTracking();
    setEditorOpen(false);
    setEditingPost(null);
    setForm(EMPTY_FORM);
    setTitleError(null);
    setSaveSuccess(null);
  };

  /** Run `fn` now, or after the user agrees to drop unsaved edits. */
  const guard = (fn: () => void) => {
    if (dirty) setPendingNav(() => fn);
    else fn();
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

      const fresh = await fetchPosts();
      // Re-sync the editor with the saved record so the dirty state clears
      // (a new post opens for further editing with its generated slug).
      const savedId: string | undefined = isEditing ? editingPost!.id : json?.post?.id;
      const saved = savedId ? fresh?.find((p) => p.id === savedId) : undefined;
      if (saved) {
        openEdit(saved, true);
        setSaveSuccess(msg);
      } else {
        closeEditor();
      }
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
      setDeleteTarget(null);
      await fetchPosts();
      if (editingPost?.id === postId) closeEditor();
    } catch (err: any) {
      console.error("[admin/blog] delete error:", err);
      showToast({ type: "error", title: err?.message || "Failed to delete blog post." });
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
          label="Filter posts by status"
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
          tabs={[
            { value: "ALL", label: `All (${loaded ? fmt(posts.length) : DASH})` },
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
            placeholder="Search posts"
            label="Search posts by title, author or category"
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
            <span className="sr-only">Loading blog posts…</span>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="border-t border-[var(--av2-border)]">
            <EmptyState
              icon={<IconDocument width={28} height={28} />}
              title="No blog posts yet"
              description="Create your first post with the New post button."
            />
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="border-t border-[var(--av2-border)]">
            <EmptyState
              title="No posts match these filters"
              description="Try a different search, status or category."
              action={<Button onClick={resetFilters}>Clear filters</Button>}
            />
          </div>
        ) : (
          <ul className="border-t border-[var(--av2-border)]" aria-label="Blog posts">
            {pageRows.map((post) => {
              const active = editorOpen && editingPost?.id === post.id;
              const meta = [post.authorName, post.category].filter(Boolean).join(" · ");
              return (
                <li key={post.id} className="border-b border-[var(--av2-border)] last:border-b-0">
                  <button
                    type="button"
                    aria-current={active ? "true" : undefined}
                    onClick={() => {
                      if (active) return;
                      guard(() => openEdit(post));
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
                      <p className="line-clamp-2 text-base leading-6 font-semibold">{post.title}</p>
                      <p className="mt-1 truncate text-sm text-[var(--av2-text-2)]">
                        {meta || "No author or category"}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <StatusBadge status={post.status} />
                      <span className="text-sm whitespace-nowrap text-[var(--av2-text-2)] tabular-nums">
                        {post.status === "PUBLISHED"
                          ? formatDate(post.publishedAt)
                          : `Updated ${formatDate(post.updatedAt)}`}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </TabPanel>

      {loaded && posts.length > 0 && (
        <TableFooter>
          <span className="tabular-nums">
            {filteredPosts.length === 0
              ? `Showing 0 of ${fmt(posts.length)} ${plural(posts.length, "post", "posts")}`
              : `Showing ${fmt(pageStart + 1)}–${fmt(
                  Math.min(pageStart + PAGE_SIZE, filteredPosts.length),
                )} of ${fmt(filteredPosts.length)} ${plural(
                  filteredPosts.length,
                  "post",
                  "posts",
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
    editingPost && editingPost.status === "PUBLISHED" ? `/blog/${editingPost.slug}` : null;
  const previewMeta = [form.authorName.trim(), form.category.trim()].filter(Boolean);

  const editorHeader = (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <button
          type="button"
          onClick={() => guard(closeEditor)}
          className="mb-3 inline-flex items-center gap-1.5 rounded text-sm font-semibold text-[var(--av2-text-2)] hover:text-[var(--av2-text)] focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none xl:hidden"
        >
          <IconArrowLeft />
          Back to posts
        </button>
        <h2 className="flex flex-wrap items-center gap-3 text-xl leading-7 font-semibold">
          {editingPost ? "Edit post" : "New post"}
          {editingPost ? <StatusBadge status={editingPost.status} /> : <Badge>Not saved yet</Badge>}
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
        {editingPost && (
          <Button
            size="sm"
            variant="danger"
            onClick={() => setDeleteTarget(editingPost)}
            disabled={saving || deleting}
          >
            Delete
          </Button>
        )}
        <button
          type="button"
          onClick={() => guard(closeEditor)}
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
      label="Post editor sections"
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
              : editingPost
                ? "No unsaved changes"
                : "Add a title to create the post"
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
        {saving ? "Saving…" : editingPost ? "Save changes" : "Create post"}
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
              <Field label="Title" htmlFor="blog-title" error={titleError ?? undefined}>
                <TextInput
                  id="blog-title"
                  type="text"
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="Post title"
                  required
                  aria-required
                  aria-invalid={!!titleError}
                />
              </Field>

              <Field
                label="Slug"
                htmlFor="blog-slug"
                hint="Leave blank to auto-generate from title."
              >
                <TextInput
                  id="blog-slug"
                  type="text"
                  value={form.slug}
                  onChange={(e) => set("slug", e.target.value)}
                  placeholder="auto-generated-from-title"
                />
              </Field>

              <Field label="Excerpt" htmlFor="blog-excerpt">
                <TextArea
                  id="blog-excerpt"
                  value={form.excerpt}
                  onChange={(e) => set("excerpt", e.target.value)}
                  rows={3}
                  placeholder="Short summary for listing cards..."
                />
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Author name" htmlFor="blog-author">
                  <TextInput
                    id="blog-author"
                    type="text"
                    value={form.authorName}
                    onChange={(e) => set("authorName", e.target.value)}
                    placeholder="Author name"
                  />
                </Field>
                <Field label="Category" htmlFor="blog-category">
                  <TextInput
                    id="blog-category"
                    type="text"
                    value={form.category}
                    onChange={(e) => set("category", e.target.value)}
                    placeholder="e.g. Design, Marketing"
                  />
                </Field>
              </div>

              <Field label="Tags" htmlFor="blog-tags" hint="Comma-separated list.">
                <TextInput
                  id="blog-tags"
                  type="text"
                  value={form.tags}
                  onChange={(e) => set("tags", e.target.value)}
                  placeholder="design, branding, tips"
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
                        <span className="text-[var(--av2-text-2)]">Untitled post</span>
                      )}
                    </p>
                    {form.excerpt.trim() && (
                      <p className="mt-1 line-clamp-2 text-sm text-[var(--av2-text-2)]">
                        {form.excerpt.trim()}
                      </p>
                    )}
                    <p className="mt-1 text-sm text-[var(--av2-text-2)]">
                      {[...previewMeta, formatDate(editingPost?.publishedAt ?? null)].join(" · ")}
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
                placeholder="Write your blog post..."
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
              The hero image leads the post page; the thumbnail is used on listing cards.
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
                      value: editingPost?.publishedAt
                        ? formatDate(editingPost.publishedAt)
                        : form.published
                          ? "Set when you save"
                          : DASH,
                    },
                    { label: "Created", value: formatDate(editingPost?.createdAt ?? null) },
                    { label: "Last updated", value: formatDate(editingPost?.updatedAt ?? null) },
                  ]}
                />
              </div>
            </PanelSection>

            <PanelSection title="SEO">
              <div className="space-y-5">
                <Field label="Meta title" htmlFor="blog-meta-title">
                  <TextInput
                    id="blog-meta-title"
                    type="text"
                    value={form.metaTitle}
                    onChange={(e) => set("metaTitle", e.target.value)}
                    placeholder="SEO title (defaults to post title)"
                  />
                </Field>
                <Field label="Meta description" htmlFor="blog-meta-description">
                  <TextArea
                    id="blog-meta-description"
                    value={form.metaDescription}
                    onChange={(e) => set("metaDescription", e.target.value)}
                    rows={2}
                    placeholder="SEO description for search engines..."
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
        title="Select a post to edit"
        description="Pick a post from the list, or start a new one."
        action={<Button onClick={() => openCreate()}>New post</Button>}
      />
    </Card>
  );

  // --------------------------------------------------------------------------
  //  Render
  // --------------------------------------------------------------------------

  return (
    <>
      <PageHeader
        title="Blog"
        description="Manage blog posts shown on the website."
        actions={
          <Button variant="primary" onClick={() => guard(openCreate)}>
            <IconPlus />
            New post
          </Button>
        }
      />

      {error && (
        <div className="mb-6">
          <Callout tone="error" title="Couldn't load blog posts">
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
        title="Delete this blog post?"
        description={
          deleteTarget
            ? `"${deleteTarget.title}" will be removed permanently. This action cannot be undone.`
            : undefined
        }
        confirmLabel="Delete post"
      />

      <ConfirmDialog
        open={pendingNav !== null}
        onClose={() => setPendingNav(null)}
        onConfirm={() => {
          const next = pendingNav;
          setPendingNav(null);
          next?.();
        }}
        variant="warning"
        title="Discard unsaved changes?"
        description="Your edits to this post haven't been saved and will be lost."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
      />
    </>
  );
}
