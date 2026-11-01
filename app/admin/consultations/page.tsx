// -----------------------------------------------------------------------------
// @file: app/admin/consultations/page.tsx
// @purpose: Admin queue for consultations. Requests list on the left, detail
//           panel of the selected request on the right. Pending requests are
//           scheduled from the panel (datetime + video link paste). Cancel
//           refunds tokens to the company.
// @version: v2.0.0
// @lastUpdate: 2026-11-01
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Badge,
  Button,
  ButtonLink,
  Callout,
  Card,
  DASH,
  DetailPanel,
  EmptyState,
  Field,
  FilterChips,
  PageHeader,
  PanelSection,
  SearchInput,
  Skeleton,
  Table,
  TableFooter,
  TabPanel,
  Tabs,
  Td,
  TextArea,
  TextInput,
  TextLink,
  Th,
  Tr,
  SplitView,
  fmt,
  plural,
  type Tone,
} from "@/components/admin/v2/ui";
import { IconClock } from "@/components/admin/v2/icons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { IconConsultations, IconSettings } from "@/components/navigation/nav-icons";

type ConsultationStatus = "PENDING" | "SCHEDULED" | "COMPLETED" | "CANCELED";

type AdminConsultation = {
  id: string;
  description: string;
  preferredTimes: string[] | null;
  timezone: string | null;
  scheduledAt: string | null;
  videoLink: string | null;
  adminNotes: string | null;
  tokenCost: number;
  status: ConsultationStatus;
  createdAt: string;
  updatedAt: string;
  company: { id: string; name: string; slug: string };
  requestedBy: { id: string; name: string | null; email: string };
};

const STATUS_META: Record<ConsultationStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "Pending", tone: "amber" },
  SCHEDULED: { label: "Scheduled", tone: "lavender" },
  COMPLETED: { label: "Completed", tone: "green" },
  CANCELED: { label: "Canceled", tone: "neutral" },
};

const STATUS_FILTERS: { value: "ALL" | ConsultationStatus; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELED", label: "Canceled" },
];

function formatDateTime(iso: string | null): string {
  if (!iso) return DASH;
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** Short offset label like "GMT+3" for an IANA zone at "now". */
function tzShortLabel(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat(undefined, {
      timeZone: tz,
      timeZoneName: "shortOffset",
    }).formatToParts(new Date());
    return parts.find((p) => p.type === "timeZoneName")?.value ?? tz;
  } catch {
    return tz;
  }
}

/** Was this preferred-time entry submitted as an ISO datetime? */
function isIsoSlot(raw: string): boolean {
  return raw.includes("T") && !Number.isNaN(Date.parse(raw));
}

