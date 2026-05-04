// -----------------------------------------------------------------------------
// @file: app/api/talent/schedule/[token]/pick/route.ts
// @purpose: Candidate-side commit. POST one of the three offered slot
//           ISOs and we book it: create the Google Calendar event with
//           Meet, persist event id + meet link + chosen interviewAt, flip
//           status to ACCEPTED, send the final-confirmation email.
//
//           Anonymous (token = auth). Rate-limited per-IP and per-token
//           because the page sits at a public URL — bots scraping
//           tokens shouldn't be able to grind on this endpoint.
//
//           Failure model mirrors the admin ACCEPT_PROPOSED handler:
//             1. Validate token + body
//             2. Validate slot ∈ proposedSlotsJson (else 400)
//             3. Confirm Google connected (else 412)
//             4. createConsultationEvent → 502 on Google failure
//             5. extractMeetLink → 502 if absent
//             6. Conditional updateMany (race-safe against another POST
//                /pick or /propose on the same token) → 409 if lost,
//                with best-effort orphan-event cancel
//             7. Best-effort final-confirmation email
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { parseBody } from "@/lib/schemas/helpers";
import {
  TALENT_INTERVIEW_DURATION_MINUTES,
  talentBookingPickSchema,
} from "@/lib/schemas/talent-application.schemas";
import { isBookingTokenExpired } from "@/lib/talent-booking-token";
import { sendNotificationEmail } from "@/lib/email";
import { renderTalentFinalConfirmationEmail } from "@/lib/email-templates/talent/final-confirmation";
import {
  cancelConsultationEvent,
  createConsultationEvent,
  extractMeetLink,
} from "@/lib/google/calendar";
import { getConsultationSettings } from "@/lib/consultation/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ip = getClientIp(req.headers);

  // Layer 1 — per-IP cap. Generous because a candidate on shared NAT
  // shouldn't be punished for one accidental double-click; tight enough
  // that a token-scraper can't grind.
  const ipBucket = await rateLimit(`talent-pick:ip:${ip}`, {
    limit: 10,
    windowSeconds: 60,
  });
  if (!ipBucket.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a minute and try again." },
      { status: 429 },
    );
  }

  // Layer 2 — per-token cap. A specific token should only ever be
  // committed once; 5/min lets the candidate double-tap a button
  // without false 429s.
  const tokenBucket = await rateLimit(`talent-pick:token:${token}`, {
    limit: 5,
    windowSeconds: 60,
  });
  if (!tokenBucket.allowed) {
    return NextResponse.json({ error: "Too many attempts on this booking link." }, { status: 429 });
  }

  if (!token || token.length < 32 || token.length > 80) {
    return NextResponse.json({ error: "Invalid booking link." }, { status: 404 });
  }

  const parsed = await parseBody(req, talentBookingPickSchema);
  if (!parsed.success) return parsed.response;
  const { slotIso } = parsed.data;

  const row = await prisma.talentApplication.findUnique({
    where: { bookingToken: token },
  });
  if (!row) {
    return NextResponse.json({ error: "This booking link isn't valid." }, { status: 404 });
  }
  if (row.status !== "AWAITING_CANDIDATE_CHOICE") {
    return NextResponse.json(
      { error: "This booking link is no longer pickable." },
      { status: 409 },
    );
  }
  if (isBookingTokenExpired(row.bookingTokenExpiresAt)) {
    return NextResponse.json({ error: "This booking link has expired." }, { status: 410 });
  }

  // The chosen slot must literally match one of the offered three.
  // Compare on epoch ms — a string-equality check would break if Zod
  // ever normalizes the timezone offset.
  const offered = (Array.isArray(row.proposedSlotsJson) ? row.proposedSlotsJson : [])
    .filter((v): v is string => typeof v === "string")
    .map((s) => new Date(s).getTime());
  const slotMs = new Date(slotIso).getTime();
  if (!offered.includes(slotMs)) {
    return NextResponse.json(
      { error: "That slot isn't one of the offered options." },
      { status: 400 },
    );
  }

  // Google Calendar must be connected. Same 412 shape as the admin path.
  const settings = await getConsultationSettings();
  if (!settings.googleRefreshToken) {
    return NextResponse.json(
      {
        error:
          "Booking is temporarily unavailable — the calendar integration is not configured. Please email the team.",
      },
      { status: 412 },
    );
  }

  const startIso = new Date(slotMs).toISOString();
  const endIso = new Date(slotMs + TALENT_INTERVIEW_DURATION_MINUTES * 60_000).toISOString();
  const calendarId = settings.googleCalendarId ?? "primary";

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
        `(Candidate self-picked from offered slots)`,
      ]
        .filter((line): line is string => line !== null)
        .join("\n"),
      startIso,
      endIso,
      timeZone: row.timezone,
      attendeeEmails: [row.email],
    });
  } catch (err) {
    console.error("[talent-pick] calendar create failed", err);
    return NextResponse.json(
      {
        error:
          "We couldn't create the calendar event. The booking has not been confirmed; please try again.",
      },
      { status: 502 },
    );
  }

  const meetLink = extractMeetLink(event);
  if (!meetLink) {
    return NextResponse.json(
      {
        error: "Calendar event created but no Meet link returned. Please email the team.",
      },
      { status: 502 },
    );
  }

  const writeResult = await prisma.talentApplication.updateMany({
    where: { id: row.id, status: "AWAITING_CANDIDATE_CHOICE" },
    data: {
      status: "ACCEPTED",
      googleEventId: event.id,
      meetLink,
      interviewAt: new Date(slotMs),
      // Single-use: clear the token so re-clicks bounce on subsequent reads.
      bookingToken: null,
      bookingTokenExpiresAt: null,
    },
  });
  if (writeResult.count === 0) {
    // Race lost — most likely a second tab clicked /propose between our
    // status check and the write. Cancel the orphan event.
    void cancelConsultationEvent(settings, calendarId, event.id).catch((err) =>
      console.error("[talent-pick] orphan event cancel failed", err),
    );
    return NextResponse.json(
      { error: "Booking state changed. Refresh the page and try again." },
      { status: 409 },
    );
  }

  // Best-effort branded confirmation. Google's ICS invite already covers
  // the calendar add itself.
  try {
    const { subject, html } = await renderTalentFinalConfirmationEmail({
      candidateName: row.fullName,
      interviewStartIso: startIso,
      candidateTimezone: row.timezone,
      meetLink,
    });
    await sendNotificationEmail(row.email, subject, html);
  } catch (err) {
    console.error("[talent-pick] confirmation email failed", err);
  }

  return NextResponse.json(
    { ok: true, status: "ACCEPTED", interviewAt: startIso, meetLink },
    { status: 200 },
  );
}
