// -----------------------------------------------------------------------------
// @file: lib/hooks/use-idempotency-key.ts
// @purpose: Hook that owns a UUID used as the `Idempotency-Key` header for
//           AI submit requests. The key is stable across retries of the
//           same user action; the caller rotates it only after the request
//           succeeds, so a network-flake retry re-uses the key and the
//           backend returns the already-created generation instead of
//           debiting tokens a second time.
// -----------------------------------------------------------------------------

"use client";

import { useState, useCallback } from "react";

export function useIdempotencyKey(): {
  key: string;
  rotate: () => void;
} {
  const [key, setKey] = useState<string>(() => crypto.randomUUID());
  const rotate = useCallback(() => {
    setKey(crypto.randomUUID());
  }, []);
  return { key, rotate };
}
