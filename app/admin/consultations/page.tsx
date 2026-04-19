// -----------------------------------------------------------------------------
// @file: app/admin/consultations/page.tsx
// @purpose: Admin queue for consultations. Pending requests are reviewed and
//           scheduled inline (datetime + video link paste). Cancel refunds
//           tokens to the company.
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FormInput, FormTextarea } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { LoadingState } from "@/components/ui/loading-state";

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

const STATUS_LABEL: Record<ConsultationStatus, string> = {
  PENDING: "Pending",
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

const STATUS_FILTERS: { value: "ALL" | ConsultationStatus; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELED", label: "Canceled" },
];

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
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

export default function AdminConsultationsPage() {
  const [rows, setRows] = useState<AdminConsultation[]>([]);
  const [statusFilter, setStatusFilter] = useState<"ALL" | ConsultationStatus>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const startSchedule = (c: AdminConsultation) => {
    setDrafts((prev) => ({
      ...prev,
      [c.id]: {
        scheduledAt: c.scheduledAt ?? "",
        videoLink: c.videoLink ?? "",
        adminNotes: c.adminNotes ?? "",
      },
    }));
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

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-brand text-2xl font-bold tracking-tight text-[var(--bb-secondary)]">
            Consultations
          </h1>
          <p className="mt-1 text-sm text-[var(--bb-text-secondary)]">
            Requests from company OWNER / PM members. Schedule, paste a Google Meet / Zoom link,
            mark completed, or cancel and refund tokens.
          </p>
        </div>
        <a
          href="/admin/consultations/settings"
          className="shrink-0 rounded-full border border-[var(--bb-border)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--bb-secondary)] hover:border-[var(--bb-primary)] hover:text-[var(--bb-primary)]"
        >
          Settings
        </a>
      </header>

      {/* Filter bar */}
      <div className="mb-4 flex items-center gap-2">
        {STATUS_FILTERS.map((f) => {
          const active = statusFilter === f.value;
          const count = counts[f.value];
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatusFilter(f.value)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                active
                  ? "border-[var(--bb-secondary)] bg-[var(--bb-secondary)] text-white"
                  : "border-[var(--bb-border)] text-[var(--bb-text-secondary)] hover:text-[var(--bb-secondary)]"
              }`}
            >
              {f.label} · {count}
            </button>
          );
        })}
      </div>

      {loading && <LoadingState />}
      {error && (
        <InlineAlert variant="error" className="mb-4">
          {error}
        </InlineAlert>
      )}

      {!loading && rows.length === 0 && (
        <EmptyState
          title="Nothing here"
          description="No consultations in this view. Pending requests show up first."
        />
      )}

      {rows.length > 0 && (
        <div className="space-y-3">
          {rows.map((c) => {
            const draft = drafts[c.id];
            const isScheduling = Boolean(draft);
            return (
              <article
                key={c.id}
                className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] p-5"
              >
                <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Badge variant={STATUS_VARIANT[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                    <h2 className="mt-2 text-sm font-semibold text-[var(--bb-secondary)]">
                      {c.company.name}
                      <span className="ml-2 text-xs font-normal text-[var(--bb-text-muted)]">
                        ({c.company.slug})
                      </span>
                    </h2>
                    <p className="mt-0.5 text-xs text-[var(--bb-text-muted)]">
                      {c.requestedBy.name ?? c.requestedBy.email} · {c.requestedBy.email}
                    </p>
                  </div>
                  <div className="text-right text-xs text-[var(--bb-text-muted)]">
                    <p>Requested {formatDateTime(c.createdAt)}</p>
                    <p className="mt-0.5">{c.tokenCost} tokens</p>
                  </div>
                </header>

                <p className="mb-3 text-sm whitespace-pre-wrap text-[var(--bb-text-secondary)]">
                  {c.description}
                </p>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-[11px] font-semibold tracking-[0.15em] text-[var(--bb-text-tertiary)] uppercase">
                      Preferred times
                    </p>
                    {c.preferredTimes && c.preferredTimes.length > 0 ? (
                      <ul className="mt-1 space-y-1 text-xs text-[var(--bb-secondary)]">
                        {c.preferredTimes.map((t, i) => (
                          <li key={i} className="flex items-center justify-between gap-2">
                            <span>· {formatPreferredSlot(t, c.timezone)}</span>
                            {isIsoSlot(t) && c.status === "PENDING" && (
                              <button
                                type="button"
                                onClick={() => {
                                  setDrafts((prev) => ({
                                    ...prev,
                                    [c.id]: {
                                      scheduledAt: isoToDatetimeLocal(t),
                                      videoLink: prev[c.id]?.videoLink ?? c.videoLink ?? "",
                                      adminNotes: prev[c.id]?.adminNotes ?? c.adminNotes ?? "",
                                    },
                                  }));
                                }}
                                className="shrink-0 rounded-full border border-[var(--bb-border)] bg-white px-2 py-0.5 text-[10px] font-medium text-[var(--bb-primary)] hover:border-[var(--bb-primary)]"
                              >
                                Use this
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-xs text-[var(--bb-text-muted)]">—</p>
                    )}
                    {c.timezone && (
                      <p className="mt-1 text-[11px] text-[var(--bb-text-muted)]">
                        tz: {c.timezone}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold tracking-[0.15em] text-[var(--bb-text-tertiary)] uppercase">
                      Scheduled
                    </p>
                    <p className="mt-1 text-xs text-[var(--bb-secondary)]">
                      {formatDateTime(c.scheduledAt)}
                    </p>
                    {c.videoLink && (
                      <a
                        href={c.videoLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 block text-xs break-all text-[var(--bb-primary)] hover:underline"
                      >
                        {c.videoLink}
                      </a>
                    )}
                  </div>
                </div>

                {/* Inline schedule form */}
                {isScheduling && (
                  <div className="mt-4 space-y-3 rounded-xl border border-[var(--bb-border-subtle)] bg-white p-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-[11px] font-semibold tracking-[0.15em] text-[var(--bb-text-tertiary)] uppercase">
                          Scheduled date + time
                        </label>
                        <input
                          type="datetime-local"
                          value={draft.scheduledAt}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [c.id]: { ...prev[c.id], scheduledAt: e.target.value },
                            }))
                          }
                          className="w-full rounded-md border border-[var(--bb-border-input)] bg-white px-3 py-1.5 text-sm text-[var(--bb-secondary)] focus:border-[var(--bb-primary)] focus:ring-1 focus:ring-[var(--bb-primary)] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-semibold tracking-[0.15em] text-[var(--bb-text-tertiary)] uppercase">
                          Video link
                        </label>
                        <FormInput
                          placeholder="https://meet.google.com/..."
                          value={draft.videoLink}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [c.id]: { ...prev[c.id], videoLink: e.target.value },
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold tracking-[0.15em] text-[var(--bb-text-tertiary)] uppercase">
                        Internal notes (optional)
                      </label>
                      <FormTextarea
                        rows={2}
                        value={draft.adminNotes}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [c.id]: { ...prev[c.id], adminNotes: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => cancelSchedule(c.id)}
                        disabled={savingId === c.id}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleConfirmSchedule(c.id)}
                        loading={savingId === c.id}
                        loadingText="Saving..."
                      >
                        Confirm schedule
                      </Button>
                    </div>
                  </div>
                )}

                {/* Actions */}
                {!isScheduling && (
                  <footer className="mt-4 flex flex-wrap items-center gap-2">
                    {c.status === "PENDING" && (
                      <Button size="sm" onClick={() => startSchedule(c)}>
                        Schedule
                      </Button>
                    )}
                    {c.status === "SCHEDULED" && (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => startSchedule(c)}
                          disabled={savingId === c.id}
                        >
                          Reschedule
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => submitUpdate(c.id, { status: "COMPLETED" })}
                          loading={savingId === c.id}
                          loadingText="Saving..."
                        >
                          Mark completed
                        </Button>
                      </>
                    )}
                    {(c.status === "PENDING" || c.status === "SCHEDULED") && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => submitUpdate(c.id, { status: "CANCELED" })}
                        loading={savingId === c.id}
                        loadingText="Saving..."
                      >
                        Cancel &amp; refund tokens
                      </Button>
                    )}
                  </footer>
                )}

                {c.adminNotes && !isScheduling && (
                  <p className="mt-3 rounded-md bg-[var(--bb-bg-warm)] p-2 text-[11px] text-[var(--bb-text-muted)]">
                    Admin notes: {c.adminNotes}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
