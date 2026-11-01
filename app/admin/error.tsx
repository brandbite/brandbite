// -----------------------------------------------------------------------------
// @file: app/admin/error.tsx
// @purpose: Error boundary for admin pages (nav provided by layout). Admin
//           design language v1: error Callout inside a card, with "Try
//           again" (reset) as the primary action and a way back to the board.
// -----------------------------------------------------------------------------

"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

import { Button, Callout, Card } from "@/components/admin/v2/ui";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin] Unhandled error:", error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl pt-8">
      <Card>
        <h2 className="text-xl leading-7 font-semibold">Something went wrong</h2>
        <p className="mt-1 text-sm text-[var(--av2-text-2)]">
          An error occurred while loading this admin page.
        </p>
        <div className="mt-5">
          <Callout tone="error" title="This page couldn't be loaded">
            Try again, or head back to the board. The error has been reported.
            {error.digest && (
              <span className="mt-1 block font-mono text-xs">Reference: {error.digest}</span>
            )}
          </Callout>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={reset}>
            Try again
          </Button>
          <Button variant="secondary" onClick={() => (window.location.href = "/admin/board")}>
            Go to Board
          </Button>
        </div>
      </Card>
    </div>
  );
}
