// -----------------------------------------------------------------------------
// @file: components/colors/studio/studio-button.tsx
// @purpose: The one Color Studio button: 44px high, 10px radius, four variants.
//           Primary is the brand orange with white text, by product decision;
//           that pairing is 2.96:1, below AA for this size. Links styled as
//           buttons reuse studioButtonClasses.
// -----------------------------------------------------------------------------

import type { ButtonHTMLAttributes, ReactNode } from "react";

export type StudioButtonVariant = "primary" | "secondary" | "tertiary" | "danger";

const VARIANTS: Record<StudioButtonVariant, string> = {
  primary:
    "bg-[var(--cs-brand)] text-white hover:bg-[var(--cs-brand-hover)] disabled:hover:bg-[var(--cs-brand)]",
  secondary:
    "border border-[var(--cs-border)] bg-[var(--cs-surface)] text-[var(--cs-text)] hover:border-[var(--cs-text)] disabled:hover:border-[var(--cs-border)]",
  tertiary: "text-[var(--cs-brand-strong)] hover:underline disabled:hover:no-underline",
  danger:
    "border border-[var(--cs-danger)] bg-[var(--cs-surface)] text-[var(--cs-danger)] hover:bg-[#FEF3F2] disabled:hover:bg-[var(--cs-surface)]",
};

export function studioButtonClasses(variant: StudioButtonVariant = "primary"): string {
  return `inline-flex h-11 items-center justify-center gap-2 rounded-[10px] px-4 text-sm leading-5 font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]}`;
}

type StudioButtonProps = {
  variant?: StudioButtonVariant;
  loading?: boolean;
  icon?: ReactNode;
  children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className">;

export function StudioButton({
  variant = "primary",
  loading = false,
  icon,
  children,
  disabled,
  type = "button",
  ...rest
}: StudioButtonProps) {
  return (
    <button
      type={type}
      className={studioButtonClasses(variant)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : (
        icon
      )}
      {children}
    </button>
  );
}
