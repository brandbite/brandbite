// -----------------------------------------------------------------------------
// @file: app/api/creative/appreciation/route.ts
// @purpose: A creative's own client appreciation: how often each thank-you
//           tag was given, and the tags per request (for portfolio cards).
//           Owner switch: ENGAGEMENT_THANK_YOUS.
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { isEngagementOn } from "@/lib/engagement/switches.server";
import { cleanThanksTags, countThanks } from "@/lib/engagement/thanks";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await getCurrentUserOrThrow();
    if (user.role !== "DESIGNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!(await isEngagementOn("thankYous"))) {
      return NextResponse.json({ enabled: false });
    }
    const rows = await prisma.ticketThanks.findMany({
      where: { creativeId: user.id },
      select: { ticketId: true, tags: true },
    });
    return NextResponse.json({
      enabled: true,
      totals: countThanks(rows),
      byTicket: Object.fromEntries(rows.map((r) => [r.ticketId, cleanThanksTags(r.tags)])),
    });
  } catch (err: any) {
    if (err?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[creative.appreciation] GET error", err);
    return NextResponse.json({ error: "Failed to load appreciation" }, { status: 500 });
  }
}
