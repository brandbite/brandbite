// -----------------------------------------------------------------------------
// @file: app/api/customer/onboarding/__tests__/welcome-email.test.ts
// @purpose: Finishing onboarding sends the welcome email once per company.
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from "vitest";

const updateMany = vi.fn();
const findUniqueOrThrow = vi.fn();
const sendNotificationEmail = vi.fn();
const pendingAfter: Array<() => Promise<void>> = [];

vi.mock("@/lib/prisma", () => ({
  prisma: { company: { updateMany, findUniqueOrThrow } },
}));
vi.mock("@/lib/auth", () => ({
  getCurrentUserOrThrow: vi.fn(async () => ({
    id: "u1",
    email: "owner@example.com",
    name: "Sam",
    role: "CUSTOMER",
    activeCompanyId: "c1",
  })),
}));
vi.mock("@/lib/admin-event-email", () => ({ notifySiteOwnersOfEvent: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendNotificationEmail }));
vi.mock("@/lib/email-templates/onboarding/welcome", () => ({
  renderWelcomeEmail: vi.fn(async () => ({ subject: "Welcome", html: "<p>hi</p>" })),
}));
vi.mock("next/server", async (orig) => ({
  ...(await orig<typeof import("next/server")>()),
  after: (fn: () => Promise<void>) => pendingAfter.push(fn),
}));

const { PATCH } = await import("../route");

async function finish() {
  const res = await PATCH();
  for (const fn of pendingAfter.splice(0)) await fn();
  return res;
}

describe("PATCH /api/customer/onboarding — welcome email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findUniqueOrThrow.mockResolvedValue({ id: "c1", name: "Acme", plan: null });
  });

  it("sends the welcome email the first time onboarding is completed", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    const res = await finish();
    expect(res.status).toBe(200);
    expect(sendNotificationEmail).toHaveBeenCalledWith("owner@example.com", "Welcome", "<p>hi</p>");
  });

  it("does not send it again when onboarding was already complete", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    const res = await finish();
    expect(res.status).toBe(200);
    expect(sendNotificationEmail).not.toHaveBeenCalled();
  });
});
