// -----------------------------------------------------------------------------
// @file: components/dashboard/money/ledger-query.ts
// @purpose: Turn the customer's ledger filters into API query params.
// -----------------------------------------------------------------------------

export type LedgerQueryInput = {
  direction: "ALL" | "CREDIT" | "DEBIT";
  /** Calendar days from a date input (YYYY-MM-DD), in the customer's own time zone. */
  fromDay: string;
  toDay: string;
  q: string;
};

function localMidnight(day: string, addDays = 0): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date + addDays).toISOString();
}

/**
 * Days are sent as exact instants, so "Nov 5" means Nov 5 where the customer is.
 * The end of the range is the next midnight (exclusive), which stays right on
 * days that aren't 24 hours long.
 */
export function buildLedgerParams({ direction, fromDay, toDay, q }: LedgerQueryInput) {
  const params = new URLSearchParams();
  if (direction !== "ALL") params.set("direction", direction);
  if (fromDay) params.set("from", localMidnight(fromDay));
  if (toDay) params.set("to", localMidnight(toDay, 1));
  if (q.trim()) params.set("q", q.trim());
  return params;
}
