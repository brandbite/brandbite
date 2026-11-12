// -----------------------------------------------------------------------------
// @file: components/engagement/live-progress-card.tsx
// @purpose: "Live progress" on the customer's request page and in the Board's
//           request window: a four-step
//           tracker (Queued → In progress → In review → Done) and, while the
//           creative's timer is on, a "Timer running" pill with a clock that
//           counts up from the start of this sitting.
//
//           Loads and refreshes itself (every 30s while the tab is visible),
//           and renders nothing while the owner's switch is off, so the page
//           only has to place it. Tells the page when the status has moved
//           on so it can reload.
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Card } from "@/components/admin/v2/ui";
import { useLiveRefresh } from "@/lib/hooks/use-live-refresh";

type Status = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" | "CANCELED";

type Progress = {
  enabled: boolean;
  status?: Status;
  isAssigned?: boolean;
  timerStartedAt?: string | null;
};

const STEPS: { status: Status; label: string }[] = [
  { status: "TODO", label: "Queued" },
  { status: "IN_PROGRESS", label: "In progress" },
  { status: "IN_REVIEW", label: "In review" },
  { status: "DONE", label: "Done" },
];

/** What the line under the tracker says. */
export function progressMessage(
  status: Status,
  isAssigned: boolean,
  timerRunning: boolean,
): string {
  switch (status) {
    case "TODO":
      return isAssigned
        ? "A creative has this request. Work starts soon."
        : "In the queue, waiting for a creative to pick it up.";
    case "IN_PROGRESS":
      return timerRunning
        ? "Your creative is working on this request now."
        : "Your creative has started on this request.";
    case "IN_REVIEW":
      return "Your creative has delivered. It's your turn to review.";
    case "DONE":
      return "Approved and done.";
    default:
      return "";
  }
}

/** 3725 → "01:02:05". */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

export function LiveProgressCard({
  ticketId,
  status: pageStatus,
  onStatusChange,
}: {
  ticketId: string;
  /** The status the page is showing, so the card can tell when it is stale. */
  status: string;
  onStatusChange?: () => void;
}) {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const onStatusChangeRef = useRef(onStatusChange);
  const pageStatusRef = useRef(pageStatus);
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
    pageStatusRef.current = pageStatus;
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/customer/tickets/${ticketId}/live-progress`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const json = (await res.json()) as Progress;
      setProgress(json);
      setNow(Date.now());
      if (json.enabled && json.status && json.status !== pageStatusRef.current) {
        onStatusChangeRef.current?.();
      }
    } catch {
      // Keep what's on screen; the next refresh tries again.
    }
  }, [ticketId]);

  // Also reloads when the page itself moves the status (approve, request changes).
  useEffect(() => {
    void load();
  }, [load, pageStatus]);
  useLiveRefresh(load, { paused: pageStatus === "DONE" || pageStatus === "CANCELED" });

  const timerStartedAt = progress?.timerStartedAt ?? null;
  useEffect(() => {
    if (!timerStartedAt) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [timerStartedAt]);

  if (!progress?.enabled || !progress.status || progress.status === "CANCELED") return null;

  const status = progress.status;
  const current = STEPS.findIndex((s) => s.status === status);
  const timerRunning = timerStartedAt != null;
  const elapsed = timerRunning ? (now - new Date(timerStartedAt).getTime()) / 1000 : 0;

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl leading-7 font-semibold">Live progress</h2>
        {timerRunning && (
          <span className="inline-flex items-center gap-2 rounded-full bg-[var(--av2-success-bg)] px-3 py-1 text-sm font-medium text-[#256b3a] dark:text-[#7fd396]">
            <span className="relative flex h-2.5 w-2.5" aria-hidden>
              <span className="absolute inline-flex h-full w-full rounded-full bg-[#2f7a45] opacity-60 motion-safe:animate-ping" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#2f7a45]" />
            </span>
            Timer running
          </span>
        )}
      </div>

      <ol className="mt-6 flex items-start" aria-label="Request steps">
        {STEPS.map((step, i) => {
          const done = i < current || status === "DONE";
          const active = i === current && status !== "DONE";
          return (
            <li
              key={step.status}
              aria-current={active ? "step" : undefined}
              className="relative flex min-w-0 flex-1 flex-col items-center"
            >
              {i > 0 && (
                <span
                  aria-hidden
                  className={`absolute top-[13px] right-1/2 left-[-50%] mx-5 h-0.5 rounded-full ${
                    i <= current ? "bg-[#4b3fb0] dark:bg-[#8f80e8]" : "bg-[var(--av2-border)]"
                  }`}
                />
              )}
              <span className="relative z-10 flex h-7 w-7 items-center justify-center">
                {done ? (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2f7a45] text-white">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path
                        d="M5 12.5 10 17 19 7.5"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                ) : active ? (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[var(--av2-fill-lavender)] bg-[var(--av2-lavender-bg)]">
                    <span className="h-3 w-3 rounded-full bg-[#4b3fb0] dark:bg-[#c3b9fa]" />
                  </span>
                ) : (
                  <span className="h-7 w-7 rounded-full border-2 border-[var(--av2-text-2)]/50 bg-[var(--av2-surface)]" />
                )}
              </span>
              <span
                className={`mt-2 max-w-full truncate rounded-full px-3 py-0.5 text-center text-base max-[479px]:px-1 max-[479px]:text-sm ${
                  active
                    ? "bg-[var(--av2-lavender-bg)] font-medium text-[#4b3fb0] dark:text-[#c3b9fa]"
                    : done
                      ? "font-medium"
                      : "text-[var(--av2-text-2)]"
                }`}
              >
                {step.label}
                <span className="sr-only">
                  {done ? " (done)" : active ? " (current step)" : " (not started)"}
                </span>
              </span>
            </li>
          );
        })}
      </ol>

      <p className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-base text-[var(--av2-text-2)]">
        <span aria-live="polite">
          {progressMessage(status, !!progress.isAssigned, timerRunning)}
        </span>
        {timerRunning && (
          <>
            <span aria-hidden className="h-5 w-px bg-[var(--av2-border)]" />
            <span
              className="font-mono text-base font-semibold text-[var(--av2-text)] tabular-nums"
              aria-label="Time in this sitting"
              role="timer"
            >
              {formatClock(elapsed)}
            </span>
          </>
        )}
      </p>
    </Card>
  );
}
