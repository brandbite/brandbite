// -----------------------------------------------------------------------------
// @file: app/api/admin/meetings/[id]/route.ts
// @purpose: Admin cancels a public meeting. The visitor is told by email, and
//           Google removes the event and notifies attendees.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { cancelMeeting, MeetingError } from "@/lib/meetings/service";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUserOrThrow();
    if (user.role !== "SITE_OWNER" && user.role !== "SITE_ADMIN") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }
    const { id } = await params;
    const meeting = await prisma.meeting.findUnique({ where: { id } });
    if (!meeting) return NextResponse.json({ error: "Meeting not found" }, { status: 404 });

    await cancelMeeting(meeting);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    if (error instanceof MeetingError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[admin/meetings/:id] DELETE error", error);
    return NextResponse.json({ error: "Failed to cancel meeting" }, { status: 500 });
  }
}
