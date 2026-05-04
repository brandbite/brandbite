// -----------------------------------------------------------------------------
// @file: app/api/admin/talent-applications/[id]/route.ts
// @purpose: Per-application admin actions: PATCH to accept (creates Google
//           Calendar event with Meet, sends interview email) or decline
//           (sends polite rejection). SITE_OWNER only.
//
//           Why a separate file from the list route: it matches the URL
//           shape used elsewhere (/admin/plans/[id], /admin/users/[id])
//           and lets the [id] param come from Next's typed segment instead
//           of body parsing.
//
//           Failure model — accept flow:
//             1. Read row + assert status === SUBMITTED → 409 if not
//             2. Read singleton ConsultationSettings + assert Google
//                connected → 412 with actionable message if not
//             3. Calendar event create → 502 if Google fails
//             4. Persist updates inside a transaction → 500 if DB fails
//             5. Send email (best-effort, never blocks success response)
//             6. Audit log (best-effort, write-only sink)
//
//           Steps 1-4 are atomic per application. If steps 5 or 6 fail,
//           the row is still ACCEPTED and the calendar event still
//           exists — that's the right tradeoff (we never want to send a
//           cancellation email for an event we successfully created).
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { extractAuditContext, logAdminAction } from "@/lib/admin-audit";
import { sendNotificationEmail } from "@/lib/email";
import { renderTalentAcceptEmail } from "@/lib/email-templates/talent/accept";
import { renderTalentDeclineEmail } from "@/lib/email-templates/talent/decline";
import { createConsultationEvent, extractMeetLink } from "@/lib/google/calendar";
import { getConsultationSettings } from "@/lib/consultation/settings";
import { prisma } from "@/lib/prisma";
import { canManageTalentApplications } from "@/lib/roles";
import { parseBody } from "@/lib/schemas/helpers";
import {
  TALENT_INTERVIEW_DURATION_MINUTES,
  talentApplicationActionSchema,
} from "@/lib/schemas/talent-application.schemas";

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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auditContext = extractAuditContext(req);

  // Auth + role gate. Defer the action validation until after we've
  // confirmed the caller has the right; otherwise a 4xx from Zod would
  // leak the schema shape to anonymous requests.
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

  // Read the row + assert SUBMITTED. This is a small race window between
  // here and the eventual UPDATE — two admins clicking at the same time
  // would both pass this check but only one succeeds the UPDATE (we use
  // a conditional WHERE in the update). The Calendar create still fires
  // for both, which would double-book; we accept that as a paper-cut for
  // now since SITE_OWNER is one person in practice. PR3 / future
  // hardening: wrap in a SELECT FOR UPDATE.
  const row = await prisma.talentApplication.findUnique({ where: { id } });
  if (!row) {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }
  if (row.status !== "SUBMITTED") {
    return NextResponse.json(
      {
        error: `Application has already been actioned (status: ${row.status}).`,
        currentStatus: row.status,
      },
      { status: 409 },
    );
  }

  if (action.action === "ACCEPT") {
    return handleAccept({
      id,
      row,
      action,
      actor: user,
      auditContext,
    });
  }

  return handleDecline({
    id,
    row,
    action,
    actor: user,
    auditContext,
  });
}

// ---------------------------------------------------------------------------
// Accept flow
// ---------------------------------------------------------------------------

async function handleAccept(args: {
  id: string;
  row: Awaited<ReturnType<typeof prisma.talentApplication.findUnique>>;
  action: { action: "ACCEPT"; interviewStartIso: string };
  actor: Awaited<ReturnType<typeof getCurrentUserOrThrow>>;
  auditContext: ReturnType<typeof extractAuditContext>;
}): Promise<NextResponse> {
  const { id, row, action, actor, auditContext } = args;
  if (!row) {
    // Type guard for the caller's null check; keeps TS happy.
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }

  // Confirm Google is connected before we promise the candidate anything.
  // 412 Precondition Failed reads correctly here — the request is
  // well-formed but the system isn't in a state to fulfill it.
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

  const startIso = action.interviewStartIso;
  const endIso = new Date(
    new Date(startIso).getTime() + TALENT_INTERVIEW_DURATION_MINUTES * 60_000,
  ).toISOString();
  const calendarId = settings.googleCalendarId ?? "primary";

  // Step 1 — calendar event with Meet. Throws on Google failure; we
  // map that to 502 so the admin sees a clear "external system" error
  // distinct from our own 5xx.
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
    // Defensive: free Gmail without Meet enabled occasionally returns
    // an event with no conference. We refuse rather than silently
    // sending an email with a broken link. The admin can retry after
    // enabling Meet on the calendar.
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

  // Step 2 — DB update. Conditional on status=SUBMITTED so a race with
  // a second admin click can't double-action. updateMany returns count.
  const writeResult = await prisma.talentApplication.updateMany({
    where: { id, status: "SUBMITTED" },
    data: {
      status: "ACCEPTED",
      reviewedAt: new Date(),
      reviewedByUserId: actor.id,
      reviewedByUserEmail: actor.email,
      googleEventId: event.id,
      meetLink,
      interviewAt: new Date(startIso),
    },
  });
  if (writeResult.count === 0) {
    // Race: another admin actioned this between our read and write.
    // The calendar event we created is now orphaned; cancel it so the
    // candidate doesn't get a stale invite.
    console.warn("[talent-application] race lost during accept; cancelling Google event", {
      id,
      eventId: event.id,
    });
    // Best-effort cancel — if it fails, the row is consistent and the
    // event will eventually expire. Don't block the response on it.
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

  // Step 3 — branded follow-up email. Best-effort: a failure here means
  // the candidate still has the Google ICS invite (which carries the
  // same Meet link) and the row is ACCEPTED. Better to log + continue
  // than roll back a successful calendar booking.
  try {
    const { subject, html } = await renderTalentAcceptEmail({
      candidateName: row.fullName,
      interviewStartIso: startIso,
      candidateTimezone: row.timezone,
      meetLink,
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
      interviewAt: startIso,
      meetLink,
      googleEventId: event.id,
    },
    context: auditContext,
  });

  return NextResponse.json(
    {
      ok: true,
      status: "ACCEPTED",
      googleEventId: event.id,
      meetLink,
      interviewAt: startIso,
    },
    { status: 200 },
  );
}

// ---------------------------------------------------------------------------
// Decline flow
// ---------------------------------------------------------------------------

async function handleDecline(args: {
  id: string;
  row: NonNullable<Awaited<ReturnType<typeof prisma.talentApplication.findUnique>>>;
  action: { action: "DECLINE"; reason?: string | null };
  actor: Awaited<ReturnType<typeof getCurrentUserOrThrow>>;
  auditContext: ReturnType<typeof extractAuditContext>;
}): Promise<NextResponse> {
  const { id, row, action, actor, auditContext } = args;

  const writeResult = await prisma.talentApplication.updateMany({
    where: { id, status: "SUBMITTED" },
    data: {
      status: "DECLINED",
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

  // Best-effort email — same reasoning as accept.
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
    },
    context: auditContext,
  });

  return NextResponse.json({ ok: true, status: "DECLINED" }, { status: 200 });
}
