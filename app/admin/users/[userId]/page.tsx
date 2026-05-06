// -----------------------------------------------------------------------------
// @file: app/admin/users/[userId]/page.tsx
// @purpose: Single-user drill-down for SITE_ADMIN+. Loads everything an
//           operator might want to investigate one account in one screen —
//           identity, auth state, audit history, role-specific sections —
//           without triggering a half-dozen sub-fetches.
//
//           Edit actions still go through the existing PATCH on
//           /api/admin/users (role change, cap, working hours, revision
//           notes, hard-delete). This page is read-only context; we link
//           back to the list view for the inline editors.
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import { LoadingState } from "@/components/ui/loading-state";

// ---------------------------------------------------------------------------
// Types — kept narrow so the page compiles without leaking server-only types
// ---------------------------------------------------------------------------

type Role = "SITE_OWNER" | "SITE_ADMIN" | "DESIGNER" | "CUSTOMER";

type AuditEntry = {
  id: string;
  action: string;
  outcome: string;
  createdAt: string;
};

type AuditTargetEntry = AuditEntry & {
  actorEmail: string;
  actorRole: Role;
  metadata: unknown;
  errorMessage: string | null;
};

type AuditActorEntry = AuditEntry & {
  targetType: string | null;
  targetId: string | null;
  metadata: unknown;
};

type DetailResponse = {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: Role;
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
    timezone: string | null;
    workingHours: string | null;
    tasksPerWeekCap: number | null;
    creativeRevisionNotesEnabled: boolean;
    isPaused: boolean;
    pausedAt: string | null;
    pauseExpiresAt: string | null;
    pauseType: string | null;
    totpEnrolledAt: string | null;
    image: string | null;
    emailVerified: boolean;
    twoFactorEnabled: boolean;
    lastAuthActivityAt: string | null;
  };
  sessions: {
    activeCount: number;
    lastSession: {
      ipAddress: string | null;
      userAgent: string | null;
      updatedAt: string;
      createdAt: string;
    } | null;
  };
  audit: {
    asTarget: AuditTargetEntry[];
    asActor: AuditActorEntry[];
  };
  designer: {
    tickets: {
      TODO: number;
      IN_PROGRESS: number;
      IN_REVIEW: number;
      DONE: number;
      active: number;
      completedThisWeek: number;
    };
    skills: { jobTypeId: string; jobTypeName: string; categoryId: string }[];
    earnings: { totalEarned: number; totalWithdrawn: number; withdrawalCount: number };
    ratings: {
      count: number;
      quality: number | null;
      communication: number | null;
      speed: number | null;
    };
    hiredFrom: {
      applicationId: string;
      fullName: string;
      hiredAt: string | null;
      hiredByUserEmail: string | null;
      hireNotes: string | null;
      workload: string;
      preferredTasksPerWeek: string | null;
    } | null;
  } | null;
  customer: {
    ticketsCreated: number;
    memberships: {
      roleInCompany: string;
      joinedAt: string;
      company: {
        id: string;
        name: string;
        slug: string;
        tokenBalance: number;
        billingStatus: string | null;
        plan: { id: string; name: string; monthlyTokens: number } | null;
      };
    }[];
  } | null;
};

const ROLE_LABELS: Record<Role, string> = {
  SITE_OWNER: "Site Owner",
  SITE_ADMIN: "Site Admin",
  DESIGNER: "Creative",
  CUSTOMER: "Customer",
};

// Mirror the colors the list page uses so badges read consistently across
// the two views.
const ROLE_BADGE_VARIANTS: Record<Role, "warning" | "primary" | "info" | "neutral"> = {
  SITE_OWNER: "warning",
  SITE_ADMIN: "primary",
  DESIGNER: "info",
  CUSTOMER: "neutral",
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - then);
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
  const yr = Math.round(mo / 12);
  return `${yr} yr ago`;
}

