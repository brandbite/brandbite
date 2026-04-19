// -----------------------------------------------------------------------------
// @file: components/board/board-view-toggle.tsx
// @purpose: Two-tab segmented control that navigates between the kanban Board
//           view and the Table (tickets list) view. Presents them as a single
//           feature with two viewing modes — the sidebar now only carries one
//           Board entry and the user switches views via this toggle.
//
//           Each role has its own pair of routes; the component takes a base
//           role path and composes the two targets from it.
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type BoardViewToggleProps = {
  /** One of "/customer", "/creative", "/admin". */
  rolePath: string;
};

export function BoardViewToggle({ rolePath }: BoardViewToggleProps) {
  const pathname = usePathname() ?? "";
  const boardHref = `${rolePath}/board`;
  const tableHref = `${rolePath}/tickets`;
  const isBoard = pathname === boardHref || pathname.startsWith(`${boardHref}/`);
  const isTable = pathname === tableHref || pathname.startsWith(`${tableHref}/`);

  return (
    <div
      role="tablist"
      aria-label="Board view"
      className="inline-flex rounded-full border border-[var(--bb-border)] bg-[var(--bb-bg-page)] p-0.5 text-xs font-medium"
    >
      <Link
        role="tab"
        aria-selected={isBoard}
        href={boardHref}
        className={`rounded-full px-4 py-1.5 transition-colors ${
          isBoard
            ? "bg-[var(--bb-secondary)] text-white"
            : "text-[var(--bb-text-secondary)] hover:text-[var(--bb-secondary)]"
        }`}
      >
        Kanban
      </Link>
      <Link
        role="tab"
        aria-selected={isTable}
        href={tableHref}
        className={`rounded-full px-4 py-1.5 transition-colors ${
          isTable
            ? "bg-[var(--bb-secondary)] text-white"
            : "text-[var(--bb-text-secondary)] hover:text-[var(--bb-secondary)]"
        }`}
      >
        Table
      </Link>
    </div>
  );
}
