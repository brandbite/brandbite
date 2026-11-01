// -----------------------------------------------------------------------------
// @file: app/admin/consultations/settings/page.tsx
// @purpose: SITE_OWNER / SITE_ADMIN management of the consultation feature —
//           enable/disable, pricing, working hours, ICS feed, contact email,
//           and misc tunables. Persisted in the ConsultationSettings singleton.
//
//           Admin design language v1: status pills, tabs per topic
//           (General & pricing / Availability / Calendar / Internal notes),
//           one form + SaveBar with dirty state on the left, "Booking rules
//           at a glance" + calendar summary on the right. A single PUT still
//           saves every field (same payload as before).
// @version: v2.0.0
// @status: active
// @lastUpdate: 2026-11-01
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode, type SVGProps } from "react";

import {
  Badge,
  Button,
  ButtonLink,
  Callout,
  Card,
  CardTitle,
  DASH,
  Field,
  IconTile,
  KeyValueList,
  SaveBar,
  Select,
  Skeleton,
  TabPanel,
  Tabs,
  TextArea,
  TextInput,
  buttonClass,
  fmt,
  plural,
  Switch,
} from "@/components/admin/v2/ui";
import { IconArrowUpRight, IconClock, IconCoins } from "@/components/admin/v2/icons";
import { IconConsultations } from "@/components/navigation/nav-icons";
import { useSessionRole } from "@/lib/hooks/use-session-role";

type Settings = {
  id: string;
  enabled: boolean;
  tokenCost: number;
  durationMinutes: number;
  contactEmail: string | null;
  calendarIcsUrl: string | null;
  workingDays: number[];
  workingHourStart: number;
  workingHourEnd: number;
  minNoticeHours: number;
  maxBookingDays: number;
  companyTimezone: string | null;
  adminNotes: string | null;
  updatedAt: string;
  googleConnected: boolean;
  googleAccountEmail: string | null;
  googleConnectedAt: string | null;
  // Set when Google permanently rejected the stored refresh token —
  // see lib/google/connection-health.ts. Connected-but-broken renders a
  // red alert instead of the green "Connected as …" box.
  googleConnectionBrokenAt: string | null;
  googleConnectionLastError: string | null;
};

type TabKey = "general" | "availability" | "calendar" | "notes";

/** Editable fields → the PUT body. Shared by save + dirty detection. */
function toPayload(settings: Settings) {
  return {
    enabled: settings.enabled,
    tokenCost: settings.tokenCost,
    durationMinutes: settings.durationMinutes,
    contactEmail: settings.contactEmail ?? "",
    calendarIcsUrl: settings.calendarIcsUrl ?? "",
    workingDays: settings.workingDays,
    workingHourStart: settings.workingHourStart,
    workingHourEnd: settings.workingHourEnd,
    minNoticeHours: settings.minNoticeHours,
    maxBookingDays: settings.maxBookingDays,
    companyTimezone: settings.companyTimezone ?? "",
    adminNotes: settings.adminNotes ?? "",
  };
}

type Payload = ReturnType<typeof toPayload>;
type FieldKey = keyof Payload;

const FIELD_META: Record<FieldKey, { label: string; tab: TabKey }> = {
  enabled: { label: "Bookings enabled", tab: "general" },
  tokenCost: { label: "Token cost", tab: "general" },
  durationMinutes: { label: "Duration", tab: "general" },
  contactEmail: { label: "Team contact email", tab: "calendar" },
  calendarIcsUrl: { label: "iCal URL", tab: "calendar" },
  workingDays: { label: "Working days", tab: "availability" },
  workingHourStart: { label: "Start time", tab: "availability" },
  workingHourEnd: { label: "End time", tab: "availability" },
  minNoticeHours: { label: "Minimum notice", tab: "availability" },
  maxBookingDays: { label: "Booking window", tab: "availability" },
  companyTimezone: { label: "Company timezone", tab: "availability" },
  adminNotes: { label: "Internal notes", tab: "notes" },
};

