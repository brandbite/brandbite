// -----------------------------------------------------------------------------
// @file: app/api/admin/consultations/[id]/route.ts
// @purpose: PATCH — admin transitions a consultation. Key transitions:
//           PENDING → SCHEDULED (requires scheduledAt + videoLink)
//           SCHEDULED / PENDING → CANCELED (refund tokens)
//           SCHEDULED → COMPLETED (no ledger movement)
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { getConsultationSettings } from "@/lib/consultation/settings";
import { cancelConsultationEvent } from "@/lib/google/calendar";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/schemas/helpers";
import { updateConsultationSchema } from "@/lib/schemas/consultation.schemas";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUserOrThrow();
    if (user.role !== "SITE_OWNER" && user.role !== "SITE_ADMIN") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const { id } = await params;
    const parsed = await parseBody(req, updateConsultationSchema);
    if (!parsed.success) return parsed.response;

    const existing = await prisma.consultation.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        companyId: true,
        tokenCost: true,
        scheduledAt: true,
        videoLink: true,
        googleEventId: true,
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Consultation not found" }, { status: 404 });
    }

    const nextStatus = parsed.data.status ?? existing.status;

    // Guard: SCHEDULED requires both scheduledAt and videoLink at persist time.
    const willBeScheduledAt = parsed.data.scheduledAt ?? existing.scheduledAt;
    const willHaveVideoLink = parsed.data.videoLink ?? existing.videoLink;

    if (nextStatus === "SCHEDULED") {
      if (!willBeScheduledAt) {
        return NextResponse.json(
          { error: "A scheduledAt is required to move to SCHEDULED." },
          { status: 400 },
        );
      }
      if (!willHaveVideoLink) {
        return NextResponse.json(
          { error: "A videoLink is required to move to SCHEDULED." },
          { status: 400 },
        );
      }
    }

    // Decide whether to refund tokens. Refund once on transition to CANCELED
    // from a pre-refund state (PENDING or SCHEDULED).
    const shouldRefund =
      nextStatus === "CANCELED" &&
      (existing.status === "PENDING" || existing.status === "SCHEDULED");

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.consultation.update({
        where: { id },
        data: {
          status: parsed.data.status,
          scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : undefined,
          videoLink: parsed.data.videoLink,
          adminNotes: parsed.data.adminNotes,
        },
      });

      if (shouldRefund) {
        const company = await tx.company.findUniqueOrThrow({
          where: { id: existing.companyId },
          select: { tokenBalance: true },
        });
        const balanceBefore = company.tokenBalance;
        const balanceAfter = balanceBefore + existing.tokenCost;

        await tx.tokenLedger.create({
          data: {
            companyId: existing.companyId,
            userId: user.id,
            direction: "CREDIT",
            amount: existing.tokenCost,
            reason: "CONSULTATION_REFUND",
            notes: `Consultation ${id} cancelled — tokens refunded`,
            metadata: { consultationId: id },
            balanceBefore,
            balanceAfter,
          },
        });

        await tx.company.update({
          where: { id: existing.companyId },
          data: { tokenBalance: balanceAfter },
        });
      }

      return row;
    });

    // If we cancelled a booking that had a Google event, cancel it on Google
    // too so the attendees get a cancellation email and the calendar entry
    // disappears. Best-effort; booking is already cancelled in our DB.
    if (nextStatus === "CANCELED" && existing.status !== "CANCELED" && existing.googleEventId) {
      try {
        const settings = await getConsultationSettings();
        if (settings.googleRefreshToken) {
          await cancelConsultationEvent(
            settings,
            settings.googleCalendarId ?? "primary",
            existing.googleEventId,
          );
        }
      } catch (err) {
        console.error(
          "[admin/consultations/:id] Google event cancel failed (booking already cancelled in DB)",
          err,
        );
      }
    }

    return NextResponse.json({
      consultation: {
        id: updated.id,
        status: updated.status,
        scheduledAt: updated.scheduledAt?.toISOString() ?? null,
        videoLink: updated.videoLink,
        adminNotes: updated.adminNotes,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[admin/consultations/:id] PATCH error", error);
    return NextResponse.json({ error: "Failed to update consultation" }, { status: 500 });
  }
}
