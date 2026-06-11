// -----------------------------------------------------------------------------
// @file: app/api/cron/google-calendar-health/route.ts
// @purpose: Daily probe of the Google Calendar OAuth connection. A dead
//           refresh token (invalid_grant) otherwise surfaces only when a
//           customer books a consultation or a talent candidate picks an
//           interview slot — i.e. at the worst possible moment, on a
//           user-facing request (June 2026 incident). This probe runs a
//           cheap freebusy query against a 1-minute window; if the token
//           refresh inside it fails with invalid_grant, the shared
//           connection-health layer (lib/google/connection-health.ts)
//           flags the row, banners the admin panel, and emails every
//           SITE_OWNER — once per outage.
//
//           Runs daily via Vercel Cron (see vercel.json). Authenticated
//           via Authorization: Bearer <CRON_SECRET>, same as
//           /api/cron/process-payouts.
//
//           Outcomes:
//             - not connected      → skipped (nothing to probe; "never
//                                    connected" is a deliberate state, not
//                                    an outage)
//             - probe succeeds     → healthy; clears a stale broken flag
//             - invalid_grant      → broken; flagging + owner email happen
//                                    inside ensureFreshAccessToken
//             - other failure      → reported but NOT flagged: transient
//                                    Google/network errors recover on
//                                    their own and must not page anyone
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import { getConsultationSettings } from "@/lib/consultation/settings";
import { queryFreeBusy } from "@/lib/google/calendar";
import { clearGoogleConnectionBroken, isInvalidGrantError } from "@/lib/google/connection-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Verify the incoming request is actually from Vercel Cron (or a manual
 *  admin trigger with the same secret). Returns true when authorized. */
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // No secret configured — refuse by default. Set CRON_SECRET in Vercel
    // Project Settings → Environment Variables (Production).
    return false;
  }
  const header = req.headers.get("authorization");
  if (!header) return false;
  if (header === `Bearer ${secret}`) return true;
  // Vercel's cron sometimes forwards as the raw value too; accept either.
  return header === secret;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await getConsultationSettings();

  if (!settings.googleRefreshToken) {
    return NextResponse.json({ skipped: true, reason: "Google Calendar not connected" });
  }

  const probeStart = new Date();
  const probeEnd = new Date(probeStart.getTime() + 60_000);

  try {
    // The probe's value is in its side effects: ensureFreshAccessToken
    // (inside queryFreeBusy) refreshes the token, and on invalid_grant
    // flags the connection + alerts owners. The busy-interval result is
    // irrelevant.
    await queryFreeBusy(settings, probeStart.toISOString(), probeEnd.toISOString());

    // Explicit clear, not just the refresh-path self-heal: when the cached
    // access token is still valid no refresh happens, so a stale broken
    // flag would otherwise survive a healthy probe.
    if (settings.googleConnectionBrokenAt) {
      await clearGoogleConnectionBroken(settings.id);
    }

    return NextResponse.json({ healthy: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[cron/google-calendar-health] probe failed", err);
    // invalid_grant was already flagged + alerted inside the refresh path;
    // anything else is treated as transient and only reported here.
    return NextResponse.json({
      healthy: false,
      flaggedBroken: isInvalidGrantError(err),
      error: message,
    });
  }
}
