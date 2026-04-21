// -----------------------------------------------------------------------------
// @file: lib/hooks/use-session-role.ts
// @purpose: Client-side accessor for the current user's site role. Fetches
//           /api/session once per app instance (cached at module level) and
//           returns the same data to every caller.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-04-21
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useState } from "react";

export type SessionRoleSnapshot = {
  /** Null until loaded; set to the role string on first /api/session response. */
  role: "SITE_OWNER" | "SITE_ADMIN" | "DESIGNER" | "CUSTOMER" | null;
  /** True only for SITE_OWNER. Matches lib/roles.ts isSiteOwnerRole(). */
  isSiteOwner: boolean;
  /** True for SITE_OWNER or SITE_ADMIN. Matches lib/roles.ts isSiteAdminRole(). */
  isSiteAdmin: boolean;
  /** True while the initial fetch is in flight. */
  loading: boolean;
};

// Module-level cache so repeated hook calls don't spam /api/session.
let cached: { role: SessionRoleSnapshot["role"] } | null = null;
let inFlight: Promise<void> | null = null;
const subscribers = new Set<(role: SessionRoleSnapshot["role"]) => void>();

function notify(role: SessionRoleSnapshot["role"]) {
  for (const fn of subscribers) fn(role);
}

async function loadOnce(): Promise<void> {
  if (cached) return;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const res = await fetch("/api/session", { cache: "no-store" });
      if (!res.ok) {
        cached = { role: null };
        notify(null);
        return;
      }
      const json = (await res.json()) as { user?: { role?: string } | null };
      const role = (json.user?.role as SessionRoleSnapshot["role"]) ?? null;
      cached = { role };
      notify(role);
    } catch {
      cached = { role: null };
      notify(null);
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/**
 * Read the current user's site role with derived booleans.
 *
 * Usage:
 *   const { isSiteOwner, loading } = useSessionRole();
 *   if (loading) return null;
 *   if (!isSiteOwner) return <OwnerOnlyBanner />;
 */
export function useSessionRole(): SessionRoleSnapshot {
  const [role, setRole] = useState<SessionRoleSnapshot["role"]>(cached?.role ?? null);
  const [loading, setLoading] = useState(cached === null);

  useEffect(() => {
    let cancelled = false;

    const handle = (r: SessionRoleSnapshot["role"]) => {
      if (cancelled) return;
      setRole(r);
      setLoading(false);
    };
    subscribers.add(handle);

    loadOnce().finally(() => {
      if (cancelled) return;
      setLoading(false);
    });

    return () => {
      cancelled = true;
      subscribers.delete(handle);
    };
  }, []);

  return {
    role,
    isSiteOwner: role === "SITE_OWNER",
    isSiteAdmin: role === "SITE_OWNER" || role === "SITE_ADMIN",
    loading,
  };
}
