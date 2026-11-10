// -----------------------------------------------------------------------------
// @file: app/creative/tickets/[ticketId]/page.tsx
// @purpose: Creative-facing ticket detail with comments + revision history
// @version: v1.1.0
// @status: active
// @lastUpdate: 2025-12-26
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  Badge,
  Button,
  Callout,
  Card,
  DASH,
  EmptyState,
  Eyebrow,
  KeyValueList,
  Skeleton,
  TabPanel,
  Tabs,
} from "@/components/admin/v2/ui";
import { DeliveryForm } from "@/components/dashboard/tickets/delivery-form";
import { JobMoodboards } from "@/components/dashboard/tickets/job-moodboards";
import {
  BackLink,
  CollapsedVersion,
  CommentsPanel,
  CurrentVersionCard,
  DetailColumns,
  DetailSkeleton,
  DownloadFilesButton,
  DueDate,
  FilePreviews,
  PriorityBadge,
  StatusBadge,
  TicketHeader,
  TicketTitle,
  tokenCount,
  VersionsHeading,
  type TicketComment,
  type TicketVersion,
} from "@/components/dashboard/tickets/shared";
import {
  TimeEntriesPanel,
  TimeStrip,
  autoTimerMessage,
  useTimeTracking,
} from "@/components/dashboard/tickets/time-tracking";
import { buildTicketCode } from "@/lib/ticket-code";
import { SafeHtml } from "@/components/ui/safe-html";
import { useToast } from "@/components/ui/toast-provider";
import { formatBoardDate } from "@/lib/board";
import type { AssetEntry } from "@/components/ui/revision-image";
import { RevisionCompare } from "@/components/ui/revision-compare";
import { TicketActivityPanel } from "@/components/dashboard/ticket-activity-panel";
import { SourceFilesPanel } from "@/components/tickets/source-files-panel";
import {
  FullPageViewControls,
  fullPageViewLinks,
} from "@/components/dashboard/tickets/view-switch";

type JobTab = "delivery" | "brief" | "time" | "comments" | "activity";

