// -----------------------------------------------------------------------------
// @file: app/admin/withdrawals/page.tsx
// @purpose: Admin-facing overview & controls for creative withdrawals (with toasts)
// @version: v1.3.0
// @status: active
// @lastUpdate: 2025-11-29
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";
import { DataTable, THead, TH, TD } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FormSelect } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { LoadingState } from "@/components/ui/loading-state";
import { useToast } from "@/components/ui/toast-provider";

type WithdrawalStatus = "PENDING" | "APPROVED" | "REJECTED" | "PAID";

type AdminWithdrawal = {
  id: string;
  amountTokens: number;
  status: WithdrawalStatus;
  createdAt: string;
  approvedAt: string | null;
  paidAt: string | null;
  adminRejectReason?: string | null;
  creative: {
    id: string;
    email: string;
    name: string | null;
    role: string;
  };
};

type AdminWithdrawalsResponse = {
  stats: {
    totalRequested: number;
    totalPaid: number;
    pendingCount: number;
    withdrawalsCount: number;
  };
  withdrawals: AdminWithdrawal[];
};

type AdminWithdrawalAction = "APPROVE" | "REJECT" | "MARK_PAID";

export default function AdminWithdrawalsPage() {
  const { showToast } = useToast();

  const [data, setData] = useState<AdminWithdrawalsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<"ALL" | WithdrawalStatus>(
    "ALL",
  );
  const [creativeFilter, setCreativeFilter] = useState<string>("ALL");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/admin/withdrawals", {
          cache: "no-store",
        });

        const json = await res.json().catch(() => null);

        if (!res.ok) {
          if (res.status === 401) {
            throw new Error(
              "You must be signed in as an admin to view this page.",
            );
          }
          if (res.status === 403) {
            throw new Error(
              "You do not have permission to view admin withdrawals.",
            );
          }
          const msg =
            (json as any)?.error || `Request failed with status ${res.status}`;
          throw new Error(msg);
        }

        if (!cancelled) {
          setData(json as AdminWithdrawalsResponse);
        }
      } catch (err: any) {
        console.error("Admin withdrawals fetch error:", err);
        if (!cancelled) {
          const message =
            err?.message || "Failed to load admin withdrawals.";

          setError(message);

          showToast({
            type: "error",
            title: "Could not load withdrawals",
            description: message,
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [showToast]);

  const withdrawals = data?.withdrawals ?? [];

  const creatives = useMemo(() => {
    const list = Array.from(
      new Set(withdrawals.map((w) => w.creative.name || w.creative.email)),
    );
    return list;
  }, [withdrawals]);

  const filteredWithdrawals = useMemo(() => {
    return withdrawals.filter((w) => {
      if (statusFilter !== "ALL" && w.status !== statusFilter) {
        return false;
      }
      const creativeLabel = w.creative.name || w.creative.email;
      if (creativeFilter !== "ALL" && creativeLabel !== creativeFilter) {
        return false;
      }
      return true;
    });
  }, [withdrawals, statusFilter, creativeFilter]);

  const getActionSuccessCopy = (action: AdminWithdrawalAction) => {
    switch (action) {
      case "APPROVE":
        return {
          title: "Withdrawal approved",
          description:
            "This withdrawal has been approved. Remember to mark it as paid once the payment is sent.",
        };
      case "REJECT":
        return {
          title: "Withdrawal rejected",
          description:
            "This withdrawal has been rejected. The creative will see this in their history.",
        };
      case "MARK_PAID":
        return {
          title: "Withdrawal marked as paid",
          description:
            "This withdrawal is now marked as paid and the record has been updated.",
        };
      default:
        return {
          title: "Withdrawal updated",
          description: "The withdrawal status has been updated.",
        };
    }
  };

  const handleAction = async (id: string, action: AdminWithdrawalAction) => {
    setActionLoadingId(`${id}:${action}`);
    setError(null);

    try {
      const res = await fetch("/api/admin/withdrawals", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, action }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const msg =
          (json as any)?.error ||
          `Failed to update withdrawal (status ${res.status})`;
        throw new Error(msg);
      }

      const updated = (json as any).withdrawal as
        | AdminWithdrawal
        | undefined;
      const updatedStats = (json as any).stats as
        | AdminWithdrawalsResponse["stats"]
        | undefined;

      if (updated) {
        setData((prev) =>
          prev
            ? {
                stats: updatedStats ?? prev.stats,
                withdrawals: prev.withdrawals.map((w) =>
                  w.id === updated.id ? updated : w,
                ),
              }
            : prev,
        );
      } else if (updatedStats) {
        // Stats geldi ama tekil withdrawal yoksa, sadece stats'i güncelle
        setData((prev) =>
          prev
            ? {
                ...prev,
                stats: updatedStats,
              }
            : prev,
        );
      }

      const copy = getActionSuccessCopy(action);
      showToast({
        type: "success",
        title: copy.title,
        description: copy.description,
      });
    } catch (err: any) {
      console.error("Admin withdrawal action error:", err);
      const message =
        err?.message || "Failed to update withdrawal status.";

      setError(message);

      showToast({
        type: "error",
        title: "Could not update withdrawal",
        description: message,
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const stats = data?.stats;

  const formatDateTime = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  };

  const renderStatusBadge = (status: WithdrawalStatus) => {
    switch (status) {
      case "PENDING":
        return <Badge variant="warning">Pending</Badge>;
      case "APPROVED":
        return <Badge variant="success">Approved</Badge>;
      case "REJECTED":
        return <Badge variant="danger">Rejected</Badge>;
      case "PAID":
        return <Badge variant="info">Paid</Badge>;
    }
  };

  const isActionLoading = (id: string, action: AdminWithdrawalAction) =>
    actionLoadingId === `${id}:${action}`;

  return (
    <>
        {/* Page header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Creative withdrawals
            </h1>
            <p className="mt-1 text-sm text-[var(--bb-text-secondary)]">
              Review, approve and mark creative withdrawal requests as paid.
            </p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <InlineAlert variant="error" title="Error" className="mb-4">
            {error}
          </InlineAlert>
        )}

        {/* Summary cards */}
        <section className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--bb-text-tertiary)]">
              Total requested
            </p>
            <p className="mt-2 text-3xl font-semibold text-[var(--bb-primary)]">
              {loading ? "—" : stats ? stats.totalRequested : 0}
              <span className="ml-1 text-base font-normal text-[var(--bb-text-secondary)]">
                tokens
              </span>
            </p>
            <p className="mt-1 text-xs text-[var(--bb-text-tertiary)]">
              Sum of all withdrawal requests.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--bb-text-tertiary)]">
              Total paid
            </p>
            <p className="mt-2 text-2xl font-semibold text-[var(--bb-secondary)]">
              {loading ? "—" : stats ? stats.totalPaid : 0}
            </p>
            <p className="mt-1 text-xs text-[var(--bb-text-tertiary)]">
              Tokens that have been paid out to creatives.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--bb-text-tertiary)]">
              Pending requests
            </p>
            <p className="mt-2 text-2xl font-semibold text-[var(--bb-secondary)]">
              {loading ? "—" : stats ? stats.pendingCount : 0}
            </p>
            <p className="mt-1 text-xs text-[var(--bb-text-tertiary)]">
              Waiting for approval from the admin team.
            </p>
          </div>
        </section>

        {/* Filters */}
        <section className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-4 shadow-sm">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-[var(--bb-secondary)]">
              Status
            </label>
            <FormSelect
              className="w-auto"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as "ALL" | WithdrawalStatus)
              }
            >
              <option value="ALL">All</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="PAID">Paid</option>
            </FormSelect>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-[var(--bb-secondary)]">
              Creative
            </label>
            <FormSelect
              className="w-auto"
              value={creativeFilter}
              onChange={(e) => setCreativeFilter(e.target.value)}
            >
              <option value="ALL">All creatives</option>
              {creatives.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </FormSelect>
          </div>
        </section>

        {/* Table */}
        <section className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-4 py-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight">
              Withdrawal requests
            </h2>
            <p className="text-xs text-[var(--bb-text-tertiary)]">
              Showing {filteredWithdrawals.length} entries.
            </p>
          </div>

          {loading ? (
            <LoadingState message="Loading withdrawals…" />
          ) : filteredWithdrawals.length === 0 ? (
            <EmptyState title="No withdrawals match your filters." />
          ) : (
            <DataTable>
              <THead>
                <TH>Created</TH>
                <TH>Creative</TH>
                <TH>Amount</TH>
                <TH>Status</TH>
                <TH>Approved at</TH>
                <TH>Paid at</TH>
                <TH>Actions</TH>
              </THead>
              <tbody>
                {filteredWithdrawals.map((w) => {
                  const creativeLabel = w.creative.name || w.creative.email;

                  const canApprove = w.status === "PENDING";
                  const canReject = w.status === "PENDING";
                  const canMarkPaid = w.status === "APPROVED";

                  return (
                    <tr
                      key={w.id}
                      className="border-b border-[var(--bb-border-subtle)] last:border-b-0"
                    >
                      <TD className="text-[var(--bb-text-secondary)]">
                        {formatDateTime(w.createdAt)}
                      </TD>
                      <TD>
                        <div className="font-medium">{creativeLabel}</div>
                        <div className="text-[10px] text-[var(--bb-text-tertiary)]">
                          {w.creative.email}
                        </div>
                      </TD>
                      <TD>
                        {w.amountTokens} tokens
                      </TD>
                      <TD>
                        <div className="space-y-1">
                          {renderStatusBadge(w.status)}
                          {w.status === "REJECTED" && w.adminRejectReason && (
                            <p className="text-[10px] text-[var(--bb-danger-text)]">
                              {w.adminRejectReason}
                            </p>
                          )}
                        </div>
                      </TD>
                      <TD className="text-[var(--bb-text-secondary)]">
                        {formatDateTime(w.approvedAt)}
                      </TD>
                      <TD className="text-[var(--bb-text-secondary)]">
                        {formatDateTime(w.paidAt)}
                      </TD>
                      <TD>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            disabled={!canApprove}
                            loading={isActionLoading(w.id, "APPROVE")}
                            loadingText="Approving…"
                            onClick={() => handleAction(w.id, "APPROVE")}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            disabled={!canReject}
                            loading={isActionLoading(w.id, "REJECT")}
                            loadingText="Rejecting…"
                            onClick={() => handleAction(w.id, "REJECT")}
                          >
                            Reject
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={!canMarkPaid}
                            loading={isActionLoading(w.id, "MARK_PAID")}
                            loadingText="Marking…"
                            onClick={() => handleAction(w.id, "MARK_PAID")}
                          >
                            Mark as paid
                          </Button>
                        </div>
                      </TD>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          )}
        </section>
    </>
  );
}
