// -----------------------------------------------------------------------------
// @file: app/api/admin/talent-applications/[id]/route.ts
// @purpose: Per-application admin actions. SITE_OWNER only. Three actions:
//
//             ACCEPT          (from SUBMITTED)
//               Generate a booking token, persist three proposed slots +
//               an optional custom message, email the candidate the
//               tokenized booking link. Status → AWAITING_CANDIDATE_CHOICE.
//               No Google Calendar event yet — that comes after the
//               candidate picks (or after ACCEPT_PROPOSED below).
//
//             ACCEPT_PROPOSED (from CANDIDATE_PROPOSED_TIME)
//               Confirm the time the candidate proposed via the public
//               booking page. This is when the calendar event finally
//               gets created. Status → ACCEPTED.
//
//             DECLINE         (from SUBMITTED, AWAITING_CANDIDATE_CHOICE,
//                              or CANDIDATE_PROPOSED_TIME)
//               Polite rejection email; no calendar interaction. Status
//               → DECLINED. Loosened from PR2 to allow declining at any
//               pre-final stage (e.g. owner changes mind during slot
//               offering).
//
//           Why a separate file from the list route: matches the URL
//           shape used elsewhere (/admin/plans/[id], /admin/users/[id])
//           and lets [id] come from Next's typed segment.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import type { TalentApplication, TalentApplicationStatus } from "@prisma/client";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { extractAuditContext, logAdminAction } from "@/lib/admin-audit";
import { sendNotificationEmail } from "@/lib/email";
import { renderTalentAcceptEmail } from "@/lib/email-templates/talent/accept";
import { renderTalentDeclineEmail } from "@/lib/email-templates/talent/decline";
import { renderTalentDeclinePostInterviewEmail } from "@/lib/email-templates/talent/decline-post-interview";
import { renderTalentFinalConfirmationEmail } from "@/lib/email-templates/talent/final-confirmation";
import { createConsultationEvent, extractMeetLink } from "@/lib/google/calendar";
import { getConsultationSettings } from "@/lib/consultation/settings";
import { prisma } from "@/lib/prisma";
import { canManageTalentApplications } from "@/lib/roles";
import { parseBody } from "@/lib/schemas/helpers";
import {
  TALENT_INTERVIEW_DURATION_MINUTES,
  talentApplicationActionSchema,
} from "@/lib/schemas/talent-application.schemas";
import {
  bookingTokenExpiresAt,
  buildBookingUrl,
  generateBookingToken,
} from "@/lib/talent-booking-token";
import { onboardHiredTalent } from "@/lib/talent-onboarding";

export const runtime = "nodejs";
// Force the runtime to evaluate per-request — this route writes to two
// external systems (Google + Resend) on every call. Static caching would
// silently double-book.
export const dynamic = "force-dynamic";

function getAppBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL;
  if (fromEnv && fromEnv.startsWith("http")) return fromEnv.replace(/\/+$/, "");
  return "http://localhost:3000";
}

/** Per-action allowed from-statuses. Centralized so the 409 message can
 *  cite the same source the route enforces against. */
const ALLOWED_FROM: Record<
  | "ACCEPT"
  | "ACCEPT_PROPOSED"
  | "DECLINE"
  | "MARK_INTERVIEW_HELD"
  | "HIRE"
  | "REJECT_POST_INTERVIEW"
  | "ONBOARD",
  TalentApplicationStatus[]
> = {
  ACCEPT: ["SUBMITTED"],
  ACCEPT_PROPOSED: ["CANDIDATE_PROPOSED_TIME"],
  DECLINE: ["SUBMITTED", "AWAITING_CANDIDATE_CHOICE", "CANDIDATE_PROPOSED_TIME"],
  // PR9 — post-interview lifecycle. MARK_INTERVIEW_HELD is the gate to
  // the hire-or-reject decision; HIRE captures onboarding fields and
  // moves to HIRED. REJECT_POST_INTERVIEW sends the soft-toned
  // decline-post-interview email and reaches a distinct terminal status.
  MARK_INTERVIEW_HELD: ["ACCEPTED"],
  HIRE: ["INTERVIEW_HELD"],
  REJECT_POST_INTERVIEW: ["INTERVIEW_HELD"],
  // PR10 — runs the onboarding orchestrator (lib/talent-onboarding.ts).
  // Only valid from HIRED; the orchestrator itself re-asserts inside
  // its transaction to handle a race window between this check and the
  // write.
  ONBOARD: ["HIRED"],
};

