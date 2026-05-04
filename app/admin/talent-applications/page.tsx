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
import { FormInput, FormSelect, FormTextarea } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { LoadingState } from "@/components/ui/loading-state";
import { useToast } from "@/components/ui/toast-provider";

// Mirror the API response shape. We avoid importing the route module
// because Next.js client components can't import server-only modules
// (the route imports prisma).
type TalentApplicationStatus = "SUBMITTED" | "IN_REVIEW" | "ACCEPTED" | "DECLINED";

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
  createdAt: string;
  updatedAt: string;
};

type Filter = TalentApplicationStatus | "ALL";

const STATUS_LABELS: Record<TalentApplicationStatus, string> = {
  SUBMITTED: "New",
  IN_REVIEW: "In review",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
};

const STATUS_BADGE_VARIANT: Record<
  TalentApplicationStatus,
  "info" | "primary" | "success" | "neutral"
> = {
  SUBMITTED: "info",
  IN_REVIEW: "primary",
  ACCEPTED: "success",
  DECLINED: "neutral",
};

/** Format a stored array-shape `unknown` (Prisma JsonValue) into human
 *  text. Defensive — we never crash a row render because a JSON column
 *  came back unexpected. */
function formatList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
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
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<Filter>("SUBMITTED");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Detail panel: id of the row currently expanded inline.
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Per-action UI state — kept local because at most one action runs
  // at a time and the reset between selections is automatic.
  const [interviewLocal, setInterviewLocal] = useState(""); // datetime-local value
  const [declineReason, setDeclineReason] = useState("");
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
      const json = (await res.json()) as { applications: Application[]; total: number };
      setItems(json.applications);
      setTotal(json.total);
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
  // action), clear stale per-action UI state.
  useEffect(() => {
    setInterviewLocal("");
    setDeclineReason("");
    setActionStatus("idle");
    setActionError(null);
  }, [selectedId]);

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
      toast.showToast({
        type: "success",
        title:
          payload.action === "ACCEPT"
            ? "Interview booked. Candidate notified."
            : "Application declined.",
      });
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
    if (!interviewLocal) {
      setActionError("Pick a date and time for the interview.");
      return;
    }
    // datetime-local has no timezone. Convert to a UTC ISO string by
    // letting the browser interpret the local string in its own
    // timezone (which is the admin's), then `.toISOString()`.
    const interviewStartIso = new Date(interviewLocal).toISOString();
    void submitAction({ action: "ACCEPT", interviewStartIso });
  }

  function handleDecline() {
    void submitAction({
      action: "DECLINE",
      reason: declineReason.trim() || null,
    });
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--bb-secondary)]">Talent applications</h1>
          <p className="mt-1 text-sm text-[var(--bb-text-secondary)]">
            Review submissions from the public /talent form. Accept to book a 30-minute interview
            (Google Calendar + Meet); decline to send a polite rejection.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <FormSelect
            aria-label="Filter by status"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as Filter);
              setSelectedId(null);
            }}
          >
            <option value="SUBMITTED">
              New ({total > 0 && filter === "SUBMITTED" ? total : "—"})
            </option>
            <option value="IN_REVIEW">In review</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="DECLINED">Declined</option>
            <option value="ALL">All</option>
          </FormSelect>
          <Button variant="secondary" onClick={() => void refresh()}>
            Refresh
          </Button>
        </div>
      </header>

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
            <tr>
              <TH>Candidate</TH>
              <TH>Status</TH>
              <TH>Submitted</TH>
              <TH>Country</TH>
              <TH align="right">Action</TH>
            </tr>
          </THead>
          <tbody>
            {items.map((it) => {
              const isSelected = it.id === selectedId;
              return (
                <>
                  <tr key={it.id} className={isSelected ? "bg-[var(--bb-bg-warm)]" : undefined}>
                    <TD>
                      <div className="font-medium text-[var(--bb-secondary)]">{it.fullName}</div>
                      <div className="text-xs text-[var(--bb-text-muted)]">{it.email}</div>
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
                          interviewLocal={interviewLocal}
                          onInterviewChange={setInterviewLocal}
                          declineReason={declineReason}
                          onDeclineReasonChange={setDeclineReason}
                          actionStatus={actionStatus}
                          actionError={actionError}
                          onAccept={handleAccept}
                          onDecline={handleDecline}
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
  interviewLocal,
  onInterviewChange,
  declineReason,
  onDeclineReasonChange,
  actionStatus,
  actionError,
  onAccept,
  onDecline,
}: {
  item: Application;
  interviewLocal: string;
  onInterviewChange: (v: string) => void;
  declineReason: string;
  onDeclineReasonChange: (v: string) => void;
  actionStatus: "idle" | "submitting";
  actionError: string | null;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const isActionable = item.status === "SUBMITTED" || item.status === "IN_REVIEW";
  const social = formatList(item.socialLinks);
  const categories = formatList(item.categoryIds);
  const tools = formatList(item.tools);
  const workedWith = formatList(item.workedWith);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* ----- Left: candidate snapshot ----- */}
      <div className="space-y-4">
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
        <KeyValue label="Worked with" value={workedWith.length > 0 ? workedWith.join(", ") : "—"} />

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

        {isActionable && (
          <>
            <div className="rounded-xl border border-[var(--bb-border-subtle)] bg-[var(--bb-bg-card)] p-4">
              <SectionHeading>Accept &amp; book interview</SectionHeading>
              <p className="mt-1 mb-3 text-xs text-[var(--bb-text-muted)]">
                Pick a 30-minute slot. We&apos;ll create a Google Calendar event with a Meet link
                and notify the candidate. Times are in your local timezone; Google translates them
                for the candidate.
              </p>
              <FormInput
                type="datetime-local"
                value={interviewLocal}
                onChange={(e) => onInterviewChange(e.target.value)}
                aria-label="Interview start"
              />
              <Button
                className="mt-3 w-full"
                onClick={onAccept}
                loading={actionStatus === "submitting"}
                loadingText="Booking…"
                disabled={!interviewLocal || actionStatus === "submitting"}
              >
                Accept &amp; send invite
              </Button>
            </div>

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

            {actionError && (
              <InlineAlert variant="error" title="Action failed">
                {actionError}
              </InlineAlert>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tiny helpers — kept inline because they're not reused outside this page.
// ---------------------------------------------------------------------------

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold tracking-wider text-[var(--bb-text-muted)] uppercase">
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
