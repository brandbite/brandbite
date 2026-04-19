// -----------------------------------------------------------------------------
// @file: app/api/customer/consultations/route.ts
// @purpose: Customer-side list + create for consultations. Create debits the
//           token cost and leaves the row in PENDING for an admin to pick up.
//           Only OWNER/PM within the company may create.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { getConsultationSettings } from "@/lib/consultation/settings";
import { insufficientTokensResponse } from "@/lib/errors/insufficient-tokens";
import { createConsultationEvent, extractMeetLink } from "@/lib/google/calendar";
import { canBookConsultation } from "@/lib/permissions/companyRoles";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/schemas/helpers";
import { createConsultationSchema } from "@/lib/schemas/consultation.schemas";

// ---------------------------------------------------------------------------
// GET — list this company's consultations (any role can see)
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const user = await getCurrentUserOrThrow();
    if (!user.activeCompanyId) {
      return NextResponse.json({ error: "No active company" }, { status: 400 });
    }

    const [consultations, settings] = await Promise.all([
      prisma.consultation.findMany({
        where: { companyId: user.activeCompanyId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          description: true,
          preferredTimes: true,
          timezone: true,
          scheduledAt: true,
          videoLink: true,
          tokenCost: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          requestedBy: { select: { id: true, name: true, email: true } },
        },
      }),
      getConsultationSettings(),
    ]);

    return NextResponse.json({
      consultations: consultations.map((c) => ({
        ...c,
        scheduledAt: c.scheduledAt?.toISOString() ?? null,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
      tokenCost: settings.tokenCost,
    });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[customer/consultations] GET error", error);
    return NextResponse.json({ error: "Failed to load consultations" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — create a consultation (OWNER/PM only), debit tokens
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();
    if (user.role !== "CUSTOMER" || !user.activeCompanyId) {
      return NextResponse.json(
        { error: "Only company members can book consultations" },
        { status: 403 },
      );
    }
    if (!canBookConsultation(user.companyRole)) {
      return NextResponse.json(
        { error: "Only company OWNER or PM can book a consultation" },
        { status: 403 },
      );
    }

    const parsed = await parseBody(req, createConsultationSchema);
    if (!parsed.success) return parsed.response;

    const settings = await getConsultationSettings();
    if (!settings.enabled) {
      return NextResponse.json(
        { error: "Consultation bookings are currently disabled." },
        { status: 503 },
      );
    }
    const tokenCost = settings.tokenCost;

    // Balance check before creating the row
    const company = await prisma.company.findUniqueOrThrow({
      where: { id: user.activeCompanyId },
      select: { id: true, tokenBalance: true },
    });
    if (company.tokenBalance < tokenCost) {
      return insufficientTokensResponse({
        required: tokenCost,
        balance: company.tokenBalance,
        action: "consultation booking",
      });
    }

    // Decide up-front whether we can auto-schedule via Google Calendar.
    // This matters because an auto-scheduled booking goes straight to
    // SCHEDULED and we need the ISO datetime right now to create the
    // Calendar event. The legacy path (no Google connected) stays PENDING.
    const googleReady = Boolean(settings.googleRefreshToken);
    const preferredTimes = parsed.data.preferredTimes ?? undefined;

    // Pull the single preferred time the customer picked (PR #109 reduced
    // the UI to one). If absent OR Google isn't connected, we fall back to
    // the PENDING flow.
    const firstPreferred = preferredTimes?.[0];
    const canAutoSchedule =
      googleReady && firstPreferred && !Number.isNaN(Date.parse(firstPreferred));

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.consultation.create({
        data: {
          companyId: company.id,
          requestedByUserId: user.id,
          description: parsed.data.description,
          preferredTimes: preferredTimes ?? undefined,
          timezone: parsed.data.timezone,
          tokenCost,
          status: "PENDING",
        },
      });

      // Inline the ledger debit so we don't nest transactions. Mirrors
      // applyCompanyLedgerEntry's flow — keep the two paths in sync if
      // that helper's data shape evolves.
      const balanceBefore = company.tokenBalance;
      const balanceAfter = balanceBefore - tokenCost;

      await tx.tokenLedger.create({
        data: {
          companyId: company.id,
          userId: user.id,
          direction: "DEBIT",
          amount: tokenCost,
          reason: "CONSULTATION_BOOKING",
          notes: `Consultation booking ${row.id}`,
          metadata: { consultationId: row.id },
          balanceBefore,
          balanceAfter,
        },
      });

      await tx.company.update({
        where: { id: company.id },
        data: { tokenBalance: balanceAfter },
      });

      return row;
    });

    // Auto-schedule via Google Calendar (best-effort — booking stays PENDING
    // on failure so an admin can manually schedule it).
    if (canAutoSchedule) {
      try {
        const startIso = new Date(firstPreferred!).toISOString();
        const endIso = new Date(
          new Date(firstPreferred!).getTime() + settings.durationMinutes * 60_000,
        ).toISOString();
        const attendees = [user.email];
        if (settings.contactEmail) attendees.push(settings.contactEmail);

        const event = await createConsultationEvent(settings, {
          calendarId: settings.googleCalendarId ?? "primary",
          summary: `Brandbite consultation — ${parsed.data.description.slice(0, 60)}`,
          description:
            `Consultation request from ${user.email}.\n\n` +
            `Booking reference: ${created.id}\n\n` +
            `What they want to discuss:\n${parsed.data.description}`,
          startIso,
          endIso,
          timeZone: parsed.data.timezone ?? settings.companyTimezone ?? "UTC",
          attendeeEmails: attendees,
        });

        const meetLink = extractMeetLink(event);

        await prisma.consultation.update({
          where: { id: created.id },
          data: {
            status: "SCHEDULED",
            scheduledAt: new Date(startIso),
            videoLink: meetLink,
            googleEventId: event.id,
          },
        });

        return NextResponse.json(
          {
            consultation: {
              id: created.id,
              status: "SCHEDULED",
              tokenCost: created.tokenCost,
              scheduledAt: startIso,
              videoLink: meetLink,
              createdAt: created.createdAt.toISOString(),
            },
            autoScheduled: true,
          },
          { status: 201 },
        );
      } catch (err) {
        console.error(
          "[customer/consultations] auto-schedule via Google failed; leaving as PENDING",
          err,
        );
        // Fall through — the row exists and is PENDING; admin can schedule.
      }
    }

    return NextResponse.json(
      {
        consultation: {
          id: created.id,
          status: created.status,
          tokenCost: created.tokenCost,
          createdAt: created.createdAt.toISOString(),
        },
        autoScheduled: false,
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[customer/consultations] POST error", error);
    return NextResponse.json({ error: "Failed to create consultation" }, { status: 500 });
  }
}
