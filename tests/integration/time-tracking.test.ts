// -----------------------------------------------------------------------------
// @file: tests/integration/time-tracking.test.ts
// @purpose: Integration tests for the D7 time-tracking service. Verifies
//           the core invariants — at most one running entry per creative,
//           ownership checks, idempotent stop — against real Postgres.
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import {
  deleteTimeEntry,
  getTicketTimeSummaryForCreative,
  startTicketTimer,
  stopTimeEntry,
  sumSecondsPerTicket,
  TimeEntryError,
} from "@/lib/tickets/time-tracking";
import { resetDatabase } from "./helpers/db";
import { createCompany, createUser } from "./helpers/fixtures";

async function createTicketForCreative(
  creativeId: string,
  title = "Test ticket",
): Promise<{ ticketId: string; companyId: string; customerId: string }> {
  const company = await createCompany({ tokenBalance: 500 });
  const customer = await createUser({ role: "CUSTOMER" });

  const ticket = await prisma.ticket.create({
    data: {
      title,
      status: "IN_PROGRESS",
      companyId: company.id,
      createdById: customer.id,
      creativeId,
    },
  });

  return { ticketId: ticket.id, companyId: company.id, customerId: customer.id };
}

// Small sleep so startedAt and endedAt differ by at least one second, which
// keeps duration assertions non-zero without making tests slow.
async function tick(ms = 1100) {
  await new Promise((r) => setTimeout(r, ms));
}

describe("time-tracking service (integration)", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("start/stop records a running entry that then stops with a non-zero duration", async () => {
    const creative = await createUser({ role: "DESIGNER" });
    const { ticketId } = await createTicketForCreative(creative.id);

    const { entry: started, autoStopped } = await startTicketTimer({
      ticketId,
      creativeId: creative.id,
    });
    expect(started.running).toBe(true);
    expect(started.durationSeconds).toBe(0);
    expect(autoStopped).toBeNull();

    await tick();

    const stopped = await stopTimeEntry({ entryId: started.id, creativeId: creative.id });
    expect(stopped.running).toBe(false);
    expect(stopped.durationSeconds).toBeGreaterThanOrEqual(1);

    const summary = await getTicketTimeSummaryForCreative(ticketId, creative.id);
    expect(summary.runningEntry).toBeNull();
    expect(summary.totalLoggedSeconds).toBeGreaterThanOrEqual(1);
    expect(summary.entries).toHaveLength(1);
  });

  it("starting a second timer auto-stops the first, enforcing at-most-one-running", async () => {
    const creative = await createUser({ role: "DESIGNER" });
    const { ticketId: ticketA } = await createTicketForCreative(creative.id, "Ticket A");
    const { ticketId: ticketB } = await createTicketForCreative(creative.id, "Ticket B");

    const first = await startTicketTimer({ ticketId: ticketA, creativeId: creative.id });
    expect(first.entry.running).toBe(true);

    await tick();

    const second = await startTicketTimer({ ticketId: ticketB, creativeId: creative.id });
    expect(second.entry.running).toBe(true);
    expect(second.autoStopped).not.toBeNull();
    expect(second.autoStopped!.id).toBe(first.entry.id);
    expect(second.autoStopped!.running).toBe(false);
    expect(second.autoStopped!.durationSeconds).toBeGreaterThanOrEqual(1);

    // Across the creative, only the second entry should still be running.
    const stillRunning = await prisma.ticketTimeEntry.findMany({
      where: { creativeId: creative.id, endedAt: null },
    });
    expect(stillRunning).toHaveLength(1);
    expect(stillRunning[0].id).toBe(second.entry.id);
  });

  it("refuses to start a timer for a creative who isn't assigned to the ticket", async () => {
    const assigned = await createUser({ role: "DESIGNER" });
    const intruder = await createUser({ role: "DESIGNER" });
    const { ticketId } = await createTicketForCreative(assigned.id);

    await expect(startTicketTimer({ ticketId, creativeId: intruder.id })).rejects.toMatchObject({
      code: "NOT_ASSIGNED_TO_CREATIVE",
    } satisfies Partial<TimeEntryError>);
  });

  it("refuses to stop another creative's entry", async () => {
    const owner = await createUser({ role: "DESIGNER" });
    const intruder = await createUser({ role: "DESIGNER" });
    const { ticketId } = await createTicketForCreative(owner.id);

    const { entry } = await startTicketTimer({ ticketId, creativeId: owner.id });

    await expect(
      stopTimeEntry({ entryId: entry.id, creativeId: intruder.id }),
    ).rejects.toMatchObject({ code: "ENTRY_NOT_OWNED" } satisfies Partial<TimeEntryError>);
  });

  it("refuses to stop an already-stopped entry", async () => {
    const creative = await createUser({ role: "DESIGNER" });
    const { ticketId } = await createTicketForCreative(creative.id);

    const { entry } = await startTicketTimer({ ticketId, creativeId: creative.id });
    await tick();
    await stopTimeEntry({ entryId: entry.id, creativeId: creative.id });

    await expect(
      stopTimeEntry({ entryId: entry.id, creativeId: creative.id }),
    ).rejects.toMatchObject({ code: "ENTRY_ALREADY_STOPPED" } satisfies Partial<TimeEntryError>);
  });

  it("deleteTimeEntry removes the entry and the owner check still blocks intruders", async () => {
    const creative = await createUser({ role: "DESIGNER" });
    const intruder = await createUser({ role: "DESIGNER" });
    const { ticketId } = await createTicketForCreative(creative.id);

    const { entry } = await startTicketTimer({ ticketId, creativeId: creative.id });

    await expect(
      deleteTimeEntry({ entryId: entry.id, creativeId: intruder.id }),
    ).rejects.toMatchObject({ code: "ENTRY_NOT_OWNED" } satisfies Partial<TimeEntryError>);

    await deleteTimeEntry({ entryId: entry.id, creativeId: creative.id });

    const remaining = await prisma.ticketTimeEntry.findMany({ where: { ticketId } });
    expect(remaining).toHaveLength(0);
  });

  it("sumSecondsPerTicket aggregates stopped entries across tickets", async () => {
    const creative = await createUser({ role: "DESIGNER" });
    const { ticketId: ticketA } = await createTicketForCreative(creative.id, "A");
    const { ticketId: ticketB } = await createTicketForCreative(creative.id, "B");

    const a1 = await startTicketTimer({ ticketId: ticketA, creativeId: creative.id });
    await tick();
    await stopTimeEntry({ entryId: a1.entry.id, creativeId: creative.id });

    const a2 = await startTicketTimer({ ticketId: ticketA, creativeId: creative.id });
    await tick();
    await stopTimeEntry({ entryId: a2.entry.id, creativeId: creative.id });

    const b1 = await startTicketTimer({ ticketId: ticketB, creativeId: creative.id });
    await tick();
    await stopTimeEntry({ entryId: b1.entry.id, creativeId: creative.id });

    const sums = await sumSecondsPerTicket([ticketA, ticketB]);
    expect(sums.get(ticketA)).toBeGreaterThanOrEqual(2);
    expect(sums.get(ticketB)).toBeGreaterThanOrEqual(1);
  });
});
