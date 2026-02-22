// -----------------------------------------------------------------------------
// @file: app/api/creative/availability/route.ts
// @purpose: Creative pause/resume API for controlling assignment availability
// @version: v1.0.0
// @status: active
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { TicketStatus } from "@prisma/client";
import { createNotification } from "@/lib/notifications";
import {
  isCreativePaused,
  calculatePauseExpiry,
  formatPauseStatus,
} from "@/lib/creative-availability";
import { parseBody } from "@/lib/schemas/helpers";
import { updateAvailabilitySchema } from "@/lib/schemas/availability.schemas";

// ---------------------------------------------------------------------------
// GET — current pause status + active ticket count
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "DESIGNER") {
      return NextResponse.json(
        { error: "Only creatives can access availability" },
        { status: 403 },
      );
    }

    const [creative, activeTicketCount] = await Promise.all([
      prisma.userAccount.findUnique({
        where: { id: user.id },
        select: {
          isPaused: true,
          pausedAt: true,
          pauseExpiresAt: true,
          pauseType: true,
        },
      }),
      prisma.ticket.count({
        where: {
          creativeId: user.id,
          status: { in: [TicketStatus.TODO, TicketStatus.IN_PROGRESS] },
        },
      }),
    ]);

    if (!creative) {
      return NextResponse.json({ error: "Creative not found" }, { status: 404 });
    }

    // Opportunistic cleanup: if DB says paused but expiry has passed, clear it
    const effectivelyPaused = isCreativePaused(creative);
    if (creative.isPaused && !effectivelyPaused) {
      // Fire-and-forget cleanup of stale pause state
      prisma.userAccount
        .update({
          where: { id: user.id },
          data: {
            isPaused: false,
            pausedAt: null,
            pauseExpiresAt: null,
            pauseType: null,
          },
        })
        .catch(() => {});
    }

    return NextResponse.json({
      ...formatPauseStatus(creative),
      activeTicketCount,
    });
  } catch (error: any) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    console.error("[creative.availability] GET error", error);
    return NextResponse.json({ error: "Failed to load availability" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH — toggle pause on/off
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "DESIGNER") {
      return NextResponse.json(
        { error: "Only creatives can manage availability" },
        { status: 403 },
      );
    }

    const parsed = await parseBody(req, updateAvailabilitySchema);
    if (!parsed.success) return parsed.response;
    const { action } = parsed.data;

    // ----- PAUSE -----
    if (action === "pause") {
      const { pauseType } = parsed.data;

      const pauseExpiresAt = calculatePauseExpiry(pauseType);
      const now = new Date();

      await prisma.userAccount.update({
        where: { id: user.id },
        data: {
          isPaused: true,
          pausedAt: now,
          pauseExpiresAt,
          pauseType,
        },
      });

      // Check for active tickets — if any, create self-notification
      const activeTicketCount = await prisma.ticket.count({
        where: {
          creativeId: user.id,
          status: { in: [TicketStatus.TODO, TicketStatus.IN_PROGRESS] },
        },
      });

      if (activeTicketCount > 0) {
        // Fire-and-forget notification
        createNotification({
          userId: user.id,
          type: "TICKET_STATUS_CHANGED",
          title: "You paused working",
          message: `You paused with ${activeTicketCount} active ticket${
            activeTicketCount > 1 ? "s" : ""
          }. No new tickets will be assigned until you resume.`,
          actorId: user.id,
        }).catch(() => {});
      }

      return NextResponse.json({
        isPaused: true,
        pausedAt: now.toISOString(),
        pauseExpiresAt: pauseExpiresAt?.toISOString() ?? null,
        pauseType,
        activeTicketCount,
      });
    }

    // ----- RESUME -----
    await prisma.userAccount.update({
      where: { id: user.id },
      data: {
        isPaused: false,
        pausedAt: null,
        pauseExpiresAt: null,
        pauseType: null,
      },
    });

    return NextResponse.json({
      isPaused: false,
      pausedAt: null,
      pauseExpiresAt: null,
      pauseType: null,
    });
  } catch (error: any) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    console.error("[creative.availability] PATCH error", error);
    return NextResponse.json({ error: "Failed to update availability" }, { status: 500 });
  }
}