/** Map the candidate's preferredTasksPerWeek bucket to a numeric default
 *  for the HIRE form's tasksPerWeekCap field. Admin can override; this
 *  is just so the input pre-fills sensibly instead of being empty. */
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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auditContext = extractAuditContext(req);

  // Auth + role gate first — schema-shape errors should not leak before
  // we've confirmed the caller is authorized to see this surface.
  let user;
  try {
    user = await getCurrentUserOrThrow();
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (!canManageTalentApplications(user.role)) {
    return NextResponse.json(
      { error: "Only the site owner can review talent applications." },
      { status: 403 },
    );
  }

  const parsed = await parseBody(req, talentApplicationActionSchema);
  if (!parsed.success) return parsed.response;
  const action = parsed.data;

  const row = await prisma.talentApplication.findUnique({ where: { id } });
  if (!row) {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }

  // Per-action from-status guard. Two admins racing on the same row
  // is handled by the conditional updateMany inside each handler;
  // this is the read-side fast path that gives a clean message.
  const allowed = ALLOWED_FROM[action.action];
  if (!allowed.includes(row.status)) {
    return NextResponse.json(
      {
        error: `Cannot ${action.action} from status ${row.status}.`,
        currentStatus: row.status,
      },
      { status: 409 },
    );
  }

  if (action.action === "ACCEPT") {
    return handleAccept({ id, row, action, actor: user, auditContext });
  }
  if (action.action === "ACCEPT_PROPOSED") {
    return handleAcceptProposed({ id, row, actor: user, auditContext });
  }
  // PR9 — post-interview lifecycle dispatchers.
  if (action.action === "MARK_INTERVIEW_HELD") {
    return handleMarkInterviewHeld({ id, actor: user, auditContext });
  }
  if (action.action === "HIRE") {
    return handleHire({ id, row, action, actor: user, auditContext });
  }
  if (action.action === "REJECT_POST_INTERVIEW") {
    return handleRejectPostInterview({ id, row, action, actor: user, auditContext });
  }
  if (action.action === "ONBOARD") {
    return handleOnboard({ id, row, actor: user, auditContext });
  }
  return handleDecline({ id, row, action, actor: user, auditContext });
}

// ---------------------------------------------------------------------------
// ACCEPT — offer 3 slots
// ---------------------------------------------------------------------------

async function handleAccept(args: {
  id: string;
  row: TalentApplication;
  action: { action: "ACCEPT"; proposedSlotsIso: string[]; customMessage?: string | null };
  actor: Awaited<ReturnType<typeof getCurrentUserOrThrow>>;
  auditContext: ReturnType<typeof extractAuditContext>;
}): Promise<NextResponse> {
  const { id, row, action, actor, auditContext } = args;

  const token = generateBookingToken();
  const expiresAt = bookingTokenExpiresAt();
  const trimmedMessage = action.customMessage?.trim() || null;

  // Conditional write so a race against another admin can't overwrite a
  // newly-actioned row. updateMany returns count.
  const writeResult = await prisma.talentApplication.updateMany({
    where: { id, status: "SUBMITTED" },
    data: {
      status: "AWAITING_CANDIDATE_CHOICE",
      reviewedAt: new Date(),
      reviewedByUserId: actor.id,
      reviewedByUserEmail: actor.email,
      proposedSlotsJson: action.proposedSlotsIso,
      bookingToken: token,
      bookingTokenExpiresAt: expiresAt,
      customMessage: trimmedMessage,
    },
  });
  if (writeResult.count === 0) {
    return NextResponse.json(
      { error: "Application status changed under us. Refresh and try again." },
      { status: 409 },
    );
  }

  // Best-effort email — a failure here means the row is in
  // AWAITING_CANDIDATE_CHOICE but the candidate doesn't know yet. The
  // admin can re-trigger by re-clicking Accept after a transient resend
  // failure (idempotent because the schema enforces SUBMITTED).
  try {
    const { subject, html } = await renderTalentAcceptEmail({
      candidateName: row.fullName,
      proposedSlotsIso: action.proposedSlotsIso,
      candidateTimezone: row.timezone,
      bookingUrl: buildBookingUrl(token),
      customMessage: trimmedMessage,
    });
    await sendNotificationEmail(row.email, subject, html);
  } catch (err) {
    console.error("[talent-application] accept email send failed", err);
  }

  await logAdminAction({
    actor: { id: actor.id, email: actor.email, role: actor.role },
    action: "TALENT_APPLICATION_ACCEPTED",
    outcome: "SUCCESS",
    targetType: "TalentApplication",
    targetId: id,
    metadata: {
      candidateEmail: row.email,
      proposedSlotsIso: action.proposedSlotsIso,
      hasCustomMessage: !!trimmedMessage,
      // Token deliberately not logged — it's a credential.
    },
    context: auditContext,
  });

  return NextResponse.json(
    {
      ok: true,
      status: "AWAITING_CANDIDATE_CHOICE",
      proposedSlotsIso: action.proposedSlotsIso,
      bookingTokenExpiresAt: expiresAt.toISOString(),
    },
    { status: 200 },
  );
}

