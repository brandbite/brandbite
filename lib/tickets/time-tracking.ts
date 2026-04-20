// -----------------------------------------------------------------------------
// @file: lib/tickets/time-tracking.ts
// @purpose: Domain service for creative ticket time tracking (D7). Keeps
//           invariants — at most one running entry per creative, per-ticket
//           scope, only the assigned creative can log time — out of route
//           handlers so the same rules apply whether entries are started by
//           the creative UI, a future admin tool, or tests.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-04-20
// -----------------------------------------------------------------------------

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Shared shapes
// ---------------------------------------------------------------------------

export type TimeEntryDto = {
  id: string;
  ticketId: string;
  creativeId: string;
  startedAt: string;
  endedAt: string | null;
  /**
   * Seconds recorded on stop. For running entries this is always 0 —
   * clients should compute the live duration as (now - startedAt).
   */
  durationSeconds: number;
  running: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type RawEntry = {
  id: string;
  ticketId: string;
  creativeId: string;
  startedAt: Date;
  endedAt: Date | null;
  durationSeconds: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function toTimeEntryDto(entry: RawEntry): TimeEntryDto {
  return {
    id: entry.id,
    ticketId: entry.ticketId,
    creativeId: entry.creativeId,
    startedAt: entry.startedAt.toISOString(),
    endedAt: entry.endedAt ? entry.endedAt.toISOString() : null,
    durationSeconds: entry.durationSeconds,
    running: entry.endedAt === null,
    notes: entry.notes,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Errors — callers map these to HTTP status codes
// ---------------------------------------------------------------------------

export class TimeEntryError extends Error {
  code:
    | "TICKET_NOT_FOUND"
    | "NOT_ASSIGNED_TO_CREATIVE"
    | "ENTRY_NOT_FOUND"
    | "ENTRY_ALREADY_STOPPED"
    | "ENTRY_NOT_OWNED"
    | "INVALID_NOTES";

  constructor(code: TimeEntryError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Guarantee the ticket exists and is currently assigned to this creative.
 * Any time-tracking mutation requires this check; reads also use it so a
 * creative can't peek at another creative's entries via URL tampering.
 */
async function assertCreativeOwnsTicket(
  tx: Prisma.TransactionClient | typeof prisma,
  ticketId: string,
  creativeId: string,
): Promise<void> {
  const ticket = await tx.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, creativeId: true },
  });
  if (!ticket) {
    throw new TimeEntryError("TICKET_NOT_FOUND", "Ticket not found.");
  }
  if (ticket.creativeId !== creativeId) {
    throw new TimeEntryError(
      "NOT_ASSIGNED_TO_CREATIVE",
      "You are not the assigned creative for this ticket.",
    );
  }
}

/** Normalise notes input — trim, cap length, empty → null. */
function normaliseNotes(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.length > 500) {
    throw new TimeEntryError("INVALID_NOTES", "Notes cannot exceed 500 characters.");
  }
  return trimmed;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Start a timer on this ticket for this creative. If the creative already
 * has a running entry (on this or any other ticket), it is stopped first
 * so there is always exactly zero-or-one running entry per creative.
 *
 * Returns both the new entry and, when applicable, the auto-stopped
 * previous entry so the UI can explain what happened.
 */
export async function startTicketTimer(args: {
  ticketId: string;
  creativeId: string;
  notes?: string | null;
}): Promise<{ entry: TimeEntryDto; autoStopped: TimeEntryDto | null }> {
  const notes = normaliseNotes(args.notes ?? null);

  return prisma.$transaction(async (tx) => {
    await assertCreativeOwnsTicket(tx, args.ticketId, args.creativeId);

    const existing = await tx.ticketTimeEntry.findFirst({
      where: { creativeId: args.creativeId, endedAt: null },
      orderBy: { startedAt: "desc" },
    });

    let autoStopped: RawEntry | null = null;
    if (existing) {
      const now = new Date();
      const duration = Math.max(
        0,
        Math.floor((now.getTime() - existing.startedAt.getTime()) / 1000),
      );
      autoStopped = await tx.ticketTimeEntry.update({
        where: { id: existing.id },
        data: { endedAt: now, durationSeconds: duration },
      });
    }

    const now = new Date();
    const entry = await tx.ticketTimeEntry.create({
      data: {
        ticketId: args.ticketId,
        creativeId: args.creativeId,
        startedAt: now,
        notes,
      },
    });

    return {
      entry: toTimeEntryDto(entry),
      autoStopped: autoStopped ? toTimeEntryDto(autoStopped) : null,
    };
  });
}

/**
 * Stop a running entry. Safe to call on the caller's own running entry
 * regardless of which ticket it's on — we only require (entry is running)
 * AND (caller owns the entry).
 */
export async function stopTimeEntry(args: {
  entryId: string;
  creativeId: string;
  notes?: string | null;
}): Promise<TimeEntryDto> {
  const notes = normaliseNotes(args.notes ?? undefined);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.ticketTimeEntry.findUnique({
      where: { id: args.entryId },
    });
    if (!existing) {
      throw new TimeEntryError("ENTRY_NOT_FOUND", "Time entry not found.");
    }
    if (existing.creativeId !== args.creativeId) {
      throw new TimeEntryError("ENTRY_NOT_OWNED", "This time entry belongs to another creative.");
    }
    if (existing.endedAt) {
      throw new TimeEntryError(
        "ENTRY_ALREADY_STOPPED",
        "This time entry has already been stopped.",
      );
    }

    const now = new Date();
    const duration = Math.max(0, Math.floor((now.getTime() - existing.startedAt.getTime()) / 1000));

    const updated = await tx.ticketTimeEntry.update({
      where: { id: args.entryId },
      data: {
        endedAt: now,
        durationSeconds: duration,
        // Only overwrite notes when the caller explicitly supplied them.
        ...(notes !== null || args.notes === null ? { notes } : {}),
      },
    });

    return toTimeEntryDto(updated);
  });
}

/**
 * Delete an entry. Only the owning creative can delete, and only their own
 * entries. We allow deletion of running entries too — it's the same hand
 * as "I forgot to stop this, just throw it away".
 */
export async function deleteTimeEntry(args: {
  entryId: string;
  creativeId: string;
}): Promise<void> {
  const existing = await prisma.ticketTimeEntry.findUnique({
    where: { id: args.entryId },
    select: { id: true, creativeId: true },
  });
  if (!existing) {
    throw new TimeEntryError("ENTRY_NOT_FOUND", "Time entry not found.");
  }
  if (existing.creativeId !== args.creativeId) {
    throw new TimeEntryError("ENTRY_NOT_OWNED", "This time entry belongs to another creative.");
  }

  await prisma.ticketTimeEntry.delete({ where: { id: args.entryId } });
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export type TicketTimeSummary = {
  entries: TimeEntryDto[];
  runningEntry: TimeEntryDto | null;
  /** Sum of stopped entries' durationSeconds for this ticket. */
  totalLoggedSeconds: number;
};

/**
 * Full time-tracking summary for a ticket from the creative's perspective.
 * Enforces ownership — a creative can only see entries for tickets
 * currently assigned to them.
 */
export async function getTicketTimeSummaryForCreative(
  ticketId: string,
  creativeId: string,
): Promise<TicketTimeSummary> {
  await assertCreativeOwnsTicket(prisma, ticketId, creativeId);

  const entries = await prisma.ticketTimeEntry.findMany({
    where: { ticketId, creativeId },
    orderBy: { startedAt: "desc" },
  });

  const dtos = entries.map(toTimeEntryDto);
  const running = dtos.find((e) => e.running) ?? null;
  const totalLoggedSeconds = dtos.reduce((sum, e) => sum + (e.running ? 0 : e.durationSeconds), 0);

  return { entries: dtos, runningEntry: running, totalLoggedSeconds };
}

/**
 * Admin-facing aggregate: total seconds logged per ticket across all its
 * entries (any creative, any running state — running entries add 0 because
 * they haven't been paid out yet).
 */
export async function sumSecondsPerTicket(ticketIds: string[]): Promise<Map<string, number>> {
  if (ticketIds.length === 0) return new Map();

  const rows = await prisma.ticketTimeEntry.groupBy({
    by: ["ticketId"],
    where: { ticketId: { in: ticketIds } },
    _sum: { durationSeconds: true },
  });

  const out = new Map<string, number>();
  for (const row of rows) {
    out.set(row.ticketId, row._sum.durationSeconds ?? 0);
  }
  return out;
}