const TAB_LABEL: Record<TabKey, string> = {
  general: "General & pricing",
  availability: "Availability",
  calendar: "Calendar",
  notes: "Internal notes",
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
/** Display order: Monday first. Values stay 0 = Sunday … 6 = Saturday. */
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => {
  const label =
    h === 0 ? "12:00 AM" : h < 12 ? `${h}:00 AM` : h === 12 ? "12:00 PM" : `${h - 12}:00 PM`;
  return { value: h, label };
});

const TIMEZONE_OPTIONS = [
  "UTC",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Toronto",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Amsterdam",
  "Europe/Istanbul",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const pad2 = (n: number) => String(n).padStart(2, "0");

/** "Monday – Friday" for a contiguous Mon-first run, otherwise "Mon, Wed, Fri". */
function describeDays(days: number[]): string {
  if (days.length === 0) return DASH;
  if (days.length === 7) return "Every day";
  const ordered = DAY_ORDER.filter((d) => days.includes(d));
  const idx = ordered.map((d) => DAY_ORDER.indexOf(d));
  const contiguous = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  if (contiguous && ordered.length >= 3) {
    return `${DAY_NAMES[ordered[0]]} – ${DAY_NAMES[ordered[ordered.length - 1]]}`;
  }
  return ordered.map((d) => DAY_LABELS[d]).join(", ");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isHttpUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return Boolean(u.protocol && u.host);
  } catch {
    return false;
  }
}

function intError(v: number, min: number, max: number, unit: string): string | undefined {
  if (!Number.isFinite(v) || !Number.isInteger(v)) return "Enter a whole number.";
  if (v < min || v > max) return `Enter between ${fmt(min)} and ${fmt(max)} ${unit}.`;
  return undefined;
}

/** Mirrors lib/schemas/consultation-settings.schemas.ts so errors show inline. */
function validate(p: Payload): Partial<Record<FieldKey, string>> {
  const e: Partial<Record<FieldKey, string>> = {};
  const tokenCost = intError(p.tokenCost, 0, 100_000, "tokens");
  if (tokenCost) e.tokenCost = tokenCost;
  const duration = intError(p.durationMinutes, 5, 480, "minutes");
  if (duration) e.durationMinutes = duration;
  const notice = intError(p.minNoticeHours, 0, 30 * 24, "hours");
  if (notice) e.minNoticeHours = notice;
  const windowDays = intError(p.maxBookingDays, 1, 365, "days");
  if (windowDays) e.maxBookingDays = windowDays;
  if (p.workingHourStart >= p.workingHourEnd) {
    e.workingHourEnd = "End time must be later than the start time.";
  }
  const email = p.contactEmail.trim();
  if (email && (!EMAIL_RE.test(email) || email.length > 200)) {
    e.contactEmail = "Must be a valid email.";
  }
  const ics = p.calendarIcsUrl.trim();
  if (ics && (!isHttpUrl(ics) || ics.length > 1000)) e.calendarIcsUrl = "Must be a valid URL.";
  if (p.adminNotes.trim().length > 2000) e.adminNotes = "Keep notes under 2,000 characters.";
  return e;
}

function changedFields(a: Payload, b: Payload): FieldKey[] {
  return (Object.keys(a) as FieldKey[]).filter(
    (k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]),
  );
}

// Page-local glyphs the shared icon set doesn't have yet.
const svgBase = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function IconCheck(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...svgBase} {...p}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

function IconInfo(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...svgBase} strokeWidth={1.8} {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 7.5h.01" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Local building blocks
// ---------------------------------------------------------------------------

/** Read-only status pill under the page header. */
function StatusPill({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--av2-border)] bg-[var(--av2-surface)] px-4 text-sm font-medium">
      {icon}
      {children}
    </span>
  );
}

