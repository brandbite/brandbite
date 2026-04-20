// -----------------------------------------------------------------------------
// @file: app/admin/time-tracking/page.tsx
// @purpose: Admin time-tracking analytics — logged hours per ticket joined
//           with the job type's estimatedHours so ops can see overruns and
//           tune token pricing.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-04-20
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { InlineAlert } from "@/components/ui/inline-alert";
import { LoadingState } from "@/components/ui/loading-state";
import { FormInput } from "@/components/ui/form-field";

type Row = {
  ticketId: string;
  code: string;
  title: string;
  status: string;
  creative: { id: string; name: string | null; email: string } | null;
  company: { id: string; name: string } | null;
  jobType: {
    id: string;
    name: string;
    estimatedHours: number | null;
    tokenCost: number;
  } | null;
  loggedSeconds: number;
  loggedHours: number;
  estimatedHours: number | null;
  estimateRatio: number | null;
  entryCount: number;
  hasRunningEntry: boolean;
  completedAt: string | null;
};

type Response = {
  rows: Row[];
  stats: {
    ticketCount: number;
    totalLoggedHours: number;
    totalEstimatedHours: number;
    overrunCount: number;
  };
  migrationPending?: boolean;
};

type SortKey = "logged" | "variance" | "recent";

function formatHours(hours: number): string {
  if (hours <= 0) return "0h";
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function ratioBadge(ratio: number | null): {
  label: string;
  variant: BadgeVariant;
} {
  if (ratio == null) return { label: "—", variant: "neutral" };
  const pct = Math.round(ratio * 100);
  if (pct <= 80) return { label: `${pct}% under`, variant: "success" };
  if (pct <= 110) return { label: `${pct}% on target`, variant: "info" };
  if (pct <= 150) return { label: `${pct}% over`, variant: "warning" };
  return { label: `${pct}% over`, variant: "danger" };
}

function statusBadge(status: string): BadgeVariant {
  switch (status) {
    case "DONE":
      return "success";
    case "IN_REVIEW":
      return "info";
    case "IN_PROGRESS":
      return "warning";
    default:
      return "neutral";
  }
}

export default function AdminTimeTrackingPage() {
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("logged");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/time-tracking", { cache: "no-store" });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error || "Failed to load time-tracking analytics");
          return;
        }
        setData(json as Response);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load time-tracking analytics");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const needle = search.trim().toLowerCase();
    let rows = data.rows;
    if (needle) {
      rows = rows.filter((r) => {
        const hay = [
          r.title,
          r.code,
          r.creative?.name ?? "",
          r.creative?.email ?? "",
          r.company?.name ?? "",
          r.jobType?.name ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(needle);
      });
    }
    const copy = [...rows];
    switch (sort) {
      case "variance":
        // Show overruns first — items with no estimate sink to the bottom
        copy.sort((a, b) => {
          const av = a.estimateRatio ?? -1;
          const bv = b.estimateRatio ?? -1;
          return bv - av;
        });
        break;
      case "recent":
        copy.sort((a, b) => {
          const ad = a.completedAt ? Date.parse(a.completedAt) : 0;
          const bd = b.completedAt ? Date.parse(b.completedAt) : 0;
          return bd - ad;
        });
        break;
      case "logged":
      default:
        copy.sort((a, b) => b.loggedSeconds - a.loggedSeconds);
        break;
    }
    return copy;
  }, [data, search, sort]);

  if (loading) return <LoadingState />;
  if (error) return <InlineAlert variant="error">{error}</InlineAlert>;
  if (!data) return null;

  const { stats } = data;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--bb-text-tertiary)] uppercase">
          Admin · Time tracking
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--bb-secondary)]">
          Hours vs estimate
        </h1>
        <p className="mt-1 text-sm text-[var(--bb-text-muted)]">
          Logged creative time per ticket, joined with the job type&apos;s estimated hours so you
          can spot overruns and retune token pricing.
        </p>
      </header>

      {data.migrationPending && (
        <InlineAlert variant="warning">
          <p className="text-sm font-semibold">
            Time-tracking migration is pending on this environment.
          </p>
          <p className="mt-1 text-xs">
            The <code className="rounded bg-[var(--bb-bg-warm)] px-1">TicketTimeEntry</code> table
            doesn&apos;t exist in the current database yet. Run{" "}
            <code className="rounded bg-[var(--bb-bg-warm)] px-1">npx prisma migrate deploy</code>{" "}
            against this environment, then reload. Until then creatives can&apos;t log time and this
            page will stay empty.
          </p>
        </InlineAlert>
      )}

      {/* Stats cards */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Tickets" value={String(stats.ticketCount)} />
        <StatCard label="Hours logged" value={formatHours(stats.totalLoggedHours)} />
        <StatCard label="Hours estimated" value={formatHours(stats.totalEstimatedHours)} />
        <StatCard
          label="Overrunning"
          value={String(stats.overrunCount)}
          muted={stats.overrunCount === 0}
        />
      </section>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full max-w-xs">
          <FormInput
            placeholder="Search title, creative, company…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="sm"
          />
        </div>
        <div className="flex items-center gap-1 rounded-full border border-[var(--bb-border)] bg-[var(--bb-bg-page)] p-1">
          {(
            [
              { key: "logged", label: "Most logged" },
              { key: "variance", label: "Overruns first" },
              { key: "recent", label: "Recently done" },
            ] as { key: SortKey; label: string }[]
          ).map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setSort(opt.key)}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide transition-colors ${
                sort === opt.key
                  ? "bg-[var(--bb-primary)] text-white"
                  : "text-[var(--bb-text-secondary)] hover:bg-[var(--bb-bg-warm)]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-6 py-10 text-center">
          <p className="text-sm text-[var(--bb-text-muted)]">
            {data.rows.length === 0
              ? "No time has been logged on any ticket yet."
              : "No tickets match this filter."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bb-bg-warm)] text-left text-[10px] font-semibold tracking-[0.15em] text-[var(--bb-text-tertiary)] uppercase">
              <tr>
                <th className="px-4 py-2">Ticket</th>
                <th className="px-4 py-2">Creative</th>
                <th className="px-4 py-2">Logged</th>
                <th className="px-4 py-2">Est.</th>
                <th className="px-4 py-2">Variance</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--bb-border)]">
              {filtered.map((row) => {
                const badge = ratioBadge(row.estimateRatio);
                return (
                  <tr key={row.ticketId} className="hover:bg-[var(--bb-bg-warm)]/40">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/admin/tickets?ticketId=${row.ticketId}`}
                        className="block font-semibold text-[var(--bb-secondary)] hover:text-[var(--bb-primary)]"
                      >
                        {row.title}
                      </Link>
                      <p className="text-[10px] text-[var(--bb-text-muted)]">
                        {row.code} · {row.jobType?.name ?? "—"}
                        {row.company && ` · ${row.company.name}`}
                        {row.hasRunningEntry && (
                          <span className="ml-1 inline-block rounded-full bg-[var(--bb-primary)] px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-white uppercase">
                            Running
                          </span>
                        )}
                      </p>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[var(--bb-text-secondary)]">
                      {row.creative?.name || row.creative?.email || "—"}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-[var(--bb-secondary)]">
                      {formatHours(row.loggedHours)}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-[var(--bb-text-muted)]">
                      {row.estimatedHours != null ? formatHours(row.estimatedHours) : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={statusBadge(row.status)}>{row.status}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-4 py-3 shadow-sm">
      <p className="text-[10px] font-semibold tracking-[0.18em] text-[var(--bb-text-tertiary)] uppercase">
        {label}
      </p>
      <p
        className={`mt-1 text-xl font-semibold tracking-tight ${muted ? "text-[var(--bb-text-muted)]" : "text-[var(--bb-secondary)]"}`}
      >
        {value}
      </p>
    </div>
  );
}
