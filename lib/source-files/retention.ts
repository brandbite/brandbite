// -----------------------------------------------------------------------------
// @file: lib/source-files/retention.ts
// @purpose: The 90-day rule for source files kept on brandbite (R2). Files in
//           the customer's own Google Drive are never touched.
//           - When a request is done, its R2 source files get a deletion
//             date: done + 90 days.
//           - 14 and 3 days before that date, the company's owners, project
//             managers and the requester get a reminder (bell + email, per
//             their notification choices) to download them or connect Drive.
//           - On the date, the files are deleted from R2.
//           - Uploads that never finished are cleaned up after a day.
//           Runs from the daily maintenance cron.
// -----------------------------------------------------------------------------

import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { deleteR2Objects } from "@/lib/r2";
import { buildTicketCode } from "@/lib/ticket-code";

import { r2DeleteAfter } from "./source-files";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Called when a request becomes Done: start the 90-day clock on its R2 files. */
export async function scheduleSourceFileRetention(
  ticketId: string,
  completedAt: Date,
): Promise<number> {
  const deleteAfter = r2DeleteAfter(completedAt);
  if (!deleteAfter) return 0;
  const { count } = await prisma.ticketSourceFile.updateMany({
    where: { ticketId, storage: "R2", deletedAt: null, deleteAfter: null },
    data: { deleteAfter },
  });
  return count;
}

export type RetentionRunResult = {
  remindersSent: number;
  filesDeleted: number;
  staleUploadsCleared: number;
};

function formatDay(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

async function remind(now: Date, days: 14 | 3): Promise<number> {
  const field = days === 14 ? "reminder14SentAt" : "reminder3SentAt";
  const files = await prisma.ticketSourceFile.findMany({
    where: {
      storage: "R2",
      status: "READY",
      deletedAt: null,
      deleteAfter: { gt: now, lte: new Date(now.getTime() + days * DAY_MS) },
      [field]: null,
    },
    select: { id: true, ticketId: true, deleteAfter: true },
  });
  if (files.length === 0) return 0;

  const byTicket = new Map<string, { ids: string[]; deleteAfter: Date }>();
  for (const file of files) {
    const group = byTicket.get(file.ticketId) ?? { ids: [], deleteAfter: file.deleteAfter! };
    group.ids.push(file.id);
    if (file.deleteAfter! < group.deleteAfter) group.deleteAfter = file.deleteAfter!;
    byTicket.set(file.ticketId, group);
  }

  let sent = 0;
  for (const [ticketId, group] of byTicket) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        title: true,
        companyId: true,
        createdById: true,
        companyTicketNumber: true,
        project: { select: { code: true } },
      },
    });
    if (ticket) {
      const managers = await prisma.companyMember.findMany({
        where: { companyId: ticket.companyId, roleInCompany: { in: ["OWNER", "PM"] } },
        select: { userId: true },
      });
      const recipients = new Set([ticket.createdById, ...managers.map((m) => m.userId)]);
      const code = buildTicketCode({
        projectCode: ticket.project?.code,
        companyTicketNumber: ticket.companyTicketNumber,
        ticketId: ticket.id,
      });
      const count = group.ids.length;
      const what = count === 1 ? "1 source file" : `${count} source files`;
      for (const userId of recipients) {
        await createNotification({
          userId,
          type: "SOURCE_FILES_EXPIRING",
          title: days === 14 ? "Source files deleted in 14 days" : "Source files deleted in 3 days",
          message: `${what} on ${code} "${ticket.title}" will be deleted from brandbite on ${formatDay(group.deleteAfter)}. Download them, or connect Google Drive or Dropbox to keep future files for good.`,
          ticketId: ticket.id,
        });
        sent += 1;
      }
    }
    // Mark both reminders when the 3-day one goes out first, so a late
    // 14-day reminder never follows it.
    await prisma.ticketSourceFile.updateMany({
      where: { id: { in: group.ids } },
      data:
        days === 3 ? { reminder3SentAt: now, reminder14SentAt: now } : { reminder14SentAt: now },
    });
  }
  return sent;
}

export async function runSourceFileRetention(now: Date = new Date()): Promise<RetentionRunResult> {
  // 1. Uploads that never finished (closed tab, dropped connection).
  const stale = await prisma.ticketSourceFile.findMany({
    where: { status: "UPLOADING", createdAt: { lt: new Date(now.getTime() - DAY_MS) } },
    select: { id: true, r2Key: true, storage: true },
  });
  if (stale.length > 0) {
    await deleteR2Objects(stale.filter((f) => f.storage === "R2").map((f) => f.r2Key));
    await prisma.ticketSourceFile.updateMany({
      where: { id: { in: stale.map((f) => f.id) } },
      data: { status: "FAILED", deletedAt: now },
    });
  }

  // 2. Reminders: 3 days first, so a file entering both windows at once gets one email.
  const remindersSent = (await remind(now, 3)) + (await remind(now, 14));

  // 3. Delete what reached its date.
  const due = await prisma.ticketSourceFile.findMany({
    where: { storage: "R2", deletedAt: null, deleteAfter: { lte: now } },
    select: { id: true, r2Key: true },
  });
  if (due.length > 0) {
    await deleteR2Objects(due.map((f) => f.r2Key));
    await prisma.ticketSourceFile.updateMany({
      where: { id: { in: due.map((f) => f.id) } },
      data: { deletedAt: now },
    });
  }

  return { remindersSent, filesDeleted: due.length, staleUploadsCleared: stale.length };
}
