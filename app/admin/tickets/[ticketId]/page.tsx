// -----------------------------------------------------------------------------
// @file: app/admin/tickets/[ticketId]/page.tsx
// @purpose: Per-ticket admin drill-down. Read-only — every mutation still
//           flows through the customer / creative routes so the existing
//           permission posture (only the assigned creative can submit a
//           revision, only the ticket owner can approve, etc.) stays the
//           single source of truth. This page is investigative context.
//
//           Renders (admin design language v1):
//             - Header card (code, status, priority, title, dates, a
//               "Read-only view" marker + link to the ticket list)
//             - Tabs: Brief (description + attachments) / Revisions (n) /
//               Comments (n)
//             - Activity card: assignment history + admin actions
//             - "Ticket details" side card: customer, creative, token cost
//               + payout overrides, job type — with deep links
// @version: v2.0.0
// @status: active
// @lastUpdate: 2026-11-01
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useState, type ReactNode, type SVGProps } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

import {
  Avatar,
  Badge,
  ButtonLink,
  Callout,
  Card,
  CardTitle,
  DASH,
  EmptyState,
  Eyebrow,
  IconTile,
  PRIORITY,
  PanelSection,
  Skeleton,
  TICKET_STATUS,
  TabPanel,
  Tabs,
  TextLink,
  fmt,
  plural,
  type Tone,
} from "@/components/admin/v2/ui";
import {
  IconAlertCircle,
  IconArrowUpRight,
  IconBuilding,
  IconCoins,
  IconDocument,
} from "@/components/admin/v2/icons";
import { TicketActivityPanel } from "@/components/dashboard/ticket-activity-panel";
import { SourceFilesPanel } from "@/components/tickets/source-files-panel";

// ---------------------------------------------------------------------------
// Types — narrow mirrors of the API shape, kept colocated so the page
// compiles without leaking server-only Prisma imports.
// ---------------------------------------------------------------------------

type TicketStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" | "CANCELED";
type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
type Role = "SITE_OWNER" | "SITE_ADMIN" | "DESIGNER" | "CUSTOMER";

type UserRef = { id: string; email: string; name: string | null; role?: Role };

type AssetRow = {
  id: string;
  kind?: string;
  url: string | null;
  mimeType: string;
  bytes: number;
  width: number | null;
  height: number | null;
  originalName: string | null;
  createdAt: string;
};

type RevisionRow = {
  id: string;
  version: number;
  submittedAt: string;
  feedbackAt: string | null;
  creativeMessage: string | null;
  feedbackMessage: string | null;
  submittedByCreative: { id: string; email: string; name: string | null } | null;
  feedbackByCustomer: { id: string; email: string; name: string | null } | null;
  assets: AssetRow[];
};

type CommentRow = {
  id: string;
  body: string;
  createdAt: string;
  author: UserRef;
};

type AssignmentLogRow = {
  id: string;
  creativeId: string | null;
  creative: { email: string; name: string | null } | null;
  reason: string;
  notes: string | null;
  metadata: unknown;
  createdAt: string;
};

type AuditLogRow = {
  id: string;
  action: string;
  outcome: string;
  actorEmail: string;
  actorRole: Role;
  metadata: unknown;
  errorMessage: string | null;
  createdAt: string;
};

type DetailResponse = {
  ticket: {
    id: string;
    code: string;
    title: string;
    description: string | null;
    status: TicketStatus;
    priority: TicketPriority;
    creativeMode: "DESIGNER" | "AI";
    dueDate: string | null;
    quantity: number;
    company: { id: string; name: string; slug: string };
    project: { id: string; name: string; code: string | null } | null;
    createdBy: UserRef;
    creative: UserRef | null;
    completedBy: UserRef | null;
    completedAt: string | null;
    jobType: { id: string; name: string; tokenCost: number } | null;
    tags: { id: string; name: string; color: string }[];
    tokenCostBase: number;
    tokenCostOverride: number | null;
    tokenCostEffective: number;
    creativePayoutOverride: number | null;
    revisionCount: number;
    createdAt: string;
    updatedAt: string;
  };
  briefAssets: AssetRow[];
  revisions: RevisionRow[];
  comments: CommentRow[];
  assignmentLogs: AssignmentLogRow[];
  auditLogs: AuditLogRow[];
};

