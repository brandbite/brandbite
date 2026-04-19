// -----------------------------------------------------------------------------
// @file: app/api/admin/tickets/bulk/route.ts
// @purpose: SITE_OWNER / SITE_ADMIN — multi-ticket operations:
//             - reassign a creative across many tickets
//             - force a status change across many tickets
//             - change priority across many tickets
//           Per-ticket errors are collected and returned so the UI can show
//           a "N succeeded, M failed" summary instead of aborting on the
//           first bad row.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/schemas/helpers";
import { bulkTicketsSchema, type BulkTicketsInput } from "@/lib/schemas/bulk-tickets.schemas";

type BulkResult = {
  succeeded: string[];
  failed: { id: string; error: string }[];
};

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();
    if (user.role !== "SITE_OWNER" && user.role !== "SITE_ADMIN") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const parsed = await parseBody(req, bulkTicketsSchema);
    if (!parsed.success) return parsed.response;

    const data = parsed.data as BulkTicketsInput;

    // Reassign is the only op that needs an upfront validity check on the
    // creativeId — a single lookup beats N lookups in the loop below.
    if (data.op === "reassign" && data.creativeId !== null) {
      const creative = await prisma.userAccount.findFirst({
        where: { id: data.creativeId, role: UserRole.DESIGNER },
        select: { id: true },
      });
      if (!creative) {
        return NextResponse.json(
          { error: "Creative not found or not a creative user." },
          { status: 400 },
        );
      }
    }

    const result: BulkResult = { succeeded: [], failed: [] };

    // Intentionally sequential: keeps the per-row error messages attributable
    // to a specific ticket id and avoids racy status side-effects. A dozen
    // tickets in a single round-trip is the realistic admin use case.
    for (const id of data.ticketIds) {
      try {
        const existing = await prisma.ticket.findUnique({
          where: { id },
          select: { id: true },
        });
        if (!existing) {
          result.failed.push({ id, error: "Ticket not found" });
          continue;
        }

        if (data.op === "reassign") {
          await prisma.ticket.update({
            where: { id },
            data: { creativeId: data.creativeId },
          });
        } else if (data.op === "status") {
          // Admin override — no transition guards here by design. If the
          // state machine needs enforcement, callers should use the per-role
          // status endpoint (/api/customer/tickets/status).
          await prisma.ticket.update({
            where: { id },
            data: { status: data.status },
          });
        } else if (data.op === "priority") {
          await prisma.ticket.update({
            where: { id },
            data: { priority: data.priority },
          });
        }

        result.succeeded.push(id);
      } catch (err) {
        result.failed.push({
          id,
          error: err instanceof Error ? err.message : "Unexpected error",
        });
      }
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[admin/tickets/bulk] POST error", error);
    return NextResponse.json({ error: "Bulk op failed" }, { status: 500 });
  }
}
