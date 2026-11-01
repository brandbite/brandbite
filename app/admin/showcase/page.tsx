// -----------------------------------------------------------------------------
// @file: app/admin/showcase/page.tsx
// @purpose: Admin CMS page for managing showcase portfolio works. Portfolio
//           list on the left, editor panel on the right. The editor splits a
//           work into Details / Media / Content / Publishing tabs.
// @version: v2.0.0
// @status: active
// @lastUpdate: 2026-11-01
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ui/toast-provider";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { CmsImageUpload } from "@/components/ui/cms-image-upload";
import { CmsGalleryUpload } from "@/components/ui/cms-gallery-upload";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Badge,
  Button,
  Callout,
  Card,
  CardTitle,
  DASH,
  DetailPanel,
  EmptyState,
  Field,
  FilterBar,
  KeyValueList,
  PageHeader,
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
  TextInput,
  Th,
  Tr,
  fmt,
  plural,
} from "@/components/admin/v2/ui";
import { IconPortfolio } from "@/components/navigation/nav-icons";

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

type EditorTab = "details" | "media" | "content" | "publishing";
type StatusFilter = "ALL" | "PUBLISHED" | "DRAFT";

type FormState = {
  title: string;
  slug: string;
  subtitle: string;
  clientName: string;
  category: string;
  tags: string;
  thumbnail: ImageRef | null;
  hero: ImageRef | null;
  gallery: GalleryImage[];
  description: string;
  published: boolean;
  sortOrder: string;
};

const EMPTY_FORM: FormState = {
  title: "",
  slug: "",
  subtitle: "",
  clientName: "",
  category: "",
  tags: "",
  thumbnail: null,
  hero: null,
  gallery: [],
  description: "",
  published: false,
  sortOrder: "0",
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
  if (!dateStr) return DASH;
  return new Date(dateStr).toLocaleDateString();
}

const formFromWork = (work: ShowcaseWork): FormState => ({
  title: work.title,
  slug: work.slug,
  subtitle: work.subtitle ?? "",
  clientName: work.clientName ?? "",
  category: work.category ?? "",
  tags: work.tags.join(", "),
  thumbnail:
    work.thumbnailStorageKey && work.thumbnailUrl
      ? { storageKey: work.thumbnailStorageKey, url: work.thumbnailUrl }
      : null,
  hero:
    work.heroStorageKey && work.heroUrl
      ? { storageKey: work.heroStorageKey, url: work.heroUrl }
      : null,
  gallery: (work.galleryImages as GalleryImage[]) ?? [],
  description: work.description ?? "",
  published: work.status === "PUBLISHED",
  sortOrder: String(work.sortOrder),
});

const sameForm = (a: FormState, b: FormState) => JSON.stringify(a) === JSON.stringify(b);

function IconPlus() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function IconImage() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="m21 16-5-5-9 9" />
    </svg>
  );
}

function Thumb({ url }: { url: string | null }) {
  return url ? (
    <img
      src={url}
      alt=""
      className="h-12 w-12 shrink-0 rounded-lg border border-[var(--av2-border)] object-cover"
      loading="lazy"
    />
  ) : (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[var(--av2-border)] bg-[var(--av2-bg)] text-[var(--av2-text-2)]">
      <IconImage />
    </span>
  );
}

