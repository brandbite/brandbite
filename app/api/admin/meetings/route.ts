// -----------------------------------------------------------------------------
// @file: app/api/admin/meetings/route.ts
// @purpose: Admin list of public meeting bookings, plus whether the calendar is
//           connected so the page can say why booking might be unavailable.
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { getConsultationSettings } from "@/lib/consultation/settings";
import { MEETING_HOST_EMAIL } from "@/lib/meetings/service";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await getCurrentUserOrThrow();
    if (user.role !== "SITE_OWNER" && user.role !== "SITE_ADMIN") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const [meetings, settings] = await Promise.all([
      prisma.meeting.findMany({
        orderBy: { startsAt: "desc" },
        take: 200,
        select: {
          id: true,
          name: true,
          email: true,
          company: true,
          note: true,
          startsAt: true,
          status: true,
          videoLink: true,
        },
      }),
      getConsultationSettings(),
    ]);

    return NextResponse.json({
      meetings: meetings.map((m) => ({ ...m, startsAt: m.startsAt.toISOString() })),
      calendar: {
        connected: Boolean(settings.googleRefreshToken) && !settings.googleConnectionBrokenAt,
        accountEmail: settings.googleAccountEmail,
        hostEmail: MEETING_HOST_EMAIL,
        timeZone: settings.companyTimezone,
      },
    });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[admin/meetings] GET error", error);
    return NextResponse.json({ error: "Failed to load meetings" }, { status: 500 });
  }
}
