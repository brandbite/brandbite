// -----------------------------------------------------------------------------
// @file: components/marketing/meeting-booking.tsx
// @purpose: Public 30-minute booking: pick a day and a time shown in the visitor's
//           own time zone, then enter contact details. Also the /meetings/[token]
//           view for rescheduling or canceling. Posts to /api/meetings.
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

const FIELD =
  "h-12 w-full rounded-[10px] border border-[#D7D8DD] bg-white px-3 text-sm leading-5 text-[#2B2D33]";
const PRIMARY =
  "inline-flex h-11 items-center justify-center rounded-[10px] bg-[#FF6426] px-5 text-sm leading-5 font-semibold whitespace-nowrap text-white transition-colors hover:bg-[#E8541A] disabled:cursor-not-allowed disabled:opacity-50";
const SECONDARY =
  "inline-flex h-11 items-center justify-center rounded-[10px] border border-[#D7D8DD] bg-white px-5 text-sm leading-5 font-semibold whitespace-nowrap text-[#2B2D33] hover:border-[#2B2D33] disabled:cursor-not-allowed disabled:opacity-50";
const CHOICE = "rounded-[10px] border text-sm leading-5 font-medium transition-colors";
const CHOICE_ON = "border-[#2B2D33] bg-[#2B2D33] text-white";
const CHOICE_OFF = "border-[#D7D8DD] bg-white text-[#2B2D33] hover:border-[#2B2D33]";

function visitorTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function dayKey(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function formatDay(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
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

type Availability = {
  status: "loading" | "ready" | "unavailable";
  slots: string[];
  /** Preview deployments only: sample times, and nothing is submitted. */
  demo?: boolean;
};

function useAvailability() {
  const [state, setState] = useState<Availability>({ status: "loading", slots: [] });

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/meetings/availability", { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.available && Array.isArray(json.slots)) {
        setState({ status: "ready", slots: json.slots, demo: json.demo === true });
      } else {
        setState({ status: "unavailable", slots: [] });
      }
    } catch {
      setState({ status: "unavailable", slots: [] });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/meetings/availability", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (cancelled) return;
        if (res.ok && json?.available && Array.isArray(json.slots)) {
          setState({ status: "ready", slots: json.slots, demo: json.demo === true });
        } else {
          setState({ status: "unavailable", slots: [] });
        }
      } catch {
        if (!cancelled) setState({ status: "unavailable", slots: [] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { ...state, reload };
}

function SlotPicker({
  slots,
  timeZone,
  value,
  onChange,
}: {
  slots: string[];
  timeZone: string;
  value: string | null;
  onChange: (slot: string) => void;
}) {
  const days = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const slot of slots) {
      const key = dayKey(slot, timeZone);
      groups.set(key, [...(groups.get(key) ?? []), slot]);
    }
    return Array.from(groups.entries());
  }, [slots, timeZone]);

  const [chosenDay, setChosenDay] = useState<string | null>(null);
  const activeDay = days.find(([key]) => key === chosenDay) ?? days[0];

  if (!activeDay) {
    return (
      <p className="text-sm leading-5 text-[#5E616E]">
        No times are open right now. Please{" "}
        <Link href="/contact" className="underline">
          contact us
        </Link>{" "}
        and we&apos;ll find one.
      </p>
    );
  }

  return (
    <div>
      <p id="meeting-day" className="mb-2 text-sm leading-5 font-semibold text-[#2B2D33]">
        Choose a day
      </p>
      <div role="group" aria-labelledby="meeting-day" className="flex flex-wrap gap-2">
        {days.map(([key, daySlots]) => (
          <button
            key={key}
            type="button"
            aria-pressed={key === activeDay[0]}
            onClick={() => setChosenDay(key)}
            className={`${CHOICE} h-11 px-3 ${key === activeDay[0] ? CHOICE_ON : CHOICE_OFF}`}
          >
            {formatDay(daySlots[0], timeZone)}
          </button>
        ))}
      </div>

      <p id="meeting-time" className="mt-5 mb-2 text-sm leading-5 font-semibold text-[#2B2D33]">
        Choose a time
      </p>
      <div
        role="group"
        aria-labelledby="meeting-time"
        className="grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-2"
      >
        {activeDay[1].map((slot) => (
          <button
            key={slot}
            type="button"
            aria-pressed={slot === value}
            onClick={() => onChange(slot)}
            className={`${CHOICE} h-11 ${slot === value ? CHOICE_ON : CHOICE_OFF}`}
          >
            {formatTime(slot, timeZone)}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm leading-5 text-[#5E616E]">Times are shown in {timeZone}.</p>
    </div>
  );
}

function Unavailable() {
  return (
    <p role="alert" className="text-base leading-6 text-[#2B2D33]">
      Online booking is unavailable right now. Please{" "}
      <Link href="/contact" className="font-semibold underline">
        contact us
      </Link>{" "}
      and we&apos;ll set up a time.
    </p>
  );
}

export function MeetingBooking() {
  const { status, slots, demo, reload } = useAvailability();
  const [timeZone] = useState(visitorTimeZone);
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
        <h2 className="text-2xl leading-8 font-bold text-[#2B2D33]">You&apos;re booked.</h2>
        <p className="mt-2 text-lg leading-[26px] font-semibold text-[#2B2D33]">
          {formatFull(booked.startsAt, timeZone)}
        </p>
        <p className="mt-2 text-base leading-6 text-[#5E616E]">
          {booked.token
            ? `A calendar invite and confirmation are on their way to ${form.email}.`
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

  if (status === "loading") {
    return (
      <p aria-busy="true" className="text-sm leading-5 text-[#5E616E]">
        Loading open times…
      </p>
    );
  }
  if (status === "unavailable") return <Unavailable />;

  return (
    <form onSubmit={(event) => void submit(event)} className="grid gap-8 md:grid-cols-2">
      {demo ? (
        <p className="rounded-[10px] bg-[#ECE4FF] p-3 text-sm leading-5 text-[#2B2D33] md:col-span-2">
          Preview only: these are sample times. Nothing will be booked and no emails are sent.
        </p>
      ) : null}
      <SlotPicker slots={slots} timeZone={timeZone} value={slot} onChange={setSlot} />

      <div className="flex flex-col gap-4">
        <label className="text-sm leading-5 font-semibold text-[#2B2D33]">
          Your name
          <input
            required
            maxLength={120}
            autoComplete="name"
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            className={`${FIELD} mt-2 font-normal`}
          />
        </label>
        <label className="text-sm leading-5 font-semibold text-[#2B2D33]">
          Work email
          <input
            required
            type="email"
            maxLength={254}
            autoComplete="email"
            value={form.email}
            onChange={(event) => update("email", event.target.value)}
            className={`${FIELD} mt-2 font-normal`}
          />
        </label>
        <label className="text-sm leading-5 font-semibold text-[#2B2D33]">
          Company (optional)
          <input
            maxLength={120}
            autoComplete="organization"
            value={form.company}
            onChange={(event) => update("company", event.target.value)}
            className={`${FIELD} mt-2 font-normal`}
          />
        </label>
        <label className="text-sm leading-5 font-semibold text-[#2B2D33]">
          What would you like to talk about? (optional)
          <textarea
            rows={3}
            maxLength={1000}
            value={form.note}
            onChange={(event) => update("note", event.target.value)}
            className="mt-2 w-full rounded-[10px] border border-[#D7D8DD] bg-white p-3 text-sm leading-5 font-normal text-[#2B2D33]"
          />
        </label>

        {turnstileSiteKey && !demo ? (
          <Turnstile
            ref={turnstileRef}
            siteKey={turnstileSiteKey}
            onSuccess={(token) => setTurnstileToken(token)}
            onExpire={() => setTurnstileToken(null)}
          />
        ) : null}

        {error ? (
          <p role="alert" className="text-sm leading-5 text-[#B42318]">
            {error}
          </p>
        ) : null}

        <div>
          <button
            type="submit"
            className={PRIMARY}
            disabled={
              !slot || submitting || (Boolean(turnstileSiteKey) && !demo && !turnstileToken)
            }
          >
            {submitting
              ? "Booking…"
              : slot
                ? `Book ${formatDay(slot, timeZone)}, ${formatTime(slot, timeZone)}`
                : "Choose a time to continue"}
          </button>
        </div>
      </div>
    </form>
  );
}

type ManagedMeeting = {
  name: string;
  startsAt: string;
  status: "CONFIRMED" | "CANCELED";
  videoLink: string | null;
};

export function MeetingManage({ token }: { token: string }) {
  const [timeZone] = useState(visitorTimeZone);
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
      <p aria-busy="true" className="text-sm leading-5 text-[#5E616E]">
        Loading your meeting…
      </p>
    );
  }
  if (loadState === "missing" || !meeting) {
    return (
      <div>
        <h2 className="text-2xl leading-8 font-bold text-[#2B2D33]">Meeting not found</h2>
        <p className="mt-2 text-base leading-6 text-[#5E616E]">
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
      <h2 className="text-2xl leading-8 font-bold text-[#2B2D33]">
        {canceled ? "This meeting was canceled" : `Your meeting, ${meeting.name}`}
      </h2>
      <p className="mt-2 text-lg leading-[26px] font-semibold text-[#2B2D33]">
        {formatFull(meeting.startsAt, timeZone)}
      </p>

      {error ? (
        <p role="alert" className="mt-3 text-sm leading-5 text-[#B42318]">
          {error}
        </p>
      ) : null}

      {canceled ? (
        <Link href="/meet" className={`${PRIMARY} mt-4`}>
          Book a new time
        </Link>
      ) : past ? (
        <p className="mt-3 text-base leading-6 text-[#5E616E]">This meeting has already started.</p>
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
          <p className="text-base leading-6 text-[#2B2D33]">Cancel this meeting?</p>
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
  slot,
  onSlot,
  busy,
  onConfirm,
  onBack,
}: {
  timeZone: string;
  slot: string | null;
  onSlot: (slot: string) => void;
  busy: boolean;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const { status, slots } = useAvailability();
  return (
    <div className="mt-6">
      {status === "loading" ? (
        <p aria-busy="true" className="text-sm leading-5 text-[#5E616E]">
          Loading open times…
        </p>
      ) : status === "unavailable" ? (
        <Unavailable />
      ) : (
        <SlotPicker slots={slots} timeZone={timeZone} value={slot} onChange={onSlot} />
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
