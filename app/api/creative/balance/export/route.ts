// -----------------------------------------------------------------------------
// @file: app/api/creative/balance/export/route.ts
// @purpose: CSV of every ledger movement of the signed-in creative that matches
//           the filters, not only the 50 rows the balance page shows.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-11-05
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { buildLedgerWhere, parseLedgerFilters } from "@/lib/customer-token-ledger";
import { tokenLedgerCsvResponse } from "@/lib/token-ledger-csv";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "DESIGNER") {
      return NextResponse.json(
        { error: "Only creatives can access creative balance" },
        { status: 403 },
      );
    }

    const parsed = parseLedgerFilters(new URL(req.url).searchParams);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const where = await buildLedgerWhere({ userId: user.id }, parsed.filters);

    return tokenLedgerCsvResponse(where, "creative.balance.export");
  } catch (error: any) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    console.error("[creative.balance.export] GET error", error);
    return NextResponse.json({ error: "Failed to export token ledger" }, { status: 500 });
  }
}
