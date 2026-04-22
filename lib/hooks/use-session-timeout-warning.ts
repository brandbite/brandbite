// -----------------------------------------------------------------------------
// @file: lib/hooks/use-session-timeout-warning.ts
// @purpose: WCAG 2.2.1 ("Timing Adjustable") — warn the user shortly before
//           their BetterAuth session expires and let them extend it with one
//           click. Without this, a user mid-edit could be silently logged
//           out and lose work.
//
//           Flow:
//             1. On mount, fetch /api/session → read session.expiresAt.
//             2. Schedule a timer for (expiresAt - WARNING_MS).
//             3. When the timer fires, setStatus("warning"). The UI renders
//                an accessible alertdialog with a countdown + "Stay signed
//                in" button.
//             4. "Stay signed in" re-fetches /api/session, which on
//                BetterAuth extends the session if within `updateAge` (1 day
//                by default, so a warning 2 min out is always inside that
//                window). New expiresAt is read and the cycle repeats.
//             5. If expiresAt passes without refresh, setStatus("expired")
//                and redirect to /login?expired=1.
//
//           Demo mode: /api/session returns expiresAt=null → hook no-ops.
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useRef, useState } from "react";

// How long before expiry to surface the warning. Balances WCAG 2.2.1's
// 20-second floor against not interrupting active users too aggressively.
// 2 minutes is the conventional choice (Google Workspace, GitHub, etc.).
const WARNING_MS = 2 * 60 * 1000;

// Minimum meaningful warning. If the session already expires in less than
// this, skip the "warning" state and expire straight away. Avoids a jarring
// modal appearing with "0 seconds left".
const MIN_WARNING_MS = 5 * 1000;

export type SessionTimeoutStatus = "idle" | "warning" | "extending" | "expired";

export type UseSessionTimeoutWarningResult = {
  /** Current phase. UI renders differently for each. */
  status: SessionTimeoutStatus;
  /** Seconds remaining until hard expiry. Only meaningful when status="warning". */
  secondsRemaining: number;
  /** Extend the session by re-calling /api/session. Returns true on success. */
  extend: () => Promise<boolean>;
  /** Dismiss the warning without extending — closes UI, session will expire naturally. */
  dismiss: () => void;
};

type SessionResponse = {
  ok?: boolean;
  session?: { expiresAt?: string | null };
};

async function fetchExpiresAt(): Promise<Date | null> {
  try {
    const res = await fetch("/api/session", { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as SessionResponse;
    const iso = json.session?.expiresAt;
    if (!iso) return null;
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

export function useSessionTimeoutWarning(): UseSessionTimeoutWarningResult {
  const [status, setStatus] = useState<SessionTimeoutStatus>("idle");
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expiredTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expiresAtRef = useRef<Date | null>(null);

  // ---------------------------------------------------------------------
  // Clean up every timer. Called before scheduling a new cycle and on
  // unmount. Safe to call repeatedly.
  // ---------------------------------------------------------------------
  const clearTimers = () => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (expiredTimerRef.current) clearTimeout(expiredTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    warningTimerRef.current = null;
    expiredTimerRef.current = null;
    countdownTimerRef.current = null;
  };

  // ---------------------------------------------------------------------
  // Redirect to /login when the session has actually expired. Using a full
  // reload drops any stale in-memory state; server-side the session is
  // already invalid.
  // ---------------------------------------------------------------------
  const handleExpired = () => {
    clearTimers();
    setStatus("expired");
    if (typeof window !== "undefined") {
      window.location.href = "/login?expired=1";
    }
  };

  // ---------------------------------------------------------------------
  // Main scheduler: given an expiry time, arm the warning + expiry timers
  // and start the countdown interval once the warning is visible.
  // ---------------------------------------------------------------------
  const scheduleForExpiry = (expiresAt: Date) => {
    clearTimers();
    expiresAtRef.current = expiresAt;

    const now = Date.now();
    const msUntilExpiry = expiresAt.getTime() - now;

    // Session already expired or about to: jump straight to expired.
    if (msUntilExpiry <= MIN_WARNING_MS) {
      handleExpired();
      return;
    }

    const msUntilWarning = Math.max(0, msUntilExpiry - WARNING_MS);

    // If the session is so far from expiry that the warning would be
    // scheduled beyond setTimeout's safe range (~24.8 days), clamp.
    // Practically, BetterAuth's 7-day sessions are well within range, but
    // guard for safety.
    const safeMsUntilWarning = Math.min(msUntilWarning, 2_000_000_000);

    warningTimerRef.current = setTimeout(() => {
      setStatus("warning");
      setSecondsRemaining(Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)));

      // Tick once per second while the warning is visible.
      countdownTimerRef.current = setInterval(() => {
        const remaining = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
        setSecondsRemaining(remaining);
        if (remaining <= 0) {
          handleExpired();
        }
      }, 1000);
    }, safeMsUntilWarning);

    // Belt-and-suspenders: even if the countdown interval misses its last
    // tick (background tab), force expiry at the real time.
    expiredTimerRef.current = setTimeout(handleExpired, Math.max(0, msUntilExpiry));
  };

  // ---------------------------------------------------------------------
  // Extend the session by re-fetching /api/session. BetterAuth auto-
  // refreshes the session when it is inside `updateAge` (1 day by
  // default). Because the warning fires 2 minutes out, we're always
  // inside that window.
  // ---------------------------------------------------------------------
  const extend = async (): Promise<boolean> => {
    setStatus("extending");
    const next = await fetchExpiresAt();
    if (!next) {
      // Couldn't refresh — likely the session already died. Treat as
      // expired rather than leaving the user in a broken state.
      handleExpired();
      return false;
    }
    scheduleForExpiry(next);
    setStatus("idle");
    return true;
  };

  // ---------------------------------------------------------------------
  // Dismiss = close the modal but do not extend. The session will expire
  // naturally; the hard-expiry timer still fires and redirects to /login.
  // ---------------------------------------------------------------------
  const dismiss = () => {
    setStatus("idle");
  };

  // ---------------------------------------------------------------------
  // On mount, fetch the initial expiry and schedule. If expiresAt is
  // null (demo mode or unauthenticated), the hook stays in "idle"
  // forever — safe no-op.
  // ---------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const expiresAt = await fetchExpiresAt();
      if (cancelled) return;
      if (!expiresAt) {
        // Demo mode / unauth / fetch failure → never arm the timer.
        return;
      }
      scheduleForExpiry(expiresAt);
    })();

    return () => {
      cancelled = true;
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { status, secondsRemaining, extend, dismiss };
}
