// -----------------------------------------------------------------------------
// @file: lib/timezone.ts
// @purpose: Convert a naive "wall-clock" date-time (what a user picked in a
//           date + time field) into a real UTC instant, interpreted in a
//           specific IANA time zone — independent of the browser/server zone.
//
// Why this exists: a booking form lets the user pick "14:00" and separately
// choose a time zone (e.g. America/New_York). `new Date("2026-07-14T14:00")`
// resolves that string in the RUNTIME's local zone, so the booked instant is
// wrong whenever the runtime zone differs from the chosen zone. Resolving the
// wall-clock time in the chosen zone gives the correct absolute instant, which
// every downstream consumer (DB, Google Calendar) can use unambiguously.
// -----------------------------------------------------------------------------

/**
 * Offset (in ms) between UTC and `timeZone`'s wall-clock at `date`, i.e. the
 * value V such that (UTC instant + V) reads as the local wall-clock time in
 * `timeZone`. Positive east of UTC (e.g. +3h for Europe/Istanbul).
 */
function timeZoneOffsetMs(timeZone: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const fields: Record<string, number> = {};
  for (const part of dtf.formatToParts(date)) {
    if (part.type !== "literal") fields[part.type] = Number(part.value);
  }

  const asUtc = Date.UTC(
    fields.year,
    fields.month - 1,
    fields.day,
    fields.hour,
    fields.minute,
    fields.second,
  );
  return asUtc - date.getTime();
}

/**
 * Interpret a naive local date-time string (`YYYY-MM-DDTHH:mm`, optionally with
 * seconds) as wall-clock time in `timeZone` and return the corresponding UTC
 * instant. Any trailing `Z` or numeric offset on the input is stripped first —
 * the string is always treated as naive/local.
 *
 * Returns an Invalid Date if the input can't be parsed.
 */
export function zonedWallTimeToUtc(naiveLocal: string, timeZone: string): Date {
  const naive = naiveLocal.trim().replace(/(Z|[+-]\d{2}:?\d{2})$/i, "");

  // Treat the wall-clock components as if they were UTC to get a first anchor.
  const asIfUtc = new Date(`${naive}Z`);
  if (Number.isNaN(asIfUtc.getTime())) return new Date(NaN);

  // Subtract the zone offset to land on the true UTC instant. Do it twice so a
  // DST transition (where the offset differs before/after the guess) resolves
  // to the correct side of the boundary.
  const firstOffset = timeZoneOffsetMs(timeZone, asIfUtc);
  const guess = new Date(asIfUtc.getTime() - firstOffset);
  const secondOffset = timeZoneOffsetMs(timeZone, guess);
  if (secondOffset === firstOffset) return guess;
  return new Date(asIfUtc.getTime() - secondOffset);
}
