// -----------------------------------------------------------------------------
// @file: app/creative/withdrawals/page.tsx
// @purpose: Creative-facing withdrawals overview and request form
// @version: v1.2.1
// @status: active
// @lastUpdate: 2025-11-15
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, THead, TH, TD } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FormInput } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { LoadingState } from "@/components/ui/loading-state";
import { useToast } from "@/components/ui/toast-provider";

type WithdrawalStatus = "PENDING" | "APPROVED" | "REJECTED" | "PAID";

type CreativeWithdrawal = {
  id: string;
  amountTokens: number;
  status: WithdrawalStatus;
  createdAt: string;
  approvedAt: string | null;
};

type CreativeWithdrawalsResponse = {
  stats: {
    availableBalance: number;
    totalRequested: number;
    pendingCount: number;
    withdrawalsCount: number;
    minWithdrawalTokens: number;
  };
  withdrawals: CreativeWithdrawal[];
};

export default function CreativeWithdrawalsPage() {
  const { showToast } = useToast();
  const [data, setData] = useState<CreativeWithdrawalsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [amount, setAmount] = useState<string>("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/creative/withdrawals", {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("You must be signed in as a creative to view this page.");
        }
        if (res.status === 403) {
          throw new Error("You do not have permission to view creative withdrawals.");
        }
        const msg = json?.error || `Request failed with status ${res.status}`;
        throw new Error(msg);
      }

      setData(json as CreativeWithdrawalsResponse);
    } catch (err: any) {
      console.error("Creative withdrawals fetch error:", err);
      setError(err?.message || "Failed to load withdrawals.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const initialLoad = async () => {
      if (cancelled) return;
      await load();
    };

    initialLoad();

    return () => {
      cancelled = true;
    };
     
  }, []);

  const withdrawals = data?.withdrawals ?? [];
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
    const variantMap: Record<WithdrawalStatus, "warning" | "success" | "danger" | "info"> = {
      PENDING: "warning",
      APPROVED: "success",
      REJECTED: "danger",
      PAID: "info",
    };
    const labelMap: Record<WithdrawalStatus, string> = {
      PENDING: "Pending",
      APPROVED: "Approved",
      REJECTED: "Rejected",
      PAID: "Paid",
    };
    return <Badge variant={variantMap[status]}>{labelMap[status]}</Badge>;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    const parsed = parseInt(amount, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      setSubmitError("Please enter a valid token amount.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/creative/withdrawals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amountTokens: parsed }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = json?.error || `Request failed with status ${res.status}`;
        throw new Error(msg);
      }

      setSubmitSuccess("Withdrawal request created successfully.");
      showToast({ type: "success", title: "Withdrawal request created." });
      setAmount("");
      await load();
    } catch (err: any) {
      console.error("Creative withdrawal submit error:", err);
      const errMsg = err?.message || "Failed to create withdrawal request.";
      setSubmitError(errMsg);
      showToast({ type: "error", title: errMsg });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      const res = await fetch("/api/creative/withdrawals", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || "Failed to cancel withdrawal");
      }

      showToast({ type: "success", title: "Withdrawal cancelled." });
      await load();
    } catch (err: any) {
      showToast({ type: "error", title: err?.message || "Failed to cancel withdrawal." });
    }
  };

  return (
    <div className="max-w-5xl">
      {/* Page header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My withdrawals</h1>
          <p className="mt-1 text-sm text-[var(--bb-text-secondary)]">
            Request payouts from your token balance and track their status.
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <InlineAlert variant="error" title="Error" className="mb-4">
          {error}
        </InlineAlert>
      )}

      {/* Summary + form */}
      <section className="mb-6 grid gap-4 md:grid-cols-[2fr_3fr]">
        {/* Summary cards */}
        <div className="space-y-3">
          <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-4 shadow-sm">
            <p className="text-xs font-medium tracking-[0.12em] text-[var(--bb-text-tertiary)] uppercase">
              Available balance
            </p>
            <p className="mt-2 text-3xl font-semibold text-[var(--bb-primary)]">
              {loading ? "—" : stats ? stats.availableBalance : 0}
              <span className="ml-1 text-base font-normal text-[var(--bb-text-secondary)]">
                tokens
              </span>
            </p>
            <p className="mt-1 text-xs text-[var(--bb-text-tertiary)]">
              This is your current token balance before new withdrawals.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-4 shadow-sm">
              <p className="text-xs font-medium tracking-[0.12em] text-[var(--bb-text-tertiary)] uppercase">
                Total requested
              </p>
              <p className="mt-2 text-2xl font-semibold text-[var(--bb-secondary)]">
                {loading ? "—" : stats ? stats.totalRequested : 0}
              </p>
              <p className="mt-1 text-xs text-[var(--bb-text-tertiary)]">
                Sum of all your withdrawal requests.
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-4 shadow-sm">
              <p className="text-xs font-medium tracking-[0.12em] text-[var(--bb-text-tertiary)] uppercase">
                Pending requests
              </p>
              <p className="mt-2 text-2xl font-semibold text-[var(--bb-secondary)]">
                {loading ? "—" : stats ? stats.pendingCount : 0}
              </p>
              <p className="mt-1 text-xs text-[var(--bb-text-tertiary)]">
                Waiting for approval from admin.
              </p>
            </div>
          </div>
        </div>

        {/* Request form */}
        <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-4 shadow-sm">
          <h2 className="text-sm font-semibold tracking-tight">Request a withdrawal</h2>
          <p className="mt-1 text-xs text-[var(--bb-text-secondary)]">
            Enter the amount of tokens you would like to withdraw.
            {stats?.minWithdrawalTokens
              ? ` Minimum: ${stats.minWithdrawalTokens} tokens.`
              : " Minimum withdrawal amount applies."}
          </p>

          {submitError && (
            <InlineAlert variant="error" size="sm" className="mt-3">
              {submitError}
            </InlineAlert>
          )}

          {submitSuccess && (
            <InlineAlert variant="success" size="sm" className="mt-3">
              {submitSuccess}
            </InlineAlert>
          )}

          <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-1">
              <label htmlFor="amount" className="text-xs font-medium text-[var(--bb-secondary)]">
                Amount (tokens)
              </label>
              <FormInput
                id="amount"
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 50"
              />
              <p className="text-xs text-[var(--bb-text-tertiary)]">
                You can only request up to your available balance.
              </p>
            </div>

            <Button type="submit" loading={submitting} loadingText="Submitting…">
              Submit withdrawal request
            </Button>
          </form>
        </div>
      </section>

      {/* Withdrawals table */}
      <section className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-4 py-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight">My withdrawal history</h2>
          <p className="text-xs text-[var(--bb-text-tertiary)]">
            Showing {withdrawals.length} requests.
          </p>
        </div>

        {loading ? (
          <LoadingState message="Loading withdrawals…" />
        ) : withdrawals.length === 0 ? (
          <EmptyState title="You have not requested any withdrawals yet." />
        ) : (
          <DataTable>
            <THead>
              <TH>Created</TH>
              <TH>Amount</TH>
              <TH>Status</TH>
              <TH>Approved at</TH>
              <TH> </TH>
            </THead>
            <tbody>
              {withdrawals.map((w) => (
                <tr
                  key={w.id}
                  className="border-b border-[var(--bb-border-subtle)] text-xs last:border-b-0"
                >
                  <TD>{formatDateTime(w.createdAt)}</TD>
                  <TD>{w.amountTokens} tokens</TD>
                  <TD>{renderStatusBadge(w.status)}</TD>
                  <TD>{formatDateTime(w.approvedAt)}</TD>
                  <TD>
                    {w.status === "PENDING" && (
                      <button
                        onClick={() => handleCancel(w.id)}
                        className="text-xs font-medium text-red-500 hover:text-red-700 hover:underline"
                      >
                        Cancel
                      </button>
                    )}
                  </TD>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </section>
    </div>
  );
}
