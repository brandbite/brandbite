// -----------------------------------------------------------------------------
// @file: app/admin/loading.tsx
// @purpose: Loading skeleton for admin pages (nav provided by layout). Mirrors
//           the admin design language v1 page shape: page header, KPI row,
//           then a list card.
// -----------------------------------------------------------------------------

import { Skeleton } from "@/components/admin/v2/ui";

export default function AdminLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="mb-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-2 h-5 w-96 max-w-full" />
      </div>
      <div className="mb-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex gap-4 rounded-2xl border border-[var(--av2-border)] bg-[var(--av2-surface)] p-6"
          >
            <Skeleton className="h-12 w-12 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-16" />
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-[var(--av2-border)] bg-[var(--av2-surface)] p-6">
        <Skeleton className="h-10 w-full max-w-sm" />
        <div className="mt-6 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
