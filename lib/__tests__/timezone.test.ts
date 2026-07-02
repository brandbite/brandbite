import { describe, expect, it } from "vitest";

import { zonedWallTimeToUtc } from "@/lib/timezone";

describe("zonedWallTimeToUtc", () => {
  it("resolves a wall-clock time in a UTC-behind zone (EDT, summer)", () => {
    // 14:00 in New York in July (EDT, UTC-4) is 18:00 UTC.
    expect(zonedWallTimeToUtc("2026-07-14T14:00", "America/New_York").toISOString()).toBe(
      "2026-07-14T18:00:00.000Z",
    );
  });

  it("accounts for DST — same wall-clock, winter (EST, UTC-5)", () => {
    // 14:00 in New York in January (EST, UTC-5) is 19:00 UTC.
    expect(zonedWallTimeToUtc("2026-01-14T14:00", "America/New_York").toISOString()).toBe(
      "2026-01-14T19:00:00.000Z",
    );
  });

  it("resolves a wall-clock time in a UTC-ahead zone (Istanbul, UTC+3)", () => {
    expect(zonedWallTimeToUtc("2026-07-14T14:00", "Europe/Istanbul").toISOString()).toBe(
      "2026-07-14T11:00:00.000Z",
    );
  });

  it("is identity for UTC", () => {
    expect(zonedWallTimeToUtc("2026-07-14T14:00", "UTC").toISOString()).toBe(
      "2026-07-14T14:00:00.000Z",
    );
  });

  it("ignores a trailing Z / offset on the input (always treated as naive)", () => {
    expect(zonedWallTimeToUtc("2026-07-14T14:00:00Z", "America/New_York").toISOString()).toBe(
      "2026-07-14T18:00:00.000Z",
    );
    expect(zonedWallTimeToUtc("2026-07-14T14:00:00+05:00", "America/New_York").toISOString()).toBe(
      "2026-07-14T18:00:00.000Z",
    );
  });

  it("returns an Invalid Date for unparseable input", () => {
    expect(Number.isNaN(zonedWallTimeToUtc("not-a-date", "UTC").getTime())).toBe(true);
  });
});
