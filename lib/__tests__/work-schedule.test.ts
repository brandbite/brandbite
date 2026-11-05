import { describe, expect, it } from "vitest";

import {
  defaultWorkSchedule,
  describeInTimeZone,
  describeWorkSchedule,
  isWithinWorkSchedule,
  parseWorkSchedule,
  sameWorkSchedule,
  TIME_OPTIONS,
  workScheduleSchema,
  type WorkSchedule,
} from "@/lib/work-schedule";

const DEFAULT = { start: "09:00", end: "18:00" };
const weekdays = (timezone = "Europe/Istanbul") => defaultWorkSchedule(timezone);

function withDays(days: Partial<WorkSchedule["days"]>, timezone = "Europe/Istanbul"): WorkSchedule {
  const base = weekdays(timezone);
  return { ...base, days: { ...base.days, ...days } };
}

describe("workScheduleSchema", () => {
  it("accepts the default schedule", () => {
    expect(workScheduleSchema.safeParse(weekdays()).success).toBe(true);
  });

  it.each([
    ["an end before the start", withDays({ mon: { start: "18:00", end: "09:00" } })],
    ["an end equal to the start", withDays({ mon: { start: "09:00", end: "09:00" } })],
    ["a time off the half hour", withDays({ mon: { start: "09:15", end: "18:00" } })],
    ["an impossible time", withDays({ mon: { start: "25:00", end: "26:00" } })],
    ["an unknown zone", { ...weekdays(), timezone: "Mars/Olympus" }],
    [
      "no working days",
      withDays({ mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null }),
    ],
  ])("rejects %s", (_name, schedule) => {
    expect(workScheduleSchema.safeParse(schedule).success).toBe(false);
  });

  it("rejects free text and extra fields", () => {
    expect(parseWorkSchedule("9-18 weekdays")).toBeNull();
    expect(parseWorkSchedule(null)).toBeNull();
    expect(parseWorkSchedule({ ...weekdays(), note: "hi" })).toBeNull();
    const { sun: _sun, ...sixDays } = weekdays().days;
    expect(parseWorkSchedule({ timezone: "UTC", days: sixDays })).toBeNull();
  });

  it("offers every half hour, and the schema accepts every one it offers", () => {
    expect(TIME_OPTIONS).toHaveLength(48);
    expect(TIME_OPTIONS[0]).toBe("00:00");
    expect(TIME_OPTIONS[47]).toBe("23:30");
    for (const time of TIME_OPTIONS.slice(0, -1)) {
      const schedule = withDays({ mon: { start: time, end: "23:30" } });
      expect(workScheduleSchema.safeParse(schedule).success).toBe(true);
    }
  });
});

describe("describeWorkSchedule", () => {
  it("groups neighbouring days with the same hours", () => {
    expect(describeWorkSchedule(weekdays())).toBe("Mon–Fri 09:00–18:00");
  });

  it("keeps different hours apart, so per-day schedules read correctly", () => {
    const schedule = withDays({
      wed: { start: "10:00", end: "16:00" },
      sat: { start: "10:00", end: "14:00" },
    });
    expect(describeWorkSchedule(schedule)).toBe(
      "Mon–Tue 09:00–18:00, Wed 10:00–16:00, Thu–Fri 09:00–18:00, Sat 10:00–14:00",
    );
  });

  it("doesn't join days with a gap between them", () => {
    const schedule = withDays({
      tue: null,
      wed: null,
      thu: null,
      fri: null,
      mon: DEFAULT,
      sun: DEFAULT,
    });
    expect(describeWorkSchedule(schedule)).toBe("Mon 09:00–18:00, Sun 09:00–18:00");
  });
});

