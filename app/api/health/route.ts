// -----------------------------------------------------------------------------
// @file: app/api/health/route.ts
// @purpose: Lightweight health check for uptime monitors + Vercel. Pings
//           Prisma (the only component whose downtime is catastrophic) and
//           returns a structured result. Never requires auth — if the DB is
//           down, exposing that fact is not a secrets leak.
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Check = { name: string; ok: boolean; detail?: string };

export async function GET() {
  const checks: Check[] = [];
  let ok = true;

  // Prisma / Postgres round-trip. Uses the cheapest possible query.
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.push({ name: "db", ok: true });
  } catch (err) {
    ok = false;
    checks.push({
      name: "db",
      ok: false,
      detail: err instanceof Error ? err.message : "unknown",
    });
  }

  const body = {
    ok,
    service: "brandbite",
    time: new Date().toISOString(),
    checks,
  };

  // Return 200 only if everything is up; 503 otherwise so a dumb HTTP
  // uptime monitor flags it without parsing the body.
  return NextResponse.json(body, { status: ok ? 200 : 503 });
}