// ---------------------------------------------------------------------------
// ACCEPT_PROPOSED — confirm the candidate's custom-time proposal
// ---------------------------------------------------------------------------

async function handleAcceptProposed(args: {
  id: string;
  row: TalentApplication;
  actor: Awaited<ReturnType<typeof getCurrentUserOrThrow>>;
  auditContext: ReturnType<typeof extractAuditContext>;
}): Promise<NextResponse> {
  const { id, row, actor, auditContext } = args;

  const proposedAt = row.candidateProposedAt;
  if (!proposedAt) {
    // Defensive: from-status check passed but the column is null. Almost
    // certainly a logic bug elsewhere; surface clearly rather than
    // proceed with no time.
    return NextResponse.json(
      { error: "No proposed time on this application — cannot confirm." },
      { status: 409 },
    );
  }

  const settings = await getConsultationSettings();
  if (!settings.googleRefreshToken) {
    return NextResponse.json(
      {
        error:
          "Google Calendar is not connected. Connect it under /admin/consultation-settings to enable interview scheduling.",
      },
      { status: 412 },
    );
  }

  const startIso = proposedAt.toISOString();
  const endIso = new Date(
    proposedAt.getTime() + TALENT_INTERVIEW_DURATION_MINUTES * 60_000,
  ).toISOString();
  const calendarId = settings.googleCalendarId ?? "primary";

  // Calendar event create. Same shape as the original PR2 accept flow.
  let event;
  try {
    event = await createConsultationEvent(settings, {
      calendarId,
      summary: `Brandbite interview — ${row.fullName}`,
      description: [
        `Talent interview with ${row.fullName} (${row.email}).`,
        ``,
        `Portfolio: ${row.portfolioUrl}`,
        row.linkedinUrl ? `LinkedIn: ${row.linkedinUrl}` : null,
        ``,
        `Application id: ${row.id}`,
        `(Confirmed candidate-proposed time)`,
      ]
        .filter((line): line is string => line !== null)
        .join("\n"),
      startIso,
      endIso,
      timeZone: row.timezone,
      attendeeEmails: [row.email],
    });
  } catch (err) {
    console.error("[talent-application] calendar create failed", err);
    await logAdminAction({
      actor: { id: actor.id, email: actor.email, role: actor.role },
      action: "TALENT_APPLICATION_ACCEPTED",
      outcome: "ERROR",
      targetType: "TalentApplication",
      targetId: id,
      errorMessage: err instanceof Error ? err.message : "Unknown error",
      context: auditContext,
    });
    return NextResponse.json(
      {
        error:
          "We couldn't create the calendar event in Google. The application has not been changed; please try again.",
      },
      { status: 502 },
    );
  }

  const meetLink = extractMeetLink(event);
  if (!meetLink) {
    console.warn("[talent-application] event created but no Meet link returned", {
      eventId: event.id,
    });
    return NextResponse.json(
      {
        error:
          "Calendar event created but Google didn't return a Meet link. Enable Meet on the configured calendar and try again.",
      },
      { status: 502 },
    );
  }

  const writeResult = await prisma.talentApplication.updateMany({
    where: { id, status: "CANDIDATE_PROPOSED_TIME" },
    data: {
      status: "ACCEPTED",
      googleEventId: event.id,
      meetLink,
      interviewAt: proposedAt, // already on the row; redundant write keeps schema explicit
      // Clear the booking token now that the booking is final — the URL
      // is single-use and shouldn't survive past the booking moment.
      bookingToken: null,
      bookingTokenExpiresAt: null,
    },
  });
  if (writeResult.count === 0) {
    // Race lost; cancel the orphan event we just created.
    void import("@/lib/google/calendar").then(({ cancelConsultationEvent }) =>
      cancelConsultationEvent(settings, calendarId, event.id).catch((err) =>
        console.error("[talent-application] orphan event cancel failed", err),
      ),
    );
    return NextResponse.json(
      { error: "Application status changed under us. Refresh and try again." },
      { status: 409 },
    );
  }

  // Best-effort final confirmation email. Google's ICS invite is the
  // canonical calendar add; this is the branded human follow-up.
  try {
    const { subject, html } = await renderTalentFinalConfirmationEmail({
      candidateName: row.fullName,
      interviewStartIso: startIso,
      candidateTimezone: row.timezone,
      meetLink,
    });
    await sendNotificationEmail(row.email, subject, html);
  } catch (err) {
    console.error("[talent-application] final confirmation email failed", err);
  }

  await logAdminAction({
    actor: { id: actor.id, email: actor.email, role: actor.role },
    action: "TALENT_APPLICATION_ACCEPTED",
    outcome: "SUCCESS",
    targetType: "TalentApplication",
    targetId: id,
    metadata: {
      candidateEmail: row.email,
      interviewAt: startIso,
      meetLink,
      googleEventId: event.id,
      via: "ACCEPT_PROPOSED",
    },
    context: auditContext,
  });

  return NextResponse.json(
    { ok: true, status: "ACCEPTED", googleEventId: event.id, meetLink, interviewAt: startIso },
    { status: 200 },
  );
}

