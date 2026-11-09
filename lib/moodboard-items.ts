// -----------------------------------------------------------------------------
// @file: lib/moodboard-items.ts
// @purpose: Server rules for moodboard items. Deleting only hides an item, so undo
//           can bring it and its file back; a day later it's removed for good.
//           A file can only be attached from the board's own storage folder.
// -----------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";
import { deleteR2Objects } from "@/lib/r2";

/** How long a deleted item can still be brought back. */
export const DELETED_ITEM_KEEP_MS = 24 * 60 * 60 * 1000;
const PURGE_BATCH = 50;

/** The stored file an item points at, if any. */
export function itemStorageKey(item: { type: string; data: unknown }): string | null {
  if (item.type !== "IMAGE" && item.type !== "FILE") return null;
  const data = item.data;
  if (data && typeof data === "object" && "storageKey" in data) {
    const key = (data as { storageKey?: unknown }).storageKey;
    return typeof key === "string" ? key : null;
  }
  return null;
}

/**
 * Item data comes from the browser, and a stored key is later turned into a signed
 * link and eventually deleted. So it has to be one of this board's own uploads.
 */
export function storageKeyAllowed(moodboardId: string, data: unknown): boolean {
  if (!data || typeof data !== "object" || !("storageKey" in data)) return true;
  const key = (data as { storageKey?: unknown }).storageKey;
  if (key === undefined || key === null) return true;
  return typeof key === "string" && key.startsWith(`moodboards/${moodboardId}/`);
}

/**
 * Removes items deleted more than a day ago, and their files. Runs when a board is
 * opened, a small batch at a time, so it needs no scheduled job. A file stays while
 * a copy on the same board still uses it.
 */
export async function purgeDeletedMoodboardItems(now = new Date()): Promise<void> {
  const expired = await prisma.moodboardItem.findMany({
    where: { deletedAt: { lt: new Date(now.getTime() - DELETED_ITEM_KEEP_MS) } },
    select: { id: true, type: true, data: true, moodboardId: true },
    take: PURGE_BATCH,
  });
  if (expired.length === 0) return;

  await prisma.moodboardItem.deleteMany({ where: { id: { in: expired.map((i) => i.id) } } });

  const unused: string[] = [];
  for (const item of expired) {
    const key = itemStorageKey(item);
    if (!key || unused.includes(key)) continue;
    const stillUsed = await prisma.moodboardItem.count({
      where: { moodboardId: item.moodboardId, data: { path: ["storageKey"], equals: key } },
    });
    if (stillUsed === 0) unused.push(key);
  }
  await deleteR2Objects(unused);
}
