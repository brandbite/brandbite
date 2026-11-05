// -----------------------------------------------------------------------------
// @file: app/api/customer/tokens/export/route.ts
// @purpose: CSV of every ledger movement matching the customer's filters
// @version: v1.1.0
// @status: active
// @lastUpdate: 2026-11-05
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import {
  buildLedgerWhere,
  companyLedgerScope,
  parseLedgerFilters,
  resolveCustomerCompany,
} from "@/lib/customer-token-ledger";
import { tokenLedgerCsvResponse } from "@/lib/token-ledger-csv";

export async function GET(req: NextRequest) {
  try {
    const resolved = await resolveCustomerCompany();
    if (!resolved.company) return resolved.response;

    const parsed = parseLedgerFilters(new URL(req.url).searchParams);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const where = await buildLedgerWhere(companyLedgerScope(resolved.company.id), parsed.filters);

    return tokenLedgerCsvResponse(where, "customer.tokens.export");
  } catch (error: any) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    console.error("[customer.tokens.export] GET error", error);
    return NextResponse.json({ error: "Failed to export token ledger" }, { status: 500 });
  }
}