// ---------------------------------------------------------------------------
// DECLINE
// ---------------------------------------------------------------------------

async function handleDecline(args: {
  id: string;
  row: TalentApplication;
  action: { action: "DECLINE"; reason?: string | null };
  actor: Awaited<ReturnType<typeof getCurrentUserOrThrow>>;
  auditContext: ReturnType<typeof extractAuditContext>;
}): Promise<NextResponse> {
  const { id, row, action, actor, auditContext } = args;

  const writeResult = await prisma.talentApplication.updateMany({
    where: { id, status: { in: ALLOWED_FROM.DECLINE } },
    data: {
      status: "DECLINED",
      reviewedAt: new Date(),
      reviewedByUserId: actor.id,
      reviewedByUserEmail: actor.email,
      declineReason: action.reason?.trim() || null,
      // Invalidate any outstanding booking token so the candidate can't
      // pick a slot on a row that's now declined.
      bookingToken: null,
      bookingTokenExpiresAt: null,
    },
  });
  if (writeResult.count === 0) {
    return NextResponse.json(
      { error: "Application status changed under us. Refresh and try again." },
      { status: 409 },
    );
  }

  // Best-effort email.
  try {
    const { subject, html } = await renderTalentDeclineEmail({
      candidateName: row.fullName,
      reason: action.reason ?? null,
      showcaseUrl: `${getAppBaseUrl()}/showcase`,
    });
    await sendNotificationEmail(row.email, subject, html);
  } catch (err) {
    console.error("[talent-application] decline email send failed", err);
  }

  await logAdminAction({
    actor: { id: actor.id, email: actor.email, role: actor.role },
    action: "TALENT_APPLICATION_DECLINED",
    outcome: "SUCCESS",
    targetType: "TalentApplication",
    targetId: id,
    metadata: {
      candidateEmail: row.email,
      hasReason: !!action.reason?.trim(),
      previousStatus: row.status,
    },
    context: auditContext,
  });

  return NextResponse.json({ ok: true, status: "DECLINED" }, { status: 200 });
}

// ---------------------------------------------------------------------------
// MARK_INTERVIEW_HELD — interview happened, no hire decision yet (PR9)
// ---------------------------------------------------------------------------
//
// Pure status flip + audit. No candidate-facing email — the hire/reject
// decision (next admin action) is the one that triggers candidate
// notification. Allowed only from ACCEPTED so an accidental click doesn't
// re-fire on a row that's already past this stage.
//
// Doesn't touch interview metadata (googleEventId, meetLink, interviewAt)
// — those stay populated for historical reference.

