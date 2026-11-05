// -----------------------------------------------------------------------------
// @file: components/dashboard/ticket-activity-panel.tsx
// @purpose: Activity tab on ticket details, shared by customer, creative and admin.
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useState } from "react";

import { Callout, Skeleton } from "@/components/admin/v2/ui";
import { formatDateTime } from "@/components/dashboard/money/money-ui";

type ActivityResponse = {
  activity: { id: string; at: string; actor: string; summary: string }[];
  partialHistory: boolean;
};

export function TicketActivityPanel({ url }: { url: string }) {
  const [data, setData] = useState<ActivityResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(url, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error || `Request failed with status ${res.status}`);
        if (!cancelled) setData(json as ActivityResponse);
      } catch (err) {
        console.error("Ticket activity fetch error:", err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load activity.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (error) {
    return (
      <Callout tone="error" title="We couldn't load the activity">
        {error}
      </Callout>
    );
  }

  if (!data) {
    return (
      <div aria-busy="true" aria-label="Loading activity">
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ol>
        {data.activity.map((item, index) => (
          <li key={item.id} className="relative flex gap-3 pb-5 last:pb-0">
            {index < data.activity.length - 1 ? (
              <span
                aria-hidden="true"
                className="absolute top-3 bottom-0 left-[3.5px] w-px bg-[var(--av2-border)]"
              />
            ) : null}
            <span
              aria-hidden="true"
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--av2-text-2)]"
            />
            <div className="min-w-0">
              <p className="text-sm break-words">
                <span className="font-semibold">{item.actor}</span> {item.summary}
              </p>
              <time dateTime={item.at} className="text-xs text-[var(--av2-text-2)]">
                {formatDateTime(item.at)}
              </time>
            </div>
          </li>
        ))}
      </ol>
      {data.partialHistory ? (
        <p className="text-xs text-[var(--av2-text-2)]">
          Older activity may be incomplete, because status and detail changes weren&apos;t recorded
          before November 2026.
        </p>
      ) : null}
    </div>
  );
}
