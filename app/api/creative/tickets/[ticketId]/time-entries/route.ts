// -----------------------------------------------------------------------------
// @file: app/api/creative/tickets/[ticketId]/time-entries/route.ts
// @purpose: List + start time-tracking entries on a creative ticket (D7).
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-04-20
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentUserOrThrow } from "@/lib/auth";
import {
  getTicketTimeSummaryForCreative,
  startTicketTimer,
  TimeEntryError,
} from "@/lib/tickets/time-tracking";

/**
 * Prisma raises P2021 when the TicketTimeEntry table is missing — happens
 * on demo/staging DBs where `prisma migrate deploy` hasn't run since D7.
 * We surface it as a 503 + a specific code the UI can branch on instead
 * of a scary 500 banner.
 */
function isMissingTableError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021";
}

function migrationPendingResponse(): NextResponse {
  return NextResponse.json(
    {
      error:
        "Time tracking is not yet available on this environment. The database migration hasn't been applied.",
      code: "MIGRATION_PENDING",
    },
    { status: 503 },
  );
}

type RouteContext = {
  params: Promise<{ ticketId: string }>;
};

function mapTimeEntryError(err: unknown): NextResponse | null {
  if (!(err instanceof TimeEntryError)) return null;
  const status =
    err.code === "TICKET_NOT_FOUND"
      ? 404
      : err.code === "NOT_ASSIGNED_TO_CREATIVE"
        ? 403
        : err.code === "INVALID_NOTES"
          ? 400
          : 400;
  return NextResponse.json({ error: err.message, code: err.code }, { status });
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUserOrThrow();
    if (user.role !== "DESIGNER") {
      return NextResponse.json(
        { error: "Only creatives can access time tracking on this endpoint." },
        { status: 403 },
      );
    }

    const { ticketId } = await params;
    if (!ticketId) {
      return NextResponse.json({ error: "Missing ticketId in route params." }, { status: 400 });
    }

    const summary = await getTicketTimeSummaryForCreative(ticketId, user.id);
    return NextResponse.json(summary, { status: 200 });
  } catch (error: unknown) {
    if (isMissingTableError(error)) return migrationPendingResponse();
    const mapped = mapTimeEntryError(error);
    if (mapped) return mapped;

    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[GET /api/creative/tickets/[ticketId]/time-entries] error", error);
    return NextResponse.json({ error: "Failed to load time entries" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUserOrThrow();
    if (user.role !== "DESIGNER") {
      return NextResponse.json(
        { error: "Only creatives can start timers on this endpoint." },
        { status: 403 },
      );
    }

    const { ticketId } = await params;
    if (!ticketId) {
      return NextResponse.json({ error: "Missing ticketId in route params." }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as { notes?: string | null };

    const result = await startTicketTimer({
      ticketId,
      creativeId: user.id,
      notes: body.notes ?? null,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: unknown) {
    if (isMissingTableError(error)) return migrationPendingResponse();
    const mapped = mapTimeEntryError(error);
    if (mapped) return mapped;

    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[POST /api/creative/tickets/[ticketId]/time-entries] error", error);
    return NextResponse.json({ error: "Failed to start timer" }, { status: 500 });
  }
}
