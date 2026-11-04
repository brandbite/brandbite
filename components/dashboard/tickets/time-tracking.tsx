// -----------------------------------------------------------------------------
// @file: components/dashboard/tickets/time-tracking.tsx
// @purpose: Time tracking for the creative job screen: a compact timer strip
//           that stays above the tabs, and the entry log inside its own tab.
//           Talks to /api/creative/tickets/[ticketId]/time-entries.
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { IconClock } from "@/components/admin/v2/icons";
import { Button, Callout, Card, EmptyState, Skeleton } from "@/components/admin/v2/ui";

type TimeEntry = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  running: boolean;
};

type Summary = {
  entries: TimeEntry[];
  runningEntry: TimeEntry | null;
  totalLoggedSeconds: number;
};

function clock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function timeOfDay(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function useTimeTracking(ticketId: string | null, estimatedHours: number | null) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [migrationPending, setMigrationPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    if (!ticketId) return;
    setError(null);
    setMigrationPending(false);
    try {
      const res = await fetch(`/api/creative/tickets/${ticketId}/time-entries`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 503 && json?.code === "MIGRATION_PENDING") {
          setMigrationPending(true);
          return;
        }
        setError(json?.error ?? "Failed to load time entries.");
        return;
      }
      setSummary(json as Summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load time entries.");
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    load();
  }, [load]);

  // Tick once a second while a timer runs.
  const running = summary?.runningEntry ?? null;
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const runningSeconds = useMemo(
    () =>
      running ? Math.max(0, Math.floor((now - new Date(running.startedAt).getTime()) / 1000)) : 0,
    [running, now],
  );

  const act = async (
    key: string,
    fallback: string,
    request: () => Promise<Response>,
  ): Promise<void> => {
    setActionError(null);
    setPending(key);
    try {
      const res = await request();
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setActionError(json?.error ?? fallback);
        return;
      }
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : fallback);
    } finally {
      setPending(null);
    }
  };

  const base = `/api/creative/tickets/${ticketId}/time-entries`;
  const start = () =>
    act("start", "Failed to start timer.", () =>
      fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
  const stop = (entryId: string) =>
    act(`stop:${entryId}`, "Failed to stop timer.", () =>
      fetch(`${base}/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      }),
    );
  const remove = (entryId: string) => {
    if (!window.confirm("Delete this time entry? This can't be undone.")) return;
    return act(`delete:${entryId}`, "Failed to delete entry.", () =>
      fetch(`${base}/${entryId}`, { method: "DELETE" }),
    );
  };

  const estimatedSeconds =
    typeof estimatedHours === "number" && estimatedHours > 0 ? estimatedHours * 3600 : null;
  const combinedSeconds = (summary?.totalLoggedSeconds ?? 0) + runningSeconds;

  return {
    summary,
    loading,
    error,
    migrationPending,
    actionError,
    pending,
    running,
    runningSeconds,
    combinedSeconds,
    estimatedHours: estimatedSeconds ? estimatedHours : null,
    percentOfEstimate: estimatedSeconds
      ? Math.round((combinedSeconds / estimatedSeconds) * 100)
      : null,
    start,
    stop,
    remove,
  };
}

export type TimeTracking = ReturnType<typeof useTimeTracking>;

/** One-line timer. Hidden until the first load, and where tracking is unavailable. */
export function TimeStrip({ tracking }: { tracking: TimeTracking }) {
  const { summary, loading, error, migrationPending, actionError, pending, running } = tracking;
  if (loading) return <Skeleton className="h-[74px]" />;
  if (migrationPending || error || !summary) return null;

  return (
    <Card padding="sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex items-center gap-3">
          <IconClock />
          <p className="flex items-baseline gap-2">
            <span
              role="timer"
              aria-label="Time logged"
              className="text-xl leading-7 font-bold tabular-nums"
            >
              {clock(tracking.combinedSeconds)}
            </span>
            {tracking.estimatedHours ? (
              <span className="text-sm text-[var(--av2-text-2)]">
                / {tracking.estimatedHours}h estimated
              </span>
            ) : null}
          </p>
        </div>
        <p className="min-w-[160px] flex-1 text-sm text-[var(--av2-text-2)] sm:border-l sm:border-[var(--av2-border)] sm:pl-4">
          {running
            ? `Running since ${timeOfDay(running.startedAt)}`
            : summary.entries.length === 0
              ? "No time logged yet."
              : `${summary.entries.length} ${summary.entries.length === 1 ? "entry" : "entries"} logged.`}
        </p>
        {running ? (
          <Button onClick={() => tracking.stop(running.id)} disabled={pending !== null}>
            {pending === `stop:${running.id}` ? "Stopping…" : "Stop timer"}
          </Button>
        ) : (
          <Button variant="primary" onClick={tracking.start} disabled={pending !== null}>
            {pending === "start" ? "Starting…" : "Start timer"}
          </Button>
        )}
      </div>
      {actionError ? (
        <div className="mt-3">
          <Callout tone="error" title="Time tracking">
            {actionError}
          </Callout>
        </div>
      ) : null}
    </Card>
  );
}

/** The log, in the Time tracking tab. */
export function TimeEntriesPanel({ tracking }: { tracking: TimeTracking }) {
  const { summary, loading, error, migrationPending, pending, percentOfEstimate } = tracking;
  return (
    <Card>
      <h2 className="text-xl leading-7 font-semibold">Time entries</h2>

      {loading ? (
        <Skeleton className="mt-4 h-24" />
      ) : migrationPending ? (
        <p className="mt-3 text-sm text-[var(--av2-text-2)]">
          Time tracking isn&apos;t available on this environment yet. Ask an admin to run the
          pending database migration.
        </p>
      ) : error ? (
        <div className="mt-4">
          <Callout tone="error" title="We couldn't load your time entries">
            {error}
          </Callout>
        </div>
      ) : summary ? (
        <>
          {percentOfEstimate !== null ? (
            <div className="mt-4">
              <div
                role="progressbar"
                aria-label="Time logged against the estimate"
                aria-valuenow={Math.min(100, percentOfEstimate)}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-2 w-full overflow-hidden rounded-full bg-[var(--av2-track)]"
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, percentOfEstimate)}%`,
                    background:
                      percentOfEstimate > 100
                        ? "var(--av2-fill-red)"
                        : percentOfEstimate > 80
                          ? "var(--av2-fill-amber)"
                          : "var(--av2-accent)",
                  }}
                />
              </div>
              <p className="mt-1 text-xs text-[var(--av2-text-2)]">
                {percentOfEstimate}% of estimate
              </p>
            </div>
          ) : null}

          {summary.entries.length === 0 ? (
            <EmptyState
              title="No time logged yet"
              description="Use Start timer above to begin tracking this job."
            />
          ) : (
            <ul className="mt-3 divide-y divide-[var(--av2-border)]">
              {summary.entries.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold tabular-nums">
                      {clock(entry.running ? tracking.runningSeconds : entry.durationSeconds)}
                      {entry.running ? " · Running" : ""}
                    </p>
                    <p className="text-xs text-[var(--av2-text-2)]">
                      {timeOfDay(entry.startedAt)}
                      {entry.endedAt ? ` to ${timeOfDay(entry.endedAt)}` : ""}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => tracking.remove(entry.id)}
                    disabled={pending === `delete:${entry.id}`}
                  >
                    Delete
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </Card>
  );
}