type TabKey = "brief" | "revisions" | "comments" | "activity";

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

// Cancelled tickets land on this page only via direct deep-link (the admin
// board hides them). Render as a muted badge so the operator can still tell
// at a glance that this row is terminal.
const STATUS_META: Record<TicketStatus, { label: string; tone: Tone }> = {
  ...(TICKET_STATUS as Record<Exclude<TicketStatus, "CANCELED">, { label: string; tone: Tone }>),
  CANCELED: { label: "Canceled", tone: "neutral" },
};

const ROLE_LABEL: Record<Role, string> = {
  SITE_OWNER: "Site owner",
  SITE_ADMIN: "Site admin",
  DESIGNER: "Creative",
  CUSTOMER: "Customer",
};

function formatDateTime(iso: string | null): string {
  if (!iso) return DASH;
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .format(new Date(iso))
      .replace(",", " ·");
  } catch {
    return iso;
  }
}

function relativeTime(iso: string | null): string {
  if (!iso) return DASH;
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const sec = Math.round(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day} day${day === 1 ? "" : "s"} ago`;
  const mo = Math.round(day / 30);
  if (mo < 12) return `${mo} mo ago`;
  return `${Math.round(mo / 12)} yr ago`;
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

/** Rich-text editors store an empty brief as "<p></p>" — treat that as none. */
function hasText(html: string | null): boolean {
  if (!html) return false;
  return (
    html
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim().length > 0
  );
}

const fileLabel = (a: AssetRow) => a.mimeType.split("/")[1]?.toUpperCase() ?? "FILE";

// Page-local glyphs the shared icon set doesn't have yet.
const svgBase = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function IconLock(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...svgBase} {...p}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function IconLayers(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...svgBase} {...p}>
      <path d="m12 3 9 5-9 5-9-5z" />
      <path d="m3 13 9 5 9-5" />
    </svg>
  );
}

function IconChat(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...svgBase} {...p}>
      <path d="M20 15a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconBriefcase(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...svgBase} {...p}>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Small local building blocks
// ---------------------------------------------------------------------------

function AssetTile({ asset, size }: { asset: AssetRow; size: "sm" | "md" }) {
  const box = size === "md" ? "h-32 w-32" : "h-24 w-24";
  const isImage = asset.mimeType.startsWith("image/") && asset.url;
  return (
    <li className="w-min rounded-xl border border-[var(--av2-border)] bg-[var(--av2-bg)] p-2">
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={asset.url!}
          alt={asset.originalName ?? ""}
          className={`${box} rounded-lg object-cover`}
        />
      ) : (
        <div
          className={`${box} flex items-center justify-center rounded-lg bg-[var(--av2-surface)] text-xs font-semibold text-[var(--av2-text-2)]`}
        >
          {fileLabel(asset)}
        </div>
      )}
      <p
        className={`mt-2 truncate text-xs font-medium ${size === "md" ? "max-w-32" : "max-w-24"}`}
        title={asset.originalName ?? undefined}
      >
        {asset.originalName || "(unnamed)"}
      </p>
      <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-[var(--av2-text-2)]">
        <span>{formatBytes(asset.bytes)}</span>
        {asset.url && (
          <a
            href={asset.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[var(--av2-link)] hover:underline"
          >
            Open
          </a>
        )}
      </div>
    </li>
  );
}

function DetailBlock({
  label,
  icon,
  children,
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="border-t border-[var(--av2-border)] py-5 first:border-t-0 first:pt-0">
      <Eyebrow>{label}</Eyebrow>
      <div className="mt-3 flex items-start gap-4">
        {icon}
        <div className="min-w-0 flex-1 text-sm">{children}</div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading request">
      <Skeleton className="mb-4 h-5 w-32" />
      <Skeleton className="mb-6 h-36 w-full rounded-2xl" />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px] xl:grid-rows-[auto_1fr]">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
      <p className="sr-only" role="status">
        Loading request…
      </p>
    </div>
  );
}

const BackLink = () => (
  <Link
    href="/admin/tickets"
    className="mb-4 inline-flex items-center gap-1.5 rounded text-sm font-medium text-[var(--av2-text-2)] hover:text-[var(--av2-text)] focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none"
  >
    <span aria-hidden>←</span> Back to requests
  </Link>
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminTicketDetailPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("brief");

  useEffect(() => {
    if (!ticketId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/tickets/${ticketId}`, { cache: "no-store" });
        const body = (await res.json().catch(() => null)) as
          | (DetailResponse & { error?: string })
          | null;
        if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
        if (cancelled) return;
        setData(body as DetailResponse);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load request");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [ticketId]);

  if (loading) return <LoadingSkeleton />;
  if (error)
    return (
      <div>
        <BackLink />
        <Callout tone="error" title="Couldn't load request">
          {error}
        </Callout>
      </div>
    );
  if (!data)
    return (
      <div>
        <BackLink />
        <Card>
          <EmptyState
            icon={<IconDocument width={28} height={28} />}
            title="Request not found"
            description="No record matched that id."
          />
        </Card>
      </div>
    );

  const { ticket, briefAssets, revisions, comments, assignmentLogs, auditLogs } = data;
  const status = STATUS_META[ticket.status] ?? { label: ticket.status, tone: "neutral" as Tone };
  const priority = PRIORITY[ticket.priority] ?? { label: ticket.priority, tone: "neutral" as Tone };
  const briefHasText = hasText(ticket.description);
  const tabPrefix = "ticket-detail";

  return (
    <div>
      <BackLink />

      {/* ---------------- Header card ---------------- */}
      <Card className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-sm font-semibold tabular-nums">{ticket.code}</span>
              <Badge tone={status.tone} dot>
                {status.label}
              </Badge>
              <Badge tone={priority.tone}>{priority.label} priority</Badge>
              {ticket.creativeMode === "AI" && <Badge tone="blue">AI</Badge>}
              {ticket.tags.map((t) => (
                <Badge key={t.id} tone="neutral">
                  {t.name}
                </Badge>
              ))}
            </div>
            <h1 className="mt-2 text-[32px] leading-10 font-bold tracking-tight break-words">
              {ticket.title}
            </h1>
            <p className="mt-1 text-sm text-[var(--av2-text-2)]">
              Created {formatDateTime(ticket.createdAt)}
              {ticket.dueDate ? <> · Due {formatDateTime(ticket.dueDate)}</> : null}
              {ticket.project ? (
                <>
                  {" "}
                  · Project {ticket.project.name}
                  {ticket.project.code ? ` (${ticket.project.code})` : ""}
                </>
              ) : null}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--av2-bg)] px-3 text-sm font-medium text-[var(--av2-text-2)]">
              <IconLock width={16} height={16} />
              Read-only view
            </span>
            <ButtonLink href="/admin/tickets" variant="secondary">
              Manage in request list
              <IconArrowUpRight />
            </ButtonLink>
          </div>
        </div>
      </Card>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px] xl:grid-rows-[auto_1fr]">
        {/* ---------------- Left column ---------------- */}
        <div className="min-w-0 space-y-6 xl:col-start-1 xl:row-start-1">
          <Card>
            <Tabs<TabKey>
              label="Request content"
              idPrefix={tabPrefix}
              value={tab}
              onChange={setTab}
              tabs={[
                { value: "brief", label: "Brief" },
                { value: "revisions", label: `Revisions (${revisions.length})` },
                { value: "comments", label: `Comments (${comments.length})` },
                { value: "activity", label: "Activity" },
              ]}
            />

            {/* Brief */}
            {tab === "brief" && (
              <TabPanel idPrefix={tabPrefix} value="brief">
                {!briefHasText && briefAssets.length === 0 ? (
                  <EmptyState
                    icon={<IconDocument width={28} height={28} />}
                    title="No brief provided"
                    description="There is no brief text or attachment on this request."
                  />
                ) : (
                  <div className="pt-6">
                    {briefHasText ? (
                      <div
                        className="text-base leading-7 break-words [&_a]:font-semibold [&_a]:text-[var(--av2-link)] [&_a]:underline [&_h1]:mb-2 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:font-semibold [&_li]:mb-1 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-6"
                        // The description is server-side sanitized at write time
                        // (see lib/sanitize.ts in the customer ticket flow); admins
                        // are read-only here so re-sanitizing would be overkill.
                        dangerouslySetInnerHTML={{ __html: ticket.description ?? "" }}
                      />
                    ) : (
                      <p className="text-sm text-[var(--av2-text-2)]">
                        No brief text — only attachments were provided.
                      </p>
                    )}

                    {briefAssets.length > 0 && (
                      <div className="mt-6 border-t border-[var(--av2-border)] pt-5">
                        <h3 className="text-base font-semibold">
                          Attachments{" "}
                          <span className="font-normal text-[var(--av2-text-2)]">
                            ({briefAssets.length})
                          </span>
                        </h3>
                        <ul className="mt-3 flex flex-wrap gap-3">
                          {briefAssets.map((a) => (
                            <AssetTile key={a.id} asset={a} size="sm" />
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </TabPanel>
            )}

            {/* Revisions */}
            {tab === "revisions" && (
              <TabPanel idPrefix={tabPrefix} value="revisions">
                {revisions.length === 0 ? (
                  <EmptyState
                    icon={<IconLayers width={28} height={28} />}
                    title="No revisions yet"
                    description="The creative hasn't submitted any work on this request."
                  />
                ) : (
                  <ol className="space-y-4 pt-6">
                    {revisions.map((r) => (
                      <li
                        key={r.id}
                        className="rounded-xl border border-[var(--av2-border)] bg-[var(--av2-bg)] p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone="lavender">v{r.version}</Badge>
                            {r.submittedByCreative && (
                              <span className="text-sm text-[var(--av2-text-2)]">
                                by{" "}
                                <Link
                                  href={`/admin/users/${r.submittedByCreative.id}`}
                                  className="font-medium text-[var(--av2-text)] hover:text-[var(--av2-link)] hover:underline"
                                >
                                  {r.submittedByCreative.email}
                                </Link>
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-[var(--av2-text-2)]">
                            Submitted {formatDateTime(r.submittedAt)}
                          </span>
                        </div>
                        {r.creativeMessage && (
                          <p className="mt-3 text-sm whitespace-pre-wrap">{r.creativeMessage}</p>
                        )}
                        {r.assets.length > 0 && (
                          <ul className="mt-3 flex flex-wrap gap-3">
                            {r.assets.map((a) => (
                              <AssetTile key={a.id} asset={a} size="md" />
                            ))}
                          </ul>
                        )}
                        {r.feedbackAt && (
                          <div className="mt-3 rounded-lg border-l-2 border-[var(--av2-accent)] bg-[var(--av2-surface)] px-3 py-2">
                            <p className="text-xs text-[var(--av2-text-2)]">
                              Feedback by {r.feedbackByCustomer?.email ?? "(unknown)"} ·{" "}
                              {formatDateTime(r.feedbackAt)}
                            </p>
                            {r.feedbackMessage && (
                              <p className="mt-1 text-sm whitespace-pre-wrap">
                                {r.feedbackMessage}
                              </p>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </TabPanel>
            )}

            {/* Comments */}
            {tab === "comments" && (
              <TabPanel idPrefix={tabPrefix} value="comments">
                {comments.length === 0 ? (
                  <EmptyState
                    icon={<IconChat width={28} height={28} />}
                    title="No comments yet"
                    description="Nobody has commented on this request."
                  />
                ) : (
                  <ul className="divide-y divide-[var(--av2-border)] pt-2">
                    {comments.map((c) => (
                      <li key={c.id} className="flex gap-3 py-4">
                        <Avatar
                          name={c.author.name || c.author.email}
                          tone={c.author.role === "DESIGNER" ? "green" : "lavender"}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm">
                            <Link
                              href={`/admin/users/${c.author.id}`}
                              className="font-semibold hover:text-[var(--av2-link)] hover:underline"
                            >
                              {c.author.email}
                            </Link>{" "}
                            <span className="text-[var(--av2-text-2)]">
                              {c.author.role ? `· ${ROLE_LABEL[c.author.role]} ` : ""}·{" "}
                              <time dateTime={c.createdAt} title={formatDateTime(c.createdAt)}>
                                {relativeTime(c.createdAt)}
                              </time>
                            </span>
                          </p>
                          <p className="mt-1 text-sm whitespace-pre-wrap">{c.body}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </TabPanel>
            )}

            {tab === "activity" && (
              <TabPanel idPrefix={tabPrefix} value="activity">
                <TicketActivityPanel url={`/api/admin/tickets/${ticketId}/activity`} />
              </TabPanel>
            )}
          </Card>

          <SourceFilesPanel ticketId={ticketId} viewer="admin" />
        </div>

        {/* ---------------- Ticket details ---------------- */}
        <Card as="div" className="xl:sticky xl:top-24 xl:col-start-2 xl:row-span-2 xl:row-start-1">
          <h2 className="mb-5 text-xl leading-7 font-semibold">Request details</h2>

          <div>
            <DetailBlock
              label="Customer"
              icon={
                <IconTile tone="lavender" round>
                  <IconBuilding />
                </IconTile>
              }
            >
              <p className="text-base font-semibold">{ticket.company.name}</p>
              <p className="mt-0.5 break-words text-[var(--av2-text-2)]">
                Created by{" "}
                <Link
                  href={`/admin/users/${ticket.createdBy.id}`}
                  className="hover:text-[var(--av2-link)] hover:underline"
                >
                  {ticket.createdBy.email}
                </Link>
              </p>
              <div className="mt-1.5">
                <TextLink href="/admin/companies">View companies</TextLink>
              </div>
            </DetailBlock>

            <DetailBlock
              label="Creative"
              icon={
                ticket.creative ? (
                  <Avatar
                    name={ticket.creative.name || ticket.creative.email}
                    size={48}
                    tone="green"
                  />
                ) : (
                  <IconTile tone="neutral" round>
                    <span className="text-sm font-semibold">{DASH}</span>
                  </IconTile>
                )
              }
            >
              {ticket.creative ? (
                <>
                  <p className="text-base font-semibold">
                    {ticket.creative.name || ticket.creative.email}
                  </p>
                  <p className="mt-0.5 break-words text-[var(--av2-text-2)]">
                    {ticket.creative.email}
                  </p>
                  <div className="mt-1.5">
                    <TextLink href={`/admin/users/${ticket.creative.id}`}>View creative</TextLink>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-base font-semibold">Unassigned</p>
                  <p className="mt-0.5 text-[var(--av2-text-2)]">
                    No creative on this request yet.
                  </p>
                </>
              )}
              {ticket.completedBy && (
                <p className="mt-2 text-[var(--av2-text-2)]">
                  Approved by {ticket.completedBy.email} · {formatDateTime(ticket.completedAt)}
                </p>
              )}
            </DetailBlock>

            <DetailBlock
              label="Token cost"
              icon={
                <IconTile tone="green" round>
                  <IconCoins />
                </IconTile>
              }
            >
              <p className="text-xl leading-7 font-semibold tabular-nums">
                {fmt(ticket.tokenCostEffective)}{" "}
                {plural(ticket.tokenCostEffective, "token", "tokens")}
              </p>
              <p className="mt-0.5 text-[var(--av2-text-2)]">
                Base cost: {fmt(ticket.tokenCostBase)}{" "}
                {plural(ticket.tokenCostBase, "token", "tokens")}
                {ticket.quantity > 1 ? ` (×${ticket.quantity})` : ""}
              </p>
              {(ticket.tokenCostOverride != null || ticket.creativePayoutOverride != null) && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {ticket.tokenCostOverride != null && (
                    <Badge tone="amber">Cost overridden by admin</Badge>
                  )}
                  {ticket.creativePayoutOverride != null && (
                    <Badge tone="amber">
                      Payout override: {fmt(ticket.creativePayoutOverride)}
                    </Badge>
                  )}
                </div>
              )}
            </DetailBlock>

            <DetailBlock
              label="Service"
              icon={
                <IconTile tone="peach" round>
                  <IconBriefcase />
                </IconTile>
              }
            >
              {ticket.jobType ? (
                <>
                  <p className="text-base font-semibold">{ticket.jobType.name}</p>
                  <p className="mt-0.5 text-[var(--av2-text-2)]">
                    List price {fmt(ticket.jobType.tokenCost)}{" "}
                    {plural(ticket.jobType.tokenCost, "token", "tokens")}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-base font-semibold">Not specified</p>
                  <p className="mt-0.5 text-[var(--av2-text-2)]">{DASH}</p>
                </>
              )}
            </DetailBlock>
          </div>

          <div className="mt-1 flex items-start gap-3 rounded-xl bg-[var(--av2-bg)] p-4 text-sm text-[var(--av2-text-2)]">
            <IconAlertCircle width={18} height={18} className="mt-0.5 shrink-0" />
            <p>
              This page is read-only. Manage assignment and pricing from the{" "}
              <Link
                href="/admin/tickets"
                className="font-semibold text-[var(--av2-link)] hover:underline"
              >
                request list
              </Link>
              .
            </p>
          </div>
        </Card>

        {/* ---------------- Activity ---------------- */}
        <Card className="min-w-0 xl:col-start-1 xl:row-start-2">
          <CardTitle description="Assignment decisions and admin actions recorded on this request.">
            Activity
          </CardTitle>
          <div className="mt-5">
            <PanelSection title="Assignment history">
              {assignmentLogs.length === 0 ? (
                <p className="text-sm text-[var(--av2-text-2)]">
                  No assignment changes have been logged.
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {assignmentLogs.map((log) => (
                    <li
                      key={log.id}
                      className="flex flex-wrap items-center gap-2 border-b border-[var(--av2-border)] pb-2 last:border-b-0 last:pb-0"
                    >
                      <Badge tone="neutral">{log.reason}</Badge>
                      {log.creative ? (
                        <span>→ {log.creative.email}</span>
                      ) : (
                        <span className="text-[var(--av2-text-2)]">unassigned</span>
                      )}
                      <span className="text-[var(--av2-text-2)]">
                        · {relativeTime(log.createdAt)}
                      </span>
                      {log.notes && <span className="text-[var(--av2-text-2)]">— {log.notes}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </PanelSection>
            <PanelSection
              title="Admin actions"
              action={
                <TextLink href={`/admin/audit-log?targetId=${ticket.id}`}>
                  View full audit log
                </TextLink>
              }
            >
              {auditLogs.length === 0 ? (
                <p className="text-sm text-[var(--av2-text-2)]">
                  No admin actions have been recorded on this request.
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {auditLogs.map((log) => (
                    <li
                      key={log.id}
                      className="flex flex-wrap items-center gap-2 border-b border-[var(--av2-border)] pb-2 last:border-b-0 last:pb-0"
                    >
                      <Badge tone={log.outcome === "SUCCESS" ? "green" : "neutral"}>
                        {log.outcome}
                      </Badge>
                      <code className="text-xs font-semibold">{log.action}</code>
                      <span className="text-[var(--av2-text-2)]">
                        by {log.actorEmail} ({ROLE_LABEL[log.actorRole] ?? log.actorRole}) ·{" "}
                        {relativeTime(log.createdAt)}
                      </span>
                      {log.errorMessage && (
                        <span className="text-[var(--av2-text-2)]">— {log.errorMessage}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </PanelSection>
          </div>
        </Card>
      </div>
    </div>
  );
}
