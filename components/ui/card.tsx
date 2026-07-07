// -----------------------------------------------------------------------------
// @file: components/ui/card.tsx
// @purpose: Generic themed Card primitive (none existed — cards were ad-hoc
//           utility strings). Uses --bb-* vars so it works in light and dark.
// -----------------------------------------------------------------------------

import React from "react";

type CardProps = {
  as?: React.ElementType;
  interactive?: boolean;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
};

export function Card({ as, interactive = false, className = "", children, onClick }: CardProps) {
  const Tag = as ?? "div";
  return (
    <Tag
      onClick={onClick}
      className={`rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)] ${
        interactive
          ? "cursor-pointer transition-all hover:border-[var(--bb-primary)] hover:shadow-md focus-visible:ring-2 focus-visible:ring-[var(--bb-primary)] focus-visible:outline-none"
          : ""
      } ${className}`}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-5">
      <div>
        <h3 className="text-base font-semibold text-[var(--bb-secondary)]">{title}</h3>
        {subtitle ? (
          <p className="mt-1 text-sm text-[var(--bb-text-tertiary)]">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`p-5 ${className}`}>{children}</div>;
}
