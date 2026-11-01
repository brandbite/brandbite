// -----------------------------------------------------------------------------
// @file: app/admin/job-types/page.tsx
// @purpose: Admin-facing management of job types (estimated hours -> auto pricing).
//           Paginated, filterable catalogue on the left; editor with a live
//           price preview on the right (admin design language v1).
// @version: v4.0.0
// @status: active
// @lastUpdate: 2026-11-01
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ui/toast-provider";
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
  Table,
  TableFooter,
  Td,
  TextArea,
  TextInput,
  TextLink,
  Th,
  Tr,
  fmt,
  plural,
} from "@/components/admin/v2/ui";
import { IconAlertCircle, IconDocument } from "@/components/admin/v2/icons";
import { IconServices } from "@/components/navigation/nav-icons";
import { useUnsavedChanges } from "@/components/admin/v2/unsaved-changes";

type CategoryRef = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
};

type JobType = {
  id: string;
  name: string;
  category: string | null;
  categoryId: string | null;
  categoryRef: CategoryRef | null;
  description: string | null;
  tokenCost: number;
  creativePayoutTokens: number;
  estimatedHours: number | null;
  hasQuantity: boolean;
  quantityLabel: string | null;
  defaultQuantity: number;
  aiPromptTemplate: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type CategoryOption = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  jobTypeCount: number;
};

type JobTypesResponse = {
  jobTypes: JobType[];
};

type ActiveFilter = "ALL" | "ACTIVE" | "INACTIVE";

const PAGE_SIZE = 10;

/** Base creative payout share used by the page preview (mirrors
 *  BASE_PAYOUT_PERCENT = 60 applied by /api/admin/job-types on save). */
const PAYOUT_RATE = 0.6;

type FormSnapshot = {
  name: string;
  categoryId: string;
  description: string;
  estimatedHours: string;
  hasQuantity: boolean;
  quantityLabel: string;
  defaultQuantity: string;
  aiPromptTemplate: string;
  isActive: boolean;
};

const EMPTY_FORM: FormSnapshot = {
  name: "",
  categoryId: "",
  description: "",
  estimatedHours: "",
  hasQuantity: false,
  quantityLabel: "",
  defaultQuantity: "1",
  aiPromptTemplate: "",
  isActive: true,
};

const snapshotOf = (jt: JobType): FormSnapshot => ({
  name: jt.name,
  categoryId: jt.categoryId ?? "",
  description: jt.description ?? "",
  // Fallback to tokenCost for legacy rows where estimatedHours was not set
  estimatedHours: String(jt.estimatedHours ?? jt.tokenCost),
  hasQuantity: jt.hasQuantity,
  quantityLabel: jt.quantityLabel ?? "",
  defaultQuantity: String(jt.defaultQuantity),
  aiPromptTemplate: jt.aiPromptTemplate ?? "",
  isActive: jt.isActive,
});

