// -----------------------------------------------------------------------------
// @file: app/api/talent/schedule/[token]/route.ts
// @purpose: Public read of a booking offer. Looks up the TalentApplication
//           by its bookingToken and returns the slim "what the candidate
//           needs to pick" payload — name, the three proposed slots, the
//           candidate's timezone, the optional admin message, plus a
//           status field the page uses to render the right state
//           (offer / already-picked / already-proposed / expired /
//           invalid).
//
//           Anonymous endpoint. Knowledge of the token IS the auth — the
//           token is only ever delivered via email to the candidate.
//           Token is plain (not hashed) — matches the CompanyInvite
//           pattern and lib/talent-booking-token.ts comments.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { isBookingTokenExpired } from "@/lib/talent-booking-token";

export const runtime = "nodejs";
// No edge cache — the response depends on row state which the candidate
// might mutate via /pick or /propose moments later.
export const dynamic = "force-dynamic";

// Public booking states the API may return — kept inline (no top-level
// type alias) since each shape is fully expressed in PublicBookingResponse
// below and an alias was unused.
//   OFFER     — 3 slots awaiting pick
//   PROPOSED  — candidate already proposed; awaiting admin
//   BOOKED    — already ACCEPTED, show the booked time + Meet link
//   EXPIRED   — token still attached but past expiry
//   INVALID   — token doesn't match any row, or row was DECLINED, etc.

export type PublicBookingResponse =
  | { state: "INVALID" }
  | { state: "EXPIRED" }
  | {
      state: "OFFER";
      candidateName: string;
      candidateTimezone: string;
      proposedSlotsIso: string[];
      customMessage: string | null;
      expiresAt: string;
    }
  | {
      state: "PROPOSED";
      candidateName: string;
      candidateTimezone: string;
      proposedAt: string;
    }
  | {
      state: "BOOKED";
      candidateName: string;
      candidateTimezone: string;
      interviewAt: string;
      meetLink: string;
    };

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse<PublicBookingResponse>> {
  const { token } = await params;

  // Token shape sanity: 32 bytes base64url ≈ 43 chars. Reject obvious
  // garbage before hitting the DB so a bot scraping random tokens can't
  // generate query load.
  if (!token || token.length < 32 || token.length > 80) {
    return NextResponse.json({ state: "INVALID" }, { status: 404 });
  }

  const row = await prisma.talentApplication.findUnique({
    where: { bookingToken: token },
    select: {
      fullName: true,
      timezone: true,
      status: true,
      proposedSlotsJson: true,
      bookingTokenExpiresAt: true,
      customMessage: true,
      candidateProposedAt: true,
      interviewAt: true,
      meetLink: true,
    },
  });

  if (!row) {
    return NextResponse.json({ state: "INVALID" }, { status: 404 });
  }

  // BOOKED — final accepted state. Token is normally cleared on
  // ACCEPT but keep the read working defensively in case it lingers.
  if (row.status === "ACCEPTED" && row.interviewAt && row.meetLink) {
    return NextResponse.json({
      state: "BOOKED",
      candidateName: row.fullName,
      candidateTimezone: row.timezone,
      interviewAt: row.interviewAt.toISOString(),
      meetLink: row.meetLink,
    });
  }

  // PROPOSED — candidate already submitted a custom time, waiting on
  // admin to confirm. Don't expose another commit path until either the
  // admin confirms (→ BOOKED) or counter-proposes (back to OFFER).
  if (row.status === "CANDIDATE_PROPOSED_TIME" && row.candidateProposedAt) {
    return NextResponse.json({
      state: "PROPOSED",
      candidateName: row.fullName,
      candidateTimezone: row.timezone,
      proposedAt: row.candidateProposedAt.toISOString(),
    });
  }

  // OFFER — the happy path. Status must be AWAITING_CANDIDATE_CHOICE,
  // expiry not past, and the slots array must shape-check.
  if (row.status !== "AWAITING_CANDIDATE_CHOICE" || !Array.isArray(row.proposedSlotsJson)) {
    return NextResponse.json({ state: "INVALID" }, { status: 404 });
  }
  if (isBookingTokenExpired(row.bookingTokenExpiresAt)) {
    return NextResponse.json({ state: "EXPIRED" }, { status: 410 });
  }

  const slotIsos = (row.proposedSlotsJson as unknown[]).filter(
    (v): v is string => typeof v === "string",
  );
  if (slotIsos.length === 0) {
    return NextResponse.json({ state: "INVALID" }, { status: 404 });
  }

  return NextResponse.json({
    state: "OFFER",
    candidateName: row.fullName,
    candidateTimezone: row.timezone,
    proposedSlotsIso: slotIsos,
    customMessage: row.customMessage ?? null,
    expiresAt: row.bookingTokenExpiresAt?.toISOString() ?? new Date().toISOString(),
  });
}
