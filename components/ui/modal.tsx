// -----------------------------------------------------------------------------
// @file: components/ui/modal.tsx
// @purpose: Shared modal dialog with backdrop, sizes, keyboard dismiss & sub-components
// -----------------------------------------------------------------------------

"use client";

import React, { useEffect, useCallback } from "react";

/* -------------------------------------------------------------------------- */
/*  Modal                                                                      */
/* -------------------------------------------------------------------------- */

type ModalSize = "sm" | "md" | "lg" | "xl" | "2xl" | "full";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  size?: ModalSize;
  scrollable?: boolean;
  children: React.ReactNode;
  className?: string;
};

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-xl",
  xl: "max-w-2xl",
  "2xl": "max-w-3xl",
  full: "max-w-5xl",
};

export function Modal({
  open,
  onClose,
  size = "md",
  scrollable = false,
  children,
  className = "",
}: ModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-8"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`animate-modal-enter w-full ${SIZE_CLASSES[size]} rounded-2xl bg-white p-5 shadow-xl ${
          size === "full"
            ? "flex max-h-[90vh] flex-col overflow-hidden"
            : scrollable
              ? "max-h-[90vh] overflow-y-auto"
              : ""
        } ${className}`}
      >
        {children}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  ModalHeader                                                                */
/* -------------------------------------------------------------------------- */

type ModalHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  onClose?: () => void;
  className?: string;
};

export function ModalHeader({
  eyebrow,
  title,
  subtitle,
  onClose,
  className = "",
}: ModalHeaderProps) {
  return (
    <div className={`mb-4 shrink-0 border-b border-[#f0eee9] pb-3 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b1afa9]">
              {eyebrow}
            </p>
          )}
          <h2
            className={`${eyebrow ? "mt-1 " : ""}text-lg font-semibold text-[#424143]`}
          >
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1 text-xs text-[#7a7a7a]">{subtitle}</p>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm text-[#9a9892] transition-colors hover:bg-[#f5f3f0] hover:text-[#424143]"
            aria-label="Close"
          >
            &times;
          </button>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  ModalFooter                                                                */
/* -------------------------------------------------------------------------- */

type ModalFooterProps = {
  children: React.ReactNode;
  className?: string;
};

export function ModalFooter({ children, className = "" }: ModalFooterProps) {
  return (
    <div className={`mt-4 flex items-center justify-end gap-2 ${className}`}>
      {children}
    </div>
  );
}
