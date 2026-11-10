// -----------------------------------------------------------------------------
// @file: components/tickets/source-files-retention-note.tsx
// @purpose: In the "Approve and complete" dialogs: when the request has source
//           files on brandbite storage, say they'll be deleted 90 days after
//           approval, with the date, and how to keep them. Shows nothing when
//           there are none (or they're all in the customer's Drive).
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Callout } from "@/components/admin/v2/ui";

const RETENTION_DAYS = 90;

export function SourceFilesRetentionNote({ ticketId }: { ticketId: string }) {
  const [count, setCount] = useState(0);
  const [until, setUntil] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/tickets/${ticketId}/source-files`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled || !json?.files) return;
        setCount(json.files.filter((f: { storage: string }) => f.storage === "R2").length);
        setUntil(
          new Date(Date.now() + RETENTION_DAYS * 24 * 60 * 60 * 1000).toLocaleDateString(
            undefined,
            { day: "numeric", month: "short", year: "numeric" },
          ),
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [ticketId]);

  if (count === 0) return null;
  return (
    <div className="mt-3">
      <Callout tone="warning" title="Download your source files">
        {count === 1 ? "1 source file is" : `${count} source files are`} kept on brandbite until{" "}
        {until}, then deleted. Download {count === 1 ? "it" : "them"} from the request, or{" "}
        <Link href="/customer/settings?tab=integrations" className="font-medium underline">
          connect Google Drive
        </Link>{" "}
        so future files land in your own Drive.
      </Callout>
    </div>
  );
}
