// -----------------------------------------------------------------------------
// @file: app/admin/talent-applications/page.tsx
// @purpose: Admin queue for the talent application form. Stage chips + list
//           on the left, detail panel of the selected candidate on the
//           right. The panel footer holds only the actions valid for the
//           candidate's current status:
//             - Accept (offer 3 interview slots → candidate books one; the
//               Google Calendar event with Meet is created on booking and the
//               candidate gets the branded follow-up email)
//             - Confirm a candidate-proposed time, mark held / no-show,
//               hire, onboard
//             - Decline (optional reason, sends the polite rejection)
//
//           Visible to SITE_ADMIN (the owner-only note explains the action
//           is restricted) but actions are SITE_OWNER-only — the API layer
//           enforces the gate via canManageTalentApplications.
// @version: v2.0.0
// @lastUpdate: 2026-11-01
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  Avatar,
  Badge,
  Button,
  Callout,
  Card,
  DASH,
  DetailPanel,
  EmptyState,
  Field,
  FilterBar,
  FilterChips,
  KeyValueList,
  PageHeader,
  PanelSection,
  SearchInput,
  Select,
  Skeleton,
  SplitView,
  Table,
  TableFooter,
  TabPanel,
  Tabs,
  Td,
  TextArea,
  TextInput,
  TextLink,
  Th,
  Tr,
  fmt,
  plural,
  type Tone,
} from "@/components/admin/v2/ui";
import { useToast } from "@/components/ui/toast-provider";
import { useSessionRole } from "@/lib/hooks/use-session-role";
import { IconPeople } from "@/components/navigation/nav-icons";

// Mirror the API response shape. We avoid importing the route module
// because Next.js client components can't import server-only modules
// (the route imports prisma).
type TalentApplicationStatus =
  | "SUBMITTED"
  | "IN_REVIEW"
  | "AWAITING_CANDIDATE_CHOICE"
  | "CANDIDATE_PROPOSED_TIME"
  | "ACCEPTED"
  | "MISSED"
  // PR9 — post-interview lifecycle.
  | "INTERVIEW_HELD"
  | "HIRED"
  | "ONBOARDED"
  | "DECLINED"
  | "REJECTED_AFTER_INTERVIEW";

type Application = {
  id: string;
  fullName: string;
  whatsappNumber: string;
  email: string;
  country: string;
  timezone: string;
  portfolioUrl: string;
  linkedinUrl: string | null;
  socialLinks: unknown;
  categoryIds: unknown;
  totalYears: string;
  hasRemoteExp: boolean;
  yearsRemote: string | null;
  workedWith: unknown;
  workload: string;
  preferredTasksPerWeek: string | null;
  turnaroundOk: boolean;
  turnaroundComment: string;
  tools: unknown;
  toolsOther: string | null;
  testTaskOk: boolean;
  communicationConfirmed: boolean;
  status: TalentApplicationStatus;
  ipAddress: string | null;
  userAgent: string | null;
  reviewedAt: string | null;
  reviewedByUserEmail: string | null;
  googleEventId: string | null;
  meetLink: string | null;
  interviewAt: string | null;
  declineReason: string | null;
  // PR4 — 3-slot booking flow
  proposedSlotsJson: unknown;
  bookingTokenExpiresAt: string | null;
  customMessage: string | null;
  candidateProposedAt: string | null;
  // PR9 — post-interview lifecycle fields
  workingHours: string | null;
  approvedCategoryIds: unknown;
  approvedTasksPerWeekCap: number | null;
  hiredAt: string | null;
  hiredByUserEmail: string | null;
  hireNotes: string | null;
  hiredUserAccountId: string | null;
  // PR5 — true when the email matches an existing UserAccount.
  // Computed server-side per response, not stored on the row.
  existingCustomer?: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Funnel order — the status select walks a candidate's journey. */
const ALL_STATUSES: TalentApplicationStatus[] = [
  "SUBMITTED",
  "IN_REVIEW",
  "AWAITING_CANDIDATE_CHOICE",
  "CANDIDATE_PROPOSED_TIME",
  "ACCEPTED",
  "MISSED",
  "INTERVIEW_HELD",
  "HIRED",
  "ONBOARDED",
  "DECLINED",
  "REJECTED_AFTER_INTERVIEW",
];

// Tone encodes whose turn it is: peach/amber/red = the admin should act,
// blue = waiting on the candidate, green = positive outcome, neutral = closed.
const STATUS_META: Record<TalentApplicationStatus, { label: string; tone: Tone }> = {
  SUBMITTED: { label: "New", tone: "peach" },
  IN_REVIEW: { label: "In review", tone: "lavender" },
  AWAITING_CANDIDATE_CHOICE: { label: "Awaiting candidate", tone: "blue" },
  CANDIDATE_PROPOSED_TIME: { label: "Candidate proposed", tone: "amber" },
  ACCEPTED: { label: "Interview booked", tone: "blue" },
  MISSED: { label: "Missed (no-show)", tone: "red" },
  INTERVIEW_HELD: { label: "Interview held", tone: "amber" },
  HIRED: { label: "Hired", tone: "green" },
  ONBOARDED: { label: "Onboarded", tone: "green" },
  DECLINED: { label: "Declined", tone: "neutral" },
  REJECTED_AFTER_INTERVIEW: { label: "Declined post-interview", tone: "neutral" },
};

// Status labels used in the status filter — identical to the chip names the
// page used before the restyle, so operators find the same buckets.
const STATUS_FILTER_LABEL: Record<TalentApplicationStatus, string> = {
  SUBMITTED: "New",
  IN_REVIEW: "In review",
  AWAITING_CANDIDATE_CHOICE: "Awaiting candidate",
  CANDIDATE_PROPOSED_TIME: "Candidate proposed",
  ACCEPTED: "Accepted (interview booked)",
  MISSED: "Missed",
  INTERVIEW_HELD: "Interview held",
  HIRED: "Hired",
  ONBOARDED: "Onboarded",
  DECLINED: "Declined",
  REJECTED_AFTER_INTERVIEW: "Declined post-interview",
};

// Main stages — group the 11 statuses into five readable buckets. Each
// individual status stays reachable through the status select.
type StageKey = "NEW" | "REVIEW" | "INTERVIEW" | "HIRING" | "CLOSED";
type StageFilter = StageKey | "ALL";

const STAGES: { key: StageKey; label: string; statuses: TalentApplicationStatus[] }[] = [
  { key: "NEW", label: "New", statuses: ["SUBMITTED"] },
  { key: "REVIEW", label: "In review", statuses: ["IN_REVIEW"] },
  {
    key: "INTERVIEW",
    label: "Interviews",
    statuses: [
      "AWAITING_CANDIDATE_CHOICE",
      "CANDIDATE_PROPOSED_TIME",
      "ACCEPTED",
      "MISSED",
      "INTERVIEW_HELD",
    ],
  },
  { key: "HIRING", label: "Hired", statuses: ["HIRED", "ONBOARDED"] },
  { key: "CLOSED", label: "Closed", statuses: ["DECLINED", "REJECTED_AFTER_INTERVIEW"] },
];

const stageOf = (s: TalentApplicationStatus): StageKey =>
  STAGES.find((st) => st.statuses.includes(s))?.key ?? "NEW";

/** Format a stored array-shape `unknown` (Prisma JsonValue) into human
 *  text. Defensive — we never crash a row render because a JSON column
 *  came back unexpected. */
function formatList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

/** PR9 — map preferredTasksPerWeek bucket → numeric default for the HIRE
 *  form's tasksPerWeekCap input. Mirrors the same helper in the API
 *  route so the pre-fill matches what the server defaults to when the
 *  field is omitted. */
function defaultTasksCapForBucket(bucket: string | null): number {
  switch (bucket) {
    case "1-2":
      return 2;
    case "3-5":
      return 4;
    case "6+":
      return 6;
    default:
      return 3;
  }
}

function formatDateTime(iso: string | null, timezone?: string): string {
  if (!iso) return DASH;
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: timezone || undefined,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Local primitives
// ---------------------------------------------------------------------------

function IconChevronRight() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function IconRefresh() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 11a8 8 0 0 0-14.9-3.9M4 4v4h4M4 13a8 8 0 0 0 14.9 3.9M20 20v-4h-4" />
    </svg>
  );
}

