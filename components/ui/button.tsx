// -----------------------------------------------------------------------------
// @file: components/ui/button.tsx
// @purpose: Shared button component with consistent variants, sizes and states
// -----------------------------------------------------------------------------

import React from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingText?: string;
  className?: string;
  children: React.ReactNode;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className">;

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--bb-primary)] text-white shadow-sm hover:bg-[var(--bb-primary-hover)] focus-visible:ring-[var(--bb-primary)]",
  secondary:
    "border border-[var(--bb-border)] bg-[var(--bb-bg-warm)] text-[var(--bb-text-secondary)] hover:border-[var(--bb-primary)] hover:text-[var(--bb-primary)] focus-visible:ring-[var(--bb-primary)]",
  danger:
    "border border-[#fde0de] bg-[#fff7f6] text-[var(--bb-danger-text)] hover:bg-[#fdecea] focus-visible:ring-[var(--bb-danger-text)]",
  ghost:
    "text-[var(--bb-text-secondary)] hover:text-[var(--bb-secondary)] hover:bg-[var(--bb-bg-card)] focus-visible:ring-[var(--bb-primary)]",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-[11px]",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  loadingText,
  className = "",
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      className={`inline-flex items-center justify-center rounded-full font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      disabled={isDisabled}
      {...rest}
    >
      {loading ? (loadingText ?? "Saving…") : children}
    </button>
  );
}
