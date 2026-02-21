// -----------------------------------------------------------------------------
// @file: app/admin/tickets/page.tsx
// @purpose: Admin-facing ticket list & creative assignment screen with token
//           cost / payout override support
// @version: v0.3.0
// @status: experimental
// @lastUpdate: 2025-12-27
// -----------------------------------------------------------------------------

"use client";

import React, { useEffect, useState } from "react";
import { DataTable, THead, TH, TD } from "@/components/ui/data-table";
import { InlineAlert } from "@/components/ui/inline-alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type TicketStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";

type AdminCreative = {
  id: string;
  name: string | null;
  email: string;
};

type AdminTicket = {
  id: string;
  title: string;
  status: TicketStatus;
  createdAt: string;
  quantity: number;
  tokenCostOverride: number | null;
  creativePayoutOverride: number | null;
  company: {
    id: string;
    name: string;
  } | null;
  project: {
    id: string;
    name: string;
    code: string | null;
  } | null;
  creative: AdminCreative | null;
  jobType: {
    id: string;
    name: string;
    tokenCost: number;
    creativePayoutTokens: number;
  } | null;
};

type AdminTicketsResponse = {
  tickets: AdminTicket[];
  creatives: AdminCreative[];
};

// Local draft state for override editing
type OverrideDraft = {
  costOverride: string;
  payoutOverride: string;
};

function getEffectiveCost(t: AdminTicket): number | null {
  if (!t.jobType) return null;
  return t.tokenCostOverride ?? t.jobType.tokenCost * (t.quantity ?? 1);
}

