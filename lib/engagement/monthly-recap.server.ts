// -----------------------------------------------------------------------------
// @file: lib/engagement/monthly-recap.server.ts
// @purpose: Builds a company's recap for a month and emails last month's
//           recap to each company's owners and project managers, once.
//           Called from the daily maintenance cron; owner switch
//           ENGAGEMENT_MONTHLY_RECAP. Companies with nothing delivered in the
//           month get no email.
// -----------------------------------------------------------------------------

import { getAppSetting, setAppSetting } from "@/lib/app-settings";
import { sendNotificationEmail } from "@/lib/email";
import { renderSimpleEmail } from "@/lib/email-templates/simple";
import { prisma } from "@/lib/prisma";

import {
  agencyEquivalentUsd,
  formatUsd,
  previousMonth,
  type MonthlyRecap,
  type RecapMonth,
} from "./monthly-recap";
import { isEngagementOn } from "./switches.server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://brandbite.studio";

/** AppSetting holding the month key ("2026-10") of the last recap run. */
export const RECAP_SENT_KEY = "MONTHLY_RECAP_LAST_SENT";

export async function getMonthlyRecap(companyId: string, month: RecapMonth): Promise<MonthlyRecap> {
  const [delivered, debits] = await Promise.all([
    prisma.ticket.findMany({
      where: {
        companyId,
        status: "DONE",
        completedAt: { gte: month.start, lt: month.end },
      },
      select: { jobType: { select: { name: true, estimatedHours: true } } },
    }),
    prisma.tokenLedger.aggregate({
      where: {
        companyId,
        direction: "DEBIT",
        createdAt: { gte: month.start, lt: month.end },
      },
      _sum: { amount: true },
    }),
  ]);

  return {
    monthKey: month.key,
    monthLabel: month.label,
    monthName: month.name,
    jobsDelivered: delivered.length,
    tokensUsed: debits._sum.amount ?? 0,
    agencyEquivalentUsd: agencyEquivalentUsd(
      delivered.map((t) => ({
        serviceName: t.jobType?.name ?? null,
        estimatedHours: t.jobType?.estimatedHours ?? null,
      })),
    ),
  };
}

export async function renderRecapEmail(
  recap: MonthlyRecap,
): Promise<{ subject: string; html: string }> {
  const html = await renderSimpleEmail({
    role: "customer",
    previewText: `${recap.jobsDelivered} requests delivered in ${recap.monthLabel}.`,
    reason: "You received this email because you manage a brandbite workspace.",
    title: `Your ${recap.monthName} design recap`,
    intro: [`Here's what your brandbite workspace delivered in ${recap.monthLabel}.`],
    cards: [
      {
        icon: "check",
        title: recap.monthLabel,
        filled: true,
        tiles: [
          { label: "Requests delivered", value: String(recap.jobsDelivered), highlight: true },
          { label: "Tokens used", value: String(recap.tokensUsed), highlight: true },
        ],
      },
      ...(recap.agencyEquivalentUsd !== null
        ? [
            {
              icon: "coins" as const,
              label: "Estimated agency equivalent",
              title: `≈ ${formatUsd(recap.agencyEquivalentUsd)}`,
              tone: "neutral" as const,
            },
          ]
        : []),
    ],
    note:
      recap.agencyEquivalentUsd !== null
        ? {
            text: "An estimate based on the brandbite cost calculator: typical hours for each delivered request at a typical US agency rate. Not a quote.",
          }
        : undefined,
    action: { href: `${APP_URL}/customer`, label: "View monthly recap" },
  });
  return { subject: `Your ${recap.monthName} design recap`, html };
}

export type RecapRunResult =
  | { skipped: "switched-off" | "already-sent"; month?: string }
  | { month: string; companies: number; emails: number };

/**
 * Sends last month's recap, once per month. Safe to call every day: the
 * month key is stored before sending, so a crash can skip some companies
 * but never emails anyone twice.
 */
export async function sendMonthlyRecaps(now = new Date()): Promise<RecapRunResult> {
  if (!(await isEngagementOn("monthlyRecap"))) return { skipped: "switched-off" };
  const month = previousMonth(now);
  if ((await getAppSetting(RECAP_SENT_KEY)) === month.key) {
    return { skipped: "already-sent", month: month.key };
  }
  await setAppSetting(RECAP_SENT_KEY, month.key);

  // Only companies that had something delivered in the month.
  const active = await prisma.ticket.findMany({
    where: { status: "DONE", completedAt: { gte: month.start, lt: month.end } },
    select: { companyId: true },
    distinct: ["companyId"],
  });

  let emails = 0;
  for (const { companyId } of active) {
    try {
      const recap = await getMonthlyRecap(companyId, month);
      if (recap.jobsDelivered === 0) continue;
      const members = await prisma.companyMember.findMany({
        where: {
          companyId,
          roleInCompany: { in: ["OWNER", "PM"] },
          user: { deletedAt: null },
        },
        select: { user: { select: { email: true } } },
      });
      const { subject, html } = await renderRecapEmail(recap);
      for (const member of members) {
        if (!member.user.email) continue;
        await sendNotificationEmail(member.user.email, subject, html);
        emails += 1;
      }
    } catch (err) {
      console.error("[monthly-recap] company failed", companyId, err);
    }
  }
  return { month: month.key, companies: active.length, emails };
}
