// -----------------------------------------------------------------------------
// @file: lib/tickets/creative-transitions.ts
// @purpose: Which status moves a creative may make — one rule shared by the
//           single-ticket PATCH (lib/tickets/transition-status.ts) and the
//           bulk route (app/api/creative/tickets/batch). Pure; no I/O.
//
//           Allowed:
//             TODO        → IN_PROGRESS   (start)
//             IN_PROGRESS → IN_REVIEW     (send a version — creates a revision)
//             IN_PROGRESS → TODO          (un-start; bulk "Move to Backlog")
//             IN_REVIEW   → IN_PROGRESS   (pull a version back)
//           Everything else is refused. In particular TODO → IN_REVIEW used
//           to leave the customer reviewing a ticket with no revision, and
//           IN_REVIEW → TODO hid delivered work. DONE is customer-only and is
//           handled by the callers before this check; CANCELED is terminal.
// -----------------------------------------------------------------------------

export type CreativeTicketStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" | "CANCELED";

const ALLOWED: Record<CreativeTicketStatus, readonly CreativeTicketStatus[]> = {
  TODO: ["IN_PROGRESS"],
  IN_PROGRESS: ["IN_REVIEW", "TODO"],
  IN_REVIEW: ["IN_PROGRESS"],
  DONE: [],
  CANCELED: [],
};

/** Statuses a creative can move a ticket to from `from` (for dropdowns). */
export function allowedCreativeTargets(
  from: CreativeTicketStatus,
): readonly CreativeTicketStatus[] {
  return ALLOWED[from];
}

/**
 * Null when the move is allowed (or a no-op), otherwise a message to show the
 * creative.
 */
export function creativeTransitionError(
  from: CreativeTicketStatus,
  to: CreativeTicketStatus,
): string | null {
  if (from === to) return null;
  if (ALLOWED[from].includes(to)) return null;
  if (from === "DONE") return "This request is done and can't be moved.";
  if (from === "CANCELED") return "This request was cancelled.";
  if (to === "DONE") return "Only the customer can mark a request as done.";
  if (from === "TODO" && to === "IN_REVIEW") {
    return "Start the request first: move it to In progress, then send your work with Upload work.";
  }
  if (from === "IN_REVIEW" && to === "TODO") {
    return "This version is with the customer. Pull it back to In progress instead.";
  }
  return "This status change isn't allowed.";
}
