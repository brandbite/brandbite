// -----------------------------------------------------------------------------
// @file: components/ui/modal.tsx
// @purpose: Shared modal dialog with backdrop, sizes, keyboard dismiss,
//           focus trap, ARIA attributes & sub-components
// -----------------------------------------------------------------------------

"use client";

import React, { useEffect, useCallback, useRef, useId } from "react";

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

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  onClose,
  size = "md",
  scrollable = false,
  children,
  className = "",
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const labelId = useId();

  // Keep a stable ref for onClose so the keydown listener doesn't need
  // to be recreated when the parent re-renders with a new callback identity.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Escape key handler + focus trap (stable — no dependency on onClose)
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onCloseRef.current();

    if (e.key === "Tab" && modalRef.current) {
      const focusableEls = modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusableEls.length === 0) return;

      const first = focusableEls[0];
      const last = focusableEls[focusableEls.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  }, []);

  // Keydown listener — only depends on `open` (handleKeyDown is stable)
  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown]);

  // Focus management — only runs on open/close transitions
  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;

    // Focus first focusable element inside modal
    requestAnimationFrame(() => {
      if (modalRef.current) {
        const first = modalRef.current.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
        first?.focus();
      }
    });

    return () => {
      // Restore focus on close
      previousFocusRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-8"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className={`animate-modal-enter w-full ${SIZE_CLASSES[size]} rounded-2xl bg-[var(--bb-bg-page)] p-5 shadow-xl ${
          size === "full"
            ? "flex max-h-[90vh] flex-col overflow-hidden"
            : scrollable
              ? "max-h-[90vh] overflow-y-auto"
              : ""
        } ${className}`}
      >
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child) && child.type === ModalHeader) {
            return React.cloneElement(child as React.ReactElement<ModalHeaderProps>, {
              _labelId: labelId,
            });
          }
          return child;
        })}
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
  /** @internal — injected by Modal */
  _labelId?: string;
};

export function ModalHeader({
  eyebrow,
  title,
  subtitle,
  onClose,
  className = "",
  _labelId,
}: ModalHeaderProps) {
  return (
    <div className={`mb-4 shrink-0 border-b border-[var(--bb-border-subtle)] pb-3 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--bb-text-muted)] uppercase">
              {eyebrow}
            </p>
          )}
          <h2
            id={_labelId}
            className={`${eyebrow ? "mt-1" : ""}text-lg font-semibold text-[var(--bb-secondary)]`}
          >
            {title}
          </h2>
          {subtitle && <p className="mt-1 text-xs text-[var(--bb-text-secondary)]">{subtitle}</p>}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm text-[var(--bb-text-tertiary)] transition-colors hover:bg-[var(--bb-bg-card)] hover:text-[var(--bb-secondary)]"
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
  return <div className={`mt-4 flex items-center justify-end gap-2 ${className}`}>{children}</div>;
}
