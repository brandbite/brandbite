// -----------------------------------------------------------------------------
// @file: app/creative/tickets/[ticketId]/page.tsx
// @purpose: Creative-facing ticket detail with comments + revision history
// @version: v1.1.0
// @status: active
// @lastUpdate: 2025-12-26
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { buildTicketCode } from "@/lib/ticket-code";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormTextarea } from "@/components/ui/form-field";
import { SafeHtml } from "@/components/ui/safe-html";
import { InlineAlert } from "@/components/ui/inline-alert";
import { EmptyState } from "@/components/ui/empty-state";
import {
  priorityBadgeVariant,
  statusBadgeVariant,
  STATUS_LABELS,
  PRIORITY_LABELS,
  formatPriorityLabel,
  formatBoardDate,
  formatDateTime,
} from "@/lib/board";
import {
  RevisionImageGrid,
  BriefThumbnailRow,
  DownloadAllButton,
  type AssetEntry,
} from "@/components/ui/revision-image";
import { formatBytes } from "@/lib/upload-helpers";
import { RevisionCompare } from "@/components/ui/revision-compare";

type TicketStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

type TicketDetailResponse = {
  company: {
    id: string;
    name: string;
    slug: string;
  } | null;
  ticket: {
    id: string;
    title: string;
    description: string | null;
    status: TicketStatus;
    priority: TicketPriority;
    dueDate: string | null;
    createdAt: string;
    updatedAt: string;
    companyTicketNumber: number | null;
    quantity: number;
    effectivePayout: number | null;
    project: {
      id: string;
      name: string;
      code: string | null;
    } | null;
    jobType: {
      id: string;
      name: string;
      tokenCost: number;
      creativePayoutTokens: number;
    } | null;
    creative: {
      id: string;
      name: string | null;
      email: string;
    } | null;
    createdBy: {
      id: string;
      name: string | null;
      email: string;
    } | null;
    completedAt: string | null;
    completedBy: {
      id: string;
      name: string | null;
      email: string;
    } | null;
  };
};

type ViewState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: TicketDetailResponse };

type TicketComment = {
  id: string;
  body: string;
  createdAt: string;
  author: {
    id: string;
    name: string | null;
    email: string;
    role: string;
  };
};

type RevisionAsset = {
  id: string;
  url: string | null;
  mimeType: string;
  bytes: number;
  width: number | null;
  height: number | null;
  originalName: string | null;
  pinCount: number;
  openPins: number;
  resolvedPins: number;
};

type TicketRevisionItem = {
  version: number;
  submittedAt: string | null;
  feedbackAt: string | null;
  feedbackMessage: string | null;
  creativeMessage: string | null;
  assets: RevisionAsset[];
};

