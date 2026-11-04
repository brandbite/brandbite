// -----------------------------------------------------------------------------
// @file: components/dashboard/account/payout-tiers.tsx
// @purpose: Creative payout tiers: the full list, and a current-rate summary.
//           Everything comes from /api/creative/payout-tier.
// -----------------------------------------------------------------------------

"use client";

import { Badge, Button, Card, CardTitle, DASH, IconTile } from "@/components/admin/v2/ui";
import { IconCoins } from "@/components/admin/v2/icons";

export type PayoutTier = {
  id: string;
  name: string;
  description: string | null;
  minCompletedTickets: number;
  timeWindowDays: number;
  payoutPercent: number;
  completedInWindow: number;
  qualified: boolean;
};

export type PayoutData = {
  tiers: PayoutTier[];
  currentPayoutPercent: number;
  currentTierName: string | null;
  basePayoutPercent: number;
};

export function tierWindowLabel(days: number): string {
  if (days % 365 === 0) {
    const years = days / 365;
    return `${years} year${years > 1 ? "s" : ""}`;
  }
  if (days % 30 === 0) {
    const months = days / 30;
    return `${months} month${months > 1 ? "s" : ""}`;
  }
  return `${days} days`;
}

export function tierProgress(tier: PayoutTier): number {
  if (tier.minCompletedTickets <= 0) return 100;
  return Math.min(Math.round((tier.completedInWindow / tier.minCompletedTickets) * 100), 100);
}

/** The lowest tier above today's rate that isn't reached yet. */
export function nextTier(data: PayoutData): PayoutTier | null {
  return (
    data.tiers
      .filter((t) => !t.qualified && t.payoutPercent > data.currentPayoutPercent)
      .sort((a, b) => a.payoutPercent - b.payoutPercent)[0] ?? null
  );
}

function ProgressBar({ tier }: { tier: PayoutTier }) {
  const progress = tierProgress(tier);
  return (
    <div>
      <div
        role="progressbar"
        aria-label={`Progress towards ${tier.name}`}
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 w-full overflow-hidden rounded-full bg-[var(--av2-track)]"
      >
        <div
          className="h-full rounded-full bg-[var(--av2-fill-orange)]"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="mt-1.5 text-sm text-[var(--av2-text-2)]">
        {tier.completedInWindow.toLocaleString()} / {tier.minCompletedTickets.toLocaleString()}{" "}
        completed in {tierWindowLabel(tier.timeWindowDays)}
      </p>
    </div>
  );
}

const ROW = "rounded-lg border px-4 py-3";
const ROW_ACTIVE = "border-[var(--av2-accent)]/40 bg-[var(--av2-selected)]";
const ROW_IDLE = "border-[var(--av2-border)]";

export function PayoutTiersCard({ data, error }: { data: PayoutData | null; error?: boolean }) {
  return (
    <Card>
      <CardTitle
        description={
          data ? (
            <>
              Complete more tickets to unlock higher payout rates. Your current rate is{" "}
              <span className="font-semibold text-[var(--av2-text)]">
                {data.currentPayoutPercent}%
              </span>
              {data.currentTierName ? ` (${data.currentTierName})` : ""}.
            </>
          ) : (
            "Complete more tickets to unlock higher payout rates."
          )
        }
      >
        Payout tiers
      </CardTitle>

      {!data ? (
        <p className="mt-4 text-sm text-[var(--av2-text-2)]">
          {error ? "We couldn't load your payout tiers." : "Loading payout tiers…"}
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          <li className={`${ROW} ${data.currentTierName ? ROW_IDLE : ROW_ACTIVE}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                  Base rate
                  {!data.currentTierName && <Badge tone="peach">Current</Badge>}
                </p>
                <p className="mt-0.5 text-sm text-[var(--av2-text-2)]">
                  Default payout for all creatives
                </p>
              </div>
              <span className="text-xl leading-7 font-bold tabular-nums">
                {data.basePayoutPercent}%
              </span>
            </div>
          </li>

          {data.tiers.map((tier) => (
            <li key={tier.id} className={`${ROW} ${tier.qualified ? ROW_ACTIVE : ROW_IDLE}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                    {tier.name}
                    {tier.qualified && <Badge tone="peach">Active</Badge>}
                  </p>
                  <p className="mt-0.5 text-sm text-[var(--av2-text-2)]">
                    {tier.minCompletedTickets.toLocaleString()} tickets in{" "}
                    {tierWindowLabel(tier.timeWindowDays)}
                  </p>
                </div>
                <span className="text-xl leading-7 font-bold tabular-nums">
                  {tier.payoutPercent}%
                </span>
              </div>
              {!tier.qualified && (
                <div className="mt-3">
                  <ProgressBar tier={tier} />
                </div>
              )}
            </li>
          ))}

          {data.tiers.length === 0 && (
            <li className="text-sm text-[var(--av2-text-2)]">No payout tiers configured yet.</li>
          )}
        </ul>
      )}
    </Card>
  );
}

export function CurrentPayoutCard({
  data,
  onViewTiers,
}: {
  data: PayoutData | null;
  onViewTiers: () => void;
}) {
  const next = data ? nextTier(data) : null;
  return (
    <Card>
      <CardTitle
        action={
          <Button variant="ghost" onClick={onViewTiers} className="-my-2 shrink-0">
            View tiers
          </Button>
        }
      >
        Current payout rate
      </CardTitle>
      <div className="mt-4 flex items-center gap-4">
        <IconTile tone="green" size={52} round>
          <IconCoins />
        </IconTile>
        <div className="min-w-0">
          <p className="text-[32px] leading-10 font-bold tracking-tight tabular-nums">
            {data ? `${data.currentPayoutPercent}%` : DASH}
          </p>
          <p className="text-sm text-[var(--av2-text-2)]">
            {data ? (data.currentTierName ?? "Base rate") : "Not available right now"}
          </p>
        </div>
      </div>
      {next && (
        <div className="mt-4 border-t border-[var(--av2-border)] pt-4">
          <p className="mb-2 text-sm font-semibold">
            Next: {next.name} ({next.payoutPercent}%)
          </p>
          <ProgressBar tier={next} />
        </div>
      )}
    </Card>
  );
}
