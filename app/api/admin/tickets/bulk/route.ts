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

import { TicketStatus } from "@prisma/client";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordTicketEvent } from "@/lib/tickets/ticket-events";
import { notifyCreativeAssigned } from "@/lib/tickets/assignment-notification";
import { parseBody } from "@/lib/schemas/helpers";
import { bulkTicketsSchema, type BulkTicketsInput } from "@/lib/schemas/bulk-tickets.schemas";
import { completeTicketAndApplyTokens } from "@/lib/token-engine";
import { extractAuditContext, logAdminAction } from "@/lib/admin-audit";
import { createNotification } from "@/lib/notifications";
import { AdminActionType } from "@prisma/client";
import { autoStopTimersOnTicket } from "@/lib/tickets/auto-timer";

const STATUS_LABEL: Record<string, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  IN_REVIEW: "In review",
  DONE: "Done",
};

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
        // deletedAt: null — can't bulk-reassign to a soft-deleted account.
        where: { id: data.creativeId, role: UserRole.DESIGNER, deletedAt: null },
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
    // Status changes actually applied (no-ops skipped) — for the audit row
    // and the notifications sent after the loop.
    const transitions: { id: string; from: TicketStatus; to: TicketStatus }[] = [];

    // Intentionally sequential: keeps the per-row error messages attributable
    // to a specific ticket id and avoids racy status side-effects. A dozen
    // tickets in a single round-trip is the realistic admin use case.
    for (const id of data.ticketIds) {
      try {
        const existing = await prisma.ticket.findUnique({
          where: { id },
          select: {
            id: true,
            status: true,
            priority: true,
            creativeId: true,
            completedAt: true,
            jobTypeId: true,
          },
        });
        if (!existing) {
          result.failed.push({ id, error: "Request not found" });
          continue;
        }

        if (data.op === "reassign") {
          await prisma.ticket.update({
            where: { id },
            data: { creativeId: data.creativeId },
          });
          if (existing.creativeId !== data.creativeId) {
            await recordTicketEvent({
              ticketId: id,
              actorId: user.id,
              type: "CREATIVE_CHANGED",
              metadata: { toCreativeId: data.creativeId },
            });
            if (data.creativeId) {
              await notifyCreativeAssigned({
                ticketId: id,
                creativeId: data.creativeId,
                actorId: user.id,
              });
            }
          }
        } else if (data.op === "status") {
          // Admin override — no transition guards here by design. If the
          // state machine needs enforcement, callers should use the per-role
          // status endpoint (/api/customer/tickets/status).
          //
          // EXCEPT completion: a raw flip to DONE would mark the ticket done
          // without paying the creative or stamping completedAt. Route DONE
          // through the same completion engine the per-ticket path uses so
          // the payout still happens. Idempotent: a ticket already DONE (or
          // already paid) is a no-op inside the engine.
          if (existing.status === data.status) {
            result.succeeded.push(id);
            continue;
          }
          // A Done ticket has already paid its creative; moving it back
          // wouldn't reverse that payout, so don't allow it in bulk.
          if (existing.status === TicketStatus.DONE) {
            result.failed.push({
              id,
              error:
                "Done requests can't be moved back in bulk — the creative has already been paid.",
            });
            continue;
          }
          if (data.status === TicketStatus.DONE) {
            if (existing.jobTypeId) {
              await completeTicketAndApplyTokens(id);
            } else {
              await prisma.ticket.update({
                where: { id },
                data: { status: TicketStatus.DONE },
              });
            }
            if (!existing.completedAt) {
              await prisma.ticket.update({
                where: { id },
                data: { completedAt: new Date(), completedById: user.id },
              });
            }
          } else {
            await prisma.ticket.update({
              where: { id },
              data: { status: data.status },
            });
            await recordTicketEvent({
              ticketId: id,
              actorId: user.id,
              type: "STATUS_CHANGED",
              metadata: { from: existing.status, to: data.status },
            });
          }
          transitions.push({ id, from: existing.status, to: data.status });
          // A request leaving In progress stops the creative's running timer.
          if (data.status !== TicketStatus.IN_PROGRESS) await autoStopTimersOnTicket(id);
        } else if (data.op === "priority") {
          await prisma.ticket.update({
            where: { id },
            data: { priority: data.priority },
          });
          if (existing.priority !== data.priority) {
            await recordTicketEvent({
              ticketId: id,
              actorId: user.id,
              type: "DETAILS_UPDATED",
              metadata: {
                fields: ["priority"],
                priority: { from: existing.priority, to: data.priority },
              },
            });
          }
        }

        result.succeeded.push(id);
      } catch (err) {
        result.failed.push({
          id,
          error: err instanceof Error ? err.message : "Unexpected error",
        });
      }
    }

    if (data.op === "status" && transitions.length > 0) {
      await logAdminAction({
        actor: user,
        action: AdminActionType.TICKET_BULK_STATUS_CHANGE,
        outcome: "SUCCESS",
        targetType: "Ticket",
        targetId: transitions.length === 1 ? transitions[0].id : `bulk:${transitions.length}`,
        metadata: {
          status: data.status,
          transitions,
          failedCount: result.failed.length,
          paidOut: data.status === TicketStatus.DONE,
        },
        context: extractAuditContext(req),
      });

      // Tell the people on each ticket — admin moves used to be silent.
      const tickets = await prisma.ticket.findMany({
        where: { id: { in: transitions.map((t) => t.id) } },
        select: { id: true, title: true, createdById: true, creativeId: true },
      });
      const done = data.status === TicketStatus.DONE;
      for (const t of tickets) {
        const recipients = new Set([t.createdById, t.creativeId].filter((x): x is string => !!x));
        for (const userId of recipients) {
          createNotification({
            userId,
            type: done ? "TICKET_COMPLETED" : "TICKET_STATUS_CHANGED",
            title: done ? "Request completed" : "Request status updated",
            message: `"${t.title}" was moved to ${STATUS_LABEL[data.status] ?? data.status} by the brandbite team.`,
            ticketId: t.id,
            actorId: user.id,
          });
        }
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
