// -----------------------------------------------------------------------------
// @file: app/error.tsx
// @purpose: Root-level error boundary for unhandled errors
// -----------------------------------------------------------------------------

"use client";

import { useEffect } from "react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f3f0]">
      <div className="mx-auto max-w-md rounded-2xl border border-red-200 bg-white px-6 py-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
          !
        </div>
        <h2 className="text-lg font-semibold text-[#424143]">
          Something went wrong
        </h2>
        <p className="mt-2 text-sm text-[#7a7a7a]">
          An unexpected error occurred. Please try again.
        </p>
        <button
          onClick={reset}
          className="mt-4 inline-flex items-center justify-center rounded-full bg-[#f15b2b] px-5 py-2 text-sm font-semibold text-white shadow-sm"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
