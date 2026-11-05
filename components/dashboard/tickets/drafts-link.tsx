// -----------------------------------------------------------------------------
// @file: components/dashboard/tickets/drafts-link.tsx
// @purpose: "Drafts (2)" beside New request. Shows nothing when there are none.
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useState } from "react";

import { ButtonLink } from "@/components/admin/v2/ui";

export function DraftsLink({ refreshKey = 0 }: { refreshKey?: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/customer/ticket-drafts", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled && Array.isArray(json?.drafts)) setCount(json.drafts.length);
      } catch {
        // A count that can't load shouldn't get in the way of the page.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (count === 0) return null;

  return <ButtonLink href="/customer/tickets/drafts">Drafts ({count})</ButtonLink>;
}
