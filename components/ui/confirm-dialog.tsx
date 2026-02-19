// -----------------------------------------------------------------------------
// @file: components/ui/confirm-dialog.tsx
// @purpose: Reusable confirmation dialog for destructive actions
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-02-18
// -----------------------------------------------------------------------------

"use client";

import { Modal, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

/* -------------------------------------------------------------------------- */
/*  Props                                                                      */
/* -------------------------------------------------------------------------- */

type ConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  variant?: "danger" | "warning";
};

/* -------------------------------------------------------------------------- */
/*  Icon                                                                       */
/* -------------------------------------------------------------------------- */

function WarningIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  Variant styles                                                             */
/* -------------------------------------------------------------------------- */

const VARIANT_CONFIG = {
  danger: {
    iconBg: "bg-[var(--bb-danger-bg)]",
    iconColor: "text-[var(--bb-danger-text)]",
    buttonVariant: "danger" as const,
  },
  warning: {
    iconBg: "bg-[var(--bb-warning-bg)]",
    iconColor: "text-[var(--bb-warning-text)]",
    buttonVariant: "primary" as const,
  },
};

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  loading = false,
  variant = "danger",
}: ConfirmDialogProps) {
  const config = VARIANT_CONFIG[variant];

  return (
    <Modal open={open} onClose={loading ? () => {} : onClose} size="sm">
      <div className="flex flex-col items-center text-center px-2 pt-2">
        {/* Icon */}
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-full ${config.iconBg} ${config.iconColor}`}
        >
          <WarningIcon />
        </div>

        {/* Title */}
        <h3 className="mt-3 text-base font-semibold text-[var(--bb-secondary)]">
          {title}
        </h3>

        {/* Description */}
        {description && (
          <p className="mt-1.5 text-sm text-[var(--bb-text-secondary)] leading-relaxed">
            {description}
          </p>
        )}
      </div>

      <ModalFooter className="mt-5 justify-center">
        <Button
          variant="secondary"
          size="sm"
          onClick={onClose}
          disabled={loading}
        >
          {cancelLabel}
        </Button>
        <Button
          variant={config.buttonVariant}
          size="sm"
          onClick={onConfirm}
          loading={loading}
          loadingText={confirmLabel === "Delete" ? "Deleting…" : `${confirmLabel}…`}
        >
          {confirmLabel}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
