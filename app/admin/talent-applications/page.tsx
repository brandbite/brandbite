// -----------------------------------------------------------------------------
// @file: app/admin/talent-applications/page.tsx
// @purpose: Admin queue for the talent application form. List on the left,
//           inline detail panel on the right. Two actions per submission:
//           Accept (asks for an interview slot, creates the Google Cal event
//           with Meet, sends the candidate the branded follow-up email) or
//           Decline (optional reason, sends the polite rejection).
//
//           Visible to SITE_ADMIN (the OwnerOnlyBanner explains the action
//           is restricted) but actions are SITE_OWNER-only — the API layer
//           enforces the gate via canManageTalentApplications.
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { OwnerOnlyBanner } from "@/components/admin/owner-only-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, TD, TH, THead } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FormInput, FormTextarea } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { LoadingState } from "@/components/ui/loading-state";
import { useToast } from "@/components/ui/toast-provider";

// Mirror the API response shape. We avoid importing the route module
// because Next.js client components can't import server-only modules
// (the route imports prisma).
type TalentApplicationStatus =
  | "SUBMITTED"
  | "IN_REVIEW"
  | "AWAITING_CANDIDATE_CHOICE"
  | "CANDIDATE_PROPOSED_TIME"
  | "ACCEPTED"
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

type Filter = TalentApplicationStatus | "ALL";

const STATUS_LABELS: Record<TalentApplicationStatus, string> = {
  SUBMITTED: "New",
  IN_REVIEW: "In review",
  AWAITING_CANDIDATE_CHOICE: "Awaiting candidate",
  CANDIDATE_PROPOSED_TIME: "Candidate proposed",
  ACCEPTED: "Accepted",
  INTERVIEW_HELD: "Interview held",
  HIRED: "Hired",
  ONBOARDED: "Onboarded",
  DECLINED: "Declined",
  REJECTED_AFTER_INTERVIEW: "Declined (post-interview)",
};

const STATUS_BADGE_VARIANT: Record<
  TalentApplicationStatus,
  "info" | "primary" | "success" | "neutral" | "warning"
> = {
  SUBMITTED: "info",
  IN_REVIEW: "primary",
  AWAITING_CANDIDATE_CHOICE: "primary",
  CANDIDATE_PROPOSED_TIME: "warning",
  ACCEPTED: "success",
  INTERVIEW_HELD: "warning",
  HIRED: "success",
  ONBOARDED: "success",
  DECLINED: "neutral",
  REJECTED_AFTER_INTERVIEW: "neutral",
};

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
  if (!iso) return "—";
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

