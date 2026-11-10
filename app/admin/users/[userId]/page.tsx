// -----------------------------------------------------------------------------
// @file: app/admin/users/[userId]/page.tsx
// @purpose: Single-user drill-down for SITE_ADMIN+. Loads everything an
//           operator might want to investigate one account in one screen —
//           identity, auth state, audit history, role-specific sections —
//           without triggering a half-dozen sub-fetches.
//
//           Edit actions still go through the existing PATCH on
//           /api/admin/users (role change, cap, working hours, revision
//           notes, hard-delete). This page is read-only context; "Manage
//           user" links back to the list view with this user's panel open.
//
//           Layout (admin design language v1): header card (avatar, name,
//           email, role + status badges) → tabs: Overview / Authentication /
//           role-specific (Workload + Profile for creatives, Companies for
//           customers) / Admin history.
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
  Button,
  ButtonLink,
  Callout,
  Card,
  CardTitle,
  DASH,
  EmptyState,
  IconTile,
  KeyValueList,
  Skeleton,
  TabPanel,
  Tabs,
  TextLink,
  fmt,
  plural,
  type Tone,
} from "@/components/admin/v2/ui";
import {
  IconArrowUpRight,
  IconBuilding,
  IconCoins,
  IconTicket,
  IconUsers,
} from "@/components/admin/v2/icons";
import { WorkScheduleSummary } from "@/components/work-schedule/work-schedule-summary";
import type { WorkSchedule } from "@/lib/work-schedule";

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
    workSchedule: WorkSchedule | null;
    workScheduleUpdatedAt: string | null;
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
    earnings: {
      totalEarned: number;
      totalWithdrawn: number;
      withdrawalCount: number;
      currentBalance?: number;
    };
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
      // Contact + personal info from the original application.
      whatsappNumber: string;
      country: string;
      applicationTimezone: string;
      portfolioUrl: string;
      linkedinUrl: string | null;
      socialLinks: unknown;
      totalYears: string;
      hasRemoteExp: boolean;
      yearsRemote: string | null;
      workedWith: unknown;
      tools: unknown;
      toolsOther: string | null;
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

type TabKey = "overview" | "auth" | "workload" | "profile" | "companies" | "history";

const ROLE_LABELS: Record<Role, string> = {
  SITE_OWNER: "Site Owner",
  SITE_ADMIN: "Site Admin",
  DESIGNER: "Creative",
  CUSTOMER: "Customer",
};

// Same tones the list page uses so badges read consistently across views.
const ROLE_TONES: Record<Role, Tone> = {
  SITE_OWNER: "amber",
  SITE_ADMIN: "blue",
  DESIGNER: "green",
  CUSTOMER: "lavender",
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
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function relativeTime(iso: string | null): string {
  if (!iso) return DASH;
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

/** Defensive read of a Prisma Json column we expect to contain an array
 *  of strings. Returns [] on any unexpected shape so the page never
 *  crashes on legacy / malformed rows. */
function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

/** socialLinks is stored as Json — historically as either a flat array
 *  of strings or an array of `{ platform, url }` objects depending on
 *  when the row was written. Normalize to `{ label, url }[]` for the
 *  render so admins always see a clean list. */
function readSocialLinks(value: unknown): { label: string; url: string }[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === "string") return { label: entry, url: entry };
      if (entry && typeof entry === "object") {
        const o = entry as Record<string, unknown>;
        const url = typeof o.url === "string" ? o.url : "";
        const label = typeof o.platform === "string" && o.platform.length > 0 ? o.platform : url;
        if (url) return { label, url };
      }
      return null;
    })
    .filter((v): v is { label: string; url: string } => v !== null);
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

const rating = (n: number | null) => (n == null ? DASH : `${n.toFixed(1)} / 5`);

// ---------------------------------------------------------------------------
// Page-local glyphs + building blocks
// ---------------------------------------------------------------------------

const svgBase = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function IconCopy(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...svgBase} {...p}>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </svg>
  );
}