async function handleMarkInterviewHeld(args: {
  id: string;
  actor: Awaited<ReturnType<typeof getCurrentUserOrThrow>>;
  auditContext: ReturnType<typeof extractAuditContext>;
}): Promise<NextResponse> {
  const { id, actor, auditContext } = args;

  const writeResult = await prisma.talentApplication.updateMany({
    where: { id, status: "ACCEPTED" },
    data: {
      status: "INTERVIEW_HELD",
    },
  });
  if (writeResult.count === 0) {
    return NextResponse.json(
      { error: "Application status changed under us. Refresh and try again." },
      { status: 409 },
    );
  }

  await logAdminAction({
    actor: { id: actor.id, email: actor.email, role: actor.role },
    action: "TALENT_INTERVIEW_HELD",
    outcome: "SUCCESS",
    targetType: "TalentApplication",
    targetId: id,
    context: auditContext,
  });

  return NextResponse.json({ ok: true, status: "INTERVIEW_HELD" }, { status: 200 });
}

// ---------------------------------------------------------------------------
// HIRE — capture onboarding terms; status → HIRED (PR9)
// ---------------------------------------------------------------------------
//
// Persists the negotiated terms (workingHours, approvedCategoryIds,
// tasksPerWeekCap, hireNotes) plus the hiredBy* audit triple. No
// UserAccount creation here — that's the next PR's onboarding
// orchestrator, which reads exactly these columns. No candidate email
// either; "you've been hired" lands in the same email as the magic-link
// the next PR sends.
//
// Cross-validates that approvedCategoryIds is a subset of the
// candidate's originally-applied categoryIds. Prevents a tampered
// admin-form payload from approving categories the candidate never
// claimed (and prevents a UI bug from quietly approving everything).

async function handleHire(args: {
  id: string;
  row: TalentApplication;
  action: {
    action: "HIRE";
    workingHours: string;
    approvedCategoryIds: string[];
    tasksPerWeekCap?: number | null;
    hireNotes?: string | null;
  };
  actor: Awaited<ReturnType<typeof getCurrentUserOrThrow>>;
  auditContext: ReturnType<typeof extractAuditContext>;
}): Promise<NextResponse> {
  const { id, row, action, actor, auditContext } = args;

  const appliedIds = new Set(
    Array.isArray(row.categoryIds)
      ? (row.categoryIds as unknown[]).filter((v): v is string => typeof v === "string")
      : [],
  );
  const offendingIds = action.approvedCategoryIds.filter((cid) => !appliedIds.has(cid));
  if (offendingIds.length > 0) {
    return NextResponse.json(
      {
        error:
          "approvedCategoryIds includes categories the candidate did not apply for. Refresh the form.",
        offendingIds,
      },
      { status: 400 },
    );
  }

  const tasksCap =
    action.tasksPerWeekCap ?? defaultTasksCapForBucket(row.preferredTasksPerWeek ?? null);

  const writeResult = await prisma.talentApplication.updateMany({
    where: { id, status: "INTERVIEW_HELD" },
    data: {
      status: "HIRED",
      hiredAt: new Date(),
      hiredByUserId: actor.id,
      hiredByUserEmail: actor.email,
      workingHours: action.workingHours,
      approvedCategoryIds: action.approvedCategoryIds,
      approvedTasksPerWeekCap: tasksCap,
      hireNotes: action.hireNotes?.trim() || null,
    },
  });
  if (writeResult.count === 0) {
    return NextResponse.json(
      { error: "Application status changed under us. Refresh and try again." },
      { status: 409 },
    );
  }

  await logAdminAction({
    actor: { id: actor.id, email: actor.email, role: actor.role },
    action: "TALENT_HIRED",
    outcome: "SUCCESS",
    targetType: "TalentApplication",
    targetId: id,
    metadata: {
      candidateEmail: row.email,
      approvedCategoryIds: action.approvedCategoryIds,
      tasksPerWeekCap: tasksCap,
      // hireNotes deliberately omitted — internal-only and may contain
      // negotiation detail (rates, contract terms) that doesn't belong
      // in the audit metadata blob.
    },
    context: auditContext,
  });

  return NextResponse.json(
    {
      ok: true,
      status: "HIRED",
      onboardingPending: true,
      tasksPerWeekCap: tasksCap,
    },
    { status: 200 },
  );
}

// ---------------------------------------------------------------------------
// REJECT_POST_INTERVIEW — soft-toned rejection after the interview (PR9)
// ---------------------------------------------------------------------------
//
// Status flip + decline-post-interview email + audit. Distinct from
// DECLINE so the email tone can acknowledge the candidate's time
// investment, and so reporting can distinguish "we said no before vs
// after the call".

