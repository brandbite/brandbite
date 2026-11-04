// -----------------------------------------------------------------------------
// @file: app/api/meetings/availability/route.ts
// @purpose: Open 30-minute slots for the public booking page. Returns only free
//           start times, never what is on the calendar.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import { getMeetingAvailability } from "@/lib/meetings/service";
import { buildMeetingSlots } from "@/lib/meetings/slots";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const bucket = await rateLimit(`meetings:availability:${ip}`, { limit: 30, windowSeconds: 60 });
  if (!bucket.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again soon." },
      { status: 429 },
    );
  }
  const availability = await getMeetingAvailability();

  // Vercel previews usually have no Meeting table or calendar, so a reviewer would
  // only see the unavailable message. Sample times let the page be reviewed; in demo
  // mode the page doesn't submit, so nothing is booked or sent. Never in production.
  if (!availability.available && process.env.VERCEL_ENV === "preview") {
    const slots = buildMeetingSlots({
      now: new Date(),
      workingDays: [1, 2, 3, 4, 5],
      workingHourStart: 9,
      workingHourEnd: 17,
      minNoticeHours: 24,
      maxBookingDays: 14,
      timeZone: "Europe/Istanbul",
      busy: [],
    });
    return NextResponse.json({ available: true, demo: true, slots });
  }

  return NextResponse.json(availability, {
    headers: { "Cache-Control": "no-store" },
  });
}
