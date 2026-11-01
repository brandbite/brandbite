// -----------------------------------------------------------------------------
// @file: app/admin/withdrawals/page.tsx
// @purpose: Admin-facing overview & controls for creative withdrawals.
//           List on the left, detail panel of the selected request on the
//           right. The panel shows the lifecycle (Requested → Approved →
//           Paid, or Rejected) and holds only the action valid for the
//           current stage. APPROVE / MARK_PAID keep the L2 typed-phrase
//           confirm + L4 MFA retry; L6 co-approval progress is surfaced.
// @version: v2.0.0
// @status: active
// @lastUpdate: 2026-11-01
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useToast } from "@/components/ui/toast-provider";
import { useSessionRole } from "@/lib/hooks/use-session-role";
import { ConfirmTypedPhraseModal } from "@/components/admin/confirm-typed-phrase-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { MfaChallengeModal, type MfaChallengeInfo } from "@/components/admin/mfa-challenge-modal";
import {
  Avatar,
  Badge,
  Button,
  Callout,
  Card,
  DASH,
  DetailPanel,
  EmptyState,
  FilterBar,
  FilterChips,
  KpiCard,
  PageHeader,
  PanelSection,
  SearchInput,
  Select,
  Skeleton,
  SplitView,
  Table,
  TableFooter,
  Td,
  Th,
  Tr,
  fmt,
  plural,
  type Tone,
} from "@/components/admin/v2/ui";
import { IconClock, IconCoins, IconDocument } from "@/components/admin/v2/icons";
import { IconWithdrawals } from "@/components/navigation/nav-icons";

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
  // L6 — 2-person approval state. `needsCoApproval` is true above the
  // configured threshold; the UI uses this + `approverIds` to render
  // "1 of 2 owners approved" progress. Optional at runtime: the PATCH
  // response's `withdrawal` doesn't carry it, so always read it with `?.`.
  coApproval: {
    needsCoApproval: boolean;
    requiredApprovals: number;
    currentApprovalCount: number;
    approverIds: string[];
    approverEmails: string[];
  };
};

type AdminWithdrawalsResponse = {
  stats: {
    totalRequested: number;
    totalPaid: number;
    pendingCount: number;
    withdrawalsCount: number;
  };
  coApproval?: {
    thresholdTokens: number;
    requiredApprovals: number;
  };
  withdrawals: AdminWithdrawal[];
};

type AdminWithdrawalAction = "APPROVE" | "REJECT" | "MARK_PAID";

type StatusFilter = "ALL" | WithdrawalStatus;

const STATUS_META: Record<WithdrawalStatus, { label: string; tone: Tone; next: string }> = {
  PENDING: { label: "Pending", tone: "amber", next: "Needs approval" },
  APPROVED: { label: "Approved", tone: "green", next: "Record payment" },
  PAID: { label: "Paid", tone: "blue", next: "Completed" },
  REJECTED: { label: "Rejected", tone: "red", next: "Closed" },
};

const creativeLabelOf = (w: AdminWithdrawal) => w.creative.name || w.creative.email;

const formatDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" }) : DASH;

const formatTime = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

const formatDateTime = (iso: string | null | undefined) =>
  iso ? `${formatDate(iso)} · ${formatTime(iso)}` : DASH;

function Tokens({ n }: { n: number | null | undefined }) {
  return (
    <span className="whitespace-nowrap tabular-nums">
      {fmt(n)}
      {typeof n === "number" && (
        <span className="ml-1 text-sm font-normal text-[var(--av2-text-2)]">
          {plural(n, "token", "tokens")}
        </span>
      )}
    </span>
  );
}

function IconCheckCircle() {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </svg>
  );
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