export default function TalentApplicationsPage() {
  const toast = useToast();

  const [items, setItems] = useState<Application[]>([]);
  const [filter, setFilter] = useState<Filter>("SUBMITTED");
  // Per-status counts across the entire table — populated from the API
  // response on each load so the filter chips can show "(N)" badges
  // for buckets the user isn't currently viewing.
  const [statusCounts, setStatusCounts] = useState<
    Partial<Record<TalentApplicationStatus, number>>
  >({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Detail panel: id of the row currently expanded inline.
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const url = new URL("/api/admin/talent-applications", window.location.origin);
      url.searchParams.set("status", filter);
      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      const json = (await res.json()) as {
        applications: Application[];
        total: number;
        counts?: Partial<Record<TalentApplicationStatus, number>>;
      };
      setItems(json.applications);
      // Per-status counts are the new source of truth for the chip
      // badges; the old top-of-header "(N)" beside the dropdown is gone.
      if (json.counts) setStatusCounts(json.counts);
    } catch (err) {
      console.error("[admin/talent] load failed", err);
      setLoadError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [filter]);

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
    setWorkingHoursLocal("");
    setHireNotesLocal("");
    setActionStatus("idle");
    setActionError(null);

    const sel = items.find((it) => it.id === selectedId);
    if (sel?.status === "INTERVIEW_HELD") {
      // Pre-fill HIRE form from the application data.
      const applied = Array.isArray(sel.categoryIds)
        ? (sel.categoryIds as unknown[]).filter((v): v is string => typeof v === "string")
        : [];
      setApprovedCategoryIdsLocal(applied);
      setTasksPerWeekCapLocal(String(defaultTasksCapForBucket(sel.preferredTasksPerWeek)));
    } else {
      setApprovedCategoryIdsLocal([]);
      setTasksPerWeekCapLocal("");
    }
  }, [selectedId, items]);

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

  // Filter chips ordered by the actual hiring funnel — left-to-right
  // walks a candidate's journey from first submission to onboarded
  // creative, with the two terminal "no" states tucked at the end
  // before the catch-all. The tone still encodes urgency at a glance
  // (orange = your turn to act, blue = waiting on the candidate, green
  // = positive outcome, slate = closed-no), but the order itself is
  // now narrative so a new operator can read it like a process diagram.
  //
  //   1. SUBMITTED                    new application landed
  //   2. IN_REVIEW                    admin is looking it over
  //   3. AWAITING_CANDIDATE_CHOICE    admin offered 3 slots, waiting
  //   4. CANDIDATE_PROPOSED_TIME      candidate countered with own time
  //   5. ACCEPTED                     slot booked, interview scheduled
  //   6. INTERVIEW_HELD               call done, hire/no-hire pending
  //   7. HIRED                        we said yes, onboarding next
  //   8. ONBOARDED                    UserAccount created, in the system
  //   9. DECLINED                     pre-interview rejection
  //  10. REJECTED_AFTER_INTERVIEW     post-interview rejection
  //  11. ALL                          full table
  const FILTER_CHIPS: Array<{
    key: Filter;
    label: string;
    tone: "action" | "wait" | "done" | "decline" | "all";
  }> = [
    { key: "SUBMITTED", label: "New", tone: "action" },
    { key: "IN_REVIEW", label: "In review", tone: "action" },
    { key: "AWAITING_CANDIDATE_CHOICE", label: "Awaiting candidate", tone: "wait" },
    { key: "CANDIDATE_PROPOSED_TIME", label: "Candidate proposed", tone: "action" },
    { key: "ACCEPTED", label: "Accepted", tone: "wait" },
    { key: "INTERVIEW_HELD", label: "Interview held", tone: "action" },
    { key: "HIRED", label: "Hired", tone: "done" },
    { key: "ONBOARDED", label: "Onboarded", tone: "done" },
    { key: "DECLINED", label: "Declined", tone: "decline" },
    { key: "REJECTED_AFTER_INTERVIEW", label: "Declined post-interview", tone: "decline" },
    { key: "ALL", label: "All", tone: "all" },
  ];

  // Tone → tailwind classes for the active and inactive chip states.
  // Active: solid coloured background, white text.
  // Inactive: bordered, muted text, faint coloured dot for tone hint.
  const TONE_STYLES: Record<
    (typeof FILTER_CHIPS)[number]["tone"],
    { active: string; dot: string }
  > = {
    action: {
      active: "bg-[var(--bb-primary)] text-white border-[var(--bb-primary)]",
      dot: "bg-[var(--bb-primary)]",
    },
    wait: {
      active: "bg-blue-600 text-white border-blue-600",
      dot: "bg-blue-500",
    },
    done: {
      active: "bg-emerald-600 text-white border-emerald-600",
      dot: "bg-emerald-500",
    },
    decline: {
      active: "bg-slate-600 text-white border-slate-600",
      dot: "bg-slate-400",
    },
    all: {
      active: "bg-[var(--bb-secondary)] text-white border-[var(--bb-secondary)]",
      dot: "bg-[var(--bb-text-muted)]",
    },
  };

  function chipCount(key: Filter): number {
    if (key === "ALL") {
      return Object.values(statusCounts).reduce<number>((a, b) => a + (b ?? 0), 0);
    }
    return statusCounts[key] ?? 0;
  }

  return (
    <div className="space-y-5">
      {/* Header — title + concise description on one row, refresh
          tucked at the right. The previous design squeezed a long
          dropdown next to a long description, which is what made the
          status filter so easy to miss. */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-[var(--bb-secondary)]">Talent applications</h1>
          <p className="mt-1 text-sm text-[var(--bb-text-secondary)]">
            Review submissions from the public /talent form. Pick a status below to triage.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void refresh()}
          aria-label="Refresh applications"
        >
          ↻ Refresh
        </Button>
      </header>

      {/* Filter chips — each lifecycle status as its own chip with a
          live count. Horizontally scrollable on mobile (no clipping,
          no need for a hidden dropdown), wraps on desktop. Active chip
          is filled in the bucket's tone; inactive chips show a small
          coloured dot so the tone is still readable. */}
      <nav
        aria-label="Filter applications by status"
        className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"
      >
        <div className="flex flex-nowrap gap-2 sm:flex-wrap">
          {FILTER_CHIPS.map((chip) => {
            const count = chipCount(chip.key);
            const active = filter === chip.key;
            const styles = TONE_STYLES[chip.tone];
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => {
                  setFilter(chip.key);
                  setSelectedId(null);
                }}
                aria-pressed={active}
                className={[
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                  active
                    ? styles.active
                    : "border-[var(--bb-border)] bg-[var(--bb-bg-card)] text-[var(--bb-text-secondary)] hover:border-[var(--bb-primary)] hover:text-[var(--bb-secondary)]",
                ].join(" ")}
              >
                {!active && (
                  <span
                    aria-hidden="true"
                    className={`inline-block h-1.5 w-1.5 rounded-full ${styles.dot}`}
                  />
                )}
                <span>{chip.label}</span>
                {count > 0 && (
                  <span
                    className={[
                      "inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                      active
                        ? "bg-white/20 text-white"
                        : "bg-[var(--bb-bg-page)] text-[var(--bb-text-secondary)]",
                    ].join(" ")}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      <OwnerOnlyBanner action="accept or decline talent applications" />

      {loadError && (
        <InlineAlert variant="error" title="Couldn't load applications">
          {loadError}
        </InlineAlert>
      )}

      {loading ? (
        <LoadingState message="Loading applications…" />
      ) : items.length === 0 ? (
        <EmptyState
          title="No applications in this view"
          description="When candidates submit the public form at /talent, they'll show up here."
        />
      ) : (
        <DataTable>
          <THead>
            <TH>Candidate</TH>
            <TH className="w-[110px]">Status</TH>
            <TH className="w-[180px]">Submitted</TH>
            <TH className="w-[140px]">Country</TH>
            <TH align="right" className="w-[90px]">
              Action
            </TH>
          </THead>
          <tbody>
            {items.map((it) => {
              const isSelected = it.id === selectedId;
              return (
                <>
                  <tr key={it.id} className={isSelected ? "bg-[var(--bb-bg-warm)]" : undefined}>
                    <TD>
                      <div className="font-medium text-[var(--bb-secondary)]">{it.fullName}</div>
                      <div className="flex items-center gap-2 text-xs text-[var(--bb-text-muted)]">
                        <span>{it.email}</span>
                        {it.existingCustomer && <Badge variant="warning">Existing customer</Badge>}
                      </div>
                    </TD>
                    <TD>
                      <Badge variant={STATUS_BADGE_VARIANT[it.status]}>
                        {STATUS_LABELS[it.status]}
                      </Badge>
                    </TD>
                    <TD>
                      <span className="text-xs text-[var(--bb-text-secondary)]">
                        {formatDateTime(it.createdAt)}
                      </span>
                    </TD>
                    <TD>
                      <span className="text-xs text-[var(--bb-text-secondary)]">{it.country}</span>
                    </TD>
                    <TD align="right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedId(isSelected ? null : it.id)}
                      >
                        {isSelected ? "Hide" : "Open"}
                      </Button>
                    </TD>
                  </tr>
                  {isSelected && (
                    <tr key={`${it.id}-detail`}>
                      <td colSpan={5} className="bg-[var(--bb-bg-warm)] p-6">
                        <DetailPanel
                          item={it}
                          categoryNames={categoryNames}
                          proposedSlotsLocal={proposedSlotsLocal}
                          onProposedSlotChange={(idx, v) =>
                            setProposedSlotsLocal((prev) => {
                              const next = [...prev];
                              next[idx] = v;
                              return next;
                            })
                          }
                          customMessage={customMessage}
                          onCustomMessageChange={setCustomMessage}
                          declineReason={declineReason}
                          onDeclineReasonChange={setDeclineReason}
                          workingHoursLocal={workingHoursLocal}
                          onWorkingHoursChange={setWorkingHoursLocal}
                          approvedCategoryIdsLocal={approvedCategoryIdsLocal}
                          onApprovedCategoriesChange={setApprovedCategoryIdsLocal}
                          tasksPerWeekCapLocal={tasksPerWeekCapLocal}
                          onTasksPerWeekCapChange={setTasksPerWeekCapLocal}
                          hireNotesLocal={hireNotesLocal}
                          onHireNotesChange={setHireNotesLocal}
                          actionStatus={actionStatus}
                          actionError={actionError}
                          onAccept={handleAccept}
                          onAcceptProposed={handleAcceptProposed}
                          onDecline={handleDecline}
                          onMarkInterviewHeld={handleMarkInterviewHeld}
                          onHire={handleHire}
                          onRejectPostInterview={handleRejectPostInterview}
                          onOnboard={handleOnboard}
                        />
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </DataTable>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail panel — every field on the application + the action controls.
// ---------------------------------------------------------------------------

function DetailPanel({
  item,
  categoryNames,
  proposedSlotsLocal,
  onProposedSlotChange,
  customMessage,
  onCustomMessageChange,
  declineReason,
  onDeclineReasonChange,
  workingHoursLocal,
  onWorkingHoursChange,
  approvedCategoryIdsLocal,
  onApprovedCategoriesChange,
  tasksPerWeekCapLocal,
  onTasksPerWeekCapChange,
  hireNotesLocal,
  onHireNotesChange,
  actionStatus,
  actionError,
  onAccept,
  onAcceptProposed,
  onDecline,
  onMarkInterviewHeld,
  onHire,
  onRejectPostInterview,
  onOnboard,
}: {
  item: Application;
  categoryNames: Map<string, string>;
  proposedSlotsLocal: string[];
  onProposedSlotChange: (idx: number, v: string) => void;
  customMessage: string;
  onCustomMessageChange: (v: string) => void;
  declineReason: string;
  onDeclineReasonChange: (v: string) => void;
  workingHoursLocal: string;
  onWorkingHoursChange: (v: string) => void;
  approvedCategoryIdsLocal: string[];
  onApprovedCategoriesChange: (v: string[]) => void;
  tasksPerWeekCapLocal: string;
  onTasksPerWeekCapChange: (v: string) => void;
  hireNotesLocal: string;
  onHireNotesChange: (v: string) => void;
  actionStatus: "idle" | "submitting";
  actionError: string | null;
  onAccept: () => void;
  onAcceptProposed: () => void;
  onDecline: () => void;
  onMarkInterviewHeld: () => void;
  onHire: () => void;
  onRejectPostInterview: () => void;
  onOnboard: () => void;
}) {
  // Action availability matrix. Re-derived per render so a status change
  // (after a submitAction → refresh → status update) immediately flips
  // which panels are visible.
  //   - SUBMITTED / IN_REVIEW: offer 3 slots (ACCEPT) or DECLINE
  //   - AWAITING_CANDIDATE_CHOICE: DECLINE (revoking the offer)
  //   - CANDIDATE_PROPOSED_TIME: ACCEPT_PROPOSED or DECLINE
  //   - ACCEPTED (PR9): MARK_INTERVIEW_HELD or REJECT_POST_INTERVIEW (no-show path)
  //   - INTERVIEW_HELD (PR9): HIRE or REJECT_POST_INTERVIEW
  //   - HIRED / ONBOARDED / DECLINED / REJECTED_AFTER_INTERVIEW: terminal info
  const canOfferSlots = item.status === "SUBMITTED" || item.status === "IN_REVIEW";
  const canConfirmProposed = item.status === "CANDIDATE_PROPOSED_TIME";
  const canDecline =
    item.status === "SUBMITTED" ||
    item.status === "IN_REVIEW" ||
    item.status === "AWAITING_CANDIDATE_CHOICE" ||
    item.status === "CANDIDATE_PROPOSED_TIME";
  // PR9 — post-interview action gates.
  const canMarkInterviewHeld = item.status === "ACCEPTED";
  const canHire = item.status === "INTERVIEW_HELD";
  const canRejectPostInterview = item.status === "ACCEPTED" || item.status === "INTERVIEW_HELD";

  // Resolve applied categories to display names for the HIRE form's
  // multi-select. Same lookup as the read-only "Skills" section above.
  const appliedCategoryIds = formatList(item.categoryIds);
  const appliedCategoryOptions = appliedCategoryIds.map((id) => ({
    id,
    name: categoryNames.get(id) ?? "(removed)",
  }));
  const social = formatList(item.socialLinks);
  const categoryIds = formatList(item.categoryIds);
  // Resolve raw cuids to human category names; show "(removed)" for any
  // ID that no longer maps (category was deleted/deactivated since the
  // candidate submitted). Falling back to the raw ID would expose
  // implementation detail to the admin reading the page.
  const categories = categoryIds.map((id) => categoryNames.get(id) ?? "(removed)");
  const tools = formatList(item.tools);
  const workedWith = formatList(item.workedWith);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* ----- Left: candidate snapshot ----- */}
      <div className="space-y-4">
        {item.existingCustomer && (
          <InlineAlert variant="warning" title="Existing customer email">
            This applicant&apos;s email matches a registered Brandbite UserAccount. Could be
            intentional (a customer joining the team) or accidental (used their work email by
            mistake). Worth a check before acting.
          </InlineAlert>
        )}
        <SectionHeading>Contact</SectionHeading>
        <KeyValue label="Email" value={<a href={`mailto:${item.email}`}>{item.email}</a>} />
        <KeyValue label="WhatsApp" value={item.whatsappNumber} />
        <KeyValue label="Country" value={item.country} />
        <KeyValue label="Timezone" value={item.timezone} />

        <SectionHeading>Portfolio</SectionHeading>
        <KeyValue label="Portfolio" value={<ExternalLink href={item.portfolioUrl} />} />
        {item.linkedinUrl && (
          <KeyValue label="LinkedIn" value={<ExternalLink href={item.linkedinUrl} />} />
        )}
        {social.length > 0 && (
          <KeyValue
            label="Other links"
            value={
              <ul className="space-y-0.5">
                {social.map((url) => (
                  <li key={url}>
                    <ExternalLink href={url} />
                  </li>
                ))}
              </ul>
            }
          />
        )}

        <SectionHeading>Skills</SectionHeading>
        <KeyValue
          label={`Categories (${categories.length})`}
          value={
            categories.length > 0 ? (
              <span className="text-xs text-[var(--bb-text-muted)]">{categories.join(", ")}</span>
            ) : (
              "—"
            )
          }
        />

        <SectionHeading>Experience</SectionHeading>
        <KeyValue label="Total years" value={item.totalYears} />
        <KeyValue
          label="Remote experience"
          value={item.hasRemoteExp ? `Yes (${item.yearsRemote ?? "?"} years)` : "No"}
        />
        <KeyValue
          label="Worked at / with"
          value={workedWith.length > 0 ? workedWith.join(", ") : "—"}
        />

        <SectionHeading>Availability</SectionHeading>
        <KeyValue label="Workload" value={item.workload.replace("_", "-").toLowerCase()} />
        {item.preferredTasksPerWeek && (
          <KeyValue label="Tasks per week" value={item.preferredTasksPerWeek} />
        )}

        <SectionHeading>Turnaround</SectionHeading>
        <KeyValue label="24-48h ok?" value={item.turnaroundOk ? "Yes" : "No"} />
        {item.turnaroundComment && <KeyValue label="Comment" value={item.turnaroundComment} />}

        <SectionHeading>Tools</SectionHeading>
        <KeyValue label="Selected" value={tools.length > 0 ? tools.join(", ") : "—"} />
        {item.toolsOther && <KeyValue label="Other" value={item.toolsOther} />}

        <SectionHeading>Other</SectionHeading>
        <KeyValue label="Open to test task?" value={item.testTaskOk ? "Yes" : "No"} />
        <KeyValue
          label="Submitted"
          value={`${formatDateTime(item.createdAt)} · ${item.ipAddress ?? "no IP"}`}
        />
      </div>

      {/* ----- Right: action panel ----- */}
      <div className="space-y-6">
        {/* Awaiting-candidate state — admin already offered slots, candidate hasn't picked. */}
        {item.status === "AWAITING_CANDIDATE_CHOICE" && (
          <InlineAlert variant="info" title="Awaiting candidate">
            <div className="space-y-1 text-sm">
              <div>3 slots offered. Booking link expires:</div>
              <div className="text-xs text-[var(--bb-text-muted)]">
                {formatDateTime(item.bookingTokenExpiresAt)}
              </div>
              <div className="text-xs text-[var(--bb-text-muted)]">
                Sent by {item.reviewedByUserEmail ?? "—"} · {formatDateTime(item.reviewedAt)}
              </div>
            </div>
          </InlineAlert>
        )}

        {/* Candidate-proposed state — primary action surface for this status. */}
        {item.status === "CANDIDATE_PROPOSED_TIME" && (
          <div className="space-y-3 rounded-xl border border-[var(--bb-warning-border)] bg-[var(--bb-warning-bg)] p-4">
            <div>
              <SectionHeading>Candidate proposed a time</SectionHeading>
              <p className="mt-1 text-sm text-[var(--bb-secondary)]">
                <strong>{formatDateTime(item.candidateProposedAt, item.timezone)}</strong> (
                {item.timezone})
              </p>
              {item.customMessage && (
                <p className="mt-2 text-sm text-[var(--bb-text-secondary)] italic">
                  &ldquo;{item.customMessage}&rdquo;
                </p>
              )}
            </div>
            <Button
              className="w-full"
              onClick={onAcceptProposed}
              loading={actionStatus === "submitting"}
              loadingText="Booking…"
              disabled={actionStatus === "submitting"}
            >
              Confirm this time &amp; book interview
            </Button>
            <p className="text-xs text-[var(--bb-text-muted)]">
              Or counter-propose by offering 3 fresh slots below.
            </p>
          </div>
        )}

        {item.status === "ACCEPTED" && (
          <InlineAlert variant="success" title="Interview booked">
            <div className="space-y-1 text-sm">
              <div>
                <strong>When:</strong> {formatDateTime(item.interviewAt, item.timezone)} (
                {item.timezone})
              </div>
              {item.meetLink && (
                <div>
                  <strong>Meet:</strong> <ExternalLink href={item.meetLink} />
                </div>
              )}
              <div className="text-xs text-[var(--bb-text-muted)]">
                Booked by {item.reviewedByUserEmail ?? "—"} · {formatDateTime(item.reviewedAt)}
              </div>
            </div>
          </InlineAlert>
        )}

        {item.status === "DECLINED" && (
          <InlineAlert variant="warning" title="Application declined">
            <div className="space-y-1 text-sm">
              {item.declineReason && (
                <div>
                  <strong>Reason sent:</strong> {item.declineReason}
                </div>
              )}
              <div className="text-xs text-[var(--bb-text-muted)]">
                Declined by {item.reviewedByUserEmail ?? "—"} · {formatDateTime(item.reviewedAt)}
              </div>
            </div>
          </InlineAlert>
        )}

        {/* PR9 terminal info panels. */}
        {item.status === "INTERVIEW_HELD" && (
          <InlineAlert variant="info" title="Interview held — decision pending">
            <div className="text-xs text-[var(--bb-text-muted)]">
              Marked held · awaiting hire / decline. Use the Hire form below or &ldquo;Decline after
              interview&rdquo;.
            </div>
          </InlineAlert>
        )}

        {item.status === "HIRED" && (
          <div className="space-y-3 rounded-xl border border-[var(--bb-success-border)] bg-[var(--bb-success-bg)] p-4">
            <SectionHeading>Hired — ready to onboard</SectionHeading>
            <div className="space-y-1 text-sm text-[var(--bb-secondary)]">
              {item.workingHours && (
                <div>
                  <strong>Working hours:</strong> {item.workingHours}
                </div>
              )}
              {item.approvedTasksPerWeekCap != null && (
                <div>
                  <strong>Tasks/week cap:</strong> {item.approvedTasksPerWeekCap}
                </div>
              )}
              {Array.isArray(item.approvedCategoryIds) && item.approvedCategoryIds.length > 0 && (
                <div>
                  <strong>Approved categories:</strong>{" "}
                  {formatList(item.approvedCategoryIds)
                    .map((id) => categoryNames.get(id) ?? "(removed)")
                    .join(", ")}
                </div>
              )}
              {item.hireNotes && (
                <div className="text-xs text-[var(--bb-text-secondary)] italic">
                  Note: {item.hireNotes}
                </div>
              )}
              <div className="text-xs text-[var(--bb-text-muted)]">
                Hired by {item.hiredByUserEmail ?? "—"} · {formatDateTime(item.hiredAt)}
              </div>
            </div>
            <Button
              className="w-full"
              onClick={onOnboard}
              loading={actionStatus === "submitting"}
              loadingText="Onboarding…"
              disabled={actionStatus === "submitting"}
            >
              Onboard now &middot; create UserAccount + send sign-in
            </Button>
            <p className="text-xs text-[var(--bb-text-muted)]">
              Creates a DESIGNER UserAccount, seeds CreativeSkill rows from the approved categories,
              mirrors the tasks/week cap, sends magic-link + branded welcome email. Refuses if the
              email is already a customer.
            </p>
          </div>
        )}

        {item.status === "ONBOARDED" && (
          <InlineAlert variant="success" title="Onboarded creative">
            <div className="text-xs text-[var(--bb-text-muted)]">
              UserAccount linked: {item.hiredUserAccountId ?? "—"}. Manage at /admin/users.
            </div>
          </InlineAlert>
        )}

        {item.status === "REJECTED_AFTER_INTERVIEW" && (
          <InlineAlert variant="warning" title="Declined after interview">
            <div className="space-y-1 text-sm">
              {item.declineReason && (
                <div>
                  <strong>Reason sent:</strong> {item.declineReason}
                </div>
              )}
              <div className="text-xs text-[var(--bb-text-muted)]">
                Declined by {item.reviewedByUserEmail ?? "—"} · {formatDateTime(item.reviewedAt)}
              </div>
            </div>
          </InlineAlert>
        )}

        {/* PR9 — MARK_INTERVIEW_HELD on ACCEPTED rows. */}
        {canMarkInterviewHeld && (
          <div className="rounded-xl border border-[var(--bb-border-subtle)] bg-[var(--bb-bg-card)] p-4">
            <SectionHeading>Did the interview happen?</SectionHeading>
            <p className="mt-1 mb-3 text-xs text-[var(--bb-text-muted)]">
              Click &ldquo;Yes&rdquo; to unlock the Hire form. Click &ldquo;No-show&rdquo; to skip
              straight to the soft-toned post-interview decline.
            </p>
            <div className="flex gap-2">
              <Button
                onClick={onMarkInterviewHeld}
                loading={actionStatus === "submitting"}
                loadingText="Saving…"
                disabled={actionStatus === "submitting"}
              >
                Yes, mark held
              </Button>
              <Button
                variant="danger"
                onClick={onRejectPostInterview}
                loading={actionStatus === "submitting"}
                loadingText="Sending…"
                disabled={actionStatus === "submitting"}
              >
                No-show — decline
              </Button>
            </div>
          </div>
        )}

        {/* PR9 — HIRE form on INTERVIEW_HELD rows. */}
        {canHire && (
          <div className="rounded-xl border border-[var(--bb-border-subtle)] bg-[var(--bb-bg-card)] p-4">
            <SectionHeading>Hire &amp; capture onboarding terms</SectionHeading>
            <p className="mt-1 mb-3 text-xs text-[var(--bb-text-muted)]">
              Captures the negotiated terms. The next PR&apos;s onboarding orchestrator turns these
              into a real DESIGNER UserAccount + CreativeSkill rows + magic-link sign-in email.
            </p>

            <label className="mb-3 block">
              <span className="mb-1 block text-xs font-medium text-[var(--bb-text-secondary)]">
                Working hours
              </span>
              <FormInput
                value={workingHoursLocal}
                onChange={(e) => onWorkingHoursChange(e.target.value)}
                placeholder={`e.g. 9-18 weekdays ${item.timezone}`}
                maxLength={200}
              />
            </label>

            <fieldset className="mb-3">
              <legend className="mb-1 text-xs font-medium text-[var(--bb-text-secondary)]">
                Approved categories ({approvedCategoryIdsLocal.length} of{" "}
                {appliedCategoryOptions.length})
              </legend>
              <div className="space-y-1.5">
                {appliedCategoryOptions.map((opt) => {
                  const checked = approvedCategoryIdsLocal.includes(opt.id);
                  return (
                    <label key={opt.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            onApprovedCategoriesChange([
                              ...approvedCategoryIdsLocal.filter((id) => id !== opt.id),
                              opt.id,
                            ]);
                          } else {
                            onApprovedCategoriesChange(
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
              <p className="mt-1 text-[11px] text-[var(--bb-text-muted)]">
                Pre-filled with everything the candidate applied for. Deselect any you&apos;re not
                hiring them for.
              </p>
            </fieldset>

            <label className="mb-3 block">
              <span className="mb-1 block text-xs font-medium text-[var(--bb-text-secondary)]">
                Tasks per week cap{" "}
                <span className="text-[var(--bb-text-muted)]">
                  (applied bucket: {item.preferredTasksPerWeek ?? "—"})
                </span>
              </span>
              <FormInput
                type="number"
                inputMode="numeric"
                min={1}
                max={40}
                value={tasksPerWeekCapLocal}
                onChange={(e) => onTasksPerWeekCapChange(e.target.value)}
                placeholder="e.g. 4"
              />
            </label>

            <label className="mb-3 block">
              <span className="mb-1 block text-xs font-medium text-[var(--bb-text-secondary)]">
                Internal hire notes (optional)
              </span>
              <FormTextarea
                rows={3}
                value={hireNotesLocal}
                onChange={(e) => onHireNotesChange(e.target.value)}
                placeholder="Negotiated rate, contract terms, anything for the team to remember. Not shown to the candidate."
                maxLength={2000}
              />
            </label>

            <div className="flex gap-2">
              <Button
                onClick={onHire}
                loading={actionStatus === "submitting"}
                loadingText="Hiring…"
                disabled={
                  actionStatus === "submitting" ||
                  !workingHoursLocal.trim() ||
                  approvedCategoryIdsLocal.length === 0
                }
              >
                Hire
              </Button>
              <Button
                variant="danger"
                onClick={onRejectPostInterview}
                loading={actionStatus === "submitting"}
                loadingText="Sending…"
                disabled={actionStatus === "submitting"}
              >
                Decline after interview
              </Button>
            </div>
          </div>
        )}

        {/* PR9 — REJECT_POST_INTERVIEW reason field. Shown on ACCEPTED +
            INTERVIEW_HELD so admin can add a reason before clicking the
            decline button rendered above (in either the held-or-no-show
            panel or the Hire form). Reuses `declineReason` state. */}
        {canRejectPostInterview && (
          <div className="rounded-xl border border-[var(--bb-border-subtle)] bg-[var(--bb-bg-card)] p-4">
            <SectionHeading>Optional decline reason</SectionHeading>
            <p className="mt-1 mb-3 text-xs text-[var(--bb-text-muted)]">
              Surfaced verbatim in the post-interview decline email above the standard copy. Leave
              blank for the generic version.
            </p>
            <FormTextarea
              rows={3}
              value={declineReason}
              onChange={(e) => onDeclineReasonChange(e.target.value)}
              placeholder="e.g. The motion-graphics work you showed was great — we just don't have steady volume in that lane this quarter."
              maxLength={500}
            />
          </div>
        )}

        {/* ACCEPT — offer 3 slots. Available on SUBMITTED / IN_REVIEW only. */}
        {canOfferSlots && (
          <div className="rounded-xl border border-[var(--bb-border-subtle)] bg-[var(--bb-bg-card)] p-4">
            <SectionHeading>Accept &amp; offer 3 slots</SectionHeading>
            <p className="mt-1 mb-3 text-xs text-[var(--bb-text-muted)]">
              Offer the candidate three 30-minute slots. They&apos;ll get an email with a tokenized
              link to pick one (or propose another time). Calendar event is created when they pick.
              Times are in your local timezone; the candidate sees them in theirs.
            </p>
            <div className="space-y-2">
              {[0, 1, 2].map((idx) => (
                <FormInput
                  key={idx}
                  type="datetime-local"
                  value={proposedSlotsLocal[idx] ?? ""}
                  onChange={(e) => onProposedSlotChange(idx, e.target.value)}
                  aria-label={`Slot ${idx + 1}`}
                  placeholder={`Slot ${idx + 1}`}
                />
              ))}
            </div>
            <div className="mt-3">
              <FormTextarea
                rows={3}
                value={customMessage}
                onChange={(e) => onCustomMessageChange(e.target.value)}
                placeholder="Optional personal note for the email — e.g. 'Loved your motion reel — really excited to chat.'"
                maxLength={500}
                aria-label="Custom message (optional)"
              />
            </div>
            <Button
              className="mt-3 w-full"
              onClick={onAccept}
              loading={actionStatus === "submitting"}
              loadingText="Sending…"
              disabled={proposedSlotsLocal.some((s) => !s) || actionStatus === "submitting"}
            >
              Accept &amp; email booking link
            </Button>
          </div>
        )}

        {/* DECLINE — available pre-final. */}
        {canDecline && (
          <div className="rounded-xl border border-[var(--bb-border-subtle)] bg-[var(--bb-bg-card)] p-4">
            <SectionHeading>Decline politely</SectionHeading>
            <p className="mt-1 mb-3 text-xs text-[var(--bb-text-muted)]">
              Optional one-line reason — surfaced verbatim in the email above the generic copy.
              Leave blank to send the standard rejection.
            </p>
            <FormTextarea
              rows={3}
              value={declineReason}
              onChange={(e) => onDeclineReasonChange(e.target.value)}
              placeholder="e.g. We're focused on motion designers this quarter."
              maxLength={500}
              aria-label="Decline reason (optional)"
            />
            <Button
              variant="danger"
              className="mt-3 w-full"
              onClick={onDecline}
              loading={actionStatus === "submitting"}
              loadingText="Sending…"
              disabled={actionStatus === "submitting"}
            >
              Decline &amp; send email
            </Button>
          </div>
        )}

        {actionError &&
          (canOfferSlots ||
            canConfirmProposed ||
            canDecline ||
            canMarkInterviewHeld ||
            canHire ||
            canRejectPostInterview ||
            item.status === "HIRED") && (
            <InlineAlert variant="error" title="Action failed">
              {actionError}
            </InlineAlert>
          )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tiny helpers — kept inline because they're not reused outside this page.
// ---------------------------------------------------------------------------

// Section header for the detail panel. Polish round 1: scale up size +
// contrast and add a top divider so the eight sections (Contact /
// Portfolio / Skills / Experience / …) read as discrete blocks rather
// than a flat run of label-value rows. The first heading suppresses its
// top border via the `:first-of-type` selector applied at the parent so
// nothing nests against the panel's outer padding.
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-4 flex items-center gap-2 border-t border-[var(--bb-border-subtle)] pt-3 text-xs font-bold tracking-[0.12em] text-[var(--bb-secondary)] uppercase first-of-type:mt-0 first-of-type:border-t-0 first-of-type:pt-0">
      <span className="inline-block h-2 w-1 rounded-full bg-[var(--bb-primary)]" aria-hidden />
      {children}
    </h3>
  );
}

function KeyValue({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 text-sm">
      <span className="text-[var(--bb-text-muted)]">{label}</span>
      <span className="text-[var(--bb-secondary)]">{value}</span>
    </div>
  );
}

function ExternalLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="break-all text-[var(--bb-primary)] hover:underline"
    >
      {href}
    </a>
  );
}