/** Pretty-print a preferred slot. ISO → local formatted + zone hint. */
function formatPreferredSlot(raw: string, requesterTz: string | null): string {
  if (!isIsoSlot(raw)) return raw;
  const d = new Date(raw);
  const inRequesterTz = requesterTz
    ? d.toLocaleString(undefined, {
        timeZone: requesterTz,
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : d.toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
  const tzHint = requesterTz ? ` (${tzShortLabel(requesterTz)})` : "";
  return `${inRequesterTz}${tzHint}`;
}

/** Turn an ISO into the "YYYY-MM-DDTHH:mm" datetime-local admin-side uses. */
function isoToDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

/** Host name of a pasted meeting link, for a neutral label ("zoom.us"). */
function linkHost(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function IconChevronRight() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

type DetailTab = "request" | "schedule";

export default function AdminConsultationsPage() {
  const [rows, setRows] = useState<AdminConsultation[]>([]);
  const [statusFilter, setStatusFilter] = useState<"ALL" | ConsultationStatus>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<DetailTab>("request");
  // Browser zone — every date on this page renders in it. Read after mount
  // so the server render and the first client render agree.
  const [viewerTz, setViewerTz] = useState<string | null>(null);
  useEffect(() => {
    try {
      setViewerTz(Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch {
      setViewerTz(null);
    }
  }, []);

  // Inline-schedule state, keyed by consultation id
  type ScheduleDraft = { scheduledAt: string; videoLink: string; adminNotes: string };
  const [drafts, setDrafts] = useState<Record<string, ScheduleDraft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url =
        statusFilter === "ALL"
          ? "/api/admin/consultations"
          : `/api/admin/consultations?status=${statusFilter}`;
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) throw new Error((json && json.error) || "Failed to load");
      setRows(json.consultations as AdminConsultation[]);
    } catch (err) {
      console.error("[AdminConsultationsPage] load error", err);
      setError(err instanceof Error ? err.message : "Failed to load consultations.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  // Counts come from the rows we have. The list is fetched per status, so a
  // filtered view only knows its own count — other chips show no number
  // rather than a misleading 0.
  const counts = useMemo(() => {
    const acc: Record<ConsultationStatus | "ALL", number> = {
      ALL: rows.length,
      PENDING: 0,
      SCHEDULED: 0,
      COMPLETED: 0,
      CANCELED: 0,
    };
    for (const r of rows) acc[r.status] += 1;
    return acc;
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((c) =>
      [c.company.name, c.company.slug, c.requestedBy.name ?? "", c.requestedBy.email].some((v) =>
        v.toLowerCase().includes(q),
      ),
    );
  }, [rows, query]);

  const selected = rows.find((r) => r.id === selectedId) ?? null;

  const selectRow = (id: string) => {
    if (id !== selectedId) setTab(drafts[id] ? "schedule" : "request");
    setSelectedId(id);
  };

  const startSchedule = (c: AdminConsultation) => {
    setDrafts((prev) => ({
      ...prev,
      [c.id]: {
        // datetime-local needs "YYYY-MM-DDTHH:mm"; an ISO with "Z" would not
        // render in the input.
        scheduledAt: c.scheduledAt ? isoToDatetimeLocal(c.scheduledAt) : "",
        videoLink: c.videoLink ?? "",
        adminNotes: c.adminNotes ?? "",
      },
    }));
    setTab("schedule");
  };

  // Cancelling refunds the booking tokens to the company — confirm first.
  const [cancelTarget, setCancelTarget] = useState<AdminConsultation | null>(null);

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    await submitUpdate(cancelTarget.id, { status: "CANCELED" });
    setCancelTarget(null);
  };

  const cancelSchedule = (id: string) => {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const submitUpdate = async (id: string, patch: Record<string, unknown>) => {
    setSavingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/consultations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error((json && json.error) || "Failed to update");
      cancelSchedule(id);
      setTab("request");
      await load();
    } catch (err) {
      console.error("[AdminConsultationsPage] update error", err);
      setError(err instanceof Error ? err.message : "Failed to update consultation.");
    } finally {
      setSavingId(null);
    }
  };

  const handleConfirmSchedule = async (id: string) => {
    const draft = drafts[id];
    if (!draft) return;
    if (!draft.scheduledAt || !draft.videoLink) {
      setError("Pick a scheduled time and paste a video link before confirming.");
      return;
    }
    // Normalise datetime-local → ISO
    const scheduledAtISO = new Date(draft.scheduledAt).toISOString();
    await submitUpdate(id, {
      status: "SCHEDULED",
      scheduledAt: scheduledAtISO,
      videoLink: draft.videoLink.trim(),
      adminNotes: draft.adminNotes.trim() || undefined,
    });
  };

  const setDraftField = (id: string, field: keyof ScheduleDraft, value: string) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));

  const errorCallout = error ? (
    <Callout tone="error" title="Something went wrong">
      {error}
    </Callout>
  ) : null;

  // ---------------------------------------------------------------------------
  // Detail panel
  // ---------------------------------------------------------------------------

  const renderPanel = (c: AdminConsultation) => {
    const draft = drafts[c.id];
    const isScheduling = Boolean(draft);
    const saving = savingId === c.id;
    const canSchedule = c.status === "PENDING" || c.status === "SCHEDULED";
    const meta = STATUS_META[c.status];
    const idPrefix = `consultation-${c.id}`;

    return (
      <DetailPanel
        title="Consultation details"
        onClose={() => setSelectedId(null)}
        closeLabel="Close consultation details"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xl leading-7 font-semibold">{c.company.name}</p>
            <p className="mt-0.5 text-sm break-words text-[var(--av2-text-2)]">
              {c.requestedBy.name ? `${c.requestedBy.name} · ` : ""}
              {c.requestedBy.email}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <Badge tone={meta.tone}>{meta.label}</Badge>
            <span className="text-xs text-[var(--av2-text-2)] tabular-nums">
              {fmt(c.tokenCost)} {plural(c.tokenCost, "token", "tokens")}
            </span>
          </div>
        </div>

        <div className="mt-5">
          <Tabs
            label="Consultation sections"
            idPrefix={idPrefix}
            value={tab}
            onChange={setTab}
            tabs={[
              { value: "request", label: "Request" },
              { value: "schedule", label: isScheduling ? "Schedule · editing" : "Schedule" },
            ]}
          />
        </div>

        {error && <div className="mt-5">{errorCallout}</div>}

        {tab === "request" ? (
          <TabPanel idPrefix={idPrefix} value="request">
            <div className="mt-5">
              <PanelSection title="Request">
                <p className="text-sm whitespace-pre-wrap">{c.description}</p>
                <p className="mt-2 text-xs text-[var(--av2-text-2)]">
                  Requested {formatDateTime(c.createdAt)} · {c.company.slug}
                </p>
              </PanelSection>

              {c.scheduledAt && (
                <PanelSection>
                  <div className="rounded-xl bg-[var(--av2-lavender-bg)] p-4">
                    <div className="flex gap-4">
                      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--av2-surface)] text-[var(--av2-fill-lavender)]">
                        <IconConsultations width={22} height={22} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">Scheduled session</p>
                        <p className="text-xl leading-7 font-bold">{formatDate(c.scheduledAt)}</p>
                        <p className="text-sm">{formatTime(c.scheduledAt)}</p>
                        {viewerTz && (
                          <p className="text-xs text-[var(--av2-text-2)]">
                            {viewerTz} · {tzShortLabel(viewerTz)}
                          </p>
                        )}
                      </div>
                    </div>
                    {c.videoLink && (
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--av2-border)] pt-3">
                        <span className="min-w-0 truncate text-sm font-medium">
                          {linkHost(c.videoLink)}
                        </span>
                        <TextLink href={c.videoLink} external>
                          Open meeting
                        </TextLink>
                      </div>
                    )}
                  </div>
                </PanelSection>
              )}

              <PanelSection
                title={
                  <span className="flex items-center gap-2">
                    <IconClock width={18} height={18} className="text-[var(--av2-text-2)]" />
                    Preferred times
                  </span>
                }
              >
                {c.preferredTimes && c.preferredTimes.length > 0 ? (
                  <ul className="space-y-2 text-sm">
                    {c.preferredTimes.map((t, i) => (
                      <li key={i} className="flex items-center justify-between gap-3">
                        <span className="tabular-nums">{formatPreferredSlot(t, c.timezone)}</span>
                        {isIsoSlot(t) && c.status === "PENDING" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-[var(--av2-link)]"
                            onClick={() => {
                              setDrafts((prev) => ({
                                ...prev,
                                [c.id]: {
                                  scheduledAt: isoToDatetimeLocal(t),
                                  videoLink: prev[c.id]?.videoLink ?? c.videoLink ?? "",
                                  adminNotes: prev[c.id]?.adminNotes ?? c.adminNotes ?? "",
                                },
                              }));
                              setTab("schedule");
                            }}
                          >
                            Use this
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-[var(--av2-text-2)]">{DASH}</p>
                )}
                {c.timezone && (
                  <p className="mt-2 text-xs text-[var(--av2-text-2)]">
                    Requester time zone: {c.timezone}
                  </p>
                )}
              </PanelSection>

              {c.adminNotes && (
                <PanelSection title="Admin notes">
                  <p className="text-sm whitespace-pre-wrap text-[var(--av2-text-2)]">
                    {c.adminNotes}
                  </p>
                </PanelSection>
              )}

              {canSchedule && !isScheduling && (
                <PanelSection>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {c.status === "PENDING" && (
                      <Button
                        variant="primary"
                        onClick={() => startSchedule(c)}
                        className="sm:col-span-2"
                      >
                        Schedule
                      </Button>
                    )}
                    {c.status === "SCHEDULED" && (
                      <>
                        <Button
                          variant="primary"
                          onClick={() => submitUpdate(c.id, { status: "COMPLETED" })}
                          disabled={saving}
                          aria-busy={saving}
                        >
                          {saving ? "Saving…" : "Mark completed"}
                        </Button>
                        <Button onClick={() => startSchedule(c)} disabled={saving}>
                          Reschedule
                        </Button>
                      </>
                    )}
                  </div>
                  <div className="mt-4">
                    <Button
                      variant="danger"
                      onClick={() => setCancelTarget(c)}
                      disabled={saving}
                      aria-busy={saving}
                    >
                      {saving
                        ? "Saving…"
                        : `Cancel & refund ${fmt(c.tokenCost)} ${plural(c.tokenCost, "token", "tokens")}`}
                    </Button>
                    <p className="mt-2 text-xs text-[var(--av2-text-2)]">
                      Cancelling returns the booking tokens to the company.
                    </p>
                  </div>
                </PanelSection>
              )}

              {canSchedule && isScheduling && (
                <PanelSection>
                  <p className="text-sm text-[var(--av2-text-2)]">
                    You have an unsaved schedule for this request.
                  </p>
                  <Button className="mt-3" onClick={() => setTab("schedule")}>
                    Continue scheduling
                  </Button>
                </PanelSection>
              )}
            </div>
          </TabPanel>
        ) : (
          <TabPanel idPrefix={idPrefix} value="schedule">
            <div className="mt-5">
              {isScheduling ? (
                <div className="space-y-4">
                  <Field
                    label="Scheduled date + time"
                    htmlFor={`${idPrefix}-when`}
                    hint={viewerTz ? `In your time zone (${viewerTz}).` : undefined}
                  >
                    <TextInput
                      id={`${idPrefix}-when`}
                      type="datetime-local"
                      value={draft.scheduledAt}
                      onChange={(e) => setDraftField(c.id, "scheduledAt", e.target.value)}
                    />
                  </Field>
                  <Field label="Video link" htmlFor={`${idPrefix}-link`}>
                    <TextInput
                      id={`${idPrefix}-link`}
                      type="url"
                      placeholder="https://meet.google.com/..."
                      value={draft.videoLink}
                      onChange={(e) => setDraftField(c.id, "videoLink", e.target.value)}
                    />
                  </Field>
                  <Field label="Internal notes (optional)" htmlFor={`${idPrefix}-notes`}>
                    <TextArea
                      id={`${idPrefix}-notes`}
                      rows={3}
                      value={draft.adminNotes}
                      onChange={(e) => setDraftField(c.id, "adminNotes", e.target.value)}
                    />
                  </Field>
                  <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--av2-border)] pt-4">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        cancelSchedule(c.id);
                        setTab("request");
                      }}
                      disabled={saving}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => handleConfirmSchedule(c.id)}
                      disabled={saving}
                      aria-busy={saving}
                    >
                      {saving ? "Saving…" : "Confirm schedule"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] gap-x-4 gap-y-3 text-sm">
                    <dt className="text-[var(--av2-text-2)]">Scheduled</dt>
                    <dd className="font-medium">{formatDateTime(c.scheduledAt)}</dd>
                    <dt className="text-[var(--av2-text-2)]">Video link</dt>
                    <dd className="min-w-0 font-medium break-all">
                      {c.videoLink ? (
                        <a
                          href={c.videoLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--av2-link)] hover:underline"
                        >
                          {c.videoLink}
                        </a>
                      ) : (
                        DASH
                      )}
                    </dd>
                  </dl>
                  {canSchedule ? (
                    <Button
                      variant={c.status === "PENDING" ? "primary" : "secondary"}
                      className="mt-5"
                      onClick={() => startSchedule(c)}
                      disabled={saving}
                    >
                      {c.status === "PENDING" ? "Schedule" : "Reschedule"}
                    </Button>
                  ) : (
                    <p className="mt-5 text-sm text-[var(--av2-text-2)]">
                      This consultation is {meta.label.toLowerCase()}; scheduling is closed.
                    </p>
                  )}
                </div>
              )}
            </div>
          </TabPanel>
        )}
      </DetailPanel>
    );
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const activeFilterLabel = STATUS_FILTERS.find((f) => f.value === statusFilter)?.label ?? "";

  return (
    <div>
      <PageHeader
        title="Consultations"
        description="Review requests, manage schedules and follow up."
        actions={
          <>
            {viewerTz && (
              <span className="mr-2 inline-flex items-center gap-2 text-sm text-[var(--av2-text-2)]">
                <IconClock width={18} height={18} />
                Times shown in {viewerTz} · {tzShortLabel(viewerTz)}
              </span>
            )}
            <ButtonLink href="/admin/consultations/settings">
              <IconSettings width={18} height={18} />
              Settings
            </ButtonLink>
          </>
        }
      />

      <div className="mb-6">
        <FilterChips
          label="Filter by status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={STATUS_FILTERS.map((f) => ({
            value: f.value,
            label: f.label,
            count:
              loading && rows.length === 0
                ? null
                : statusFilter === "ALL" || f.value === statusFilter
                  ? counts[f.value]
                  : null,
          }))}
        />
      </div>

      {error && !selected && <div className="mb-6">{errorCallout}</div>}

      <SplitView panel={selected ? renderPanel(selected) : undefined}>
        <Card padding="none">
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 pt-5 pb-4">
            <h2 className="text-xl leading-7 font-semibold">Requests</h2>
            <SearchInput
              className="w-full sm:w-80"
              value={query}
              onChange={setQuery}
              placeholder="Search company or requester"
              label="Search consultations by company or requester"
            />
          </div>

          {loading && rows.length === 0 ? (
            <div className="space-y-3 border-t border-[var(--av2-border)] px-6 py-5" role="status">
              <span className="sr-only">Loading consultations…</span>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="border-t border-[var(--av2-border)]">
              {statusFilter === "ALL" ? (
                <EmptyState
                  icon={<IconConsultations width={28} height={28} />}
                  title="No consultation requests yet"
                  description="Requests from company owners and project managers show up here, pending ones first."
                />
              ) : (
                <EmptyState
                  title={`No ${activeFilterLabel.toLowerCase()} consultations`}
                  description="Nothing has this status right now."
                  action={<Button onClick={() => setStatusFilter("ALL")}>Show all</Button>}
                />
              )}
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="border-t border-[var(--av2-border)]">
              <EmptyState
                title="No requests match your search"
                description="Try a different company name, requester name or email."
                action={<Button onClick={() => setQuery("")}>Clear search</Button>}
              />
            </div>
          ) : (
            <Table label="Consultation requests">
              <thead>
                <tr>
                  <Th>Company</Th>
                  <Th>Requested</Th>
                  <Th>Scheduled</Th>
                  <Th>Status</Th>
                  <Th align="right">
                    <span className="sr-only">Open</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((c) => {
                  const meta = STATUS_META[c.status];
                  return (
                    <Tr
                      key={c.id}
                      selected={c.id === selectedId}
                      onSelect={() => selectRow(c.id)}
                      label={`${c.company.name}, ${meta.label}, requested ${formatDateTime(c.createdAt)}`}
                    >
                      <Td>
                        <div className="font-semibold">{c.company.name}</div>
                        <div className="text-xs text-[var(--av2-text-2)]">
                          {c.requestedBy.name ?? c.requestedBy.email}
                        </div>
                      </Td>
                      <Td className="whitespace-nowrap tabular-nums">
                        <div>{formatDate(c.createdAt)}</div>
                        <div className="text-xs text-[var(--av2-text-2)]">
                          {formatTime(c.createdAt)}
                        </div>
                      </Td>
                      <Td className="whitespace-nowrap tabular-nums">
                        {c.scheduledAt ? (
                          <>
                            <div>{formatDate(c.scheduledAt)}</div>
                            <div className="text-xs text-[var(--av2-text-2)]">
                              {formatTime(c.scheduledAt)}
                            </div>
                          </>
                        ) : (
                          <span className="text-[var(--av2-text-2)]">{DASH}</span>
                        )}
                      </Td>
                      <Td>
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                        {drafts[c.id] && (
                          <div className="mt-1 text-xs text-[var(--av2-text-2)]">
                            Draft schedule
                          </div>
                        )}
                      </Td>
                      <Td align="right" className="text-[var(--av2-text-2)]">
                        <span className="inline-flex">
                          <IconChevronRight />
                        </span>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          )}

          {rows.length > 0 && (
            <TableFooter>
              <span className="tabular-nums">
                Showing {fmt(filteredRows.length)} of {fmt(rows.length)}{" "}
                {plural(rows.length, "request", "requests")}
              </span>
            </TableFooter>
          )}
        </Card>

        {!selected && rows.length > 0 && (
          <p className="mt-6 text-sm text-[var(--av2-text-2)]">
            Select a request to review it, schedule it or follow up.
          </p>
        )}
      </SplitView>

      <ConfirmDialog
        open={cancelTarget !== null}
        onClose={() => savingId === null && setCancelTarget(null)}
        onConfirm={confirmCancel}
        loading={cancelTarget !== null && savingId === cancelTarget.id}
        variant="danger"
        title="Cancel this consultation?"
        description={
          cancelTarget
            ? `${cancelTarget.company.name}'s booking will be cancelled and ${fmt(cancelTarget.tokenCost)} ${plural(cancelTarget.tokenCost, "token", "tokens")} refunded to the company. This can't be undone.`
            : undefined
        }
        confirmLabel="Cancel & refund"
        cancelLabel="Keep booking"
      />
    </div>
  );
}
