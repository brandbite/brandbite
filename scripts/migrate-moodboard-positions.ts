/**
 * One-time migration: backfill x/y/width/height for existing moodboard items.
 * Lays items out in a 4-column grid pattern based on their current position + colSpan.
 *
 * Run: npx tsx scripts/migrate-moodboard-positions.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const COL_WIDTH = 280;
const GAP = 20;
const ROW_HEIGHT = 220;
const COLS = 4;

async function main() {
  const moodboards = await prisma.moodboard.findMany({
    select: { id: true },
  });

  console.log(`Found ${moodboards.length} moodboards to migrate`);

  for (const mb of moodboards) {
    const items = await prisma.moodboardItem.findMany({
      where: { moodboardId: mb.id },
      orderBy: { position: "asc" },
      select: { id: true, position: true, colSpan: true },
    });

    if (items.length === 0) continue;

    // Check if already migrated (any item with non-zero x or y)
    const anyMigrated = await prisma.moodboardItem.findFirst({
      where: {
        moodboardId: mb.id,
        OR: [{ x: { not: 0 } }, { y: { not: 0 } }],
      },
    });
    if (anyMigrated) {
      console.log(`  Skipping moodboard ${mb.id} (already migrated)`);
      continue;
    }

    let col = 0;
    let row = 0;

    const updates = items.map((item) => {
      const span = item.colSpan === 2 ? 2 : 1;

      // If this item won't fit on the current row, wrap to next row
      if (col + span > COLS) {
        col = 0;
        row++;
      }

      const x = col * (COL_WIDTH + GAP);
      const y = row * (ROW_HEIGHT + GAP);
      const width = span === 2 ? COL_WIDTH * 2 + GAP : COL_WIDTH;

      col += span;
      if (col >= COLS) {
        col = 0;
        row++;
      }

      return prisma.moodboardItem.update({
        where: { id: item.id },
        data: { x, y, width, height: 0 },
      });
    });

    await prisma.$transaction(updates);
    console.log(`  Migrated ${items.length} items in moodboard ${mb.id}`);
  }

  console.log("Done!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
