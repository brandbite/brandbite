// -----------------------------------------------------------------------------
// @file: app/api/creative/tickets/batch/route.ts
// @purpose: Batch status update for creative tickets (bulk actions)
// @version: v0.1.0
// @status: active
// @lastUpdate: 2025-12-27
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { TicketStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordTicketEvent } from "@/lib/tickets/ticket-events";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";
import { creativeTransitionError } from "@/lib/tickets/creative-transitions";
import { autoStartTimer, autoStopTimersOnTicket } from "@/lib/tickets/auto-timer";

type TicketStatusString = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";

function isValidTicketStatus(value: unknown): value is TicketStatus {
  if (typeof value !== "string") return false;
  return value === "TODO" || value === "IN_PROGRESS" || value === "IN_REVIEW" || value === "DONE";
}

type BatchResult = {
  ticketId: string;
  success: boolean;
  error?: string;
};

// -----------------------------------------------------------------------------
// PATCH — Batch update ticket statuses
// Body: { ticketIds: string[], status: TicketStatusString }
// Response: { results: BatchResult[] }
// -----------------------------------------------------------------------------

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "DESIGNER") {
      return NextResponse.json({ error: "Only creatives can update requests." }, { status: 403 });
    }

    const body = await req.json();
    const ticketIds: string[] = body.ticketIds;
    const requestedStatus: string = body.status;

    if (!Array.isArray(ticketIds) || ticketIds.length === 0 || !requestedStatus) {
      return NextResponse.json(
        { error: "ticketIds (non-empty array) and status are required." },
        { status: 400 },
      );
    }

    if (ticketIds.length > 50) {
      return NextResponse.json(
        { error: "Cannot update more than 50 requests at once." },
        { status: 400 },
      );
    }

    if (!isValidTicketStatus(requestedStatus)) {
      return NextResponse.json({ error: "Invalid request status." }, { status: 400 });
    }

    const nextStatus = requestedStatus as TicketStatus;

    // Creatives cannot mark tickets as DONE or send to IN_REVIEW via bulk
    if (nextStatus === TicketStatus.DONE) {
      return NextResponse.json(
        { error: "Creatives cannot mark requests as DONE." },
        { status: 403 },
      );
    }

    if (nextStatus === TicketStatus.IN_REVIEW) {
      return NextResponse.json(
        {
          error: "Sending to review requires uploading work. Use the upload modal instead.",
        },
        { status: 400 },
      );
    }

    // Fetch all requested tickets that belong to this creative
    const tickets = await prisma.ticket.findMany({
      where: {
        id: { in: ticketIds },
        creativeId: user.id,
      },
      select: {
        id: true,
        title: true,
        status: true,
        companyId: true,
        createdById: true,
      },
    });

    const ticketMap = new Map(tickets.map((t) => [t.id, t]));

    // Pre-compute concurrency limits if moving to IN_PROGRESS
    // Group by companyId to check limits per company
    let concurrencyByCompany: Map<
      string,
      { max: number; current: number; planName: string }
    > | null = null;

    if (nextStatus === TicketStatus.IN_PROGRESS) {
      const companyIds = [
        ...new Set(
          tickets.filter((t) => t.status !== TicketStatus.IN_PROGRESS).map((t) => t.companyId),
        ),
      ];

      if (companyIds.length > 0) {
        concurrencyByCompany = new Map();

        const companies = await prisma.company.findMany({
          where: { id: { in: companyIds } },
          select: { id: true, plan: true },
        });

        for (const company of companies) {
          const planData = company.plan as
            | {
                name?: string | null;
                maxConcurrentInProgressTickets?: number | null;
              }
            | null
            | undefined;

          const maxConcurrent =
            typeof planData?.maxConcurrentInProgressTickets === "number"
              ? planData.maxConcurrentInProgressTickets
              : 1;

          const currentInProgress = await prisma.ticket.count({
            where: {
              companyId: company.id,
              status: TicketStatus.IN_PROGRESS,
            },
          });

          concurrencyByCompany.set(company.id, {
            max: maxConcurrent,
            current: currentInProgress,
            planName: typeof planData?.name === "string" ? planData.name : "current plan",
          });
        }
      }
    }

    // Process each ticket
    const results: BatchResult[] = [];
    const movedIntoProgress: string[] = [];

    for (const ticketId of ticketIds) {
      const ticket = ticketMap.get(ticketId);

      // Ticket not found or not assigned to creative
      if (!ticket) {
        results.push({
          ticketId,
          success: false,
          error: "Request not found or not assigned to you.",
        });
        continue;
      }

      // Already in target status
      if (ticket.status === nextStatus) {
        results.push({
          ticketId,
          success: true, // No-op, already there
        });
        continue;
      }

      // Cannot modify DONE tickets
      if (ticket.status === TicketStatus.DONE) {
        results.push({
          ticketId,
          success: false,
          error: "Request is already DONE and cannot be changed.",
        });
        continue;
      }

      // Same move rules as the single-ticket PATCH — e.g. bulk "Move to
      // Backlog" must not pull delivered (IN_REVIEW) work back to TODO.
      const transitionError = creativeTransitionError(ticket.status, nextStatus);
      if (transitionError) {
        results.push({ ticketId, success: false, error: transitionError });
        continue;
      }

      // Concurrency check for IN_PROGRESS
      if (
        nextStatus === TicketStatus.IN_PROGRESS &&
        ticket.status !== TicketStatus.IN_PROGRESS &&
        concurrencyByCompany
      ) {
        const limits = concurrencyByCompany.get(ticket.companyId);
        if (limits && limits.current >= limits.max) {
          results.push({
            ticketId,
            success: false,
            error: `Company has reached its limit (${limits.max}) for active requests in progress.`,
          });
          continue;
        }

        // Increment current count for subsequent checks in this batch
        if (limits) {
          limits.current++;
        }
      }

      // Execute update
      try {
        await prisma.ticket.update({
          where: { id: ticket.id },
          data: { status: nextStatus },
        });
        await recordTicketEvent({
          ticketId: ticket.id,
          actorId: user.id,
          type: "STATUS_CHANGED",
          metadata: { from: ticket.status, to: nextStatus },
        });

        results.push({ ticketId, success: true });

        // Leaving In progress stops a running timer; moving several in at
        // once can't start several (one timer at a time), see below.
        if (ticket.status === TicketStatus.IN_PROGRESS && nextStatus !== TicketStatus.IN_PROGRESS) {
          await autoStopTimersOnTicket(ticket.id);
        }
        if (nextStatus === TicketStatus.IN_PROGRESS && ticket.status !== TicketStatus.IN_PROGRESS) {
          movedIntoProgress.push(ticket.id);
        }

        // Fire notification (fire-and-forget)
        createNotification({
          userId: ticket.createdById,
          type: "TICKET_STATUS_CHANGED",
          title: "Request status updated",
          message: `"${ticket.title}" was moved to ${nextStatus.replace("_", " ").toLowerCase()}`,
          ticketId: ticket.id,
          actorId: user.id,
        });
      } catch (err) {
        console.error(`[creative.tickets.batch] Failed to update ticket ${ticketId}`, err);
        results.push({
          ticketId,
          success: false,
          error: "Failed to update request.",
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    // One request started: its timer starts too. Several: the creative picks.
    const timer =
      movedIntoProgress.length === 1
        ? await autoStartTimer(movedIntoProgress[0], user.id)
        : { started: false, stoppedOtherTicketId: null };

    return NextResponse.json({ results, successCount, failCount, timer }, { status: 200 });
  } catch (error: any) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    console.error("[creative.tickets.batch] PATCH error", error);
    return NextResponse.json({ error: "Failed to batch update requests" }, { status: 500 });
  }
}
