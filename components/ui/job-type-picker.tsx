// -----------------------------------------------------------------------------
// @file: components/ui/job-type-picker.tsx
// @purpose: Modal-based job type picker with dynamic category filtering and search
// @version: v2.0.0
// @status: active
// @lastUpdate: 2026-02-20
// -----------------------------------------------------------------------------

"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal, ModalHeader } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

type JobTypeOption = {
  id: string;
  name: string;
  category: string | null;
  categorySortOrder?: number;
  description: string | null;
  tokenCost?: number;
  hasQuantity?: boolean;
  quantityLabel?: string | null;
  defaultQuantity?: number;
};

type JobTypePickerProps = {
  jobTypes: JobTypeOption[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
};

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function getCategoryName(jt: JobTypeOption): string {
  return jt.category || "Other";
}

/**
 * Sort categories using categorySortOrder from DB.
 * Categories without a sort order go last, sorted alphabetically.
 */
function sortedCategories(
  cats: string[],
  sortOrderMap: Map<string, number>,
): string[] {
  return [...cats].sort((a, b) => {
    const aOrder = sortOrderMap.get(a) ?? 999;
    const bOrder = sortOrderMap.get(b) ?? 999;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.localeCompare(b);
  });
}

/** Short label for mobile pills — take first word or first N chars */
function shortLabel(cat: string): string {
  // If it contains "&", take text before "&"
  const parts = cat.split("&");
  if (parts.length > 1) {
    return parts[0].trim().split(/\s+/).slice(0, 2).join(" ");
  }
  // Otherwise take first 2 words
  return cat.split(/\s+/).slice(0, 2).join(" ");
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export function JobTypePicker({
  jobTypes,
  value,
  onChange,
  disabled = false,
}: JobTypePickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string>(value);

  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Sync pending selection when modal opens
  useEffect(() => {
    if (open) {
      setPendingId(value);
      setSearch("");
      setActiveCategory(null);
    }
  }, [open, value]);

  // Auto-focus search when modal opens
  useEffect(() => {
    if (open) {
      // Small delay to allow modal animation
      const t = setTimeout(() => searchRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [open]);

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  /** Build a map of category name -> sortOrder from job type data */
  const categorySortOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const jt of jobTypes) {
      const cat = getCategoryName(jt);
      if (jt.categorySortOrder !== undefined && !map.has(cat)) {
        map.set(cat, jt.categorySortOrder);
      }
    }
    return map;
  }, [jobTypes]);

  /** All unique category names in sorted order */
  const categories = useMemo(() => {
    const names = new Set(jobTypes.map(getCategoryName));
    return sortedCategories(Array.from(names), categorySortOrderMap);
  }, [jobTypes, categorySortOrderMap]);

  /** Job types grouped by category */
  const grouped = useMemo(() => {
    const map = new Map<string, JobTypeOption[]>();
    for (const jt of jobTypes) {
      const cat = getCategoryName(jt);
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(jt);
    }
    return map;
  }, [jobTypes]);

  /** Filtered job types based on search + category */
  const filteredGrouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = new Map<string, JobTypeOption[]>();

    const catsToShow = activeCategory ? [activeCategory] : categories;

    for (const cat of catsToShow) {
      const items = grouped.get(cat) ?? [];
      const filtered = q
        ? items.filter((jt) => jt.name.toLowerCase().includes(q))
        : items;
      if (filtered.length > 0) {
        result.set(cat, filtered);
      }
    }

    return result;
  }, [search, activeCategory, categories, grouped]);

  /** Count of filtered items per category (for sidebar counts) */
  const categoryCounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const counts = new Map<string, number>();
    let total = 0;

    for (const cat of categories) {
      const items = grouped.get(cat) ?? [];
      const count = q
        ? items.filter((jt) => jt.name.toLowerCase().includes(q)).length
        : items.length;
      counts.set(cat, count);
      total += count;
    }

    counts.set("__all__", total);
    return counts;
  }, [search, categories, grouped]);

  // Total filtered count
  const totalFiltered = categoryCounts.get("__all__") ?? 0;

  // Selected job type for display
  const selectedJobType = value
    ? jobTypes.find((jt) => jt.id === value) ?? null
    : null;

  // Pending job type in modal
  const pendingJobType = pendingId
    ? jobTypes.find((jt) => jt.id === pendingId) ?? null
    : null;

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleOpen = useCallback(() => {
    if (!disabled) setOpen(true);
  }, [disabled]);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  const handleConfirm = useCallback(() => {
    if (pendingId) {
      onChange(pendingId);
    }
    setOpen(false);
  }, [pendingId, onChange]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(e.target.value);
      // Reset category filter when searching so results span all categories
      if (e.target.value.trim()) {
        setActiveCategory(null);
      }
    },
    [],
  );

  const handleCategoryClick = useCallback((cat: string | null) => {
    setActiveCategory(cat);
    // Scroll list to top when switching categories
    listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleItemClick = useCallback((id: string) => {
    setPendingId(id);
  }, []);

  const handleItemDoubleClick = useCallback(
    (id: string) => {
      onChange(id);
      setOpen(false);
    },
    [onChange],
  );

  // Keyboard: Enter to confirm in search, Escape handled by Modal
  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        // If only one result, select it
        let singleItem: JobTypeOption | null = null;
        let count = 0;
        for (const items of filteredGrouped.values()) {
          for (const item of items) {
            singleItem = item;
            count++;
            if (count > 1) break;
          }
          if (count > 1) break;
        }
        if (count === 1 && singleItem) {
          setPendingId(singleItem.id);
        }
      }
    },
    [filteredGrouped],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      {/* -- Trigger button ------------------------------------------------- */}
      <button
        type="button"
        onClick={handleOpen}
        disabled={disabled}
        aria-label="Select job type"
        className={`
          flex w-full items-center justify-between gap-2 rounded-md border
          border-[var(--bb-border-input)] bg-[var(--bb-bg-page)] px-3 py-2
          text-left text-sm outline-none transition-colors
          focus:border-[var(--bb-primary)] focus:ring-1 focus:ring-[var(--bb-primary)]
          disabled:cursor-not-allowed disabled:opacity-50
          ${selectedJobType ? "text-[var(--bb-secondary)]" : "text-[var(--bb-text-muted)]"}
        `}
      >
        <div className="min-w-0 flex-1">
          {selectedJobType ? (
            <>
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">
                  {selectedJobType.name}
                </span>
                {selectedJobType.tokenCost != null && (
                  <Badge variant="neutral" className="shrink-0">
                    {selectedJobType.tokenCost} tokens
                  </Badge>
                )}
              </div>
              <div className="mt-0.5 truncate text-[11px] text-[var(--bb-text-tertiary)]">
                {getCategoryName(selectedJobType)}
              </div>
            </>
          ) : (
            <span>Choose a service type&hellip;</span>
          )}
        </div>

        {/* Chevron icon */}
        <svg
          className="h-4 w-4 shrink-0 text-[var(--bb-text-muted)]"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9"
          />
        </svg>
      </button>

      {/* -- Modal ---------------------------------------------------------- */}
      <Modal open={open} onClose={handleClose} size="full">
        {/* Header */}
        <ModalHeader
          title="Choose a service type"
          subtitle={`${jobTypes.length} services across ${categories.length} categories`}
          onClose={handleClose}
        />

        {/* Search bar */}
        <div className="mb-3 shrink-0">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--bb-text-muted)]"
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
              ref={searchRef}
              type="text"
              placeholder="Search services&hellip;"
              value={search}
              onChange={handleSearchChange}
              onKeyDown={handleSearchKeyDown}
              aria-label="Search services"
              className="w-full rounded-lg border border-[var(--bb-border)] bg-[var(--bb-bg-warm)] py-2 pl-10 pr-3 text-sm text-[var(--bb-secondary)] outline-none placeholder:text-[var(--bb-text-muted)] transition-colors focus:border-[var(--bb-primary)] focus:ring-1 focus:ring-[var(--bb-primary)]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--bb-text-muted)] hover:text-[var(--bb-secondary)]"
                aria-label="Clear search"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* -- Body: sidebar + list ----------------------------------------- */}
        <div className="flex min-h-0 flex-1 flex-col gap-3 md:flex-row md:gap-4">
          {/* Category sidebar -- desktop: vertical, mobile: horizontal pills */}

          {/* Desktop sidebar */}
          <nav className="hidden shrink-0 md:flex md:w-[200px] md:flex-col md:gap-1">
            <button
              type="button"
              onClick={() => handleCategoryClick(null)}
              className={`rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
                activeCategory === null
                  ? "bg-[var(--bb-primary-light)] text-[var(--bb-primary-hover)]"
                  : "text-[var(--bb-text-secondary)] hover:bg-[var(--bb-bg-card)]"
              }`}
            >
              All services
              <span className="ml-1.5 text-[10px] opacity-60">
                ({categoryCounts.get("__all__") ?? 0})
              </span>
            </button>

            {categories.map((cat) => {
              const count = categoryCounts.get(cat) ?? 0;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleCategoryClick(cat)}
                  className={`rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
                    activeCategory === cat
                      ? "bg-[var(--bb-primary-light)] text-[var(--bb-primary-hover)]"
                      : count === 0
                        ? "text-[var(--bb-text-muted)] opacity-40"
                        : "text-[var(--bb-text-secondary)] hover:bg-[var(--bb-bg-card)]"
                  }`}
                >
                  {cat}
                  <span className="ml-1.5 text-[10px] opacity-60">
                    ({count})
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Mobile pills */}
          <div className="flex gap-2 overflow-x-auto pb-1 md:hidden">
            <button
              type="button"
              onClick={() => handleCategoryClick(null)}
              className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                activeCategory === null
                  ? "bg-[var(--bb-primary-light)] text-[var(--bb-primary-hover)] border border-[var(--bb-primary-border)]"
                  : "bg-[var(--bb-bg-card)] text-[var(--bb-text-secondary)] border border-[var(--bb-border)]"
              }`}
            >
              All ({categoryCounts.get("__all__") ?? 0})
            </button>

            {categories.map((cat) => {
              const count = categoryCounts.get(cat) ?? 0;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleCategoryClick(cat)}
                  className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                    activeCategory === cat
                      ? "bg-[var(--bb-primary-light)] text-[var(--bb-primary-hover)] border border-[var(--bb-primary-border)]"
                      : count === 0
                        ? "bg-[var(--bb-bg-card)] text-[var(--bb-text-muted)] border border-[var(--bb-border)] opacity-40"
                        : "bg-[var(--bb-bg-card)] text-[var(--bb-text-secondary)] border border-[var(--bb-border)]"
                  }`}
                >
                  {shortLabel(cat)} ({count})
                </button>
              );
            })}
          </div>

          {/* Service list */}
          <div
            ref={listRef}
            className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)]"
          >
            {totalFiltered === 0 ? (
              <div className="flex items-center justify-center px-4 py-12 text-sm text-[var(--bb-text-muted)]">
                No services match your search.
              </div>
            ) : (
              Array.from(filteredGrouped.entries()).map(([cat, items]) => (
                <div key={cat}>
                  {/* Category header -- sticky */}
                  <div className="sticky top-0 z-10 border-b border-[var(--bb-border-subtle)] bg-[var(--bb-bg-warm)] px-4 py-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--bb-text-tertiary)]">
                      {cat}
                    </span>
                    <span className="ml-2 text-[10px] text-[var(--bb-text-muted)]">
                      {items.length} service{items.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  {/* Service items */}
                  {items.map((jt) => {
                    const isSelected = jt.id === pendingId;
                    return (
                      <button
                        key={jt.id}
                        type="button"
                        onClick={() => handleItemClick(jt.id)}
                        onDoubleClick={() => handleItemDoubleClick(jt.id)}
                        className={`flex w-full items-center gap-3 border-b border-[var(--bb-border-subtle)] px-4 py-2.5 text-left transition-colors last:border-b-0 ${
                          isSelected
                            ? "bg-[var(--bb-primary-light)] border-l-2 border-l-[var(--bb-primary)]"
                            : "hover:bg-[var(--bb-bg-card)]"
                        }`}
                        role="option"
                        aria-selected={isSelected}
                      >
                        {/* Radio indicator */}
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                            isSelected
                              ? "border-[var(--bb-primary)] bg-[var(--bb-primary)]"
                              : "border-[var(--bb-border)] bg-[var(--bb-bg-page)]"
                          }`}
                        >
                          {isSelected && (
                            <span className="h-1.5 w-1.5 rounded-full bg-[var(--bb-bg-page)]" />
                          )}
                        </span>

                        {/* Name + category */}
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-medium text-[var(--bb-secondary)]">
                            {jt.name}
                          </div>
                          {/* Show category subtitle only in "All" view */}
                          {activeCategory === null && !search && (
                            <div className="text-[11px] text-[var(--bb-text-tertiary)]">
                              {getCategoryName(jt)}
                            </div>
                          )}
                        </div>

                        {/* Token cost */}
                        {jt.tokenCost != null && (
                          <Badge variant="neutral" className="shrink-0">
                            {jt.tokenCost} tokens
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>

        {/* -- Footer ------------------------------------------------------- */}
        <div className="mt-4 flex shrink-0 items-center justify-between gap-3 border-t border-[var(--bb-border-subtle)] pt-4">
          <div className="min-w-0 flex-1 text-xs text-[var(--bb-text-tertiary)]">
            {pendingJobType ? (
              <span>
                Selected:{" "}
                <span className="font-semibold text-[var(--bb-secondary)]">
                  {pendingJobType.name}
                </span>
                {pendingJobType.tokenCost != null && (
                  <span className="ml-1 text-[var(--bb-text-muted)]">
                    ({pendingJobType.tokenCost} tokens)
                  </span>
                )}
              </span>
            ) : (
              <span className="text-[var(--bb-text-muted)]">
                Select a service to continue
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleConfirm}
              disabled={!pendingId}
            >
              Select
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
