// -----------------------------------------------------------------------------
// @file: components/dashboard/tickets/job-moodboards.tsx
// @purpose: Moodboards on a creative's job page: the customer's to look at, their
//           own to work in, and a way to start one for this job.
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Badge, Button, Card, plural } from "@/components/admin/v2/ui";

type JobMoodboard = {
  id: string;
  title: string;
  itemCount: number;
  isCreativeBoard: boolean;
  sharedWithCustomer: boolean;
};

export function JobMoodboards({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [boards, setBoards] = useState<JobMoodboard[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createFailed, setCreateFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/moodboards?ticketId=${encodeURIComponent(ticketId)}`, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (alive) setBoards(json.moodboards ?? []);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [ticketId]);

  async function createBoard() {
    setCreating(true);
    setCreateFailed(false);
    try {
      const res = await fetch("/api/moodboards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled Moodboard", ticketId }),
      });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const json = await res.json();
      router.push(`/creative/moodboards/${json.moodboard.id}`);
    } catch {
      setCreateFailed(true);
      setCreating(false);
    }
  }

  return (
    <Card>
      <h2 className="mb-4 text-xl leading-7 font-semibold">Moodboards</h2>

      {failed ? (
        <p role="alert" className="text-sm text-[var(--av2-error-text)]">
          We couldn&apos;t load this job&apos;s moodboards.
        </p>
      ) : boards === null ? (
        <p role="status" className="text-sm text-[var(--av2-text-2)]">
          Loading moodboards…
        </p>
      ) : boards.length === 0 ? (
        <p className="text-sm text-[var(--av2-text-2)]">
          No moodboards on this job yet. Start one to collect references and ideas.
        </p>
      ) : (
        <ul className="space-y-2">
          {boards.map((board) => (
            <li key={board.id}>
              <Link
                href={`/creative/moodboards/${board.id}`}
                className="flex min-h-10 items-center justify-between gap-3 rounded-lg border border-[var(--av2-border)] px-3 py-2 text-sm hover:bg-[var(--av2-bg)] focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{board.title}</span>
                  <span className="text-xs text-[var(--av2-text-2)]">
                    {board.itemCount} {plural(board.itemCount, "item", "items")}
                  </span>
                </span>
                {!board.isCreativeBoard ? (
                  <Badge>From the customer</Badge>
                ) : board.sharedWithCustomer ? (
                  <Badge tone="green">Shared</Badge>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4">
        <Button onClick={createBoard} disabled={creating} aria-busy={creating}>
          {creating ? "Creating..." : "+ New moodboard for this job"}
        </Button>
        {createFailed && (
          <p role="alert" className="mt-2 text-sm text-[var(--av2-error-text)]">
            We couldn&apos;t create the moodboard. Please try again.
          </p>
        )}
      </div>
    </Card>
  );
}
