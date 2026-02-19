// -----------------------------------------------------------------------------
// @file: components/ui/form-field.tsx
// @purpose: Shared form input, select, and textarea with consistent styling
// -----------------------------------------------------------------------------

import React from "react";

/* -------------------------------------------------------------------------- */
/*  Shared focus + base classes                                                */
/* -------------------------------------------------------------------------- */

const BASE_INPUT =
  "w-full rounded-md border border-[var(--bb-border-input)] bg-[var(--bb-bg-page)] text-sm text-[var(--bb-secondary)] outline-none transition-colors focus:border-[var(--bb-primary)] focus:ring-1 focus:ring-[var(--bb-primary)] disabled:opacity-50 disabled:cursor-not-allowed";

const BASE_SEARCH =
  "w-full rounded-full border border-[var(--bb-border)] bg-[var(--bb-bg-warm)] text-xs text-[var(--bb-secondary)] outline-none placeholder:text-[var(--bb-text-muted)] transition-colors focus:border-[var(--bb-primary)] focus:ring-1 focus:ring-[var(--bb-primary)] disabled:opacity-50 disabled:cursor-not-allowed";

const SIZE_CLASSES = {
  sm: "px-2 py-1 text-xs",
  md: "px-3 py-2 text-sm",
};

/* -------------------------------------------------------------------------- */
/*  FormInput                                                                 */
/* -------------------------------------------------------------------------- */

type FormInputProps = {
  size?: "sm" | "md";
  search?: boolean;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "size" | "className">;

export function FormInput({
  size = "md",
  search = false,
  className = "",
  ...rest
}: FormInputProps) {
  if (search) {
    return (
      <input
        className={`${BASE_SEARCH} px-4 py-2 ${className}`}
        {...rest}
      />
    );
  }

  return (
    <input
      className={`${BASE_INPUT} ${SIZE_CLASSES[size]} ${className}`}
      {...rest}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*  FormSelect                                                                */
/* -------------------------------------------------------------------------- */

type FormSelectProps = {
  size?: "sm" | "md";
  className?: string;
  children: React.ReactNode;
} & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size" | "className">;

export function FormSelect({
  size = "md",
  className = "",
  children,
  ...rest
}: FormSelectProps) {
  return (
    <select
      className={`${BASE_INPUT} ${SIZE_CLASSES[size]} ${className}`}
      {...rest}
    >
      {children}
    </select>
  );
}

/* -------------------------------------------------------------------------- */
/*  FormTextarea                                                              */
/* -------------------------------------------------------------------------- */

type FormTextareaProps = {
  className?: string;
} & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "className">;

export function FormTextarea({ className = "", ...rest }: FormTextareaProps) {
  return (
    <textarea
      className={`${BASE_INPUT} px-3 py-2 ${className}`}
      {...rest}
    />
  );
}
