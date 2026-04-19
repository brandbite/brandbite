// -----------------------------------------------------------------------------
// @file: app/customer/consultation/page.tsx
// @purpose: Company OWNER/PM view for booking a consultation and tracking the
//           status of past / pending requests. Token-costed; form debits the
//           tokens on submit, admin schedules out-of-band.
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FormSelect, FormTextarea } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { LoadingState } from "@/components/ui/loading-state";
import {
  InsufficientTokensModal,
  type InsufficientTokensInfo,
} from "@/components/tokens/insufficient-tokens-modal";
import { isInsufficientTokensBody } from "@/lib/errors/insufficient-tokens";

type ConsultationStatus = "PENDING" | "SCHEDULED" | "COMPLETED" | "CANCELED";

type ConsultationRow = {
  id: string;
  description: string;
  preferredTimes: string[] | null;
  timezone: string | null;
  scheduledAt: string | null;
  videoLink: string | null;
  tokenCost: number;
  status: ConsultationStatus;
  createdAt: string;
  updatedAt: string;
  requestedBy: { id: string; name: string | null; email: string };
};

type ConsultationResponse = {
  consultations: ConsultationRow[];
  tokenCost: number;
};

type CompanyRole = "OWNER" | "PM" | "BILLING" | "MEMBER";

const STATUS_LABEL: Record<ConsultationStatus, string> = {
  PENDING: "Awaiting scheduling",
  SCHEDULED: "Scheduled",
  COMPLETED: "Completed",
  CANCELED: "Canceled",
};

const STATUS_VARIANT: Record<ConsultationStatus, "info" | "success" | "warning" | "neutral"> = {
  PENDING: "warning",
  SCHEDULED: "info",
  COMPLETED: "success",
  CANCELED: "neutral",
};

const DESCRIPTION_MIN = 10;
const DESCRIPTION_MAX = 4000;

/** Topic presets — clicking fills the description with a starter sentence. */
const TOPIC_PRESETS: { label: string; text: string }[] = [
  {
    label: "Brand refresh",
    text: "We want to refresh our brand identity (logo, colors, typography) across web and packaging. Main goals: ",
  },
  {
    label: "Product launch",
    text: "We're launching a new product and need a design and marketing plan that covers: ",
  },
  {
    label: "Website redesign",
    text: "Our website needs a redesign. The main problems today are: ",
  },
  {
    label: "Packaging design",
    text: "We need packaging for a new SKU. Format, constraints, and audience: ",
  },
  {
    label: "Social media kit",
    text: "We need a social media kit (templates, stories, ads) focused on: ",
  },
];

/** Curated IANA zones used in the timezone dropdown, grouped by region. */
const TIMEZONE_GROUPS: { label: string; zones: string[] }[] = [
  {
    label: "Americas",
    zones: [
      "America/Los_Angeles",
      "America/Denver",
      "America/Chicago",
      "America/New_York",
      "America/Toronto",
      "America/Mexico_City",
      "America/Sao_Paulo",
      "America/Argentina/Buenos_Aires",
    ],
  },
  {
    label: "Europe / Africa",
    zones: [
      "Europe/London",
      "Europe/Dublin",
      "Europe/Paris",
      "Europe/Berlin",
      "Europe/Madrid",
      "Europe/Amsterdam",
      "Europe/Istanbul",
      "Africa/Johannesburg",
      "Africa/Cairo",
      "Africa/Lagos",
    ],
  },
  {
    label: "Middle East / Asia",
    zones: [
      "Asia/Dubai",
      "Asia/Karachi",
      "Asia/Kolkata",
      "Asia/Bangkok",
      "Asia/Singapore",
      "Asia/Hong_Kong",
      "Asia/Shanghai",
      "Asia/Tokyo",
      "Asia/Seoul",
    ],
  },
  {
    label: "Oceania",
    zones: ["Australia/Perth", "Australia/Sydney", "Pacific/Auckland"],
  },
  { label: "Other", zones: ["UTC"] },
];

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Short offset label like "GMT+3" for a given IANA zone at "now". */
function tzShortLabel(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat(undefined, {
      timeZone: tz,
      timeZoneName: "shortOffset",
    }).formatToParts(new Date());
    const off = parts.find((p) => p.type === "timeZoneName")?.value;
    return off ?? tz;
  } catch {
    return tz;
  }
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

