// -----------------------------------------------------------------------------
// @file: app/api/creative/tickets/[ticketId]/time-entries/[entryId]/route.ts
// @purpose: Stop + delete a specific time-tracking entry (D7).
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-04-20
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { deleteTimeEntry, stopTimeEntry, TimeEntryError } from "@/lib/tickets/time-tracking";

type RouteContext = {
  params: Promise<{ ticketId: string; entryId: string }>;
};

function mapTimeEntryError(err: unknown): NextResponse | null {
  if (!(err instanceof TimeEntryError)) return null;
  const status =
    err.code === "ENTRY_NOT_FOUND"
      ? 404
      : err.code === "ENTRY_NOT_OWNED"
        ? 403
        : err.code === "ENTRY_ALREADY_STOPPED"
          ? 409
          : err.code === "INVALID_NOTES"
            ? 400
            : 400;
  return NextResponse.json({ error: err.message, code: err.code }, { status });
}

/**
 * PATCH stops a running entry. Accepts an optional `notes` field. Passing
 * `notes: null` explicitly clears stored notes; omitting the field leaves
 * them unchanged.
 */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUserOrThrow();
    if (user.role !== "DESIGNER") {
      return NextResponse.json(
        { error: "Only creatives can stop timers on this endpoint." },
        { status: 403 },
      );
    }

    const { entryId } = await params;
    if (!entryId) {
      return NextResponse.json({ error: "Missing entryId in route params." }, { status: 400 });
    }

    const raw = (await req.json().catch(() => ({}))) as {
      action?: "stop";
      notes?: string | null;
    };

    if (raw.action && raw.action !== "stop") {
      return NextResponse.json({ error: `Unsupported action: ${raw.action}` }, { status: 400 });
    }

    const entry = await stopTimeEntry({
      entryId,
      creativeId: user.id,
      notes: raw.notes,
    });

    return NextResponse.json({ entry }, { status: 200 });
  } catch (error: unknown) {
    const mapped = mapTimeEntryError(error);
    if (mapped) return mapped;

    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[PATCH /api/creative/tickets/[ticketId]/time-entries/[entryId]] error", error);
    return NextResponse.json({ error: "Failed to update time entry" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUserOrThrow();
    if (user.role !== "DESIGNER") {
      return NextResponse.json(
        { error: "Only creatives can delete time entries on this endpoint." },
        { status: 403 },
      );
    }

    const { entryId } = await params;
    if (!entryId) {
      return NextResponse.json({ error: "Missing entryId in route params." }, { status: 400 });
    }

    await deleteTimeEntry({ entryId, creativeId: user.id });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: unknown) {
    const mapped = mapTimeEntryError(error);
    if (mapped) return mapped;

    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[DELETE /api/creative/tickets/[ticketId]/time-entries/[entryId]] error", error);
    return NextResponse.json({ error: "Failed to delete time entry" }, { status: 500 });
  }
}
