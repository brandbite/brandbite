// -----------------------------------------------------------------------------
// @file: app/api/admin/tickets/[ticketId]/activity/route.ts
// @purpose: Activity timeline for one ticket, as a site admin sees it
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { isSiteAdminRole } from "@/lib/roles";
import { buildTicketActivity } from "@/lib/tickets/ticket-activity";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> },
) {
  try {
    const user = await getCurrentUserOrThrow();
    const { ticketId } = await params;

    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const activity = await buildTicketActivity(ticketId, { kind: "admin", userId: user.id });
    if (!activity) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    return NextResponse.json(activity);
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    console.error("[admin.tickets.activity] GET error", error);
    return NextResponse.json({ error: "Failed to load activity" }, { status: 500 });
  }
}
