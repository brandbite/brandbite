// -----------------------------------------------------------------------------
// @file: lib/ledger-reason.ts
// @purpose: Readable labels for token ledger reasons. Shared by the dashboards
//           and the server, so ledger search and CSV export use the same words
//           the customer sees on screen.
// -----------------------------------------------------------------------------

const REASON_LABELS: Record<string, string> = {
  ADMIN_ADJUSTMENT: "Adjustment",
  TOKEN_TOPUP: "Token top-up",
  WITHDRAW: "Withdrawal",
};

/** Ledger reasons are stored as codes (AI_REFUND); free text passes through. */
export function formatLedgerReason(reason: string | null | undefined): string {
  if (!reason) return "—";
  if (REASON_LABELS[reason]) return REASON_LABELS[reason];
  if (!/^[A-Z0-9_]+$/.test(reason)) return reason;
  const words = reason.toLowerCase().split("_").join(" ");
  const sentence = words.charAt(0).toUpperCase() + words.slice(1);
  return sentence.replace(/\bai\b/gi, "AI");
}