function IconVideo() {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="m16 10 5-3v10l-5-3" />
    </svg>
  );
}

/** Same rule as the shared OwnerOnlyBanner, drawn with the v2 Callout. */
function OwnerOnlyNote({ action }: { action: string }) {
  const { isSiteOwner, loading } = useSessionRole();
  if (loading || isSiteOwner) return null;
  return (
    <div className="mb-6" role="note">
      <Callout tone="warning" title="Site owner only">
        Site admins can view this page, but only the site owner can {action}. Requests from admins
        will be rejected with a 403.
      </Callout>
    </div>
  );
}

/** External link that shows the URL without its protocol. */
function ExternalLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium break-all text-[var(--av2-link)] hover:underline focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none"
    >
      {href.replace(/^https?:\/\/(www\.)?/, "")}
    </a>
  );
}

// Lifecycle stepper (ui.tsx has no stepper; same drawing as withdrawals).
type StepState = "done" | "current" | "upcoming" | "rejected";
type Step = { key: string; label: string; state: StepState; detail?: ReactNode };

function StepMarker({ state }: { state: StepState }) {
  if (state === "done") {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--av2-text)] text-[var(--av2-surface)]">
        <svg
          width={12}
          height={12}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="m5 12.5 4.5 4.5L19 7.5" />
        </svg>
      </span>
    );
  }
  if (state === "rejected") {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--av2-error)] text-white">
        <svg
          width={11}
          height={11}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          aria-hidden
        >
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </span>
    );
  }
  if (state === "current") {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-[var(--av2-accent)] bg-[var(--av2-surface)]">
        <span className="h-2 w-2 rounded-full bg-[var(--av2-accent)]" />
      </span>
    );
  }
  return (
    <span className="block h-5 w-5 rounded-full border-2 border-[var(--av2-border)] bg-[var(--av2-surface)]" />
  );
}

const STEP_SR: Record<StepState, string> = {
  done: "completed",
  current: "current step",
  upcoming: "not started",
  rejected: "closed",
};

