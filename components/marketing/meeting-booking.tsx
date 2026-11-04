// -----------------------------------------------------------------------------
// @file: components/marketing/meeting-booking.tsx
// @purpose: Public 30-minute booking: pick a week, day and time in a chosen time
//           zone, then enter contact details. Also the /meetings/[token] view for
//           rescheduling or canceling. Only open times are ever shown, so the page
//           doesn't reveal when the host is busy. Posts to /api/meetings.
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

const FIELD =
  "h-12 w-full rounded-[10px] border border-[var(--meet-border)] bg-[var(--meet-surface)] px-3 text-sm leading-5 font-normal text-[var(--meet-text)] placeholder:text-[var(--meet-muted)]";
const PRIMARY =
  "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-[var(--meet-brand)] px-5 text-sm leading-5 font-semibold whitespace-nowrap text-white transition-colors hover:bg-[var(--meet-brand-hover)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[var(--meet-brand)]";
const SECONDARY =
  "inline-flex h-11 items-center justify-center rounded-[10px] border border-[var(--meet-border)] bg-[var(--meet-surface)] px-5 text-sm leading-5 font-semibold whitespace-nowrap text-[var(--meet-text)] transition-colors hover:border-[var(--meet-text)] disabled:cursor-not-allowed disabled:opacity-50";
const LABEL = "text-sm leading-5 font-semibold";
const TEXT_LINK = "font-medium text-[var(--meet-brand-strong)] underline";

const INITIAL_TIMES = 9;

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      {children}
    </svg>
  );
}

const CheckIcon = () => (
  <Icon>
    <path d="m5 12 5 5L20 7" />
  </Icon>
);
const ChevronLeftIcon = () => (
  <Icon>
    <path d="m15 6-6 6 6 6" />
  </Icon>
);
const ChevronRightIcon = () => (
  <Icon>
    <path d="m9 6 6 6-6 6" />
  </Icon>
);
const ArrowRightIcon = () => (
  <Icon>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </Icon>
);
export const VideoIcon = () => (
  <Icon>
    <rect x="2" y="6" width="14" height="12" rx="2" />
    <path d="m16 10 6-3v10l-6-3" />
  </Icon>
);

// --- Dates --------------------------------------------------------------------

function visitorTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function allTimeZones(current: string): string[] {
  let zones: string[] = [];
  try {
    zones = Intl.supportedValuesOf("timeZone");
  } catch {
    // Older browsers just get the visitor's own zone and UTC.
  }
  return Array.from(new Set([current, "UTC", ...zones])).sort();
}

function zoneLabel(timeZone: string): string {
  try {
    const offset = new Intl.DateTimeFormat("en-GB", { timeZone, timeZoneName: "longOffset" })
      .formatToParts(new Date())
      .find((part) => part.type === "timeZoneName")?.value;
    return offset ? `${timeZone} (${offset === "GMT" ? "GMT+00:00" : offset})` : timeZone;
  } catch {
    return timeZone;
  }
}

