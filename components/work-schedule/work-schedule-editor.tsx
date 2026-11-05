// -----------------------------------------------------------------------------
// @file: components/work-schedule/work-schedule-editor.tsx
// @purpose: Choose a time zone and each day's working hours. Used on the
//           creative's profile, the admin user panel and the hire form.
// -----------------------------------------------------------------------------

"use client";

import { useMemo } from "react";

import { Button, Field, Select } from "@/components/admin/v2/ui";
import {
  DAY_KEYS,
  DAY_LABELS,
  DEFAULT_RANGE,
  defaultWorkSchedule,
  formatTimeZone,
  TIME_OPTIONS,
  type DayKey,
  type DayRange,
  type WorkSchedule,
} from "@/lib/work-schedule";

function supportedTimeZones(): string[] {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] };
  return intl.supportedValuesOf?.("timeZone") ?? [];
}

/** What's wrong with this schedule, in the customer's words. Null when it can be saved. */
export function workScheduleProblem(schedule: WorkSchedule): string | null {
  if (!DAY_KEYS.some((day) => schedule.days[day])) return "Pick at least one working day.";
  const invalid = DAY_KEYS.find((day) => {
    const range = schedule.days[day];
    return range && range.start >= range.end;
  });
  return invalid ? `${DAY_LABELS[invalid]}: the end time needs to be after the start time.` : null;
}

export function WorkScheduleEditor({
  value,
  onChange,
  idPrefix,
  disabled = false,
}: {
  value: WorkSchedule;
  onChange: (next: WorkSchedule) => void;
  idPrefix: string;
  disabled?: boolean;
}) {
  const timeZones = useMemo(() => {
    const zones = supportedTimeZones();
    // Some browsers list a zone under a different name than the one saved.
    return zones.includes(value.timezone) ? zones : [value.timezone, ...zones];
  }, [value.timezone]);

  const setDay = (day: DayKey, range: DayRange | null) =>
    onChange({ ...value, days: { ...value.days, [day]: range } });

  const firstWorkingRange = DAY_KEYS.map((day) => value.days[day]).find(Boolean) ?? null;

  const applyToWorkingDays = () => {
    if (!firstWorkingRange) return;
    onChange({
      ...value,
      days: Object.fromEntries(
        DAY_KEYS.map((day) => [day, value.days[day] ? { ...firstWorkingRange } : null]),
      ) as WorkSchedule["days"],
    });
  };

  const problem = workScheduleProblem(value);

  return (
    <div className="space-y-4">
      <Field label="Time zone" htmlFor={`${idPrefix}-timezone`} className="max-w-sm">
        <Select
          id={`${idPrefix}-timezone`}
          value={value.timezone}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, timezone: e.target.value })}
        >
          {timeZones.map((zone) => (
            <option key={zone} value={zone}>
              {formatTimeZone(zone)}
            </option>
          ))}
        </Select>
      </Field>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={disabled}
          onClick={() => onChange(defaultWorkSchedule(value.timezone))}
        >
          Weekdays 09:00–18:00
        </Button>
        <Button
          size="sm"
          disabled={disabled || !firstWorkingRange}
          onClick={applyToWorkingDays}
          title="Copies the first working day's hours to your other working days."
        >
          {firstWorkingRange
            ? `Use ${firstWorkingRange.start}–${firstWorkingRange.end} on all working days`
            : "Use the same hours on all working days"}
        </Button>
      </div>

      <fieldset disabled={disabled}>
        <legend className="mb-1.5 text-sm font-medium">Working days and hours</legend>
        <ul className="divide-y divide-[var(--av2-border)]">
          {DAY_KEYS.map((day) => {
            const range = value.days[day];
            const label = DAY_LABELS[day];
            return (
              <li key={day} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2">
                <label className="flex w-32 items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--av2-accent)]"
                    checked={range !== null}
                    onChange={(e) => setDay(day, e.target.checked ? { ...DEFAULT_RANGE } : null)}
                  />
                  {label}
                </label>
                {range ? (
                  <div className="flex items-center gap-2">
                    <Select
                      aria-label={`${label} start time`}
                      className="w-28"
                      value={range.start}
                      onChange={(e) => setDay(day, { ...range, start: e.target.value })}
                    >
                      {TIME_OPTIONS.map((time) => (
                        <option key={time} value={time}>
                          {time}
                        </option>
                      ))}
                    </Select>
                    <span aria-hidden="true" className="text-sm text-[var(--av2-text-2)]">
                      –
                    </span>
                    <Select
                      aria-label={`${label} end time`}
                      className="w-28"
                      value={range.end}
                      aria-invalid={range.start >= range.end || undefined}
                      onChange={(e) => setDay(day, { ...range, end: e.target.value })}
                    >
                      {TIME_OPTIONS.map((time) => (
                        <option key={time} value={time}>
                          {time}
                        </option>
                      ))}
                    </Select>
                  </div>
                ) : (
                  <span className="text-sm text-[var(--av2-text-2)]">Not working</span>
                )}
              </li>
            );
          })}
        </ul>
      </fieldset>

      {problem ? (
        <p role="alert" className="text-xs text-[var(--av2-error-text)]">
          {problem}
        </p>
      ) : null}
    </div>
  );
}