function IconArrowRight() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/** Same rule as the shared OwnerOnlyBanner, drawn with the v2 Callout. */
function OwnerOnlyNote({ action }: { action: string }) {
  const { isSiteOwner, loading } = useSessionRole();
  if (loading || isSiteOwner) return null;
  return (
    <div className="mb-6" role="note">
      <Callout tone="warning" title="Site owner only">
        Site admins can view this page, but only the site owner can {action}. Requests from admins
        will be rejected with a 403.
      </Callout>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lifecycle stepper (local primitive — ui.tsx has no stepper)
// ---------------------------------------------------------------------------

type StepState = "done" | "current" | "upcoming" | "rejected";

type Step = { key: string; label: string; state: StepState; detail?: ReactNode };

function StepMarker({ state }: { state: StepState }) {
  if (state === "done") {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--av2-text)] text-[var(--av2-surface)]">
        <svg
          width={12}
          height={12}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="m5 12.5 4.5 4.5L19 7.5" />
        </svg>
      </span>
    );
  }
  if (state === "rejected") {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--av2-error)] text-white">
        <svg
          width={11}
          height={11}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          aria-hidden
        >
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </span>
    );
  }
  if (state === "current") {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-[var(--av2-accent)] bg-[var(--av2-surface)]">
        <span className="h-2 w-2 rounded-full bg-[var(--av2-accent)]" />
      </span>
    );
  }
  return (
    <span className="block h-5 w-5 rounded-full border-2 border-[var(--av2-border)] bg-[var(--av2-surface)]" />
  );
}

const STEP_SR: Record<StepState, string> = {
  done: "completed",
  current: "current step",
  upcoming: "not started",
  rejected: "rejected",
};

