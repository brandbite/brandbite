// -----------------------------------------------------------------------------
// @file: lib/meetings/slots.ts
// @purpose: Work out which 30-minute slots can be booked. Pure: everything comes
//           in as arguments. Working hours are wall-clock times in the host's
//           zone, so slots stay correct across daylight-saving changes.
// -----------------------------------------------------------------------------

import { zonedWallTimeToUtc } from "@/lib/timezone";

export const MEETING_MINUTES = 30;
const MEETING_MS = MEETING_MINUTES * 60 * 1000;

export type BusyInterval = { start: string; end: string };

export type SlotRules = {
  now: Date;
  /** 0 = Sunday ... 6 = Saturday. */
  workingDays: number[];
  /** 24h local hours. The last meeting ends by workingHourEnd. */
  workingHourStart: number;
  workingHourEnd: number;
  minNoticeHours: number;
  maxBookingDays: number;
  timeZone: string;
  busy: BusyInterval[];
};

function localDateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

const pad = (value: number) => String(value).padStart(2, "0");

/** Bookable slot start times, earliest first, as ISO strings. */
export function buildMeetingSlots(rules: SlotRules): string[] {
  const earliest = rules.now.getTime() + rules.minNoticeHours * 60 * 60 * 1000;
  const latest = rules.now.getTime() + rules.maxBookingDays * 24 * 60 * 60 * 1000;
  const busy = rules.busy.map((b) => ({
    start: new Date(b.start).getTime(),
    end: new Date(b.end).getTime(),
  }));

  const { year, month, day } = localDateParts(rules.now, rules.timeZone);
  const slots: string[] = [];

  for (let offset = 0; offset <= rules.maxBookingDays; offset++) {
    // A UTC date is used only to step through calendar days and read the weekday.
    const calendarDay = new Date(Date.UTC(year, month - 1, day + offset));
    if (!rules.workingDays.includes(calendarDay.getUTCDay())) continue;

    const dateText = `${calendarDay.getUTCFullYear()}-${pad(calendarDay.getUTCMonth() + 1)}-${pad(
      calendarDay.getUTCDate(),
    )}`;

    for (let hour = rules.workingHourStart; hour < rules.workingHourEnd; hour++) {
      for (const minute of [0, 30]) {
        const start = zonedWallTimeToUtc(
          `${dateText}T${pad(hour)}:${pad(minute)}`,
          rules.timeZone,
        ).getTime();
        const end = start + MEETING_MS;
        if (start < earliest || start > latest) continue;
        if (busy.some((b) => start < b.end && end > b.start)) continue;
        slots.push(new Date(start).toISOString());
      }
    }
  }
  return slots;
}