function Stepper({ steps }: { steps: Step[] }) {
  return (
    <ol aria-label="Application progress">
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        return (
          <li
            key={s.key}
            aria-current={s.state === "current" ? "step" : undefined}
            className="relative flex gap-3 pb-5 last:pb-0"
          >
            {!last && (
              <span
                aria-hidden
                className={`absolute top-6 bottom-1 left-[9px] w-0.5 rounded-full ${
                  s.state === "done" ? "bg-[var(--av2-text)]" : "bg-[var(--av2-border)]"
                }`}
              />
            )}
            <span className="relative mt-0.5 shrink-0">
              <StepMarker state={s.state} />
            </span>
            <div className="min-w-0">
              <p
                className={`text-sm font-semibold ${
                  s.state === "upcoming"
                    ? "text-[var(--av2-text-2)]"
                    : s.state === "rejected"
                      ? "text-[var(--av2-error-text)]"
                      : ""
                }`}
              >
                {s.label}
                <span className="sr-only"> ({STEP_SR[s.state]})</span>
              </p>
              {s.detail && (
                <div className="mt-0.5 text-sm text-[var(--av2-text-2)]">{s.detail}</div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Lifecycle derived from the status + the timestamps stored on the row. */
function progressSteps(a: Application): Step[] {
  const order = ["applied", "offered", "booked", "held", "hired", "onboarded"] as const;
  type K = (typeof order)[number];
  const labels: Record<K, string> = {
    applied: "Applied",
    offered: "Interview slots offered",
    booked: "Interview booked",
    held: "Interview held",
    hired: "Hired",
    onboarded: "Onboarded",
  };
  const details: Partial<Record<K, ReactNode>> = {
    applied: formatDateTime(a.createdAt),
    booked: a.interviewAt ? formatDateTime(a.interviewAt) : undefined,
    hired: a.hiredAt
      ? `${formatDateTime(a.hiredAt)}${a.hiredByUserEmail ? ` · ${a.hiredByUserEmail}` : ""}`
      : undefined,
  };

  const build = (currentIdx: number, override?: { label?: string; detail?: ReactNode }): Step[] =>
    order.map((k, i) => ({
      key: k,
      label: i === currentIdx && override?.label ? override.label : labels[k],
      state: i < currentIdx ? "done" : i === currentIdx ? "current" : "upcoming",
      detail: i === currentIdx && override?.detail ? override.detail : details[k],
    }));

  switch (a.status) {
    case "SUBMITTED":
      return build(1, { label: "Review & offer interview slots", detail: "Not reviewed yet" });
    case "IN_REVIEW":
      return build(1, { label: "Review & offer interview slots", detail: "In review" });
    case "AWAITING_CANDIDATE_CHOICE":
      return build(2, {
        label: "Waiting for the candidate to book",
        detail: `Booking link expires ${formatDateTime(a.bookingTokenExpiresAt)}`,
      });
    case "CANDIDATE_PROPOSED_TIME":
      return build(2, {
        label: "Candidate proposed another time",
        detail: `${formatDateTime(a.candidateProposedAt, a.timezone)} (${a.timezone})`,
      });
    case "ACCEPTED":
      return build(3, {
        label: "Interview scheduled",
        detail: `${formatDateTime(a.interviewAt, a.timezone)} (${a.timezone})`,
      });
    case "MISSED":
      return build(3, {
        label: "Candidate missed the interview",
        detail: "Re-offer slots to reschedule, or decline.",
      });
    case "INTERVIEW_HELD":
      return build(4, { label: "Hire decision pending" });
    case "HIRED":
      return build(5, { label: "Ready to onboard" });
    case "ONBOARDED":
      return order.map((k) => ({ key: k, label: labels[k], state: "done", detail: details[k] }));
    case "DECLINED":
      return [
        { key: "applied", label: labels.applied, state: "done", detail: details.applied },
        {
          key: "declined",
          label: "Declined",
          state: "rejected",
          detail: formatDateTime(a.reviewedAt),
        },
      ];
    case "REJECTED_AFTER_INTERVIEW":
      return [
        { key: "applied", label: labels.applied, state: "done", detail: details.applied },
        { key: "booked", label: labels.booked, state: "done", detail: details.booked },
        {
          key: "declined",
          label: "Declined after interview",
          state: "rejected",
          detail: formatDateTime(a.reviewedAt),
        },
      ];
  }
}

type DetailTab = "overview" | "answers" | "progress";
type ActionMode = null | "offer" | "decline" | "hire" | "rejectPost";

export default function TalentApplicationsPage() {
  const toast = useToast();

  const [items, setItems] = useState<Application[]>([]);
  // Main stage chip + optional single-status refinement. Defaults to the
  // "New" bucket, same as the old default SUBMITTED filter.
  const [stage, setStage] = useState<StageFilter>("NEW");
  const [statusFilter, setStatusFilter] = useState<TalentApplicationStatus | null>(null);
  const [query, setQuery] = useState("");
  // Per-status counts across the entire table — populated from the API
  // response on each load so the stage chips and the status select can show
  // counts for buckets the user isn't currently viewing.
  const [statusCounts, setStatusCounts] = useState<
    Partial<Record<TalentApplicationStatus, number>>
  >({});
  const [countsLoaded, setCountsLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Detail panel: id of the row currently selected.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<DetailTab>("overview");
  const [mode, setMode] = useState<ActionMode>(null);

  // Map of JobTypeCategory.id -> human name. Loaded once on mount from the
  // public /api/talent/categories endpoint so the detail panel can render
  // the candidate's selections as readable names instead of the raw cuids
  // stored on the row. The endpoint already excludes inactive rows; if a
  // row references a since-removed category we fall back to "(removed)".
  const [categoryNames, setCategoryNames] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;
    fetch("/api/talent/categories", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { categories: [] }))
      .then((j: { categories: { id: string; name: string }[] }) => {
        if (cancelled) return;
        setCategoryNames(new Map(j.categories.map((c) => [c.id, c.name])));
      })
      .catch(() => {
        // Silent — detail panel falls back to showing raw IDs.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Per-action UI state — kept local because at most one action runs
  // at a time and the reset between selections is automatic.
  // PR4: ACCEPT offers 3 slots + a custom message. ACCEPT_PROPOSED has
  // no fields. DECLINE takes optional reason.
  // PR9: HIRE captures workingHours / approvedCategoryIds / tasksPerWeekCap
  // / hireNotes; pre-populated from the row when the user opens an
  // INTERVIEW_HELD detail (see the reset effect below).
  const [proposedSlotsLocal, setProposedSlotsLocal] = useState<string[]>(["", "", ""]);
  const [customMessage, setCustomMessage] = useState("");
  const [declineReason, setDeclineReason] = useState("");
  const [workingHoursLocal, setWorkingHoursLocal] = useState("");
  const [approvedCategoryIdsLocal, setApprovedCategoryIdsLocal] = useState<string[]>([]);
  const [tasksPerWeekCapLocal, setTasksPerWeekCapLocal] = useState<string>("");
  const [hireNotesLocal, setHireNotesLocal] = useState("");
  const [actionStatus, setActionStatus] = useState<"idle" | "submitting">("idle");
  const [actionError, setActionError] = useState<string | null>(null);

  const selected = useMemo(
    () => items.find((it) => it.id === selectedId) ?? null,
    [items, selectedId],
  );

  // The list endpoint filters by one status (or ALL). A stage with several
  // statuses is fetched as one request per status and merged, so every row
  // of the stage is present (each request keeps the endpoint's own paging).
  const fetchKey = statusFilter
    ? statusFilter
    : stage === "ALL"
      ? "ALL"
      : STAGES.find((s) => s.key === stage)!.statuses.join(",");

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const statuses = fetchKey.split(",");
      const responses = await Promise.all(
        statuses.map(async (status) => {
          const url = new URL("/api/admin/talent-applications", window.location.origin);
          url.searchParams.set("status", status);
          const res = await fetch(url.toString(), { cache: "no-store" });
          if (!res.ok) {
            const body = (await res.json().catch(() => null)) as { error?: string } | null;
            throw new Error(body?.error || `HTTP ${res.status}`);
          }
          return (await res.json()) as {
            applications: Application[];
            total: number;
            counts?: Partial<Record<TalentApplicationStatus, number>>;
          };
        }),
      );
      const merged = responses
        .flatMap((r) => r.applications)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setItems(merged);
      // Per-status counts are the source of truth for the chip counts.
      const counts = responses.find((r) => r.counts)?.counts;
      if (counts) {
        setStatusCounts(counts);
        setCountsLoaded(true);
      }
    } catch (err) {
      console.error("[admin/talent] load failed", err);
      setLoadError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [fetchKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // When the user switches selection (or the list re-loads after an
  // action), clear stale per-action UI state. PR9 adds the HIRE form
  // fields here too — pre-populating when the selected row is at
  // INTERVIEW_HELD so the admin doesn't re-type categories the
  // candidate already submitted.
  useEffect(() => {
    setProposedSlotsLocal(["", "", ""]);
    setCustomMessage("");
    setDeclineReason("");
    setHireNotesLocal("");
    setActionStatus("idle");
    setActionError(null);
    setMode(null);

    const sel = items.find((it) => it.id === selectedId);

    // Pre-fill working hours from the saved application value so an admin
    // returning to the row (or after a background list reload) sees what was
    // already entered instead of a blank field they have to re-type.
    setWorkingHoursLocal(sel?.workingHours ?? "");

    if (sel?.status === "INTERVIEW_HELD") {
      // Pre-fill HIRE form from the application data.
      const applied = Array.isArray(sel.categoryIds)
        ? (sel.categoryIds as unknown[]).filter((v): v is string => typeof v === "string")
        : [];
      setApprovedCategoryIdsLocal(applied);
      // Prefer a previously-saved cap over the bucket default so an admin's
      // override survives a reload / re-open.
      setTasksPerWeekCapLocal(
        String(sel.approvedTasksPerWeekCap ?? defaultTasksCapForBucket(sel.preferredTasksPerWeek)),
      );
    } else {
      setApprovedCategoryIdsLocal([]);
      setTasksPerWeekCapLocal("");
    }
  }, [selectedId, items]);

  // Below xl the panel stacks under the list; bring it into view on select.
  useEffect(() => {
    if (!selectedId || window.innerWidth >= 1280) return;
    document
      .getElementById("talent-panel-top")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedId]);

  // Opening an action form swaps the panel body; start it from the top.
  useEffect(() => {
    if (!mode) return;
    document.getElementById("talent-panel-top")?.scrollIntoView({ block: "nearest" });
  }, [mode]);

  async function submitAction(payload: Record<string, unknown>) {
    if (!selected) return;
    setActionStatus("submitting");
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/talent-applications/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        ok?: boolean;
      } | null;
      if (!res.ok || !body?.ok) {
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      const successTitle = ((): string => {
        switch (payload.action) {
          case "ACCEPT":
            return "Slots offered. Candidate emailed a booking link.";
          case "ACCEPT_PROPOSED":
            return "Interview booked at the candidate's proposed time.";
          case "MARK_INTERVIEW_HELD":
            return "Interview marked as held. Hire or decline next.";
          case "MARK_MISSED":
            return "Marked as no-show. Re-offer slots to reschedule, or decline.";
          case "HIRE":
            return "Hired. Onboarding pending — UserAccount creation lands in the next PR.";
          case "REJECT_POST_INTERVIEW":
            return "Declined after interview. Email sent.";
          case "ONBOARD":
            return "Onboarded. UserAccount created, magic-link + welcome email sent.";
          default:
            return "Application declined.";
        }
      })();
      toast.showToast({ type: "success", title: successTitle });
      setSelectedId(null);
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Action failed";
      setActionError(message);
      toast.showToast({ type: "error", title: message });
      setActionStatus("idle");
    }
  }

  function handleAccept() {
    // Validate all 3 slots are filled. The Zod schema also catches this
    // server-side; we surface it inline here so the user doesn't waste
    // a round-trip.
    if (proposedSlotsLocal.some((s) => !s)) {
      setActionError("Fill in all three proposed slots.");
      return;
    }
    // datetime-local has no timezone. Convert each to a UTC ISO string
    // by letting the browser interpret in its own timezone (admin's),
    // then `.toISOString()`. Server cross-validates uniqueness +
    // future + within-horizon.
    let proposedSlotsIso: string[];
    try {
      proposedSlotsIso = proposedSlotsLocal.map((s) => new Date(s).toISOString());
    } catch {
      setActionError("One of the proposed slots isn't a valid date.");
      return;
    }
    void submitAction({
      action: "ACCEPT",
      proposedSlotsIso,
      customMessage: customMessage.trim() || null,
    });
  }

  function handleAcceptProposed() {
    void submitAction({ action: "ACCEPT_PROPOSED" });
  }

  function handleDecline() {
    void submitAction({
      action: "DECLINE",
      reason: declineReason.trim() || null,
    });
  }

  // PR9 — post-interview handlers.
  function handleMarkInterviewHeld() {
    void submitAction({ action: "MARK_INTERVIEW_HELD" });
  }

  function handleMarkMissed() {
    void submitAction({ action: "MARK_MISSED" });
  }

  function handleHire() {
    if (!workingHoursLocal.trim()) {
      setActionError("Working hours is required.");
      return;
    }
    if (approvedCategoryIdsLocal.length === 0) {
      setActionError("Approve at least one category.");
      return;
    }
    const tasksCapNum = Number.parseInt(tasksPerWeekCapLocal, 10);
    if (
      tasksPerWeekCapLocal &&
      (!Number.isFinite(tasksCapNum) || tasksCapNum < 1 || tasksCapNum > 40)
    ) {
      setActionError("Tasks per week cap must be between 1 and 40.");
      return;
    }
    void submitAction({
      action: "HIRE",
      workingHours: workingHoursLocal.trim(),
      approvedCategoryIds: approvedCategoryIdsLocal,
      tasksPerWeekCap: tasksPerWeekCapLocal ? tasksCapNum : null,
      hireNotes: hireNotesLocal.trim() || null,
    });
  }

  function handleRejectPostInterview() {
    void submitAction({
      action: "REJECT_POST_INTERVIEW",
      reason: declineReason.trim() || null,
    });
  }

  // PR10 — kick off the onboarding orchestrator. No body fields; the
  // orchestrator reads everything from the application row.
  function handleOnboard() {
    void submitAction({ action: "ONBOARD" });
  }

  // ---------------------------------------------------------------------------
  // Filters
  // ---------------------------------------------------------------------------

  const totalCount = useMemo(
    () => Object.values(statusCounts).reduce<number>((a, b) => a + (b ?? 0), 0),
    [statusCounts],
  );

  const stageCount = (key: StageFilter): number | null => {
    if (!countsLoaded) return null;
    if (key === "ALL") return totalCount;
    return STAGES.find((s) => s.key === key)!.statuses.reduce(
      (a, s) => a + (statusCounts[s] ?? 0),
      0,
    );
  };

  const selectStage = (next: StageFilter) => {
    setStage(next);
    setStatusFilter(null);
    setSelectedId(null);
  };

  const selectStatus = (value: string) => {
    if (value === "") {
      setStatusFilter(null);
    } else {
      const s = value as TalentApplicationStatus;
      setStatusFilter(s);
      setStage(stageOf(s));
    }
    setSelectedId(null);
  };

  // Statuses offered in the select: those of the active stage, or all.
  const selectableStatuses =
    stage === "ALL" ? ALL_STATUSES : STAGES.find((s) => s.key === stage)!.statuses;

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((a) =>
      [a.fullName, a.email, a.country].some((v) => v.toLowerCase().includes(q)),
    );
  }, [items, query]);

  const viewLabel = statusFilter
    ? STATUS_FILTER_LABEL[statusFilter]
    : stage === "ALL"
      ? "All"
      : STAGES.find((s) => s.key === stage)!.label;

  const categoryLabel = (id: string) => categoryNames.get(id) ?? "(removed)";

  // ---------------------------------------------------------------------------
  // Detail panel
  // ---------------------------------------------------------------------------

  const renderPanel = (item: Application) => {
    const meta = STATUS_META[item.status];
    const submitting = actionStatus === "submitting";
    const idPrefix = `talent-${item.id}`;

    // Action availability matrix. Re-derived per render so a status change
    // (after a submitAction → refresh → status update) immediately flips
    // which actions are offered.
    //   - SUBMITTED / IN_REVIEW: offer 3 slots (ACCEPT) or DECLINE
    //   - AWAITING_CANDIDATE_CHOICE: RE-OFFER slots (fresh booking link —
    //     the unstick path when the link expired or candidate-side booking
    //     kept failing) or DECLINE (revoking the offer)
    //   - CANDIDATE_PROPOSED_TIME: ACCEPT_PROPOSED, RE-OFFER (counter-
    //     propose 3 fresh slots) or DECLINE
    //   - ACCEPTED (PR9): MARK_INTERVIEW_HELD, MARK_MISSED or
    //     REJECT_POST_INTERVIEW (no-show path)
    //   - INTERVIEW_HELD (PR9): HIRE or REJECT_POST_INTERVIEW
    //   - HIRED (PR10): ONBOARD
    //   - ONBOARDED / DECLINED / REJECTED_AFTER_INTERVIEW: terminal info
    // MISSED behaves like a re-offer origin: from a no-show the admin can send
    // fresh slots + a new booking link to reschedule the interview.
    const isReoffer =
      item.status === "AWAITING_CANDIDATE_CHOICE" ||
      item.status === "CANDIDATE_PROPOSED_TIME" ||
      item.status === "MISSED";
    const canOfferSlots = item.status === "SUBMITTED" || item.status === "IN_REVIEW" || isReoffer;
    const canConfirmProposed = item.status === "CANDIDATE_PROPOSED_TIME";
    const canDecline =
      item.status === "SUBMITTED" ||
      item.status === "IN_REVIEW" ||
      item.status === "AWAITING_CANDIDATE_CHOICE" ||
      item.status === "CANDIDATE_PROPOSED_TIME" ||
      item.status === "MISSED";
    const canMarkInterviewHeld = item.status === "ACCEPTED";
    const canHire = item.status === "INTERVIEW_HELD";
    const canRejectPostInterview = item.status === "ACCEPTED" || item.status === "INTERVIEW_HELD";
    const canOnboard = item.status === "HIRED";

    const appliedCategoryIds = formatList(item.categoryIds);
    const appliedCategoryOptions = appliedCategoryIds.map((id) => ({
      id,
      name: categoryLabel(id),
    }));
    const social = formatList(item.socialLinks);
    const categories = appliedCategoryIds.map(categoryLabel);
    const tools = formatList(item.tools);
    const workedWith = formatList(item.workedWith);

    const tasksCapNum = Number.parseInt(tasksPerWeekCapLocal, 10);
    const tasksCapError =
      tasksPerWeekCapLocal && (!Number.isFinite(tasksCapNum) || tasksCapNum < 1 || tasksCapNum > 40)
        ? "Tasks per week cap must be between 1 and 40."
        : null;

    // ----- Footer: only the actions valid for this status -----------------
    const busyLabel = (idle: string, busy: string) => (submitting ? busy : idle);

    let footer: ReactNode = null;
    if (mode === "offer") {
      footer = (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" onClick={() => setMode(null)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleAccept}
            disabled={proposedSlotsLocal.some((s) => !s) || submitting}
            aria-busy={submitting}
          >
            {busyLabel(
              isReoffer ? "Re-offer & email new booking link" : "Accept & email booking link",
              "Sending…",
            )}
          </Button>
        </div>
      );
    } else if (mode === "decline" || mode === "rejectPost") {
      footer = (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" onClick={() => setMode(null)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={mode === "decline" ? handleDecline : handleRejectPostInterview}
            disabled={submitting}
            aria-busy={submitting}
          >
            {busyLabel("Decline & send email", "Sending…")}
          </Button>
        </div>
      );
    } else if (mode === "hire") {
      footer = (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" onClick={() => setMode(null)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleHire}
            disabled={
              submitting || !workingHoursLocal.trim() || approvedCategoryIdsLocal.length === 0
            }
            aria-busy={submitting}
          >
            {busyLabel("Hire", "Hiring…")}
          </Button>
        </div>
      );
    } else {
      // Idle: one primary action for the current step + secondary paths.
      let primary: ReactNode = null;
      const secondary: ReactNode[] = [];
      let hint: ReactNode = null;

      if (canConfirmProposed) {
        primary = (
          <Button
            variant="primary"
            className="w-full"
            onClick={handleAcceptProposed}
            disabled={submitting}
            aria-busy={submitting}
          >
            {busyLabel("Confirm this time & book interview", "Booking…")}
          </Button>
        );
        hint = "Or counter-propose by re-offering 3 fresh slots.";
      } else if (canMarkInterviewHeld) {
        primary = (
          <Button
            variant="primary"
            className="w-full"
            onClick={handleMarkInterviewHeld}
            disabled={submitting}
            aria-busy={submitting}
          >
            {busyLabel("Yes, interview held", "Saving…")}
          </Button>
        );
        hint =
          "Did the interview happen? Marking it held unlocks the Hire form. If the candidate didn’t show, mark a no-show to reschedule, or decline.";
      } else if (canHire) {
        primary = (
          <Button
            variant="primary"
            className="w-full"
            onClick={() => {
              setActionError(null);
              setMode("hire");
            }}
            disabled={submitting}
          >
            Hire & capture terms
          </Button>
        );
      } else if (canOnboard) {
        primary = (
          <Button
            variant="primary"
            className="w-full"
            onClick={handleOnboard}
            disabled={submitting}
            aria-busy={submitting}
          >
            {busyLabel("Onboard now · create account + send sign-in", "Onboarding…")}
          </Button>
        );
        hint =
          "Creates a DESIGNER UserAccount, seeds CreativeSkill rows from the approved categories, mirrors the tasks/week cap, sends magic-link + branded welcome email. Refuses if the email is already a customer.";
      }

      if (canOfferSlots) {
        const offerBtn = (
          <Button
            key="offer"
            variant={
              primary || item.status === "AWAITING_CANDIDATE_CHOICE" ? "secondary" : "primary"
            }
            className="w-full"
            onClick={() => {
              setActionError(null);
              setMode("offer");
            }}
            disabled={submitting}
          >
            {isReoffer ? "Re-offer 3 slots" : "Accept & offer 3 slots"}
          </Button>
        );
        if (!primary && item.status !== "AWAITING_CANDIDATE_CHOICE") primary = offerBtn;
        else secondary.push(offerBtn);
      }
      if (canMarkInterviewHeld) {
        secondary.push(
          <Button
            key="missed"
            className="w-full"
            onClick={handleMarkMissed}
            disabled={submitting}
            aria-busy={submitting}
          >
            {busyLabel("No-show — reschedule", "Saving…")}
          </Button>,
        );
      }
      if (canDecline) {
        secondary.push(
          <Button
            key="decline"
            variant="danger"
            className="w-full"
            onClick={() => {
              setActionError(null);
              setMode("decline");
            }}
            disabled={submitting}
          >
            Decline
          </Button>,
        );
      }
      if (canRejectPostInterview) {
        secondary.push(
          <Button
            key="reject-post"
            variant="danger"
            className="w-full"
            onClick={() => {
              setActionError(null);
              setMode("rejectPost");
            }}
            disabled={submitting}
          >
            {item.status === "ACCEPTED" ? "No-show — decline" : "Decline after interview"}
          </Button>,
        );
      }
      if (item.status === "AWAITING_CANDIDATE_CHOICE") {
        hint =
          "Waiting for the candidate to book. Link expired, or the candidate reports a booking error? Re-offer — it emails a fresh link and kills the old one.";
      }

      if (primary || secondary.length > 0) {
        footer = (
          <div className="space-y-3">
            {primary}
            {secondary.length > 0 && (
              <div className={`grid gap-2 ${secondary.length > 1 ? "sm:grid-cols-2" : ""}`}>
                {secondary}
              </div>
            )}
            {hint && <p className="text-xs text-[var(--av2-text-2)]">{hint}</p>}
          </div>
        );
      }
    }

    // ----- Status card (current step context) -----------------------------
    const statusCard: ReactNode = (() => {
      switch (item.status) {
        case "AWAITING_CANDIDATE_CHOICE":
          return (
            <Callout tone="info" title="Awaiting candidate">
              3 slots offered. Booking link expires {formatDateTime(item.bookingTokenExpiresAt)}.
              <span className="mt-1 block text-xs">
                Sent by {item.reviewedByUserEmail ?? DASH} · {formatDateTime(item.reviewedAt)}
              </span>
            </Callout>
          );
        case "CANDIDATE_PROPOSED_TIME":
          return (
            <div className="rounded-xl border border-[var(--av2-attention-border)] bg-[var(--av2-attention-from)] p-4">
              <p className="text-sm font-medium">Candidate proposed a time</p>
              <p className="mt-1 text-xl leading-7 font-bold">
                {formatDateTime(item.candidateProposedAt, item.timezone)}
              </p>
              <p className="text-xs text-[var(--av2-text-2)]">{item.timezone}</p>
              {item.customMessage && (
                <p className="mt-3 text-sm text-[var(--av2-text-2)] italic">
                  &ldquo;{item.customMessage}&rdquo;
                </p>
              )}
            </div>
          );
        case "ACCEPTED":
          return (
            <div className="rounded-xl bg-[var(--av2-lavender-bg)] p-4">
              <div className="flex gap-4">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--av2-surface)] text-[var(--av2-fill-lavender)]">
                  <IconVideo />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">Interview booked</p>
                  <p className="text-xl leading-7 font-bold">
                    {formatDateTime(item.interviewAt, item.timezone)}
                  </p>
                  <p className="text-xs text-[var(--av2-text-2)]">{item.timezone}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--av2-border)] pt-3 text-xs text-[var(--av2-text-2)]">
                <span>
                  Booked by {item.reviewedByUserEmail ?? DASH} · {formatDateTime(item.reviewedAt)}
                </span>
                {item.meetLink && (
                  <TextLink href={item.meetLink} external>
                    Open Meet
                  </TextLink>
                )}
              </div>
            </div>
          );
        case "MISSED":
          return (
            <Callout tone="warning" title="Candidate missed the interview">
              Re-offer 3 slots to reschedule, or decline.
            </Callout>
          );
        case "INTERVIEW_HELD":
          return (
            <Callout tone="info" title="Interview held — decision pending">
              Hire the candidate and capture the onboarding terms, or decline after interview.
            </Callout>
          );
        case "HIRED":
          return (
            <div className="rounded-xl border border-[var(--av2-fill-green)]/40 bg-[var(--av2-success-bg)] p-4">
              <p className="text-sm font-semibold">Hired — ready to onboard</p>
              <div className="mt-3">
                <KeyValueList
                  rows={[
                    { label: "Working hours", value: item.workingHours || DASH },
                    { label: "Tasks / week cap", value: fmt(item.approvedTasksPerWeekCap) },
                    {
                      label: "Approved categories",
                      value:
                        formatList(item.approvedCategoryIds).map(categoryLabel).join(", ") || DASH,
                    },
                  ]}
                />
              </div>
              {item.hireNotes && (
                <p className="mt-3 text-sm text-[var(--av2-text-2)] italic">
                  Note: {item.hireNotes}
                </p>
              )}
              <p className="mt-3 text-xs text-[var(--av2-text-2)]">
                Hired by {item.hiredByUserEmail ?? DASH} · {formatDateTime(item.hiredAt)}
              </p>
            </div>
          );
        case "ONBOARDED":
          return (
            <Callout
              tone="success"
              title="Onboarded creative"
              action={<TextLink href="/admin/users">Manage users</TextLink>}
            >
              UserAccount linked: {item.hiredUserAccountId ?? DASH}
            </Callout>
          );
        case "DECLINED":
        case "REJECTED_AFTER_INTERVIEW":
          return (
            <Callout
              tone="info"
              title={
                item.status === "DECLINED" ? "Application declined" : "Declined after interview"
              }
            >
              {item.declineReason && (
                <span className="block">
                  <strong className="font-semibold text-[var(--av2-text)]">Reason sent:</strong>{" "}
                  {item.declineReason}
                </span>
              )}
              <span className="mt-1 block text-xs">
                Declined by {item.reviewedByUserEmail ?? DASH} · {formatDateTime(item.reviewedAt)}
              </span>
            </Callout>
          );
        default:
          return null;
      }
    })();

    // ----- Action forms (replace the tabs while open) ---------------------
    const actionForm: ReactNode = (() => {
      if (mode === "offer") {
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg leading-[26px] font-semibold">
                {isReoffer ? "Re-offer 3 slots" : "Accept & offer 3 slots"}
              </h3>
              <p className="mt-1 text-sm text-[var(--av2-text-2)]">
                {isReoffer
                  ? "Offer three fresh 30-minute slots. The candidate gets a new email with a new booking link; the previous link stops working immediately. Use this when the old link expired, the candidate hit a booking error, or their proposed time doesn't work for you."
                  : "Offer the candidate three 30-minute slots. They'll get an email with a tokenized link to pick one (or propose another time). Calendar event is created when they pick. Times are in your local timezone; the candidate sees them in theirs."}
              </p>
            </div>
            {[0, 1, 2].map((idx) => (
              <Field key={idx} label={`Slot ${idx + 1}`} htmlFor={`${idPrefix}-slot-${idx}`}>
                <TextInput
                  id={`${idPrefix}-slot-${idx}`}
                  type="datetime-local"
                  value={proposedSlotsLocal[idx] ?? ""}
                  onChange={(e) =>
                    setProposedSlotsLocal((prev) => {
                      const next = [...prev];
                      next[idx] = e.target.value;
                      return next;
                    })
                  }
                />
              </Field>
            ))}
            <Field
              label="Personal note (optional)"
              htmlFor={`${idPrefix}-message`}
              hint="Added to the email above the booking link."
            >
              <TextArea
                id={`${idPrefix}-message`}
                rows={3}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="e.g. Loved your motion reel — really excited to chat."
                maxLength={500}
              />
            </Field>
          </div>
        );
      }
      if (mode === "decline" || mode === "rejectPost") {
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg leading-[26px] font-semibold">
                {mode === "decline"
                  ? "Decline politely"
                  : item.status === "ACCEPTED"
                    ? "No-show — decline"
                    : "Decline after interview"}
              </h3>
              <p className="mt-1 text-sm text-[var(--av2-text-2)]">
                {mode === "decline"
                  ? "The candidate gets the standard rejection email. This closes the application."
                  : "The candidate gets the post-interview decline email. This closes the application."}
              </p>
            </div>
            <Field
              label="Reason (optional)"
              htmlFor={`${idPrefix}-reason`}
              hint="Surfaced verbatim in the email above the standard copy. Leave blank for the generic version."
            >
              <TextArea
                id={`${idPrefix}-reason`}
                rows={4}
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder={
                  mode === "decline"
                    ? "e.g. We're focused on motion designers this quarter."
                    : "e.g. The motion-graphics work you showed was great — we just don't have steady volume in that lane this quarter."
                }
                maxLength={500}
              />
            </Field>
          </div>
        );
      }
      if (mode === "hire") {
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg leading-[26px] font-semibold">
                Hire &amp; capture onboarding terms
              </h3>
              <p className="mt-1 text-sm text-[var(--av2-text-2)]">
                Captures the negotiated terms. Onboarding then turns these into a DESIGNER
                UserAccount, CreativeSkill rows and a magic-link sign-in email.
              </p>
            </div>
            <Field label="Working hours" htmlFor={`${idPrefix}-hours`}>
              <TextInput
                id={`${idPrefix}-hours`}
                value={workingHoursLocal}
                onChange={(e) => setWorkingHoursLocal(e.target.value)}
                placeholder={`e.g. 9-18 weekdays ${item.timezone}`}
                maxLength={200}
                aria-invalid={actionError === "Working hours is required." || undefined}
              />
            </Field>
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium">
                Approved categories ({approvedCategoryIdsLocal.length} of{" "}
                {appliedCategoryOptions.length})
              </legend>
              {appliedCategoryOptions.length > 0 ? (
                <div className="space-y-2">
                  {appliedCategoryOptions.map((opt) => {
                    const checked = approvedCategoryIdsLocal.includes(opt.id);
                    return (
                      <label key={opt.id} className="flex items-center gap-2.5 text-sm">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[var(--av2-accent-strong)]"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setApprovedCategoryIdsLocal([
                                ...approvedCategoryIdsLocal.filter((id) => id !== opt.id),
                                opt.id,
                              ]);
                            } else {
                              setApprovedCategoryIdsLocal(
                                approvedCategoryIdsLocal.filter((id) => id !== opt.id),
                              );
                            }
                          }}
                        />
                        <span>{opt.name}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-[var(--av2-text-2)]">{DASH}</p>
              )}
              <p className="mt-1.5 text-xs text-[var(--av2-text-2)]">
                Pre-filled with everything the candidate applied for. Deselect any you&apos;re not
                hiring them for.
              </p>
            </fieldset>
            <Field
              label="Tasks per week cap"
              htmlFor={`${idPrefix}-cap`}
              hint={`Applied bucket: ${item.preferredTasksPerWeek ?? DASH}`}
              error={tasksCapError}
            >
              <TextInput
                id={`${idPrefix}-cap`}
                type="number"
                inputMode="numeric"
                min={1}
                max={40}
                value={tasksPerWeekCapLocal}
                onChange={(e) => setTasksPerWeekCapLocal(e.target.value)}
                placeholder="e.g. 4"
                aria-invalid={tasksCapError ? true : undefined}
              />
            </Field>
            <Field
              label="Internal hire notes (optional)"
              htmlFor={`${idPrefix}-notes`}
              hint="Not shown to the candidate."
            >
              <TextArea
                id={`${idPrefix}-notes`}
                rows={3}
                value={hireNotesLocal}
                onChange={(e) => setHireNotesLocal(e.target.value)}
                placeholder="Negotiated rate, contract terms, anything for the team to remember."
                maxLength={2000}
              />
            </Field>
          </div>
        );
      }
      return null;
    })();

    return (
      <DetailPanel
        title="Application details"
        onClose={() => setSelectedId(null)}
        closeLabel="Close application details"
        footer={footer}
      >
        <span id="talent-panel-top" aria-hidden className="block scroll-mt-40" />
        <div className="flex items-start gap-3">
          <Avatar name={item.fullName} size={48} />
          <div className="min-w-0 flex-1">
            <p className="text-lg leading-[26px] font-semibold break-words">{item.fullName}</p>
            <p className="truncate text-sm text-[var(--av2-text-2)]">{item.email}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone={meta.tone} dot>
                {meta.label}
              </Badge>
              <span className="text-xs text-[var(--av2-text-2)]">
                Applied {formatDate(item.createdAt)}
              </span>
            </div>
          </div>
        </div>

        {item.existingCustomer && (
          <div className="mt-4">
            <Callout tone="warning" title="Existing customer email">
              This applicant&apos;s email matches a registered Brandbite UserAccount. Could be
              intentional (a customer joining the team) or accidental (used their work email by
              mistake). Worth a check before acting.
            </Callout>
          </div>
        )}

        {actionError && (
          <div className="mt-4">
            <Callout tone="error" title="Action failed">
              {actionError}
            </Callout>
          </div>
        )}

        {mode ? (
          <div className="mt-5">{actionForm}</div>
        ) : (
          <>
            <div className="mt-5">
              <Tabs
                label="Application sections"
                idPrefix={idPrefix}
                value={tab}
                onChange={setTab}
                tabs={[
                  { value: "overview", label: "Overview" },
                  { value: "answers", label: "Answers" },
                  { value: "progress", label: "Progress" },
                ]}
              />
            </div>

            {tab === "overview" && (
              <TabPanel idPrefix={idPrefix} value="overview">
                <div className="mt-5">
                  {statusCard && <PanelSection>{statusCard}</PanelSection>}
                  <PanelSection title="Contact">
                    <KeyValueList
                      rows={[
                        {
                          label: "Email",
                          value: (
                            <a
                              href={`mailto:${item.email}`}
                              className="break-all text-[var(--av2-link)] hover:underline"
                            >
                              {item.email}
                            </a>
                          ),
                        },
                        { label: "WhatsApp", value: item.whatsappNumber || DASH },
                        { label: "Country", value: item.country || DASH },
                        { label: "Timezone", value: item.timezone || DASH },
                      ]}
                    />
                  </PanelSection>
                  <PanelSection title="Links">
                    <KeyValueList
                      rows={[
                        {
                          label: "Portfolio",
                          value: item.portfolioUrl ? (
                            <ExternalLink href={item.portfolioUrl} />
                          ) : (
                            DASH
                          ),
                        },
                        {
                          label: "LinkedIn",
                          value: item.linkedinUrl ? <ExternalLink href={item.linkedinUrl} /> : DASH,
                        },
                        {
                          label: "Other links",
                          value:
                            social.length > 0 ? (
                              <ul className="space-y-1">
                                {social.map((url) => (
                                  <li key={url}>
                                    <ExternalLink href={url} />
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              DASH
                            ),
                        },
                      ]}
                    />
                  </PanelSection>
                  <PanelSection title={`Applied for (${categories.length})`}>
                    {categories.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {categories.map((c, i) => (
                          <Badge key={`${c}-${i}`}>{c}</Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-[var(--av2-text-2)]">{DASH}</p>
                    )}
                  </PanelSection>
                </div>
              </TabPanel>
            )}

            {tab === "answers" && (
              <TabPanel idPrefix={idPrefix} value="answers">
                <div className="mt-5">
                  <PanelSection title="Experience">
                    <KeyValueList
                      rows={[
                        { label: "Total years", value: item.totalYears || DASH },
                        {
                          label: "Remote experience",
                          value: item.hasRemoteExp
                            ? `Yes (${item.yearsRemote ?? "?"} years)`
                            : "No",
                        },
                        {
                          label: "Worked at / with",
                          value: workedWith.length > 0 ? workedWith.join(", ") : DASH,
                        },
                      ]}
                    />
                  </PanelSection>
                  <PanelSection title="Availability">
                    <KeyValueList
                      rows={[
                        {
                          label: "Workload",
                          value: item.workload
                            ? item.workload.replace("_", "-").toLowerCase()
                            : DASH,
                        },
                        { label: "Tasks per week", value: item.preferredTasksPerWeek || DASH },
                      ]}
                    />
                  </PanelSection>
                  <PanelSection title="Turnaround">
                    <KeyValueList
                      rows={[
                        { label: "24–48h ok?", value: item.turnaroundOk ? "Yes" : "No" },
                        { label: "Comment", value: item.turnaroundComment || DASH },
                      ]}
                    />
                  </PanelSection>
                  <PanelSection title="Tools">
                    <KeyValueList
                      rows={[
                        { label: "Selected", value: tools.length > 0 ? tools.join(", ") : DASH },
                        { label: "Other", value: item.toolsOther || DASH },
                      ]}
                    />
                  </PanelSection>
                  <PanelSection title="Other">
                    <KeyValueList
                      rows={[
                        { label: "Open to test task?", value: item.testTaskOk ? "Yes" : "No" },
                        {
                          label: "Submitted",
                          value: `${formatDateTime(item.createdAt)} · ${item.ipAddress ?? "no IP"}`,
                        },
                      ]}
                    />
                  </PanelSection>
                </div>
              </TabPanel>
            )}

            {tab === "progress" && (
              <TabPanel idPrefix={idPrefix} value="progress">
                <div className="mt-5">
                  <PanelSection>
                    <Stepper steps={progressSteps(item)} />
                  </PanelSection>
                </div>
              </TabPanel>
            )}
          </>
        )}
      </DetailPanel>
    );
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const panel = selected ? renderPanel(selected) : undefined;
  // With the panel open the list narrows; categories + country move to the panel.
  const wideList = !selected;
  const noApplicationsAtAll = countsLoaded && totalCount === 0 && !loadError;

  return (
    <div>
      <PageHeader
        title="Talent applications"
        description="Review submissions from the public /talent form and move candidates through hiring."
        actions={
          <Button
            onClick={() => void refresh()}
            disabled={loading}
            aria-label="Refresh applications"
          >
            <IconRefresh />
            Refresh
          </Button>
        }
      />

      <OwnerOnlyNote action="accept or decline talent applications" />

      <div className="mb-6">
        <FilterChips
          label="Filter applications by stage"
          value={stage}
          onChange={selectStage}
          options={[
            { value: "ALL" as StageFilter, label: "All applications", count: stageCount("ALL") },
            ...STAGES.map((s) => ({
              value: s.key as StageFilter,
              label: s.label,
              count: stageCount(s.key),
            })),
          ]}
        />
      </div>

      {loadError && (
        <div className="mb-6">
          <Callout tone="error" title="Couldn't load applications">
            {loadError}
          </Callout>
        </div>
      )}

      <SplitView panel={panel}>
        <Card padding="none">
          {!noApplicationsAtAll && (
            <div className="px-6 pt-5">
              <FilterBar
                trailing={
                  !loading || items.length > 0
                    ? `${fmt(filteredItems.length)} ${plural(filteredItems.length, "application", "applications")}`
                    : null
                }
              >
                <SearchInput
                  className="min-w-[200px] flex-1"
                  value={query}
                  onChange={setQuery}
                  placeholder="Search name, email or country"
                  label="Search applications by name, email or country"
                />
                <div className="w-full sm:w-64">
                  <Select
                    aria-label="Filter by individual status"
                    value={statusFilter ?? ""}
                    onChange={(e) => selectStatus(e.target.value)}
                  >
                    <option value="">
                      {stage === "ALL" ? "All statuses" : `All statuses in ${viewLabel}`}
                    </option>
                    {selectableStatuses.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_FILTER_LABEL[s]}
                        {countsLoaded ? ` · ${statusCounts[s] ?? 0}` : ""}
                      </option>
                    ))}
                  </Select>
                </div>
              </FilterBar>
            </div>
          )}

          {loading && items.length === 0 ? (
            <div className="space-y-3 border-t border-[var(--av2-border)] px-6 py-5" role="status">
              <span className="sr-only">Loading applications…</span>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className={noApplicationsAtAll ? "" : "border-t border-[var(--av2-border)]"}>
              {noApplicationsAtAll ? (
                <EmptyState
                  icon={<IconPeople width={28} height={28} />}
                  title="No applications yet"
                  description="When candidates submit the public form at /talent, they'll show up here."
                />
              ) : (
                <EmptyState
                  title={`No applications in ${viewLabel}`}
                  description="Nothing is at this stage right now."
                  action={
                    countsLoaded && totalCount > 0 ? (
                      <Button onClick={() => selectStage("ALL")}>Show all applications</Button>
                    ) : undefined
                  }
                />
              )}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="border-t border-[var(--av2-border)]">
              <EmptyState
                title="No applications match your search"
                description="Try a different name, email or country."
                action={<Button onClick={() => setQuery("")}>Clear search</Button>}
              />
            </div>
          ) : (
            <Table label="Talent applications">
              <thead>
                <tr>
                  <Th>Applicant</Th>
                  {wideList && <Th>Applied for</Th>}
                  <Th>Status</Th>
                  {wideList && <Th>Country</Th>}
                  <Th>Submitted</Th>
                  <Th align="right">
                    <span className="sr-only">Open</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((it) => {
                  const meta = STATUS_META[it.status];
                  const cats = formatList(it.categoryIds).map(categoryLabel);
                  return (
                    <Tr
                      key={it.id}
                      selected={it.id === selectedId}
                      onSelect={() => {
                        if (it.id !== selectedId) setTab("overview");
                        setSelectedId(it.id);
                      }}
                      label={`${it.fullName}, ${meta.label}, submitted ${formatDateTime(it.createdAt)}`}
                    >
                      <Td>
                        <div className="flex items-center gap-3">
                          <Avatar name={it.fullName} size={36} />
                          <div className="min-w-0">
                            <div className="truncate font-semibold">{it.fullName}</div>
                            <div className="truncate text-xs text-[var(--av2-text-2)]">
                              {it.email}
                            </div>
                            {it.existingCustomer && (
                              <Badge tone="amber" className="mt-1">
                                Existing customer
                              </Badge>
                            )}
                          </div>
                        </div>
                      </Td>
                      {wideList && (
                        <Td className="max-w-[220px]">
                          {cats.length > 0 ? (
                            <span className="block truncate" title={cats.join(", ")}>
                              {cats[0]}
                              {cats.length > 1 && (
                                <span className="text-[var(--av2-text-2)]">
                                  {" "}
                                  +{cats.length - 1}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-[var(--av2-text-2)]">{DASH}</span>
                          )}
                        </Td>
                      )}
                      <Td>
                        <Badge tone={meta.tone} dot>
                          {meta.label}
                        </Badge>
                      </Td>
                      {wideList && <Td>{it.country || DASH}</Td>}
                      <Td className="whitespace-nowrap tabular-nums">
                        <div>{formatDate(it.createdAt)}</div>
                        <div className="text-xs text-[var(--av2-text-2)]">
                          {formatTime(it.createdAt)}
                        </div>
                      </Td>
                      <Td align="right" className="text-[var(--av2-text-2)]">
                        <span className="inline-flex">
                          <IconChevronRight />
                        </span>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          )}

          {items.length > 0 && (
            <TableFooter>
              <span className="tabular-nums">
                Showing {fmt(filteredItems.length)} of {fmt(items.length)} in {viewLabel}
              </span>
              {!selected && <span>Select a candidate to review and act.</span>}
            </TableFooter>
          )}
        </Card>
      </SplitView>
    </div>
  );
}