describe("describeInTimeZone", () => {
  // A Wednesday in November: Istanbul is UTC+3, New York UTC-5, London UTC+0.
  const november = new Date("2026-11-04T12:00:00Z");

  it("converts to the viewer's clock", () => {
    expect(describeInTimeZone(weekdays(), "Europe/London", november)).toBe("Mon–Fri 06:00–15:00");
  });

  it("returns null when both zones show the same time", () => {
    expect(describeInTimeZone(weekdays(), "Europe/Istanbul", november)).toBeNull();
    expect(describeInTimeZone(weekdays(), "Asia/Riyadh", november)).toBeNull();
  });

  it("moves the day when a shift starts on the viewer's previous day", () => {
    const early = withDays(
      {
        mon: { start: "01:00", end: "05:00" },
        tue: null,
        wed: null,
        thu: null,
        fri: null,
      },
      "Europe/Istanbul",
    );
    expect(describeInTimeZone(early, "America/New_York", november)).toBe("Sun 17:00–21:00");
  });

  it("wraps from Sunday to Monday", () => {
    const late = withDays(
      {
        mon: null,
        tue: null,
        wed: null,
        thu: null,
        fri: null,
        sun: { start: "20:00", end: "23:00" },
      },
      "America/New_York",
    );
    expect(describeInTimeZone(late, "Europe/Istanbul", november)).toBe("Mon 04:00–07:00");
  });

  it("handles half-hour zones", () => {
    expect(describeInTimeZone(weekdays("UTC"), "Asia/Kolkata", november)).toBe(
      "Mon–Fri 14:30–23:30",
    );
  });

  it("follows daylight saving through the date it's given", () => {
    const july = new Date("2026-07-01T12:00:00Z");
    expect(describeInTimeZone(weekdays(), "Europe/London", july)).toBe("Mon–Fri 07:00–16:00");
  });
});

describe("isWithinWorkSchedule", () => {
  it("reads the clock in the schedule's zone, not the machine's", () => {
    // Wednesday 12:00 UTC is 15:00 in Istanbul and 07:00 in New York.
    const at = new Date("2026-11-04T12:00:00Z");
    expect(isWithinWorkSchedule(weekdays("Europe/Istanbul"), at)).toBe(true);
    expect(isWithinWorkSchedule(weekdays("America/New_York"), at)).toBe(false);
  });

  it("includes the start and excludes the end", () => {
    expect(isWithinWorkSchedule(weekdays("UTC"), new Date("2026-11-04T09:00:00Z"))).toBe(true);
    expect(isWithinWorkSchedule(weekdays("UTC"), new Date("2026-11-04T17:59:00Z"))).toBe(true);
    expect(isWithinWorkSchedule(weekdays("UTC"), new Date("2026-11-04T18:00:00Z"))).toBe(false);
  });

  it("is false on a day off, and right at midnight", () => {
    expect(isWithinWorkSchedule(weekdays("UTC"), new Date("2026-11-07T12:00:00Z"))).toBe(false);
    const fromMidnight = withDays({ wed: { start: "00:00", end: "06:00" } }, "UTC");
    expect(isWithinWorkSchedule(fromMidnight, new Date("2026-11-04T00:00:00Z"))).toBe(true);
  });
});

describe("sameWorkSchedule", () => {
  it("compares zone and every day", () => {
    expect(sameWorkSchedule(weekdays(), weekdays())).toBe(true);
    expect(sameWorkSchedule(weekdays(), weekdays("UTC"))).toBe(false);
    expect(sameWorkSchedule(weekdays(), withDays({ sat: DEFAULT }))).toBe(false);
    expect(sameWorkSchedule(weekdays(), withDays({ fri: { start: "09:00", end: "17:00" } }))).toBe(
      false,
    );
    expect(sameWorkSchedule(null, weekdays())).toBe(false);
    expect(sameWorkSchedule(null, null)).toBe(true);
  });
});

describe("defaultWorkSchedule", () => {
  it("falls back to the machine's zone when given nothing usable", () => {
    const local = Intl.DateTimeFormat().resolvedOptions().timeZone;
    expect(defaultWorkSchedule(null).timezone).toBe(local);
    expect(defaultWorkSchedule("Not/AZone").timezone).toBe(local);
    expect(defaultWorkSchedule("Asia/Dubai").timezone).toBe("Asia/Dubai");
  });
});
