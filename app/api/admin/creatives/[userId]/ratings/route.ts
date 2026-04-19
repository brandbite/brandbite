// -----------------------------------------------------------------------------
// @file: app/api/admin/creatives/[userId]/ratings/route.ts
// @purpose: Admin-only read endpoint returning a creative's rating summary +
//           recent individual ratings. Used to drive the rating block on the
//           admin creative-analytics drill-down.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCreativeRatingSummary } from "@/lib/ratings/creative-ratings";

const MAX_RATING_ROWS = 50;

export async function GET(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "SITE_ADMIN" && user.role !== "SITE_OWNER") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const { userId } = await params;

    const creative = await prisma.userAccount.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!creative || creative.role !== "DESIGNER") {
      return NextResponse.json({ error: "Creative not found" }, { status: 404 });
    }

    const summary = await getCreativeRatingSummary(userId);

    const ratings = await prisma.creativeRating.findMany({
      where: { creativeId: userId },
      orderBy: { createdAt: "desc" },
      take: MAX_RATING_ROWS,
      select: {
        id: true,
        quality: true,
        communication: true,
        speed: true,
        feedback: true,
        createdAt: true,
        company: { select: { id: true, name: true } },
        ticket: { select: { id: true, title: true, companyTicketNumber: true } },
      },
    });

    return NextResponse.json({
      summary,
      ratings: ratings.map((r) => ({
        id: r.id,
        quality: r.quality,
        communication: r.communication,
        speed: r.speed,
        feedback: r.feedback,
        createdAt: r.createdAt.toISOString(),
        company: r.company,
        ticket: r.ticket,
      })),
    });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[admin/creatives/ratings] GET error", error);
    return NextResponse.json({ error: "Failed to load ratings" }, { status: 500 });
  }
}