function getEffectivePayout(t: AdminTicket): number | null {
  if (!t.jobType) return null;
  return t.creativePayoutOverride ?? t.jobType.creativePayoutTokens * (t.quantity ?? 1);
}

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [creatives, setCreatives] = useState<AdminCreative[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [savingTicketId, setSavingTicketId] = useState<string | null>(null);

  // Override editing — keyed by ticket id
  const [editingOverrides, setEditingOverrides] = useState<
    Record<string, OverrideDraft>
  >({});

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
      setCreatives(json.creatives);
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

  const handleAssignCreative = async (
    ticketId: string,
    creativeId: string | null,
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
          creativeId,
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
              "Only site owners or admins can assign creatives.",
          );
        }
        throw new Error(
          json?.error || `Request failed with status ${res.status}`,
        );
      }

      const updatedCreative: AdminCreative | null =
        json?.creative ?? null;

      setTickets((prev) =>
        prev.map((t) =>
          t.id === ticketId ? { ...t, creative: updatedCreative } : t,
        ),
      );
    } catch (err) {
      console.error("[AdminTicketsPage] assign error", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to assign creative. Please try again.",
      );
    } finally {
      setSavingTicketId(null);
    }
  };

  // -------------------------------------------------------------------------
  // Override editing helpers
  // -------------------------------------------------------------------------

  const startEditingOverrides = (t: AdminTicket) => {
    setEditingOverrides((prev) => ({
      ...prev,
      [t.id]: {
        costOverride:
          t.tokenCostOverride != null ? String(t.tokenCostOverride) : "",
        payoutOverride:
          t.creativePayoutOverride != null
            ? String(t.creativePayoutOverride)
            : "",
      },
    }));
  };

  const cancelEditingOverrides = (ticketId: string) => {
    setEditingOverrides((prev) => {
      const next = { ...prev };
      delete next[ticketId];
      return next;
    });
  };

  const handleSaveOverrides = async (ticketId: string) => {
    const draft = editingOverrides[ticketId];
    if (!draft) return;

    setError(null);
    setSavingTicketId(ticketId);

    try {
      const costVal = draft.costOverride.trim();
      const payoutVal = draft.payoutOverride.trim();

      const payload: Record<string, unknown> = { ticketId };

      // Empty string → clear override (null), number → set
      payload.tokenCostOverride =
        costVal === "" ? null : parseInt(costVal, 10);
      payload.creativePayoutOverride =
        payoutVal === "" ? null : parseInt(payoutVal, 10);

      // Validate
      if (
        costVal !== "" &&
        (isNaN(payload.tokenCostOverride as number) ||
          (payload.tokenCostOverride as number) < 0)
      ) {
        setError("Cost override must be a non-negative number.");
        return;
      }
      if (
        payoutVal !== "" &&
        (isNaN(payload.creativePayoutOverride as number) ||
          (payload.creativePayoutOverride as number) < 0)
      ) {
        setError("Payout override must be a non-negative number.");
        return;
      }

      const res = await fetch("/api/admin/tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          json?.error || `Request failed with status ${res.status}`,
        );
      }

      // Update local state with response
      setTickets((prev) =>
        prev.map((t) =>
          t.id === ticketId
            ? {
                ...t,
                tokenCostOverride: json.tokenCostOverride ?? null,
                creativePayoutOverride:
                  json.creativePayoutOverride ?? null,
                jobType: json.jobType ?? t.jobType,
                creative: json.creative ?? t.creative,
              }
            : t,
        ),
      );

      cancelEditingOverrides(ticketId);
    } catch (err) {
      console.error("[AdminTicketsPage] save overrides error", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save overrides. Please try again.",
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
    <>
      {/* Error / info */}
        {error && (
          <InlineAlert variant="error" title="Something went wrong" className="mb-4">
            {error}
          </InlineAlert>
        )}

        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs text-[var(--bb-text-secondary)]">
            Assign creatives and manage token cost overrides. Changes update
            immediately.
          </p>
          {loading && (
            <span className="rounded-full bg-[var(--bb-bg-card)] px-3 py-1 text-[11px] text-[var(--bb-text-secondary)]">
              Loading…
            </span>
          )}
        </div>

        {/* Table */}
        <DataTable maxHeight="600px">
          <THead>
            <TH className="hidden md:table-cell">Created</TH>
            <TH>Company</TH>
            <TH>Title</TH>
            <TH>Status</TH>
            <TH className="hidden md:table-cell">Job Type</TH>
            <TH>Tokens</TH>
            <TH>Creative</TH>
          </THead>
          <tbody>
            {tickets.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-4">
                  {loading ? (
                    <p className="text-center text-[11px] text-[var(--bb-text-tertiary)]">Loading tickets…</p>
                  ) : (
                    <EmptyState title="No tickets found." description="Once tickets are created, they will appear here for creative assignment." />
                  )}
                </td>
              </tr>
            ) : (
              tickets.map((t) => {
                const creativeValue = t.creative?.id ?? "";
                const isSaving = savingTicketId === t.id;
                const isEditing = t.id in editingOverrides;
                const draft = editingOverrides[t.id];

                const effectiveCost = getEffectiveCost(t);
                const effectivePayout = getEffectivePayout(t);
                const hasOverride =
                  t.tokenCostOverride != null ||
                  t.creativePayoutOverride != null;

                return (
                  <tr
                    key={t.id}
                    className="border-b border-[var(--bb-border-subtle)] last:border-b-0"
                  >
                    <TD className="hidden md:table-cell">
                      {formatDateTime(t.createdAt)}
                    </TD>
                    <TD>
                      {t.company?.name ?? "—"}
                    </TD>
                    <TD>
                      <div className="max-w-xs truncate">
                        {t.title}
                      </div>
                    </TD>
                    <TD>
                      {t.status}
                    </TD>
                    <TD className="hidden md:table-cell">
                      {t.jobType ? (
                        <div className="space-y-0.5">
                          <div className="text-xs">{t.jobType.name}</div>
                          {t.quantity > 1 && (
                            <div className="text-[10px] text-[var(--bb-text-tertiary)]">
                              ×{t.quantity}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-[var(--bb-text-tertiary)]">—</span>
                      )}
                    </TD>
                    <TD>
                      {t.jobType ? (
                        isEditing && draft ? (
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1">
                              <span className="w-12 text-[10px] text-[var(--bb-text-tertiary)]">Cost</span>
                              <input
                                type="number"
                                min="0"
                                className="w-full max-w-[4rem] rounded border border-[var(--bb-border-input)] bg-[var(--bb-bg-page)] px-1.5 py-0.5 text-[11px] outline-none focus:border-[var(--bb-primary)]"
                                placeholder={String(
                                  t.jobType.tokenCost * (t.quantity ?? 1),
                                )}
                                value={draft.costOverride}
                                onChange={(e) =>
                                  setEditingOverrides((prev) => ({
                                    ...prev,
                                    [t.id]: {
                                      ...prev[t.id],
                                      costOverride: e.target.value,
                                    },
                                  }))
                                }
                                disabled={isSaving}
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="w-12 text-[10px] text-[var(--bb-text-tertiary)]">Payout</span>
                              <input
                                type="number"
                                min="0"
                                className="w-full max-w-[4rem] rounded border border-[var(--bb-border-input)] bg-[var(--bb-bg-page)] px-1.5 py-0.5 text-[11px] outline-none focus:border-[var(--bb-primary)]"
                                placeholder={String(
                                  t.jobType.creativePayoutTokens *
                                    (t.quantity ?? 1),
                                )}
                                value={draft.payoutOverride}
                                onChange={(e) =>
                                  setEditingOverrides((prev) => ({
                                    ...prev,
                                    [t.id]: {
                                      ...prev[t.id],
                                      payoutOverride: e.target.value,
                                    },
                                  }))
                                }
                                disabled={isSaving}
                              />
                            </div>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => handleSaveOverrides(t.id)}
                                loading={isSaving}
                                loadingText="Saving…"
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => cancelEditingOverrides(t.id)}
                                disabled={isSaving}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <div className="text-[11px]">
                              <span className="text-[var(--bb-text-tertiary)]">Cost:</span>{" "}
                              <span className="font-medium text-[var(--bb-secondary)]">
                                {effectiveCost}
                              </span>
                              {hasOverride && t.tokenCostOverride != null && (
                                <Badge variant="warning" className="ml-1">
                                  override
                                </Badge>
                              )}
                            </div>
                            <div className="text-[11px]">
                              <span className="text-[var(--bb-text-tertiary)]">Payout:</span>{" "}
                              <span className="font-medium text-[var(--bb-secondary)]">
                                {effectivePayout}
                              </span>
                              {hasOverride &&
                                t.creativePayoutOverride != null && (
                                  <Badge variant="warning" className="ml-1">
                                    override
                                  </Badge>
                                )}
                            </div>
                            <button
                              type="button"
                              onClick={() => startEditingOverrides(t)}
                              className="mt-0.5 text-[10px] text-[var(--bb-primary)] hover:underline"
                            >
                              Edit overrides
                            </button>
                          </div>
                        )
                      ) : (
                        <span className="text-[var(--bb-text-tertiary)]">—</span>
                      )}
                    </TD>
                    <TD>
                      <div className="inline-flex items-center gap-2">
                        <select
                          className="rounded-full border border-[var(--bb-border)] bg-[var(--bb-bg-warm)] px-2 py-1 text-[11px] text-[var(--bb-secondary)] outline-none"
                          value={creativeValue}
                          disabled={isSaving}
                          onChange={(e) =>
                            handleAssignCreative(
                              t.id,
                              e.target.value || null,
                            )
                          }
                        >
                          <option value="">Unassigned</option>
                          {creatives.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name || d.email}
                            </option>
                          ))}
                        </select>
                        {isSaving && !isEditing && (
                          <span className="text-[10px] text-[var(--bb-text-tertiary)]">
                            Saving…
                          </span>
                        )}
                      </div>
                    </TD>
                  </tr>
                );
              })
            )}
          </tbody>
        </DataTable>
    </>
  );
}