async function handleRejectPostInterview(args: {
  id: string;
  row: TalentApplication;
  action: { action: "REJECT_POST_INTERVIEW"; reason?: string | null };
  actor: Awaited<ReturnType<typeof getCurrentUserOrThrow>>;
  auditContext: ReturnType<typeof extractAuditContext>;
}): Promise<NextResponse> {
  const { id, row, action, actor, auditContext } = args;

  const writeResult = await prisma.talentApplication.updateMany({
    where: { id, status: "INTERVIEW_HELD" },
    data: {
      status: "REJECTED_AFTER_INTERVIEW",
      reviewedAt: new Date(),
      reviewedByUserId: actor.id,
      reviewedByUserEmail: actor.email,
      declineReason: action.reason?.trim() || null,
    },
  });
  if (writeResult.count === 0) {
    return NextResponse.json(
      { error: "Application status changed under us. Refresh and try again." },
      { status: 409 },
    );
  }

  // Best-effort email — same pattern as decline.tsx send.
  try {
    const { subject, html } = await renderTalentDeclinePostInterviewEmail({
      candidateName: row.fullName,
      reason: action.reason ?? null,
      showcaseUrl: `${getAppBaseUrl()}/showcase`,
    });
    await sendNotificationEmail(row.email, subject, html);
  } catch (err) {
    console.error("[talent-application] post-interview decline email failed", err);
  }

  await logAdminAction({
    actor: { id: actor.id, email: actor.email, role: actor.role },
    action: "TALENT_REJECTED_AFTER_INTERVIEW",
    outcome: "SUCCESS",
    targetType: "TalentApplication",
    targetId: id,
    metadata: {
      candidateEmail: row.email,
      hasReason: !!action.reason?.trim(),
    },
    context: auditContext,
  });

  return NextResponse.json({ ok: true, status: "REJECTED_AFTER_INTERVIEW" }, { status: 200 });
}

// ---------------------------------------------------------------------------
// ONBOARD — runs the lib/talent-onboarding.ts orchestrator (PR10)
// ---------------------------------------------------------------------------
//
// Thin handler — the heavy lifting (UserAccount create, CreativeSkill
// seeding, magic-link, welcome email) lives in the orchestrator so a
// future cron / retry path can call it without re-implementing the
// guard chain. This handler:
//   1. Calls onboardHiredTalent(id), which returns either { ok: true,
//      userAccountId, createdSkillCount, magicLinkSent } or
//      { ok: false, status, error }.
//   2. Audit-logs success or BLOCKED depending on the result.
//   3. Forwards the orchestrator's status code so the client UI can
//      surface the same 409 / 412 / 500 the orchestrator computed.
//
// The orchestrator handles the email-collision refusal (409 with the
// "promote at /admin/users instead" message). The route doesn't need a
// separate guard for that.

async function handleOnboard(args: {
  id: string;
  row: TalentApplication;
  actor: Awaited<ReturnType<typeof getCurrentUserOrThrow>>;
  auditContext: ReturnType<typeof extractAuditContext>;
}): Promise<NextResponse> {
  const { id, row, actor, auditContext } = args;

  const result = await onboardHiredTalent(id);

  if (!result.ok) {
    await logAdminAction({
      actor: { id: actor.id, email: actor.email, role: actor.role },
      action: "TALENT_ONBOARDED",
      outcome: "BLOCKED",
      targetType: "TalentApplication",
      targetId: id,
      errorMessage: result.error,
      context: auditContext,
    });
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await logAdminAction({
    actor: { id: actor.id, email: actor.email, role: actor.role },
    action: "TALENT_ONBOARDED",
    outcome: "SUCCESS",
    targetType: "TalentApplication",
    targetId: id,
    metadata: {
      candidateEmail: row.email,
      userAccountId: result.userAccountId,
      createdSkillCount: result.createdSkillCount,
      magicLinkSent: result.magicLinkSent,
    },
    context: auditContext,
  });

  return NextResponse.json(
    {
      ok: true,
      status: "ONBOARDED",
      userAccountId: result.userAccountId,
      createdSkillCount: result.createdSkillCount,
      magicLinkSent: result.magicLinkSent,
    },
    { status: 200 },
  );
}
