// -----------------------------------------------------------------------------
// @file: app/customer/tickets/drafts/page.tsx
// @purpose: The signed-in person's saved, unsent requests: carry on or delete.
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useState } from "react";

import {
  Button,
  ButtonLink,
  Callout,
  Card,
  EmptyState,
  PageHeader,
  plural,
  Skeleton,
} from "@/components/admin/v2/ui";
import { BackLink } from "@/components/dashboard/tickets/shared";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { TicketDraftClient } from "@/lib/ticket-drafts";

function formatUpdated(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function excerpt(html: string) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

export default function CustomerTicketDraftsPage() {
  const [drafts, setDrafts] = useState<TicketDraftClient[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [deleting, setDeleting] = useState<TicketDraftClient | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const res = await fetch("/api/customer/ticket-drafts", { cache: "no-store" });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const json = await res.json();
      setDrafts(json.drafts ?? []);
    } catch (error) {
      console.error("[customer.ticket-drafts] load error", error);
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteFailed(false);
    try {
      const res = await fetch(`/api/customer/ticket-drafts/${deleting.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) throw new Error(`Request failed: ${res.status}`);
      setDrafts((prev) => (prev ?? []).filter((d) => d.id !== deleting.id));
    } catch (error) {
      console.error("[customer.ticket-drafts] delete error", error);
      setDeleteFailed(true);
    } finally {
      setDeleteBusy(false);
      setDeleting(null);
    }
  };

  return (
    <>
      <BackLink href="/customer/tickets">Back to requests</BackLink>
      <PageHeader
        title="Drafts"
        description="Requests you've saved but not sent. They cost no tokens until you create them, and others in your company don't see them."
        actions={
          <ButtonLink href="/customer/tickets/new" variant="primary">
            + New request
          </ButtonLink>
        }
      />

      <div className="space-y-4">
        {failed ? (
          <Callout
            tone="error"
            title="We couldn't load your drafts"
            action={
              <Button size="sm" onClick={load}>
                Try again
              </Button>
            }
          />
        ) : null}
        {deleteFailed ? (
          <Callout tone="error" title="That draft wasn't deleted">
            Please try again.
          </Callout>
        ) : null}

        {!drafts && !failed ? (
          <div className="space-y-3" role="status">
            <span className="sr-only">Loading drafts…</span>
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-2xl" />
            ))}
          </div>
        ) : null}

        {drafts && drafts.length === 0 ? (
          <Card>
            <EmptyState
              title="No drafts"
              description="Start a request and it saves itself here as you write."
            />
          </Card>
        ) : null}

        {(drafts ?? []).map((draft) => {
          const brief = excerpt(draft.description);
          return (
            <Card key={draft.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1 basis-64">
                  <h2 className="text-base font-semibold break-words">
                    {draft.title.trim() || "Untitled request"}
                  </h2>
                  {brief ? (
                    <p className="mt-1 line-clamp-2 text-sm break-words text-[var(--av2-text-2)]">
                      {brief}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs text-[var(--av2-text-2)]">
                    Saved {formatUpdated(draft.updatedAt)}
                    {draft.attachments.length > 0
                      ? ` · ${draft.attachments.length} ${plural(draft.attachments.length, "file", "files")}`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    aria-label={`Delete ${draft.title.trim() || "untitled draft"}`}
                    onClick={() => setDeleting(draft)}
                  >
                    Delete
                  </Button>
                  <ButtonLink href={`/customer/tickets/new?draft=${draft.id}`}>Continue</ButtonLink>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        loading={deleteBusy}
        title="Delete this draft?"
        description="The draft and its files will be removed. This can't be undone."
        confirmLabel="Delete draft"
        cancelLabel="Keep draft"
      />
    </>
  );
}
