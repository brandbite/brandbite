// -----------------------------------------------------------------------------
// @file: app/admin/pages/page.tsx
// @purpose: Admin CMS page editor for single marketing + legal pages
//           (About, Contact, Documentation, Privacy, Terms, Cookies,
//           Accessibility). Legal pages auto-create on first save via
//           an upsert in /api/admin/pages/[pageKey].
//           Admin design language v1: page list on the left, editor with
//           Content / Image / SEO tabs on the right.
// @version: v2.0.0
// @status: active
// @lastUpdate: 2026-11-01
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/ui/toast-provider";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { CmsImageUpload } from "@/components/ui/cms-image-upload";
import {
  Badge,
  Button,
  Callout,
  Card,
  EmptyState,
  Eyebrow,
  Field,
  PageHeader,
  SaveBar,
  SearchInput,
  Skeleton,
  TabPanel,
  Tabs,
  TextArea,
  TextInput,
  buttonClass,
} from "@/components/admin/v2/ui";
import { IconArrowUpRight, IconDocument } from "@/components/admin/v2/icons";

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

type EditorTab = "content" | "image" | "seo";

// Known pages. Marketing pages come first, legal pages grouped below.
// Legal pages auto-seed on first open (PATCH upserts), so an admin can
// edit them even if the database row doesn't exist yet.
const PAGE_LABELS: Record<string, string> = {
  about: "About",
  contact: "Contact",
  documentation: "Documentation",
  privacy: "Privacy Policy",
  terms: "Terms of Service",
  cookies: "Cookie Policy",
  accessibility: "Accessibility",
};

// Keys we always want to expose in the admin editor, even if the
// CmsPage row hasn't been created yet. The editor injects a
// placeholder entry; saving it upserts the row.
const REQUIRED_PAGE_KEYS: ReadonlyArray<string> = [
  "about",
  "contact",
  "documentation",
  "privacy",
  "terms",
  "cookies",
  "accessibility",
];

const MARKETING_KEYS = new Set(["about", "contact", "documentation"]);
const LEGAL_KEYS = new Set(["privacy", "terms", "cookies", "accessibility"]);

// Public routes that render a CmsPage. Pages without a route here
// (e.g. cookies) get no "View live page" link.
const PUBLIC_PATHS: Record<string, string> = {
  about: "/about",
  contact: "/contact",
  documentation: "/documentation",
  privacy: "/privacy",
  terms: "/terms",
  accessibility: "/accessibility",
};

const PLACEHOLDER_PREFIX = "placeholder-";

function placeholderPage(pageKey: string): CmsPage {
  return {
    id: `${PLACEHOLDER_PREFIX}${pageKey}`,
    pageKey,
    title: PAGE_LABELS[pageKey] ?? pageKey,
    subtitle: null,
    heroStorageKey: null,
    heroUrl: null,
    body: null,
    metaTitle: null,
    metaDescription: null,
    updatedAt: new Date(0).toISOString(),
  };
}

const isPlaceholder = (p: CmsPage) => p.id.startsWith(PLACEHOLDER_PREFIX);

// Stable ordering so the left rail doesn't jump around when the API
// returns pages in insertion order.
const PAGE_ORDER = new Map(REQUIRED_PAGE_KEYS.map((key, i) => [key, i] as const));

function orderPages(list: CmsPage[]): CmsPage[] {
  return [...list].sort((a, b) => {
    const ai = PAGE_ORDER.get(a.pageKey) ?? Number.MAX_SAFE_INTEGER;
    const bi = PAGE_ORDER.get(b.pageKey) ?? Number.MAX_SAFE_INTEGER;
    if (ai !== bi) return ai - bi;
    return a.pageKey.localeCompare(b.pageKey);
  });
}

function mergeWithPlaceholders(existing: CmsPage[]): CmsPage[] {
  const byKey = new Map(existing.map((p) => [p.pageKey, p] as const));
  for (const key of REQUIRED_PAGE_KEYS) {
    if (!byKey.has(key)) byKey.set(key, placeholderPage(key));
  }
  return orderPages(Array.from(byKey.values()));
}

const labelOf = (key: string) => PAGE_LABELS[key] ?? key;

/** Tiptap reports an empty document as "<p></p>"; treat it as empty. */
const normBody = (html: string) => (html === "<p></p>" ? "" : html);

