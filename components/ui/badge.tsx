// -----------------------------------------------------------------------------
// @file: components/ui/badge.tsx
// @purpose: Shared badge / pill component for status indicators and labels
// -----------------------------------------------------------------------------

export type BadgeVariant =
  | "neutral"
  | "primary"
  | "info"
  | "success"
  | "warning"
  | "danger";

type BadgeProps = {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
};

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  neutral: "bg-[var(--bb-bg-card)] text-[var(--bb-text-tertiary)] border border-[var(--bb-border-input)]",
  primary: "bg-[var(--bb-primary-light)] text-[var(--bb-primary-hover)] border border-[var(--bb-primary-border)]",
  info:    "bg-[var(--bb-info-bg)] text-[var(--bb-info-text)] border border-[var(--bb-info-border)]",
  success: "bg-[var(--bb-success-bg)] text-[var(--bb-success-text)] border border-[var(--bb-success-border)]",
  warning: "bg-[var(--bb-warning-bg)] text-[var(--bb-warning-text)] border border-[var(--bb-warning-border)]",
  danger:  "bg-[var(--bb-danger-bg)] text-[var(--bb-danger-text)] border border-[var(--bb-danger-border)]",
};

export function Badge({
  variant = "neutral",
  children,
  className = "",
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