/** On/off switch (role="switch"); not in the shared primitives yet. */
function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-xl leading-7 font-semibold">{title}</h2>
      <p className="mt-0.5 text-sm text-[var(--av2-text-2)]">{description}</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div aria-busy="true">
      <Skeleton className="h-10 w-80" />
      <Skeleton className="mt-3 h-5 w-[28rem] max-w-full" />
      <div className="mt-6 flex gap-3">
        <Skeleton className="h-10 w-44 rounded-full" />
        <Skeleton className="h-10 w-32 rounded-full" />
        <Skeleton className="h-10 w-28 rounded-full" />
      </div>
      <Skeleton className="mt-6 h-10 w-full" />
      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Skeleton className="h-[480px] rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
      <p className="sr-only" role="status">
        Loading consultation settings…
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminConsultationSettingsPage() {
  // `saved` = last state from the server; `settings` = the editable draft.
  const [saved, setSaved] = useState<Settings | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("general");
  const { isSiteOwner, loading: roleLoading } = useSessionRole();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/consultation-settings", { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error((json && json.error) || "Failed to load settings");
      setSettings(json.settings as Settings);
      setSaved(json.settings as Settings);
    } catch (err) {
      console.error("[AdminConsultationSettingsPage] load error", err);
      setError(err instanceof Error ? err.message : "Failed to load settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Surface the Google OAuth callback result in the page banners.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const flag = params.get("google");
    const message = params.get("message");
    if (flag === "connected") {
      setSuccess(
        message && message !== "connected"
          ? `Google Calendar connected (${message}).`
          : "Google Calendar connected.",
      );
      setTab("calendar");
    } else if (flag === "error") {
      setError(
        message ? `Google Calendar connect failed: ${message}` : "Google Calendar connect failed.",
      );
      setTab("calendar");
    }
    if (flag) {
      params.delete("google");
      params.delete("message");
      const url = window.location.pathname + (params.toString() ? `?${params}` : "");
      window.history.replaceState(null, "", url);
    }
  }, []);

  const patch = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const toggleDay = (day: number) => {
    if (!settings) return;
    const set = new Set(settings.workingDays);
    if (set.has(day)) set.delete(day);
    else set.add(day);
    const next = Array.from(set).sort((a, b) => a - b);
    if (next.length === 0) return; // enforce at least one day
    patch("workingDays", next);
  };

  const draftPayload = useMemo(() => (settings ? toPayload(settings) : null), [settings]);
  const savedPayload = useMemo(() => (saved ? toPayload(saved) : null), [saved]);
  const changed = useMemo(
    () => (draftPayload && savedPayload ? changedFields(draftPayload, savedPayload) : []),
    [draftPayload, savedPayload],
  );
  const errors = useMemo(() => (draftPayload ? validate(draftPayload) : {}), [draftPayload]);
  const errorKeys = Object.keys(errors) as FieldKey[];
  const dirty = changed.length > 0;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings || !dirty || errorKeys.length > 0) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = toPayload(settings);
      const res = await fetch("/api/admin/consultation-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error((json && json.error) || "Save failed");
      setSettings(json.settings as Settings);
      setSaved(json.settings as Settings);
      setSuccess("Settings saved.");
    } catch (err) {
      console.error("[AdminConsultationSettingsPage] save error", err);
      setError(err instanceof Error ? err.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (saved) setSettings(saved);
  };

  const handleDisconnect = async () => {
    if (
      !window.confirm(
        "Disconnect Google Calendar? New bookings will fall back to the manual PENDING flow.",
      )
    )
      return;
    const res = await fetch("/api/admin/consultation-settings/google/disconnect", {
      method: "POST",
    });
    if (res.ok) {
      await load();
      setSuccess("Google Calendar disconnected.");
    } else {
      const json = await res.json().catch(() => null);
      setError((json && json.error) || "Failed to disconnect");
    }
  };

  if (loading && !settings) return <LoadingSkeleton />;

  if (!settings || !saved || !draftPayload) {
    return (
      <div className="max-w-2xl">
        <Callout
          tone="error"
          title="Couldn't load consultation settings"
          action={
            <Button size="sm" onClick={() => void load()}>
              Try again
            </Button>
          }
        >
          {error ?? "Settings unavailable."}
        </Callout>
      </div>
    );
  }

  // --- derived display values ------------------------------------------------
  const tabsWithChanges = new Set(changed.map((k) => FIELD_META[k].tab));
  const tabsWithErrors = new Set(errorKeys.map((k) => FIELD_META[k].tab));
  const tabLabel = (key: TabKey) => (
    <span className="inline-flex items-center gap-2">
      {TAB_LABEL[key]}
      {tabsWithErrors.has(key) ? (
        <span className="h-2 w-2 rounded-full bg-[var(--av2-error)]" aria-label="has errors" />
      ) : tabsWithChanges.has(key) ? (
        <span
          className="h-2 w-2 rounded-full bg-[var(--av2-accent)]"
          aria-label="has unsaved changes"
        />
      ) : null}
    </span>
  );

  const hourLabel = (h: number) => `${pad2(h)}:00`;
  const googleBroken = settings.googleConnected && Boolean(settings.googleConnectionBrokenAt);

  const saveStatus = (() => {
    if (errorKeys.length > 0) {
      const tabs = Array.from(tabsWithErrors)
        .map((t) => TAB_LABEL[t])
        .join(", ");
      return (
        <span className="text-[var(--av2-error-text)]">
          Fix {errorKeys.length} {plural(errorKeys.length, "field", "fields")} before saving ({tabs}
          ).
        </span>
      );
    }
    if (dirty) {
      const names = changed.map((k) => FIELD_META[k].label);
      return (
        <>
          <span className="font-semibold text-[var(--av2-text)]">
            {changed.length} unsaved {plural(changed.length, "change", "changes")}:
          </span>{" "}
          {names.join(", ")}. Saving applies them to new bookings.
        </>
      );
    }
    return (
      <span className="inline-flex items-center gap-2">
        <IconCheck width={16} height={16} />
        No unsaved changes · Last saved {new Date(saved.updatedAt).toLocaleString()}
      </span>
    );
  })();

  const tabPrefix = "consultation-settings";

  return (
    <div>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[32px] leading-10 font-bold tracking-tight">Consultation settings</h1>
          <p className="mt-1 text-base text-[var(--av2-text-2)]">
            Set the price, availability and calendar for your consultations.
          </p>
        </div>
        <ButtonLink href="/admin/consultations" variant="secondary">
          <span aria-hidden>←</span> Back to requests
        </ButtonLink>
      </header>

      {/* Live (saved) state */}
      <div className="mb-6 flex flex-wrap gap-3" aria-label="Current settings">
        <StatusPill
          icon={
            <span
              aria-hidden
              className="h-2.5 w-2.5 rounded-full"
              style={{
                background: saved.enabled ? "var(--av2-fill-green)" : "var(--av2-fill-neutral)",
              }}
            />
          }
        >
          {saved.enabled ? "Bookings enabled" : "Bookings disabled"}
        </StatusPill>
        <StatusPill icon={<IconClock width={18} height={18} />}>
          {fmt(saved.durationMinutes)} {plural(saved.durationMinutes, "minute", "minutes")}
        </StatusPill>
        <StatusPill icon={<IconCoins width={18} height={18} />}>
          {fmt(saved.tokenCost)} {plural(saved.tokenCost, "token", "tokens")}
        </StatusPill>
      </div>

      {!roleLoading && !isSiteOwner && (
        <div className="mb-4" role="note">
          <Callout tone="warning" title="Site owner only">
            Site admins can view this page, but only the site owner can edit consultation pricing,
            availability, or Google Calendar settings. Requests from admins will be rejected with a
            403.
          </Callout>
        </div>
      )}
      {error && (
        <div className="mb-4">
          <Callout tone="error" title="Something went wrong">
            {error}
          </Callout>
        </div>
      )}
      {success && (
        <div className="mb-4" role="status">
          <Callout tone="success" title={success} />
        </div>
      )}

      <div className="mb-6">
        <Tabs<TabKey>
          label="Consultation settings sections"
          idPrefix={tabPrefix}
          value={tab}
          onChange={setTab}
          tabs={(["general", "availability", "calendar", "notes"] as TabKey[]).map((k) => ({
            value: k,
            label: tabLabel(k),
          }))}
        />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* ---------------- Editor ---------------- */}
        <form onSubmit={handleSave} noValidate className="min-w-0">
          <Card>
            <TabPanel idPrefix={tabPrefix} value={tab}>
              {tab === "general" && (
                <>
                  <SectionHeading
                    title="General & pricing"
                    description="Turn bookings on or off and set what a session costs."
                  />
                  <div className="flex items-start justify-between gap-6 rounded-xl border border-[var(--av2-border)] p-4">
                    <div className="min-w-0">
                      <p id="cs-enabled-label" className="text-sm font-semibold">
                        Bookings enabled
                      </p>
                      <p id="cs-enabled-hint" className="mt-0.5 text-sm text-[var(--av2-text-2)]">
                        When off, customers see a &quot;currently unavailable&quot; message and
                        cannot submit new requests.
                      </p>
                    </div>
                    <Switch
                      checked={settings.enabled}
                      onChange={(v) => patch("enabled", v)}
                      labelledBy="cs-enabled-label"
                      describedBy="cs-enabled-hint"
                    />
                  </div>

                  <div className="mt-6 grid gap-5 sm:grid-cols-2">
                    <Field
                      label="Token cost"
                      htmlFor="cs-token-cost"
                      error={errors.tokenCost}
                      hint="Charged on submit. Refunded on cancel from PENDING/SCHEDULED."
                    >
                      <TextInput
                        id="cs-token-cost"
                        type="number"
                        min={0}
                        max={100000}
                        step={1}
                        suffix="tokens"
                        aria-invalid={Boolean(errors.tokenCost)}
                        value={settings.tokenCost}
                        onChange={(e) => patch("tokenCost", Number(e.target.value))}
                      />
                    </Field>
                    <Field
                      label="Duration"
                      htmlFor="cs-duration"
                      error={errors.durationMinutes}
                      hint="Length of one session, 5–480 minutes."
                    >
                      <TextInput
                        id="cs-duration"
                        type="number"
                        min={5}
                        max={480}
                        step={5}
                        suffix="minutes"
                        aria-invalid={Boolean(errors.durationMinutes)}
                        value={settings.durationMinutes}
                        onChange={(e) => patch("durationMinutes", Number(e.target.value))}
                      />
                    </Field>
                  </div>
                </>
              )}

              {tab === "availability" && (
                <>
                  <SectionHeading
                    title="Availability"
                    description="Choose when customers can book a session."
                  />
                  <fieldset>
                    <legend className="mb-1.5 block text-sm font-medium">Working days</legend>
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                      {DAY_ORDER.map((day) => {
                        const active = settings.workingDays.includes(day);
                        const onlyOne = active && settings.workingDays.length === 1;
                        return (
                          <button
                            key={day}
                            type="button"
                            aria-pressed={active}
                            aria-label={DAY_NAMES[day]}
                            title={onlyOne ? "At least one working day is required" : undefined}
                            onClick={() => toggleDay(day)}
                            className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:ring-offset-1 focus-visible:outline-none ${
                              active
                                ? "border-[var(--av2-accent)] bg-[var(--av2-selected)] text-[var(--av2-text)]"
                                : "border-[var(--av2-border)] bg-[var(--av2-bg)] text-[var(--av2-text-2)] hover:text-[var(--av2-text)]"
                            }`}
                          >
                            {active && (
                              <IconCheck
                                width={16}
                                height={16}
                                className="text-[var(--av2-link)]"
                              />
                            )}
                            {DAY_LABELS[day]}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-1.5 text-xs text-[var(--av2-text-2)]">
                      At least one day is required.
                    </p>
                  </fieldset>

                  <div className="mt-6 grid gap-5 sm:grid-cols-2">
                    <Field label="Start time" htmlFor="cs-hour-start">
                      <Select
                        id="cs-hour-start"
                        value={settings.workingHourStart}
                        onChange={(e) => patch("workingHourStart", Number(e.target.value))}
                      >
                        {HOUR_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="End time" htmlFor="cs-hour-end" error={errors.workingHourEnd}>
                      <Select
                        id="cs-hour-end"
                        aria-invalid={Boolean(errors.workingHourEnd)}
                        value={settings.workingHourEnd}
                        onChange={(e) => patch("workingHourEnd", Number(e.target.value))}
                      >
                        {HOUR_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>

                  <Field
                    className="mt-5"
                    label="Company timezone"
                    htmlFor="cs-timezone"
                    hint={
                      settings.companyTimezone
                        ? `Working hours are read in ${settings.companyTimezone.replace(/_/g, " ")}.`
                        : "No company timezone is set. Times follow each customer's timezone."
                    }
                  >
                    <Select
                      id="cs-timezone"
                      value={settings.companyTimezone ?? ""}
                      onChange={(e) => patch("companyTimezone", e.target.value)}
                    >
                      <option value="">Unset (use customer&apos;s timezone)</option>
                      {TIMEZONE_OPTIONS.map((tz) => (
                        <option key={tz} value={tz}>
                          {tz.replace(/_/g, " ")}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <div className="mt-5 grid gap-5 sm:grid-cols-2">
                    <Field
                      label="Minimum notice"
                      htmlFor="cs-min-notice"
                      error={errors.minNoticeHours}
                      hint="Customers can't pick a slot sooner than this."
                    >
                      <TextInput
                        id="cs-min-notice"
                        type="number"
                        min={0}
                        max={30 * 24}
                        step={1}
                        suffix="hours"
                        aria-invalid={Boolean(errors.minNoticeHours)}
                        value={settings.minNoticeHours}
                        onChange={(e) => patch("minNoticeHours", Number(e.target.value))}
                      />
                    </Field>
                    <Field
                      label="Booking window"
                      htmlFor="cs-max-days"
                      error={errors.maxBookingDays}
                      hint="Customers can't pick a slot further out than this."
                    >
                      <TextInput
                        id="cs-max-days"
                        type="number"
                        min={1}
                        max={365}
                        step={1}
                        suffix="days"
                        aria-invalid={Boolean(errors.maxBookingDays)}
                        value={settings.maxBookingDays}
                        onChange={(e) => patch("maxBookingDays", Number(e.target.value))}
                      />
                    </Field>
                  </div>
                </>
              )}

              {tab === "calendar" && (
                <>
                  <SectionHeading
                    title="Calendar"
                    description="Where bookings land and how the team is reached."
                  />

                  <div className="rounded-xl border border-[var(--av2-border)] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-base font-semibold">Google Calendar integration</h3>
                      {settings.googleConnected ? (
                        googleBroken ? (
                          <Badge tone="red" dot>
                            Connection broken
                          </Badge>
                        ) : (
                          <Badge tone="green" dot>
                            Connected
                          </Badge>
                        )
                      ) : (
                        <Badge tone="neutral" dot>
                          Not connected
                        </Badge>
                      )}
                    </div>

                    {settings.googleConnected ? (
                      <div className="mt-3 space-y-3">
                        {/* Connected-but-dead: the refresh token exists in the DB but
                            Google rejects it (invalid_grant). Without this alert the
                            green box below would claim everything is fine while every
                            booking 502s. */}
                        {settings.googleConnectionBrokenAt && (
                          <Callout tone="error" title="Connection broken — reconnect required">
                            Google rejected the stored credentials on{" "}
                            {new Date(settings.googleConnectionBrokenAt).toLocaleString()}
                            {settings.googleConnectionLastError
                              ? ` (${settings.googleConnectionLastError})`
                              : ""}
                            . Bookings cannot create calendar events. Click Disconnect below, then
                            Connect again with the same Google account.
                          </Callout>
                        )}
                        <div className="flex flex-wrap items-center gap-4 rounded-lg bg-[var(--av2-success-bg)] p-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold">
                              Connected as {settings.googleAccountEmail ?? "(unknown account)"}
                            </p>
                            <p className="mt-0.5 text-xs text-[var(--av2-text-2)]">
                              {settings.googleConnectedAt
                                ? `Connected ${new Date(settings.googleConnectedAt).toLocaleString()}`
                                : "Connected"}
                              . New bookings will auto-schedule on this calendar and send Google
                              Meet invites to customers.
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            onClick={handleDisconnect}
                          >
                            Disconnect
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 space-y-3">
                        <p className="text-sm text-[var(--av2-text-2)]">
                          Connect the team Gmail to auto-schedule bookings. When a customer submits:
                          Brandbite creates a calendar event with a Google Meet link, invites the
                          customer, and the event lands on your team calendar automatically.
                        </p>
                        <a
                          href="/api/admin/consultation-settings/google/connect"
                          className={buttonClass("secondary")}
                        >
                          Connect Google Calendar
                        </a>
                        <p className="text-xs text-[var(--av2-text-2)]">
                          You&apos;ll be redirected to Google to grant calendar.events and
                          calendar.freebusy scopes. Brandbite stores the refresh token and uses it
                          on your behalf.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 grid gap-5">
                    <Field
                      label="Team contact email"
                      htmlFor="cs-contact-email"
                      error={errors.contactEmail}
                      hint="Shown to customers. A follow-up will send an .ics calendar invite here when an admin confirms a schedule, so the event lands on this Gmail/Outlook account."
                    >
                      <TextInput
                        id="cs-contact-email"
                        type="email"
                        placeholder="team@yourcompany.com"
                        aria-invalid={Boolean(errors.contactEmail)}
                        value={settings.contactEmail ?? ""}
                        onChange={(e) => patch("contactEmail", e.target.value)}
                      />
                    </Field>
                    <Field
                      label="Google Calendar secret iCal URL (legacy)"
                      htmlFor="cs-ics-url"
                      error={errors.calendarIcsUrl}
                      hint="Optional. Superseded by the Google Calendar OAuth connection above — keep blank unless you need a read-only fallback."
                    >
                      <TextInput
                        id="cs-ics-url"
                        type="url"
                        placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
                        aria-invalid={Boolean(errors.calendarIcsUrl)}
                        value={settings.calendarIcsUrl ?? ""}
                        onChange={(e) => patch("calendarIcsUrl", e.target.value)}
                      />
                    </Field>
                  </div>
                </>
              )}

              {tab === "notes" && (
                <>
                  <SectionHeading
                    title="Internal notes"
                    description="Not shown to customers. Useful for handover notes between admins."
                  />
                  <Field
                    label="Notes"
                    htmlFor="cs-admin-notes"
                    error={errors.adminNotes}
                    hint={`${fmt((settings.adminNotes ?? "").length)} / 2,000 characters`}
                  >
                    <TextArea
                      id="cs-admin-notes"
                      rows={6}
                      placeholder="Not shown to customers. Useful for handover notes between admins."
                      aria-invalid={Boolean(errors.adminNotes)}
                      value={settings.adminNotes ?? ""}
                      onChange={(e) => patch("adminNotes", e.target.value)}
                    />
                  </Field>
                </>
              )}
            </TabPanel>

            <div className="mt-8 border-t border-[var(--av2-border)] pt-5">
              <SaveBar dirty={dirty} status={saveStatus}>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleReset}
                  disabled={!dirty || saving}
                >
                  Reset changes
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={!dirty || saving || errorKeys.length > 0}
                >
                  {saving ? "Saving…" : "Save settings"}
                </Button>
              </SaveBar>
            </div>
          </Card>
        </form>

        {/* ---------------- Summary ---------------- */}
        <div className="space-y-6">
          <Card>
            <div className="mb-5 flex items-center gap-3">
              <IconTile tone="peach" round>
                <IconConsultations width={22} height={22} />
              </IconTile>
              <CardTitle
                description={dirty ? "Preview — includes unsaved changes." : "As customers see it."}
              >
                Booking rules at a glance
              </CardTitle>
            </div>
            <KeyValueList
              rows={[
                {
                  label: "Status",
                  value: settings.enabled ? "Bookings enabled" : "Bookings disabled",
                },
                {
                  label: "Price",
                  value: `${fmt(settings.tokenCost)} ${plural(settings.tokenCost, "token", "tokens")}`,
                },
                {
                  label: "Duration",
                  value: `${fmt(settings.durationMinutes)} ${plural(settings.durationMinutes, "minute", "minutes")}`,
                },
                { label: "Days", value: describeDays(settings.workingDays) },
                {
                  label: "Hours",
                  value: `${hourLabel(settings.workingHourStart)} – ${hourLabel(settings.workingHourEnd)}`,
                },
                {
                  label: "Timezone",
                  value: settings.companyTimezone
                    ? settings.companyTimezone.replace(/_/g, " ")
                    : "Customer's timezone",
                },
                {
                  label: "Notice",
                  value: `${fmt(settings.minNoticeHours)} ${plural(settings.minNoticeHours, "hour", "hours")}`,
                },
                {
                  label: "Booking window",
                  value: `${fmt(settings.maxBookingDays)} ${plural(settings.maxBookingDays, "day", "days")}`,
                },
              ]}
            />
            {!settings.companyTimezone && (
              <div className="mt-5 flex items-start gap-3 border-t border-[var(--av2-border)] pt-5 text-sm text-[var(--av2-text-2)]">
                <IconTile tone="lavender" size={32} round>
                  <IconInfo width={16} height={16} />
                </IconTile>
                <p>Set a company timezone if you want a fixed schedule across regions.</p>
              </div>
            )}
          </Card>

          <Card>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <IconTile tone="green" round>
                  <IconConsultations width={22} height={22} />
                </IconTile>
                <h2 className="text-xl leading-7 font-semibold">Calendar</h2>
              </div>
              {settings.googleConnected ? (
                googleBroken ? (
                  <Badge tone="red" dot>
                    Broken
                  </Badge>
                ) : (
                  <Badge tone="green" dot>
                    Connected
                  </Badge>
                )
              ) : (
                <Badge tone="neutral" dot>
                  Not connected
                </Badge>
              )}
            </div>
            <dl className="mt-5 space-y-4 text-sm">
              <div>
                <dt className="text-[var(--av2-text-2)]">Google account</dt>
                <dd className="mt-0.5 font-medium break-words">
                  {settings.googleConnected
                    ? (settings.googleAccountEmail ?? "(unknown account)")
                    : DASH}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--av2-text-2)]">Team contact email</dt>
                <dd className="mt-0.5 font-medium break-words">{saved.contactEmail || DASH}</dd>
              </div>
            </dl>
            {tab !== "calendar" && (
              <div className="mt-5 border-t border-[var(--av2-border)] pt-4">
                <button
                  type="button"
                  onClick={() => setTab("calendar")}
                  className="inline-flex items-center gap-1 rounded text-sm font-semibold text-[var(--av2-link)] hover:underline focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none"
                >
                  Manage calendar
                  <IconArrowUpRight />
                </button>
                <p className="mt-1 text-sm text-[var(--av2-text-2)]">
                  Open the Calendar tab to update the connection and contact details.
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
