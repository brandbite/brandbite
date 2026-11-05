"use client";

// -----------------------------------------------------------------------------
// @file: components/moodboard/use-is-phone.ts
// @purpose: Whether the moodboard should use its full-screen phone layout.
// -----------------------------------------------------------------------------

import { useSyncExternalStore } from "react";

const QUERY = "(max-width: 767px)";

function subscribe(listener: () => void) {
  const query = window.matchMedia?.(QUERY);
  query?.addEventListener("change", listener);
  return () => query?.removeEventListener("change", listener);
}

export function useIsPhone(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia?.(QUERY).matches ?? false,
    () => false,
  );
}
