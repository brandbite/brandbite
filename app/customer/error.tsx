// -----------------------------------------------------------------------------
// @file: app/customer/error.tsx
// @purpose: Error boundary for customer pages (nav provided by layout)
// -----------------------------------------------------------------------------

"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function CustomerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[customer] Unhandled error:", error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-red-200 bg-[var(--bb-bg-page)] px-6 py-8 text-center shadow-sm">
      <h2 className="text-lg font-semibold text-[var(--bb-secondary)]">Something went wrong</h2>
      <p className="mt-2 text-sm text-[var(--bb-text-secondary)]">
        An error occurred while loading this page.
      </p>
      <div className="mt-4 flex items-center justify-center gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center justify-center rounded-full bg-[var(--bb-primary)] px-5 py-2 text-sm font-semibold text-white shadow-sm"
        >
          Try again
        </button>
        <button
          onClick={() => (window.location.href = "/customer/board")}
          className="inline-flex items-center justify-center rounded-full border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-2 text-sm font-medium text-[var(--bb-secondary)]"
        >
          Go to Board
        </button>
      </div>
    </div>
  );
}
