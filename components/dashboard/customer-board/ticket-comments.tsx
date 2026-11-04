// -----------------------------------------------------------------------------
// @file: components/dashboard/customer-board/ticket-comments.tsx
// @purpose: Comments tab of the card detail. Uses the same endpoint as the full
//           ticket page; comments stay separate from revision notes.
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useId, useState } from "react";

import {
  Avatar,
  Button,
  Callout,
  EmptyState,
  Field,
  Skeleton,
  TextArea,
} from "@/components/admin/v2/ui";
import { formatDateTime } from "@/lib/board";

type TicketComment = {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string | null; email: string };
};

export function TicketComments({ ticketId }: { ticketId: string }) {
  const [comments, setComments] = useState<TicketComment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const fieldId = useId();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/customer/tickets/${ticketId}/comments`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) {
          setError(json?.error || `Request failed with status ${res.status}`);
          return;
        }
        setComments((json?.comments as TicketComment[]) ?? []);
      } catch (err) {
        console.error("[BoardTicketComments] load error", err);
        if (!cancelled) setError("Unexpected error while loading comments.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ticketId]);

  const submit = async () => {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/customer/tickets/${ticketId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error || `Request failed with status ${res.status}`);
        return;
      }
      const created = json?.comment as TicketComment | undefined;
      if (created) {
        setComments((prev) => [...(prev ?? []), created]);
        setDraft("");
      }
    } catch (err) {
      console.error("[BoardTicketComments] add error", err);
      setError("Failed to add comment. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      {error ? (
        <Callout tone="error" title="Something went wrong with comments">
          {error}
        </Callout>
      ) : null}

      {comments === null && !error ? (
        <div aria-busy="true" aria-label="Loading comments" className="space-y-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : null}

      {comments !== null && comments.length === 0 ? (
        <EmptyState
          title="No comments yet"
          description="Start a thread with your team and the creative."
        />
      ) : null}

      {comments && comments.length > 0 ? (
        <ul className="space-y-3">
          {comments.map((comment) => (
            <li key={comment.id} className="flex gap-3 rounded-xl bg-[var(--av2-bg)] p-4">
              <Avatar name={comment.author.name || comment.author.email} size={32} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-sm font-semibold break-words">
                    {comment.author.name || comment.author.email}
                  </span>
                  <span className="text-xs text-[var(--av2-text-2)]">
                    {formatDateTime(comment.createdAt)}
                  </span>
                </div>
                <p className="mt-1 text-sm break-words whitespace-pre-wrap">{comment.body}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="border-t border-[var(--av2-border)] pt-4">
        <Field
          label="Add a comment"
          htmlFor={fieldId}
          hint="Comments are visible to your team and brandbite creatives."
        >
          <TextArea
            id={fieldId}
            rows={3}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Share feedback, clarifications, or next steps for this request."
          />
        </Field>
        <div className="mt-3 flex justify-end">
          <Button variant="primary" onClick={submit} disabled={sending || !draft.trim()}>
            {sending ? "Sending…" : "Add comment"}
          </Button>
        </div>
      </div>
    </div>
  );
}
