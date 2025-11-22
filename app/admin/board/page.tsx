// -----------------------------------------------------------------------------
// @file: app/admin/board/page.tsx
// @purpose: Admin-facing kanban board over all tickets
// @version: v0.1.0
// @status: experimental
// @lastUpdate: 2025-11-22
// -----------------------------------------------------------------------------

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AdminNav } from "@/components/navigation/admin-nav";

type TicketStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";

type AdminTicket = {
  id: string;
  title: string;
  status: TicketStatus;
  createdAt: string;
  company: { id: string; name: string } | null;
  project: { id: string; name: string; code: string | null } | null;
  designer: { id: string; name: string | null; email: string } | null;
};

type AdminTicketsResponse = {
  tickets: AdminTicket[];
};

const STATUS_ORDER: TicketStatus[] = [
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DONE",
];

const STATUS_LABELS: Record<TicketStatus, string> = {
  TODO: "Backlog",
  IN_PROGRESS: "In progress",
  IN_REVIEW: "In review",
  DONE: "Done",
};

const statusColumnClass = (status: TicketStatus): string => {
  switch (status) {
    case "TODO":
      return "bg-[#f5f3f0]";
    case "IN_PROGRESS":
      return "bg-[#eaf4ff]";
    case "IN_REVIEW":
      return "bg-[#fff7e0]";
    case "DONE":
      return "bg-[#e8f6f0]";
  }
};

export default function AdminBoardPage() {
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/tickets", {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as
        | AdminTicketsResponse
        | { error?: string }
        | null;

      if (!res.ok) {
        throw new Error(
          json && "error" in json && json.error
            ? json.error
            : `Request failed with status ${res.status}`,
        );
      }

      if (!json || !("tickets" in json)) {
        throw new Error("Unexpected response from server.");
      }

      setTickets(json.tickets);
    } catch (err) {
      console.error("[AdminBoardPage] load error", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load tickets. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const ticketsByStatus = useMemo(() => {
    const map: Record<TicketStatus, AdminTicket[]> = {
      TODO: [],
      IN_PROGRESS: [],
      IN_REVIEW: [],
      DONE: [],
    };
    for (const t of tickets) {
      map[t.status].push(t);
    }
    return map;
  }, [tickets]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-[#f5f3f0] text-[#424143]">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <AdminNav />

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-[#fff7f7] px-4 py-3 text-xs text-red-700">
            {error}
          </div>
        )}

        {loading && !error && (
          <div className="mb-4 rounded-full bg-[#f5f3f0] px-3 py-1 text-[11px] text-[#7a7a7a]">
            Loading board…
          </div>
        )}

        <p className="mb-4 text-xs text-[#7a7a7a]">
          This view shows all tickets across companies, grouped by status.
          It is read-only and useful for monitoring.
        </p>

        <div className="grid gap-3 md:grid-cols-4">
          {STATUS_ORDER.map((status) => {
            const columnTickets = ticketsByStatus[status] || [];
            const columnTitle = STATUS_LABELS[status];

            return (
              <div
                key={status}
                className="flex flex-col rounded-2xl bg-white/60 p-2"
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9a9892]">
                      {columnTitle}
                    </span>
                    <span className="rounded-full bg-[#f5f3f0] px-2 py-0.5 text-[11px] font-semibold text-[#7a7a7a]">
                      {columnTickets.length}
                    </span>
                  </div>
                </div>

                <div
                  className={`flex-1 space-y-2 rounded-xl ${statusColumnClass(
                    status,
                  )} bg-opacity-70 p-2`}
                >
                  {columnTickets.length === 0 ? (
                    <p className="py-4 text-center text-[11px] text-[#9a9892]">
                      No tickets in this column.
                    </p>
                  ) : (
                    columnTickets.map((t) => (
                      <div
                        key={t.id}
                        className="rounded-xl bg-white p-3 text-[11px] text-[#424143] shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">
                            {t.title}
                          </span>
                        </div>
                        <div className="mt-1 text-[10px] text-[#7a7a7a]">
                          <p>
                            Company:{" "}
                            <span className="font-semibold">
                              {t.company?.name ?? "—"}
                            </span>
                          </p>
                          <p>
                            Project:{" "}
                            <span className="font-semibold">
                              {t.project?.name ?? "—"}
                            </span>
                          </p>
                          <p>
                            Designer:{" "}
                            <span className="font-semibold">
                              {t.designer?.name ||
                                t.designer?.email ||
                                "Unassigned"}
                            </span>
                          </p>
                          <p className="mt-1 text-[#9a9892]">
                            Created {formatDate(t.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
