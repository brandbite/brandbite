// -----------------------------------------------------------------------------
// @file: components/work-schedule/work-schedule-summary.tsx
// @purpose: How the team reads a creative's working hours: the schedule, the same
//           hours on the viewer's clock, and whether they're working right now.
// -----------------------------------------------------------------------------

"use client";

import { useState } from "react";

import { Badge } from "@/components/admin/v2/ui";
import { formatDate } from "@/components/dashboard/money/money-ui";
import {
  describeInTimeZone,
  describeWorkSchedule,
  formatTimeZone,
  isWithinWorkSchedule,
  type WorkSchedule,
} from "@/lib/work-schedule";

export function WorkScheduleSummary({
  schedule,
  legacyNote,
  updatedAt,
}: {
  schedule: WorkSchedule | null;
  /** The free-text note from before schedules existed. Shown only until one is set. */
  legacyNote?: string | null;
  updatedAt?: string | null;
}) {
  const [now] = useState(() => new Date());

  if (!schedule) {
    return (
      <div className="space-y-1">
        <Badge tone="amber">Not set</Badge>
        {legacyNote ? (
          <p className="text-xs break-words text-[var(--av2-text-2)]">Old note: {legacyNote}</p>
        ) : null}
      </div>
    );
  }

  const viewerZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const onViewerClock = describeInTimeZone(schedule, viewerZone, now);
  const working = isWithinWorkSchedule(schedule, now);

  return (
    <div className="space-y-1">
      <p className="text-sm break-words">{describeWorkSchedule(schedule)}</p>
      <p className="text-xs break-words text-[var(--av2-text-2)]">
        {formatTimeZone(schedule.timezone)}
      </p>
      {onViewerClock ? (
        <p className="text-xs break-words text-[var(--av2-text-2)]">Your time: {onViewerClock}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        <Badge tone={working ? "green" : "neutral"} dot>
          {working ? "Working now" : "Outside working hours"}
        </Badge>
        {updatedAt ? (
          <span className="text-xs text-[var(--av2-text-2)]">Updated {formatDate(updatedAt)}</span>
        ) : null}
      </div>
    </div>
  );
}
