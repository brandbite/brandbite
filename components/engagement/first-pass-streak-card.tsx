// -----------------------------------------------------------------------------
// @file: components/engagement/first-pass-streak-card.tsx
// @purpose: "First-pass streak" on the creative overview: how many of the
//           creative's latest requests in a row were approved without a
//           revision request.
// -----------------------------------------------------------------------------

import { Card, CardTitle, IconTile } from "@/components/admin/v2/ui";

function StarIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" />
    </svg>
  );
}

export function streakHeadline(streak: number): string {
  if (streak <= 0) return "No streak yet";
  return `${streak} in a row`;
}

export function FirstPassStreakCard({ streak }: { streak: number }) {
  return (
    <Card>
      <CardTitle>First-pass streak</CardTitle>
      <div className="mt-4 flex items-center gap-4">
        <IconTile tone="lavender">
          <StarIcon />
        </IconTile>
        <span aria-hidden className="h-12 w-px bg-[var(--av2-border)]" />
        <div className="min-w-0">
          <p className="text-2xl leading-8 font-semibold tabular-nums">{streakHeadline(streak)}</p>
          <p className="text-sm text-[var(--av2-text-2)]">
            {streak > 0
              ? "Approved without a revision request"
              : "Starts when a request is approved without a revision request"}
          </p>
        </div>
      </div>
    </Card>
  );
}
