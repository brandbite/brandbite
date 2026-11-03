// -----------------------------------------------------------------------------
// @file: lib/__tests__/withdrawal-notifications.test.ts
// @purpose: Creatives get a WITHDRAWAL_UPDATED notification with the right
//           copy for each outcome, and a failed send never throws.
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));
vi.mock("@/lib/notifications", () => ({ createNotification: mockCreate }));

import { notifyWithdrawalOutcome } from "../withdrawal-notifications";

beforeEach(() => {
  mockCreate.mockReset();
  mockCreate.mockResolvedValue(undefined);
});

describe("notifyWithdrawalOutcome", () => {
  it.each([
    ["APPROVED", "Withdrawal approved"],
    ["REJECTED", "Withdrawal not approved"],
    ["PAID", "Withdrawal paid"],
  ] as const)("sends %s to the creative", (outcome, title) => {
    notifyWithdrawalOutcome({ creativeId: "c1", amountTokens: 75, outcome, actorId: "a1" });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "c1",
        type: "WITHDRAWAL_UPDATED",
        title,
        actorId: "a1",
        message: expect.stringContaining("75 tokens"),
      }),
    );
  });

  it("swallows a failed send", async () => {
    mockCreate.mockRejectedValue(new Error("smtp down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      notifyWithdrawalOutcome({ creativeId: "c1", amountTokens: 5, outcome: "PAID" }),
    ).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
