// -----------------------------------------------------------------------------
// @file: app/api/creative/progress/route.ts
// @purpose: Creative overview extras behind the owner switch
//           ENGAGEMENT_CREATIVE_PROGRESS: the first-pass streak.
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { getFirstPassStreak } from "@/lib/engagement/first-pass-streak";
import { isEngagementOn } from "@/lib/engagement/switches.server";

export async function GET() {
  try {
    const user = await getCurrentUserOrThrow();
    if (user.role !== "DESIGNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!(await isEngagementOn("creativeProgress"))) {
      return NextResponse.json({ enabled: false });
    }
    return NextResponse.json({
      enabled: true,
      firstPassStreak: await getFirstPassStreak(user.id),
    });
  } catch (err: any) {
    if (err?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[creative.progress] GET error", err);
    return NextResponse.json({ error: "Failed to load progress" }, { status: 500 });
  }
}