export default function AdminJobTypesPage() {
  const { showToast } = useToast();
  const [data, setData] = useState<JobTypesResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Categories from DB
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);

  const [filterActive, setFilterActive] = useState<ActiveFilter>("ALL");
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState<JobType | null>(null);
  const [formName, setFormName] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formEstimatedHours, setFormEstimatedHours] = useState("");
  const [formHasQuantity, setFormHasQuantity] = useState(false);
  const [formQuantityLabel, setFormQuantityLabel] = useState("");
  const [formDefaultQuantity, setFormDefaultQuantity] = useState("1");
  const [formAiPromptTemplate, setFormAiPromptTemplate] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Duplicate detection
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  const jobTypes = useMemo(() => data?.jobTypes ?? [], [data]);

  // Filter and search
  const filteredJobTypes = useMemo(() => {
    return jobTypes.filter((jt) => {
      // Active filter
      if (filterActive === "ACTIVE" && !jt.isActive) return false;
      if (filterActive === "INACTIVE" && jt.isActive) return false;

      // Category filter
      if (filterCategory !== "ALL") {
        if (filterCategory === "UNCATEGORIZED") {
          if (jt.categoryId) return false;
        } else {
          if (jt.categoryId !== filterCategory) return false;
        }
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const nameMatch = jt.name.toLowerCase().includes(q);
        const descMatch = jt.description?.toLowerCase().includes(q) ?? false;
        const catMatch =
          jt.categoryRef?.name.toLowerCase().includes(q) ??
          jt.category?.toLowerCase().includes(q) ??
          false;
        if (!nameMatch && !descMatch && !catMatch) return false;
      }

      return true;
    });
  }, [jobTypes, filterActive, filterCategory, searchQuery]);

  // Client-side pagination over the filtered list
  const pageCount = Math.max(1, Math.ceil(filteredJobTypes.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageRows = filteredJobTypes.slice(pageStart, pageStart + PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [filterActive, filterCategory, searchQuery]);

  const filtersActive = filterActive !== "ALL" || filterCategory !== "ALL" || !!searchQuery.trim();
  const resetFilters = () => {
    setFilterActive("ALL");
    setFilterCategory("ALL");
    setSearchQuery("");
  };

  const activeCount = jobTypes.filter((jt) => jt.isActive).length;
  const inactiveCount = jobTypes.length - activeCount;

  // Derived token values (auto-calculated from estimated hours) — same
  // formula as before: 1 hour = 1 token, creative payout = 60% rounded.
  const derivedTokenCost = formEstimatedHours ? parseInt(formEstimatedHours, 10) || 0 : 0;
  const derivedCreativePayout = Math.round(derivedTokenCost * PAYOUT_RATE);
  const hasPreview = derivedTokenCost > 0;
  const previewQuantity = Math.max(1, parseInt(formDefaultQuantity, 10) || 1);

  const hoursError =
    formEstimatedHours.trim() !== "" && !(parseInt(formEstimatedHours, 10) >= 1)
      ? "Enter a whole number of hours, 1 or more."
      : null;

  // Dirty state — compare the form to the selected row (or the empty form).
  const baseline = selected ? snapshotOf(selected) : EMPTY_FORM;
  const dirty =
    formName !== baseline.name ||
    formCategoryId !== baseline.categoryId ||
    formDescription !== baseline.description ||
    formEstimatedHours !== baseline.estimatedHours ||
    formHasQuantity !== baseline.hasQuantity ||
    formQuantityLabel !== baseline.quantityLabel ||
    formDefaultQuantity !== baseline.defaultQuantity ||
    formAiPromptTemplate !== baseline.aiPromptTemplate ||
    formIsActive !== baseline.isActive;
  const confirmDiscard = useUnsavedChanges(
    dirty,
    selected ? `Job type: ${selected.name}` : "New job type",
  );

  // Duplicate detection — check when name changes
  useEffect(() => {
    const trimmed = formName.trim().toLowerCase();
    if (!trimmed || trimmed.length < 2) {
      setDuplicateWarning(null);
      return;
    }

    const existing = jobTypes.find(
      (jt) => jt.name.trim().toLowerCase() === trimmed && jt.id !== selected?.id,
    );

    if (existing) {
      setDuplicateWarning(
        `A job type named "${existing.name}" already exists${
          existing.isActive ? "" : " (inactive)"
        }.`,
      );
    } else {
      setDuplicateWarning(null);
    }
  }, [formName, jobTypes, selected]);

  const applySnapshot = (s: FormSnapshot) => {
    setFormName(s.name);
    setFormCategoryId(s.categoryId);
    setFormDescription(s.description);
    setFormEstimatedHours(s.estimatedHours);
    setFormHasQuantity(s.hasQuantity);
    setFormQuantityLabel(s.quantityLabel);
    setFormDefaultQuantity(s.defaultQuantity);
    setFormAiPromptTemplate(s.aiPromptTemplate);
    setFormIsActive(s.isActive);
  };

  const resetForm = () => {
    setSelected(null);
    applySnapshot(EMPTY_FORM);
    setSaveError(null);
    setSaveSuccess(null);
    setDuplicateWarning(null);
  };

  const fillFormFromSelection = (jt: JobType) => {
    setSelected(jt);
    applySnapshot(snapshotOf(jt));
    setSaveError(null);
    setSaveSuccess(null);
  };

  const discardChanges = () => {
    applySnapshot(baseline);
    setSaveError(null);
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [jtRes, catRes] = await Promise.all([
        fetch("/api/admin/job-types", { cache: "no-store" }),
        fetch("/api/admin/job-type-categories", { cache: "no-store" }),
      ]);

      const jtJson = await jtRes.json().catch(() => null);
      const catJson = await catRes.json().catch(() => null);

      if (!jtRes.ok) {
        if (jtRes.status === 401) {
          throw new Error("You must be signed in as an admin to view this page.");
        }
        if (jtRes.status === 403) {
          throw new Error("You do not have permission to manage job types.");
        }
        const msg = jtJson?.error || `Request failed with status ${jtRes.status}`;
        throw new Error(msg);
      }

      setData(jtJson as JobTypesResponse);
      setCategoryOptions((catJson?.categories ?? []) as CategoryOption[]);
    } catch (err: any) {
      console.error("Admin job types fetch error:", err);
      setError(err?.message || "Failed to load job types.");
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

  // Keep the selected row object in sync after a reload (same id).
  useEffect(() => {
    if (!selected) return;
    const fresh = jobTypes.find((jt) => jt.id === selected.id);
    if (fresh && fresh !== selected) setSelected(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobTypes]);

  const handleEditClick = async (jt: JobType) => {
    if (jt.id === selected?.id) return;
    if (!(await confirmDiscard())) return;
    fillFormFromSelection(jt);
  };

  const handleNewClick = async () => {
    if (!(await confirmDiscard())) return;
    resetForm();
  };

  const handleClosePanel = async () => {
    if (!(await confirmDiscard())) return;
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const estimatedHours = parseInt(formEstimatedHours, 10);

      const payload = {
        name: formName.trim(),
        categoryId: formCategoryId || null,
        // Also set legacy text field from category name for backward compat
        category: formCategoryId
          ? (categoryOptions.find((c) => c.id === formCategoryId)?.name ?? null)
          : null,
        description: formDescription.trim() || null,
        estimatedHours,
        hasQuantity: formHasQuantity,
        quantityLabel: formHasQuantity ? formQuantityLabel.trim() || null : null,
        defaultQuantity: formHasQuantity ? Math.max(1, parseInt(formDefaultQuantity, 10) || 1) : 1,
        aiPromptTemplate: formAiPromptTemplate.trim() || null,
        isActive: formIsActive,
      };

      const isEditing = !!selected;

      const res = await fetch("/api/admin/job-types", {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          isEditing
            ? {
                id: selected?.id,
                ...payload,
              }
            : payload,
        ),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = json?.error || `Request failed with status ${res.status}`;
        throw new Error(msg);
      }

      const msg = isEditing ? "Job type updated successfully." : "Job type created successfully.";
      setSaveSuccess(msg);
      showToast({ type: "success", title: msg });

      await load();

      if (!isEditing) {
        resetForm();
      }
    } catch (err: any) {
      console.error("Admin job types save error:", err);
      const errMsg = err?.message || "Failed to save job type.";
      setSaveError(errMsg);
      showToast({ type: "error", title: errMsg });
    } finally {
      setSaving(false);
    }
  };

  /** Get display category name for a job type */
  const getCategoryDisplay = (jt: JobType): string => {
    return jt.categoryRef?.name ?? jt.category ?? "";
  };

  const activeCategoryOptions = categoryOptions.filter((c) => c.isActive);
  const selectedCategoryName = selected ? getCategoryDisplay(selected) : "";

  // ---------------------------------------------------------------------------
  // Editor panel
  // ---------------------------------------------------------------------------

  const panelFooter = (
    <SaveBar
      dirty={dirty}
      status={saving ? "Saving…" : !dirty && saveSuccess ? saveSuccess : undefined}
    >
      {dirty && (
        <Button variant="ghost" onClick={discardChanges} disabled={saving}>
          Discard
        </Button>
      )}
      <Button
        type="submit"
        form="job-type-form"
        variant="primary"
        disabled={!dirty || saving}
        aria-busy={saving}
      >
        {saving ? "Saving…" : selected ? "Save job type" : "Create job type"}
      </Button>
    </SaveBar>
  );

  const panel = (
    <DetailPanel
      title={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="break-words">{selected ? selected.name : "New job type"}</span>
          {selected && (
            <Badge tone={selected.isActive ? "green" : "neutral"}>
              {selected.isActive ? "Active" : "Inactive"}
            </Badge>
          )}
        </span>
      }
      onClose={selected ? handleClosePanel : undefined}
      closeLabel="Clear selection"
      footer={panelFooter}
    >
      <p className="-mt-1 mb-5 text-sm text-[var(--av2-text-2)]">
        {selected
          ? selectedCategoryName || "No category"
          : "Enter estimated hours — token cost and creative payout are calculated automatically."}
      </p>

      {saveError && (
        <div className="mb-5">
          <Callout tone="error" title="Couldn’t save">
            {saveError}
          </Callout>
        </div>
      )}

      <form id="job-type-form" onSubmit={handleSubmit}>
        <PanelSection title="Details">
          <div className="space-y-4">
            <Field
              label="Name"
              htmlFor="job-name"
              hint={
                duplicateWarning ? (
                  <span className="flex items-start gap-1.5 text-[var(--av2-link)]">
                    <IconAlertCircle width={14} height={14} className="mt-px shrink-0" />
                    {duplicateWarning}
                  </span>
                ) : undefined
              }
            >
              <TextInput
                id="job-name"
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                placeholder="e.g. Logo design"
              />
            </Field>

            <Field
              label="Category"
              htmlFor="job-category"
              hint={
                categoryOptions.length === 0 && !loading ? (
                  <span className="inline-flex flex-wrap items-center gap-1">
                    No categories yet.
                    <TextLink href="/admin/job-type-categories">Create categories</TextLink>
                  </span>
                ) : selected && !selected.categoryId && selected.category ? (
                  <>
                    Currently labelled “{selected.category}” as text only, not linked to a category.
                    Saving with “No category” clears that label.
                  </>
                ) : undefined
              }
            >
              <Select
                id="job-category"
                value={formCategoryId}
                onChange={(e) => setFormCategoryId(e.target.value)}
              >
                <option value="">No category</option>
                {activeCategoryOptions.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon ? `${cat.icon} ` : ""}
                    {cat.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Description"
              htmlFor="job-description"
              hint="Short description visible to team and admins."
            >
              <TextArea
                id="job-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={2}
                className="min-h-20"
                placeholder="What does this job include?"
              />
            </Field>

            <div className="flex items-start justify-between gap-4">
              <div>
                <p id="job-active-label" className="text-sm font-medium">
                  Active
                </p>
                <p id="job-active-hint" className="mt-0.5 text-xs text-[var(--av2-text-2)]">
                  Active job types are available to customers.
                </p>
              </div>
              <Switch
                checked={formIsActive}
                onChange={setFormIsActive}
                labelledBy="job-active-label"
                describedBy="job-active-hint"
              />
            </div>
          </div>
        </PanelSection>

        <PanelSection title="Pricing">
          <div className="space-y-4">
            <Field
              label="Estimated hours"
              htmlFor="job-estimated-hours"
              hint="1 estimated hour = 1 token."
              error={hoursError}
            >
              <TextInput
                id="job-estimated-hours"
                type="number"
                min={1}
                value={formEstimatedHours}
                onChange={(e) => setFormEstimatedHours(e.target.value)}
                required
                placeholder="e.g. 8"
                suffix="hours"
                aria-invalid={hoursError ? true : undefined}
                className="tabular-nums"
              />
            </Field>

            <div
              className="rounded-2xl border border-[var(--av2-attention-border)] bg-[var(--av2-selected)] p-5"
              aria-live="polite"
            >
              <p className="text-base font-semibold">Calculated pricing</p>
              <dl className="mt-3 grid grid-cols-2 divide-x divide-[var(--av2-border)]">
                <div className="pr-4">
                  <dt className="text-sm text-[var(--av2-text-2)]">Customer cost</dt>
                  <dd className="mt-1 flex items-baseline gap-2">
                    <span className="text-[32px] leading-10 font-bold tracking-tight tabular-nums">
                      {hasPreview ? fmt(derivedTokenCost) : DASH}
                    </span>
                    <span className="text-sm text-[var(--av2-text-2)]">tokens</span>
                  </dd>
                </div>
                <div className="pl-4">
                  <dt className="text-sm text-[var(--av2-text-2)]">Creative base payout</dt>
                  <dd className="mt-1 flex items-baseline gap-2">
                    <span className="text-[32px] leading-10 font-bold tracking-tight tabular-nums">
                      {hasPreview ? fmt(derivedCreativePayout) : DASH}
                    </span>
                    <span className="text-sm text-[var(--av2-text-2)]">tokens</span>
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-[var(--av2-text-2)]">
                Token cost = estimated hours. Base payout = 60% of the token cost, rounded.
                {formHasQuantity && hasPreview && (
                  <>
                    {" "}
                    Prices are per unit — at the default quantity of {fmt(previewQuantity)}, a
                    ticket costs {fmt(derivedTokenCost * previewQuantity)} tokens.
                  </>
                )}
              </p>
              {!hasPreview && (
                <p className="mt-2 text-xs text-[var(--av2-text-2)]">
                  Enter estimated hours to see the calculated price.
                </p>
              )}
            </div>

            <div className="flex items-start justify-between gap-4">
              <div>
                <p id="job-qty-label" className="text-sm font-medium">
                  Per-unit pricing
                </p>
                <p id="job-qty-hint" className="mt-0.5 text-xs text-[var(--av2-text-2)]">
                  Enable when requests can include multiple units (has quantity).
                </p>
              </div>
              <Switch
                checked={formHasQuantity}
                onChange={setFormHasQuantity}
                labelledBy="job-qty-label"
                describedBy="job-qty-hint"
              />
            </div>

            {/* Quantity fields — visible when hasQuantity is on */}
            {formHasQuantity && (
              <div className="grid gap-4 border-l-2 border-[var(--av2-accent)]/30 pl-4 sm:grid-cols-2">
                <Field label="Quantity label" htmlFor="job-quantity-label">
                  <TextInput
                    id="job-quantity-label"
                    type="text"
                    value={formQuantityLabel}
                    onChange={(e) => setFormQuantityLabel(e.target.value)}
                    placeholder="e.g. Number of sizes"
                  />
                </Field>
                <Field label="Default quantity" htmlFor="job-default-quantity">
                  <TextInput
                    id="job-default-quantity"
                    type="number"
                    min={1}
                    value={formDefaultQuantity}
                    onChange={(e) => setFormDefaultQuantity(e.target.value)}
                    placeholder="1"
                    className="tabular-nums"
                  />
                </Field>
              </div>
            )}
          </div>
        </PanelSection>

        {/* AI prompt template — tuned guidance appended to every
            image generation for tickets of this job type. */}
        <PanelSection title="AI prompt">
          <Field
            label={
              <>
                AI prompt template{" "}
                <span className="font-normal text-[var(--av2-text-2)]">(optional)</span>
              </>
            }
            htmlFor="job-ai-prompt"
            hint="Appended to every AI image generation for tickets of this job type. Composes with the project-level brand guide when set."
          >
            <TextArea
              id="job-ai-prompt"
              value={formAiPromptTemplate}
              onChange={(e) => setFormAiPromptTemplate(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder={
                'e.g. "For logos: emphasize simplicity and scalability; should remain recognizable down to 24px square."'
              }
            />
          </Field>
        </PanelSection>
      </form>
    </DetailPanel>
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div>
      <PageHeader
        title="Job types"
        description="Define the work, estimate effort and review token pricing."
        meta={
          data ? (
            <span className="tabular-nums">
              {fmt(jobTypes.length)} {plural(jobTypes.length, "job type", "job types")} ·{" "}
              {fmt(activeCount)} active · {fmt(inactiveCount)} inactive
            </span>
          ) : null
        }
        actions={
          <Button variant="primary" onClick={handleNewClick}>
            <span aria-hidden className="text-lg leading-none">
              +
            </span>
            New job type
          </Button>
        }
      />

      {/* Error */}
      {error && (
        <div className="mb-6">
          <Callout tone="error" title="Something went wrong">
            {error}
          </Callout>
        </div>
      )}

      <SplitView panel={panel}>
        <Card padding="none">
          <div className="px-6 pt-5">
            <div className="mb-4">
              <h2 className="text-xl leading-7 font-semibold">Job catalogue</h2>
            </div>
            <FilterBar>
              <SearchInput
                className="w-full min-w-[200px] flex-1"
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search job types…"
                label="Search job types by name, description or category"
              />
              <div className="w-full sm:w-52">
                <Select
                  aria-label="Filter by category"
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                >
                  <option value="ALL">All categories</option>
                  <option value="UNCATEGORIZED">Uncategorized</option>
                  {activeCategoryOptions.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon ? `${cat.icon} ` : ""}
                      {cat.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="w-full sm:w-40">
                <Select
                  aria-label="Filter by status"
                  value={filterActive}
                  onChange={(e) => setFilterActive(e.target.value as ActiveFilter)}
                >
                  <option value="ALL">All statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </Select>
              </div>
            </FilterBar>
          </div>

          {loading && !data ? (
            <div className="space-y-3 border-t border-[var(--av2-border)] px-6 py-5" role="status">
              <span className="sr-only">Loading job types…</span>
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : jobTypes.length === 0 ? (
            <div className="border-t border-[var(--av2-border)]">
              <EmptyState
                icon={<IconServices width={28} height={28} />}
                title="No job types yet"
                description="Create the first job type with the editor on the right."
              />
            </div>
          ) : filteredJobTypes.length === 0 ? (
            <div className="border-t border-[var(--av2-border)]">
              <EmptyState
                title={
                  searchQuery.trim()
                    ? "No job types match your search"
                    : "No job types match these filters"
                }
                description="Try a different search, category or status."
                action={<Button onClick={resetFilters}>Clear filters</Button>}
              />
            </div>
          ) : (
            <Table label="Job types">
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Category</Th>
                  <Th align="right">Est. hours</Th>
                  <Th align="right">Tokens</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((jt) => {
                  const catName = getCategoryDisplay(jt);
                  const legacyOnly = !jt.categoryRef && !!jt.category;
                  return (
                    <Tr
                      key={jt.id}
                      selected={selected?.id === jt.id}
                      onSelect={() => handleEditClick(jt)}
                      label={`${jt.name}, ${jt.isActive ? "active" : "inactive"}`}
                    >
                      <Td className="min-w-[220px]">
                        <div className="font-semibold break-words">{jt.name}</div>
                        {jt.description && (
                          <div className="mt-0.5 line-clamp-2 text-xs text-[var(--av2-text-2)]">
                            {jt.description}
                          </div>
                        )}
                        {jt.hasQuantity && (
                          <div className="mt-1.5">
                            <Badge tone="lavender">
                              Per unit{jt.quantityLabel ? ` · ${jt.quantityLabel}` : ""}
                            </Badge>
                          </div>
                        )}
                      </Td>
                      <Td className="min-w-[160px] text-[var(--av2-text-2)]">
                        {catName ? (
                          <>
                            <span className="inline-flex items-start gap-1.5">
                              {jt.categoryRef?.icon && (
                                <span aria-hidden>{jt.categoryRef.icon}</span>
                              )}
                              <span>{catName}</span>
                            </span>
                            {legacyOnly && (
                              <div className="mt-0.5 text-xs">Text label · not linked</div>
                            )}
                          </>
                        ) : (
                          <span>{DASH}</span>
                        )}
                      </Td>
                      <Td align="right" className="whitespace-nowrap">
                        {jt.estimatedHours != null ? (
                          <>
                            {fmt(jt.estimatedHours)}{" "}
                            <span className="text-xs text-[var(--av2-text-2)]">h</span>
                          </>
                        ) : (
                          <span className="text-[var(--av2-text-2)]">{DASH}</span>
                        )}
                      </Td>
                      <Td align="right" className="whitespace-nowrap">
                        {fmt(jt.tokenCost)}{" "}
                        <span className="text-xs text-[var(--av2-text-2)]">tokens</span>
                      </Td>
                      <Td>
                        <Badge tone={jt.isActive ? "green" : "neutral"}>
                          {jt.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          )}

          {data && filteredJobTypes.length > 0 && (
            <TableFooter>
              <span className="tabular-nums">
                Showing {fmt(pageStart + 1)}–{fmt(pageStart + pageRows.length)} of{" "}
                {fmt(filteredJobTypes.length)}
                {filtersActive && ` (filtered from ${fmt(jobTypes.length)})`}
              </span>
              <div className="flex flex-wrap items-center gap-3">
                {filtersActive && (
                  <Button size="sm" variant="ghost" onClick={resetFilters}>
                    Clear filters
                  </Button>
                )}
                <Pager page={currentPage} pageCount={pageCount} onPage={setPage} />
              </div>
            </TableFooter>
          )}
        </Card>

        {!selected && data && jobTypes.length > 0 && (
          <p className="mt-6 flex items-center gap-2 text-sm text-[var(--av2-text-2)]">
            <IconDocument width={18} height={18} className="shrink-0" />
            Select a job type to edit its settings, or use the editor to create a new one.
          </p>
        )}
      </SplitView>
    </div>
  );
}
