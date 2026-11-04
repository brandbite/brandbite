import { describe, expect, it } from "vitest";

import { buildMeetingSlots, type SlotRules } from "@/lib/meetings/slots";

// Monday 2 November 2026, 08:00 UTC.
const NOW = new Date("2026-11-02T08:00:00.000Z");

function rules(overrides: Partial<SlotRules> = {}): SlotRules {
  return {
    now: NOW,
    workingDays: [1, 2, 3, 4, 5],
    workingHourStart: 9,
    workingHourEnd: 17,
    minNoticeHours: 24,
    maxBookingDays: 14,
    timeZone: "UTC",
    busy: [],
    ...overrides,
  };
}

describe("buildMeetingSlots", () => {
  it("offers half-hour starts within working hours, ending by closing time", () => {
    const tuesday = buildMeetingSlots(rules()).filter((s) => s.startsWith("2026-11-03"));
    expect(tuesday).toHaveLength(16);
    expect(tuesday[0]).toBe("2026-11-03T09:00:00.000Z");
    expect(tuesday[15]).toBe("2026-11-03T16:30:00.000Z");
  });

  it("skips non-working days", () => {
    const slots = buildMeetingSlots(rules());
    expect(slots.some((s) => s.startsWith("2026-11-07"))).toBe(false);
    expect(slots.some((s) => s.startsWith("2026-11-08"))).toBe(false);
  });

  it("respects minimum notice", () => {
    const slots = buildMeetingSlots(rules());
    expect(slots.some((s) => s.startsWith("2026-11-02"))).toBe(false);
    expect(new Date(slots[0]).getTime()).toBeGreaterThanOrEqual(
      NOW.getTime() + 24 * 60 * 60 * 1000,
    );
  });

  it("stops at the booking horizon", () => {
    const slots = buildMeetingSlots(rules({ maxBookingDays: 3 }));
    const horizon = NOW.getTime() + 3 * 24 * 60 * 60 * 1000;
    expect(slots.every((s) => new Date(s).getTime() <= horizon)).toBe(true);
  });

  it("removes slots that overlap a busy period, including partial overlaps", () => {
    const slots = buildMeetingSlots(
      rules({ busy: [{ start: "2026-11-03T10:15:00.000Z", end: "2026-11-03T11:00:00.000Z" }] }),
    );
    expect(slots).toContain("2026-11-03T09:30:00.000Z");
    expect(slots).not.toContain("2026-11-03T10:00:00.000Z");
    expect(slots).not.toContain("2026-11-03T10:30:00.000Z");
    expect(slots).toContain("2026-11-03T11:00:00.000Z");
  });

  it("treats a meeting ending exactly at the start of busy time as free", () => {
    const slots = buildMeetingSlots(
      rules({ busy: [{ start: "2026-11-03T10:00:00.000Z", end: "2026-11-03T10:30:00.000Z" }] }),
    );
    expect(slots).toContain("2026-11-03T09:30:00.000Z");
    expect(slots).toContain("2026-11-03T10:30:00.000Z");
  });

  it("reads working hours in the host's zone", () => {
    const slots = buildMeetingSlots(rules({ timeZone: "Europe/Istanbul", minNoticeHours: 0 }));
    // Istanbul is UTC+3: the 09:00 to 17:00 local day is 06:00 to 14:00 UTC.
    expect(slots).toContain("2026-11-03T06:00:00.000Z");
    expect(slots).toContain("2026-11-03T13:30:00.000Z");
    expect(slots).not.toContain("2026-11-03T05:30:00.000Z");
    expect(slots).not.toContain("2026-11-03T14:00:00.000Z");
  });

  it("follows daylight saving changes", () => {
    // New York moves from UTC-4 to UTC-5 on 1 November 2026.
    const slots = buildMeetingSlots(
      rules({
        now: new Date("2026-10-29T12:00:00.000Z"),
        timeZone: "America/New_York",
        maxBookingDays: 7,
      }),
    );
    expect(slots).toContain("2026-10-30T13:00:00.000Z"); // 09:00 EDT
    expect(slots).toContain("2026-11-02T14:00:00.000Z"); // 09:00 EST
  });

  it("uses the host's calendar day near midnight", () => {
    // Already Tuesday in Istanbul, still Monday in UTC.
    const slots = buildMeetingSlots(
      rules({
        now: new Date("2026-11-02T22:00:00.000Z"),
        timeZone: "Europe/Istanbul",
        minNoticeHours: 0,
      }),
    );
    expect(slots[0]).toBe("2026-11-03T06:00:00.000Z");
  });

  it("returns nothing when no days work", () => {
    expect(buildMeetingSlots(rules({ workingDays: [] }))).toEqual([]);
  });
});