function formatUpdated(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || d.getTime() === 0) return null;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function AdminPagesPage() {
  const { showToast } = useToast();

  const [pages, setPages] = useState<CmsPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selectedKeyRef = useRef<string | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<EditorTab>("content");

  // Form fields
  const [formTitle, setFormTitle] = useState("");
  const [formSubtitle, setFormSubtitle] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formHeroImage, setFormHeroImage] = useState<ImageValue>(null);
  const [formMetaTitle, setFormMetaTitle] = useState("");
  const [formMetaDescription, setFormMetaDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  // The rich-text editor normalises stored HTML (e.g. wraps list items in
  // <p>) and reports it back through onChange before anyone types. Adopt
  // that first, non-user change as the body baseline so the page doesn't
  // read "Unsaved changes" on load.
  const [bodyBaseline, setBodyBaseline] = useState("");
  const bodyInteracted = useRef(false);

  // --------------------------------------------------------------------------
  //  Load form from page data
  // --------------------------------------------------------------------------

  const loadFormFromPage = useCallback((page: CmsPage) => {
    setFormTitle(page.title);
    setFormSubtitle(page.subtitle ?? "");
    setFormBody(page.body ?? "");
    setBodyBaseline(page.body ?? "");
    bodyInteracted.current = false;
    setFormHeroImage(
      page.heroStorageKey && page.heroUrl
        ? { storageKey: page.heroStorageKey, url: page.heroUrl }
        : null,
    );
    setFormMetaTitle(page.metaTitle ?? "");
    setFormMetaDescription(page.metaDescription ?? "");
    setTitleError(null);
  }, []);

  // --------------------------------------------------------------------------
  //  Fetch all pages
  // --------------------------------------------------------------------------

  const fetchPages = useCallback(async (): Promise<CmsPage[] | null> => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/admin/pages", { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Failed to load pages.");
      const existing = (json?.pages ?? []) as CmsPage[];
      const merged = mergeWithPlaceholders(existing);
      setPages(merged);
      // Auto-select first page if none selected
      if (!selectedKeyRef.current && merged.length > 0) {
        selectedKeyRef.current = merged[0].pageKey;
        setSelectedKey(merged[0].pageKey);
        loadFormFromPage(merged[0]);
      }
      return merged;
    } catch (err: any) {
      const msg = err?.message || "Failed to load pages.";
      setLoadError(msg);
      showToast({ type: "error", title: msg });
      return null;
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadFormFromPage]);

  useEffect(() => {
    void fetchPages();
  }, [fetchPages]);

  function selectPage(key: string) {
    selectedKeyRef.current = key;
    setSelectedKey(key);
    const page = pages.find((p) => p.pageKey === key);
    if (page) loadFormFromPage(page);
  }

  const selectedPage = pages.find((p) => p.pageKey === selectedKey);

  // --------------------------------------------------------------------------
  //  Dirty state
  // --------------------------------------------------------------------------

  const dirty = useMemo(() => {
    if (!selectedPage) return false;
    return (
      formTitle !== selectedPage.title ||
      formSubtitle !== (selectedPage.subtitle ?? "") ||
      normBody(formBody) !== normBody(bodyBaseline) ||
      (formHeroImage?.storageKey ?? null) !== (selectedPage.heroStorageKey ?? null) ||
      (formHeroImage?.url ?? null) !== (selectedPage.heroUrl ?? null) ||
      formMetaTitle !== (selectedPage.metaTitle ?? "") ||
      formMetaDescription !== (selectedPage.metaDescription ?? "")
    );
  }, [
    selectedPage,
    formTitle,
    formSubtitle,
    formBody,
    bodyBaseline,
    formHeroImage,
    formMetaTitle,
    formMetaDescription,
  ]);

  const notCreated = selectedPage ? isPlaceholder(selectedPage) : false;

  // --------------------------------------------------------------------------
  //  Save
  // --------------------------------------------------------------------------

  const handleSave = async () => {
    if (!selectedKey) return;
    if (!formTitle.trim()) {
      setTitleError("Title is required.");
      setTab("content");
      showToast({ type: "error", title: "Title is required." });
      requestAnimationFrame(() => document.getElementById("page-title")?.focus());
      return;
    }
    setTitleError(null);

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
        title: `${labelOf(selectedKey)} page saved.`,
      });
      const fresh = await fetchPages();
      // Re-sync the form with the saved row (server trims values), so the
      // editor reads "No unsaved changes" after a successful save.
      const saved = fresh?.find((p) => p.pageKey === selectedKey);
      if (saved) loadFormFromPage(saved);
    } catch (err: any) {
      showToast({ type: "error", title: err?.message || "Failed to save page." });
    } finally {
      setSaving(false);
    }
  };

  const onBodyChange = (html: string) => {
    if (!bodyInteracted.current) setBodyBaseline(html);
    setFormBody(html);
  };
  const markBodyInteracted = () => {
    bodyInteracted.current = true;
  };

  const discardChanges = () => {
    if (selectedPage) loadFormFromPage(selectedPage);
  };

  // --------------------------------------------------------------------------
  //  Derived — page list groups
  // --------------------------------------------------------------------------

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const match = (p: CmsPage) =>
      !q || labelOf(p.pageKey).toLowerCase().includes(q) || p.pageKey.includes(q);
    const visible = pages.filter(match);
    return [
      { label: "Marketing", items: visible.filter((p) => MARKETING_KEYS.has(p.pageKey)) },
      { label: "Legal", items: visible.filter((p) => LEGAL_KEYS.has(p.pageKey)) },
      {
        label: "Other",
        items: visible.filter((p) => !MARKETING_KEYS.has(p.pageKey) && !LEGAL_KEYS.has(p.pageKey)),
      },
    ].filter((g) => g.items.length > 0);
  }, [pages, search]);

  // --------------------------------------------------------------------------
  //  Render
  // --------------------------------------------------------------------------

  const tabIds = "page-editor";
  const publicPath = selectedKey ? PUBLIC_PATHS[selectedKey] : undefined;
  const updatedLabel = selectedPage && !notCreated ? formatUpdated(selectedPage.updatedAt) : null;
  const metaTitleLen = formMetaTitle.trim().length;
  const metaDescLen = formMetaDescription.trim().length;

  const pageList = (
    <Card padding="none" className="lg:sticky lg:top-24">
      <div className="px-5 pt-5 pb-4">
        <h2 className="text-xl leading-7 font-semibold">Website pages</h2>
        <SearchInput
          className="mt-4"
          value={search}
          onChange={setSearch}
          placeholder="Find a page"
          label="Find a page"
        />
      </div>
      <nav aria-label="Website pages" className="border-t border-[var(--av2-border)] px-3 py-4">
        {groups.length === 0 ? (
          <p className="px-2 py-3 text-sm text-[var(--av2-text-2)]">
            No pages match “{search.trim()}”.
          </p>
        ) : (
          groups.map((g, gi) => (
            <div
              key={g.label}
              className={gi > 0 ? "mt-4 border-t border-[var(--av2-border)] pt-4" : undefined}
            >
              <div className="px-2 pb-2">
                <Eyebrow>{g.label}</Eyebrow>
              </div>
              <ul className="space-y-1">
                {g.items.map((p) => {
                  const active = p.pageKey === selectedKey;
                  return (
                    <li key={p.pageKey}>
                      <button
                        type="button"
                        onClick={() => selectPage(p.pageKey)}
                        aria-current={active ? "page" : undefined}
                        className={`flex h-10 w-full items-center gap-3 rounded-lg px-2.5 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none ${
                          active
                            ? "bg-[var(--av2-selected)] font-semibold text-[var(--av2-link)]"
                            : "text-[var(--av2-text)] hover:bg-[var(--av2-bg)]"
                        }`}
                      >
                        <IconDocument
                          width={18}
                          height={18}
                          className={`shrink-0 ${active ? "" : "text-[var(--av2-text-2)]"}`}
                        />
                        <span className="min-w-0 flex-1 truncate">{labelOf(p.pageKey)}</span>
                        {isPlaceholder(p) && <Badge tone="amber">Not created</Badge>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </nav>
    </Card>
  );

  const editor = selectedPage && (
    <Card padding="none" className="flex min-w-0 flex-col">
      <div className="px-6 pt-5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-2xl leading-8 font-bold">{labelOf(selectedPage.pageKey)}</h2>
          <span className="text-sm text-[var(--av2-text-2)]">
            {publicPath ?? `/${selectedPage.pageKey}`}
          </span>
          {notCreated && <Badge tone="amber">Not created yet</Badge>}
        </div>
        <p className="mt-1 text-sm text-[var(--av2-text-2)]">
          {notCreated
            ? "This page doesn’t exist in the database yet. Saving creates it."
            : updatedLabel
              ? `Last updated ${updatedLabel}`
              : "Saved page"}
        </p>

        <div className="mt-4">
          <Tabs
            idPrefix={tabIds}
            label="Page editor sections"
            value={tab}
            onChange={setTab}
            tabs={[
              { value: "content", label: "Content" },
              { value: "image", label: "Image" },
              { value: "seo", label: "SEO" },
            ]}
          />
        </div>
      </div>

      {/* Panels stay mounted (hidden) so the rich-text editor and upload
          keep their state while switching tabs. */}
      <div className="px-6 py-6">
        <div hidden={tab !== "content"}>
          <TabPanel idPrefix={tabIds} value="content">
            <div className="space-y-5">
              <Field
                label={
                  <>
                    Page title <span className="text-[var(--av2-error-text)]">*</span>
                  </>
                }
                htmlFor="page-title"
                error={titleError}
              >
                <TextInput
                  id="page-title"
                  type="text"
                  value={formTitle}
                  onChange={(e) => {
                    setFormTitle(e.target.value);
                    if (titleError && e.target.value.trim()) setTitleError(null);
                  }}
                  placeholder="Page title"
                  required
                  aria-invalid={titleError ? true : undefined}
                />
              </Field>

              <Field label="Subtitle" htmlFor="page-subtitle">
                <TextInput
                  id="page-subtitle"
                  type="text"
                  value={formSubtitle}
                  onChange={(e) => setFormSubtitle(e.target.value)}
                  placeholder="Optional subtitle"
                />
              </Field>

              <div>
                <p className="mb-1.5 text-sm font-medium">Page content</p>
                <div
                  onKeyDownCapture={markBodyInteracted}
                  onMouseDownCapture={markBodyInteracted}
                  onPasteCapture={markBodyInteracted}
                  onDropCapture={markBodyInteracted}
                  onCutCapture={markBodyInteracted}
                >
                  <RichTextEditor
                    value={formBody}
                    onChange={onBodyChange}
                    placeholder="Write page content..."
                    minHeight="300px"
                    enableHeadings
                  />
                </div>
                <p className="mt-1.5 text-xs text-[var(--av2-text-2)]">
                  The hero image is managed in Image. Search metadata is managed in SEO.
                </p>
              </div>
            </div>
          </TabPanel>
        </div>

        <div hidden={tab !== "image"}>
          <TabPanel idPrefix={tabIds} value="image">
            <div className="max-w-lg">
              <h3 className="text-base font-semibold">Hero image</h3>
              <p className="mt-0.5 mb-4 text-sm text-[var(--av2-text-2)]">
                Shown at the top of the page. A 16:9 image works best.
              </p>
              <CmsImageUpload
                type="blog"
                value={formHeroImage}
                onChange={setFormHeroImage}
                aspectRatio="16/9"
              />
            </div>
          </TabPanel>
        </div>

        <div hidden={tab !== "seo"}>
          <TabPanel idPrefix={tabIds} value="seo">
            <div className="max-w-2xl space-y-5">
              <Field
                label="Meta title"
                htmlFor="page-meta-title"
                hint={`${metaTitleLen} characters · shown as the browser tab and search result title.`}
              >
                <TextInput
                  id="page-meta-title"
                  type="text"
                  value={formMetaTitle}
                  onChange={(e) => setFormMetaTitle(e.target.value)}
                  placeholder="SEO title"
                />
              </Field>
              <Field
                label="Meta description"
                htmlFor="page-meta-description"
                hint={`${metaDescLen} characters · shown under the title in search results.`}
              >
                <TextArea
                  id="page-meta-description"
                  value={formMetaDescription}
                  onChange={(e) => setFormMetaDescription(e.target.value)}
                  rows={3}
                  placeholder="SEO description..."
                />
              </Field>
            </div>
          </TabPanel>
        </div>
      </div>

      <div className="mt-auto border-t border-[var(--av2-border)] px-6 py-4">
        <SaveBar
          dirty={dirty}
          status={
            saving
              ? "Saving…"
              : dirty
                ? "Unsaved changes"
                : notCreated
                  ? "Not created yet — saving creates this page"
                  : "No unsaved changes"
          }
        >
          {dirty && (
            <Button variant="ghost" onClick={discardChanges} disabled={saving}>
              Discard
            </Button>
          )}
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={saving || (!dirty && !notCreated)}
            aria-busy={saving}
          >
            {saving ? "Saving…" : notCreated ? "Create page" : "Save page"}
          </Button>
        </SaveBar>
      </div>
    </Card>
  );

  return (
    <div>
      <PageHeader
        title="Pages"
        description="Edit content for marketing and legal pages. Legal pages are created automatically the first time you save them."
        actions={
          publicPath && !notCreated ? (
            <a
              href={publicPath}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClass("secondary")}
            >
              View live page
              <IconArrowUpRight />
            </a>
          ) : undefined
        }
      />

      {loadError && pages.length === 0 && (
        <div className="mb-6">
          <Callout
            tone="error"
            title="Couldn’t load pages"
            action={
              <Button size="sm" onClick={() => void fetchPages()}>
                Try again
              </Button>
            }
          >
            {loadError}
          </Callout>
        </div>
      )}

      {loading && pages.length === 0 ? (
        <div
          className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]"
          role="status"
          aria-label="Loading pages"
        >
          <Card>
            <div className="space-y-3">
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          </Card>
          <Card>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="mt-6 h-10 w-full" />
            <Skeleton className="mt-4 h-10 w-full" />
            <Skeleton className="mt-4 h-72 w-full" />
          </Card>
        </div>
      ) : pages.length === 0 ? (
        !loadError && (
          <Card>
            <EmptyState
              icon={<IconDocument width={28} height={28} />}
              title="No pages yet"
              description="Pages will appear here once they are seeded in the database."
            />
          </Card>
        )
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          {pageList}
          {editor}
        </div>
      )}
    </div>
  );
}
