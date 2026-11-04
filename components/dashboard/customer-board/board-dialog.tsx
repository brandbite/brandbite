// -----------------------------------------------------------------------------
// @file: components/dashboard/customer-board/board-dialog.tsx
// @purpose: Dialog frame for the board: fixed header and footer around one
//           scrolling body. Built on the shared Modal, which keeps the focus trap,
//           Escape and backdrop behaviour.
// -----------------------------------------------------------------------------

"use client";

import { useId, type ReactNode } from "react";

import { Eyebrow } from "@/components/admin/v2/ui";
import { IconX } from "@/components/navigation/nav-icons";
import { Modal } from "@/components/ui/modal";

const WIDTH = {
  sm: "!max-w-md",
  md: "!max-w-xl",
  lg: "!max-w-[960px]",
  detail: "!max-w-[1080px]",
} as const;

export function BoardDialog({
  open,
  onClose,
  width = "sm",
  eyebrow,
  title,
  subtitle,
  icon,
  headerActions,
  headerExtra,
  tabs,
  footer,
  elevated,
  children,
}: {
  open: boolean;
  onClose: () => void;
  width?: keyof typeof WIDTH;
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  /** Sits next to the close button. */
  headerActions?: ReactNode;
  /** Sits under the title, e.g. status badges. */
  headerExtra?: ReactNode;
  tabs?: ReactNode;
  footer?: ReactNode;
  elevated?: boolean;
  children: ReactNode;
}) {
  const titleId = useId();

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="full"
      elevated={elevated}
      labelledBy={titleId}
      className={`!max-h-[calc(100dvh-4rem)] !p-0 ${WIDTH[width]}`}
    >
      <header
        className={`shrink-0 px-4 pt-5 sm:px-6 ${tabs ? "" : "border-b border-[var(--av2-border)] pb-4"}`}
      >
        <div className="flex items-start gap-4">
          {icon}
          <div className="min-w-0 flex-1">
            {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
            <h2
              id={titleId}
              className="mt-0.5 text-xl leading-7 font-bold tracking-tight break-words sm:text-2xl sm:leading-8"
            >
              {title}
            </h2>
            {subtitle ? <p className="mt-1 text-sm text-[var(--av2-text-2)]">{subtitle}</p> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {headerActions}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--av2-text-2)] hover:bg-[var(--av2-bg)] hover:text-[var(--av2-text)] focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none"
            >
              <IconX width={18} height={18} />
            </button>
          </div>
        </div>
        {headerExtra ? <div className="mt-3">{headerExtra}</div> : null}
        {tabs ? <div className="mt-4">{tabs}</div> : null}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">{children}</div>

      {footer ? (
        <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t border-[var(--av2-border)] px-4 py-4 sm:px-6">
          {footer}
        </footer>
      ) : null}
    </Modal>
  );
}
