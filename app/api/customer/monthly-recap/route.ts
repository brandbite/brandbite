// -----------------------------------------------------------------------------
// @file: app/api/customer/monthly-recap/route.ts
// @purpose: Last month's recap for the customer overview card.
//           Owner switch: ENGAGEMENT_MONTHLY_RECAP.
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { previousMonth } from "@/lib/engagement/monthly-recap";
import { getMonthlyRecap } from "@/lib/engagement/monthly-recap.server";
import { isEngagementOn } from "@/lib/engagement/switches.server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await getCurrentUserOrThrow();
    if (user.role !== "CUSTOMER" || !user.activeCompanyId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!(await isEngagementOn("monthlyRecap"))) return NextResponse.json({ enabled: false });

    const [recap, company] = await Promise.all([
      getMonthlyRecap(user.activeCompanyId, previousMonth(new Date())),
      prisma.company.findUnique({ where: { id: user.activeCompanyId }, select: { name: true } }),
    ]);
    return NextResponse.json({ enabled: true, recap, companyName: company?.name ?? null });
  } catch (err: any) {
    if (err?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[monthly-recap] GET error", err);
    return NextResponse.json({ error: "Failed to load recap" }, { status: 500 });
  }
}
