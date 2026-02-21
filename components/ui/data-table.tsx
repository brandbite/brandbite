// -----------------------------------------------------------------------------
// @file: components/ui/data-table.tsx
// @purpose: Shared table wrapper for consistent styling across all data tables
// -----------------------------------------------------------------------------

import React from "react";

/* -------------------------------------------------------------------------- */
/*  DataTable                                                                  */
/* -------------------------------------------------------------------------- */

type DataTableProps = {
  children: React.ReactNode;
  maxHeight?: string;
  className?: string;
};

export function DataTable({
  children,
  maxHeight,
  className = "",
}: DataTableProps) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] shadow-sm ${className}`}
    >
      <div
        className={`overflow-x-auto ${maxHeight ? `max-h-[${maxHeight}] overflow-y-auto` : ""}`}
      >
        <table className="min-w-full text-left text-xs">{children}</table>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  THead                                                                      */
/* -------------------------------------------------------------------------- */

type THeadProps = {
  children: React.ReactNode;
  className?: string;
};

export function THead({ children, className = "" }: THeadProps) {
  return (
    <thead
      className={`border-b border-[var(--bb-border)] text-[11px] uppercase tracking-[0.08em] text-[var(--bb-text-tertiary)] ${className}`}
    >
      <tr>{children}</tr>
    </thead>
  );
}

/* -------------------------------------------------------------------------- */
/*  TH                                                                         */
/* -------------------------------------------------------------------------- */

type THProps = {
  children: React.ReactNode;
  align?: "left" | "center" | "right";
  className?: string;
  sortable?: boolean;
  sortDirection?: "asc" | "desc" | null;
  onSort?: () => void;
};

export function TH({
  children,
  align = "left",
  className = "",
  sortable,
  sortDirection,
  onSort,
}: THProps) {
  const alignClass =
    align === "right"
      ? "text-right"
      : align === "center"
        ? "text-center"
        : "text-left";

  if (sortable) {
    return (
      <th
        className={`px-3 py-2.5 font-semibold ${alignClass} cursor-pointer select-none transition-colors hover:text-[var(--bb-secondary)] ${className}`}
        onClick={onSort}
      >
        <span className="inline-flex items-center gap-1">
          {children}
          <span className="text-[9px] leading-none opacity-60">
            {sortDirection === "asc"
              ? "▲"
              : sortDirection === "desc"
                ? "▼"
                : "⇅"}
          </span>
        </span>
      </th>
    );
  }

  return (
    <th className={`px-3 py-2.5 font-semibold ${alignClass} ${className}`}>
      {children}
    </th>
  );
}

/* -------------------------------------------------------------------------- */
/*  TD                                                                         */
/* -------------------------------------------------------------------------- */

type TDProps = {
  children: React.ReactNode;
  align?: "left" | "center" | "right";
  className?: string;
  onClick?: React.MouseEventHandler<HTMLTableCellElement>;
};

export function TD({ children, align = "left", className = "", onClick }: TDProps) {
  const alignClass =
    align === "right"
      ? "text-right"
      : align === "center"
        ? "text-center"
        : "text-left";

  return (
    <td
      className={`px-3 py-2.5 align-top text-[11px] text-[var(--bb-secondary)] ${alignClass} ${className}`}
      onClick={onClick}
    >
      {children}
    </td>
  );
}
