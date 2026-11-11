// -----------------------------------------------------------------------------
// @file: lib/engagement/thanks.ts
// @purpose: The thank-you tags a customer can add when approving a delivery.
//           Stored as these keys in TicketThanks.tags; labels are what people
//           see. No server imports, so client components can share it.
// -----------------------------------------------------------------------------

export const THANKS_TAGS = ["NAILED_BRIEF", "QUICK_TURNAROUND", "GREAT_COMMUNICATION"] as const;

export type ThanksTag = (typeof THANKS_TAGS)[number];

export const THANKS_TAG_LABELS: Record<ThanksTag, string> = {
  NAILED_BRIEF: "Nailed the brief",
  QUICK_TURNAROUND: "Quick turnaround",
  GREAT_COMMUNICATION: "Great communication",
};

export function isThanksTag(value: unknown): value is ThanksTag {
  return typeof value === "string" && (THANKS_TAGS as readonly string[]).includes(value);
}

/** Known tags only, each once, in the standard order. */
export function cleanThanksTags(input: unknown): ThanksTag[] {
  if (!Array.isArray(input)) return [];
  const chosen = new Set(input.filter(isThanksTag));
  return THANKS_TAGS.filter((tag) => chosen.has(tag));
}

export type ThanksTotals = Record<ThanksTag, number>;

export function countThanks(rows: { tags: string[] }[]): ThanksTotals {
  const totals = Object.fromEntries(THANKS_TAGS.map((t) => [t, 0])) as ThanksTotals;
  for (const row of rows) for (const tag of cleanThanksTags(row.tags)) totals[tag] += 1;
  return totals;
}

/** "Nailed the brief and Quick turnaround" for a notification line. */
export function thanksSentence(tags: ThanksTag[]): string {
  const labels = tags.map((t) => THANKS_TAG_LABELS[t]);
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}