function Stepper({ steps }: { steps: Step[] }) {
  return (
    <ol aria-label="Request lifecycle">
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        return (
          <li
            key={s.key}
            aria-current={s.state === "current" ? "step" : undefined}
            className="relative flex gap-3 pb-5 last:pb-0"
          >
            {!last && (
              <span
                aria-hidden
                className={`absolute top-6 bottom-1 left-[9px] w-0.5 rounded-full ${
                  s.state === "done" ? "bg-[var(--av2-text)]" : "bg-[var(--av2-border)]"
                }`}
              />
            )}
            <span className="relative mt-0.5 shrink-0">
              <StepMarker state={s.state} />
            </span>
            <div className="min-w-0">
              <p
                className={`text-sm font-semibold ${
                  s.state === "upcoming"
                    ? "text-[var(--av2-text-2)]"
                    : s.state === "rejected"
                      ? "text-[var(--av2-error-text)]"
                      : ""
                }`}
              >
                {s.label}
                <span className="sr-only"> ({STEP_SR[s.state]})</span>
              </p>
              {s.detail && (
                <div className="mt-0.5 text-sm text-[var(--av2-text-2)]">{s.detail}</div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function coApprovalText(w: AdminWithdrawal) {
  const c = w.coApproval;
  if (!c?.needsCoApproval) return null;
  return `${fmt(c.currentApprovalCount)} of ${fmt(c.requiredApprovals)} owners approved`;
}

function lifecycleSteps(w: AdminWithdrawal): Step[] {
  const requested: Step = {
    key: "requested",
    label: "Requested",
    state: "done",
    detail: formatDateTime(w.createdAt),
  };
  switch (w.status) {
    case "PENDING":
      return [
        requested,
        {
          key: "approved",
          label: "Awaiting approval",
          state: "current",
          detail: coApprovalText(w) ?? "Not approved yet",
        },
        { key: "paid", label: "Payment not recorded", state: "upcoming" },
      ];
    case "APPROVED":
      return [
        requested,
        {
          key: "approved",
          label: "Approved",
          state: "done",
          detail: formatDateTime(w.approvedAt),
        },
        {
          key: "paid",
          label: "Awaiting payment record",
          state: "current",
          detail: "Mark as paid once the payout has been sent.",
        },
      ];
    case "PAID":
      return [
        requested,
        {
          key: "approved",
          label: "Approved",
          state: "done",
          detail: formatDateTime(w.approvedAt),
        },
        {
          key: "paid",
          label: "Paid",
          state: "done",
          detail: w.paidAt ? formatDateTime(w.paidAt) : "Payment recorded",
        },
      ];
    case "REJECTED":
      return [
        requested,
        {
          key: "rejected",
          label: "Rejected",
          state: "rejected",
          detail: w.adminRejectReason || "No payout will be made for this request.",
        },
      ];
  }
}

export default function AdminWithdrawalsPage() {
  const { showToast } = useToast();

  const [data, setData] = useState<AdminWithdrawalsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [creativeFilter, setCreativeFilter] = useState<string>("ALL");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Confirmation modal state for money-moving actions (L2). REJECT is direct —
  // not a financial commitment — so it doesn't go through this flow.
  const [pendingConfirm, setPendingConfirm] = useState<{
    id: string;
    action: "APPROVE" | "MARK_PAID";
    amountTokens: number;
    creativeLabel: string;
  } | null>(null);

  // MFA state (L4). When a money-action POST returns 202 { requiresMfa },
  // we stash the challenge + a retry closure here. The MfaChallengeModal
  // opens; on verify success, retry() re-runs the original action.
  const [pendingMfa, setPendingMfa] = useState<{
    challenge: MfaChallengeInfo;
    retry: () => Promise<void>;
  } | null>(null);

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
            throw new Error("You must be signed in as an admin to view this page.");
          }
          if (res.status === 403) {
            throw new Error("You do not have permission to view admin withdrawals.");
          }
          const msg = (json as any)?.error || `Request failed with status ${res.status}`;
          throw new Error(msg);
        }

        if (!cancelled) {
          setData(json as AdminWithdrawalsResponse);
        }
      } catch (err: any) {
        console.error("Admin withdrawals fetch error:", err);
        if (!cancelled) {
          const message = err?.message || "Failed to load admin withdrawals.";

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

  const withdrawals = useMemo(() => data?.withdrawals ?? [], [data]);

  const creatives = useMemo(() => {
    const list = Array.from(new Set(withdrawals.map((w) => creativeLabelOf(w))));
    return list;
  }, [withdrawals]);

  const statusCounts = useMemo(() => {
    const counts: Record<WithdrawalStatus, number> = {
      PENDING: 0,
      APPROVED: 0,
      PAID: 0,
      REJECTED: 0,
    };
    for (const w of withdrawals) counts[w.status] += 1;
    return counts;
  }, [withdrawals]);

  // KPI sums derived from the fetched list (the list carries every status,
  // and unlike `stats` it is kept current after each PATCH).
  const sums = useMemo(() => {
    const s = { requested: 0, pending: 0, approved: 0, paid: 0 };
    for (const w of withdrawals) {
      s.requested += w.amountTokens;
      if (w.status === "PENDING") s.pending += w.amountTokens;
      if (w.status === "APPROVED") s.approved += w.amountTokens;
      if (w.status === "PAID") s.paid += w.amountTokens;
    }
    return s;
  }, [withdrawals]);

  const filteredWithdrawals = useMemo(() => {
    const q = query.trim().toLowerCase();
    return withdrawals.filter((w) => {
      if (statusFilter !== "ALL" && w.status !== statusFilter) {
        return false;
      }
      const creativeLabel = creativeLabelOf(w);
      if (creativeFilter !== "ALL" && creativeLabel !== creativeFilter) {
        return false;
      }
      if (
        q &&
        !(w.creative.name ?? "").toLowerCase().includes(q) &&
        !w.creative.email.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [withdrawals, statusFilter, creativeFilter, query]);

  const filtersActive = statusFilter !== "ALL" || creativeFilter !== "ALL" || query.trim() !== "";
  const resetFilters = () => {
    setStatusFilter("ALL");
    setCreativeFilter("ALL");
    setQuery("");
  };

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
          description: "This withdrawal is now marked as paid and the record has been updated.",
        };
      default:
        return {
          title: "Withdrawal updated",
          description: "The withdrawal status has been updated.",
        };
    }
  };

  const handleAction = async (id: string, action: AdminWithdrawalAction, confirmation?: string) => {
    setActionLoadingId(`${id}:${action}`);
    setError(null);

    try {
      const res = await fetch("/api/admin/withdrawals", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, action, confirmation }),
      });

      const json = await res.json().catch(() => null);

      // L4 — 202 means server is asking for a fresh MFA code. Stash the
      // retry and let the MfaChallengeModal drive: on verify success it
      // calls retry() which re-invokes this same handleAction with the
      // same args, and the server now sees recent MFA → proceeds.
      if (res.status === 202 && (json as any)?.requiresMfa) {
        setPendingMfa({
          challenge: {
            method: (json as any).method as "email" | "totp" | undefined,
            challengeId: (json as any).challengeId as string | undefined,
            maskedEmail: (json as any).maskedEmail as string | undefined,
            expiresAt: (json as any).expiresAt as string | undefined,
            actionTag: (json as any).actionTag as string | undefined,
          },
          retry: () => handleAction(id, action, confirmation),
        });
        return;
      }

      // L6 — 202 with awaitingCoApproval means the first signature landed
      // on a large withdrawal and another owner still needs to sign. The
      // approval row is already in the DB; the UI just needs to refetch
      // so the progress renders, and tell the user what happened.
      if (res.status === 202 && (json as any)?.awaitingCoApproval) {
        const msg =
          (json as any)?.message ||
          "Your approval is recorded. Another site owner must also approve this withdrawal.";
        showToast({
          type: "success",
          title: "Awaiting co-approval",
          description: msg,
        });
        // Refetch the list so the co-approval progress updates.
        const reload = await fetch("/api/admin/withdrawals", { cache: "no-store" });
        if (reload.ok) {
          const reloadJson = (await reload
            .json()
            .catch(() => null)) as AdminWithdrawalsResponse | null;
          if (reloadJson) setData(reloadJson);
        }
        return;
      }

      if (!res.ok) {
        const msg = (json as any)?.error || `Failed to update withdrawal (status ${res.status})`;
        throw new Error(msg);
      }

      const updated = (json as any).withdrawal as AdminWithdrawal | undefined;
      const updatedStats = (json as any).stats as AdminWithdrawalsResponse["stats"] | undefined;

      if (updated) {
        setData((prev) =>
          prev
            ? {
                stats: updatedStats ?? prev.stats,
                withdrawals: prev.withdrawals.map((w) => (w.id === updated.id ? updated : w)),
              }
            : prev,
        );
      } else if (updatedStats) {
        // Got stats back but no individual withdrawal — just update stats.
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
      const message = err?.message || "Failed to update withdrawal status.";

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

  const isActionLoading = (id: string, action: AdminWithdrawalAction) =>
    actionLoadingId === `${id}:${action}`;

  const selected = withdrawals.find((w) => w.id === selectedId) ?? null;

  // Below xl the panel stacks under the list; bring it into view on select.
  useEffect(() => {
    if (!selectedId || window.innerWidth >= 1280) return;
    document
      .getElementById("withdrawal-panel-top")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedId]);
  const threshold = data?.coApproval?.thresholdTokens;

  // ---------------------------------------------------------------------------
  // Detail panel
  // ---------------------------------------------------------------------------

  // Rejecting closes the request for good — confirm first.
  const [rejectTarget, setRejectTarget] = useState<AdminWithdrawal | null>(null);
  const confirmReject = async () => {
    if (!rejectTarget) return;
    const id = rejectTarget.id;
    setRejectTarget(null);
    await handleAction(id, "REJECT");
  };

  const renderPanel = (w: AdminWithdrawal) => {
    const meta = STATUS_META[w.status];
    const creativeLabel = creativeLabelOf(w);
    const co = w.coApproval;
    const busy = actionLoadingId !== null;

    const openConfirm = (action: "APPROVE" | "MARK_PAID") =>
      setPendingConfirm({
        id: w.id,
        action,
        amountTokens: w.amountTokens,
        creativeLabel,
      });

    const nextStatus =
      w.status === "PENDING"
        ? STATUS_META.APPROVED
        : w.status === "APPROVED"
          ? STATUS_META.PAID
          : null;

    const footer = nextStatus ? (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-[var(--av2-text-2)]">Next status</span>
          <span className="flex items-center gap-2">
            <Badge tone={meta.tone}>{meta.label}</Badge>
            <span className="text-[var(--av2-text-2)]">
              <IconArrowRight />
            </span>
            <Badge tone={nextStatus.tone}>{nextStatus.label}</Badge>
          </span>
        </div>
        {w.status === "PENDING" ? (
          <>
            <Button
              variant="primary"
              className="w-full"
              disabled={busy}
              aria-busy={isActionLoading(w.id, "APPROVE")}
              onClick={() => openConfirm("APPROVE")}
            >
              {isActionLoading(w.id, "APPROVE") ? "Approving…" : "Approve request"}
            </Button>
            <Button
              variant="danger"
              className="w-full"
              disabled={busy}
              aria-busy={isActionLoading(w.id, "REJECT")}
              onClick={() => setRejectTarget(w)}
            >
              {isActionLoading(w.id, "REJECT") ? "Rejecting…" : "Reject request"}
            </Button>
          </>
        ) : (
          <Button
            variant="primary"
            className="w-full"
            disabled={busy}
            aria-busy={isActionLoading(w.id, "MARK_PAID")}
            onClick={() => openConfirm("MARK_PAID")}
          >
            {isActionLoading(w.id, "MARK_PAID") ? "Marking…" : "Mark as paid"}
          </Button>
        )}
      </div>
    ) : undefined;

    return (
      <DetailPanel
        title={
          w.status === "PENDING"
            ? "Review request"
            : w.status === "APPROVED"
              ? "Record payment"
              : "Request details"
        }
        onClose={() => setSelectedId(null)}
        closeLabel="Close request details"
        footer={footer}
      >
        <span id="withdrawal-panel-top" aria-hidden className="block scroll-mt-40" />
        <div className="flex items-start gap-3">
          <Avatar name={creativeLabel} size={48} tone="green" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold">{creativeLabel}</p>
            <p className="truncate text-sm text-[var(--av2-text-2)]">{w.creative.email}</p>
          </div>
          <Badge tone={meta.tone}>{meta.label}</Badge>
        </div>

        <div className="mt-5 border-b border-[var(--av2-border)] pb-5">
          <p className="text-[32px] leading-10 font-bold tracking-tight tabular-nums">
            {fmt(w.amountTokens)}{" "}
            <span className="text-xl font-semibold">
              {plural(w.amountTokens, "token", "tokens")}
            </span>
          </p>
          <p className="mt-1 text-sm text-[var(--av2-text-2)]">Requested amount</p>
        </div>

        <div className="mt-5">
          <PanelSection title="Lifecycle">
            <Stepper steps={lifecycleSteps(w)} />
          </PanelSection>

          {co?.needsCoApproval && (w.status === "PENDING" || w.status === "APPROVED") && (
            <PanelSection title="Co-approval">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium tabular-nums">
                  {fmt(co.currentApprovalCount)} of {fmt(co.requiredApprovals)} site owners
                </span>
                {co.currentApprovalCount >= co.requiredApprovals || w.status === "APPROVED" ? (
                  <Badge tone="green">Complete</Badge>
                ) : (
                  <Badge tone="amber">
                    {co.currentApprovalCount > 0 ? "Awaiting second owner" : "Awaiting owners"}
                  </Badge>
                )}
              </div>
              <div
                role="progressbar"
                aria-label="Owner approvals"
                aria-valuemin={0}
                aria-valuemax={co.requiredApprovals}
                aria-valuenow={co.currentApprovalCount}
                className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--av2-track)]"
              >
                <div
                  className="h-full rounded-full bg-[var(--av2-accent)]"
                  style={{
                    width: `${Math.min(
                      100,
                      (co.currentApprovalCount / Math.max(1, co.requiredApprovals)) * 100,
                    )}%`,
                  }}
                />
              </div>
              <p className="mt-3 text-sm text-[var(--av2-text-2)]">
                {co.approverEmails.length > 0
                  ? `Signed by ${co.approverEmails.join(", ")}`
                  : "No owner has signed yet."}
              </p>
              {threshold != null && (
                <p className="mt-1 text-xs text-[var(--av2-text-2)]">
                  Requests of {fmt(threshold)} tokens or more need {fmt(co.requiredApprovals)} site
                  owners to approve.
                </p>
              )}
            </PanelSection>
          )}

          <PanelSection>
            {w.status === "PENDING" && (
              <Callout tone="warning" title="Approve this request?">
                Approval moves the request to Approved and commits the platform to paying it. It
                does not send a payment — record that separately once the payout is sent.
              </Callout>
            )}
            {w.status === "APPROVED" && (
              <Callout tone="info" title="Record the payment">
                Only mark as paid after the payout has actually been sent. This moves the request to
                Paid and cannot be reversed from the UI.
              </Callout>
            )}
            {w.status === "PAID" && (
              <Callout tone="success" title="Payout recorded">
                This request is complete. No further action is needed.
              </Callout>
            )}
            {w.status === "REJECTED" && (
              <Callout tone="info" title="Request rejected">
                This request is closed. The creative sees the rejection in their history.
              </Callout>
            )}
          </PanelSection>
        </div>
      </DetailPanel>
    );
  };

  const panel = selected ? renderPanel(selected) : null;

  const kpiLoading = loading && !data;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <PageHeader
        title="Withdrawals"
        description="Review creative requests, approve them, then record each payout."
      />

      <OwnerOnlyNote action="approve withdrawals or mark them as paid" />

      {error && (
        <div className="mb-6">
          <Callout tone="error" title="Error">
            {error}
          </Callout>
        </div>
      )}

      <SplitView panel={panel}>
        <div
          className={`mb-6 grid gap-4 sm:grid-cols-2 ${selected ? "2xl:grid-cols-4" : "xl:grid-cols-4"}`}
        >
          <KpiCard
            icon={<IconDocument />}
            tone="peach"
            label="Requested"
            value={kpiLoading ? DASH : <Tokens n={data ? sums.requested : null} />}
            hint={
              data
                ? `${fmt(withdrawals.length)} ${plural(withdrawals.length, "request", "requests")} in total`
                : "Sum of all withdrawal requests"
            }
          />
          <KpiCard
            icon={<IconClock />}
            tone="amber"
            label="Pending approval"
            value={kpiLoading ? DASH : <Tokens n={data ? sums.pending : null} />}
            hint={
              data
                ? `${fmt(statusCounts.PENDING)} ${plural(statusCounts.PENDING, "request", "requests")}`
                : "Waiting for approval"
            }
          />
          <KpiCard
            icon={<IconCheckCircle />}
            tone="green"
            label="Approved, unpaid"
            value={kpiLoading ? DASH : <Tokens n={data ? sums.approved : null} />}
            hint={
              data
                ? `${fmt(statusCounts.APPROVED)} ${plural(statusCounts.APPROVED, "request", "requests")}`
                : "Waiting for a payment record"
            }
          />
          <KpiCard
            icon={<IconCoins />}
            tone="blue"
            label="Paid"
            value={kpiLoading ? DASH : <Tokens n={data ? sums.paid : null} />}
            hint={
              data
                ? `${fmt(statusCounts.PAID)} ${plural(statusCounts.PAID, "request", "requests")}`
                : "Paid out to creatives"
            }
          />
        </div>

        <Card padding="none">
          <div className="space-y-4 px-6 pt-5">
            <FilterChips
              label="Filter by status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "ALL", label: "All", count: data ? withdrawals.length : null },
                {
                  value: "PENDING",
                  label: "Pending",
                  count: data ? statusCounts.PENDING : null,
                },
                {
                  value: "APPROVED",
                  label: "Approved",
                  count: data ? statusCounts.APPROVED : null,
                },
                { value: "PAID", label: "Paid", count: data ? statusCounts.PAID : null },
                {
                  value: "REJECTED",
                  label: "Rejected",
                  count: data ? statusCounts.REJECTED : null,
                },
              ]}
            />
            <FilterBar
              trailing={
                data
                  ? `${fmt(filteredWithdrawals.length)} ${plural(filteredWithdrawals.length, "request", "requests")}`
                  : null
              }
            >
              <SearchInput
                className="min-w-[200px] flex-1"
                value={query}
                onChange={setQuery}
                placeholder="Search creative"
                label="Search by creative name or email"
              />
              <div className="w-full sm:w-48">
                <Select
                  aria-label="Filter by creative"
                  value={creativeFilter}
                  onChange={(e) => setCreativeFilter(e.target.value)}
                >
                  <option value="ALL">All creatives</option>
                  {creatives.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </Select>
              </div>
            </FilterBar>
          </div>

          {loading && !data ? (
            <div className="space-y-3 border-t border-[var(--av2-border)] px-6 py-5" role="status">
              <span className="sr-only">Loading withdrawals…</span>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : withdrawals.length === 0 ? (
            <div className="border-t border-[var(--av2-border)]">
              <EmptyState
                icon={<IconWithdrawals width={28} height={28} />}
                title="No withdrawal requests yet"
                description="Requests appear here when a creative asks to withdraw their token balance."
              />
            </div>
          ) : filteredWithdrawals.length === 0 ? (
            <div className="border-t border-[var(--av2-border)]">
              <EmptyState
                title="No withdrawals match these filters"
                description="Try a different status, creative or search."
                action={<Button onClick={resetFilters}>Clear filters</Button>}
              />
            </div>
          ) : (
            <Table label="Withdrawal requests">
              <thead>
                <tr>
                  <Th>Creative</Th>
                  <Th align="right">Amount</Th>
                  <Th>Requested</Th>
                  <Th>Status</Th>
                  <Th>Next step</Th>
                  <Th align="right">
                    <span className="sr-only">Open</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {filteredWithdrawals.map((w) => {
                  const creativeLabel = creativeLabelOf(w);
                  const meta = STATUS_META[w.status];
                  const coText = w.status === "PENDING" ? coApprovalText(w) : null;
                  return (
                    <Tr
                      key={w.id}
                      selected={w.id === selectedId}
                      onSelect={() => setSelectedId(w.id)}
                      label={`${creativeLabel}, ${fmt(w.amountTokens)} tokens, ${meta.label}`}
                    >
                      <Td>
                        <div className="flex items-center gap-3">
                          <Avatar name={creativeLabel} size={36} tone="green" />
                          <div className="min-w-0">
                            <div className="truncate font-semibold">{creativeLabel}</div>
                            <div className="truncate text-xs text-[var(--av2-text-2)]">
                              {w.creative.email}
                            </div>
                          </div>
                        </div>
                      </Td>
                      <Td align="right" className="whitespace-nowrap">
                        <span className="text-base font-semibold">{fmt(w.amountTokens)}</span>
                        <span className="ml-1 text-xs text-[var(--av2-text-2)]">
                          {plural(w.amountTokens, "token", "tokens")}
                        </span>
                      </Td>
                      <Td className="whitespace-nowrap">
                        <div>{formatDate(w.createdAt)}</div>
                        <div className="text-xs text-[var(--av2-text-2)] tabular-nums">
                          {formatTime(w.createdAt)}
                        </div>
                      </Td>
                      <Td>
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                        {coText && (
                          <div
                            className="mt-1 text-xs whitespace-nowrap text-[var(--av2-text-2)] tabular-nums"
                            title={
                              w.coApproval.approverEmails.length > 0
                                ? `Signed by: ${w.coApproval.approverEmails.join(", ")}`
                                : undefined
                            }
                          >
                            {coText}
                          </div>
                        )}
                      </Td>
                      <Td
                        className={`whitespace-nowrap ${
                          w.status === "PENDING" || w.status === "APPROVED"
                            ? "font-medium"
                            : "text-[var(--av2-text-2)]"
                        }`}
                      >
                        {meta.next}
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

          {data && withdrawals.length > 0 && (
            <TableFooter>
              <span className="tabular-nums">
                Showing {fmt(filteredWithdrawals.length)} of {fmt(withdrawals.length)}{" "}
                {plural(withdrawals.length, "request", "requests")}
              </span>
              {filtersActive ? (
                <Button size="sm" variant="ghost" onClick={resetFilters}>
                  Clear filters
                </Button>
              ) : (
                !selected && <span>Select a request to review it.</span>
              )}
            </TableFooter>
          )}
        </Card>

        <div className="mt-6">
          <Callout tone="info" title="Approval and payment are separate steps.">
            Approve a request first, then mark it as paid once the payout has been sent.
          </Callout>
        </div>
      </SplitView>

      {/* Typed-phrase confirmation for APPROVE / MARK_PAID (Security Plan L2).
          REJECT stays direct — rejecting isn't a financial commitment. */}
      <ConfirmDialog
        open={rejectTarget !== null}
        onClose={() => setRejectTarget(null)}
        onConfirm={confirmReject}
        variant="danger"
        title="Reject this withdrawal?"
        description={
          rejectTarget
            ? `${creativeLabelOf(rejectTarget)}'s request for ${rejectTarget.amountTokens.toLocaleString()} tokens will be rejected. It can't be approved or paid afterwards.`
            : undefined
        }
        confirmLabel="Reject request"
        cancelLabel="Keep pending"
      />
      <ConfirmTypedPhraseModal
        open={pendingConfirm !== null}
        onClose={() => setPendingConfirm(null)}
        title={
          pendingConfirm?.action === "APPROVE" ? "Approve withdrawal?" : "Mark withdrawal as paid?"
        }
        description={
          pendingConfirm ? (
            <>
              <p>
                {pendingConfirm.action === "APPROVE" ? (
                  <>
                    You are about to <strong>approve</strong> a withdrawal of{" "}
                    <strong>{pendingConfirm.amountTokens.toLocaleString()} tokens</strong> for{" "}
                    <strong>{pendingConfirm.creativeLabel}</strong>. Approval commits the platform
                    to paying them; the creative&apos;s balance is debited when you mark it as paid.
                  </>
                ) : (
                  <>
                    You are about to record that{" "}
                    <strong>{pendingConfirm.amountTokens.toLocaleString()} tokens</strong> worth has
                    been <strong>paid out</strong> to{" "}
                    <strong>{pendingConfirm.creativeLabel}</strong>. This moves the withdrawal to
                    PAID and cannot be reversed from the UI.
                  </>
                )}
              </p>
            </>
          ) : null
        }
        requiredPhrase={pendingConfirm?.action === "APPROVE" ? "APPROVE" : "PAID"}
        submitLabel={pendingConfirm?.action === "APPROVE" ? "Approve" : "Mark as paid"}
        submitTone={pendingConfirm?.action === "APPROVE" ? "primary" : "warning"}
        onSubmit={async () => {
          if (!pendingConfirm) return;
          const { id, action } = pendingConfirm;
          const phrase = action === "APPROVE" ? "APPROVE" : "PAID";
          await handleAction(id, action, phrase);
          setPendingConfirm(null);
        }}
      />

      {/* L4 — MFA second factor. Opens when a money-action POST returned
          202. On verify success, re-runs the original action. */}
      <MfaChallengeModal
        open={pendingMfa !== null}
        challenge={pendingMfa?.challenge ?? null}
        onClose={() => setPendingMfa(null)}
        onVerified={async () => {
          if (!pendingMfa) return;
          const retry = pendingMfa.retry;
          setPendingMfa(null);
          await retry();
        }}
      />
    </>
  );
}
