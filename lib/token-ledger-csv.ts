// -----------------------------------------------------------------------------
// @file: lib/token-ledger-csv.ts
// @purpose: The CSV download of ledger rows, shared by the customer and creative
//           exports. Each route decides who may read which rows.
// -----------------------------------------------------------------------------

import type { Prisma } from "@prisma/client";

import { CSV_BOM, csvRow } from "@/lib/csv";
import { LEDGER_INCLUDE, ledgerTicketCode } from "@/lib/customer-token-ledger";
import { formatLedgerReason } from "@/lib/ledger-reason";
import { prisma } from "@/lib/prisma";

const BATCH_SIZE = 500;

const HEADER = [
  "Date (UTC)",
  "Type",
  "Amount",
  "Reason",
  "Request",
  "Notes",
  "Balance before",
  "Balance after",
];

/** Streams in batches, so a long ledger doesn't have to fit in memory or one response body. */
function ledgerCsvStream(
  where: Prisma.TokenLedgerWhereInput,
  logLabel: string,
): ReadableStream<Uint8Array> {
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
        console.error(`[${logLabel}] stream error`, error);
        controller.error(error);
      }
    },
  });
}

export function tokenLedgerCsvResponse(
  where: Prisma.TokenLedgerWhereInput,
  logLabel: string,
): Response {
  return new Response(ledgerCsvStream(where, logLabel), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="token-ledger.csv"',
      "Cache-Control": "no-store",
    },
  });
}
