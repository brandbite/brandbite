// -----------------------------------------------------------------------------
// @file: app/api/customer/tokens/export/route.ts
// @purpose: CSV of every ledger movement matching the customer's filters
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-11-05
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { CSV_BOM, csvRow } from "@/lib/csv";
import {
  buildLedgerWhere,
  LEDGER_INCLUDE,
  ledgerTicketCode,
  parseLedgerFilters,
  resolveCustomerCompany,
} from "@/lib/customer-token-ledger";
import { formatLedgerReason } from "@/lib/ledger-reason";
import { prisma } from "@/lib/prisma";

const BATCH_SIZE = 500;

const HEADER = [
  "Date (UTC)",
  "Type",
  "Amount",
  "Reason",
  "Ticket",
  "Notes",
  "Balance before",
  "Balance after",
];

/** Streams in batches, so a long ledger doesn't have to fit in memory or one response body. */
function ledgerCsvStream(where: Prisma.TokenLedgerWhereInput): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let cursor: string | undefined;
  let started = false;

  return new ReadableStream({
    async pull(controller) {
      try {
        if (!started) {
          started = true;
          controller.enqueue(encoder.encode(CSV_BOM + csvRow(HEADER)));
        }

        const rows = await prisma.tokenLedger.findMany({
          where,
          include: LEDGER_INCLUDE,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: BATCH_SIZE,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });

        if (rows.length > 0) {
          const chunk = rows
            .map((entry) =>
              csvRow([
                entry.createdAt.toISOString(),
                entry.direction === "CREDIT" ? "Credit" : "Debit",
                entry.amount,
                entry.reason ? formatLedgerReason(entry.reason) : null,
                ledgerTicketCode(entry),
                entry.notes,
                entry.balanceBefore,
                entry.balanceAfter,
              ]),
            )
            .join("");
          controller.enqueue(encoder.encode(chunk));
          cursor = rows[rows.length - 1].id;
        }

        if (rows.length < BATCH_SIZE) controller.close();
      } catch (error) {
        // Fails the download instead of handing over a file that looks complete.
        console.error("[customer.tokens.export] stream error", error);
        controller.error(error);
      }
    },
  });
}

export async function GET(req: NextRequest) {
  try {
    const resolved = await resolveCustomerCompany();
    if (!resolved.company) return resolved.response;

    const parsed = parseLedgerFilters(new URL(req.url).searchParams);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const where = await buildLedgerWhere(resolved.company.id, parsed.filters);

    return new Response(ledgerCsvStream(where), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="token-ledger.csv"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    console.error("[customer.tokens.export] GET error", error);
    return NextResponse.json({ error: "Failed to export token ledger" }, { status: 500 });
  }
}
