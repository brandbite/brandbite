// -----------------------------------------------------------------------------
// @file: app/api/engagement/switches/route.ts
// @purpose: Which engagement features the site owner has switched on, for the
//           signed-in dashboards. On/off only, nothing sensitive.
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { getEngagementSwitches } from "@/lib/engagement/switches.server";

export async function GET() {
  try {
    await getCurrentUserOrThrow();
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  return NextResponse.json(
    { switches: await getEngagementSwitches() },
    { headers: { "Cache-Control": "private, max-age=30" } },
  );
}
