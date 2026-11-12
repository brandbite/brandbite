// -----------------------------------------------------------------------------
// @file: components/dashboard/tickets/review-undo.ts
// @purpose: The creative's one-minute "Undo" after sending a version for
//           review, shown as a toast on the Board and the request page. The
//           toast stays for what is left of the minute and then goes away.
//           The rule itself lives in lib/tickets/review-undo.ts and is
//           enforced by the server.
// -----------------------------------------------------------------------------

import type { ToastInput } from "@/components/ui/toast-provider";
import { undoMsLeft } from "@/lib/tickets/review-undo";

/** Shown when a pull-back counted as an undo (the server answers `undone`). */
export const VERSION_WITHDRAWN_TOAST: ToastInput = {
  type: "success",
  title: "Version withdrawn",
  description: "Your customer wasn't notified. Send it again when it's ready.",
};

/** Too little time left to read the toast and click: don't offer it. */
const MIN_OFFER_MS = 4_000;

/**
 * Offers "Undo" for the rest of the minute after a version was sent.
 * `sentAtMs` is when the browser got the server's answer to the send.
 * `onUndone` runs after the request is back In progress, to refresh the view.
 */
export function offerReviewUndo(args: {
  showToast: (toast: ToastInput) => string;
  ticketId: string;
  sentAtMs: number;
  onUndone: () => void;
  /** Overrides the default "Version sent for review" title. */
  title?: string;
}): void {
  const { showToast, ticketId, sentAtMs, onUndone } = args;
  const left = undoMsLeft(sentAtMs);
  if (left < MIN_OFFER_MS) {
    showToast({ type: "success", title: args.title ?? "Version sent for review" });
    return;
  }

  const undo = async () => {
    try {
      const res = await fetch("/api/creative/tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ticketId, status: "IN_PROGRESS" }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        showToast({
          type: "error",
          title: "Couldn't undo",
          description: json?.error || "Please try again from the request.",
        });
        return;
      }
      showToast(
        json?.undone
          ? VERSION_WITHDRAWN_TOAST
          : {
              type: "info",
              title: "Pulled back to In progress",
              description: "The minute had passed, so your customer was already told.",
            },
      );
      onUndone();
    } catch {
      showToast({ type: "error", title: "Couldn't undo", description: "Please try again." });
    }
  };

  showToast({
    type: "success",
    title: args.title ?? "Version sent for review",
    description: "Your customer is told in a minute. Sent it by mistake?",
    durationMs: left,
    action: { label: "Undo", onClick: () => void undo() },
  });
}
