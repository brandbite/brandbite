// -----------------------------------------------------------------------------
// @file: app/api/meetings/availability/route.ts
// @purpose: Open 30-minute slots for the public booking page. Returns only free
//           start times, never what is on the calendar.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import { getMeetingAvailability } from "@/lib/meetings/service";
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
  return NextResponse.json(await getMeetingAvailability(), {
    headers: { "Cache-Control": "no-store" },
  });
}
