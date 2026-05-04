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
type TalentApplicationStatus =
  | "SUBMITTED"
  | "IN_REVIEW"
  | "AWAITING_CANDIDATE_CHOICE"
  | "CANDIDATE_PROPOSED_TIME"
  | "ACCEPTED"
  | "DECLINED";

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
  DECLINED: "Declined",
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
  // PR4: ACCEPT now offers 3 slots + a custom message instead of booking
  // a single time. ACCEPT_PROPOSED has no fields (confirms the candidate's
  // proposal in-place). DECLINE is unchanged.
  const [proposedSlotsLocal, setProposedSlotsLocal] = useState<string[]>(["", "", ""]);
  const [customMessage, setCustomMessage] = useState("");
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
    setProposedSlotsLocal(["", "", ""]);
    setCustomMessage("");
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
      const successTitle =
        payload.action === "ACCEPT"
          ? "Slots offered. Candidate emailed a booking link."
          : payload.action === "ACCEPT_PROPOSED"
            ? "Interview booked at the candidate's proposed time."
            : "Application declined.";
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

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--bb-secondary)]">Talent applications</h1>
          <p className="mt-1 text-sm text-[var(--bb-text-secondary)]">
            Review submissions from the public /talent form. Accept to offer the candidate three
            interview slots; if they propose their own time, confirm it from the detail panel.
            Decline to send a polite rejection.
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
            <option value="AWAITING_CANDIDATE_CHOICE">Awaiting candidate</option>
            <option value="CANDIDATE_PROPOSED_TIME">
              Candidate proposed
              {total > 0 && filter === "CANDIDATE_PROPOSED_TIME" ? ` (${total})` : ""}
            </option>
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
                          actionStatus={actionStatus}
                          actionError={actionError}
                          onAccept={handleAccept}
                          onAcceptProposed={handleAcceptProposed}
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
  categoryNames,
  proposedSlotsLocal,
  onProposedSlotChange,
  customMessage,
  onCustomMessageChange,
  declineReason,
  onDeclineReasonChange,
  actionStatus,
  actionError,
  onAccept,
  onAcceptProposed,
  onDecline,
}: {
  item: Application;
  categoryNames: Map<string, string>;
  proposedSlotsLocal: string[];
  onProposedSlotChange: (idx: number, v: string) => void;
  customMessage: string;
  onCustomMessageChange: (v: string) => void;
  declineReason: string;
  onDeclineReasonChange: (v: string) => void;
  actionStatus: "idle" | "submitting";
  actionError: string | null;
  onAccept: () => void;
  onAcceptProposed: () => void;
  onDecline: () => void;
}) {
  // PR4 — three actionable states:
  //   - SUBMITTED / IN_REVIEW: admin can offer 3 slots (ACCEPT) or DECLINE
  //   - AWAITING_CANDIDATE_CHOICE: admin can DECLINE (revoking the offer)
  //   - CANDIDATE_PROPOSED_TIME: admin can ACCEPT_PROPOSED or DECLINE
  // ACCEPTED + DECLINED are terminal — the action panel hides.
  const canOfferSlots = item.status === "SUBMITTED" || item.status === "IN_REVIEW";
  const canConfirmProposed = item.status === "CANDIDATE_PROPOSED_TIME";
  const canDecline =
    item.status === "SUBMITTED" ||
    item.status === "IN_REVIEW" ||
    item.status === "AWAITING_CANDIDATE_CHOICE" ||
    item.status === "CANDIDATE_PROPOSED_TIME";
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

        {actionError && (canOfferSlots || canConfirmProposed || canDecline) && (
          <InlineAlert variant="error" title="Action failed">
            {actionError}
          </InlineAlert>
        )}

        {/* Defensive — should be unreachable: status is one of the
         *  6 enums and every status maps to at least one panel. */}
        {!canOfferSlots &&
          !canConfirmProposed &&
          !canDecline &&
          item.status !== "ACCEPTED" &&
          item.status !== "DECLINED" && (
            <p className="text-sm text-[var(--bb-text-muted)]">
              No action available for this status.
            </p>
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
