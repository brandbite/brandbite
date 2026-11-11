// -----------------------------------------------------------------------------
// @file: lib/hooks/use-engagement-switches.ts
// @purpose: Client read of the owner's engagement switches. Everything is off
//           until the answer arrives, so a switched-off feature never flashes.
//           One request per page load, shared by every component that asks.
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useState } from "react";

import { ALL_ENGAGEMENT_OFF, type EngagementSwitches } from "@/lib/engagement/switches";

let pending: Promise<EngagementSwitches> | null = null;

function load(): Promise<EngagementSwitches> {
  pending ??= fetch("/api/engagement/switches")
    .then((res) => (res.ok ? res.json() : null))
    .then((json) => ({ ...ALL_ENGAGEMENT_OFF, ...(json?.switches ?? {}) }))
    .catch(() => ({ ...ALL_ENGAGEMENT_OFF }));
  return pending;
}

/** For tests: forget the cached answer. */
export function resetEngagementSwitchesCache() {
  pending = null;
}

export function useEngagementSwitches(): EngagementSwitches {
  const [switches, setSwitches] = useState<EngagementSwitches>(ALL_ENGAGEMENT_OFF);
  useEffect(() => {
    let live = true;
    void load().then((s) => {
      if (live) setSwitches(s);
    });
    return () => {
      live = false;
    };
  }, []);
  return switches;
}
