// -----------------------------------------------------------------------------
// @file: components/hooks/use-clipboard.ts
// @purpose: Shared copy-to-clipboard hook. Replaces the copy/setTimeout pattern
//           that was previously inlined per-page. Tracks the last-copied key so
//           callers can show transient "Copied!" state on the right element.
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useClipboard(resetMs = 1500): {
  copied: string | null;
  copy: (text: string, key?: string) => Promise<boolean>;
  isCopied: (key: string) => boolean;
} {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const copy = useCallback(
    async (text: string, key?: string): Promise<boolean> => {
      try {
        if (typeof navigator === "undefined" || !navigator.clipboard) return false;
        await navigator.clipboard.writeText(text);
        setCopied(key ?? text);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(null), resetMs);
        return true;
      } catch {
        return false;
      }
    },
    [resetMs],
  );

  const isCopied = useCallback((key: string) => copied === key, [copied]);

  return { copied, copy, isCopied };
}
