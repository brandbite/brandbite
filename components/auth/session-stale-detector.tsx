// -----------------------------------------------------------------------------
// @file: components/auth/session-stale-detector.tsx
// @purpose: Detect when the BetterAuth session cookie has been overwritten by
//           a sign-in/sign-out in another tab, and surface a persistent toast
//           prompting the user to reload before they get confused by stale UI.
//
//           Why this exists: BetterAuth (and any cookie-based auth) scopes
//           the session to the *browser*, not the tab. If a user is signed in
//           as Admin in tab A and then signs in as Customer in tab B, the
//           cookie in tab A is silently replaced. Tab A's HTML still shows
//           "Admin" in the header, but the next click on an admin-only route
//           sends the customer cookie and gets a 403. The 403 is the system
//           working correctly — but the stale header is a "wait, what?"
//           moment.
//
//           Strategy: on mount, snapshot the current user id from /api/session.
//           When the tab regains focus (visibilitychange → "visible"),
//           re-fetch and compare. If the id changed, fire a persistent
//           warning toast asking the user to refresh. Auto-reload would
//           destroy any in-progress form work, so we leave the choice to
//           the user.
//
//           No-ops in demo mode (the persona cookie is not a real session
//           and is intentionally swappable across tabs without a warning).
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useRef } from "react";

import { useToast } from "@/components/ui/toast-provider";

type SessionResponse = {
  user?: { id?: string | null } | null;
};

export function SessionStaleDetector() {
  const { showToast } = useToast();

  // Baseline = the user id observed when this component first mounted.
  // `undefined` until the first /api/session response lands; `null` means
  // signed out.
  const baselineUserIdRef = useRef<string | null | undefined>(undefined);

  // Once we've shown the toast, don't keep re-checking. Re-firing on every
  // visibility flip would spam the user with duplicate toasts and the
  // intent is already conveyed.
  const warnedRef = useRef(false);

  useEffect(() => {
    // Demo mode swaps personas via a separate cookie that is meant to be
    // changed across tabs without ceremony. Skip entirely.
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") return;

    let cancelled = false;

    /** Returns the current user id, or undefined on network/auth failure
     *  (the existing AuthGuard handles 401 by redirecting to /login, so
     *  we don't need to). */
    async function readSessionUserId(): Promise<string | null | undefined> {
      try {
        const res = await fetch("/api/session", { cache: "no-store" });
        if (!res.ok) return undefined;
        const data = (await res.json()) as SessionResponse;
        return data.user?.id ?? null;
      } catch {
        return undefined;
      }
    }

    // Establish the baseline immediately. We don't gate the
    // visibility-change handler on this — if the user flips tabs before
    // the baseline lands, the handler will simply set the baseline on its
    // first run instead.
    void (async () => {
      const id = await readSessionUserId();
      if (cancelled) return;
      if (id !== undefined) baselineUserIdRef.current = id;
    })();

    const onVisibilityChange = async () => {
      if (document.visibilityState !== "visible") return;
      if (warnedRef.current) return;

      const currentId = await readSessionUserId();
      if (cancelled) return;
      if (currentId === undefined) return; // network blip / 401 handled elsewhere

      // First observation — store as baseline and bail.
      if (baselineUserIdRef.current === undefined) {
        baselineUserIdRef.current = currentId;
        return;
      }

      if (currentId !== baselineUserIdRef.current) {
        warnedRef.current = true;
        showToast({
          type: "warning",
          title: "Signed-in account changed",
          description:
            "You signed in as a different user in another tab. Refresh this page to continue with the current account — otherwise admin actions on this tab will fail.",
          // 0 = persistent. The user can dismiss with the × or refresh
          // the page; we do not auto-reload because that would destroy
          // any in-progress form work.
          durationMs: 0,
        });
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [showToast]);

  return null;
}
