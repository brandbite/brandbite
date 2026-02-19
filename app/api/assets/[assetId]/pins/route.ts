// -----------------------------------------------------------------------------
// @file: app/api/assets/[assetId]/pins/route.ts
// @purpose: GET + POST + PATCH asset pin annotations (customer review feedback + designer resolution)
// @version: v1.1.0
// @status: active
// @lastUpdate: 2025-12-28
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { TicketStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";

// ---------------------------------------------------------------------------
// Shared: load asset + authorize
// ---------------------------------------------------------------------------

async function loadAssetAndAuthorize(
  assetId: string,
  user: { id: string; role: string },
) {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: {
      id: true,
      ticketId: true,
      deletedAt: true,
      ticket: {
        select: {
          id: true,
          companyId: true,
          createdById: true,
          designerId: true,
          status: true,
        },
      },
    },
  });

  if (!asset || asset.deletedAt) {
    return { error: "NOT_FOUND" as const, status: 404, asset: null };
  }

  const companyId = asset.ticket.companyId;

  if (user.role === "CUSTOMER") {
    const membership = await prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId, userId: user.id } },
      select: { id: true },
    });
    if (!membership) {
      return { error: "FORBIDDEN" as const, status: 403, asset: null };
    }
  } else if (user.role === "DESIGNER") {
    if (!asset.ticket.designerId || asset.ticket.designerId !== user.id) {
      return { error: "FORBIDDEN" as const, status: 403, asset: null };
    }
  } else if (user.role === "SITE_OWNER" || user.role === "SITE_ADMIN") {
    // allowed
  } else {
    return { error: "FORBIDDEN" as const, status: 403, asset: null };
  }

  return { error: null, status: 200, asset };
}