// Same simple parser the active-sessions section uses on /profile.
function describeUserAgent(ua: string | null): string {
  if (!ua) return "Unknown device";
  let browser = "Browser";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/OPR\//.test(ua)) browser = "Opera";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua)) browser = "Safari";
  let os = "Unknown";
  if (/Windows NT/.test(ua)) os = "Windows";
  else if (/Mac OS X/.test(ua)) os = "macOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/.test(ua)) os = "iOS";
  else if (/Linux/.test(ua)) os = "Linux";
  return `${browser} on ${os}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminUserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/users/${userId}`, { cache: "no-store" });
        const body = (await res.json().catch(() => null)) as
          | (DetailResponse & { error?: string })
          | null;
        if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
        if (cancelled) return;
        setData(body as DetailResponse);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load user");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) return <LoadingState message="Loading user…" />;
  if (error)
    return (
      <InlineAlert variant="error" title="Couldn't load user">
        {error}
      </InlineAlert>
    );
  if (!data) return <EmptyState title="User not found" description="No record matched that id." />;

  const { user, sessions, audit, designer, customer } = data;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Top breadcrumb / back link */}
      <div className="flex items-center gap-2 text-xs text-[var(--bb-text-muted)]">
        <Link href="/admin/users" className="hover:text-[var(--bb-secondary)]">
          ← All users
        </Link>
        <span>·</span>
        <span>User profile</span>
      </div>

      {/* Header — identity card */}
      <section className="flex flex-wrap items-start gap-5 rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)] p-6">
        <div
          className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--bb-bg-page)] text-2xl font-semibold text-[var(--bb-text-secondary)] ring-1 ring-[var(--bb-border)]"
          aria-hidden="true"
        >
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.image} alt="" className="h-full w-full object-cover" />
          ) : (
            <span>{(user.name || user.email)[0]?.toUpperCase() ?? "?"}</span>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-[var(--bb-secondary)]">
              {user.name || "(no name)"}
            </h1>
            <Badge variant={ROLE_BADGE_VARIANTS[user.role]}>{ROLE_LABELS[user.role]}</Badge>
            {user.deletedAt && <Badge variant="neutral">Deleted</Badge>}
            {user.role === "DESIGNER" && user.isPaused && <Badge variant="warning">Paused</Badge>}
            {!user.emailVerified && <Badge variant="warning">Email unverified</Badge>}
            {user.twoFactorEnabled && <Badge variant="success">Login 2FA</Badge>}
            {user.totpEnrolledAt && (
              <Badge variant="success" title="MFA TOTP enrolled for money actions">
                MFA TOTP
              </Badge>
            )}
          </div>
          <p className="text-sm break-all text-[var(--bb-text-secondary)]">{user.email}</p>
          <p className="text-xs text-[var(--bb-text-muted)]">
            Joined {formatDateTime(user.createdAt)} · Last activity{" "}
            {relativeTime(user.lastAuthActivityAt)}
            {user.timezone ? ` · ${user.timezone}` : ""}
          </p>
        </div>

        <div className="shrink-0">
          <Link href="/admin/users">
            <Button variant="secondary" size="sm">
              Edit on /admin/users
            </Button>
          </Link>
        </div>
      </section>

      {/* Soft-deleted banner */}
      {user.deletedAt && (
        <InlineAlert variant="warning" title="This account is deleted">
          The user&apos;s identity was anonymized on {formatDateTime(user.deletedAt)}. Tickets,
          ledger entries, and audit rows they&apos;re attached to are preserved. They cannot sign
          in.
        </InlineAlert>
      )}

      {/* Two-column grid for the main sections */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Auth + sessions */}
        <section className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)] p-5">
          <h2 className="mb-3 text-sm font-semibold text-[var(--bb-secondary)]">Auth & sessions</h2>
          <dl className="space-y-1.5 text-xs">
            <Row label="Active sessions">
              <span className="font-medium text-[var(--bb-secondary)]">{sessions.activeCount}</span>
            </Row>
            <Row label="Email verified">{user.emailVerified ? "Yes" : "No"}</Row>
            <Row label="Login 2FA">{user.twoFactorEnabled ? "Enabled" : "Disabled"}</Row>
            <Row label="Money-action MFA">
              {user.totpEnrolledAt
                ? `Enrolled ${formatDateTime(user.totpEnrolledAt)}`
                : "Not enrolled"}
            </Row>
            {sessions.lastSession && (
              <>
                <Row label="Last device">{describeUserAgent(sessions.lastSession.userAgent)}</Row>
                <Row label="Last seen">{relativeTime(sessions.lastSession.updatedAt)}</Row>
              </>
            )}
          </dl>
        </section>

        {/* Identity quick-reference */}
        <section className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)] p-5">
          <h2 className="mb-3 text-sm font-semibold text-[var(--bb-secondary)]">Identity</h2>
          <dl className="space-y-1.5 text-xs">
            <Row label="User id">
              <code className="text-[10px] break-all text-[var(--bb-text-muted)]">{user.id}</code>
            </Row>
            <Row label="Timezone">{user.timezone ?? "—"}</Row>
            {user.role === "DESIGNER" && (
              <>
                <Row label="Working hours">{user.workingHours ?? "—"}</Row>
                <Row label="Concurrent task cap">
                  {user.tasksPerWeekCap == null ? "No cap" : user.tasksPerWeekCap}
                </Row>
                <Row label="Revision notes">
                  {user.creativeRevisionNotesEnabled ? "Allowed" : "Disabled"}
                </Row>
                {user.isPaused && (
                  <Row label="Paused">
                    {user.pauseType === "MANUAL"
                      ? "Manual (no expiry)"
                      : user.pauseExpiresAt
                        ? `Until ${formatDateTime(user.pauseExpiresAt)}`
                        : "Yes"}
                  </Row>
                )}
              </>
            )}
            <Row label="Created">{formatDateTime(user.createdAt)}</Row>
            <Row label="Updated">{formatDateTime(user.updatedAt)}</Row>
          </dl>
        </section>
      </div>

      {/* Designer-only sections */}
      {designer && (
        <>
          <div className="grid gap-6 md:grid-cols-2">
            <section className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)] p-5">
              <h2 className="mb-3 text-sm font-semibold text-[var(--bb-secondary)]">
                Workload &amp; tickets
              </h2>
              <dl className="space-y-1.5 text-xs">
                <Row label="Active">
                  <span className="font-medium text-[var(--bb-secondary)]">
                    {designer.tickets.active}
                  </span>{" "}
                  <span className="text-[var(--bb-text-muted)]">
                    ({designer.tickets.TODO} TODO / {designer.tickets.IN_PROGRESS} IP /{" "}
                    {designer.tickets.IN_REVIEW} IR)
                  </span>
                </Row>
                <Row label="Done lifetime">{designer.tickets.DONE}</Row>
                <Row label="Done this week">{designer.tickets.completedThisWeek}</Row>
                <Row label="Cap">
                  {user.tasksPerWeekCap == null ? "No cap" : user.tasksPerWeekCap}
                </Row>
              </dl>
            </section>

            <section className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)] p-5">
              <h2 className="mb-3 text-sm font-semibold text-[var(--bb-secondary)]">Earnings</h2>
              <dl className="space-y-1.5 text-xs">
                <Row label="Total earned">
                  {designer.earnings.totalEarned.toLocaleString()} tokens
                </Row>
                <Row label="Total withdrawn">
                  {designer.earnings.totalWithdrawn.toLocaleString()} tokens
                </Row>
                <Row label="Withdrawals">{designer.earnings.withdrawalCount}</Row>
                <Row label="Current balance">
                  <span className="font-medium text-[var(--bb-secondary)]">
                    {(
                      designer.earnings.totalEarned - designer.earnings.totalWithdrawn
                    ).toLocaleString()}{" "}
                    tokens
                  </span>
                </Row>
              </dl>
            </section>
          </div>

          <section className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)] p-5">
            <h2 className="mb-3 text-sm font-semibold text-[var(--bb-secondary)]">
              Skills · {designer.skills.length} job type
              {designer.skills.length === 1 ? "" : "s"}
            </h2>
            {designer.skills.length === 0 ? (
              <p className="text-xs text-[var(--bb-text-muted)]">
                No skills assigned yet. Auto-assign won&apos;t route any tickets to this creative
                until at least one CreativeSkill is added.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {designer.skills.map((s) => (
                  <li key={s.jobTypeId}>
                    <span className="inline-block rounded-full border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-2.5 py-0.5 text-[11px] text-[var(--bb-text-secondary)]">
                      {s.jobTypeName}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {designer.ratings.count > 0 && (
            <section className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)] p-5">
              <h2 className="mb-3 text-sm font-semibold text-[var(--bb-secondary)]">
                Customer ratings · {designer.ratings.count} response
                {designer.ratings.count === 1 ? "" : "s"}
              </h2>
              <dl className="grid gap-2 text-xs sm:grid-cols-3">
                <Row label="Quality">{designer.ratings.quality?.toFixed(1) ?? "—"} / 5</Row>
                <Row label="Communication">
                  {designer.ratings.communication?.toFixed(1) ?? "—"} / 5
                </Row>
                <Row label="Speed">{designer.ratings.speed?.toFixed(1) ?? "—"} / 5</Row>
              </dl>
            </section>
          )}

          {designer.hiredFrom && (
            <section className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)] p-5">
              <h2 className="mb-3 text-sm font-semibold text-[var(--bb-secondary)]">
                Hired through talent application
              </h2>
              <dl className="space-y-1.5 text-xs">
                <Row label="Application name">{designer.hiredFrom.fullName}</Row>
                <Row label="Hired at">{formatDateTime(designer.hiredFrom.hiredAt)}</Row>
                <Row label="Hired by">{designer.hiredFrom.hiredByUserEmail ?? "—"}</Row>
                <Row label="Applied workload">
                  {designer.hiredFrom.workload}
                  {designer.hiredFrom.preferredTasksPerWeek
                    ? ` · ${designer.hiredFrom.preferredTasksPerWeek} tasks/wk`
                    : ""}
                </Row>
                {designer.hiredFrom.hireNotes && (
                  <Row label="Hire notes">
                    <span className="whitespace-pre-wrap">{designer.hiredFrom.hireNotes}</span>
                  </Row>
                )}
                <Row label="Application id">
                  <Link
                    href={`/admin/talent-applications`}
                    className="text-[var(--bb-primary)] hover:underline"
                  >
                    {designer.hiredFrom.applicationId} ↗
                  </Link>
                </Row>
              </dl>
            </section>
          )}
        </>
      )}

      {/* Customer-only sections */}
      {customer && (
        <>
          <section className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)] p-5">
            <h2 className="mb-3 text-sm font-semibold text-[var(--bb-secondary)]">
              Tickets created
            </h2>
            <p className="text-xs text-[var(--bb-text-secondary)]">
              <span className="font-medium text-[var(--bb-secondary)]">
                {customer.ticketsCreated}
              </span>{" "}
              total
            </p>
          </section>

          <section className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)] p-5">
            <h2 className="mb-3 text-sm font-semibold text-[var(--bb-secondary)]">
              Companies · {customer.memberships.length}
            </h2>
            {customer.memberships.length === 0 ? (
              <p className="text-xs text-[var(--bb-text-muted)]">No company memberships.</p>
            ) : (
              <ul className="space-y-2">
                {customer.memberships.map((m) => (
                  <li
                    key={m.company.id}
                    className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-[var(--bb-border-subtle)] bg-[var(--bb-bg-page)] p-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-[var(--bb-secondary)]">
                        <Link href={`/admin/companies/${m.company.id}`} className="hover:underline">
                          {m.company.name}
                        </Link>
                      </p>
                      <p className="text-[11px] text-[var(--bb-text-muted)]">
                        Role: {m.roleInCompany} · Joined {formatDateTime(m.joinedAt)}
                      </p>
                      {m.company.plan && (
                        <p className="text-[11px] text-[var(--bb-text-muted)]">
                          Plan: {m.company.plan.name} (
                          {m.company.plan.monthlyTokens.toLocaleString()} tokens/mo)
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-[var(--bb-secondary)]">
                        {m.company.tokenBalance.toLocaleString()} tokens
                      </p>
                      {m.company.billingStatus && (
                        <p className="text-[11px] text-[var(--bb-text-muted)]">
                          {m.company.billingStatus}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {/* Audit — actions performed ON this user */}
      <section className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)] p-5">
        <h2 className="mb-3 text-sm font-semibold text-[var(--bb-secondary)]">
          Recent admin actions on this user
        </h2>
        {audit.asTarget.length === 0 ? (
          <p className="text-xs text-[var(--bb-text-muted)]">
            No admin actions recorded on this account.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--bb-border-subtle)]">
            {audit.asTarget.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-2 py-2 text-xs">
                <Badge variant={row.outcome === "SUCCESS" ? "success" : "neutral"}>
                  {row.outcome}
                </Badge>
                <code className="text-[11px] text-[var(--bb-secondary)]">{row.action}</code>
                <span className="text-[var(--bb-text-muted)]">
                  by {row.actorEmail} ({row.actorRole}) · {relativeTime(row.createdAt)}
                </span>
                {row.errorMessage && (
                  <span className="text-[var(--bb-text-muted)]">— {row.errorMessage}</span>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[11px] text-[var(--bb-text-muted)]">
          <Link
            href={`/admin/audit-log?targetId=${user.id}`}
            className="text-[var(--bb-primary)] hover:underline"
          >
            View full audit log for this user ↗
          </Link>
        </p>
      </section>

      {/* Audit — actions THIS user performed (admin/owner only) */}
      {(user.role === "SITE_OWNER" || user.role === "SITE_ADMIN") && (
        <section className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)] p-5">
          <h2 className="mb-3 text-sm font-semibold text-[var(--bb-secondary)]">
            Recent actions this user performed
          </h2>
          {audit.asActor.length === 0 ? (
            <p className="text-xs text-[var(--bb-text-muted)]">No admin actions on record yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--bb-border-subtle)]">
              {audit.asActor.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center gap-2 py-2 text-xs">
                  <Badge variant={row.outcome === "SUCCESS" ? "success" : "neutral"}>
                    {row.outcome}
                  </Badge>
                  <code className="text-[11px] text-[var(--bb-secondary)]">{row.action}</code>
                  {row.targetType && (
                    <span className="text-[var(--bb-text-muted)]">on {row.targetType}</span>
                  )}
                  <span className="text-[var(--bb-text-muted)]">
                    · {relativeTime(row.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tiny helper component for the dl/dt/dd label pattern used throughout
// ---------------------------------------------------------------------------

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <dt className="min-w-[120px] text-[var(--bb-text-muted)]">{label}</dt>
      <dd className="flex-1 break-words text-[var(--bb-text-secondary)]">{children}</dd>
    </div>
  );
}
