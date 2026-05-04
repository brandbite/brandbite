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
const ALLOWED_FROM: Record<"ACCEPT" | "ACCEPT_PROPOSED" | "DECLINE", TalentApplicationStatus[]> = {
  ACCEPT: ["SUBMITTED"],
  ACCEPT_PROPOSED: ["CANDIDATE_PROPOSED_TIME"],
  DECLINE: ["SUBMITTED", "AWAITING_CANDIDATE_CHOICE", "CANDIDATE_PROPOSED_TIME"],
};

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
