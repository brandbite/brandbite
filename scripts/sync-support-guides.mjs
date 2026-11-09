// -----------------------------------------------------------------------------
// @file: scripts/sync-support-guides.mjs
// @purpose: Production build step (scripts/vercel-build.mjs, after
//           migrations): checks admin edits of Support guides against the code
//           being deployed and notifies admins about guides that changed or
//           were removed. lib/support/sync-run.ts is TypeScript with "@/"
//           imports, so esbuild bundles it first. Never fails the build: a
//           problem here only delays the notification to the next deploy.
// -----------------------------------------------------------------------------

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// Bundled inside node_modules so the bundle's own imports (@prisma/client,
// resend) resolve against the project's node_modules.
const outDir = join(process.cwd(), "node_modules", ".cache", "brandbite");
const outfile = join(outDir, "support-sync.mjs");

// A stuck notification must not hold the build hostage.
setTimeout(() => {
  console.warn("[support-sync] timed out; continuing the build");
  process.exit(0);
}, 60_000).unref();

try {
  const { build } = await import("esbuild");
  mkdirSync(outDir, { recursive: true });
  await build({
    entryPoints: [join(process.cwd(), "lib/support/sync-run.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    packages: "external",
    tsconfig: join(process.cwd(), "tsconfig.json"),
    outfile,
    logLevel: "warning",
  });
  const { run } = await import(pathToFileURL(outfile).href);
  await run();
} catch (err) {
  console.warn("[support-sync] skipped:", err instanceof Error ? err.message : err);
}
