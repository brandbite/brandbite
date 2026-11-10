// -----------------------------------------------------------------------------
// @file: app/api/cron/daily-maintenance/route.ts
// @purpose: One daily cron for the jobs that run once a day, so the project
//           stays within the Hobby plan's cron allowance:
//           - Google Calendar connection probe (/api/cron/google-calendar-health)
//           - source files on brandbite storage: 14/3-day reminders, deletion
//             90 days after done, cleanup of unfinished uploads
//           Each job runs on its own; one failing doesn't stop the other.
//           Authenticated with Authorization: Bearer <CRON_SECRET>.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import { GET as googleCalendarHealth } from "@/app/api/cron/google-calendar-health/route";
import { runSourceFileRetention } from "@/lib/source-files/retention";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  return header === `Bearer ${secret}` || header === secret;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, unknown> = {};

  try {
    results.googleCalendar = await (await googleCalendarHealth(req)).json();
  } catch (error) {
    console.error("[cron/daily-maintenance] calendar probe failed", error);
    results.googleCalendar = { error: "failed" };
  }

  try {
    results.sourceFiles = await runSourceFileRetention();
  } catch (error) {
    console.error("[cron/daily-maintenance] source file retention failed", error);
    results.sourceFiles = { error: "failed" };
  }

  return NextResponse.json(results);
}
