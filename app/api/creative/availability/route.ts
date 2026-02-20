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
  isValidPauseType,
  calculatePauseExpiry,
  formatPauseStatus,
} from "@/lib/creative-availability";

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
      return NextResponse.json(
        { error: "Creative not found" },
        { status: 404 },
      );
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
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 },
      );
    }

    console.error("[creative.availability] GET error", error);
    return NextResponse.json(
      { error: "Failed to load availability" },
      { status: 500 },
    );
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

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const { action, pauseType } = body as {
      action?: string;
      pauseType?: string;
    };

    if (action !== "pause" && action !== "resume") {
      return NextResponse.json(
        { error: "action must be 'pause' or 'resume'" },
        { status: 400 },
      );
    }

    // ----- PAUSE -----
    if (action === "pause") {
      if (!pauseType || !isValidPauseType(pauseType)) {
        return NextResponse.json(
          { error: "pauseType must be '1_HOUR', '7_DAYS', or 'MANUAL'" },
          { status: 400 },
        );
      }

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
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 },
      );
    }

    console.error("[creative.availability] PATCH error", error);
    return NextResponse.json(
      { error: "Failed to update availability" },
      { status: 500 },
    );
  }
}
