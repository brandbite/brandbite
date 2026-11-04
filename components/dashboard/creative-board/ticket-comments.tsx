// -----------------------------------------------------------------------------
// @file: components/dashboard/creative-board/ticket-comments.tsx
// @purpose: Read-only comment list for the card detail. Writing stays on the
//           full ticket page, which owns the comment form.
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useState } from "react";

import { Avatar, Callout, EmptyState, Skeleton, TextLink } from "@/components/admin/v2/ui";
import { formatDateTime } from "@/lib/board";

type TicketComment = {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string | null; email: string; role: string };
};

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; comments: TicketComment[] };

export function TicketComments({ ticketId }: { ticketId: string }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    (async () => {
      try {
        const res = await fetch(`/api/creative/tickets/${ticketId}/comments`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error || "Failed to load comments.");
        if (!cancelled) setState({ status: "ready", comments: json?.comments ?? [] });
      } catch (err) {
        console.error("[CreativeBoard] failed to load comments", err);
        if (!cancelled) {
          setState({
            status: "error",
            message: err instanceof Error ? err.message : "Failed to load comments.",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ticketId]);

  const addLink = (
    <TextLink href={`/creative/tickets/${ticketId}`}>Add a comment on the full page</TextLink>
  );

  if (state.status === "loading") {
    return (
      <div aria-busy="true" aria-label="Loading comments" className="space-y-3">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <Callout tone="error" title="We couldn't load the comments">
        {state.message}
      </Callout>
    );
  }

  if (state.comments.length === 0) {
    return (
      <EmptyState
        title="No comments yet."
        description="Comments are visible to the customer and brandbite admins."
        action={addLink}
      />
    );
  }

  return (
    <div>
      <ul className="space-y-4">
        {state.comments.map((comment) => {
          const author = comment.author.name || comment.author.email;
          return (
            <li key={comment.id} className="flex gap-3">
              <Avatar name={author} size={32} tone="neutral" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span className="font-semibold">{author}</span>
                  <span className="text-xs text-[var(--av2-text-2)]">
                    {formatDateTime(comment.createdAt)}
                  </span>
                </p>
                <p className="mt-0.5 text-sm break-words whitespace-pre-wrap">{comment.body}</p>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 border-t border-[var(--av2-border)] pt-4">{addLink}</div>
    </div>
  );
}
