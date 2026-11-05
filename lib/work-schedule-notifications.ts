// -----------------------------------------------------------------------------
// @file: lib/work-schedule-notifications.ts
// @purpose: Tell site admins when a creative changes their own working hours.
// -----------------------------------------------------------------------------

import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { describeWorkSchedule, formatTimeZone, type WorkSchedule } from "@/lib/work-schedule";

export async function notifyAdminsOfWorkScheduleChange(args: {
  creativeId: string;
  creativeName: string | null;
  creativeEmail: string;
  schedule: WorkSchedule;
}): Promise<void> {
  const admins = await prisma.userAccount.findMany({
    where: { role: { in: ["SITE_OWNER", "SITE_ADMIN"] }, deletedAt: null },
    select: { id: true },
  });

  const who = args.creativeName || args.creativeEmail;
  const hours = describeWorkSchedule(args.schedule);
  const zone = formatTimeZone(args.schedule.timezone);

  await Promise.allSettled(
    admins.map((admin) =>
      createNotification({
        userId: admin.id,
        type: "CREATIVE_SCHEDULE_UPDATED",
        title: "Working hours updated",
        message: `${who} changed their working hours to ${hours} (${zone}).`,
        actorId: args.creativeId,
      }),
    ),
  );
}