function IconShield(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...svgBase} {...p}>
      <path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6l-7-3Z" />
    </svg>
  );
}

function IconHistory(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...svgBase} {...p}>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5M12 7v5l3 2" />
    </svg>
  );
}

function IconLock(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...svgBase} {...p}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

const BackLink = () => (
  <Link
    href="/admin/users"
    className="mb-4 inline-flex items-center gap-1.5 rounded text-sm font-medium text-[var(--av2-text-2)] hover:text-[var(--av2-text)] focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none"
  >
    <span aria-hidden>←</span> Back to users
  </Link>
);

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-semibold break-all text-[var(--av2-link)] hover:underline"
    >
      {children}
      <IconArrowUpRight className="shrink-0" />
    </a>
  );
}

/** Big-number stat with an icon tile (Account activity / Workload). */
function Stat({
  icon,
  tone,
  label,
  value,
  hint,
  link,
}: {
  icon: ReactNode;
  tone: Tone;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  link?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start gap-4">
      <IconTile tone={tone}>{icon}</IconTile>
      <div className="min-w-0">
        <p className="text-sm text-[var(--av2-text-2)]">{label}</p>
        <p className="mt-0.5 text-[32px] leading-10 font-bold tracking-tight tabular-nums">
          {value}
        </p>
        {hint && <p className="text-xs text-[var(--av2-text-2)]">{hint}</p>}
        {link && <div className="mt-1.5">{link}</div>}
      </div>
    </div>
  );
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const tone: Tone = outcome === "SUCCESS" ? "green" : outcome === "FAILURE" ? "red" : "neutral";
  const label = outcome.charAt(0) + outcome.slice(1).toLowerCase().replace(/_/g, " ");
  return <Badge tone={tone}>{label}</Badge>;
}

