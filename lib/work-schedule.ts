// -----------------------------------------------------------------------------
// @file: lib/work-schedule.ts
// @purpose: A creative's weekly working hours: one optional time range per day,
//           in one IANA time zone. Shared by the server (validation) and the
//           dashboards (editing, summaries, time zone conversion).
//
//           The zone is stored with the schedule rather than read from
//           UserAccount.timezone, which is a display preference that follows the
//           browser. Someone travelling shouldn't silently shift their hours.
// -----------------------------------------------------------------------------

import { z } from "zod";

export const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type DayKey = (typeof DAY_KEYS)[number];

export const DAY_LABELS: Record<DayKey, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

const DAY_SHORT: Record<DayKey, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

export type DayRange = { start: string; end: string };
export type WorkSchedule = { timezone: string; days: Record<DayKey, DayRange | null> };

export const DEFAULT_RANGE: DayRange = { start: "09:00", end: "18:00" };

/** Every half hour of the day, "00:00" to "23:30". */
export const TIME_OPTIONS: string[] = Array.from({ length: 48 }, (_, i) => formatMinutes(i * 30));

function formatMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function isValidTimeZone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

const dayRangeSchema = z
  .object({
    start: z.string().regex(/^([01]\d|2[0-3]):(00|30)$/, "Pick a time on the hour or half hour"),
    end: z.string().regex(/^([01]\d|2[0-3]):(00|30)$/, "Pick a time on the hour or half hour"),
  })
  .strict()
  .refine((range) => range.start < range.end, "The end time needs to be after the start time");

export const workScheduleSchema = z
  .object({
    timezone: z.string().min(1).refine(isValidTimeZone, "Pick a valid time zone"),
    days: z
      .object({
        mon: dayRangeSchema.nullable(),
        tue: dayRangeSchema.nullable(),
        wed: dayRangeSchema.nullable(),
        thu: dayRangeSchema.nullable(),
        fri: dayRangeSchema.nullable(),
        sat: dayRangeSchema.nullable(),
        sun: dayRangeSchema.nullable(),
      })
      .strict(),
  })
  .strict()
  .refine(
    (schedule) => DAY_KEYS.some((day) => schedule.days[day]),
    "Pick at least one working day",
  );

/** Null for anything that isn't a valid schedule, such as an empty database column. */
export function parseWorkSchedule(value: unknown): WorkSchedule | null {
  const result = workScheduleSchema.safeParse(value);
  return result.success ? result.data : null;
}

/** A starting point to edit: Monday to Friday, 09:00–18:00. */
export function defaultWorkSchedule(timezone?: string | null): WorkSchedule {
  const usable =
    timezone && isValidTimeZone(timezone)
      ? timezone
      : Intl.DateTimeFormat().resolvedOptions().timeZone;
  return {
    timezone: usable,
    days: {
      mon: { ...DEFAULT_RANGE },
      tue: { ...DEFAULT_RANGE },
      wed: { ...DEFAULT_RANGE },
      thu: { ...DEFAULT_RANGE },
      fri: { ...DEFAULT_RANGE },
      sat: null,
      sun: null,
    },
  };
}

export function sameWorkSchedule(a: WorkSchedule | null, b: WorkSchedule | null): boolean {
  if (!a || !b) return a === b;
  if (a.timezone !== b.timezone) return false;
  return DAY_KEYS.every(
    (day) => a.days[day]?.start === b.days[day]?.start && a.days[day]?.end === b.days[day]?.end,
  );
}

type Entry = { dayIndex: number; start: string; end: string };

function summarize(entries: Entry[]): string {
  const sorted = [...entries].sort(
    (a, b) => a.dayIndex - b.dayIndex || (a.start < b.start ? -1 : 1),
  );
  const groups: { first: number; last: number; start: string; end: string }[] = [];
  for (const entry of sorted) {
    const previous = groups[groups.length - 1];
    if (
      previous &&
      previous.last === entry.dayIndex - 1 &&
      previous.start === entry.start &&
      previous.end === entry.end
    ) {
      previous.last = entry.dayIndex;
    } else {
      groups.push({ first: entry.dayIndex, last: entry.dayIndex, ...entry });
    }
  }
  return groups
    .map(({ first, last, start, end }) => {
      const days =
        first === last
          ? DAY_SHORT[DAY_KEYS[first]]
          : `${DAY_SHORT[DAY_KEYS[first]]}–${DAY_SHORT[DAY_KEYS[last]]}`;
      return `${days} ${start}–${end}`;
    })
    .join(", ");
}

function entriesOf(schedule: WorkSchedule): Entry[] {
  return DAY_KEYS.flatMap((day, dayIndex) => {
    const range = schedule.days[day];
    return range ? [{ dayIndex, start: range.start, end: range.end }] : [];
  });
}

/** "Mon–Fri 09:00–18:00, Sat 10:00–14:00" */
export function describeWorkSchedule(schedule: WorkSchedule): string {
  return summarize(entriesOf(schedule));
}

/** Readable zone name: "America/New_York" becomes "America/New York". */
export function formatTimeZone(timezone: string): string {
  return timezone.replace(/_/g, " ");
}

/** Minutes the zone is ahead of UTC at this moment. */
function offsetMinutes(timezone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  }).formatToParts(at);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(
    read("year"),
    read("month") - 1,
    read("day"),
    read("hour"),
    read("minute"),
  );
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/**
 * The schedule as read from another zone, using the offsets in force at `at` so
 * daylight saving is right for today. Days move when a shift crosses midnight.
 * Null when both zones are currently the same time, so there's nothing to add.
 */
export function describeInTimeZone(
  schedule: WorkSchedule,
  viewerTimezone: string,
  at: Date = new Date(),
): string | null {
  const delta = offsetMinutes(viewerTimezone, at) - offsetMinutes(schedule.timezone, at);
  if (delta === 0) return null;

  const week = 7 * 24 * 60;
  const day = 24 * 60;
  const shifted = entriesOf(schedule).map(({ dayIndex, start, end }) => {
    const startInWeek = (((dayIndex * day + toMinutes(start) + delta) % week) + week) % week;
    return {
      dayIndex: Math.floor(startInWeek / day),
      start: formatMinutes(startInWeek % day),
      end: formatMinutes((((toMinutes(end) + delta) % day) + day) % day),
    };
  });
  return summarize(shifted);
}

/** Whether `at` falls inside the schedule, in the schedule's own zone. */
export function isWithinWorkSchedule(schedule: WorkSchedule, at: Date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: schedule.timezone,
    hourCycle: "h23",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(at);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const range = schedule.days[read("weekday").toLowerCase() as DayKey];
  if (!range) return false;
  const now = `${read("hour").padStart(2, "0")}:${read("minute").padStart(2, "0")}`;
  return range.start <= now && now < range.end;
}