const TAB_PREFIX = "job-detail";

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
    /** Rate used for effectivePayout; null when an admin set a fixed payout. */
    payoutPercent?: number | null;
    project: {
      id: string;
      name: string;
      code: string | null;
      brandLogoUrl: string | null;
      brandColors: string | null;
      brandFonts: string | null;
      brandVoice: string | null;
    } | null;
    jobType: {
      id: string;
      name: string;
      tokenCost: number;
      creativePayoutTokens: number;
      estimatedHours: number | null;
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
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const fromBoard = searchParams.get("from") === "board";

  const ticketIdFromParams = typeof params?.ticketId === "string" ? params.ticketId : "";

  const [state, setState] = useState<ViewState>({ status: "loading" });
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [tab, setTab] = useState<JobTab>("delivery");
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

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
            message: "Unexpected error while loading request detail.",
          });
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [ticketIdFromParams, refreshCounter]);

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
  }, [ticketIdFromData, refreshCounter]);

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

  // Start work / Pull back: the same PATCH the table and board use. The server
  // applies the shared transition rules.
  const moveStatus = async (status: TicketStatus) => {
    if (!ticketIdFromData) return;
    setStatusBusy(true);
    setStatusError(null);
    try {
      const res = await fetch("/api/creative/tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ticketIdFromData, status }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setStatusError(json?.error || `Request failed with status ${res.status}`);
        return;
      }
      showToast({
        type: "success",
        title: status === "IN_PROGRESS" ? "Work started" : "Request status updated.",
        description: autoTimerMessage(json?.timer) ?? undefined,
      });
      setRefreshCounter((c) => c + 1);
      void tracking.reload();
    } catch (err) {
      console.error("Creative ticket status error:", err);
      setStatusError("Failed to update this request. Please try again.");
    } finally {
      setStatusBusy(false);
    }
  };

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
  const tracking = useTimeTracking(ticketIdFromData, ticket?.jobType?.estimatedHours ?? null);

  if (state.status === "loading") {
    return <DetailSkeleton label="Loading request" />;
  }

  // Back to the board reopens this request's window there.
  const backHref = fromBoard
    ? `/creative/board?open=${encodeURIComponent(ticketIdFromParams ?? "")}`
    : "/creative/tickets";
  const backLabel = fromBoard ? "Back to board" : "Back to requests";

  if (error || !ticket) {
    return (
      <>
        <BackLink href={backHref}>{backLabel}</BackLink>
        {error ? (
          <Callout tone="error" title="We couldn't load this request">
            {error}
          </Callout>
        ) : (
          <Callout tone="warning" title="Request could not be loaded" />
        )}
      </>
    );
  }

  const newestFirst: TicketVersion[] = revisions ? [...revisions].reverse() : [];
  const latest = newestFirst[0] ?? null;
  const changesRequested = !!latest?.feedbackMessage && ticket.status !== "DONE";
  const pinMode = ticket.status === "IN_PROGRESS" ? "resolve" : "view";
  const zipFor = (version: number) => `${ticketCode || ticket.id}-v${version}`;
  const project = ticket.project;
  const hasBrandGuide =
    !!project &&
    !!(project.brandLogoUrl || project.brandColors || project.brandFonts || project.brandVoice);

  const versionCopy = {
    feedbackLabel: "Customer feedback",
    noteLabel: "Your note",
    sentLine: (rev: TicketVersion) =>
      rev.submittedAt ? (
        <>
          You sent this version for review on{" "}
          <span className="font-semibold text-[var(--av2-text)]">
            {formatBoardDate(rev.submittedAt)}
          </span>
          .
        </>
      ) : null,
  };

  const tabs: { value: JobTab; label: string }[] = [
    { value: "delivery", label: "Delivery & feedback" },
    {
      value: "brief",
      label: briefAssets.length > 0 ? `Brief & files (${briefAssets.length})` : "Brief & files",
    },
    { value: "time", label: "Time tracking" },
    { value: "comments", label: comments ? `Comments (${comments.length})` : "Comments" },
    { value: "activity", label: "Activity" },
  ];

  return (
    <>
      <BackLink href={backHref}>{backLabel}</BackLink>

      <TicketHeader
        code={ticketCode}
        title={<TicketTitle>{ticket.title}</TicketTitle>}
        meta={
          company ? (
            <>
              Customer <span className="font-medium text-[var(--av2-text)]">{company.name}</span>
            </>
          ) : null
        }
        badges={
          <>
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            {changesRequested ? <Badge tone="peach">Changes requested</Badge> : null}
          </>
        }
        actions={
          <>
            {ticket.status === "TODO" ? (
              <Button onClick={() => moveStatus("IN_PROGRESS")} disabled={statusBusy}>
                {statusBusy ? "Starting…" : "Start work"}
              </Button>
            ) : ticket.status === "IN_REVIEW" ? (
              <Button onClick={() => moveStatus("IN_PROGRESS")} disabled={statusBusy}>
                {statusBusy ? "Moving…" : "Pull back to In progress"}
              </Button>
            ) : null}
            <FullPageViewControls {...fullPageViewLinks("creative", ticket.id, fromBoard)} />
          </>
        }
      />

      <div className="space-y-6">
        {statusError ? (
          <Callout tone="error" title="Status update failed">
            {statusError}
          </Callout>
        ) : null}

        {ticket.status === "DONE" && ticket.completedAt ? (
          <Callout tone="success" title="Approved">
            {ticket.completedBy?.name || ticket.completedBy?.email || "Customer"} approved this work
            on {formatBoardDate(ticket.completedAt)}.
          </Callout>
        ) : null}

        <TimeStrip tracking={tracking} status={ticket.status} />

        <Tabs
          label="Request sections"
          idPrefix={TAB_PREFIX}
          tabs={tabs}
          value={tab}
          onChange={setTab}
        />

        <DetailColumns
          rail={
            <>
              <Card>
                <h2 className="mb-4 text-xl leading-7 font-semibold">Request summary</h2>
                <KeyValueList
                  rows={[
                    { label: "Project", value: project?.name || DASH },
                    { label: "Project code", value: project?.code || DASH },
                    { label: "Service", value: ticket.jobType?.name || DASH },
                    {
                      label: "Payout",
                      value:
                        ticket.effectivePayout != null ? tokenCount(ticket.effectivePayout) : DASH,
                    },
                    ...(ticket.effectivePayout != null && ticket.payoutPercent != null
                      ? [
                          {
                            label: "Rate",
                            value: ticket.jobType
                              ? `${ticket.payoutPercent}% of ${ticket.jobType.tokenCost * ticket.quantity}`
                              : `${ticket.payoutPercent}%`,
                          },
                        ]
                      : []),
                    ...(ticket.quantity > 1
                      ? [{ label: "Quantity", value: `×${ticket.quantity}` }]
                      : []),
                    {
                      label: "Requester",
                      value: ticket.createdBy?.name || ticket.createdBy?.email || DASH,
                    },
                    {
                      label: "Assignee",
                      value: ticket.creative?.name || ticket.creative?.email || DASH,
                    },
                    {
                      label: "Due date",
                      value: <DueDate iso={ticket.dueDate} done={ticket.status === "DONE"} />,
                    },
                    { label: "Created", value: formatBoardDate(ticket.createdAt) },
                    { label: "Updated", value: formatBoardDate(ticket.updatedAt) },
                  ]}
                />
              </Card>

              <JobMoodboards ticketId={ticket.id} />

              <Card>
                <h2 className="mb-2 text-xl leading-7 font-semibold">Quick links</h2>
                <div className="flex flex-col items-stretch">
                  <Button
                    variant="ghost"
                    className="!justify-start"
                    onClick={() => setTab("brief")}
                  >
                    View brief
                  </Button>
                  <Button
                    variant="ghost"
                    className="!justify-start"
                    onClick={() => setTab("brief")}
                  >
                    Reference files ({briefAssets.length})
                  </Button>
                </div>
              </Card>
            </>
          }
        >
          {tab === "delivery" ? (
            <TabPanel idPrefix={TAB_PREFIX} value="delivery">
              <div className="space-y-4">
                {revisionsError ? (
                  <Callout tone="error" title="We couldn't load your versions">
                    {revisionsError}
                  </Callout>
                ) : revisions === null || (revisionsLoading && newestFirst.length === 0) ? (
                  <Skeleton className="h-64" />
                ) : latest ? (
                  <>
                    <CurrentVersionCard
                      version={latest}
                      pinMode={pinMode}
                      ticketId={ticket.id}
                      zipFilename={zipFor(latest.version)}
                      copy={versionCopy}
                    />
                    {newestFirst.length > 1 ? (
                      <>
                        <VersionsHeading
                          title="Previous versions"
                          count={newestFirst.length}
                          onCompare={() => setShowCompare(true)}
                        />
                        {newestFirst.slice(1).map((rev) => (
                          <CollapsedVersion
                            key={rev.version}
                            version={rev}
                            pinMode={pinMode}
                            ticketId={ticket.id}
                            zipFilename={zipFor(rev.version)}
                            copy={versionCopy}
                          />
                        ))}
                      </>
                    ) : null}
                  </>
                ) : (
                  <Card>
                    <EmptyState
                      title="No versions yet"
                      description="Versions appear here once you've sent this request for review."
                    />
                  </Card>
                )}

                {ticket.status === "IN_PROGRESS" ? (
                  <DeliveryForm
                    ticketId={ticket.id}
                    onSent={() => {
                      setRefreshCounter((c) => c + 1);
                      void tracking.reload();
                    }}
                  />
                ) : ticket.status === "TODO" ? (
                  <Callout tone="info" title="Start work to send a version">
                    You can upload files and send them for review once this request is In progress.
                  </Callout>
                ) : ticket.status === "IN_REVIEW" ? (
                  <Callout tone="info" title="This version is with the customer">
                    They can approve it or request a revision. Pull it back if you need to change
                    something first.
                  </Callout>
                ) : null}

                <SourceFilesPanel ticketId={ticket.id} viewer="creative" />
              </div>
            </TabPanel>
          ) : null}

          {tab === "brief" ? (
            <TabPanel idPrefix={TAB_PREFIX} value="brief">
              <div className="space-y-4">
                <Card>
                  <h2 className="text-xl leading-7 font-semibold">Brief</h2>
                  {ticket.description ? (
                    <SafeHtml html={ticket.description} className="mt-2 text-base" />
                  ) : (
                    <p className="mt-2 text-sm text-[var(--av2-text-2)]">
                      No description was provided for this request.
                    </p>
                  )}

                  <div className="mt-6 border-t border-[var(--av2-border)] pt-5">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <Eyebrow>
                        Reference files{briefAssets.length > 0 ? ` (${briefAssets.length})` : ""}
                      </Eyebrow>
                      <DownloadFilesButton
                        assets={briefAssets}
                        zipFilename={`${ticketCode || ticket.id}-brief`}
                      />
                    </div>
                    {briefAssetsLoading ? (
                      <Skeleton className="h-44" />
                    ) : briefAssets.length > 0 ? (
                      <FilePreviews assets={briefAssets} />
                    ) : (
                      <p className="text-sm text-[var(--av2-text-2)]">
                        The customer didn&apos;t attach any reference files.
                      </p>
                    )}
                  </div>
                </Card>

                {/* Brand guide: pulled from the project so creatives see the
                    customer's brand without hunting. */}
                {project && hasBrandGuide ? (
                  <Card>
                    <h2 className="mb-4 text-xl leading-7 font-semibold">Brand guide</h2>
                    <KeyValueList
                      rows={[
                        ...(project.brandLogoUrl
                          ? [
                              {
                                label: "Logo",
                                value: (
                                  <a
                                    href={project.brandLogoUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="break-all text-[var(--av2-link)] hover:underline"
                                  >
                                    {project.brandLogoUrl}
                                  </a>
                                ),
                              },
                            ]
                          : []),
                        ...(project.brandColors
                          ? [
                              {
                                label: "Colors",
                                value: (
                                  <span className="flex flex-wrap gap-1.5">
                                    {project.brandColors
                                      .split(",")
                                      .map((c) => c.trim())
                                      .filter(Boolean)
                                      .map((c) => (
                                        <span
                                          key={c}
                                          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--av2-border)] px-2 py-0.5 font-mono text-xs font-normal"
                                        >
                                          <span
                                            aria-hidden
                                            className="h-3 w-3 rounded-full border border-[var(--av2-border)]"
                                            style={{ backgroundColor: c }}
                                          />
                                          {c}
                                        </span>
                                      ))}
                                  </span>
                                ),
                              },
                            ]
                          : []),
                        ...(project.brandFonts
                          ? [{ label: "Fonts", value: project.brandFonts }]
                          : []),
                        ...(project.brandVoice
                          ? [
                              {
                                label: "Voice / tone",
                                value: (
                                  <span className="font-normal whitespace-pre-wrap">
                                    {project.brandVoice}
                                  </span>
                                ),
                              },
                            ]
                          : []),
                      ]}
                    />
                  </Card>
                ) : null}
              </div>
            </TabPanel>
          ) : null}

          {tab === "time" ? (
            <TabPanel idPrefix={TAB_PREFIX} value="time">
              <TimeEntriesPanel tracking={tracking} />
            </TabPanel>
          ) : null}

          {tab === "comments" ? (
            <TabPanel idPrefix={TAB_PREFIX} value="comments">
              <CommentsPanel
                comments={comments}
                loading={commentsLoading}
                error={commentsError}
                value={newComment}
                onChange={setNewComment}
                onSubmit={handleSubmitComment}
                submitting={submittingComment}
                placeholder="Share updates, questions, or next steps with the customer."
                visibilityNote="Comments are visible to the customer and brandbite admins."
                emptyDescription="Use the form below to coordinate with the customer or brandbite team."
              />
            </TabPanel>
          ) : null}

          {tab === "activity" ? (
            <TabPanel idPrefix={TAB_PREFIX} value="activity">
              <TicketActivityPanel url={`/api/creative/tickets/${ticket.id}/activity`} />
            </TabPanel>
          ) : null}
        </DetailColumns>
      </div>

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