const StatusBadge = ({ status }: { status: ShowcaseWork["status"] }) =>
  status === "PUBLISHED" ? <Badge tone="green">Published</Badge> : <Badge>Draft</Badge>;

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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  // ---- Selection / editing ----
  const [selected, setSelected] = useState<ShowcaseWork | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [tab, setTab] = useState<EditorTab>("details");
  const [titleError, setTitleError] = useState<string | null>(null);

  // ---- Mutation state ----
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  /* ---------------------------------------------------------------------- */
  /*  Derived data                                                           */
  /* ---------------------------------------------------------------------- */

  const works = useMemo(() => data?.works ?? [], [data]);

  const filteredWorks = useMemo(() => {
    return works.filter((w) => {
      if (statusFilter === "PUBLISHED" && w.status !== "PUBLISHED") return false;
      if (statusFilter === "DRAFT" && w.status !== "DRAFT") return false;

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

  const filtersActive = searchQuery.trim() !== "" || statusFilter !== "ALL";
  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilter("ALL");
  };

  const baseline = selected ? formFromWork(selected) : EMPTY_FORM;
  const dirty = !sameForm(form, baseline);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (key === "title") setTitleError(null);
  };

  /* ---------------------------------------------------------------------- */
  /*  Form helpers                                                           */
  /* ---------------------------------------------------------------------- */

  const resetForm = () => {
    setSelected(null);
    setForm(EMPTY_FORM);
    setTab("details");
    setTitleError(null);
  };

  const fillFormFromWork = (work: ShowcaseWork) => {
    setSelected(work);
    setForm(formFromWork(work));
    setTitleError(null);
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

    // The title input used to carry `required`; with tabbed groups it isn't
    // always mounted, so the check runs here and jumps to the Details tab.
    if (!form.title.trim()) {
      setTitleError("Title is required.");
      setTab("details");
      return;
    }

    setSaving(true);

    try {
      const tags = form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        slug: form.slug.trim() || undefined,
        subtitle: form.subtitle.trim() || null,
        clientName: form.clientName.trim() || null,
        category: form.category.trim() || null,
        tags,
        thumbnailStorageKey: form.thumbnail?.storageKey ?? null,
        thumbnailUrl: form.thumbnail?.url ?? null,
        heroStorageKey: form.hero?.storageKey ?? null,
        heroUrl: form.hero?.url ?? null,
        galleryImages: form.gallery.length > 0 ? form.gallery : null,
        description: form.description || null,
        status: form.published ? "PUBLISHED" : "DRAFT",
        sortOrder: parseInt(form.sortOrder, 10) || 0,
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
  /*  Editor panel                                                           */
  /* ---------------------------------------------------------------------- */

  const tabIds = "showcase-editor";
  const mediaCount = (form.thumbnail ? 1 : 0) + (form.hero ? 1 : 0) + form.gallery.length;

  const panelTitle = (
    <span className="flex min-w-0 flex-wrap items-center gap-3">
      <span className="truncate">{selected ? selected.title : "New work"}</span>
      {selected ? <StatusBadge status={selected.status} /> : <Badge tone="peach">Not saved</Badge>}
    </span>
  );

  const panel = (
    <form onSubmit={handleSubmit} noValidate className="contents">
      <DetailPanel
        title={panelTitle}
        onClose={selected ? resetForm : undefined}
        closeLabel="Clear selection"
        footer={
          <SaveBar
            dirty={dirty}
            status={
              saving
                ? "Saving…"
                : selected
                  ? dirty
                    ? "Unsaved changes"
                    : "No unsaved changes"
                  : dirty
                    ? "New work · not saved"
                    : "New work · nothing entered yet"
            }
          >
            {dirty && (
              <Button
                variant="ghost"
                disabled={saving}
                onClick={() => {
                  setForm(baseline);
                  setTitleError(null);
                }}
              >
                {selected ? "Discard" : "Cancel"}
              </Button>
            )}
            <Button type="submit" variant="primary" disabled={!dirty || saving || deleting}>
              {saving ? "Saving…" : selected ? "Save changes" : "Create work"}
            </Button>
          </SaveBar>
        }
      >
        <Tabs
          idPrefix={tabIds}
          label="Work settings"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "details", label: "Details" },
            {
              value: "media",
              label: mediaCount > 0 ? `Media · ${mediaCount}` : "Media",
            },
            { value: "content", label: "Content" },
            { value: "publishing", label: "Publishing" },
          ]}
        />

        <div className="pt-5">
          {tab === "details" && (
            <TabPanel idPrefix={tabIds} value="details">
              <div className="space-y-5">
                <Field
                  label={
                    <>
                      Title <span className="text-[var(--av2-error-text)]">*</span>
                    </>
                  }
                  htmlFor="showcase-title"
                  error={titleError ?? undefined}
                >
                  <TextInput
                    id="showcase-title"
                    type="text"
                    value={form.title}
                    onChange={(e) => set("title", e.target.value)}
                    aria-invalid={!!titleError}
                    aria-required
                    placeholder="e.g. Acme Corp Brand Identity"
                  />
                </Field>

                <Field
                  label="Slug"
                  htmlFor="showcase-slug"
                  hint="Leave blank to auto-generate from the title."
                >
                  <TextInput
                    id="showcase-slug"
                    type="text"
                    value={form.slug}
                    onChange={(e) => set("slug", e.target.value)}
                    spellCheck={false}
                    placeholder={
                      form.title ? generateSlugFromTitle(form.title) : "auto-generated-from-title"
                    }
                  />
                </Field>

                <Field label="Subtitle" htmlFor="showcase-subtitle">
                  <TextInput
                    id="showcase-subtitle"
                    type="text"
                    value={form.subtitle}
                    onChange={(e) => set("subtitle", e.target.value)}
                    placeholder="e.g. A complete brand overhaul"
                  />
                </Field>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Client name" htmlFor="showcase-client">
                    <TextInput
                      id="showcase-client"
                      type="text"
                      value={form.clientName}
                      onChange={(e) => set("clientName", e.target.value)}
                      placeholder="e.g. Acme Corp"
                    />
                  </Field>
                  <Field label="Category" htmlFor="showcase-category">
                    <TextInput
                      id="showcase-category"
                      type="text"
                      value={form.category}
                      onChange={(e) => set("category", e.target.value)}
                      placeholder="e.g. Brand Identity"
                    />
                  </Field>
                </div>

                <Field label="Tags" htmlFor="showcase-tags" hint="Comma-separated list of tags.">
                  <TextInput
                    id="showcase-tags"
                    type="text"
                    value={form.tags}
                    onChange={(e) => set("tags", e.target.value)}
                    placeholder="e.g. branding, logo, identity"
                  />
                </Field>

                <p className="text-xs text-[var(--av2-text-2)]">
                  Images and the description are managed in their own tabs.
                </p>
              </div>
            </TabPanel>
          )}

          {tab === "media" && (
            <TabPanel idPrefix={tabIds} value="media">
              <div className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <CmsImageUpload
                    type="showcase"
                    value={form.thumbnail}
                    onChange={(v) => set("thumbnail", v)}
                    label="Thumbnail"
                    aspectRatio="4/3"
                  />
                  <CmsImageUpload
                    type="showcase"
                    value={form.hero}
                    onChange={(v) => set("hero", v)}
                    label="Hero image"
                    aspectRatio="16/9"
                  />
                </div>
                <PanelSection
                  title="Gallery"
                  action={
                    <span className="text-xs text-[var(--av2-text-2)] tabular-nums">
                      {fmt(form.gallery.length)} {plural(form.gallery.length, "image", "images")}
                    </span>
                  }
                >
                  <CmsGalleryUpload value={form.gallery} onChange={(v) => set("gallery", v)} />
                </PanelSection>
              </div>
            </TabPanel>
          )}

          {tab === "content" && (
            <TabPanel idPrefix={tabIds} value="content">
              <p className="mb-1.5 text-sm font-medium">Description</p>
              <RichTextEditor
                value={form.description}
                onChange={(v) => set("description", v)}
                placeholder="Write a detailed description of this work..."
                minHeight="200px"
                enableHeadings
              />
            </TabPanel>
          )}

          {tab === "publishing" && (
            <TabPanel idPrefix={tabIds} value="publishing">
              <div className="space-y-5">
                <div className="rounded-lg border border-[var(--av2-border)] p-4">
                  <Switch
                    checked={form.published}
                    onChange={(v) => set("published", v)}
                    label="Published"
                    describedBy="showcase-published-hint"
                  />
                  <p id="showcase-published-hint" className="mt-2 text-xs text-[var(--av2-text-2)]">
                    {form.published
                      ? "Visible on the public showcase after saving."
                      : "Draft — hidden from the public showcase."}
                  </p>
                </div>

                <Field
                  label="Sort order"
                  htmlFor="showcase-sort-order"
                  hint="Lower numbers appear first."
                >
                  <TextInput
                    id="showcase-sort-order"
                    type="number"
                    inputMode="numeric"
                    value={form.sortOrder}
                    onChange={(e) => set("sortOrder", e.target.value)}
                    placeholder="0"
                    className="max-w-[160px]"
                  />
                </Field>

                {selected && (
                  <PanelSection>
                    <KeyValueList
                      rows={[
                        { label: "Published", value: formatDate(selected.publishedAt) },
                        { label: "Created", value: formatDate(selected.createdAt) },
                        { label: "Last updated", value: formatDate(selected.updatedAt) },
                      ]}
                    />
                  </PanelSection>
                )}

                {selected && (
                  <PanelSection title="Danger zone">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm text-[var(--av2-text-2)]">
                        Deleting removes this work permanently.
                      </p>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={deleting || saving}
                        aria-busy={deleting}
                        onClick={() => setConfirmDelete(true)}
                      >
                        {deleting ? "Deleting…" : "Delete work"}
                      </Button>
                    </div>
                  </PanelSection>
                )}
              </div>
            </TabPanel>
          )}
        </div>
      </DetailPanel>
    </form>
  );

  /* ---------------------------------------------------------------------- */
  /*  Render                                                                 */
  /* ---------------------------------------------------------------------- */

  return (
    <>
      <PageHeader
        title="Showcase"
        description="Manage your portfolio showcase items. Create, edit, and publish works."
        meta={
          data ? (
            <span className="tabular-nums">
              {fmt(totalCount)} {plural(totalCount, "work", "works")} · {fmt(publishedCount)}{" "}
              published · {fmt(draftCount)} {plural(draftCount, "draft", "drafts")}
            </span>
          ) : undefined
        }
        actions={
          <Button variant="primary" onClick={resetForm}>
            <IconPlus />
            New work
          </Button>
        }
      />

      {error && (
        <div className="mb-6">
          <Callout tone="error" title="Couldn't load showcase works">
            {error}
          </Callout>
        </div>
      )}

      <SplitView panel={panel}>
        <Card padding="none">
          <div className="px-6 pt-5">
            <CardTitle>Portfolio</CardTitle>
            <div className="mt-4">
              <FilterBar>
                <SearchInput
                  className="min-w-[200px] flex-1"
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Search title, client or category"
                  label="Search works by title, client or category"
                />
                <div className="w-full sm:w-40">
                  <Select
                    aria-label="Filter by status"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  >
                    <option value="ALL">All statuses</option>
                    <option value="PUBLISHED">Published</option>
                    <option value="DRAFT">Draft</option>
                  </Select>
                </div>
              </FilterBar>
            </div>
          </div>

          {loading && !data ? (
            <div className="space-y-3 border-t border-[var(--av2-border)] px-6 py-5" role="status">
              <span className="sr-only">Loading showcase works…</span>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : !data ? null : works.length === 0 ? (
            <div className="border-t border-[var(--av2-border)]">
              <EmptyState
                icon={<IconPortfolio width={28} height={28} />}
                title="No showcase works yet"
                description="Create the first portfolio item with the New work button."
              />
            </div>
          ) : filteredWorks.length === 0 ? (
            <div className="border-t border-[var(--av2-border)]">
              <EmptyState
                title="No works match these filters"
                description="Try a different search or status."
                action={<Button onClick={resetFilters}>Clear filters</Button>}
              />
            </div>
          ) : (
            <Table label="Showcase works">
              <thead>
                <tr>
                  <Th>Work</Th>
                  <Th>Client</Th>
                  <Th>Category</Th>
                  <Th>Status</Th>
                  <Th>Updated</Th>
                </tr>
              </thead>
              <tbody>
                {filteredWorks.map((work) => (
                  <Tr
                    key={work.id}
                    selected={selected?.id === work.id}
                    onSelect={() => fillFormFromWork(work)}
                    label={`${work.title}, ${work.status === "PUBLISHED" ? "published" : "draft"}`}
                  >
                    <Td>
                      <div className="flex min-w-[200px] items-center gap-3">
                        <Thumb url={work.thumbnailUrl} />
                        <div className="min-w-0">
                          <div className="font-semibold">{work.title}</div>
                          {work.subtitle && (
                            <div className="line-clamp-1 text-xs text-[var(--av2-text-2)]">
                              {work.subtitle}
                            </div>
                          )}
                        </div>
                      </div>
                    </Td>
                    <Td className="text-[var(--av2-text-2)]">{work.clientName || DASH}</Td>
                    <Td className="text-[var(--av2-text-2)]">{work.category || DASH}</Td>
                    <Td>
                      <StatusBadge status={work.status} />
                    </Td>
                    <Td className="whitespace-nowrap text-[var(--av2-text-2)] tabular-nums">
                      {formatDate(work.updatedAt)}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}

          {data && works.length > 0 && (
            <TableFooter>
              <span className="tabular-nums">
                Showing {fmt(filteredWorks.length)} of {fmt(totalCount)}
              </span>
              {filtersActive ? (
                <Button size="sm" variant="ghost" onClick={resetFilters}>
                  Clear filters
                </Button>
              ) : (
                <span>Select a work to edit it.</span>
              )}
            </TableFooter>
          )}
        </Card>
      </SplitView>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => !deleting && setConfirmDelete(false)}
        onConfirm={async () => {
          await handleDelete();
          setConfirmDelete(false);
        }}
        loading={deleting}
        variant="danger"
        title="Delete this work?"
        description={
          selected
            ? `Are you sure you want to delete "${selected.title}"? This action cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
      />
    </>
  );
}
