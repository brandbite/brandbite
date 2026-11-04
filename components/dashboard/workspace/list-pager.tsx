// -----------------------------------------------------------------------------
// @file: components/dashboard/workspace/list-pager.tsx
// @purpose: Previous / Next pager for dashboard lists, with 40px controls (the
//           shared admin Pager uses the 32px button size).
// -----------------------------------------------------------------------------

"use client";

import { Button } from "@/components/admin/v2/ui";

export function ListPager({
  page,
  pageCount,
  onPage,
  label,
}: {
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
  label: string;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label={label} className="flex flex-wrap items-center gap-2">
      <Button onClick={() => onPage(page - 1)} disabled={page <= 1}>
        Previous
      </Button>
      <span className="px-1 text-sm whitespace-nowrap text-[var(--av2-text-2)] tabular-nums">
        Page {page} of {pageCount}
      </span>
      <Button onClick={() => onPage(page + 1)} disabled={page >= pageCount}>
        Next
      </Button>
    </nav>
  );
}
