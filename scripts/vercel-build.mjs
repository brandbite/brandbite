// -----------------------------------------------------------------------------
// @file: scripts/vercel-build.mjs
// @purpose: Vercel build entry-point. Applies pending Prisma migrations on
//           production deploys (VERCEL_ENV === "production"), then runs the
//           normal `next build`.
//
//           Why this script instead of putting `prisma migrate deploy` in
//           `package.json:build`:
//             - Preview deploys (PR branches) share the demo database but
//               MUST NOT apply WIP-branch migrations to it. We gate on
//               VERCEL_ENV so preview builds skip the migrate.
//             - CI build step in .github/workflows/ci.yml runs without a
//               real database; it just wants `next build` to succeed. This
//               script falls through to `next build` when VERCEL_ENV is
//               unset so CI stays untouched.
//             - Local `npm run build` also falls through.
//
//           Exit codes:
//             - Non-zero from either `prisma migrate deploy` or `next build`
//               propagates out, failing the Vercel deploy. That is the whole
//               point — if the migration fails, the code that depends on the
//               migration must not go live.
//
//           Known limitation:
//             Some older schema models (AiGeneration, Moodboard, Notification,
//             …) were introduced with `prisma db push` rather than
//             `migrate dev`, so their tables have no matching migration file.
//             `migrate deploy` will skip those tables. On the existing demo
//             database that is fine because the tables already exist. A fresh
//             production database would need a one-time bootstrap — see
//             docs/production-roadmap.md under "Operational cutover".
// -----------------------------------------------------------------------------

import { spawnSync } from "node:child_process";

/** @param {string[]} cmd */
function run(cmd) {
  console.log(`\n$ ${cmd.join(" ")}`);
  const result = spawnSync(cmd[0], cmd.slice(1), {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    console.error(`\nCommand failed with status ${result.status}: ${cmd.join(" ")}`);
    process.exit(result.status ?? 1);
  }
}

const vercelEnv = process.env.VERCEL_ENV ?? "(unset)";
const gitRef = process.env.VERCEL_GIT_COMMIT_REF ?? "(unset)";
const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
const hasDirectUrl = Boolean(process.env.DIRECT_URL);

console.log("[vercel-build] Environment summary");
console.log(`  VERCEL_ENV             = ${vercelEnv}`);
console.log(`  VERCEL_GIT_COMMIT_REF  = ${gitRef}`);
console.log(`  DATABASE_URL present   = ${hasDatabaseUrl}`);
console.log(`  DIRECT_URL present     = ${hasDirectUrl}`);

// -----------------------------------------------------------------------------
// Apply migrations only on production deploys. Preview deploys and CI skip
// this step — preview because it would touch the demo DB with WIP changes,
// CI because it does not have a real DATABASE_URL.
// -----------------------------------------------------------------------------
const shouldMigrate = vercelEnv === "production" && hasDatabaseUrl;

if (shouldMigrate) {
  // Prisma migrations need a non-pooled connection so the Postgres advisory
  // lock can be held for the duration of the migration. Fall back to
  // DATABASE_URL if DIRECT_URL is unset, and warn loudly — pooled URLs
  // through Neon's pooler (or PgBouncer in transaction mode) will fail
  // with P1002 "Timed out trying to acquire a postgres advisory lock".
  if (!hasDirectUrl) {
    console.warn(
      "\n[vercel-build] WARNING: DIRECT_URL is not set. Falling back to DATABASE_URL for migrations.\n" +
        "  If DATABASE_URL points at a pooled connection (Neon '*-pooler.*'),\n" +
        "  this WILL fail with P1002. Set DIRECT_URL to the non-pooled Neon URL\n" +
        "  in Vercel → Settings → Environment Variables → Production.",
    );
    process.env.DIRECT_URL = process.env.DATABASE_URL;
  }

  console.log("\n[vercel-build] Applying Prisma migrations (production deploy)");
  run(["npx", "prisma", "migrate", "deploy"]);
} else {
  const reason = !hasDatabaseUrl
    ? "no DATABASE_URL"
    : `VERCEL_ENV=${vercelEnv} (only production deploys migrate)`;
  console.log(`\n[vercel-build] Skipping prisma migrate deploy (${reason})`);
}

// -----------------------------------------------------------------------------
// Always run the Next.js build. If we short-circuited migrations above, Next
// still needs to compile and bundle.
// -----------------------------------------------------------------------------
run(["npx", "next", "build"]);
