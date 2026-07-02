// -----------------------------------------------------------------------------
// @file: app/api/admin/tickets/auto-assign-backfill/route.ts
// @purpose: SITE_OWNER / SITE_ADMIN — re-run auto-assign across tickets that
//           were left unassigned (e.g. created before a company enabled
//           auto-assign). Idempotent and safe to re-run.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { isSiteAdminRole } from "@/lib/roles";
import { backfillAutoAssign } from "@/lib/tickets/backfill-assign";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();
    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    // Optional companyId narrows the sweep; omit to run across all companies.
    const body = await req.json().catch(() => ({}));
    const companyId =
      body && typeof body.companyId === "string" && body.companyId.length > 0
        ? body.companyId
        : undefined;

    const result = await backfillAutoAssign(companyId);
    return NextResponse.json(result);
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[admin/tickets/auto-assign-backfill] POST error", error);
    return NextResponse.json({ error: "Backfill failed" }, { status: 500 });
  }
}
