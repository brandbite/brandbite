// -----------------------------------------------------------------------------
// @file: components/colors/studio/copy-fallback.tsx
// @purpose: Shown when the browser refuses clipboard access. Stays until
//           dismissed and offers the text selected, ready to copy by hand.
// -----------------------------------------------------------------------------

"use client";

import { CloseIcon } from "./icons";
import { useCopyFailure } from "./use-studio-copy";

export function CopyFallback() {
  const { text, dismiss } = useCopyFailure();
  if (text === null) return null;

  return (
    <div
      role="alert"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-[560px] rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4 shadow-lg"
    >
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm leading-5 font-medium">
          Your browser blocked copying. Select the text below and copy it manually.
        </p>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={dismiss}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] text-[var(--cs-muted)] hover:text-[var(--cs-text)]"
        >
          <CloseIcon />
        </button>
      </div>
      <textarea
        aria-label="Text to copy"
        readOnly
        rows={Math.min(6, text.split("\n").length)}
        value={text}
        onFocus={(e) => e.currentTarget.select()}
        className="mt-2 w-full resize-none rounded-[10px] border border-[var(--cs-border)] p-3 font-mono text-sm leading-5"
      />
    </div>
  );
}
