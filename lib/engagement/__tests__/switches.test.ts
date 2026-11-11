// -----------------------------------------------------------------------------
// @file: lib/engagement/__tests__/switches.test.ts
// @purpose: Engagement switches are off unless the owner turned them on, and
//           only the owner can change them.
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { appSetting: { findMany } } }));

import {
  OWNER_ONLY_SETTING_KEYS,
  updateAdminSettingSchema,
} from "@/lib/schemas/admin-settings.schemas";

import { ENGAGEMENT_SETTING_KEYS } from "../switches";
import { getEngagementSwitches, isEngagementOn } from "../switches.server";

describe("engagement switches", () => {
  beforeEach(() => vi.clearAllMocks());

  it("has everything off when nothing is stored", async () => {
    findMany.mockResolvedValue([]);
    const switches = await getEngagementSwitches();
    expect(Object.values(switches).every((v) => v === false)).toBe(true);
  });

  it("turns on only what is stored as true", async () => {
    findMany.mockResolvedValue([
      { key: "ENGAGEMENT_LIVE_PROGRESS", value: "true" },
      { key: "ENGAGEMENT_THANK_YOUS", value: "false" },
    ]);
    expect(await isEngagementOn("liveProgress")).toBe(true);
    expect(await isEngagementOn("thankYous")).toBe(false);
    expect(await isEngagementOn("monthlyRecap")).toBe(false);
  });

  it("is off when the database can't be read", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    findMany.mockRejectedValue(new Error("down"));
    expect(await isEngagementOn("liveProgress")).toBe(false);
  });

  it("every switch is an owner-only true/false admin setting", () => {
    for (const key of ENGAGEMENT_SETTING_KEYS) {
      expect(OWNER_ONLY_SETTING_KEYS.has(key)).toBe(true);
      expect(updateAdminSettingSchema.safeParse({ key, value: "true" }).success).toBe(true);
      expect(updateAdminSettingSchema.safeParse({ key, value: "yes" }).success).toBe(false);
    }
  });
});
