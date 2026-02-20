// -----------------------------------------------------------------------------
// @file: app/customer/services/page.tsx
// @purpose: Customer-facing service catalog with category grouping
// @version: v2.0.0
// @status: active
// @lastUpdate: 2026-02-20
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { InlineAlert } from "@/components/ui/inline-alert";
import { LoadingState } from "@/components/ui/loading-state";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Service = {
  id: string;
  name: string;
  category: string | null;
  categoryIcon: string | null;
  categorySortOrder: number;
  description: string | null;
  tokenCost: number;
  estimatedHours: number | null;
  hasQuantity: boolean;
  quantityLabel: string | null;
  defaultQuantity: number;
};

type CategoryInfo = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  sortOrder: number;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CustomerServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/api/customer/services", {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(
            (json as any)?.error ?? `Request failed (${res.status})`,
          );
        }

        if (!cancelled) {
          setServices(json.services ?? []);
          setCategories(json.categories ?? []);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load services.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Group services by category, using DB sort order
  const grouped = useMemo(() => {
    // Build a category order map from DB categories
    const catOrderMap = new Map<string, { sortOrder: number; icon: string | null }>();
    for (const cat of categories) {
      catOrderMap.set(cat.name, { sortOrder: cat.sortOrder, icon: cat.icon });
    }

    const map = new Map<string, Service[]>();

    for (const svc of services) {
      const cat = svc.category ?? "Other";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(svc);
    }

    // Sort by category sort order (from DB), then alphabetically for unknowns
    const result: { category: string; icon: string | null; services: Service[] }[] = [];
    const sortedCats = [...map.keys()].sort((a, b) => {
      const aOrder = catOrderMap.get(a)?.sortOrder ?? 999;
      const bOrder = catOrderMap.get(b)?.sortOrder ?? 999;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.localeCompare(b);
    });

    for (const category of sortedCats) {
      const items = map.get(category) ?? [];
      if (items.length > 0) {
        const icon =
          catOrderMap.get(category)?.icon ??
          items[0]?.categoryIcon ??
          null;
        result.push({ category, icon, services: items });
      }
    }

    return result;
  }, [services, categories]);

  // Filtered view
  const visibleGroups = activeCategory
    ? grouped.filter((g) => g.category === activeCategory)
    : grouped;

  const totalCount = services.length;
  const categoryCount = grouped.length;

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--bb-text-muted)]">
          Service catalog
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--bb-secondary)]">
          Services
        </h1>
        <p className="mt-1 text-sm text-[#7a7a7a]">
          Browse our full service catalog.{" "}
          {!loading && !error && (
            <span className="text-[#9a9892]">
              {totalCount} services across {categoryCount} categories
            </span>
          )}
        </p>
      </div>

      {/* Loading */}
      {loading && <LoadingState message="Loading services..." />}

      {/* Error */}
      {error && (
        <InlineAlert variant="error" title="Something went wrong" className="mb-4">
          {error}
        </InlineAlert>
      )}

      {/* Category filter pills */}
      {!loading && !error && services.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCategory(null)}
            className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors ${
              activeCategory === null
                ? "bg-[var(--bb-primary)] text-white"
                : "border border-[var(--bb-border)] bg-white text-[#7a7a7a] hover:border-[var(--bb-primary)] hover:text-[var(--bb-primary)]"
            }`}
          >
            All ({totalCount})
          </button>
          {grouped.map((g) => (
            <button
              key={g.category}
              onClick={() =>
                setActiveCategory(
                  activeCategory === g.category ? null : g.category,
                )
              }
              className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors ${
                activeCategory === g.category
                  ? "bg-[var(--bb-primary)] text-white"
                  : "border border-[var(--bb-border)] bg-white text-[#7a7a7a] hover:border-[var(--bb-primary)] hover:text-[var(--bb-primary)]"
              }`}
            >
              {g.icon ?? ""}{" "}
              {g.category} ({g.services.length})
            </button>
          ))}
        </div>
      )}

      {/* Service groups */}
      {!loading && !error && (
        <div className="space-y-8">
          {visibleGroups.map((group) => (
            <section key={group.category}>
              {/* Category header */}
              <div className="mb-4 flex items-center gap-3">
                <h2 className="text-base font-semibold text-[var(--bb-secondary)]">
                  {group.icon ?? ""}{" "}
                  {group.category}
                </h2>
                <span className="rounded-full bg-[#f5f3f0] px-2 py-0.5 text-[10px] font-medium text-[#7a7a7a]">
                  {group.services.length}
                </span>
              </div>

              {/* Service cards grid */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {group.services.map((svc) => (
                  <ServiceCard key={svc.id} service={svc} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Service card
// ---------------------------------------------------------------------------

function ServiceCard({ service }: { service: Service }) {
  return (
    <div className="flex flex-col rounded-2xl border border-[#e3e1dc] bg-white px-5 py-5 shadow-sm transition-colors hover:border-[var(--bb-primary)]/30">
      {/* Name */}
      <h3 className="text-sm font-semibold text-[var(--bb-secondary)]">
        {service.name}
      </h3>

      {/* Description */}
      {service.description && (
        <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-[#7a7a7a]">
          {service.description}
        </p>
      )}

      {/* Meta row */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {/* Token cost */}
        <span className="inline-flex items-center rounded-full bg-[#fff5ef] px-2.5 py-1 text-[10px] font-semibold text-[var(--bb-primary)]">
          {service.tokenCost} {service.tokenCost === 1 ? "token" : "tokens"}
        </span>

        {/* Estimated hours */}
        {service.estimatedHours != null && (
          <span className="text-[10px] text-[#9a9892]">
            ~{service.estimatedHours}h
          </span>
        )}

        {/* Quantity indicator */}
        {service.hasQuantity && service.quantityLabel && (
          <span className="text-[10px] text-[#b1afa9]">
            {service.quantityLabel}
          </span>
        )}
      </div>

      {/* Spacer to push button to bottom */}
      <div className="flex-1" />

      {/* Create ticket CTA */}
      <Link
        href={`/customer/tickets/new?jobTypeId=${service.id}`}
        className="mt-4 inline-flex items-center justify-center rounded-full border border-[var(--bb-border)] bg-[var(--bb-bg-warm)] px-4 py-1.5 text-[11px] font-semibold text-[var(--bb-text-secondary)] transition-colors hover:border-[var(--bb-primary)] hover:text-[var(--bb-primary)]"
      >
        Create ticket
      </Link>
    </div>
  );
}
