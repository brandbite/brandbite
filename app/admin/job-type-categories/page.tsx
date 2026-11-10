// -----------------------------------------------------------------------------
// @file: app/admin/job-type-categories/page.tsx
// @purpose: Admin page for managing job type categories. Category list on
//           the left; order, icon and visibility edited in one panel on the
//           right (admin design language v1).
// @version: v2.0.0
// @status: active
// @lastUpdate: 2026-11-01
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ui/toast-provider";
import { Modal, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
  IconTile,
  PageHeader,
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
  TextInput,
  TextLink,
  Th,
  Tr,
  fmt,
  plural,
} from "@/components/admin/v2/ui";
import { IconDocument } from "@/components/admin/v2/icons";
import { IconCatalog } from "@/components/navigation/nav-icons";
import { useUnsavedChanges } from "@/components/admin/v2/unsaved-changes";

type Category = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  jobTypeCount: number;
  createdAt: string;
  updatedAt: string;
};

type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";

/** What the "Linked job types" number counts (shown as a hint so the
 *  figure can't be confused with the category text on the Job types page). */
const LINKED_COUNT_NOTE =
  "Services whose category is set to this category (active and inactive). Services that only carry a legacy text label aren’t counted.";

type LegacyPreview = {
  unlinkedJobTypes: number;
  groups: {
    label: string;
    jobTypes: number;
    action: "link" | "create";
    category: { id: string; name: string } | null;
  }[];
};

