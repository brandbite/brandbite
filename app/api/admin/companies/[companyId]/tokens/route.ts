// -----------------------------------------------------------------------------
// @file: app/api/admin/companies/[companyId]/tokens/route.ts
// @purpose: SITE_OWNER / SITE_ADMIN manual token grant/revoke for a company.
//           Writes via applyCompanyLedgerEntry with reason ADMIN_ADJUSTMENT so
//           the movement appears in the token ledger with full audit metadata.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canGrantCompanyTokens } from "@/lib/roles";
import { parseBody } from "@/lib/schemas/helpers";
import { applyCompanyLedgerEntry } from "@/lib/token-engine";

const adjustSchema = z.object({
  direction: z.enum(["CREDIT", "DEBIT"]),
  amount: z.number().int().min(1, "Amount must be at least 1.").max(10_000_000),
  notes: z
    .string()
    .trim()
    .min(3, "Notes are required (at least 3 characters) for audit trail.")
    .max(500),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> },
) {
  try {
    const user = await getCurrentUserOrThrow();
    if (!canGrantCompanyTokens(user.role)) {
      return NextResponse.json(
        { error: "Only site owners can grant or revoke company tokens." },
        { status: 403 },
      );
    }

    const { companyId } = await params;
    const parsed = await parseBody(req, adjustSchema);
    if (!parsed.success) return parsed.response;

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, tokenBalance: true },
    });
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // Guard: don't let a DEBIT drive the balance negative.
    if (parsed.data.direction === "DEBIT" && company.tokenBalance < parsed.data.amount) {
      return NextResponse.json(
        {
          error: `Debit would drive balance below zero (current: ${company.tokenBalance}, requested: ${parsed.data.amount}).`,
        },
        { status: 400 },
      );
    }

    const { ledger, balanceAfter } = await applyCompanyLedgerEntry({
      companyId: company.id,
      amount: parsed.data.amount,
      direction: parsed.data.direction,
      reason: "ADMIN_ADJUSTMENT",
      notes: parsed.data.notes,
      metadata: {
        adminId: user.id,
        adminEmail: user.email,
      },
    });

    return NextResponse.json({
      entry: {
        id: ledger.id,
        direction: ledger.direction,
        amount: ledger.amount,
        notes: ledger.notes,
        createdAt: ledger.createdAt.toISOString(),
      },
      balanceAfter,
    });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[admin/companies/:id/tokens] POST error", error);
    return NextResponse.json({ error: "Failed to adjust tokens" }, { status: 500 });
  }
}
