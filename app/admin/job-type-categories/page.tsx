// -----------------------------------------------------------------------------
// @file: app/admin/job-type-categories/page.tsx
// @purpose: Admin page for managing job type categories
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-02-20
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import { useToast } from "@/components/ui/toast-provider";
import { Button } from "@/components/ui/button";
import { FormInput } from "@/components/ui/form-field";
import { LoadingState } from "@/components/ui/loading-state";
import { Badge } from "@/components/ui/badge";

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

export default function AdminJobTypeCategoriesPage() {
  const { showToast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [selected, setSelected] = useState<Category | null>(null);
  const [formName, setFormName] = useState("");
  const [formIcon, setFormIcon] = useState("");
  const [formSortOrder, setFormSortOrder] = useState("0");
  const [formIsActive, setFormIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // Migration
  const [migrating, setMigrating] = useState(false);
  const [hasLegacyCategories, setHasLegacyCategories] = useState(false);

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

      // Check if we need migration (no categories but job types exist with text categories)
      if (cats.length === 0) {
        const jtRes = await fetch("/api/admin/job-types", {
          cache: "no-store",
        });
        const jtJson = await jtRes.json().catch(() => null);
        const jobTypes = jtJson?.jobTypes ?? [];
        const hasText = jobTypes.some(
          (jt: any) => jt.category && !jt.categoryId,
        );
        setHasLegacyCategories(hasText);
      } else {
        setHasLegacyCategories(false);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load categories.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      const msg = isEditing
        ? "Category updated successfully."
        : "Category created successfully.";
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
        throw new Error(json?.error || "Migration failed.");
      }

      showToast({
        type: "success",
        title: json?.message || "Migration completed.",
      });

      await load();
    } catch (err: any) {
      showToast({
        type: "error",
        title: err?.message || "Migration failed.",
      });
    } finally {
      setMigrating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);

    try {
      const res = await fetch(
        `/api/admin/job-type-categories/${deleteConfirm.id}`,
        { method: "DELETE" },
      );
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || "Failed to delete category.");
      }

      const msg =
        json?.unlinkedJobTypes > 0
          ? `Category deleted. ${json.unlinkedJobTypes} job type(s) unlinked.`
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

  return (
    <>
      {/* Page header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Job type categories
          </h1>
          <p className="mt-1 text-sm text-[var(--bb-text-secondary)]">
            Organize job types into categories. Categories appear in the
            service catalog and ticket creation form.
          </p>
        </div>
        <Button onClick={resetForm}>New category</Button>
      </div>

      {/* Error */}
      {error && (
        <InlineAlert variant="error" title="Error" className="mb-4">
          {error}
        </InlineAlert>
      )}

      {/* Migration banner */}
      {hasLegacyCategories && categories.length === 0 && (
        <InlineAlert variant="warning" title="Legacy categories detected" className="mb-4">
          <p className="mt-1 text-xs">
            Your job types have text-based categories that haven&apos;t been
            migrated yet. Click the button below to automatically create
            structured categories and link your existing job types.
          </p>
          <Button
            size="sm"
            className="mt-2"
            onClick={handleMigrate}
            loading={migrating}
            loadingText="Migrating..."
          >
            Migrate from text categories
          </Button>
        </InlineAlert>
      )}

      {/* Summary */}
      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--bb-text-tertiary)]">
            Total categories
          </p>
          <p className="mt-2 text-3xl font-semibold text-[var(--bb-secondary)]">
            {loading ? "&mdash;" : categories.length}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--bb-text-tertiary)]">
            Active
          </p>
          <p className="mt-2 text-2xl font-semibold text-[var(--bb-secondary)]">
            {loading
              ? "&mdash;"
              : categories.filter((c) => c.isActive).length}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--bb-text-tertiary)]">
            Total job types linked
          </p>
          <p className="mt-2 text-2xl font-semibold text-[var(--bb-secondary)]">
            {loading
              ? "&mdash;"
              : categories.reduce((sum, c) => sum + c.jobTypeCount, 0)}
          </p>
        </div>
      </section>

      {/* Table + Form layout */}
      <section className="grid gap-4 md:grid-cols-[3fr_2fr]">
        {/* Left: Category list */}
        <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-4 py-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight">
              Category list
            </h2>
            <p className="text-xs text-[var(--bb-text-tertiary)]">
              {categories.length} categories
            </p>
          </div>

          {loading ? (
            <LoadingState message="Loading categories..." />
          ) : categories.length === 0 ? (
            <EmptyState title="No categories yet." />
          ) : (
            <div className="max-h-[420px] overflow-y-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--bb-border)] text-xs uppercase tracking-[0.08em] text-[var(--bb-text-tertiary)]">
                    <th className="px-2 py-2">Icon</th>
                    <th className="px-2 py-2">Name</th>
                    <th className="px-2 py-2 text-center">Order</th>
                    <th className="px-2 py-2 text-center">Job types</th>
                    <th className="px-2 py-2 text-center">Status</th>
                    <th className="px-2 py-2 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((cat) => (
                    <tr
                      key={cat.id}
                      className={`border-b border-[var(--bb-border-subtle)] text-xs last:border-b-0 cursor-pointer ${
                        selected?.id === cat.id ? "bg-[var(--bb-primary-light)]" : "bg-[var(--bb-bg-page)]"
                      }`}
                      onClick={() => fillForm(cat)}
                    >
                      <td className="px-2 py-2 text-center text-base">
                        {cat.icon || "&mdash;"}
                      </td>
                      <td className="px-2 py-2 text-[11px] font-semibold text-[var(--bb-secondary)]">
                        {cat.name}
                        <div className="text-[10px] font-normal text-[var(--bb-text-tertiary)]">
                          {cat.slug}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-center text-[11px] text-[var(--bb-secondary)]">
                        {cat.sortOrder}
                      </td>
                      <td className="px-2 py-2 text-center text-[11px]">
                        <Badge variant="neutral">{cat.jobTypeCount}</Badge>
                      </td>
                      <td className="px-2 py-2 text-center text-[11px]">
                        <Badge
                          variant={cat.isActive ? "success" : "neutral"}
                        >
                          {cat.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirm(cat);
                          }}
                          className="rounded p-1 text-[var(--bb-text-tertiary)] hover:bg-red-50 hover:text-red-600 transition-colors"
                          title="Delete category"
                        >
                          <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                            />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right: Form */}
        <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-4 shadow-sm">
          <h2 className="text-sm font-semibold tracking-tight">
            {selected ? "Edit category" : "Create new category"}
          </h2>
          <p className="mt-1 text-xs text-[var(--bb-text-secondary)]">
            Categories organize your job types into logical groups.
          </p>

          <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-1">
              <label
                htmlFor="cat-name"
                className="text-xs font-medium text-[var(--bb-secondary)]"
              >
                Name
              </label>
              <FormInput
                id="cat-name"
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                placeholder="e.g. Visual Design & Brand Identity"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="cat-icon"
                  className="text-xs font-medium text-[var(--bb-secondary)]"
                >
                  Icon (emoji)
                </label>
                <FormInput
                  id="cat-icon"
                  type="text"
                  value={formIcon}
                  onChange={(e) => setFormIcon(e.target.value)}
                  placeholder="e.g. \uD83C\uDFA8"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label
                  htmlFor="cat-sort"
                  className="text-xs font-medium text-[var(--bb-secondary)]"
                >
                  Sort order
                </label>
                <FormInput
                  id="cat-sort"
                  type="number"
                  min={0}
                  value={formSortOrder}
                  onChange={(e) => setFormSortOrder(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-medium text-[var(--bb-secondary)]">
                <input
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="h-3 w-3 rounded border-[var(--bb-border-input)] text-[var(--bb-primary)] focus:ring-[var(--bb-primary)]"
                />
                Active
              </label>

              {selected && (
                <Button variant="ghost" size="sm" onClick={resetForm}>
                  Clear selection
                </Button>
              )}
            </div>

            <Button
              type="submit"
              loading={saving}
              loadingText="Saving..."
              className="mt-2"
            >
              {selected ? "Save changes" : "Create category"}
            </Button>
          </form>
        </div>
      </section>

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] p-6 shadow-xl">
            <h3 className="text-base font-semibold text-[var(--bb-secondary)]">
              Delete category
            </h3>
            <p className="mt-2 text-sm text-[var(--bb-text-secondary)]">
              Are you sure you want to delete{" "}
              <strong>{deleteConfirm.name}</strong>?
            </p>
            {deleteConfirm.jobTypeCount > 0 && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                This category has{" "}
                <strong>{deleteConfirm.jobTypeCount}</strong> job type
                {deleteConfirm.jobTypeCount === 1 ? "" : "s"} linked.
                They will be unlinked (moved to &quot;Uncategorized&quot;).
              </div>
            )}
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeleteConfirm(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleDelete}
                loading={deleting}
                loadingText="Deleting..."
              >
                Delete category
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
