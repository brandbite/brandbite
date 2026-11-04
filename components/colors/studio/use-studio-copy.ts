// -----------------------------------------------------------------------------
// @file: components/colors/studio/use-studio-copy.ts
// @purpose: Copy with Color Studio's feedback rules: a 3-second announced toast
//           on success, and on failure a persistent panel (see CopyFallback) so
//           the text can still be copied by hand.
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useSyncExternalStore } from "react";

import { useClipboard } from "@/components/hooks/use-clipboard";
import { useToast } from "@/components/ui/toast-provider";

const COPIED_MS = 3000;

let failedText: string | null = null;
const listeners = new Set<() => void>();

function setFailedText(next: string | null): void {
  if (next === failedText) return;
  failedText = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The text that could not be copied, for CopyFallback to display. */
export function useCopyFailure(): { text: string | null; dismiss: () => void } {
  const text = useSyncExternalStore(
    subscribe,
    () => failedText,
    () => null,
  );
  return { text, dismiss: () => setFailedText(null) };
}

export function useStudioCopy(): {
  copy: (text: string, key?: string, label?: string) => Promise<boolean>;
  isCopied: (key: string) => boolean;
} {
  const { copy: writeToClipboard, isCopied } = useClipboard(COPIED_MS);
  const { showToast } = useToast();

  const copy = useCallback(
    async (text: string, key?: string, label?: string) => {
      const ok = await writeToClipboard(text, key);
      if (ok) {
        setFailedText(null);
        showToast({ type: "success", title: `Copied ${label ?? text}`, durationMs: COPIED_MS });
      } else {
        setFailedText(text);
      }
      return ok;
    },
    [writeToClipboard, showToast],
  );

  return { copy, isCopied };
}