// ---------------------------------------------------------------------------
// GET /api/assets/[assetId]/pins — Fetch all pins for an asset
// ---------------------------------------------------------------------------

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ assetId: string }> },
) {
  try {
    const user = await getCurrentUserOrThrow();
    const { assetId } = await ctx.params;

    const auth = await loadAssetAndAuthorize(assetId, user);
    if (auth.error) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status },
      );
    }

    const pins = await prisma.assetPin.findMany({
      where: { assetId },
      orderBy: { order: "asc" },
      select: {
        id: true,
        x: true,
        y: true,
        order: true,
        label: true,
        status: true,
        createdById: true,
        createdAt: true,
        resolvedAt: true,
      },
    });

    return NextResponse.json({
      assetId,
      pins: pins.map((p) => ({
        id: p.id,
        x: p.x,
        y: p.y,
        order: p.order,
        label: p.label,
        status: p.status,
        createdById: p.createdById,
        createdAt: p.createdAt.toISOString(),
        resolvedAt: p.resolvedAt ? p.resolvedAt.toISOString() : null,
      })),
    });
  } catch (err: any) {
    if (err?.code === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: "UNAUTHENTICATED" },
        { status: 401 },
      );
    }
    console.error("[GET /api/assets/:assetId/pins] error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/assets/[assetId]/pins — Bulk create pins (+ optional revision submit)
// ---------------------------------------------------------------------------

type PinInput = {
  x: number;
  y: number;
  order: number;
  label: string;
};

export async function POST(
  req: Request,
  ctx: { params: Promise<{ assetId: string }> },
) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Only customers can create pins." },
        { status: 403 },
      );
    }

    const { assetId } = await ctx.params;

    const auth = await loadAssetAndAuthorize(assetId, user);
    if (auth.error) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status },
      );
    }

    const asset = auth.asset!;
    const body = (await req.json()) as any;

    const pins = body?.pins as PinInput[] | undefined;
    const ticketId = body?.ticketId as string | undefined;
    const submitRevision = body?.submitRevision === true;
    const revisionMessage = (body?.revisionMessage as string | undefined) ?? "";

    // Validate pins array
    if (!Array.isArray(pins) || pins.length === 0) {
      return NextResponse.json(
        { error: "At least one pin is required." },
        { status: 400 },
      );
    }

    for (const pin of pins) {
      if (
        typeof pin.x !== "number" ||
        typeof pin.y !== "number" ||
        pin.x < 0 ||
        pin.x > 1 ||
        pin.y < 0 ||
        pin.y > 1
      ) {
        return NextResponse.json(
          { error: "Pin coordinates must be between 0 and 1." },
          { status: 400 },
        );
      }
      if (typeof pin.order !== "number" || pin.order < 1) {
        return NextResponse.json(
          { error: "Pin order must be >= 1." },
          { status: 400 },
        );
      }
      if (!pin.label || typeof pin.label !== "string" || !pin.label.trim()) {
        return NextResponse.json(
          { error: "Each pin must have a non-empty label." },
          { status: 400 },
        );
      }
    }

    // If submitting revision, validate ticket
    if (submitRevision) {
      if (!ticketId) {
        return NextResponse.json(
          { error: "ticketId is required when submitting a revision." },
          { status: 400 },
        );
      }
      if (asset.ticket.id !== ticketId) {
        return NextResponse.json(
          { error: "Asset does not belong to the specified ticket." },
          { status: 400 },
        );
      }
      if (asset.ticket.status !== TicketStatus.IN_REVIEW) {
        return NextResponse.json(
          { error: "Ticket must be IN_REVIEW to submit revision feedback." },
          { status: 400 },
        );
      }

      // Plan concurrency limit check
      const company = await prisma.company.findUnique({
        where: { id: asset.ticket.companyId },
        select: {
          plan: {
            select: { maxConcurrentInProgressTickets: true, name: true },
          },
        },
      });

      const plan = company?.plan;
      if (plan && plan.maxConcurrentInProgressTickets > 0) {
        const currentInProgress = await prisma.ticket.count({
          where: {
            companyId: asset.ticket.companyId,
            status: TicketStatus.IN_PROGRESS,
          },
        });
        if (currentInProgress >= plan.maxConcurrentInProgressTickets) {
          return NextResponse.json(
            {
              error:
                "Your company has reached its limit for active tickets in progress.",
            },
            { status: 400 },
          );
        }
      }
    }

    // Execute in transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1) Create all pins
      await tx.assetPin.createMany({
        data: pins.map((pin) => ({
          assetId,
          createdById: user.id,
          x: pin.x,
          y: pin.y,
          order: pin.order,
          label: pin.label.trim(),
        })),
      });

      // 2) If submitting revision: update last revision + ticket status
      if (submitRevision && ticketId) {
        const pinSummary =
          revisionMessage.trim() ||
          `${pins.length} pin annotation${pins.length > 1 ? "s" : ""} placed on the design`;

        const lastRevision = await tx.ticketRevision.findFirst({
          where: { ticketId },
          orderBy: { version: "desc" },
        });

        if (lastRevision) {
          await tx.ticketRevision.update({
            where: { id: lastRevision.id },
            data: {
              feedbackByCustomerId: user.id,
              feedbackAt: new Date(),
              feedbackMessage: pinSummary,
            },
          });
        }

        await tx.ticket.update({
          where: { id: ticketId },
          data: { status: TicketStatus.IN_PROGRESS },
        });
      }

      return { pinCount: pins.length };
    });

    // Fire notification to designer when customer submits feedback
    if (submitRevision && asset.ticket.designerId) {
      createNotification({
        userId: asset.ticket.designerId,
        type: "FEEDBACK_SUBMITTED",
        title: "Customer feedback received",
        message: `Customer submitted ${result.pinCount} revision note${result.pinCount > 1 ? "s" : ""}`,
        ticketId: asset.ticket.id,
        actorId: user.id,
      });
    }

    return NextResponse.json(
      { success: true, pinCount: result.pinCount },
      { status: 201 },
    );
  } catch (err: any) {
    if (err?.code === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: "UNAUTHENTICATED" },
        { status: 401 },
      );
    }
    console.error("[POST /api/assets/:assetId/pins] error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/assets/[assetId]/pins — Resolve a single pin (designer only)
// ---------------------------------------------------------------------------

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ assetId: string }> },
) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "DESIGNER" && user.role !== "SITE_OWNER" && user.role !== "SITE_ADMIN") {
      return NextResponse.json(
        { error: "Only designers can resolve pins." },
        { status: 403 },
      );
    }

    const { assetId } = await ctx.params;

    const auth = await loadAssetAndAuthorize(assetId, user);
    if (auth.error) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status },
      );
    }

    const body = (await req.json()) as any;
    const pinId = body?.pinId as string | undefined;

    if (!pinId || typeof pinId !== "string") {
      return NextResponse.json(
        { error: "pinId is required." },
        { status: 400 },
      );
    }

    // Load pin and verify it belongs to this asset
    const pin = await prisma.assetPin.findUnique({
      where: { id: pinId },
      select: { id: true, assetId: true, status: true, createdById: true, order: true, label: true },
    });

    if (!pin || pin.assetId !== assetId) {
      return NextResponse.json(
        { error: "Pin not found or does not belong to this asset." },
        { status: 404 },
      );
    }

    // Idempotent: if already resolved, return success with current state
    if (pin.status === "RESOLVED") {
      return NextResponse.json({
        success: true,
        pin: { id: pin.id, status: pin.status },
        alreadyResolved: true,
      });
    }

    // Resolve the pin
    const updated = await prisma.assetPin.update({
      where: { id: pinId },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
        resolvedById: user.id,
      },
      select: {
        id: true,
        status: true,
        resolvedAt: true,
      },
    });

    // Notify the customer who created the pin
    if (pin.createdById !== user.id) {
      createNotification({
        userId: pin.createdById,
        type: "PIN_RESOLVED",
        title: "Feedback note resolved",
        message: `Pin #${pin.order}${pin.label ? ` "${pin.label.slice(0, 60)}"` : ""} was marked as resolved`,
        ticketId: auth.asset!.ticket.id,
        actorId: user.id,
      });
    }

    return NextResponse.json({
      success: true,
      pin: {
        id: updated.id,
        status: updated.status,
        resolvedAt: updated.resolvedAt?.toISOString() ?? null,
      },
    });
  } catch (err: any) {
    if (err?.code === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: "UNAUTHENTICATED" },
        { status: 401 },
      );
    }
    console.error("[PATCH /api/assets/:assetId/pins] error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
