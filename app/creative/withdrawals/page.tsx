// -----------------------------------------------------------------------------
// @file: app/creative/withdrawals/page.tsx
// @purpose: Creative-facing withdrawals overview and request form. Balance, held
//           and requestable amounts are separate figures; approval is not payment.
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";

import { IconAlertCircle, IconClock, IconCoins, IconWallet } from "@/components/admin/v2/icons";
import {
  Button,
  Callout,
  Card,
  CardTitle,
  DASH,
  EmptyState,
  Field,
  FilterChips,
  fmt,
  PageHeader,
  Skeleton,
  Table,
  Td,
  TextInput,
  Th,
} from "@/components/admin/v2/ui";
import {
  formatDateTime,
  formatTokens,
  ListFooter,
  MoneyStat,
  pageOf,
  TokenFigure,
  WITHDRAWAL_STATUS,
  WithdrawalBadge,
  type WithdrawalStatus,
} from "@/components/dashboard/money/money-ui";
import { useToast } from "@/components/ui/toast-provider";

const PAGE_SIZE = 10;
const STATUS_ORDER: WithdrawalStatus[] = ["PENDING", "APPROVED", "PAID", "REJECTED"];

type StatusFilter = "ALL" | WithdrawalStatus;

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
    reservedTokens: number;
    spendableBalance: number;
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

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [page, setPage] = useState(1);

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

  const withdrawals = useMemo(() => data?.withdrawals ?? [], [data]);
  const stats = data?.stats;

  const filtered = useMemo(
    () =>
      statusFilter === "ALL" ? withdrawals : withdrawals.filter((w) => w.status === statusFilter),
    [withdrawals, statusFilter],
  );
  const paged = pageOf(filtered, page, PAGE_SIZE);

  // Nothing the server would accept: the amount can't reach the current minimum.
  const minimum = stats?.minWithdrawalTokens ?? 0;
  const blocked = stats != null && stats.spendableBalance < Math.max(minimum, 1);

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

  const figure = (value: number | undefined) => (stats ? <TokenFigure value={value} /> : DASH);

  return (
    <>
      <PageHeader
        title="My withdrawals"
        description="Request payouts from your token balance and track their status."
      />

      <div className="space-y-6">
        {error ? (
          <Callout tone="error" title="We couldn't load your withdrawals">
            {error}
          </Callout>
        ) : null}

        <div className="grid items-start gap-6 2xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="grid gap-6 sm:grid-cols-6">
            <div className="min-w-0 sm:col-span-6 lg:col-span-2 [&>section]:h-full">
              <MoneyStat
                icon={<IconCoins />}
                tone="peach"
                label="Token balance"
                value={figure(stats?.availableBalance)}
                hint="Your full balance, including tokens held for requests."
              />
            </div>
            <div className="min-w-0 sm:col-span-3 lg:col-span-2 [&>section]:h-full">
              <MoneyStat
                icon={<IconClock />}
                tone="lavender"
                label="Held for existing requests"
                value={figure(stats?.reservedTokens)}
                hint="Pending and approved requests that aren't paid yet."
              />
            </div>
            <div className="min-w-0 sm:col-span-3 lg:col-span-2 [&>section]:h-full">
              <MoneyStat
                icon={<IconWallet />}
                tone="green"
                label="Available to request"
                value={figure(stats?.spendableBalance)}
                hint="Your balance minus the tokens held."
              />
            </div>
            <div className="min-w-0 sm:col-span-3 [&>section]:h-full">
              <MoneyStat
                label="Pending approval"
                value={fmt(stats?.pendingCount)}
                hint="Requests waiting for approval from admin."
              />
            </div>
            <div className="min-w-0 sm:col-span-3 [&>section]:h-full">
              <MoneyStat
                label="Total requested"
                value={figure(stats?.totalRequested)}
                hint="Sum of all your withdrawal requests."
              />
            </div>
          </div>

          <Card>
            <CardTitle
              description={
                <>
                  Enter the amount of tokens you would like to withdraw.
                  {stats?.minWithdrawalTokens
                    ? ` Minimum: ${formatTokens(stats.minWithdrawalTokens)}.`
                    : " Minimum withdrawal amount applies."}
                </>
              }
            >
              Request a withdrawal
            </CardTitle>

            <div className="mt-4 space-y-3 empty:hidden">
              {submitError ? <Callout tone="error">{submitError}</Callout> : null}
              {submitSuccess ? (
                <div role="status">
                  <Callout tone="success">{submitSuccess}</Callout>
                </div>
              ) : null}
            </div>

            <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
              <Field
                label="Amount (tokens)"
                htmlFor="amount"
                hint={
                  stats
                    ? `Available to request: ${formatTokens(stats.spendableBalance)}.`
                    : "You can only request up to your available balance."
                }
              >
                <TextInput
                  id="amount"
                  type="number"
                  min={1}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 50"
                  disabled={blocked}
                />
              </Field>

              <Button type="submit" variant="primary" disabled={submitting || blocked}>
                {submitting ? "Submitting…" : "Submit withdrawal request"}
              </Button>
            </form>
          </Card>
        </div>

        {blocked && stats ? (
          <Callout
            title={
              stats.spendableBalance > 0
                ? `You can request ${formatTokens(stats.spendableBalance)}, below the ${formatTokens(minimum)} minimum.`
                : "No tokens available to request."
            }
          >
            {stats.reservedTokens > 0 ? "See your existing requests below for details." : null}
          </Callout>
        ) : null}

        <Card padding="none">
          <div className="px-6 pt-6">
            <CardTitle
              action={
                <p className="flex items-center gap-1.5 text-sm text-[var(--av2-text-2)] max-sm:hidden">
                  <IconAlertCircle width={16} height={16} className="shrink-0" />
                  Approval and payout are separate steps.
                </p>
              }
            >
              My withdrawal history
            </CardTitle>
            <p className="mt-1 text-sm text-[var(--av2-text-2)] sm:hidden">
              Approval and payout are separate steps.
            </p>
            {withdrawals.length > 0 ? (
              <div className="mt-4">
                <FilterChips
                  label="Filter by status"
                  options={[
                    { value: "ALL" as StatusFilter, label: "All", count: withdrawals.length },
                    ...STATUS_ORDER.map((s) => ({
                      value: s as StatusFilter,
                      label: WITHDRAWAL_STATUS[s].label,
                      count: withdrawals.filter((w) => w.status === s).length,
                    })),
                  ]}
                  value={statusFilter}
                  onChange={(v) => {
                    setStatusFilter(v);
                    setPage(1);
                  }}
                />
              </div>
            ) : null}
          </div>

          {loading && !data ? (
            <div aria-busy="true" aria-label="Loading withdrawals" className="p-6">
              <Skeleton className="h-32" />
            </div>
          ) : withdrawals.length === 0 ? (
            <EmptyState title="You have not requested any withdrawals yet." />
          ) : paged.total === 0 ? (
            <EmptyState title="No requests with this status." />
          ) : (
            <div className="mt-4">
              <Table label="My withdrawal history">
                <thead>
                  <tr>
                    <Th className="max-md:hidden">Created</Th>
                    <Th className="max-md:pl-6">Amount</Th>
                    <Th>Status</Th>
                    <Th className="max-md:hidden">Approved at</Th>
                    {paged.rows.some((w) => w.status === "PENDING") ? (
                      <Th align="right">Action</Th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {paged.rows.map((w) => (
                    <tr key={w.id} className="border-b border-[var(--av2-border)] last:border-b-0">
                      <Td className="whitespace-nowrap max-md:hidden">
                        {formatDateTime(w.createdAt)}
                      </Td>
                      <Td className="max-md:pl-6">
                        <span className="font-semibold whitespace-nowrap tabular-nums">
                          {formatTokens(w.amountTokens)}
                        </span>
                        <span className="mt-0.5 block text-xs text-[var(--av2-text-2)] md:hidden">
                          Created {formatDateTime(w.createdAt)}
                        </span>
                        {w.approvedAt ? (
                          <span className="mt-0.5 block text-xs text-[var(--av2-text-2)] md:hidden">
                            Approved {formatDateTime(w.approvedAt)}
                          </span>
                        ) : null}
                      </Td>
                      <Td className="whitespace-nowrap">
                        <WithdrawalBadge status={w.status} />
                        {w.status === "APPROVED" ? (
                          <span className="mt-1 block text-xs text-[var(--av2-text-2)]">
                            Not paid yet
                          </span>
                        ) : null}
                      </Td>
                      <Td className="whitespace-nowrap max-md:hidden">
                        {formatDateTime(w.approvedAt)}
                      </Td>
                      {paged.rows.some((r) => r.status === "PENDING") ? (
                        <Td align="right">
                          {w.status === "PENDING" ? (
                            <Button
                              variant="danger"
                              onClick={() => handleCancel(w.id)}
                              aria-label={`Cancel withdrawal of ${formatTokens(w.amountTokens)}`}
                            >
                              Cancel
                            </Button>
                          ) : null}
                        </Td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </Table>
              <ListFooter {...paged} onPage={setPage} />
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
