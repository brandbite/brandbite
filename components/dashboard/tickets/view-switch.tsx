// -----------------------------------------------------------------------------
// @file: components/dashboard/tickets/view-switch.tsx
// @purpose: Icon buttons for moving a request between its board window and
//           its full page (like Jira): in the window, Expand + Close; on the
//           full page, Collapse (back to the board with the window open) +
//           Close (back to wherever you came from). Same look for every role.
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";

import { IconCollapse, IconExpand } from "@/components/admin/v2/icons";
import { IconX } from "@/components/navigation/nav-icons";

const ICON_BUTTON =
  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--av2-border)] bg-[var(--av2-surface)] text-[var(--av2-text-2)] transition-colors hover:bg-[var(--av2-bg)] hover:text-[var(--av2-text)] focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none";

export function ExpandLink({ href }: { href: string }) {
  return (
    <Link href={href} aria-label="Open full page" title="Open full page" className={ICON_BUTTON}>
      <IconExpand aria-hidden />
    </Link>
  );
}

export function CloseButton({ onClick, label = "Close" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title="Close"
      className={ICON_BUTTON}
    >
      <IconX width={18} height={18} aria-hidden />
    </button>
  );
}

/** Where the full page's Collapse and Close icons go. */
export function fullPageViewLinks(
  role: "customer" | "creative",
  ticketId: string,
  fromBoard: boolean,
) {
  return {
    /** Back to the board with this request's window open. */
    windowHref: `/${role}/board?open=${encodeURIComponent(ticketId)}`,
    /** Back where you came from: the board, or the request list. */
    closeHref: fromBoard ? `/${role}/board` : `/${role}/tickets`,
  };
}

/** Collapse + Close on a request's full page. Leave out windowHref when there's no window. */
export function FullPageViewControls({
  windowHref,
  closeHref,
}: {
  windowHref?: string | null;
  closeHref: string;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      {windowHref ? (
        <Link
          href={windowHref}
          aria-label="Show as window"
          title="Show as window"
          className={ICON_BUTTON}
        >
          <IconCollapse aria-hidden />
        </Link>
      ) : null}
      <Link href={closeHref} aria-label="Close" title="Close" className={ICON_BUTTON}>
        <IconX width={18} height={18} aria-hidden />
      </Link>
    </span>
  );
}
