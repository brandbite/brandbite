// -----------------------------------------------------------------------------
// @file: app/admin/tickets/page.tsx
// @purpose: Admin-facing ticket list & designer assignment screen
// @version: v0.2.0
// @status: experimental
// @lastUpdate: 2025-11-22
// -----------------------------------------------------------------------------

"use client";

import React, { useEffect, useState } from "react";
import { AdminNav } from "@/components/navigation/admin-nav";

type TicketStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";

type AdminDesigner = {
  id: string;
  name: string | null;
  email: string;
};

type AdminTicket = {
  id: string;
  title: string;
  status: TicketStatus;
  createdAt: string;
  company: {
    id: string;
    name: string;
  } | null;
  project: {
    id: string;
    name: string;
    code: string | null;
  } | null;
  designer: AdminDesigner | null;
};

type AdminTicketsResponse = {
  tickets: AdminTicket[];
  designers: AdminDesigner[];
};

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [designers, setDesigners] = useState<AdminDesigner[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [savingTicketId, setSavingTicketId] = useState<string | null>(null);

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
        if (res.status === 401) {
          throw new Error("You need to sign in as an admin to view this page.");
        }
        if (res.status === 403) {
          throw new Error(
            "Only site owners or admins can manage tickets from this screen.",
          );
        }
        throw new Error(
          json && "error" in json && json.error
            ? json.error
            : `Request failed with status ${res.status}`,
        );
      }

      if (!json || !("tickets" in json)) {
        throw new Error("Unexpected response format from server.");
      }

      setTickets(json.tickets);
      setDesigners(json.designers);
    } catch (err) {
      console.error("[AdminTicketsPage] load error", err);
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

  const handleAssignDesigner = async (
    ticketId: string,
    designerId: string | null,
  ) => {
    setError(null);
    setSavingTicketId(ticketId);
    try {
      const res = await fetch("/api/admin/tickets", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ticketId,
          designerId,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("You need to sign in as an admin to update tickets.");
        }
        if (res.status === 403) {
          throw new Error(
            json?.error ||
              "Only site owners or admins can assign designers.",
          );
        }
        throw new Error(
          json?.error || `Request failed with status ${res.status}`,
        );
      }

      const updatedDesigner: AdminDesigner | null =
        json?.designer ?? null;

      setTickets((prev) =>
        prev.map((t) =>
          t.id === ticketId ? { ...t, designer: updatedDesigner } : t,
        ),
      );
    } catch (err) {
      console.error("[AdminTicketsPage] assign error", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to assign designer. Please try again.",
      );
    } finally {
      setSavingTicketId(null);
    }
  };

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString();
  };

  return (
    <div className="min-h-screen bg-[#f5f3f0] text-[#424143]">
      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* Top navigation */}
        <AdminNav />

        {/* Error / info */}
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-[#fff7f7] px-4 py-3 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs text-[#7a7a7a]">
            Assign designers to tickets. This is useful for testing or manual
            overrides. Changes here update the ticket immediately.
          </p>
          {loading && (
            <span className="rounded-full bg-[#f5f3f0] px-3 py-1 text-[11px] text-[#7a7a7a]">
              Loading…
            </span>
          )}
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-3xl border border-[#e3e1dc] bg-white shadow-sm">
          <div className="max-h-[520px] overflow-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-[#f7f5f0] text-[11px] uppercase tracking-[0.14em] text-[#9a9892]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Created</th>
                  <th className="px-4 py-3 font-semibold">Company</th>
                  <th className="px-4 py-3 font-semibold">Project</th>
                  <th className="px-4 py-3 font-semibold">Title</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Designer</th>
                </tr>
              </thead>
              <tbody>
                {tickets.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-6 text-center text-[11px] text-[#9a9892]"
                    >
                      {loading
                        ? "Loading tickets…"
                        : "No tickets found."}
                    </td>
                  </tr>
                ) : (
                  tickets.map((t) => {
                    const designerValue = t.designer?.id ?? "";
                    const isSaving = savingTicketId === t.id;

                    return (
                      <tr
                        key={t.id}
                        className="border-t border-[#f0eee9] text-[11px] text-[#424143]"
                      >
                        <td className="px-4 py-3 align-top">
                          {formatDateTime(t.createdAt)}
                        </td>
                        <td className="px-4 py-3 align-top">
                          {t.company?.name ?? "—"}
                        </td>
                        <td className="px-4 py-3 align-top">
                          {t.project
                            ? t.project.code
                              ? `${t.project.code} – ${t.project.name}`
                              : t.project.name
                            : "—"}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="max-w-xs truncate">
                            {t.title}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          {t.status}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="inline-flex items-center gap-2">
                            <select
                              className="rounded-full border border-[#e3e1dc] bg-[#f7f5f0] px-2 py-1 text-[11px] text-[#424143] outline-none"
                              value={designerValue}
                              disabled={isSaving}
                              onChange={(e) =>
                                handleAssignDesigner(
                                  t.id,
                                  e.target.value || null,
                                )
                              }
                            >
                              <option value="">Unassigned</option>
                              {designers.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.name || d.email}
                                </option>
                              ))}
                            </select>
                            {isSaving && (
                              <span className="text-[10px] text-[#9a9892]">
                                Saving…
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
