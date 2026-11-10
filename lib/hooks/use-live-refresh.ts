// -----------------------------------------------------------------------------
// @file: lib/hooks/use-live-refresh.ts
// @purpose: Keep a screen current without a manual reload. Calls `refresh`
//           when the person comes back to the tab or window, and every
//           `intervalMs` while the tab is visible. A hidden tab makes no
//           requests at all, which keeps serverless CPU use low. Pass
//           `paused` while someone is mid-interaction (dragging a card,
//           editing in a dialog) so their screen doesn't change under them.
//
//           `refresh` should update data quietly: no loading skeleton, no
//           error toast. A failed background refresh just keeps the old data.
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useRef } from "react";

/** Coming back to a tab more often than this doesn't trigger another refresh. */
const MIN_GAP_MS = 5_000;

export function useLiveRefresh(
  refresh: () => unknown,
  { intervalMs = 30_000, paused = false }: { intervalMs?: number; paused?: boolean } = {},
) {
  const refreshRef = useRef(refresh);
  const pausedRef = useRef(paused);
  const lastRunRef = useRef(Date.now());
  const runningRef = useRef(false);

  useEffect(() => {
    refreshRef.current = refresh;
    pausedRef.current = paused;
  });

  useEffect(() => {
    const run = async (force: boolean) => {
      if (pausedRef.current || runningRef.current) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      if (!force && Date.now() - lastRunRef.current < MIN_GAP_MS) return;
      runningRef.current = true;
      lastRunRef.current = Date.now();
      try {
        await refreshRef.current();
      } catch {
        // Background refresh: keep what's on screen.
      } finally {
        runningRef.current = false;
      }
    };

    const onReturn = () => void run(false);
    const timer = window.setInterval(() => void run(true), intervalMs);
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
    };
  }, [intervalMs]);
}
