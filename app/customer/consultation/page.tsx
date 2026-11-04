// -----------------------------------------------------------------------------
// @file: app/customer/consultation/page.tsx
// @purpose: Company OWNER/PM view for booking a consultation and tracking the
//           status of past / pending requests. Token-costed; form debits the
//           tokens on submit, admin schedules out-of-band.
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { IconArrowUpRight, IconClock, IconCoins } from "@/components/admin/v2/icons";
import {
  Badge,
  Button,
  buttonClass,
  Callout,
  Card,
  CardTitle,
  EmptyState,
  Field,
  fmt,
  IconTile,
  PageHeader,
  plural,
  SearchInput,
  Select,
  Skeleton,
  TabPanel,
  Tabs,
  TextArea,
  TextInput,
  type Tone,
} from "@/components/admin/v2/ui";
import { ListPager } from "@/components/dashboard/workspace/list-pager";
import {
  InsufficientTokensModal,
  type InsufficientTokensInfo,
} from "@/components/tokens/insufficient-tokens-modal";
import { isInsufficientTokensBody } from "@/lib/errors/insufficient-tokens";
import { zonedWallTimeToUtc } from "@/lib/timezone";

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

const STATUS_TONE: Record<ConsultationStatus, Tone> = {
  PENDING: "amber",
  SCHEDULED: "blue",
  COMPLETED: "green",
  CANCELED: "neutral",
};

const HISTORY_TABS = "consultation-history";
const HISTORY_PAGE_SIZE = 5;
const SELECT_THEME = "dark:[color-scheme:dark]";

