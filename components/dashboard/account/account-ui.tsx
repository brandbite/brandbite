// -----------------------------------------------------------------------------
// @file: components/dashboard/account/account-ui.tsx
// @purpose: Small pieces shared by the customer + creative profile, members and
//           settings screens. Built on the admin v2 primitives.
// -----------------------------------------------------------------------------

"use client";

import { useEffect, type ReactNode } from "react";

import { Button } from "@/components/admin/v2/ui";

/**
 * Tab panel that stays mounted while hidden, so drafts and in-progress steps
 * survive switching tabs. Pair with `<Tabs idPrefix={...}>`.
 */
export function KeptTabPanel({
  idPrefix,
  value,
  active,
  children,
}: {
  idPrefix: string;
  value: string;
  active: string;
  children: ReactNode;
}) {
  return (
    <div
      role="tabpanel"
      id={`${idPrefix}-panel-${value}`}
      aria-labelledby={`${idPrefix}-tab-${value}`}
      hidden={value !== active}
      className="space-y-6"
    >
      {children}
    </div>
  );
}

/** Previous / Next at full control height (the shared Pager's buttons are 32px). */
export function ListPager({
  page,
  pageCount,
  onPage,
}: {
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label="Pagination" className="flex items-center gap-2">
      <Button onClick={() => onPage(page - 1)} disabled={page <= 1}>
        Previous
      </Button>
      <span className="px-1 text-sm tabular-nums">
        Page {page} of {pageCount}
      </span>
      <Button onClick={() => onPage(page + 1)} disabled={page >= pageCount}>
        Next
      </Button>
    </nav>
  );
}

/** Lets a link such as `/customer/settings?tab=plan` open a specific tab. */
export function useTabFromUrl<T extends string>(allowed: readonly T[], onTab: (tab: T) => void) {
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    const match = allowed.find((t) => t === requested);
    if (match) onTab(match);
    // Read once on arrival; later tab changes are the user's own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