export default function CreativeTicketDetailPage() {
  const params = useParams<{ ticketId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromBoard = searchParams.get("from") === "board";

  const ticketIdFromParams = typeof params?.ticketId === "string" ? params.ticketId : "";

  const [state, setState] = useState<ViewState>({ status: "loading" });

  const [comments, setComments] = useState<TicketComment[] | null>(null);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  const [revisions, setRevisions] = useState<TicketRevisionItem[] | null>(null);
  const [revisionsLoading, setRevisionsLoading] = useState(false);
  const [revisionsError, setRevisionsError] = useState<string | null>(null);

  const [briefAssets, setBriefAssets] = useState<AssetEntry[]>([]);
  const [briefAssetsLoading, setBriefAssetsLoading] = useState(false);
  const [showCompare, setShowCompare] = useState(false);

  // ---------------------------------------------------------------------------
  // Ticket detail load
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    const resolvedTicketId =
      ticketIdFromParams ||
      (typeof window !== "undefined" ? (window.location.pathname.split("/").pop() ?? "") : "");

    if (!resolvedTicketId) {
      console.warn("[CreativeTicketDetailPage] Could not resolve ticket id from URL");
      return;
    }

    const load = async () => {
      setState({ status: "loading" });

      try {
        const res = await fetch(`/api/creative/tickets/${resolvedTicketId}`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);

        if (!res.ok) {
          const msg = json?.error || `Request failed with status ${res.status}`;
          if (!cancelled) {
            setState({ status: "error", message: msg });
          }
          return;
        }

        if (!cancelled) {
          setState({
            status: "ready",
            data: json as TicketDetailResponse,
          });
        }
      } catch (error) {
        console.error("Creative ticket detail fetch error:", error);
        if (!cancelled) {
          setState({
            status: "error",
            message: "Unexpected error while loading ticket detail.",
          });
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [ticketIdFromParams]);

  const ticketIdFromData = state.status === "ready" ? state.data.ticket.id : null;

  // ---------------------------------------------------------------------------
  // Comments load
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!ticketIdFromData) return;

    let cancelled = false;

    const loadComments = async () => {
      setCommentsLoading(true);
      setCommentsError(null);

      try {
        const res = await fetch(`/api/creative/tickets/${ticketIdFromData}/comments`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);

        if (!res.ok) {
          const msg = json?.error || `Request failed with status ${res.status}`;
          if (!cancelled) {
            setCommentsError(msg);
          }
          return;
        }

        if (!cancelled) {
          setComments((json?.comments as TicketComment[]) ?? []);
        }
      } catch (err) {
        console.error("Creative ticket comments fetch error:", err);
        if (!cancelled) {
          setCommentsError("Unexpected error while loading comments.");
        }
      } finally {
        if (!cancelled) {
          setCommentsLoading(false);
        }
      }
    };

    loadComments();

    return () => {
      cancelled = true;
    };
  }, [ticketIdFromData]);

  // ---------------------------------------------------------------------------
  // Revisions load (creativeMessage + feedbackMessage)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!ticketIdFromData) return;

    let cancelled = false;

    const loadRevisions = async () => {
      setRevisionsLoading(true);
      setRevisionsError(null);

      try {
        const res = await fetch(`/api/creative/tickets/${ticketIdFromData}/revisions`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);

        if (!res.ok) {
          const msg = json?.error || `Request failed with status ${res.status}`;
          if (!cancelled) {
            setRevisionsError(msg);
          }
          return;
        }

        if (!cancelled) {
          setRevisions((json?.revisions as TicketRevisionItem[]) ?? []);
        }
      } catch (err) {
        console.error("Creative ticket revisions fetch error:", err);
        if (!cancelled) {
          setRevisionsError("Unexpected error while loading revision history.");
        }
      } finally {
        if (!cancelled) {
          setRevisionsLoading(false);
        }
      }
    };

    loadRevisions();

    return () => {
      cancelled = true;
    };
  }, [ticketIdFromData]);

  // ---------------------------------------------------------------------------
  // Brief assets load (BRIEF_INPUT attachments from customer)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!ticketIdFromData) return;

    let cancelled = false;

    const loadBriefAssets = async () => {
      setBriefAssetsLoading(true);
      try {
        const res = await fetch(
          `/api/creative/tickets/${ticketIdFromData}/assets?kind=BRIEF_INPUT`,
          { cache: "no-store" },
        );
        const json = await res.json().catch(() => null);

        if (!cancelled && res.ok && Array.isArray(json?.assets)) {
          setBriefAssets(
            json.assets.map((a: any) => ({
              id: a.id,
              url: a.url ?? null,
              originalName: a.originalName ?? null,
              pinCount: a.pinCount ?? 0,
            })),
          );
        }
      } catch (err) {
        console.error("Creative brief assets fetch error:", err);
      } finally {
        if (!cancelled) setBriefAssetsLoading(false);
      }
    };

    loadBriefAssets();
    return () => {
      cancelled = true;
    };
  }, [ticketIdFromData]);

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------
  const error = state.status === "error" ? state.message : null;
  const data = state.status === "ready" ? state.data : null;
  const company = data?.company ?? null;
  const ticket = data?.ticket ?? null;

  const ticketCode = useMemo(() => {
    if (!ticket) return "";
    return buildTicketCode({
      projectCode: ticket.project?.code,
      companyTicketNumber: ticket.companyTicketNumber,
      ticketId: ticket.id,
    });
  }, [ticket]);

  const handleSubmitComment = async () => {
    if (!ticketIdFromData) return;
    const trimmed = newComment.trim();
    if (!trimmed) return;

    setSubmittingComment(true);
    setCommentsError(null);

    try {
      const res = await fetch(`/api/creative/tickets/${ticketIdFromData}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmed }),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = json?.error || `Request failed with status ${res.status}`;
        setCommentsError(msg);
        return;
      }

      const created = json?.comment as TicketComment | undefined;
      if (created) {
        setComments((prev) => [...(prev ?? []), created]);
        setNewComment("");
      }
    } catch (err) {
      console.error("Creative add comment error:", err);
      setCommentsError("Failed to add comment. Please try again.");
    } finally {
      setSubmittingComment(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (state.status === "loading") {
    return <TicketDetailSkeleton />;
  }

  return (
    <>
      {/* Page header */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(fromBoard ? "/creative/board" : "/creative/tickets")}
            className="mb-2"
          >
            ← {fromBoard ? "Back to board" : "Back to tickets"}
          </Button>

          <h1 className="text-2xl font-semibold tracking-tight">{ticket?.title ?? "Ticket"}</h1>
          {ticketCode && (
            <p className="mt-1 text-xs text-[var(--bb-text-tertiary)]">
              Ticket code:{" "}
              <span className="font-medium text-[var(--bb-secondary)]">{ticketCode}</span>
            </p>
          )}
          {company && (
            <p className="mt-1 text-xs text-[var(--bb-text-tertiary)]">
              Customer:{" "}
              <span className="font-medium text-[var(--bb-secondary)]">{company.name}</span> (
              {company.slug})
            </p>
          )}
        </div>

        {ticket && (
          <div className="flex flex-col items-end gap-2">
            <Badge variant={statusBadgeVariant(ticket.status)}>
              {STATUS_LABELS[ticket.status]}
            </Badge>
            <Badge variant={priorityBadgeVariant(ticket.priority)}>
              {formatPriorityLabel(ticket.priority)}
            </Badge>
          </div>
        )}
      </div>

      {/* Error state */}
      {error && (
        <InlineAlert variant="error" title="Something went wrong" className="mb-4">
          {error}
        </InlineAlert>
      )}

      {!error && ticket && (
        <div className="grid gap-4 md:grid-cols-3">
          {/* Left: brief + job/meta + revisions */}
          <section className="space-y-4 md:col-span-2">
            {/* Approval banner — DONE */}
            {ticket.status === "DONE" && ticket.completedAt && (
              <div className="flex items-center gap-3 rounded-xl border border-[var(--bb-success-border)] bg-[var(--bb-success-bg)] px-4 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#32b37b] text-white">
                  &#10003;
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[var(--bb-secondary)]">Approved</p>
                  <p className="mt-0.5 text-xs text-[var(--bb-text-tertiary)]">
                    {ticket.completedBy?.name || ticket.completedBy?.email || "Customer"} approved
                    this work on {formatBoardDate(ticket.completedAt)}
                  </p>
                </div>
              </div>
            )}

            {/* Brief */}
            <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-4 py-4 shadow-sm">
              <h2 className="text-sm font-semibold text-[var(--bb-secondary)]">Brief</h2>
              {ticket.description ? (
                <SafeHtml
                  html={ticket.description}
                  className="mt-2 text-sm text-[var(--bb-text-secondary)]"
                />
              ) : (
                <p className="mt-2 text-xs text-[var(--bb-text-tertiary)]">
                  No description was provided for this ticket.
                </p>
              )}
            </div>

            {/* Meta */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-4 py-3 shadow-sm">
                <h3 className="text-xs font-semibold tracking-[0.18em] text-[var(--bb-text-muted)] uppercase">
                  Project & job
                </h3>
                <div className="mt-2 space-y-1 text-xs text-[var(--bb-text-secondary)]">
                  <p>
                    Project:{" "}
                    <span className="font-semibold text-[var(--bb-secondary)]">
                      {ticket.project?.name || "—"}
                    </span>
                  </p>
                  <p>
                    Project code:{" "}
                    <span className="font-semibold text-[var(--bb-secondary)]">
                      {ticket.project?.code || "—"}
                    </span>
                  </p>
                  <p>
                    Job type:{" "}
                    <span className="font-semibold text-[var(--bb-secondary)]">
                      {ticket.jobType?.name || "—"}
                    </span>
                  </p>
                  <p>
                    Creative payout:{" "}
                    <span className="font-semibold text-[var(--bb-secondary)]">
                      {ticket.effectivePayout != null
                        ? ticket.quantity > 1 && ticket.jobType
                          ? `${ticket.jobType.creativePayoutTokens} × ${ticket.quantity} = ${ticket.effectivePayout} tokens`
                          : `${ticket.effectivePayout} tokens`
                        : ticket.jobType?.creativePayoutTokens != null
                          ? `${ticket.jobType.creativePayoutTokens} tokens`
                          : "—"}
                    </span>
                  </p>
                  {ticket.quantity > 1 && (
                    <p>
                      Quantity:{" "}
                      <span className="font-semibold text-[var(--bb-secondary)]">
                        ×{ticket.quantity}
                      </span>
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-4 py-3 shadow-sm">
                <h3 className="text-xs font-semibold tracking-[0.18em] text-[var(--bb-text-muted)] uppercase">
                  Dates
                </h3>
                <div className="mt-2 space-y-1 text-xs text-[var(--bb-text-secondary)]">
                  <p>
                    Created:{" "}
                    <span className="font-semibold text-[var(--bb-secondary)]">
                      {formatDateTime(ticket.createdAt)}
                    </span>
                  </p>
                  <p>
                    Last updated:{" "}
                    <span className="font-semibold text-[var(--bb-secondary)]">
                      {formatDateTime(ticket.updatedAt)}
                    </span>
                  </p>
                  <p>
                    Due date:{" "}
                    <span className="font-semibold text-[var(--bb-secondary)]">
                      {formatBoardDate(ticket.dueDate)}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* Brief attachments */}
            {!briefAssetsLoading && briefAssets.length > 0 && (
              <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-4 py-4 shadow-sm">
                <h2 className="text-sm font-semibold text-[var(--bb-secondary)]">
                  Brief attachments
                </h2>
                <p className="mt-1 text-xs text-[var(--bb-text-tertiary)]">
                  Reference files provided by the customer.
                </p>
                <BriefThumbnailRow assets={briefAssets} />
              </div>
            )}

            {/* Revision history */}
            <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-4 py-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[var(--bb-secondary)]">
                  Revision history
                </h2>
                {revisions && revisions.length >= 2 && (
                  <button
                    type="button"
                    onClick={() => setShowCompare(true)}
                    className="inline-flex items-center gap-1 rounded-full border border-[var(--bb-border-input)] bg-[var(--bb-bg-page)] px-2.5 py-1 text-[11px] font-medium text-[var(--bb-text-secondary)] transition-colors hover:border-[var(--bb-primary)] hover:bg-[var(--bb-primary-light)] hover:text-[var(--bb-primary)]"
                  >
                    &#8596; Compare
                  </button>
                )}
              </div>

              {revisionsLoading && (
                <p className="mt-2 text-xs text-[var(--bb-text-tertiary)]">
                  Loading revision history…
                </p>
              )}

              {!revisionsLoading && revisionsError && (
                <InlineAlert variant="error" size="sm" className="mt-2">
                  {revisionsError}
                </InlineAlert>
              )}

              {!revisionsLoading && !revisionsError && (!revisions || revisions.length === 0) && (
                <div className="mt-2">
                  <EmptyState
                    title="No revisions yet."
                    description="Revisions will appear here once this ticket has been submitted for review."
                  />
                </div>
              )}

              {!revisionsLoading && !revisionsError && revisions && revisions.length > 0 && (
                <div className="mt-3 space-y-3">
                  {[...revisions].reverse().map((rev, idx) => {
                    const isLatest = idx === 0;
                    const totalOpen = rev.assets.reduce((sum, a) => sum + (a.openPins ?? 0), 0);
                    const totalResolved = rev.assets.reduce(
                      (sum, a) => sum + (a.resolvedPins ?? 0),
                      0,
                    );
                    const totalBytes = rev.assets.reduce((sum, a) => sum + (a.bytes ?? 0), 0);
                    const assetEntries: AssetEntry[] = rev.assets.map((a) => ({
                      id: a.id,
                      url: a.url,
                      originalName: a.originalName,
                      pinCount: a.pinCount,
                    }));

                    return (
                      <div
                        key={rev.version}
                        className={`rounded-xl px-3 py-3 text-xs ${
                          isLatest
                            ? "border border-[var(--bb-primary)]/20 bg-[var(--bb-primary)]/[0.03]"
                            : "bg-[var(--bb-bg-card)]"
                        }`}
                      >
                        {/* Revision header */}
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold text-[var(--bb-secondary)]">
                            Version v{rev.version}
                          </p>
                          {isLatest && (
                            <span className="rounded-full bg-[var(--bb-primary)] px-2 py-0.5 text-[9px] font-bold tracking-wider text-white uppercase">
                              Current
                            </span>
                          )}
                          {rev.assets.length > 0 && (
                            <span className="text-[var(--bb-text-tertiary)]">
                              · {rev.assets.length} file{rev.assets.length !== 1 ? "s" : ""}
                              {totalBytes > 0 && ` · ${formatBytes(totalBytes)}`}
                            </span>
                          )}
                          {(totalOpen > 0 || totalResolved > 0) && (
                            <span className="flex items-center gap-1.5 text-[var(--bb-text-tertiary)]">
                              ·
                              {totalOpen > 0 && (
                                <span className="flex items-center gap-0.5">
                                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--bb-primary)]" />
                                  {totalOpen} open
                                </span>
                              )}
                              {totalResolved > 0 && (
                                <span className="flex items-center gap-0.5">
                                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#32b37b]" />
                                  {totalResolved} resolved
                                </span>
                              )}
                            </span>
                          )}
                        </div>

                        {rev.submittedAt && (
                          <p className="mt-1 text-[var(--bb-text-secondary)]">
                            You sent this version for review on{" "}
                            <span className="font-semibold text-[var(--bb-secondary)]">
                              {formatBoardDate(rev.submittedAt)}
                            </span>
                            .
                          </p>
                        )}
                        {rev.feedbackAt && (
                          <p className="text-[var(--bb-text-secondary)]">
                            Customer requested changes on{" "}
                            <span className="font-semibold text-[var(--bb-secondary)]">
                              {formatBoardDate(rev.feedbackAt)}
                            </span>
                            .
                          </p>
                        )}

                        {rev.creativeMessage && (
                          <p className="mt-1 text-[var(--bb-secondary)]">
                            <span className="font-semibold">Your note:</span>{" "}
                            <span className="italic">&ldquo;{rev.creativeMessage}&rdquo;</span>
                          </p>
                        )}

                        {rev.feedbackMessage && (
                          <p className="mt-1 text-[var(--bb-text-secondary)]">
                            <span className="font-semibold">Customer feedback:</span>{" "}
                            <span className="italic">&ldquo;{rev.feedbackMessage}&rdquo;</span>
                          </p>
                        )}

                        {/* Asset thumbnails */}
                        {assetEntries.length > 0 && (
                          <RevisionImageGrid
                            assets={assetEntries}
                            pinMode={ticket.status === "IN_PROGRESS" ? "resolve" : "view"}
                            ticketId={ticket.id}
                          />
                        )}

                        {/* Download all button */}
                        {assetEntries.length >= 2 && (
                          <div className="mt-2">
                            <DownloadAllButton
                              assets={assetEntries}
                              zipFilename={`${ticketCode || ticket.id}-v${rev.version}`}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Right: comments + people */}
          <section className="space-y-4">
            <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-4 py-3 shadow-sm">
              <h3 className="text-xs font-semibold tracking-[0.18em] text-[var(--bb-text-muted)] uppercase">
                Comments
              </h3>

              {commentsError && (
                <InlineAlert variant="error" size="sm" className="mt-2">
                  {commentsError}
                </InlineAlert>
              )}

              <div className="mt-2 max-h-60 space-y-2 overflow-y-auto pr-1">
                {commentsLoading && (
                  <p className="text-xs text-[var(--bb-text-tertiary)]">Loading comments…</p>
                )}
                {!commentsLoading && !commentsError && (comments?.length ?? 0) === 0 && (
                  <EmptyState
                    title="No comments yet."
                    description="Use the form below to coordinate with the customer or Brandbite team."
                  />
                )}
                {!commentsLoading &&
                  !commentsError &&
                  (comments?.length ?? 0) > 0 &&
                  comments!.map((c) => (
                    <div key={c.id} className="rounded-lg bg-[var(--bb-bg-card)] px-3 py-2 text-xs">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="font-semibold text-[var(--bb-secondary)]">
                          {c.author.name || c.author.email}
                        </span>
                        <span className="text-xs text-[var(--bb-text-tertiary)]">
                          {formatDateTime(c.createdAt)}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-[var(--bb-secondary)]">{c.body}</p>
                    </div>
                  ))}
              </div>

              <div className="mt-3 border-t border-[var(--bb-border-subtle)] pt-3">
                <label className="mb-1 block text-xs font-medium text-[var(--bb-secondary)]">
                  Add a comment
                </label>
                <FormTextarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={3}
                  placeholder="Share updates, questions, or next steps with the customer."
                />
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-[var(--bb-text-tertiary)]">
                    Comments are visible to the customer and Brandbite admins.
                  </p>
                  <Button
                    size="sm"
                    disabled={!newComment.trim() || !ticketIdFromData}
                    loading={submittingComment}
                    loadingText="Sending…"
                    onClick={handleSubmitComment}
                  >
                    Add comment
                  </Button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-4 py-3 shadow-sm">
              <h3 className="text-xs font-semibold tracking-[0.18em] text-[var(--bb-text-muted)] uppercase">
                People
              </h3>
              <div className="mt-2 space-y-2 text-xs text-[var(--bb-text-secondary)]">
                <div>
                  <p className="font-semibold text-[var(--bb-secondary)]">Customer requester</p>
                  <p>{ticket.createdBy?.name || ticket.createdBy?.email || "—"}</p>
                </div>
                <div>
                  <p className="mt-2 font-semibold text-[var(--bb-secondary)]">Creative</p>
                  <p>{ticket.creative?.name || ticket.creative?.email || "—"}</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {!error && !ticket && (
        <InlineAlert variant="warning">Ticket could not be loaded.</InlineAlert>
      )}

      {/* Revision comparison overlay */}
      {showCompare && revisions && revisions.length >= 2 && (
        <RevisionCompare
          revisions={revisions.map((r) => ({
            version: r.version,
            submittedAt: r.submittedAt,
            assets: r.assets.map((a) => ({
              id: a.id,
              url: a.url,
              originalName: a.originalName,
              pinCount: a.pinCount,
            })),
          }))}
          onClose={() => setShowCompare(false)}
        />
      )}
    </>
  );
}

function TicketDetailSkeleton() {
  return (
    <>
      <div className="mb-4 h-6 w-64 animate-pulse rounded bg-[var(--bb-border)]" />
      <div className="mb-2 h-3 w-40 animate-pulse rounded bg-[var(--bb-border)]" />
      <div className="mb-6 h-3 w-32 animate-pulse rounded bg-[var(--bb-border)]" />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-4 md:col-span-2">
          <div className="h-32 animate-pulse rounded-2xl bg-[var(--bb-bg-page)]" />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-32 animate-pulse rounded-2xl bg-[var(--bb-bg-page)]" />
            <div className="h-32 animate-pulse rounded-2xl bg-[var(--bb-bg-page)]" />
          </div>
          <div className="h-40 animate-pulse rounded-2xl bg-[var(--bb-bg-page)]" />
        </div>
        <div className="space-y-4">
          <div className="h-40 animate-pulse rounded-2xl bg-[var(--bb-bg-page)]" />
          <div className="h-32 animate-pulse rounded-2xl bg-[var(--bb-bg-page)]" />
        </div>
      </div>
    </>
  );
}
