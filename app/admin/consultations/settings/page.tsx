// -----------------------------------------------------------------------------
// @file: app/admin/consultations/settings/page.tsx
// @purpose: SITE_OWNER / SITE_ADMIN management of the consultation feature —
//           enable/disable, pricing, working hours, ICS feed, contact email,
//           and misc tunables. Persisted in the ConsultationSettings singleton.
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { FormInput, FormSelect, FormTextarea } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { LoadingState } from "@/components/ui/loading-state";
import { OwnerOnlyBanner } from "@/components/admin/owner-only-banner";

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
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

export default function AdminConsultationSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/consultation-settings", { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error((json && json.error) || "Failed to load settings");
      setSettings(json.settings as Settings);
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
    } else if (flag === "error") {
      setError(
        message ? `Google Calendar connect failed: ${message}` : "Google Calendar connect failed.",
      );
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
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
      const res = await fetch("/api/admin/consultation-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error((json && json.error) || "Save failed");
      setSettings(json.settings as Settings);
      setSuccess("Settings saved.");
    } catch (err) {
      console.error("[AdminConsultationSettingsPage] save error", err);
      setError(err instanceof Error ? err.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <LoadingState />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <InlineAlert variant="error">{error ?? "Settings unavailable."}</InlineAlert>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold tracking-[0.2em] text-[var(--bb-primary)] uppercase">
            Consultations → Settings
          </p>
          <h1 className="font-brand mt-2 text-2xl font-bold tracking-tight text-[var(--bb-secondary)]">
            Consultation settings
          </h1>
          <p className="mt-1 text-sm text-[var(--bb-text-secondary)]">
            Control the consultation booking feature — pricing, availability, and calendar
            integration.
          </p>
        </div>
        <Link
          href="/admin/consultations"
          className="shrink-0 text-xs font-medium text-[var(--bb-primary)] hover:underline"
        >
          ← Back to queue
        </Link>
      </header>

      <OwnerOnlyBanner action="edit consultation pricing, availability, or Google Calendar settings" />

      {error && (
        <InlineAlert variant="error" className="mb-4">
          {error}
        </InlineAlert>
      )}
      {success && (
        <InlineAlert variant="success" className="mb-4">
          {success}
        </InlineAlert>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* ---------------- General ---------------- */}
        <section className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] p-5">
          <h2 className="mb-3 text-sm font-semibold text-[var(--bb-secondary)]">General</h2>

          <label className="mb-3 flex items-center gap-3 text-sm text-[var(--bb-text-secondary)]">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => patch("enabled", e.target.checked)}
              className="h-4 w-4 accent-[var(--bb-primary)]"
            />
            <span>
              <strong>Feature enabled</strong> — when off, customers see a &quot;currently
              unavailable&quot; message and cannot submit new requests.
            </span>
          </label>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-semibold tracking-[0.15em] text-[var(--bb-text-tertiary)] uppercase">
                Token cost
              </label>
              <FormInput
                type="number"
                min={0}
                max={100000}
                step={1}
                value={settings.tokenCost}
                onChange={(e) => patch("tokenCost", Number(e.target.value))}
              />
              <p className="mt-1 text-[11px] text-[var(--bb-text-muted)]">
                Charged on submit. Refunded on cancel from PENDING/SCHEDULED.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold tracking-[0.15em] text-[var(--bb-text-tertiary)] uppercase">
                Duration (minutes)
              </label>
              <FormInput
                type="number"
                min={5}
                max={480}
                step={5}
                value={settings.durationMinutes}
                onChange={(e) => patch("durationMinutes", Number(e.target.value))}
              />
            </div>
          </div>
        </section>

        {/* ---------------- Contact + calendar ---------------- */}
        <section className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] p-5">
          <h2 className="mb-3 text-sm font-semibold text-[var(--bb-secondary)]">
            Contact &amp; calendar
          </h2>

          <div className="grid gap-4">
            <div>
              <label className="mb-1 block text-[11px] font-semibold tracking-[0.15em] text-[var(--bb-text-tertiary)] uppercase">
                Team contact email
              </label>
              <FormInput
                type="email"
                placeholder="team@yourcompany.com"
                value={settings.contactEmail ?? ""}
                onChange={(e) => patch("contactEmail", e.target.value)}
              />
              <p className="mt-1 text-[11px] text-[var(--bb-text-muted)]">
                Shown to customers. A follow-up will send an .ics calendar invite here when an admin
                confirms a schedule, so the event lands on this Gmail/Outlook account.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold tracking-[0.15em] text-[var(--bb-text-tertiary)] uppercase">
                Google Calendar secret iCal URL (legacy)
              </label>
              <FormInput
                type="url"
                placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
                value={settings.calendarIcsUrl ?? ""}
                onChange={(e) => patch("calendarIcsUrl", e.target.value)}
              />
              <p className="mt-1 text-[11px] text-[var(--bb-text-muted)]">
                Optional. Superseded by the Google Calendar OAuth connection below — keep blank
                unless you need a read-only fallback.
              </p>
            </div>
          </div>
        </section>

        {/* ---------------- Google Calendar OAuth ---------------- */}
        <section className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] p-5">
          <h2 className="mb-3 text-sm font-semibold text-[var(--bb-secondary)]">
            Google Calendar integration
          </h2>

          {settings.googleConnected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <span className="text-lg">✓</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-emerald-900">
                    Connected as {settings.googleAccountEmail ?? "(unknown account)"}
                  </p>
                  <p className="text-[11px] text-emerald-800">
                    {settings.googleConnectedAt
                      ? `Connected ${new Date(settings.googleConnectedAt).toLocaleString()}`
                      : "Connected"}
                    . New bookings will auto-schedule on this calendar and send Google Meet invites
                    to customers.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
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
                  }}
                >
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-[var(--bb-text-secondary)]">
                Connect the team Gmail to auto-schedule bookings. When a customer submits: Brandbite
                creates a calendar event with a Google Meet link, invites the customer, and the
                event lands on your team calendar automatically.
              </p>
              <a
                href="/api/admin/consultation-settings/google/connect"
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--bb-border)] bg-white px-4 py-2 text-sm font-medium text-[var(--bb-secondary)] shadow-sm transition-colors hover:border-[var(--bb-primary)] hover:text-[var(--bb-primary)]"
              >
                Connect Google Calendar
              </a>
              <p className="text-[11px] text-[var(--bb-text-muted)]">
                You&apos;ll be redirected to Google to grant calendar.events and calendar.freebusy
                scopes. Brandbite stores the refresh token and uses it on your behalf.
              </p>
            </div>
          )}
        </section>

        {/* ---------------- Availability ---------------- */}
        <section className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] p-5">
          <h2 className="mb-3 text-sm font-semibold text-[var(--bb-secondary)]">Availability</h2>

          <div className="mb-4">
            <label className="mb-2 block text-[11px] font-semibold tracking-[0.15em] text-[var(--bb-text-tertiary)] uppercase">
              Working days
            </label>
            <div className="flex flex-wrap gap-2">
              {DAY_LABELS.map((label, day) => {
                const active = settings.workingDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      active
                        ? "border-[var(--bb-secondary)] bg-[var(--bb-secondary)] text-white"
                        : "border-[var(--bb-border)] text-[var(--bb-text-secondary)] hover:text-[var(--bb-secondary)]"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-semibold tracking-[0.15em] text-[var(--bb-text-tertiary)] uppercase">
                Working hour start
              </label>
              <FormSelect
                value={settings.workingHourStart}
                onChange={(e) => patch("workingHourStart", Number(e.target.value))}
              >
                {HOUR_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </FormSelect>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold tracking-[0.15em] text-[var(--bb-text-tertiary)] uppercase">
                Working hour end
              </label>
              <FormSelect
                value={settings.workingHourEnd}
                onChange={(e) => patch("workingHourEnd", Number(e.target.value))}
              >
                {HOUR_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </FormSelect>
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-[11px] font-semibold tracking-[0.15em] text-[var(--bb-text-tertiary)] uppercase">
              Company timezone
            </label>
            <FormSelect
              value={settings.companyTimezone ?? ""}
              onChange={(e) => patch("companyTimezone", e.target.value)}
            >
              <option value="">— unset (use customer&apos;s timezone) —</option>
              {TIMEZONE_OPTIONS.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace(/_/g, " ")}
                </option>
              ))}
            </FormSelect>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-semibold tracking-[0.15em] text-[var(--bb-text-tertiary)] uppercase">
                Minimum notice (hours)
              </label>
              <FormInput
                type="number"
                min={0}
                max={30 * 24}
                step={1}
                value={settings.minNoticeHours}
                onChange={(e) => patch("minNoticeHours", Number(e.target.value))}
              />
              <p className="mt-1 text-[11px] text-[var(--bb-text-muted)]">
                Customers can&apos;t pick a slot sooner than this.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold tracking-[0.15em] text-[var(--bb-text-tertiary)] uppercase">
                Max booking window (days)
              </label>
              <FormInput
                type="number"
                min={1}
                max={365}
                step={1}
                value={settings.maxBookingDays}
                onChange={(e) => patch("maxBookingDays", Number(e.target.value))}
              />
              <p className="mt-1 text-[11px] text-[var(--bb-text-muted)]">
                Customers can&apos;t pick a slot further out than this.
              </p>
            </div>
          </div>
        </section>

        {/* ---------------- Internal notes ---------------- */}
        <section className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] p-5">
          <h2 className="mb-3 text-sm font-semibold text-[var(--bb-secondary)]">Internal notes</h2>
          <FormTextarea
            rows={3}
            placeholder="Not shown to customers. Useful for handover notes between admins."
            value={settings.adminNotes ?? ""}
            onChange={(e) => patch("adminNotes", e.target.value)}
          />
        </section>

        <div className="flex items-center justify-between">
          <p className="text-[11px] text-[var(--bb-text-muted)]">
            Last saved {new Date(settings.updatedAt).toLocaleString()}
          </p>
          <Button type="submit" loading={saving} loadingText="Saving...">
            Save settings
          </Button>
        </div>
      </form>
    </div>
  );
}