/** "YYYY-MM-DD" — date-only input format. */
function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** "9:00 AM" style from a "HH:MM" 24-h string. */
function formatTimeLabel(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const hour12 = ((h + 11) % 12) + 1;
  const ampm = h < 12 ? "AM" : "PM";
  return `${hour12}:${pad2(m)} ${ampm}`;
}

/** Format a preferredTime: ISO → nicely-formatted; otherwise raw (legacy). */
function formatPreferred(raw: string, tz: string | null): string {
  const isIso = raw.includes("T") && !Number.isNaN(Date.parse(raw));
  if (!isIso) return raw;
  const d = new Date(raw);
  const formatted = d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const tzHint = tz ? ` (${tzShortLabel(tz)})` : "";
  return `${formatted}${tzHint}`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

type PublicSettings = {
  enabled: boolean;
  tokenCost: number;
  durationMinutes: number;
  contactEmail: string | null;
  workingDays: number[];
  workingHourStart: number;
  workingHourEnd: number;
  minNoticeHours: number;
  maxBookingDays: number;
  companyTimezone: string | null;
};

export default function CustomerConsultationPage() {
  const [rows, setRows] = useState<ConsultationRow[]>([]);
  const [tokenCost, setTokenCost] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [companyRole, setCompanyRole] = useState<CompanyRole | null>(null);
  const [companyRoleLoading, setCompanyRoleLoading] = useState(true);
  const [settings, setSettings] = useState<PublicSettings | null>(null);

  // Form state — date + time as two separate fields so the time dropdown
  // can offer only valid 30-min slots (native datetime-local ignores step
  // on the picker UI, leading to confusing 1-minute granularity).
  const [description, setDescription] = useState("");
  const [timezone, setTimezone] = useState<string>(() => detectTimezone());
  const [date, setDate] = useState<string>(""); // YYYY-MM-DD
  const [time, setTime] = useState<string>(""); // HH:MM (30-min granularity)
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<InsufficientTokensInfo | null>(null);

  // Merge the auto-detected zone into the curated list so it's always selectable.
  const timezoneOptions = useMemo(() => {
    const detected = detectTimezone();
    const groups = TIMEZONE_GROUPS.map((g) => ({ ...g, zones: [...g.zones] }));
    const isListed = groups.some((g) => g.zones.includes(detected));
    if (!isListed) {
      groups.unshift({ label: "Detected", zones: [detected] });
    }
    return groups;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/customer/consultations", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as ConsultationResponse | null;
      if (!res.ok || !json) {
        throw new Error("Failed to load consultations.");
      }
      setRows(json.consultations);
      setTokenCost(json.tokenCost);
    } catch (err) {
      console.error("[CustomerConsultationPage] load error", err);
      setError(err instanceof Error ? err.message : "Failed to load consultations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Public settings — drives min/max slots, enabled gate, contact email.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/customer/consultation-settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (json?.settings) setSettings(json.settings as PublicSettings);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Company role
  useEffect(() => {
    let cancelled = false;
    fetch("/api/customer/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        const role = json?.user?.companyRole ?? null;
        if (["OWNER", "PM", "BILLING", "MEMBER"].includes(role)) {
          setCompanyRole(role);
        } else {
          setCompanyRole(null);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setCompanyRoleLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const featureDisabled = settings !== null && !settings.enabled;
  const canBook = (companyRole === "OWNER" || companyRole === "PM") && !featureDisabled;

  // --- Date-picker bounds ----------------------------------------------------
  // Minimum date: today + ceil(minNoticeHours / 24). The hour guard below
  // trims same-day slots that would violate minNoticeHours more precisely.
  const minDate = useMemo(() => {
    const d = new Date();
    if (settings) {
      const minNoticeDays = Math.ceil(settings.minNoticeHours / 24);
      d.setDate(d.getDate() + Math.max(0, minNoticeDays - 1));
    }
    d.setHours(0, 0, 0, 0);
    return toDateInput(d);
  }, [settings]);

  const maxDate = useMemo(() => {
    if (!settings) return undefined;
    const d = new Date();
    d.setDate(d.getDate() + settings.maxBookingDays);
    return toDateInput(d);
  }, [settings]);

  // --- Time-slot dropdown options -------------------------------------------
  // 30-min slots across the configured working-hours window. If the user picked
  // today, hide slots before now + minNoticeHours.
  const timeOptions = useMemo(() => {
    const start = settings?.workingHourStart ?? 9;
    const end = settings?.workingHourEnd ?? 17;
    const out: string[] = [];
    for (let h = start; h < end; h++) {
      out.push(`${pad2(h)}:00`);
      out.push(`${pad2(h)}:30`);
    }

    if (!date) return out;

    // Same-day? Trim slots before now + minNoticeHours.
    const picked = new Date(`${date}T00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isToday = picked.getTime() === today.getTime();
    if (!isToday) return out;

    const minHourToday = new Date();
    minHourToday.setHours(minHourToday.getHours() + (settings?.minNoticeHours ?? 0));
    return out.filter((slot) => {
      const [hh, mm] = slot.split(":").map(Number);
      const slotDate = new Date(picked);
      slotDate.setHours(hh, mm, 0, 0);
      return slotDate.getTime() >= minHourToday.getTime();
    });
  }, [date, settings]);

  // Warn when the picked date is a non-working day.
  const slotWarning = useMemo(() => {
    if (!settings || !date) return "";
    const picked = new Date(`${date}T00:00`);
    if (Number.isNaN(picked.getTime())) return "";
    if (!settings.workingDays.includes(picked.getDay())) return "Outside team working days";
    return "";
  }, [date, settings]);

  // Normalised preferred slot — emitted as a single-element ISO array on the
  // wire (API still accepts the legacy preferredTimes[] shape).
  const preferredIsoSlots = useMemo(() => {
    if (!date || !time) return [];
    const local = new Date(`${date}T${time}`);
    if (Number.isNaN(local.getTime())) return [];
    return [local.toISOString()];
  }, [date, time]);

  const charCount = description.trim().length;
  const charOk = charCount >= DESCRIPTION_MIN && charCount <= DESCRIPTION_MAX;

  const applyPreset = (text: string) => {
    setDescription((prev) => (prev.trim().length === 0 ? text : prev.trimEnd() + "\n\n" + text));
  };

  /** Pick the next working day at the configured working-hour start. */
  const suggestSlot = () => {
    const workingDays = settings?.workingDays ?? [1, 2, 3, 4, 5];
    const hour = settings?.workingHourStart ?? 10;
    const cursor = new Date();
    cursor.setDate(cursor.getDate() + 1);
    let safety = 14;
    while (safety-- > 0) {
      if (workingDays.includes(cursor.getDay())) break;
      cursor.setDate(cursor.getDate() + 1);
    }
    setDate(toDateInput(cursor));
    setTime(`${pad2(hour)}:00`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canBook) return;
    if (!charOk) {
      setFormError(
        charCount < DESCRIPTION_MIN
          ? `Tell us a bit more about what you want to discuss (at least ${DESCRIPTION_MIN} characters).`
          : `Description is too long (max ${DESCRIPTION_MAX} characters).`,
      );
      return;
    }
    setSubmitting(true);
    setFormError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch("/api/customer/consultations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          preferredTimes: preferredIsoSlots.length > 0 ? preferredIsoSlots : undefined,
          timezone: timezone.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 402 && isInsufficientTokensBody(json)) {
          setTokenError(json);
        } else {
          setFormError((json && json.error) || "Could not submit the consultation request.");
        }
        return;
      }
      setSuccessMessage(
        `Request submitted. Your team will email you with a time slot. (${tokenCost} tokens debited.)`,
      );
      setDescription("");
      setDate("");
      setTime("");
      load();
    } catch (err) {
      console.error("[CustomerConsultationPage] submit error", err);
      setFormError("Unexpected error while submitting.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 md:px-0">
      <header className="mb-6">
        <p className="text-xs font-bold tracking-[0.2em] text-[var(--bb-primary)] uppercase">
          Consultation
        </p>
        <h1 className="font-brand mt-2 text-3xl font-bold tracking-tight text-[var(--bb-secondary)] sm:text-4xl">
          Book a call with our team
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--bb-text-secondary)]">
          Get a {settings?.durationMinutes ?? 30}-minute video consultation with the Brandbite team.
          Pick what you want to discuss and a few time slots that work — we&apos;ll confirm one by
          email with a video link
          {settings?.contactEmail ? ` from ${settings.contactEmail}` : ""}.
        </p>
      </header>

      {/* Access gate */}
      {featureDisabled && (
        <InlineAlert variant="warning" className="mb-6">
          Consultation bookings are paused right now. Please check back later.
        </InlineAlert>
      )}

      {!featureDisabled && !companyRoleLoading && !canBook && (
        <InlineAlert variant="info" className="mb-6">
          Consultations are available to company <strong>Owners</strong> and <strong>PM</strong>{" "}
          members. Ask a teammate with one of those roles to book on your behalf.
        </InlineAlert>
      )}

      {/* Form (only if user has permission) */}
      {canBook && (
        <section className="mb-10 rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-[var(--bb-secondary)]">
              New consultation request
            </h2>
            <span className="rounded-full bg-[var(--bb-bg-warm)] px-3 py-1 text-[11px] font-semibold text-[var(--bb-secondary)]">
              {tokenCost} tokens
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Topic presets */}
            <div>
              <p className="mb-2 text-[11px] font-semibold tracking-[0.15em] text-[var(--bb-text-tertiary)] uppercase">
                Quick start (optional)
              </p>
              <div className="flex flex-wrap gap-2">
                {TOPIC_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => applyPreset(p.text)}
                    className="rounded-full border border-[var(--bb-border)] bg-[var(--bb-bg-warm)] px-3 py-1 text-xs font-medium text-[var(--bb-secondary)] transition-colors hover:border-[var(--bb-primary)] hover:text-[var(--bb-primary)]"
                  >
                    + {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="mb-1 block text-xs font-semibold tracking-[0.15em] text-[var(--bb-text-tertiary)] uppercase">
                What do you want to discuss?
              </label>
              <FormTextarea
                placeholder="e.g. We want to refresh our brand identity across web + packaging before a product launch."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                maxLength={DESCRIPTION_MAX}
                required
              />
              <div className="mt-1 flex items-center justify-between">
                <span
                  className={`text-[11px] ${
                    charCount < DESCRIPTION_MIN
                      ? "text-[var(--bb-text-muted)]"
                      : "text-[var(--bb-text-tertiary)]"
                  }`}
                >
                  {charCount < DESCRIPTION_MIN
                    ? `${DESCRIPTION_MIN - charCount} more characters needed`
                    : `${charCount} / ${DESCRIPTION_MAX} characters`}
                </span>
              </div>
            </div>

            {/* Preferred date + time */}
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <label className="block text-xs font-semibold tracking-[0.15em] text-[var(--bb-text-tertiary)] uppercase">
                  Preferred date &amp; time
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={suggestSlot}
                    className="text-[11px] font-medium text-[var(--bb-primary)] hover:underline"
                  >
                    Suggest a time
                  </button>
                  {(date || time) && (
                    <button
                      type="button"
                      onClick={() => {
                        setDate("");
                        setTime("");
                      }}
                      className="text-[11px] font-medium text-[var(--bb-text-muted)] hover:text-[var(--bb-secondary)] hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
              <p className="mb-2 text-[11px] text-[var(--bb-text-muted)]">
                Pick a date and a 30-minute slot. The admin will confirm or propose a different slot
                by email.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  type="date"
                  value={date}
                  min={minDate}
                  max={maxDate}
                  onChange={(e) => {
                    setDate(e.target.value);
                    // Reset time if it's no longer valid for the new date's
                    // same-day min-notice filter.
                    setTime("");
                  }}
                  className="w-full rounded-md border border-[var(--bb-border-input)] bg-white px-2 py-1.5 text-sm text-[var(--bb-secondary)] outline-none focus:border-[var(--bb-primary)] focus:ring-1 focus:ring-[var(--bb-primary)]"
                />
                <FormSelect
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  disabled={!date || timeOptions.length === 0}
                >
                  <option value="">
                    {date
                      ? timeOptions.length === 0
                        ? "No slots available on this day"
                        : "Select a time..."
                      : "Pick a date first"}
                  </option>
                  {timeOptions.map((t) => (
                    <option key={t} value={t}>
                      {formatTimeLabel(t)}
                    </option>
                  ))}
                </FormSelect>
              </div>
              {date && time && (
                <p className="mt-2 text-[11px] text-[var(--bb-text-secondary)]">
                  →{" "}
                  {new Date(`${date}T${time}`).toLocaleString(undefined, {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              )}
              {slotWarning && (
                <p className="mt-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900">
                  {slotWarning}
                </p>
              )}
              <p className="mt-2 text-[11px] text-[var(--bb-text-muted)]">
                {settings ? (
                  <>
                    Team is available{" "}
                    {settings.workingDays
                      .map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d])
                      .join(", ")}{" "}
                    from {settings.workingHourStart}:00 to {settings.workingHourEnd}:00
                    {settings.companyTimezone ? ` ${settings.companyTimezone}` : ""}. Times snap to
                    30-minute increments.
                  </>
                ) : (
                  "Times snap to 30-minute increments."
                )}
              </p>
            </div>

            {/* Timezone */}
            <div>
              <label className="mb-1 block text-xs font-semibold tracking-[0.15em] text-[var(--bb-text-tertiary)] uppercase">
                Timezone
              </label>
              <FormSelect value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                {timezoneOptions.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.zones.map((z) => (
                      <option key={z} value={z}>
                        {z.replace(/_/g, " ")} — {tzShortLabel(z)}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </FormSelect>
              <p className="mt-1 text-[11px] text-[var(--bb-text-muted)]">
                We detected {detectTimezone().replace(/_/g, " ")} ({tzShortLabel(detectTimezone())}
                ). Change it if you&apos;d like to discuss slots in a different zone.
              </p>
            </div>

            {formError && <InlineAlert variant="error">{formError}</InlineAlert>}
            {successMessage && <InlineAlert variant="success">{successMessage}</InlineAlert>}

            <div>
              <Button
                type="submit"
                loading={submitting}
                loadingText="Submitting..."
                disabled={!charOk || !canBook}
              >
                Submit request — {tokenCost} tokens
              </Button>
            </div>
          </form>
        </section>
      )}

      {/* History */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-[var(--bb-secondary)]">
          Your consultations
        </h2>

        {loading && <LoadingState />}
        {error && <InlineAlert variant="error">{error}</InlineAlert>}

        {!loading && !error && rows.length === 0 && (
          <EmptyState
            title="No consultations yet"
            description="Requests you submit will show up here with their current status."
          />
        )}

        {rows.length > 0 && (
          <div className="space-y-3">
            {rows.map((c) => (
              <article
                key={c.id}
                className="rounded-xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] p-4"
              >
                <header className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <Badge variant={STATUS_VARIANT[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                    <p className="mt-2 text-xs text-[var(--bb-text-muted)]">
                      Requested {formatDateTime(c.createdAt)}
                    </p>
                  </div>
                  <span className="text-xs text-[var(--bb-text-tertiary)]">
                    {c.tokenCost} tokens
                  </span>
                </header>

                <p className="mb-3 line-clamp-3 text-sm text-[var(--bb-text-secondary)]">
                  {c.description}
                </p>

                {c.status === "PENDING" && c.preferredTimes && c.preferredTimes.length > 0 && (
                  <div className="mt-2 rounded-lg border border-[var(--bb-border-subtle)] bg-[var(--bb-bg-warm)] p-3 text-xs">
                    <p className="text-[var(--bb-text-muted)]">You offered</p>
                    <ul className="mt-1 space-y-0.5 text-[var(--bb-secondary)]">
                      {c.preferredTimes.map((t, i) => (
                        <li key={i}>· {formatPreferred(t, c.timezone)}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {c.status === "SCHEDULED" && (
                  <div className="mt-2 rounded-lg border border-[var(--bb-border-subtle)] bg-white p-3 text-xs">
                    <p className="text-[var(--bb-text-muted)]">Scheduled for</p>
                    <p className="mt-0.5 font-semibold text-[var(--bb-secondary)]">
                      {formatDateTime(c.scheduledAt)}
                    </p>
                    {c.videoLink && (
                      <a
                        href={c.videoLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block break-all text-[var(--bb-primary)] hover:underline"
                      >
                        Join call ↗
                      </a>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <InsufficientTokensModal info={tokenError} onClose={() => setTokenError(null)} />
    </div>
  );
}
