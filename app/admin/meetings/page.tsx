// -----------------------------------------------------------------------------
// @file: app/admin/meetings/page.tsx
// @purpose: Admin list of meetings booked from the public /meet page, with a
//           warning when the calendar connection would stop bookings.
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Badge,
  Button,
  Callout,
  Card,
  EmptyState,
  FilterChips,
  PageHeader,
  Skeleton,
} from "@/components/admin/v2/ui";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast-provider";

type MeetingRow = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  note: string | null;
  startsAt: string;
  status: "CONFIRMED" | "CANCELED";
  videoLink: string | null;
};

type CalendarState = {
  connected: boolean;
  accountEmail: string | null;
  hostEmail: string;
  timeZone: string | null;
};

type Filter = "UPCOMING" | "PAST" | "CANCELED";

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso));
}

export default function AdminMeetingsPage() {
  const { showToast } = useToast();
  const [meetings, setMeetings] = useState<MeetingRow[]>([]);
  const [calendar, setCalendar] = useState<CalendarState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("UPCOMING");
  const [canceling, setCanceling] = useState<MeetingRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/meetings", { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to load meetings");
      setMeetings(json.meetings);
      setCalendar(json.calendar);
      setNow(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load meetings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/meetings", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) throw new Error(json?.error ?? "Failed to load meetings");
        setMeetings(json.meetings);
        setCalendar(json.calendar);
        setNow(Date.now());
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load meetings");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const groups = useMemo(() => {
    const isCanceled = (m: MeetingRow) => m.status === "CANCELED";
    const isFuture = (m: MeetingRow) => new Date(m.startsAt).getTime() > now;
    return {
      UPCOMING: meetings
        .filter((m) => !isCanceled(m) && isFuture(m))
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
      PAST: meetings.filter((m) => !isCanceled(m) && !isFuture(m)),
      CANCELED: meetings.filter(isCanceled),
    };
  }, [meetings, now]);

  const confirmCancel = async () => {
    if (!canceling) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/meetings/${canceling.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to cancel meeting");
      showToast({ type: "success", title: "Meeting canceled" });
      setCanceling(null);
      await load();
    } catch (err) {
      showToast({
        type: "error",
        title: err instanceof Error ? err.message : "Failed to cancel meeting",
      });
    } finally {
      setBusy(false);
    }
  };

  const hostMatches = calendar?.accountEmail?.toLowerCase() === calendar?.hostEmail;
  const rows = groups[filter];

  return (
    <div>
      <PageHeader
        title="Meetings"
        description={
          calendar
            ? `30-minute calls booked from the public /meet page, hosted by ${calendar.hostEmail}.`
            : "30-minute calls booked from the public /meet page."
        }
        actions={
          <Button onClick={() => void load()} disabled={loading}>
            Refresh
          </Button>
        }
      />

      {calendar && !calendar.connected ? (
        <div className="mb-4">
          <Callout tone="error" title="Booking is off">
            Google Calendar isn&apos;t connected, so /meet shows no times. Connect it in
            Consultation settings.
          </Callout>
        </div>
      ) : calendar && !hostMatches ? (
        <div className="mb-4">
          <Callout tone="warning" title="Calendar is connected to another account">
            Connected as {calendar.accountEmail ?? "an unknown account"}. Bookings stay closed
            unless that account can see {calendar.hostEmail}&apos;s free/busy times.
          </Callout>
        </div>
      ) : null}
      {calendar && !calendar.timeZone ? (
        <div className="mb-4">
          <Callout tone="warning" title="No company time zone set">
            Working hours are being read as UTC. Set the time zone in Consultation settings.
          </Callout>
        </div>
      ) : null}
      {error ? (
        <div className="mb-4">
          <Callout tone="error">{error}</Callout>
        </div>
      ) : null}

      <div className="mb-4">
        <FilterChips
          label="Filter meetings"
          value={filter}
          onChange={setFilter}
          options={[
            {
              value: "UPCOMING",
              label: "Upcoming",
              count: loading ? null : groups.UPCOMING.length,
            },
            { value: "PAST", label: "Past", count: loading ? null : groups.PAST.length },
            {
              value: "CANCELED",
              label: "Canceled",
              count: loading ? null : groups.CANCELED.length,
            },
          ]}
        />
      </div>

      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            title="No meetings here"
            description="Meetings appear here when someone books from /meet."
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((meeting) => (
            <li key={meeting.id}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{formatWhen(meeting.startsAt)}</p>
                    <p className="mt-1 text-sm">
                      {meeting.name}
                      {meeting.company ? `, ${meeting.company}` : ""} ·{" "}
                      <a className="underline" href={`mailto:${meeting.email}`}>
                        {meeting.email}
                      </a>
                    </p>
                    {meeting.note ? (
                      <p className="mt-2 text-sm break-words whitespace-pre-wrap">{meeting.note}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {meeting.status === "CANCELED" ? <Badge tone="neutral">Canceled</Badge> : null}
                    {filter === "UPCOMING" && meeting.videoLink ? (
                      <a
                        className="text-sm font-medium underline"
                        href={meeting.videoLink}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Join link
                      </a>
                    ) : null}
                    {filter === "UPCOMING" ? (
                      <Button onClick={() => setCanceling(meeting)}>Cancel</Button>
                    ) : null}
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={canceling !== null}
        onClose={() => setCanceling(null)}
        onConfirm={() => void confirmCancel()}
        loading={busy}
        title="Cancel this meeting?"
        description={
          canceling
            ? `${canceling.name} will get a cancellation email and the event will be removed from the calendar.`
            : ""
        }
        confirmLabel="Cancel meeting"
      />
    </div>
  );
}
