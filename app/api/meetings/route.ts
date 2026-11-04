// -----------------------------------------------------------------------------
// @file: app/api/meetings/route.ts
// @purpose: Public meeting booking. Anonymous, with the same defenses as the
//           contact form, and tighter limits because a booking sends a calendar
//           invite to the address entered.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import { bookMeeting, MeetingError } from "@/lib/meetings/service";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { parseBody } from "@/lib/schemas/helpers";
import { bookMeetingSchema } from "@/lib/schemas/meeting.schemas";
import { turnstileErrorMessage, verifyTurnstileToken } from "@/lib/turnstile";

export const runtime = "nodejs";

function rateLimited(message: string, resetAt: number): NextResponse {
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  return NextResponse.json(
    { error: message },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);

  const ipBucket = await rateLimit(`meetings:book:ip:${ip}`, { limit: 5, windowSeconds: 60 * 60 });
  if (!ipBucket.allowed) {
    return rateLimited("Too many bookings from this network. Please try later.", ipBucket.resetAt);
  }

  const parsed = await parseBody(req, bookMeetingSchema);
  if (!parsed.success) return parsed.response;
  const { turnstileToken, ...data } = parsed.data;

  const emailBucket = await rateLimit(`meetings:book:email:${data.email.toLowerCase()}`, {
    limit: 3,
    windowSeconds: 60 * 60,
  });
  if (!emailBucket.allowed) {
    return rateLimited("Too many bookings for this email. Please try later.", emailBucket.resetAt);
  }

  const turnstile = await verifyTurnstileToken(turnstileToken, ip);
  if (!turnstile.ok) {
    return NextResponse.json({ error: turnstileErrorMessage(turnstile.reason) }, { status: 400 });
  }

  try {
    const { meeting, token } = await bookMeeting({ ...data, ipAddress: ip });
    return NextResponse.json(
      {
        token,
        startsAt: meeting.startsAt.toISOString(),
        videoLink: meeting.videoLink,
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof MeetingError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[api/meetings] POST error", err);
    return NextResponse.json({ error: "Booking failed. Please try again." }, { status: 500 });
  }
}
