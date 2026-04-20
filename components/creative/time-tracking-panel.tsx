// -----------------------------------------------------------------------------
// @file: components/creative/time-tracking-panel.tsx
// @purpose: Self-contained time-tracking widget for the creative ticket
//           detail page. Shows the currently running entry (if any),
//           provides Start / Stop controls, and lists prior entries with
//           delete. All state is fetched from
//           /api/creative/tickets/[ticketId]/time-entries.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-04-20
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";

type TimeEntry = {
  id: string;
  ticketId: string;
  creativeId: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  running: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type Summary = {
  entries: TimeEntry[];
  runningEntry: TimeEntry | null;
  totalLoggedSeconds: number;
};

// ---------------------------------------------------------------------------
// Duration formatting helpers
// ---------------------------------------------------------------------------

function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) {
    return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
  }
  if (m > 0) {
    return `${m}m ${String(s).padStart(2, "0")}s`;
  }
  return `${s}s`;
}

function formatCompactDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${safe}s`;
}

function formatTimeOfDay(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TimeTrackingPanel({
  ticketId,
  estimatedHours,
}: {
  ticketId: string;
  /** Optional: jobType.estimatedHours so we can show a progress hint. */
  estimatedHours?: number | null;
}) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [migrationPending, setMigrationPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, setPending] = useState<"start" | "stop" | string | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  // ---- Load summary ----
  const load = useCallback(async () => {
    setError(null);
    setMigrationPending(false);
    try {
      const res = await fetch(`/api/creative/tickets/${ticketId}/time-entries`, {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as
        | (Summary & { code?: string })
        | { error?: string; code?: string }
        | null;
      if (!res.ok) {
        if (res.status === 503 && json && "code" in json && json.code === "MIGRATION_PENDING") {
          setMigrationPending(true);
          return;
        }
        setError((json as { error?: string } | null)?.error ?? "Failed to load time entries.");
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

  // ---- Live tick so the running timer label updates each second ----
  useEffect(() => {
    if (!summary?.runningEntry) return;
    const id = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [summary?.runningEntry]);

  // ---- Derived values ----
  const runningLiveSeconds = useMemo(() => {
    if (!summary?.runningEntry) return 0;
    const started = new Date(summary.runningEntry.startedAt).getTime();
    return Math.max(0, Math.floor((nowTick - started) / 1000));
  }, [summary?.runningEntry, nowTick]);

  const totalLoggedSeconds = summary?.totalLoggedSeconds ?? 0;
  const combinedSeconds = totalLoggedSeconds + runningLiveSeconds;

  const estimatedSeconds =
    typeof estimatedHours === "number" && estimatedHours > 0 ? estimatedHours * 3600 : null;
  const percentOfEstimate =
    estimatedSeconds && estimatedSeconds > 0
      ? Math.round((combinedSeconds / estimatedSeconds) * 100)
      : null;

  // ---- Actions ----
  const start = async () => {
    setActionError(null);
    setPending("start");
    try {
      const res = await fetch(`/api/creative/tickets/${ticketId}/time-entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setActionError((json as { error?: string } | null)?.error ?? "Failed to start timer.");
        return;
      }
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to start timer.");
    } finally {
      setPending(null);
    }
  };

  const stop = async (entryId: string) => {
    setActionError(null);
    setPending(`stop:${entryId}`);
    try {
      const res = await fetch(`/api/creative/tickets/${ticketId}/time-entries/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setActionError((json as { error?: string } | null)?.error ?? "Failed to stop timer.");
        return;
      }
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to stop timer.");
    } finally {
      setPending(null);
    }
  };

  const remove = async (entryId: string) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm("Delete this time entry? This can't be undone.")
    ) {
      return;
    }
    setActionError(null);
    setPending(`delete:${entryId}`);
    try {
      const res = await fetch(`/api/creative/tickets/${ticketId}/time-entries/${entryId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setActionError((json as { error?: string } | null)?.error ?? "Failed to delete entry.");
        return;
      }
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete entry.");
    } finally {
      setPending(null);
    }
  };

  // ---- Render ----
  return (
    <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-4 py-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--bb-secondary)]">Time tracking</h2>
        <span className="text-[11px] font-semibold tracking-wide text-[var(--bb-text-tertiary)]">
          {formatCompactDuration(combinedSeconds)} logged
          {estimatedSeconds && ` / ${estimatedHours}h est`}
        </span>
      </div>

      {loading && <p className="mt-2 text-xs text-[var(--bb-text-tertiary)]">Loading entries…</p>}

      {!loading && migrationPending && (
        <p className="mt-2 text-xs text-[var(--bb-text-tertiary)]">
          Time tracking isn&apos;t available on this environment yet — ask an admin to run the
          pending database migration.
        </p>
      )}

      {!loading && !migrationPending && error && (
        <InlineAlert variant="error" size="sm" className="mt-2">
          {error}
        </InlineAlert>
      )}

      {!loading && !error && !migrationPending && summary && (
        <>
          {/* Progress bar vs estimate */}
          {percentOfEstimate !== null && (
            <div className="mt-2">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bb-bg-warm)]">
                <div
                  className={`h-full rounded-full transition-all ${
                    percentOfEstimate > 100
                      ? "bg-[var(--bb-danger)]"
                      : percentOfEstimate > 80
                        ? "bg-[var(--bb-warning)]"
                        : "bg-[var(--bb-primary)]"
                  }`}
                  style={{ width: `${Math.min(100, percentOfEstimate)}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] font-semibold tracking-wide text-[var(--bb-text-tertiary)]">
                {percentOfEstimate}% of estimate
              </p>
            </div>
          )}

          {/* Start/Stop row */}
          <div className="mt-3 flex items-center gap-3">
            {summary.runningEntry ? (
              <>
                <div className="flex-1 rounded-xl border border-[var(--bb-primary)]/30 bg-[var(--bb-primary)]/[0.06] px-3 py-2">
                  <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-[var(--bb-text-tertiary)]">
                    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--bb-primary)]" />
                    Running since {formatTimeOfDay(summary.runningEntry.startedAt)}
                  </div>
                  <p className="mt-0.5 font-mono text-base font-semibold text-[var(--bb-secondary)]">
                    {formatDuration(runningLiveSeconds)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={pending === `stop:${summary.runningEntry.id}`}
                  loadingText="Stopping…"
                  onClick={() => stop(summary.runningEntry!.id)}
                >
                  Stop
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                loading={pending === "start"}
                loadingText="Starting…"
                onClick={start}
              >
                Start timer
              </Button>
            )}
          </div>

          {actionError && (
            <InlineAlert variant="error" size="sm" className="mt-2">
              {actionError}
            </InlineAlert>
          )}

          {/* Entry log */}
          {summary.entries.length === 0 ? (
            <p className="mt-3 text-xs text-[var(--bb-text-tertiary)]">
              No time logged yet. Press Start to begin tracking.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--bb-border)] text-xs">
              {summary.entries.map((entry) => {
                const live = entry.running ? runningLiveSeconds : entry.durationSeconds;
                return (
                  <li key={entry.id} className="flex items-center justify-between gap-2 py-1.5">
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] font-semibold text-[var(--bb-secondary)]">
                        {formatDuration(live)}
                        {entry.running && (
                          <span className="ml-2 rounded-full bg-[var(--bb-primary)] px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-white uppercase">
                            Running
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] text-[var(--bb-text-tertiary)]">
                        {formatTimeOfDay(entry.startedAt)}
                        {entry.endedAt && ` → ${formatTimeOfDay(entry.endedAt)}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(entry.id)}
                      disabled={pending === `delete:${entry.id}`}
                      className="shrink-0 rounded-full border border-transparent px-2 py-1 text-[10px] font-semibold text-[var(--bb-text-tertiary)] transition-colors hover:border-[var(--bb-border)] hover:bg-[var(--bb-bg-warm)] hover:text-[var(--bb-danger)] disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