/** The slot's calendar day in a zone, as YYYY-MM-DD. */
function dayKey(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/** A YYYY-MM-DD key as a UTC date, used only for calendar arithmetic and labels. */
function keyToDate(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function mondayOf(key: string): string {
  const date = keyToDate(key);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

function formatKey(key: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" }).format(keyToDate(key));
}

function formatDayHeading(key: string): string {
  const weekday = formatKey(key, { weekday: "long" });
  return `${weekday}, ${formatKey(key, { day: "numeric", month: "long" })}`;
}

function formatWeekRange(firstKey: string, lastKey: string): string {
  const first = keyToDate(firstKey);
  const last = keyToDate(lastKey);
  const sameMonth =
    first.getUTCMonth() === last.getUTCMonth() && first.getUTCFullYear() === last.getUTCFullYear();
  return sameMonth
    ? `${first.getUTCDate()}–${formatKey(lastKey, { day: "numeric", month: "long", year: "numeric" })}`
    : `${formatKey(firstKey, { day: "numeric", month: "short" })} – ${formatKey(lastKey, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })}`;
}

function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatFull(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso));
}

function formatSummaryDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

// --- Availability -------------------------------------------------------------

type Availability = {
  status: "loading" | "ready" | "unavailable";
  slots: string[];
  /** Preview deployments only: sample times, and nothing is submitted. */
  demo?: boolean;
};

async function fetchAvailability(): Promise<Availability> {
  try {
    const res = await fetch("/api/meetings/availability", { cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (res.ok && json?.available && Array.isArray(json.slots)) {
      return { status: "ready", slots: json.slots, demo: json.demo === true };
    }
  } catch {
    // Falls through to unavailable.
  }
  return { status: "unavailable", slots: [] };
}

function useAvailability() {
  const [state, setState] = useState<Availability>({ status: "loading", slots: [] });

  const reload = useCallback(async () => {
    setState(await fetchAvailability());
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchAvailability().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { ...state, reload };
}

// --- Picker -------------------------------------------------------------------

function SlotPicker({
  slots,
  timeZone,
  onTimeZoneChange,
  value,
  onChange,
}: {
  slots: string[];
  timeZone: string;
  onTimeZoneChange: (timeZone: string) => void;
  value: string | null;
  onChange: (slot: string | null) => void;
}) {
  const zoneId = useId();
  const zones = useMemo(() => allTimeZones(timeZone), [timeZone]);

  const days = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const slot of slots) {
      const key = dayKey(slot, timeZone);
      groups.set(key, [...(groups.get(key) ?? []), slot]);
    }
    return groups;
  }, [slots, timeZone]);

  const weeks = useMemo(() => {
    const mondays = Array.from(new Set(Array.from(days.keys(), mondayOf)));
    return mondays.sort();
  }, [days]);

  const [chosenWeek, setChosenWeek] = useState<string | null>(null);
  const [chosenDay, setChosenDay] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const week = chosenWeek && weeks.includes(chosenWeek) ? chosenWeek : weeks[0];

  if (!week) {
    return (
      <p className="text-sm leading-5 text-[var(--meet-muted)]">
        No times are open right now. Please{" "}
        <Link href="/contact" className={TEXT_LINK}>
          contact us
        </Link>{" "}
        and we&apos;ll find one.
      </p>
    );
  }

  const weekIndex = weeks.indexOf(week);
  const weekDays = Array.from({ length: 7 }, (_, offset) => {
    const date = keyToDate(week);
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
  }).filter((key, offset) => offset < 5 || days.has(key));

  const openDays = weekDays.filter((key) => days.has(key));
  const day = chosenDay && openDays.includes(chosenDay) ? chosenDay : openDays[0];
  const times = days.get(day) ?? [];
  const selectedIndex = value ? times.indexOf(value) : -1;
  const visibleTimes =
    showAll || selectedIndex >= INITIAL_TIMES ? times : times.slice(0, INITIAL_TIMES);

  const goToWeek = (index: number) => {
    setChosenWeek(weeks[index]);
    setChosenDay(null);
    setShowAll(false);
  };

  return (
    <div>
      <label htmlFor={zoneId} className={`${LABEL} mb-2 block`}>
        Time zone
      </label>
      <select
        id={zoneId}
        value={timeZone}
        onChange={(event) => {
          onTimeZoneChange(event.target.value);
          setChosenDay(null);
          setChosenWeek(null);
        }}
        className={FIELD}
      >
        {zones.map((zone) => (
          <option key={zone} value={zone}>
            {zoneLabel(zone)}
          </option>
        ))}
      </select>

      <div className="mt-4 flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Previous week"
          disabled={weekIndex === 0}
          onClick={() => goToWeek(weekIndex - 1)}
          className={`${SECONDARY} w-11 !px-0`}
        >
          <ChevronLeftIcon />
        </button>
        <p aria-live="polite" className="text-center text-sm leading-5 font-semibold">
          {formatWeekRange(weekDays[0], weekDays[weekDays.length - 1])}
        </p>
        <button
          type="button"
          aria-label="Next week"
          disabled={weekIndex === weeks.length - 1}
          onClick={() => goToWeek(weekIndex + 1)}
          className={`${SECONDARY} w-11 !px-0`}
        >
          <ChevronRightIcon />
        </button>
      </div>

      <div role="group" aria-label="Choose a day" className="mt-2 flex gap-2">
        {weekDays.map((key) => {
          const open = days.has(key);
          const active = key === day;
          return (
            <button
              key={key}
              type="button"
              disabled={!open}
              aria-pressed={active}
              aria-label={formatDayHeading(key)}
              onClick={() => {
                setChosenDay(key);
                setShowAll(false);
              }}
              className={`flex min-h-[72px] min-w-0 flex-1 flex-col items-center justify-center rounded-[10px] border text-sm leading-5 font-medium transition-colors disabled:cursor-not-allowed ${
                active
                  ? "border-[var(--meet-text)] bg-[var(--meet-text)] text-white"
                  : open
                    ? "border-[var(--meet-border)] bg-[var(--meet-surface)] hover:border-[var(--meet-text)]"
                    : "border-[var(--meet-border)] bg-[var(--meet-background)] text-[var(--meet-muted)]"
              }`}
            >
              {active ? <CheckIcon /> : null}
              <span>{formatKey(key, { weekday: "short" })}</span>
              <span>{keyToDate(key).getUTCDate()}</span>
            </button>
          );
        })}
      </div>

      <h4 className="mt-4 text-base leading-6 font-semibold">{formatDayHeading(day)}</h4>
      <p id="meeting-times" className={`${LABEL} mt-3 mb-2`}>
        Available times
      </p>
      <div
        role="group"
        aria-labelledby="meeting-times"
        className="grid grid-cols-3 gap-2 max-[359px]:grid-cols-2"
      >
        {visibleTimes.map((slot) => {
          const active = slot === value;
          return (
            <button
              key={slot}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(slot)}
              className={`flex h-11 items-center justify-center gap-1.5 rounded-[10px] border text-sm leading-5 font-medium transition-colors ${
                active
                  ? "border-[var(--meet-brand-strong)] bg-[var(--meet-brand-tint)] font-semibold text-[var(--meet-brand-strong)]"
                  : "border-[var(--meet-border)] bg-[var(--meet-surface)] hover:border-[var(--meet-text)]"
              }`}
            >
              {formatTime(slot, timeZone)}
              {active ? <CheckIcon /> : null}
            </button>
          );
        })}
      </div>
      {visibleTimes.length < times.length ? (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-2 min-h-11 text-sm leading-5 text-[var(--meet-muted)] underline hover:text-[var(--meet-text)]"
        >
          Show more times
        </button>
      ) : null}
    </div>
  );
}

function Unavailable() {
  return (
    <p role="alert" className="text-base leading-6">
      Online booking is unavailable right now. Please{" "}
      <Link href="/contact" className={TEXT_LINK}>
        contact us
      </Link>{" "}
      and we&apos;ll set up a time.
    </p>
  );
}

// --- Booking ------------------------------------------------------------------

export function MeetingBooking() {
  const { status, slots, demo, reload } = useAvailability();
  const [timeZone, setTimeZone] = useState(visitorTimeZone);
  const [slot, setSlot] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", company: "", note: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState<{
    token: string | null;
    startsAt: string;
    videoLink: string | null;
  } | null>(null);
  const turnstileRef = useRef<TurnstileInstance | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

  const update = (field: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!slot) return;
    if (demo) {
      setBooked({ token: null, startsAt: slot, videoLink: null });
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          timezone: timeZone,
          startsAt: slot,
          turnstileToken: turnstileToken ?? "",
        }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.token) {
        setBooked({ token: json.token, startsAt: json.startsAt, videoLink: json.videoLink });
        return;
      }
      setError(json?.error ?? "Booking failed. Please try again.");
      if (res.status === 409) {
        setSlot(null);
        await reload();
      }
    } catch {
      setError("Booking failed. Check your connection and try again.");
    } finally {
      setSubmitting(false);
      turnstileRef.current?.reset();
      setTurnstileToken(null);
    }
  };

  if (booked) {
    return (
      <div role="status">
        <h2 className="text-2xl leading-8 font-bold">You&apos;re booked.</h2>
        <p className="mt-2 text-lg leading-[26px] font-semibold">
          {formatFull(booked.startsAt, timeZone)}
        </p>
        <p className="mt-2 text-base leading-6 text-[var(--meet-muted)]">
          {booked.token
            ? `A calendar invite and video link are on their way to ${form.email}.`
            : "Preview only: nothing was booked and no emails were sent."}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {booked.videoLink ? (
            <a href={booked.videoLink} className={PRIMARY}>
              Join link
            </a>
          ) : null}
          {booked.token ? (
            <Link href={`/meetings/${booked.token}`} className={SECONDARY}>
              Reschedule or cancel
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-[32px] leading-10 font-bold max-[767px]:text-2xl max-[767px]:leading-8">
        Find a time that works for you.
      </h2>
      <p className="mt-1 text-base leading-6 text-[var(--meet-muted)]">
        Choose a day, pick a time, and tell us a little about yourself.
      </p>

      {demo ? (
        <p className="mt-4 rounded-[10px] bg-[var(--meet-soft)] p-3 text-sm leading-5">
          Preview only: these are sample times. Nothing will be booked and no emails are sent.
        </p>
      ) : null}

      {status === "loading" ? (
        <p aria-busy="true" className="mt-8 text-sm leading-5 text-[var(--meet-muted)]">
          Loading open times…
        </p>
      ) : status === "unavailable" ? (
        <div className="mt-8">
          <Unavailable />
        </div>
      ) : (
        <form
          onSubmit={(event) => void submit(event)}
          className="mt-8 grid grid-cols-2 max-[899px]:grid-cols-1"
        >
          <div className="min-w-0 pr-8 max-[899px]:pr-0">
            <h3 className="mb-4 text-2xl leading-8 font-bold">1. Pick a time</h3>
            <SlotPicker
              slots={slots}
              timeZone={timeZone}
              onTimeZoneChange={setTimeZone}
              value={slot}
              onChange={setSlot}
            />

            {slot ? (
              <div className="mt-4 flex items-start gap-4 rounded-2xl bg-[var(--meet-soft)] p-4">
                <span className="mt-0.5 text-[var(--meet-soft-text)]">
                  <VideoIcon />
                </span>
                <div className="min-w-0 text-sm leading-5">
                  <p className="text-base leading-6 font-semibold">Your intro call</p>
                  <p>
                    {formatSummaryDate(slot, timeZone)} · {formatTime(slot, timeZone)}–
                    {formatTime(
                      new Date(new Date(slot).getTime() + 30 * 60000).toISOString(),
                      timeZone,
                    )}
                  </p>
                  <p className="break-words">{timeZone} · Video call</p>
                </div>
              </div>
            ) : null}

            <h4 className="mt-6 text-base leading-6 font-semibold">What we&apos;ll cover</h4>
            <ul className="mt-2 flex flex-col gap-1.5 text-sm leading-5">
              {[
                "Your brand and creative needs",
                "How the subscription works",
                "The right next step for you",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="text-[var(--meet-brand)]">
                    <CheckIcon />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="min-w-0 border-l border-[var(--meet-border)] pl-8 max-[899px]:mt-8 max-[899px]:border-t max-[899px]:border-l-0 max-[899px]:pt-8 max-[899px]:pl-0">
            <h3 className="mb-4 text-2xl leading-8 font-bold">2. Your details</h3>
            <div className="flex flex-col gap-4">
              <label className={LABEL}>
                Your name{" "}
                <span aria-hidden="true" className="text-[var(--meet-brand-strong)]">
                  *
                </span>
                <input
                  required
                  maxLength={120}
                  autoComplete="name"
                  placeholder="Your full name"
                  value={form.name}
                  onChange={(event) => update("name", event.target.value)}
                  className={`${FIELD} mt-2`}
                />
              </label>
              <label className={LABEL}>
                Email address{" "}
                <span aria-hidden="true" className="text-[var(--meet-brand-strong)]">
                  *
                </span>
                <input
                  required
                  type="email"
                  maxLength={254}
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={form.email}
                  onChange={(event) => update("email", event.target.value)}
                  className={`${FIELD} mt-2`}
                />
              </label>
              <label className={LABEL}>
                Company (optional)
                <input
                  maxLength={120}
                  autoComplete="organization"
                  placeholder="Company name"
                  value={form.company}
                  onChange={(event) => update("company", event.target.value)}
                  className={`${FIELD} mt-2`}
                />
              </label>
              <label className={LABEL}>
                What would you like to talk about? (optional)
                <textarea
                  rows={4}
                  maxLength={1000}
                  placeholder="A quick note about your brand or project..."
                  value={form.note}
                  onChange={(event) => update("note", event.target.value)}
                  className="mt-2 w-full rounded-[10px] border border-[var(--meet-border)] bg-[var(--meet-surface)] p-3 text-sm leading-5 font-normal placeholder:text-[var(--meet-muted)]"
                />
              </label>
            </div>

            <p className="mt-3 text-sm leading-5 text-[var(--meet-muted)]">
              We&apos;ll use your details to arrange this call. Read our{" "}
              <Link href="/privacy#meetings" className="underline">
                Privacy Policy
              </Link>
              .
            </p>

            {turnstileSiteKey && !demo ? (
              <div className="mt-4">
                <Turnstile
                  ref={turnstileRef}
                  siteKey={turnstileSiteKey}
                  onSuccess={(token) => setTurnstileToken(token)}
                  onExpire={() => setTurnstileToken(null)}
                />
              </div>
            ) : null}

            {error ? (
              <p role="alert" className="mt-4 text-sm leading-5 text-[var(--meet-danger)]">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              className={`${PRIMARY} mt-4 w-full`}
              disabled={
                !slot || submitting || (Boolean(turnstileSiteKey) && !demo && !turnstileToken)
              }
            >
              {submitting ? "Booking…" : "Book my 30-minute call"}
              {submitting ? null : <ArrowRightIcon />}
            </button>
            <p className="mt-2 text-center text-sm leading-5 text-[var(--meet-muted)]">
              {slot
                ? "A calendar invite and video link will arrive by email."
                : "Choose a time to continue."}
            </p>
          </div>
        </form>
      )}
    </div>
  );
}

// --- Manage -------------------------------------------------------------------

type ManagedMeeting = {
  name: string;
  startsAt: string;
  status: "CONFIRMED" | "CANCELED";
  videoLink: string | null;
};

export function MeetingManage({ token }: { token: string }) {
  const [timeZone, setTimeZone] = useState(visitorTimeZone);
  const [meeting, setMeeting] = useState<ManagedMeeting | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "missing">("loading");
  const [mode, setMode] = useState<"view" | "reschedule" | "cancel">("view");
  const [slot, setSlot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/meetings/${encodeURIComponent(token)}`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        if (cancelled) return;
        if (res.ok && json?.meeting) {
          setMeeting(json.meeting);
          setLoadState("ready");
        } else {
          setLoadState("missing");
        }
      } catch {
        if (!cancelled) setLoadState("missing");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const change = async (method: "PATCH" | "DELETE", body?: unknown) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/meetings/${encodeURIComponent(token)}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.meeting) {
        setMeeting(json.meeting);
        setMode("view");
        setSlot(null);
      } else {
        setError(json?.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setError("Something went wrong. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  if (loadState === "loading") {
    return (
      <p aria-busy="true" className="text-sm leading-5 text-[var(--meet-muted)]">
        Loading your meeting…
      </p>
    );
  }
  if (loadState === "missing" || !meeting) {
    return (
      <div>
        <h2 className="text-2xl leading-8 font-bold">Meeting not found</h2>
        <p className="mt-2 text-base leading-6 text-[var(--meet-muted)]">
          This link isn&apos;t valid. Check the link in your confirmation email.
        </p>
        <Link href="/meet" className={`${PRIMARY} mt-4`}>
          Book a meeting
        </Link>
      </div>
    );
  }

  const canceled = meeting.status === "CANCELED";
  const past = new Date(meeting.startsAt).getTime() <= Date.now();

  return (
    <div>
      <h2 className="text-2xl leading-8 font-bold">
        {canceled ? "This meeting was canceled" : `Your meeting, ${meeting.name}`}
      </h2>
      <p className="mt-2 text-lg leading-[26px] font-semibold">
        {formatFull(meeting.startsAt, timeZone)}
      </p>

      {error ? (
        <p role="alert" className="mt-3 text-sm leading-5 text-[var(--meet-danger)]">
          {error}
        </p>
      ) : null}

      {canceled ? (
        <Link href="/meet" className={`${PRIMARY} mt-4`}>
          Book a new time
        </Link>
      ) : past ? (
        <p className="mt-3 text-base leading-6 text-[var(--meet-muted)]">
          This meeting has already started.
        </p>
      ) : mode === "view" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {meeting.videoLink ? (
            <a href={meeting.videoLink} className={PRIMARY}>
              Join link
            </a>
          ) : null}
          <button type="button" className={SECONDARY} onClick={() => setMode("reschedule")}>
            Reschedule
          </button>
          <button type="button" className={SECONDARY} onClick={() => setMode("cancel")}>
            Cancel meeting
          </button>
        </div>
      ) : mode === "cancel" ? (
        <div className="mt-4">
          <p className="text-base leading-6">Cancel this meeting?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className={PRIMARY}
              disabled={busy}
              onClick={() => void change("DELETE")}
            >
              {busy ? "Canceling…" : "Yes, cancel it"}
            </button>
            <button type="button" className={SECONDARY} onClick={() => setMode("view")}>
              Keep it
            </button>
          </div>
        </div>
      ) : (
        <Reschedule
          timeZone={timeZone}
          onTimeZoneChange={setTimeZone}
          slot={slot}
          onSlot={setSlot}
          busy={busy}
          onConfirm={() => void change("PATCH", { startsAt: slot })}
          onBack={() => {
            setMode("view");
            setSlot(null);
          }}
        />
      )}
    </div>
  );
}

function Reschedule({
  timeZone,
  onTimeZoneChange,
  slot,
  onSlot,
  busy,
  onConfirm,
  onBack,
}: {
  timeZone: string;
  onTimeZoneChange: (timeZone: string) => void;
  slot: string | null;
  onSlot: (slot: string | null) => void;
  busy: boolean;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const { status, slots } = useAvailability();
  return (
    <div className="mt-6 max-w-[520px]">
      {status === "loading" ? (
        <p aria-busy="true" className="text-sm leading-5 text-[var(--meet-muted)]">
          Loading open times…
        </p>
      ) : status === "unavailable" ? (
        <Unavailable />
      ) : (
        <SlotPicker
          slots={slots}
          timeZone={timeZone}
          onTimeZoneChange={onTimeZoneChange}
          value={slot}
          onChange={onSlot}
        />
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={PRIMARY} disabled={!slot || busy} onClick={onConfirm}>
          {busy ? "Saving…" : "Move to this time"}
        </button>
        <button type="button" className={SECONDARY} onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  );
}
