// -----------------------------------------------------------------------------
// @file: lib/blocks/get-page-blocks.ts
// @purpose: Server-side helper that loads the ordered list of blocks for a
//           given page key, validates each row against its Zod schema, and
//           returns the typed result. Page renderers map over the result
//           and dispatch to per-type components via the registry.
//
//           Invalid rows are logged and skipped — better to render the
//           rest of the page than crash on one bad block.
// -----------------------------------------------------------------------------

import "server-only";

import { prisma } from "@/lib/prisma";
import { parseBlockData, type BlockData } from "./types";

export type PageBlock = BlockData & {
  /** PageBlock row id — needed by admin forms / save handlers. Not used
   *  by render components, which only see `type` + `data`. */
  id: string;
  /** Position within the page; lower renders first. */
  position: number;
};

/**
 * Returns blocks for `pageKey`, ordered by position ascending. Invalid
 * blocks are dropped (logged in `parseBlockData`). Returns an empty
 * array if no rows exist or all are invalid — caller can fall back to
 * defaults / hardcoded sections.
 */
export async function getPageBlocks(pageKey: string): Promise<PageBlock[]> {
  const rows = await prisma.pageBlock.findMany({
    where: { pageKey },
    orderBy: { position: "asc" },
    select: { id: true, position: true, type: true, data: true },
  });

  const valid: PageBlock[] = [];
  for (const row of rows) {
    const parsed = parseBlockData({ type: row.type, data: row.data });
    if (!parsed) continue;
    valid.push({ id: row.id, position: row.position, ...parsed });
  }
  return valid;
}
