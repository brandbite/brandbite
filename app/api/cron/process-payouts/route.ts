// -----------------------------------------------------------------------------
// @file: app/api/cron/process-payouts/route.ts
// @purpose: Scheduled job — auto-create PENDING withdrawal requests for every
//           creative whose token balance is at or above the configured
//           threshold. Admins still review + mark paid out-of-band through
//           the existing /admin/withdrawals flow. Idempotent: skips creatives
//           who already have a PENDING request so re-running is safe.
//
//           Runs weekly via Vercel Cron (see vercel.json). Authenticated via
//           the Authorization: Bearer <CRON_SECRET> header — Vercel sets this
//           automatically for cron invocations.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { UserRole, WithdrawalStatus } from "@prisma/client";

import { getAppSetting, getAppSettingInt } from "@/lib/app-settings";
import { prisma } from "@/lib/prisma";
import { getUserTokenBalance } from "@/lib/token-engine";

type Summary = {
  skipped: boolean;
  reason?: string;
  threshold?: number;
  created: { creativeId: string; amount: number; withdrawalId: string }[];
  skippedAlreadyPending: string[];
  skippedBelowThreshold: number;
  errors: { creativeId: string; error: string }[];
};

/** Verify the incoming request is actually from Vercel Cron (or a manual
 *  admin trigger with the same secret). Returns true when authorized. */
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // No secret configured — refuse by default. Set CRON_SECRET in Vercel
    // Project Settings → Environment Variables (Production).
    return false;
  }
  const header = req.headers.get("authorization");
  if (!header) return false;
  if (header === `Bearer ${secret}`) return true;
  // Vercel's cron sometimes forwards as the raw value too; accept either.
  return header === secret;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary: Summary = {
    skipped: false,
    created: [],
    skippedAlreadyPending: [],
    skippedBelowThreshold: 0,
    errors: [],
  };

  try {
    const enabledRaw = await getAppSetting("AUTO_PAYOUT_ENABLED");
    const enabled = (enabledRaw ?? "true").toLowerCase() === "true";
    if (!enabled) {
      summary.skipped = true;
      summary.reason = "AUTO_PAYOUT_ENABLED is false";
      return NextResponse.json(summary);
    }

    const threshold = await getAppSettingInt("AUTO_PAYOUT_THRESHOLD_TOKENS", 100);
    summary.threshold = threshold;
    if (threshold <= 0) {
      summary.skipped = true;
      summary.reason = "AUTO_PAYOUT_THRESHOLD_TOKENS must be > 0";
      return NextResponse.json(summary);
    }

    const creatives = await prisma.userAccount.findMany({
      where: { role: UserRole.DESIGNER },
      select: { id: true },
    });

    for (const c of creatives) {
      try {
        const balance = await getUserTokenBalance(c.id);
        if (balance < threshold) {
          summary.skippedBelowThreshold += 1;
          continue;
        }

        const existing = await prisma.withdrawal.findFirst({
          where: { creativeId: c.id, status: WithdrawalStatus.PENDING },
          select: { id: true },
        });
        if (existing) {
          summary.skippedAlreadyPending.push(c.id);
          continue;
        }

        const created = await prisma.withdrawal.create({
          data: {
            creativeId: c.id,
            amountTokens: balance,
            status: WithdrawalStatus.PENDING,
            notes: `Auto-created by scheduled payout cron (threshold ${threshold}, balance ${balance}).`,
            metadata: {
              source: "cron:process-payouts",
              threshold,
              balanceAtCreation: balance,
            },
          },
        });

        summary.created.push({
          creativeId: c.id,
          amount: balance,
          withdrawalId: created.id,
        });
      } catch (err) {
        summary.errors.push({
          creativeId: c.id,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    console.log("[cron/process-payouts] run complete", {
      created: summary.created.length,
      skippedAlreadyPending: summary.skippedAlreadyPending.length,
      skippedBelowThreshold: summary.skippedBelowThreshold,
      errors: summary.errors.length,
    });

    return NextResponse.json(summary);
  } catch (error: unknown) {
    console.error("[cron/process-payouts] fatal error", error);
    return NextResponse.json(
      {
        ...summary,
        skipped: true,
        reason: error instanceof Error ? error.message : "Fatal error",
      },
      { status: 500 },
    );
  }
}
