// -----------------------------------------------------------------------------
// @file: app/admin/error.tsx
// @purpose: Error boundary for admin pages (nav provided by layout)
// -----------------------------------------------------------------------------

"use client";

import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin] Unhandled error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-red-200 bg-white px-6 py-8 text-center shadow-sm">
      <h2 className="text-lg font-semibold text-[#424143]">
        Something went wrong
      </h2>
      <p className="mt-2 text-sm text-[#7a7a7a]">
        An error occurred while loading this admin page.
      </p>
      <div className="mt-4 flex items-center justify-center gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center justify-center rounded-full bg-[#f15b2b] px-5 py-2 text-sm font-semibold text-white shadow-sm"
        >
          Try again
        </button>
        <button
          onClick={() => (window.location.href = "/admin/board")}
          className="inline-flex items-center justify-center rounded-full border border-[#e3e1dc] bg-white px-5 py-2 text-sm font-medium text-[#424143]"
        >
          Go to Board
        </button>
      </div>
    </div>
  );
}
