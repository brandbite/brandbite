// -----------------------------------------------------------------------------
// @file: tests/integration/helpers/db.ts
// @purpose: Reset Postgres state between integration tests via TRUNCATE.
// -----------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";

type TableRow = { tablename: string };

/**
 * Truncate every user table in the public schema, CASCADE-safe.
 *
 * Discovers tables at runtime from `pg_tables` rather than hardcoding a list
 * so the helper stays correct as models are added or renamed. Skips Prisma's
 * own `_prisma_migrations` bookkeeping table.
 */
export async function resetDatabase(): Promise<void> {
  const rows = await prisma.$queryRawUnsafe<TableRow[]>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
  );
  if (rows.length === 0) return;
  const list = rows.map((r) => `"${r.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}
