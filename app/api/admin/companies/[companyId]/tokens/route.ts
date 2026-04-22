// -----------------------------------------------------------------------------
// @file: app/api/admin/companies/[companyId]/tokens/route.ts
// @purpose: SITE_OWNER / SITE_ADMIN manual token grant/revoke for a company.
//           Writes via applyCompanyLedgerEntry with reason ADMIN_ADJUSTMENT so
//           the movement appears in the token ledger with full audit metadata.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { AdminActionType } from "@prisma/client";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { extractAuditContext, logAdminAction } from "@/lib/admin-audit";
import { CONFIRMATION_PHRASES, checkConfirmationPhrase } from "@/lib/admin-confirmation";
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
  // Typed-phrase confirmation (Security Precaution Plan — L2). Expected
  // value is "GRANT" for CREDIT, "DEBIT" for DEBIT. Validated below via
  // checkConfirmationPhrase so the failure messages are consistent with
  // the other money routes.
  confirmation: z.string().min(1, "Confirmation phrase is required."),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> },
) {
  try {
    const user = await getCurrentUserOrThrow();
    const auditCtx = extractAuditContext(req);
    const { companyId } = await params;

    if (!canGrantCompanyTokens(user.role)) {
      await logAdminAction({
        actor: user,
        action: AdminActionType.COMPANY_TOKEN_GRANT,
        outcome: "BLOCKED",
        targetType: "Company",
        targetId: companyId,
        errorMessage: "Only site owners can grant or revoke company tokens.",
        context: auditCtx,
      });
      return NextResponse.json(
        { error: "Only site owners can grant or revoke company tokens." },
        { status: 403 },
      );
    }
    const parsed = await parseBody(req, adjustSchema);
    if (!parsed.success) return parsed.response;

    // Direction-specific phrase. CREDIT gives tokens to the company, DEBIT
    // takes them away — we use different phrases so the admin can't reuse
    // a GRANT confirmation to sneak in a DEBIT.
    const expectedPhrase =
      parsed.data.direction === "CREDIT"
        ? CONFIRMATION_PHRASES.COMPANY_TOKEN_CREDIT
        : CONFIRMATION_PHRASES.COMPANY_TOKEN_DEBIT;
    const phraseCheck = checkConfirmationPhrase(parsed.data.confirmation, expectedPhrase);
    if (!phraseCheck.ok) {
      await logAdminAction({
        actor: user,
        action: AdminActionType.COMPANY_TOKEN_GRANT,
        outcome: "BLOCKED",
        targetType: "Company",
        targetId: companyId,
        metadata: {
          direction: parsed.data.direction,
          amount: parsed.data.amount,
        },
        errorMessage: phraseCheck.error,
        context: auditCtx,
      });
      return NextResponse.json({ error: phraseCheck.error }, { status: 400 });
    }

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

    await logAdminAction({
      actor: user,
      action: AdminActionType.COMPANY_TOKEN_GRANT,
      outcome: "SUCCESS",
      targetType: "Company",
      targetId: company.id,
      metadata: {
        direction: parsed.data.direction,
        amount: parsed.data.amount,
        notes: parsed.data.notes,
        balanceBefore: company.tokenBalance,
        balanceAfter,
      },
      context: auditCtx,
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
