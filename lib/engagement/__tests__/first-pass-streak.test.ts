import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { countStreak } from "../first-pass-streak";

describe("countStreak", () => {
  it("counts first-pass approvals from the newest back to the first revision request", () => {
    expect(countStreak([true, true, true, false, true])).toBe(3);
  });
  it("is zero when the latest request needed a revision", () => {
    expect(countStreak([false, true, true])).toBe(0);
  });
  it("counts everything when there was never a revision request", () => {
    expect(countStreak([true, true])).toBe(2);
    expect(countStreak([])).toBe(0);
  });
});