/** Still to happen: waiting for a slot, or scheduled for a time not yet passed. */
function isUpcoming(c: ConsultationRow, now: number): boolean {
  if (c.status === "PENDING") return true;
  if (c.status !== "SCHEDULED") return false;
  return !c.scheduledAt || new Date(c.scheduledAt).getTime() >= now;
}

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
  const [balance, setBalance] = useState<number | null>(null);

  // History list controls (client-side: the API returns every row).
  const [historyTab, setHistoryTab] = useState<"upcoming" | "all">("all");
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyStatus, setHistoryStatus] = useState<ConsultationStatus | "">("");
  const [historyPage, setHistoryPage] = useState(1);

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

  // Freebusy — populated after the customer picks a date, if Google is connected.
  const [busyIntervals, setBusyIntervals] = useState<{ start: string; end: string }[]>([]);
  const [busyLoading, setBusyLoading] = useState(false);
  const [busyGoogleConnected, setBusyGoogleConnected] = useState(false);

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

  // The balance is informational; the form still works if this request fails.
  const loadBalance = useCallback(() => {
    fetch("/api/customer/tokens", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const value = json?.company?.tokenBalance;
        if (typeof value === "number") setBalance(value);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadBalance();
  }, [loadBalance]);

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

  // Fetch team busy intervals when the customer picks a date.
  useEffect(() => {
    if (!date || !settings) {
      setBusyIntervals([]);
      setBusyGoogleConnected(false);
      return;
    }
    // Query the busy window for the selected zone's calendar day (its
    // midnight-to-midnight), so it matches the zone-aware slot overlap check.
    const [yy, mm, dd] = date.split("-").map(Number);
    const nextDate = new Date(Date.UTC(yy, mm - 1, dd + 1)).toISOString().slice(0, 10);
    const timeMin = zonedWallTimeToUtc(`${date}T00:00`, timezone).toISOString();
    const timeMax = zonedWallTimeToUtc(`${nextDate}T00:00`, timezone).toISOString();

    let cancelled = false;
    setBusyLoading(true);
    fetch(
      `/api/customer/consultations/availability?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`,
      { cache: "no-store" },
    )
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (Array.isArray(json?.busy)) setBusyIntervals(json.busy);
        else setBusyIntervals([]);
        setBusyGoogleConnected(Boolean(json?.googleConnected));
      })
      .catch(() => {
        if (!cancelled) {
          setBusyIntervals([]);
          setBusyGoogleConnected(false);
        }
      })
      .finally(() => {
        if (!cancelled) setBusyLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date, settings, timezone]);

  // Which dropdown slots overlap a busy interval? Compared as (start, end+30min)
  // per slot against the busy list.
  const busySlots = useMemo(() => {
    if (!date || busyIntervals.length === 0) return new Set<string>();
    const out = new Set<string>();
    for (const slot of ["00:00"]) void slot; // placate TS no-unused
    for (let h = 0; h < 24; h++) {
      for (const mm of [0, 30]) {
        // Resolve the slot's wall-clock time in the SELECTED zone (not the
        // browser's) so the overlap check lines up with the absolute busy
        // intervals returned by Google.
        const slotStart = zonedWallTimeToUtc(`${date}T${pad2(h)}:${pad2(mm)}`, timezone).getTime();
        const slotEnd = slotStart + 30 * 60_000;
        for (const b of busyIntervals) {
          const bs = new Date(b.start).getTime();
          const be = new Date(b.end).getTime();
          if (slotStart < be && slotEnd > bs) {
            out.add(`${pad2(h)}:${pad2(mm)}`);
            break;
          }
        }
      }
    }
    return out;
  }, [date, busyIntervals, timezone]);

  // If the currently-picked time just became busy, clear it so the user re-picks.
  useEffect(() => {
    if (time && busySlots.has(time)) setTime("");
  }, [busySlots, time]);

  // Normalised preferred slot — emitted as a single-element ISO array on the
  // wire (API still accepts the legacy preferredTimes[] shape).
  const preferredIsoSlots = useMemo(() => {
    if (!date || !time) return [];
    // Resolve the picked wall-clock time in the SELECTED IANA zone (not the
    // browser's), so the booked instant matches what the customer chose
    // regardless of where they're browsing from.
    const instant = zonedWallTimeToUtc(`${date}T${time}`, timezone);
    if (Number.isNaN(instant.getTime())) return [];
    return [instant.toISOString()];
  }, [date, time, timezone]);

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
      loadBalance();
    } catch (err) {
      console.error("[CustomerConsultationPage] submit error", err);
      setFormError("Unexpected error while submitting.");
    } finally {
      setSubmitting(false);
    }
  };

  const now = Date.now();
  const upcomingCount = rows.filter((c) => isUpcoming(c, now)).length;
  const historyTerms = historyQuery.toLowerCase().split(/\s+/).filter(Boolean);
  const visibleRows = rows.filter((c) => {
    if (historyTab === "upcoming" && !isUpcoming(c, now)) return false;
    if (historyStatus && c.status !== historyStatus) return false;
    const text = `${c.description} ${STATUS_LABEL[c.status]}`.toLowerCase();
    return historyTerms.every((t) => text.includes(t));
  });
  const historyPageCount = Math.max(1, Math.ceil(visibleRows.length / HISTORY_PAGE_SIZE));
  // A reload can shrink the list under the current page.
  const safeHistoryPage = Math.min(historyPage, historyPageCount);
  const pageRows = visibleRows.slice(
    (safeHistoryPage - 1) * HISTORY_PAGE_SIZE,
    safeHistoryPage * HISTORY_PAGE_SIZE,
  );

  const history = (
    <Card padding="sm" className="min-w-0 sm:p-6">
      <CardTitle>Your consultations</CardTitle>

      {loading ? (
        <div aria-busy="true" aria-label="Loading consultations" className="mt-4 space-y-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      ) : error ? (
        <div className="mt-4">
          <Callout tone="error" title={error} />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No consultations yet"
          description="Requests you submit will show up here with their current status."
        />
      ) : (
        <div className="mt-3">
          <Tabs
            label="Consultation list"
            idPrefix={HISTORY_TABS}
            tabs={[
              { value: "upcoming" as const, label: `Upcoming (${upcomingCount})` },
              { value: "all" as const, label: `All (${rows.length})` },
            ]}
            value={historyTab}
            onChange={(tab) => {
              setHistoryTab(tab);
              setHistoryPage(1);
            }}
          />
          <TabPanel idPrefix={HISTORY_TABS} value={historyTab}>
            <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
              <SearchInput
                value={historyQuery}
                onChange={(v) => {
                  setHistoryQuery(v);
                  setHistoryPage(1);
                }}
                label="Search consultations"
                placeholder="Search consultations"
              />
              <Select
                aria-label="Filter by status"
                value={historyStatus}
                onChange={(e) => {
                  setHistoryStatus(e.target.value as ConsultationStatus | "");
                  setHistoryPage(1);
                }}
                className={SELECT_THEME}
              >
                <option value="">All statuses</option>
                {(Object.keys(STATUS_LABEL) as ConsultationStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </Select>
            </div>

            {visibleRows.length === 0 ? (
              <EmptyState
                title="No consultations match"
                description={
                  historyTab === "upcoming"
                    ? "Nothing is awaiting scheduling or coming up. Look under All for past requests."
                    : "Try a different word or status."
                }
              />
            ) : (
              <div className="mt-4 space-y-3">
                {pageRows.map((c) => (
                  <article key={c.id} className="rounded-xl border border-[var(--av2-border)] p-4">
                    <header className="mb-2 flex items-start justify-between gap-3">
                      <div className="flex min-w-0 gap-3">
                        <IconTile tone="lavender" size={40}>
                          <IconClock />
                        </IconTile>
                        <div className="min-w-0">
                          <Badge tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                          <p className="mt-1 text-xs text-[var(--av2-text-2)]">
                            Requested {formatDateTime(c.createdAt)}
                          </p>
                        </div>
                      </div>
                      <Badge className="shrink-0">
                        {c.tokenCost} {plural(c.tokenCost, "token", "tokens")}
                      </Badge>
                    </header>

                    <p className="line-clamp-3 text-sm break-words text-[var(--av2-text-2)]">
                      {c.description}
                    </p>

                    {c.status === "PENDING" && c.preferredTimes && c.preferredTimes.length > 0 && (
                      <div className="mt-3 rounded-lg bg-[var(--av2-bg)] p-3 text-sm">
                        <p className="text-xs text-[var(--av2-text-2)]">You offered</p>
                        <ul className="mt-1 space-y-0.5">
                          {c.preferredTimes.map((t, i) => (
                            <li key={i}>{formatPreferred(t, c.timezone)}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {c.status === "SCHEDULED" && (
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[var(--av2-bg)] p-3">
                        <div>
                          <p className="text-xs text-[var(--av2-text-2)]">Scheduled for</p>
                          <p className="mt-0.5 text-sm font-semibold">
                            {formatDateTime(c.scheduledAt)}
                          </p>
                        </div>
                        {c.videoLink && (
                          <a
                            href={c.videoLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={buttonClass("secondary")}
                          >
                            Join call
                            <IconArrowUpRight aria-hidden />
                          </a>
                        )}
                      </div>
                    )}
                  </article>
                ))}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-sm text-[var(--av2-text-2)]">
                  <p role="status">
                    Showing {pageRows.length} of {visibleRows.length}
                  </p>
                  <ListPager
                    label="Consultation pages"
                    page={safeHistoryPage}
                    pageCount={historyPageCount}
                    onPage={setHistoryPage}
                  />
                </div>
              </div>
            )}
          </TabPanel>
        </div>
      )}
    </Card>
  );

  return (
    <>
      <PageHeader
        title="Book a call with our team"
        description={
          <>
            Get a {settings?.durationMinutes ?? 30}-minute video consultation with the brandbite
            team. Pick what you want to discuss and a time that works — we&apos;ll confirm one by
            email with a video link
            {settings?.contactEmail ? ` from ${settings.contactEmail}` : ""}.
          </>
        }
        actions={
          balance !== null ? (
            <Card padding="sm" as="div" className="flex items-center gap-3 px-4 py-2.5">
              <IconCoins className="text-[var(--av2-link)]" />
              <span className="text-sm text-[var(--av2-text-2)]">Balance</span>
              <span className="text-base font-bold tabular-nums">
                {fmt(balance)} {plural(balance, "token", "tokens")}
              </span>
            </Card>
          ) : null
        }
      />

      {/* Access gate */}
      {featureDisabled && (
        <div className="mb-6">
          <Callout tone="warning" title="Consultation bookings are paused">
            Consultation bookings are paused right now. Please check back later.
          </Callout>
        </div>
      )}

      {!featureDisabled && !companyRoleLoading && !canBook && (
        <div className="mb-6">
          <Callout tone="info">
            Consultations are available to company <strong>Owners</strong> and <strong>PM</strong>{" "}
            members. Ask a teammate with one of those roles to book on your behalf.
          </Callout>
        </div>
      )}

      <div className={`grid items-start gap-6 ${canBook ? "xl:grid-cols-2" : ""}`}>
        {/* Form (only if user has permission) */}
        {canBook && (
          <Card padding="sm" className="min-w-0 sm:p-6">
            <CardTitle
              action={
                loading ? null : (
                  <Badge className="shrink-0">
                    {tokenCost} {plural(tokenCost, "token", "tokens")}
                  </Badge>
                )
              }
            >
              New consultation request
            </CardTitle>

            <form onSubmit={handleSubmit} className="mt-5 space-y-5">
              {/* Topic presets */}
              <div>
                <p className="mb-1.5 text-sm font-medium">Quick start (optional)</p>
                <div className="flex flex-wrap gap-2">
                  {TOPIC_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => applyPreset(p.text)}
                      className="inline-flex h-10 items-center rounded-full border border-[var(--av2-border)] bg-[var(--av2-surface)] px-4 text-sm font-medium transition-colors hover:bg-[var(--av2-bg)] focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none"
                    >
                      + {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <Field
                htmlFor="consultation-description"
                label={
                  <>
                    What do you want to discuss?{" "}
                    <span className="text-[var(--av2-error-text)]">*</span>
                  </>
                }
                hint={
                  charCount < DESCRIPTION_MIN
                    ? `${DESCRIPTION_MIN - charCount} more characters needed`
                    : `${charCount} / ${DESCRIPTION_MAX} characters`
                }
              >
                <TextArea
                  id="consultation-description"
                  placeholder="e.g. We want to refresh our brand identity across web + packaging before a product launch."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  maxLength={DESCRIPTION_MAX}
                  required
                />
              </Field>

              {/* Preferred date + time */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-x-2">
                  <p className="text-sm font-medium">Preferred date &amp; time</p>
                  <div className="flex items-center">
                    <Button variant="ghost" onClick={suggestSlot}>
                      Suggest a time
                    </Button>
                    {(date || time) && (
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setDate("");
                          setTime("");
                        }}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
                <p className="mb-2 text-xs text-[var(--av2-text-2)]">
                  Pick a date and a 30-minute slot. The admin will confirm or propose a different
                  slot by email.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextInput
                    type="date"
                    aria-label="Preferred date"
                    value={date}
                    min={minDate}
                    max={maxDate}
                    onChange={(e) => {
                      setDate(e.target.value);
                      // Reset time if it's no longer valid for the new date's
                      // same-day min-notice filter.
                      setTime("");
                    }}
                    className={SELECT_THEME}
                  />
                  <Select
                    aria-label="Preferred time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    disabled={!date || timeOptions.length === 0}
                    className={SELECT_THEME}
                  >
                    <option value="">
                      {date
                        ? timeOptions.length === 0
                          ? "No slots available on this day"
                          : "Select a time..."
                        : "Pick a date first"}
                    </option>
                    {timeOptions.map((t) => {
                      const busy = busySlots.has(t);
                      return (
                        <option key={t} value={t} disabled={busy}>
                          {formatTimeLabel(t)}
                          {busy ? " — busy" : ""}
                        </option>
                      );
                    })}
                  </Select>
                </div>
                {date && time && (
                  <p className="mt-2 text-sm">
                    <span aria-hidden>→ </span>
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
                  <div className="mt-2">
                    <Badge tone="amber">{slotWarning}</Badge>
                  </div>
                )}
                {date && busyLoading && (
                  <p className="mt-2 text-xs text-[var(--av2-text-2)]">
                    Checking team availability…
                  </p>
                )}
                {date && !busyLoading && busyGoogleConnected && busySlots.size > 0 && (
                  <p className="mt-2 text-xs text-[var(--av2-text-2)]">
                    {busySlots.size} slot{busySlots.size === 1 ? "" : "s"} are already booked and
                    greyed out.
                  </p>
                )}
                <p className="mt-2 text-xs text-[var(--av2-text-2)]">
                  {settings ? (
                    <>
                      Team is available{" "}
                      {settings.workingDays
                        .map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d])
                        .join(", ")}{" "}
                      from {settings.workingHourStart}:00 to {settings.workingHourEnd}:00
                      {settings.companyTimezone ? ` ${settings.companyTimezone}` : ""}. Times snap
                      to 30-minute increments.
                    </>
                  ) : (
                    "Times snap to 30-minute increments."
                  )}
                </p>
              </div>

              {/* Timezone */}
              <Field
                htmlFor="consultation-timezone"
                label="Timezone"
                hint={
                  <>
                    We detected {detectTimezone().replace(/_/g, " ")} (
                    {tzShortLabel(detectTimezone())}). Change it if you&apos;d like to discuss slots
                    in a different zone.
                  </>
                }
              >
                <Select
                  id="consultation-timezone"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className={SELECT_THEME}
                >
                  {timezoneOptions.map((g) => (
                    <optgroup key={g.label} label={g.label}>
                      {g.zones.map((z) => (
                        <option key={z} value={z}>
                          {z.replace(/_/g, " ")} — {tzShortLabel(z)}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </Select>
              </Field>

              {formError && <Callout tone="error" title={formError} />}
              {successMessage && <Callout tone="success" title={successMessage} />}

              <Button
                type="submit"
                variant="primary"
                disabled={submitting || !charOk || !canBook}
                aria-busy={submitting}
              >
                {submitting
                  ? "Submitting..."
                  : loading
                    ? "Submit request"
                    : `Submit request — ${tokenCost} ${plural(tokenCost, "token", "tokens")}`}
              </Button>
            </form>
          </Card>
        )}

        {/* History */}
        {history}
      </div>

      <InsufficientTokensModal info={tokenError} onClose={() => setTokenError(null)} />
    </>
  );
}
