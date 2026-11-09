// -----------------------------------------------------------------------------
// @file: lib/support/sync-run.ts
// @purpose: Entry point bundled and run by scripts/sync-support-guides.mjs
//           during production builds, against the production database.
// -----------------------------------------------------------------------------

import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

import { syncGuideEntries } from "./sync";

export async function run(): Promise<void> {
  const result = await syncGuideEntries(
    {
      entries: () =>
        prisma.guideEntry.findMany({
          select: {
            id: true,
            audience: true,
            slug: true,
            fromCode: true,
            content: true,
            baseCodeHash: true,
            codeStatus: true,
            notifiedCodeHash: true,
          },
        }),
      update: async (id, data) => {
        await prisma.guideEntry.update({ where: { id }, data });
      },
      adminIds: async () =>
        (
          await prisma.userAccount.findMany({
            where: { role: { in: ["SITE_OWNER", "SITE_ADMIN"] } },
            select: { id: true },
          })
        ).map((user) => user.id),
    },
    (input) => createNotification({ ...input, type: "SUPPORT_GUIDE_CHANGED" }),
  );
  console.log(
    `[support-sync] checked ${result.checked} edited guides, ${result.changed} need review, notified ${result.notified} admins`,
  );
}
