// -----------------------------------------------------------------------------
// @file: app/api/admin/consultations/route.ts
// @purpose: Admin list endpoint for all consultations across companies.
//           Supports an optional `?status=` filter; results sorted newest-first.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ConsultationStatus } from "@prisma/client";

const VALID_STATUSES: ConsultationStatus[] = ["PENDING", "SCHEDULED", "COMPLETED", "CANCELED"];

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();
    if (user.role !== "SITE_OWNER" && user.role !== "SITE_ADMIN") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const statusParam = new URL(req.url).searchParams.get("status");
    const status =
      statusParam && VALID_STATUSES.includes(statusParam as ConsultationStatus)
        ? (statusParam as ConsultationStatus)
        : undefined;

    const consultations = await prisma.consultation.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        description: true,
        preferredTimes: true,
        timezone: true,
        scheduledAt: true,
        videoLink: true,
        adminNotes: true,
        tokenCost: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        company: { select: { id: true, name: true, slug: true } },
        requestedBy: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({
      consultations: consultations.map((c) => ({
        ...c,
        scheduledAt: c.scheduledAt?.toISOString() ?? null,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
    });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[admin/consultations] GET error", error);
    return NextResponse.json({ error: "Failed to load consultations" }, { status: 500 });
  }
}