export default function AdminJobTypeCategoriesPage() {
  const { showToast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // List filters (client-side)
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  // Form state
  const [selected, setSelected] = useState<Category | null>(null);
  const [formName, setFormName] = useState("");
  const [formIcon, setFormIcon] = useState("");
  const [formSortOrder, setFormSortOrder] = useState("0");
  const [formIsActive, setFormIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // Migration
  const [migrating, setMigrating] = useState(false);
  // Job types that still carry only the legacy text category (no categoryId).
  const [legacyPreview, setLegacyPreview] = useState<LegacyPreview | null>(null);
  const [confirmLink, setConfirmLink] = useState(false);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/job-type-categories", {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || `Request failed (${res.status})`);
      }

      const cats = (json?.categories ?? []) as Category[];
      setCategories(cats);

      // Any job type still linked only by its legacy text label? (Preview is
      // read-only; it groups them by label and resolves existing matches.)
      const pvRes = await fetch("/api/admin/job-type-categories/migrate", { cache: "no-store" });
      const pv = (await pvRes.json().catch(() => null)) as LegacyPreview | null;
      setLegacyPreview(pvRes.ok && pv && pv.unlinkedJobTypes > 0 ? pv : null);
    } catch (err: any) {
      setError(err?.message || "Failed to load categories.");
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Keep the selected object in sync with reloaded data (same id).
  useEffect(() => {
    if (!selected) return;
    const fresh = categories.find((c) => c.id === selected.id);
    if (fresh && fresh !== selected) setSelected(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  const resetForm = () => {
    setSelected(null);
    setFormName("");
    setFormIcon("");
    setFormSortOrder("0");
    setFormIsActive(true);
  };

  const fillForm = (cat: Category) => {
    setSelected(cat);
    setFormName(cat.name);
    setFormIcon(cat.icon ?? "");
    setFormSortOrder(String(cat.sortOrder));
    setFormIsActive(cat.isActive);
  };

  const discardChanges = () => {
    if (selected) fillForm(selected);
    else resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const isEditing = !!selected;
      const url = isEditing
        ? `/api/admin/job-type-categories/${selected.id}`
        : "/api/admin/job-type-categories";

      const res = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          icon: formIcon.trim() || null,
          sortOrder: parseInt(formSortOrder, 10) || 0,
          isActive: formIsActive,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || `Request failed (${res.status})`);
      }

      const msg = isEditing ? "Category updated successfully." : "Category created successfully.";
      showToast({ type: "success", title: msg });

      await load();

      if (!isEditing) {
        resetForm();
      }
    } catch (err: any) {
      showToast({
        type: "error",
        title: err?.message || "Failed to save category.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleMigrate = async () => {
    setMigrating(true);
    try {
      const res = await fetch("/api/admin/job-type-categories/migrate", {
        method: "POST",
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || "Linking failed.");
      }

      showToast({
        type: "success",
        title: json?.message || "Services linked.",
      });

      await load();
    } catch (err: any) {
      showToast({
        type: "error",
        title: err?.message || "Linking failed.",
      });
    } finally {
      setMigrating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);

    try {
      const res = await fetch(`/api/admin/job-type-categories/${deleteConfirm.id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || "Failed to delete category.");
      }

      const msg =
        json?.unlinkedJobTypes > 0
          ? `Category deleted. ${json.unlinkedJobTypes} service(s) unlinked.`
          : "Category deleted.";
      showToast({ type: "success", title: msg });

      setDeleteConfirm(null);
      if (selected?.id === deleteConfirm.id) {
        resetForm();
      }
      await load();
    } catch (err: any) {
      showToast({
        type: "error",
        title: err?.message || "Failed to delete category.",
      });
    } finally {
      setDeleting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return categories.filter((c) => {
      if (statusFilter === "ACTIVE" && !c.isActive) return false;
      if (statusFilter === "INACTIVE" && c.isActive) return false;
      if (q && !c.name.toLowerCase().includes(q) && !c.slug.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [categories, query, statusFilter]);

  const filtersActive = statusFilter !== "ALL" || !!query.trim();
  const resetFilters = () => {
    setQuery("");
    setStatusFilter("ALL");
  };

  const activeCount = categories.filter((c) => c.isActive).length;
  const linkedTotal = categories.reduce((sum, c) => sum + c.jobTypeCount, 0);

  const baseline = selected
    ? {
        name: selected.name,
        icon: selected.icon ?? "",
        sortOrder: String(selected.sortOrder),
        isActive: selected.isActive,
      }
    : { name: "", icon: "", sortOrder: "0", isActive: true };
  const dirty =
    formName !== baseline.name ||
    formIcon !== baseline.icon ||
    formSortOrder !== baseline.sortOrder ||
    formIsActive !== baseline.isActive;
  const confirmDiscard = useUnsavedChanges(
    dirty,
    selected ? `Category: ${selected.name}` : "New category",
  );

  const handleSelect = async (cat: Category) => {
    if (cat.id === selected?.id) return;
    if (!(await confirmDiscard())) return;
    fillForm(cat);
  };

  // "New category" and closing the editor both reset the form.
  const handleReset = async () => {
    if (!(await confirmDiscard())) return;
    resetForm();
  };

  const sortOrderError =
    formSortOrder.trim() !== "" && !(parseInt(formSortOrder, 10) >= 0)
      ? "Use a whole number, 0 or more."
      : null;

  // ---------------------------------------------------------------------------
  // Editor panel
  // ---------------------------------------------------------------------------

  const panelFooter = (
    <SaveBar dirty={dirty} status={saving ? "Saving…" : undefined}>
      {dirty && (
        <Button variant="ghost" onClick={discardChanges} disabled={saving}>
          Discard
        </Button>
      )}
      <Button
        type="submit"
        form="category-form"
        variant="primary"
        disabled={!dirty || saving}
        aria-busy={saving}
      >
        {saving ? "Saving…" : selected ? "Save category" : "Create category"}
      </Button>
    </SaveBar>
  );

  const panel = (
    <DetailPanel
      title={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {selected ? "Edit category" : "New category"}
          {selected && (
            <Badge tone={selected.isActive ? "green" : "neutral"}>
              {selected.isActive ? "Active" : "Inactive"}
            </Badge>
          )}
        </span>
      }
      onClose={selected ? handleReset : undefined}
      closeLabel="Clear selection"
      footer={panelFooter}
    >
      <form id="category-form" onSubmit={handleSubmit}>
        <PanelSection>
          <div className="space-y-4">
            <Field label="Name" htmlFor="cat-name">
              <TextInput
                id="cat-name"
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                placeholder="e.g. Visual Design & Brand Identity"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Icon (emoji)" htmlFor="cat-icon" hint="Shown next to the name.">
                <div className="flex items-center gap-2">
                  <IconTile tone="peach" size={40}>
                    <span aria-hidden className="text-xl">
                      {formIcon.trim() || DASH}
                    </span>
                  </IconTile>
                  <TextInput
                    id="cat-icon"
                    type="text"
                    value={formIcon}
                    onChange={(e) => setFormIcon(e.target.value)}
                    placeholder="e.g. 🎨"
                  />
                </div>
              </Field>

              <Field
                label="Display order"
                htmlFor="cat-sort"
                hint="Lower numbers appear first."
                error={sortOrderError}
              >
                <TextInput
                  id="cat-sort"
                  type="number"
                  min={0}
                  value={formSortOrder}
                  onChange={(e) => setFormSortOrder(e.target.value)}
                  placeholder="0"
                  aria-invalid={sortOrderError ? true : undefined}
                  className="tabular-nums"
                />
              </Field>
            </div>
          </div>
        </PanelSection>

        <PanelSection>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p id="cat-active-label" className="text-sm font-medium">
                Active
              </p>
              <p id="cat-active-hint" className="mt-0.5 text-xs text-[var(--av2-text-2)]">
                Active categories appear in the service catalogue and the request creation form.
              </p>
            </div>
            <Switch
              checked={formIsActive}
              onChange={setFormIsActive}
              labelledBy="cat-active-label"
              describedBy="cat-active-hint"
            />
          </div>
        </PanelSection>

        {selected && (
          <PanelSection
            title="Linked services"
            action={<TextLink href="/admin/job-types">Manage services</TextLink>}
          >
            <p className="text-[32px] leading-10 font-bold tracking-tight tabular-nums">
              {fmt(selected.jobTypeCount)}{" "}
              <span className="text-sm font-normal text-[var(--av2-text-2)]">
                {plural(selected.jobTypeCount, "service", "services")}
              </span>
            </p>
            <p className="mt-1 text-xs text-[var(--av2-text-2)]">{LINKED_COUNT_NOTE}</p>
          </PanelSection>
        )}

        {selected && (
          <PanelSection title="Danger zone">
            <p className="mb-3 text-sm text-[var(--av2-text-2)]">
              Deleting a category unlinks its services (they move to “Uncategorized”).
            </p>
            <Button variant="danger" onClick={() => setDeleteConfirm(selected)}>
              Delete category
            </Button>
          </PanelSection>
        )}
      </form>
    </DetailPanel>
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div>
      <PageHeader
        title="Service categories"
        description="Organise services into categories and control their order in the service catalogue and request creation form."
        meta={
          loaded && !error ? (
            <span className="tabular-nums">
              {fmt(categories.length)} {plural(categories.length, "category", "categories")} ·{" "}
              {fmt(activeCount)} active · {fmt(linkedTotal)} linked{" "}
              {plural(linkedTotal, "service", "services")}
            </span>
          ) : null
        }
        actions={
          <Button variant="primary" onClick={handleReset}>
            <span aria-hidden className="text-lg leading-none">
              +
            </span>
            New category
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

      {/* Legacy text-category banner: shown whenever job types still carry
          only a text label. Linking is idempotent (see the migrate route). */}
      {legacyPreview && (
        <div className="mb-6">
          <Callout
            tone="warning"
            title={`${legacyPreview.unlinkedJobTypes} ${plural(legacyPreview.unlinkedJobTypes, "service isn't", "services aren't")} linked to a category`}
            action={
              <Button
                onClick={() => setConfirmLink(true)}
                disabled={migrating}
                aria-busy={migrating}
              >
                {migrating ? "Linking…" : "Review & link"}
              </Button>
            }
          >
            They show a category name from an old text field, but the catalogue counts, the service
            editor and talent onboarding only use linked categories.
          </Callout>
        </div>
      )}

      <ConfirmDialog
        open={confirmLink}
        onClose={() => !migrating && setConfirmLink(false)}
        onConfirm={async () => {
          await handleMigrate();
          setConfirmLink(false);
        }}
        loading={migrating}
        variant="warning"
        title="Link services to categories?"
        description={
          legacyPreview
            ? legacyPreview.groups
                .map((g) =>
                  g.action === "link"
                    ? `${g.jobTypes} → ${g.category?.name}`
                    : `${g.jobTypes} → new category “${g.label}”`,
                )
                .join(" · ") + ". Already linked services and existing categories are not changed."
            : undefined
        }
        confirmLabel="Link services"
        cancelLabel="Not now"
      />

      <SplitView panel={panel}>
        <Card padding="none">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-5">
            <h2 className="text-xl leading-7 font-semibold">Categories</h2>
          </div>
          <div className="px-6 pt-4">
            <FilterBar>
              <SearchInput
                className="w-full min-w-[200px] flex-1"
                value={query}
                onChange={setQuery}
                placeholder="Search categories"
                label="Search categories by name or slug"
              />
              <div className="w-full sm:w-40">
                <Select
                  aria-label="Filter by status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                >
                  <option value="ALL">All statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </Select>
              </div>
            </FilterBar>
          </div>

          {loading && !loaded ? (
            <div className="space-y-3 border-t border-[var(--av2-border)] px-6 py-5" role="status">
              <span className="sr-only">Loading categories…</span>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : categories.length === 0 ? (
            <div className="border-t border-[var(--av2-border)]">
              <EmptyState
                icon={<IconCatalog width={28} height={28} />}
                title="No categories yet"
                description="Create the first category with the editor on the right."
              />
            </div>
          ) : filtered.length === 0 ? (
            <div className="border-t border-[var(--av2-border)]">
              <EmptyState
                title="No categories match these filters"
                description="Try a different search or status."
                action={<Button onClick={resetFilters}>Clear filters</Button>}
              />
            </div>
          ) : (
            <Table label="Service categories">
              <thead>
                <tr>
                  <Th align="right" className="w-20">
                    Order
                  </Th>
                  <Th>Category</Th>
                  <Th align="right">
                    <span title={LINKED_COUNT_NOTE}>Linked services</span>
                  </Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((cat) => (
                  <Tr
                    key={cat.id}
                    selected={selected?.id === cat.id}
                    onSelect={() => handleSelect(cat)}
                    label={`${cat.name}, order ${cat.sortOrder}, ${cat.jobTypeCount} linked services`}
                  >
                    <Td align="right" className="text-[var(--av2-text-2)]">
                      {fmt(cat.sortOrder)}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-3">
                        <IconTile tone={cat.isActive ? "peach" : "neutral"} size={40}>
                          <span aria-hidden className="text-xl">
                            {cat.icon || DASH}
                          </span>
                        </IconTile>
                        <div className="min-w-0">
                          <div className="font-semibold break-words">{cat.name}</div>
                          <div className="text-xs break-all text-[var(--av2-text-2)]">
                            {cat.slug}
                          </div>
                        </div>
                      </div>
                    </Td>
                    <Td align="right" className="whitespace-nowrap">
                      {fmt(cat.jobTypeCount)}
                    </Td>
                    <Td>
                      <Badge tone={cat.isActive ? "green" : "neutral"}>
                        {cat.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}

          {loaded && categories.length > 0 && (
            <TableFooter>
              <span className="tabular-nums">
                Showing {fmt(filtered.length)} of {fmt(categories.length)}{" "}
                {plural(categories.length, "category", "categories")}
              </span>
              {filtersActive ? (
                <Button size="sm" variant="ghost" onClick={resetFilters}>
                  Clear filters
                </Button>
              ) : (
                <span>Change the display order to move a category in the catalogue.</span>
              )}
            </TableFooter>
          )}
        </Card>

        {loaded && categories.length > 0 && (
          <p className="mt-6 flex items-start gap-2 text-sm text-[var(--av2-text-2)]">
            <IconDocument width={18} height={18} className="mt-px shrink-0" />
            <span>
              {selected ? "" : "Select a category to edit it. "}
              Linked services counts services whose category is set to that category; services that
              only carry a legacy text label aren&apos;t counted.
            </span>
          </p>
        )}
      </SplitView>

      {/* Delete confirmation modal */}
      <Modal
        open={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        size="md"
        className="border border-[var(--av2-border)] bg-[var(--av2-surface)]! p-6! shadow-none!"
      >
        <ModalHeader
          title="Delete category"
          onClose={() => setDeleteConfirm(null)}
          className="border-[var(--av2-border)]! [&_h2]:text-xl! [&_h2]:text-[var(--av2-text)]!"
        />
        {deleteConfirm && (
          <div className="space-y-3 text-sm">
            <p className="text-[var(--av2-text-2)]">
              Are you sure you want to delete{" "}
              <strong className="text-[var(--av2-text)]">{deleteConfirm.name}</strong>?
            </p>
            {deleteConfirm.jobTypeCount > 0 && (
              <Callout tone="warning" title="Linked services will be unlinked">
                This category has {deleteConfirm.jobTypeCount} service
                {deleteConfirm.jobTypeCount === 1 ? "" : "s"} linked. They will be unlinked (moved
                to &quot;Uncategorized&quot;).
              </Callout>
            )}
          </div>
        )}
        <ModalFooter className="mt-6">
          <Button variant="ghost" onClick={() => setDeleteConfirm(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete} disabled={deleting} aria-busy={deleting}>
            {deleting ? "Deleting…" : "Delete category"}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