function TargetAuditList({ rows }: { rows: AuditTargetEntry[] }) {
  return (
    <ul className="divide-y divide-[var(--av2-border)]">
      {rows.map((row) => (
        <li key={row.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 text-sm">
          <OutcomeBadge outcome={row.outcome} />
          <code className="font-mono text-[13px] font-medium">{row.action}</code>
          <span className="text-[var(--av2-text-2)]">
            by {row.actorEmail} ({ROLE_LABELS[row.actorRole] ?? row.actorRole}) ·{" "}
            <time dateTime={row.createdAt} title={formatDateTime(row.createdAt)}>
              {relativeTime(row.createdAt)}
            </time>
          </span>
          {row.errorMessage && (
            <span className="w-full text-xs text-[var(--av2-error-text)]">{row.errorMessage}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function LoadingSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading user">
      <Skeleton className="mb-4 h-5 w-32" />
      <Skeleton className="mb-6 h-36 w-full rounded-2xl" />
      <Skeleton className="mb-6 h-10 w-96 max-w-full" />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
      <p className="sr-only" role="status">
        Loading user…
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminUserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("overview");
  const [copied, setCopied] = useState(false);

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

  if (loading) return <LoadingSkeleton />;
  if (error)
    return (
      <div>
        <BackLink />
        <Callout tone="error" title="Couldn't load user">
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
            icon={<IconUsers width={28} height={28} />}
            title="User not found"
            description="No record matched that id."
          />
        </Card>
      </div>
    );

  const { user, sessions, audit, designer, customer } = data;
  const isAdminRole = user.role === "SITE_OWNER" || user.role === "SITE_ADMIN";
  const tabPrefix = "user-detail";

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(user.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked — the id is still visible in the Identity card.
    }
  };

  const tabs: { value: TabKey; label: ReactNode }[] = [
    { value: "overview", label: "Overview" },
    { value: "auth", label: "Sessions & auth" },
  ];
  if (designer) {
    tabs.push({ value: "workload", label: "Workload" });
    if (designer.hiredFrom) tabs.push({ value: "profile", label: "Profile" });
  }
  if (customer) {
    tabs.push({ value: "companies", label: `Companies (${customer.memberships.length})` });
  }
  tabs.push({ value: "history", label: "Admin history" });

  // ---------------------------------------------------------------- cards

  const identityCard = (
    <Card>
      <CardTitle
        action={
          <Button size="sm" variant="ghost" onClick={copyId} aria-live="polite">
            <IconCopy width={16} height={16} />
            {copied ? "Copied" : "Copy user ID"}
          </Button>
        }
      >
        Identity
      </CardTitle>
      <div className="mt-5">
        <KeyValueList
          rows={[
            { label: "Name", value: user.name || DASH },
            { label: "Email", value: <span className="break-all">{user.email}</span> },
            {
              label: "Platform role",
              value: <Badge tone={ROLE_TONES[user.role]}>{ROLE_LABELS[user.role]}</Badge>,
            },
            {
              label: "User ID",
              value: (
                <code className="font-mono text-xs break-all text-[var(--av2-text-2)]">
                  {user.id}
                </code>
              ),
            },
            { label: "Timezone", value: user.timezone ?? "Not set" },
            ...(user.role === "DESIGNER"
              ? [
                  {
                    label: "Working hours",
                    value: (
                      <WorkScheduleSummary
                        schedule={user.workSchedule}
                        legacyNote={user.workingHours}
                        updatedAt={user.workScheduleUpdatedAt}
                      />
                    ),
                  },
                  {
                    label: "Open task cap",
                    value: user.tasksPerWeekCap == null ? "No cap" : fmt(user.tasksPerWeekCap),
                  },
                  {
                    label: "Revision notes",
                    value: user.creativeRevisionNotesEnabled ? "Allowed" : "Disabled",
                  },
                  ...(user.isPaused
                    ? [
                        {
                          label: "Paused",
                          value:
                            user.pauseType === "MANUAL"
                              ? "Manual (no expiry)"
                              : user.pauseExpiresAt
                                ? `Until ${formatDateTime(user.pauseExpiresAt)}`
                                : "Yes",
                        },
                      ]
                    : []),
                ]
              : []),
            { label: "Created", value: formatDateTime(user.createdAt) },
            { label: "Updated", value: formatDateTime(user.updatedAt) },
          ]}
        />
      </div>
    </Card>
  );

  const authRows = [
    { label: "Active sessions", value: fmt(sessions.activeCount) },
    {
      label: "Email verification",
      value: user.emailVerified ? (
        <Badge tone="green">Verified</Badge>
      ) : (
        <Badge tone="amber">Unverified</Badge>
      ),
    },
    {
      label: "Login two-factor",
      value: user.twoFactorEnabled ? <Badge tone="green">Enabled</Badge> : <Badge>Disabled</Badge>,
    },
    {
      label: "Money-action MFA",
      value: user.totpEnrolledAt
        ? `Enrolled ${formatDateTime(user.totpEnrolledAt)}`
        : "Not enrolled",
    },
  ];

  const authSummaryCard = (
    <Card>
      <CardTitle>Authentication</CardTitle>
      <div className="mt-5">
        <KeyValueList rows={authRows} />
      </div>
      <div className="mt-5 border-t border-[var(--av2-border)] pt-4">
        <button
          type="button"
          onClick={() => setTab("auth")}
          className="inline-flex items-center gap-1 rounded text-sm font-semibold text-[var(--av2-link)] hover:underline focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none"
        >
          View sessions &amp; auth
          <IconArrowUpRight />
        </button>
      </div>
    </Card>
  );

  const historyPreviewCard = (
    <Card>
      <CardTitle>Admin history</CardTitle>
      <div className="mt-3">
        {audit.asTarget.length === 0 ? (
          <p className="py-2 text-sm text-[var(--av2-text-2)]">
            No admin actions recorded on this account.
          </p>
        ) : (
          <TargetAuditList rows={audit.asTarget.slice(0, 3)} />
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {audit.asTarget.length > 3 && (
          <button
            type="button"
            onClick={() => setTab("history")}
            className="inline-flex items-center gap-1 rounded text-sm font-semibold text-[var(--av2-link)] hover:underline focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none"
          >
            Show all {audit.asTarget.length}
          </button>
        )}
        <TextLink href={`/admin/audit-log?targetId=${user.id}`}>View audit log</TextLink>
      </div>
    </Card>
  );

  // Role-specific "Account activity" summary on the overview.
  let activityCard: ReactNode = null;
  if (designer) {
    // Server-computed ledger balance; older responses fall back to the sum.
    const balance =
      designer.earnings.currentBalance ??
      designer.earnings.totalEarned - designer.earnings.totalWithdrawn;
    activityCard = (
      <Card>
        <CardTitle>Account activity</CardTitle>
        <div className="mt-5 grid gap-6 sm:grid-cols-2">
          <Stat
            icon={<IconTicket />}
            tone="peach"
            label="Active requests"
            value={fmt(designer.tickets.active)}
            hint={`${fmt(designer.tickets.completedThisWeek)} done this week`}
          />
          <Stat
            icon={<IconCoins />}
            tone="green"
            label="Token balance"
            value={fmt(balance)}
            hint={`${fmt(designer.earnings.totalEarned)} earned lifetime`}
          />
        </div>
      </Card>
    );
  } else if (customer) {
    activityCard = (
      <Card>
        <CardTitle>Account activity</CardTitle>
        <div className="mt-5 grid gap-6 sm:grid-cols-2 sm:divide-x sm:divide-[var(--av2-border)]">
          <Stat
            icon={<IconBuilding />}
            tone="peach"
            label="Companies"
            value={fmt(customer.memberships.length)}
            link={
              customer.memberships.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setTab("companies")}
                  className="inline-flex items-center gap-1 rounded text-sm font-semibold text-[var(--av2-link)] hover:underline focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none"
                >
                  View memberships
                  <IconArrowUpRight />
                </button>
              ) : undefined
            }
          />
          <div className="sm:pl-6">
            <Stat
              icon={<IconTicket />}
              tone="lavender"
              label="Requests created"
              value={fmt(customer.ticketsCreated)}
            />
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div>
      <BackLink />

      {/* ---------------- Header card ---------------- */}
      <Card className="mb-6">
        <div className="flex flex-wrap items-start gap-5">
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.image}
              alt=""
              className="h-20 w-20 shrink-0 rounded-full border border-[var(--av2-border)] object-cover"
            />
          ) : (
            <Avatar name={user.name || user.email} size={80} tone="neutral" />
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="mr-1 text-[32px] leading-10 font-bold tracking-tight break-words">
                {user.name || "(no name)"}
              </h1>
              <Badge tone={ROLE_TONES[user.role]}>{ROLE_LABELS[user.role]}</Badge>
              {user.deletedAt && <Badge tone="red">Deleted</Badge>}
              {user.role === "DESIGNER" && user.isPaused && <Badge tone="amber">Paused</Badge>}
              {!user.emailVerified && <Badge tone="amber">Email unverified</Badge>}
              {user.twoFactorEnabled && <Badge tone="green">Login 2FA</Badge>}
              {user.totpEnrolledAt && (
                <span title="MFA TOTP enrolled for money actions">
                  <Badge tone="green">MFA TOTP</Badge>
                </span>
              )}
            </div>
            <p className="mt-1 text-base break-all">{user.email}</p>
            <p className="mt-1 text-sm text-[var(--av2-text-2)]">
              Joined {formatDateTime(user.createdAt)} · Last activity{" "}
              {relativeTime(user.lastAuthActivityAt)}
              {user.timezone ? ` · ${user.timezone}` : ""}
            </p>
          </div>

          {!user.deletedAt && (
            <ButtonLink href={`/admin/users?user=${user.id}`} variant="secondary">
              Manage user
              <IconArrowUpRight />
            </ButtonLink>
          )}
        </div>
      </Card>

      {/* Soft-deleted banner */}
      {user.deletedAt && (
        <div className="mb-6">
          <Callout tone="warning" title="This account is deleted">
            The user&apos;s identity was anonymized on {formatDateTime(user.deletedAt)}. Requests,
            ledger entries, and audit rows they&apos;re attached to are preserved. They cannot sign
            in.
          </Callout>
        </div>
      )}

      <div className="mb-6">
        <Tabs<TabKey>
          label="User sections"
          idPrefix={tabPrefix}
          value={tab}
          onChange={setTab}
          tabs={tabs}
        />
      </div>

      {/* ---------------- Overview ---------------- */}
      {tab === "overview" && (
        <TabPanel idPrefix={tabPrefix} value="overview">
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="min-w-0 space-y-6">
              {identityCard}
              {activityCard}
            </div>
            <div className="min-w-0 space-y-6">
              {authSummaryCard}
              {historyPreviewCard}
            </div>
          </div>
        </TabPanel>
      )}

      {/* ---------------- Sessions & auth ---------------- */}
      {tab === "auth" && (
        <TabPanel idPrefix={tabPrefix} value="auth">
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <Card>
              <CardTitle description="Sign-in factors for this account.">Authentication</CardTitle>
              <div className="mt-5">
                <KeyValueList rows={authRows.slice(1)} />
              </div>
            </Card>
            <Card>
              <CardTitle description="Signed-in devices that haven't expired.">Sessions</CardTitle>
              <div className="mt-5 flex items-center gap-4">
                <IconTile tone="lavender">
                  <IconShield width={22} height={22} />
                </IconTile>
                <div>
                  <p className="text-sm text-[var(--av2-text-2)]">Active sessions</p>
                  <p className="text-[32px] leading-10 font-bold tracking-tight tabular-nums">
                    {fmt(sessions.activeCount)}
                  </p>
                </div>
              </div>
              <div className="mt-5 border-t border-[var(--av2-border)] pt-5">
                <h3 className="mb-3 text-base font-semibold">Most recent session</h3>
                {sessions.lastSession ? (
                  <KeyValueList
                    rows={[
                      {
                        label: "Device",
                        value: describeUserAgent(sessions.lastSession.userAgent),
                      },
                      {
                        label: "Last seen",
                        value: (
                          <span title={formatDateTime(sessions.lastSession.updatedAt)}>
                            {relativeTime(sessions.lastSession.updatedAt)}
                          </span>
                        ),
                      },
                      {
                        label: "Signed in",
                        value: formatDateTime(sessions.lastSession.createdAt),
                      },
                      {
                        label: "IP address",
                        value: sessions.lastSession.ipAddress ? (
                          <code className="font-mono text-xs">
                            {sessions.lastSession.ipAddress}
                          </code>
                        ) : (
                          DASH
                        ),
                      },
                    ]}
                  />
                ) : (
                  <p className="text-sm text-[var(--av2-text-2)]">
                    No sessions on record for this account.
                  </p>
                )}
              </div>
              <p className="mt-5 flex items-start gap-2 rounded-xl bg-[var(--av2-bg)] p-4 text-sm text-[var(--av2-text-2)]">
                <IconLock width={16} height={16} className="mt-0.5 shrink-0" />
                {user.lastAuthActivityAt
                  ? `Last auth activity ${relativeTime(user.lastAuthActivityAt)}.`
                  : "No auth activity recorded."}
              </p>
            </Card>
          </div>
        </TabPanel>
      )}

      {/* ---------------- Workload (creatives) ---------------- */}
      {tab === "workload" && designer && (
        <TabPanel idPrefix={tabPrefix} value="workload">
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <Card>
              <CardTitle>Workload &amp; requests</CardTitle>
              <div className="mt-5">
                <Stat
                  icon={<IconTicket />}
                  tone="peach"
                  label="Active requests"
                  value={fmt(designer.tickets.active)}
                />
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge>{fmt(designer.tickets.TODO)} backlog</Badge>
                  <Badge tone="lavender">{fmt(designer.tickets.IN_PROGRESS)} in progress</Badge>
                  <Badge tone="peach">{fmt(designer.tickets.IN_REVIEW)} in review</Badge>
                </div>
              </div>
              <div className="mt-5 border-t border-[var(--av2-border)] pt-5">
                <KeyValueList
                  rows={[
                    { label: "Done lifetime", value: fmt(designer.tickets.DONE) },
                    { label: "Done this week", value: fmt(designer.tickets.completedThisWeek) },
                    {
                      label: "Open task cap",
                      value: user.tasksPerWeekCap == null ? "No cap" : fmt(user.tasksPerWeekCap),
                    },
                  ]}
                />
              </div>
            </Card>

            <Card>
              <CardTitle>Earnings</CardTitle>
              <div className="mt-5">
                <Stat
                  icon={<IconCoins />}
                  tone="green"
                  label="Current balance"
                  value={fmt(
                    designer.earnings.currentBalance ??
                      designer.earnings.totalEarned - designer.earnings.totalWithdrawn,
                  )}
                  hint="tokens"
                />
              </div>
              <div className="mt-5 border-t border-[var(--av2-border)] pt-5">
                <KeyValueList
                  rows={[
                    {
                      label: "Total earned",
                      value: `${fmt(designer.earnings.totalEarned)} tokens`,
                    },
                    {
                      label: "Total withdrawn",
                      value: `${fmt(designer.earnings.totalWithdrawn)} tokens`,
                    },
                    { label: "Withdrawals", value: fmt(designer.earnings.withdrawalCount) },
                  ]}
                />
              </div>
            </Card>

            <Card>
              <CardTitle
                description={`${fmt(designer.skills.length)} ${plural(designer.skills.length, "service", "services")}`}
              >
                Skills
              </CardTitle>
              <div className="mt-4">
                {designer.skills.length === 0 ? (
                  <p className="text-sm text-[var(--av2-text-2)]">
                    No skills assigned yet. Auto-assign won&apos;t route any requests to this
                    creative until at least one CreativeSkill is added.
                  </p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {designer.skills.map((s) => (
                      <li key={s.jobTypeId}>
                        <Badge>{s.jobTypeName}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>

            <Card>
              <CardTitle
                description={
                  designer.ratings.count > 0
                    ? `${fmt(designer.ratings.count)} ${plural(designer.ratings.count, "response", "responses")}`
                    : undefined
                }
              >
                Customer ratings
              </CardTitle>
              <div className="mt-4">
                {designer.ratings.count === 0 ? (
                  <p className="text-sm text-[var(--av2-text-2)]">No ratings yet.</p>
                ) : (
                  <dl className="grid grid-cols-3 divide-x divide-[var(--av2-border)]">
                    {[
                      { label: "Quality", value: designer.ratings.quality },
                      { label: "Communication", value: designer.ratings.communication },
                      { label: "Speed", value: designer.ratings.speed },
                    ].map((r) => (
                      <div key={r.label} className="px-4 first:pl-0">
                        <dt className="text-sm text-[var(--av2-text-2)]">{r.label}</dt>
                        <dd className="mt-1 text-2xl leading-8 font-bold tabular-nums">
                          {rating(r.value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            </Card>
          </div>
        </TabPanel>
      )}

      {/* ---------------- Profile (hired creatives) ---------------- */}
      {tab === "profile" && designer?.hiredFrom && (
        <TabPanel idPrefix={tabPrefix} value="profile">
          {(() => {
            const h = designer.hiredFrom;
            const socials = readSocialLinks(h.socialLinks);
            const worked = readStringArray(h.workedWith);
            const tools = readStringArray(h.tools);
            return (
              <div className="grid items-start gap-6 lg:grid-cols-2">
                <Card>
                  <CardTitle>Contact</CardTitle>
                  <div className="mt-5">
                    <KeyValueList
                      rows={[
                        {
                          label: "WhatsApp",
                          value: h.whatsappNumber ? (
                            <ExternalLink
                              href={`https://wa.me/${h.whatsappNumber.replace(/[^0-9]/g, "")}`}
                            >
                              {h.whatsappNumber}
                            </ExternalLink>
                          ) : (
                            DASH
                          ),
                        },
                        { label: "Country", value: h.country || DASH },
                        {
                          label: "Timezone (at apply)",
                          value: (
                            <>
                              {h.applicationTimezone || DASH}
                              {user.timezone && user.timezone !== h.applicationTimezone && (
                                <span className="ml-1.5 font-normal text-[var(--av2-text-2)]">
                                  (now: {user.timezone})
                                </span>
                              )}
                            </>
                          ),
                        },
                        {
                          label: "Portfolio",
                          value: h.portfolioUrl ? (
                            <ExternalLink href={h.portfolioUrl}>{h.portfolioUrl}</ExternalLink>
                          ) : (
                            DASH
                          ),
                        },
                        {
                          label: "LinkedIn",
                          value: h.linkedinUrl ? (
                            <ExternalLink href={h.linkedinUrl}>{h.linkedinUrl}</ExternalLink>
                          ) : (
                            DASH
                          ),
                        },
                        ...(socials.length > 0
                          ? [
                              {
                                label: "Other links",
                                value: (
                                  <ul className="flex flex-col gap-1">
                                    {socials.map((s) => (
                                      <li key={s.url}>
                                        <ExternalLink href={s.url}>{s.label}</ExternalLink>
                                      </li>
                                    ))}
                                  </ul>
                                ),
                              },
                            ]
                          : []),
                      ]}
                    />
                  </div>
                </Card>

                <Card>
                  <CardTitle>Background</CardTitle>
                  <div className="mt-5">
                    <KeyValueList
                      rows={[
                        { label: "Years experience", value: h.totalYears || DASH },
                        {
                          label: "Remote experience",
                          value: h.hasRemoteExp
                            ? h.yearsRemote
                              ? `Yes · ${h.yearsRemote}`
                              : "Yes"
                            : "No",
                        },
                        ...(worked.length > 0
                          ? [{ label: "Worked with", value: worked.join(" · ") }]
                          : []),
                        ...(tools.length > 0 || h.toolsOther
                          ? [
                              {
                                label: "Tools",
                                value: `${tools.join(" · ")}${
                                  h.toolsOther
                                    ? `${tools.length > 0 ? " · " : ""}Other: ${h.toolsOther}`
                                    : ""
                                }`,
                              },
                            ]
                          : []),
                      ]}
                    />
                  </div>
                </Card>

                <Card className="lg:col-span-2">
                  <CardTitle
                    action={<TextLink href="/admin/talent-applications">Applications</TextLink>}
                  >
                    Hired through talent application
                  </CardTitle>
                  <div className="mt-5 max-w-3xl">
                    <KeyValueList
                      rows={[
                        { label: "Application name", value: h.fullName },
                        { label: "Hired at", value: formatDateTime(h.hiredAt) },
                        { label: "Hired by", value: h.hiredByUserEmail ?? DASH },
                        {
                          label: "Applied workload",
                          value: `${h.workload}${
                            h.preferredTasksPerWeek ? ` · ${h.preferredTasksPerWeek} tasks/wk` : ""
                          }`,
                        },
                        ...(h.hireNotes
                          ? [
                              {
                                label: "Hire notes",
                                value: (
                                  <span className="font-normal whitespace-pre-wrap">
                                    {h.hireNotes}
                                  </span>
                                ),
                              },
                            ]
                          : []),
                        {
                          label: "Application id",
                          value: (
                            <code className="font-mono text-xs break-all text-[var(--av2-text-2)]">
                              {h.applicationId}
                            </code>
                          ),
                        },
                      ]}
                    />
                  </div>
                </Card>
              </div>
            );
          })()}
        </TabPanel>
      )}

      {/* ---------------- Companies (customers) ---------------- */}
      {tab === "companies" && customer && (
        <TabPanel idPrefix={tabPrefix} value="companies">
          <Card>
            <CardTitle
              description={`${fmt(customer.ticketsCreated)} ${plural(customer.ticketsCreated, "request", "requests")} created across all companies`}
            >
              Company memberships
            </CardTitle>
            {customer.memberships.length === 0 ? (
              <EmptyState
                icon={<IconBuilding width={28} height={28} />}
                title="No company memberships"
                description="This customer isn't a member of any company workspace."
              />
            ) : (
              <ul className="mt-5 divide-y divide-[var(--av2-border)] border-t border-[var(--av2-border)]">
                {customer.memberships.map((m) => (
                  <li key={m.company.id} className="flex flex-wrap items-start gap-4 py-4">
                    <IconTile tone="lavender" size={44}>
                      <span className="text-lg font-bold" aria-hidden>
                        {m.company.name.trim().charAt(0).toUpperCase() || "?"}
                      </span>
                    </IconTile>
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold">
                        <Link
                          href={`/admin/companies/${m.company.id}`}
                          className="hover:text-[var(--av2-link)] hover:underline"
                        >
                          {m.company.name}
                        </Link>
                      </p>
                      <p className="mt-0.5 text-sm text-[var(--av2-text-2)]">
                        {m.roleInCompany} · Joined {formatDateTime(m.joinedAt)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {m.company.plan ? (
                          <Badge tone="lavender">
                            {m.company.plan.name} · {fmt(m.company.plan.monthlyTokens)} tokens/mo
                          </Badge>
                        ) : (
                          <Badge>No plan</Badge>
                        )}
                        {m.company.billingStatus && <Badge>{m.company.billingStatus}</Badge>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl leading-7 font-bold tabular-nums">
                        {fmt(m.company.tokenBalance)}
                      </p>
                      <p className="text-xs text-[var(--av2-text-2)]">tokens</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabPanel>
      )}

      {/* ---------------- Admin history ---------------- */}
      {tab === "history" && (
        <TabPanel idPrefix={tabPrefix} value="history">
          <div className="space-y-6">
            <Card>
              <CardTitle
                description="The most recent admin actions where this account was the target."
                action={
                  <TextLink href={`/admin/audit-log?targetId=${user.id}`}>Full audit log</TextLink>
                }
              >
                Actions on this user
              </CardTitle>
              <div className="mt-4">
                {audit.asTarget.length === 0 ? (
                  <EmptyState
                    icon={<IconHistory width={28} height={28} />}
                    title="No admin actions yet"
                    description="No admin actions have been recorded on this account."
                  />
                ) : (
                  <TargetAuditList rows={audit.asTarget} />
                )}
              </div>
            </Card>

            {/* Actions THIS user performed (admin/owner only) */}
            {isAdminRole && (
              <Card>
                <CardTitle description="The most recent admin actions this account performed.">
                  Actions by this user
                </CardTitle>
                <div className="mt-4">
                  {audit.asActor.length === 0 ? (
                    <p className="py-2 text-sm text-[var(--av2-text-2)]">
                      No admin actions on record yet.
                    </p>
                  ) : (
                    <ul className="divide-y divide-[var(--av2-border)]">
                      {audit.asActor.map((row) => (
                        <li
                          key={row.id}
                          className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 text-sm"
                        >
                          <OutcomeBadge outcome={row.outcome} />
                          <code className="font-mono text-[13px] font-medium">{row.action}</code>
                          {row.targetType && (
                            <span className="text-[var(--av2-text-2)]">on {row.targetType}</span>
                          )}
                          <span className="text-[var(--av2-text-2)]">
                            ·{" "}
                            <time dateTime={row.createdAt} title={formatDateTime(row.createdAt)}>
                              {relativeTime(row.createdAt)}
                            </time>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Card>
            )}
          </div>
        </TabPanel>
      )}

      {/* Read-only note */}
      {!user.deletedAt && (
        <p className="mt-6 flex items-center gap-2 text-sm text-[var(--av2-text-2)]">
          <IconLock width={16} height={16} className="shrink-0" />
          <span>
            This profile is read-only. Change roles and creative settings from{" "}
            <Link
              href={`/admin/users?user=${user.id}`}
              className="font-semibold text-[var(--av2-link)] hover:underline"
            >
              Manage user
            </Link>
            .
          </span>
        </p>
      )}
    </div>
  );
}
