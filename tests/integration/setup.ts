// -----------------------------------------------------------------------------
// @file: tests/integration/setup.ts
// @purpose: Integration-test bootstrap — verify DATABASE_URL points at a test
//           database, push the current schema, and hand control to the tests.
//
//           Uses `prisma db push --force-reset` for speed. Historically this
//           was also necessary because several models (AiGeneration,
//           Moodboard, Notification, …) had no matching migration file;
//           that drift was resolved by the baseline migration
//           `20260422000000_baseline`, so `prisma migrate deploy` would now
//           produce the same schema. We still prefer `db push --force-reset`
//           here because it is faster — tests drop + recreate between
//           suites and don't need migration-by-migration replay.
// -----------------------------------------------------------------------------

import { execSync } from "node:child_process";
import { beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";

function assertTestDatabase() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Integration tests need a throwaway Postgres URL.");
  }
  // Guard against pointing at the production / demo / staging DB.
  const lower = url.toLowerCase();
  const looksTest =
    lower.includes("localhost") ||
    lower.includes("127.0.0.1") ||
    lower.includes("_test") ||
    lower.includes("/test") ||
    lower.includes("brandbite_test");
  if (!looksTest) {
    throw new Error(
      `Refusing to run integration tests against DATABASE_URL="${url}". ` +
        "Point DATABASE_URL at a localhost / _test database.",
    );
  }
}

beforeAll(async () => {
  assertTestDatabase();
  // schema.prisma declares directUrl = env("DIRECT_URL"). Prisma CLI
  // (including `db push`) fails at parse time if that env is undefined.
  // In tests the DB is a direct connection (no pooler), so mirroring
  // DATABASE_URL is correct.
  if (!process.env.DIRECT_URL) {
    process.env.DIRECT_URL = process.env.DATABASE_URL;
  }
  // Drop + recreate all tables so the schema matches prisma/schema.prisma
  // exactly. `--force-reset` wipes the DB; safe only because assertTestDatabase
  // has already confirmed DATABASE_URL is a throwaway target.
  execSync("npx prisma db push --force-reset --accept-data-loss --skip-generate", {
    stdio: "inherit",
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
