// -----------------------------------------------------------------------------
// @file: lib/withdrawal-notifications.ts
// @purpose: Tell a creative when their withdrawal is approved, rejected or
//           paid. Called by every admin route that changes a withdrawal's
//           status (approve / reject / mark-paid and the PATCH action route).
//           Fire-and-forget: a failed notification never fails the money
//           operation that triggered it.
// -----------------------------------------------------------------------------

import { createNotification } from "@/lib/notifications";

export type WithdrawalOutcome = "APPROVED" | "REJECTED" | "PAID";

const COPY: Record<WithdrawalOutcome, { title: string; message: (n: number) => string }> = {
  APPROVED: {
    title: "Withdrawal approved",
    message: (n) => `Your withdrawal of ${n} tokens was approved and will be paid out soon.`,
  },
  REJECTED: {
    title: "Withdrawal not approved",
    message: (n) =>
      `Your withdrawal of ${n} tokens wasn't approved. The tokens are available in your balance again.`,
  },
  PAID: {
    title: "Withdrawal paid",
    message: (n) => `Your withdrawal of ${n} tokens has been paid.`,
  },
};

export function notifyWithdrawalOutcome(args: {
  creativeId: string;
  amountTokens: number;
  outcome: WithdrawalOutcome;
  actorId?: string;
}): void {
  const copy = COPY[args.outcome];
  void createNotification({
    userId: args.creativeId,
    type: "WITHDRAWAL_UPDATED",
    title: copy.title,
    message: copy.message(args.amountTokens),
    actorId: args.actorId,
  }).catch((err) => console.error("[withdrawal-notifications] failed", err));
}
