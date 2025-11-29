// -----------------------------------------------------------------------------
// @file: app/admin/completed-jobs/page.tsx
// @purpose: Admin view for recently completed (DONE) tickets and payout status
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-11-29
// -----------------------------------------------------------------------------

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AdminNav } from "@/components/navigation/admin-nav";

type CompletedJob = {
  ticketId: string;
  code: string;
  title: string;
  companyName: string | null;
  projectName: string | null;
  designerName: string | null;
  designerEmail: string | null;
  completedAt: string;
  jobTypeName: string | null;
  designerPayoutTokens: number | null;
  hasPayoutEntry: boolean;
  payoutLedgerCreatedAt: string | null;
};

type CompletedJobsResponse = {
  jobs: CompletedJob[];
};

const formatDateTime = (iso: string | null): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
};

export default function AdminCompletedJobsPage() {
  const [data, setData] = useState<CompletedJob[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState<string>("");

  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/completed-jobs", {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as
        | CompletedJobsResponse
        | { error?: string }
        | null;

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("You need to sign in as an admin.");
        }
        if (res.status === 403) {
          throw new Error(
            (json as any)?.error ||
              "You do not have access to completed jobs in this workspace.",
          );
        }
        const msg =
          (json as any)?.error || `Request failed with status ${res.status}`;
        throw new Error(msg);
      }

      setData((json as CompletedJobsResponse).jobs ?? []);
    } catch (err: unknown) {
      console.error("[AdminCompletedJobs] load error", err);
      const message =
        err instanceof Error
          ? err.message
          : "Failed to load completed jobs.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const initial = async () => {
      if (cancelled) return;
      await load();
    };

    initial();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;

    return data.filter((job) => {
      const haystack = [
        job.code,
        job.title,
        job.companyName ?? "",
        job.projectName ?? "",
        job.designerName ?? "",
        job.designerEmail ?? "",
        job.jobTypeName ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [data, search]);

  const stats = useMemo(() => {
    const total = data.length;
    const withPayout = data.filter((j) => j.hasPayoutEntry).length;
    const withoutPayout = total - withPayout;
    const totalTokens = data.reduce((sum, j) => {
      return sum + (j.designerPayoutTokens ?? 0);
    }, 0);

    return {
      total,
      withPayout,
      withoutPayout,
      totalTokens,
    };
  }, [data]);

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <AdminNav />

        <div className="mt-4 mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Admin · Completed jobs
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight">
              Completed jobs
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              Tickets that have been marked as{" "}
              <span className="font-semibold text-slate-100">Done</span> by
              customers. Use this view to review recent work and reconcile
              designer payouts.
            </p>
          </div>
          {loading && (
            <div className="rounded-full bg-slate-800 px-3 py-1 text-[11px] text-slate-300">
              Loading completed jobs…
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/40 bg-red-900/30 px-4 py-3 text-xs text-red-100">
            <p className="font-medium">Something went wrong</p>
            <p className="mt-1">{error}</p>
          </div>
        )}

        {/* Stats */}
        <div className="mb-4 grid gap-3 text-[11px] text-slate-200 md:grid-cols-4">
          <div className="rounded-2xl bg-slate-800/70 px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
              Total jobs
            </p>
            <p className="mt-2 text-xl font-semibold">{stats.total}</p>
          </div>
          <div className="rounded-2xl bg-slate-800/70 px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
              With payout ledger
            </p>
            <p className="mt-2 text-xl font-semibold">{stats.withPayout}</p>
          </div>
          <div className="rounded-2xl bg-slate-800/70 px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
              Missing payout ledger
            </p>
            <p className="mt-2 text-xl font-semibold text-amber-300">
              {stats.withoutPayout}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-800/70 px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
              Total designer tokens (v1)
            </p>
            <p className="mt-2 text-xl font-semibold">
              {stats.totalTokens.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search by ticket code, title, company, project or designer"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-full border border-slate-700 bg-slate-900/60 px-4 py-2 text-xs text-slate-100 outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
            />
          </div>
          <p className="text-[11px] text-slate-400">
            Showing{" "}
            <span className="font-semibold text-slate-100">
              {filteredJobs.length}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-slate-100">
              {data.length}
            </span>{" "}
            completed jobs.
          </p>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/60">
          <div className="max-h-[60vh] overflow-auto">
            <table className="min-w-full border-separate border-spacing-0 text-left text-[11px]">
              <thead className="sticky top-0 bg-slate-900">
                <tr>
                  <th className="border-b border-slate-700 px-3 py-2 font-semibold text-slate-300">
                    Ticket
                  </th>
                  <th className="border-b border-slate-700 px-3 py-2 font-semibold text-slate-300">
                    Company / Project
                  </th>
                  <th className="border-b border-slate-700 px-3 py-2 font-semibold text-slate-300">
                    Designer
                  </th>
                  <th className="border-b border-slate-700 px-3 py-2 font-semibold text-slate-300">
                    Job type
                  </th>
                  <th className="border-b border-slate-700 px-3 py-2 font-semibold text-slate-300">
                    Payout tokens
                  </th>
                  <th className="border-b border-slate-700 px-3 py-2 font-semibold text-slate-300">
                    Completed at
                  </th>
                  <th className="border-b border-slate-700 px-3 py-2 font-semibold text-slate-300">
                    Payout status
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-6 text-center text-[11px] text-slate-400"
                    >
                      No completed jobs found for this filter.
                    </td>
                  </tr>
                ) : (
                  filteredJobs.map((job, idx) => (
                    <tr
                      key={job.ticketId}
                      className={
                        idx % 2 === 0
                          ? "bg-slate-900/40"
                          : "bg-slate-900/20"
                      }
                    >
                      <td className="border-t border-slate-800 px-3 py-2 align-top">
                        <div className="font-semibold text-slate-100">
                          {job.code}
                        </div>
                        <div className="mt-0.5 line-clamp-2 text-[10px] text-slate-300">
                          {job.title}
                        </div>
                      </td>
                      <td className="border-t border-slate-800 px-3 py-2 align-top">
                        <div className="text-[11px] font-medium text-slate-100">
                          {job.companyName ?? "—"}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {job.projectName ?? "—"}
                        </div>
                      </td>
                      <td className="border-t border-slate-800 px-3 py-2 align-top">
                        <div className="text-[11px] font-medium text-slate-100">
                          {job.designerName ?? "—"}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {job.designerEmail ?? "—"}
                        </div>
                      </td>
                      <td className="border-t border-slate-800 px-3 py-2 align-top">
                        <div className="text-[11px] text-slate-100">
                          {job.jobTypeName ?? "—"}
                        </div>
                      </td>
                      <td className="border-t border-slate-800 px-3 py-2 align-top">
                        <div className="text-[11px] font-semibold text-slate-100">
                          {job.designerPayoutTokens ?? "—"}
                        </div>
                      </td>
                      <td className="border-t border-slate-800 px-3 py-2 align-top">
                        <div className="text-[10px] text-slate-300">
                          {formatDateTime(job.completedAt)}
                        </div>
                      </td>
                      <td className="border-t border-slate-800 px-3 py-2 align-top">
                        {job.hasPayoutEntry ? (
                          <div className="inline-flex items-center rounded-full bg-emerald-900/40 px-2 py-0.5 text-[10px] text-emerald-200">
                            <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            Payout ledger created
                          </div>
                        ) : (
                          <div className="inline-flex items-center rounded-full bg-amber-900/40 px-2 py-0.5 text-[10px] text-amber-200">
                            <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                            Missing payout ledger
                          </div>
                        )}
                        {job.payoutLedgerCreatedAt && (
                          <div className="mt-1 text-[10px] text-slate-400">
                            {formatDateTime(job.payoutLedgerCreatedAt)}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
