// -----------------------------------------------------------------------------
// @file: app/api/talent/schedule/[token]/propose/route.ts
// @purpose: Candidate-side "none of these work — here's what does" path.
//           POST a single ISO instant + optional short note. We persist
//           the proposal on `candidateProposedAt` and an arbitrary note
//           on `customMessage` (re-using the existing column for the
//           opposite direction — admin's note becomes candidate's note;
//           we don't need both at once because the row is in different
//           statuses).
//
//           Status moves to CANDIDATE_PROPOSED_TIME. NO calendar event
//           is created here — the SITE_OWNER confirms the proposal via
//           the admin ACCEPT_PROPOSED action, and the event is created
//           at THAT point.
//
//           Token is consumed (cleared) on success — even though there's
//           no calendar event yet — because the candidate's next interaction
//           with this row should be receiving a fresh confirmation email
//           after the admin acts, not re-clicking the original booking
//           link.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { parseBody } from "@/lib/schemas/helpers";
import { talentBookingProposeSchema } from "@/lib/schemas/talent-application.schemas";
import { isBookingTokenExpired } from "@/lib/talent-booking-token";
import { notifySiteOwnersOfProposedTime } from "@/lib/talent-notify-owners";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAppBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL;
  if (fromEnv && fromEnv.startsWith("http")) return fromEnv.replace(/\/+$/, "");
  return "http://localhost:3000";
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ip = getClientIp(req.headers);

  // Same two-layer rate limit as /pick.
  const ipBucket = await rateLimit(`talent-propose:ip:${ip}`, {
    limit: 10,
    windowSeconds: 60,
  });
  if (!ipBucket.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a minute." },
      { status: 429 },
    );
  }
  const tokenBucket = await rateLimit(`talent-propose:token:${token}`, {
    limit: 5,
    windowSeconds: 60,
  });
  if (!tokenBucket.allowed) {
    return NextResponse.json({ error: "Too many attempts on this booking link." }, { status: 429 });
  }

  if (!token || token.length < 32 || token.length > 80) {
    return NextResponse.json({ error: "Invalid booking link." }, { status: 404 });
  }

  const parsed = await parseBody(req, talentBookingProposeSchema);
  if (!parsed.success) return parsed.response;
  const { proposedIso, note } = parsed.data;

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

  const proposedAt = new Date(proposedIso);
  const trimmedNote = note?.trim() || null;

  const writeResult = await prisma.talentApplication.updateMany({
    where: { id: row.id, status: "AWAITING_CANDIDATE_CHOICE" },
    data: {
      status: "CANDIDATE_PROPOSED_TIME",
      candidateProposedAt: proposedAt,
      // Stash the candidate's note in customMessage. The column is
      // currently the admin's note (now consumed — already emailed) so
      // re-using it for the candidate's reply keeps the schema lean.
      // The status enum disambiguates whose note it is.
      customMessage: trimmedNote,
      // Token is single-use even on the propose path — see file header.
      bookingToken: null,
      bookingTokenExpiresAt: null,
    },
  });
  if (writeResult.count === 0) {
    return NextResponse.json(
      { error: "Booking state changed. Refresh the page and try again." },
      { status: 409 },
    );
  }

  // Best-effort owner fan-out. Failure here means the proposal is
  // captured but the SITE_OWNER doesn't get an instant ping; they'll
  // still see it on the next admin-page refresh.
  try {
    await notifySiteOwnersOfProposedTime({
      candidateName: row.fullName,
      candidateEmail: row.email,
      proposedIso: proposedAt.toISOString(),
      candidateTimezone: row.timezone,
      note: trimmedNote,
      adminUrl: `${getAppBaseUrl()}/admin/talent-applications#${row.id}`,
    });
  } catch (err) {
    console.error("[talent-propose] owner notify failed", err);
  }

  return NextResponse.json(
    { ok: true, status: "CANDIDATE_PROPOSED_TIME", proposedAt: proposedAt.toISOString() },
    { status: 200 },
  );
}
