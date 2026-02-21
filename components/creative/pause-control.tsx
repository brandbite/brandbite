// -----------------------------------------------------------------------------
// @file: components/creative/pause-control.tsx
// @purpose: Pause/resume controls with duration picker for creative settings
// @version: v1.0.0
// @status: active
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/toast-provider";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PauseType = "1_HOUR" | "7_DAYS" | "MANUAL";

type PauseStatus = {
  isPaused: boolean;
  pausedAt: string | null;
  pauseExpiresAt: string | null;
  pauseType: string | null;
  remainingMs: number | null;
  activeTicketCount: number;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAUSE_OPTIONS: {
  value: PauseType;
  label: string;
  description: string;
}[] = [
  {
    value: "1_HOUR",
    label: "1 hour",
    description: "Auto-resume after 1 hour",
  },
  {
    value: "7_DAYS",
    label: "7 days",
    description: "Auto-resume after 7 days",
  },
  {
    value: "MANUAL",
    label: "Until I resume",
    description: "Stay paused until you press Continue",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null): string {
  if (!iso) return "unknown";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRemaining(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 24) {
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h`;
  }
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PauseControl() {
  const { showToast } = useToast();

  const [status, setStatus] = useState<PauseStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [selectedType, setSelectedType] = useState<PauseType>("1_HOUR");
  const [showConfirm, setShowConfirm] = useState(false);

  // ---- Fetch current status ----
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/creative/availability", {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // ---- Pause action ----
  const executePause = useCallback(async () => {
    setActing(true);
    setShowConfirm(false);
    try {
      const res = await fetch("/api/creative/availability", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pause", pauseType: selectedType }),
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        showToast({
          type: "info",
          title: "Paused",
          description: "No new tickets will be assigned to you.",
        });
      } else {
        const err = await res.json().catch(() => null);
        showToast({
          type: "error",
          title: "Pause failed",
          description: err?.error ?? "Something went wrong.",
        });
      }
    } catch {
      showToast({
        type: "error",
        title: "Pause failed",
        description: "Something went wrong. Please try again.",
      });
    } finally {
      setActing(false);
    }
  }, [selectedType, showToast]);

  const handlePauseClick = useCallback(() => {
    // If there are active tickets, show confirmation first
    if (status && status.activeTicketCount > 0) {
      setShowConfirm(true);
    } else {
      executePause();
    }
  }, [status, executePause]);

  // ---- Resume action ----
  const handleResume = useCallback(async () => {
    setActing(true);
    try {
      const res = await fetch("/api/creative/availability", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resume" }),
      });
      if (res.ok) {
        const data = await res.json();
        setStatus({
          ...data,
          activeTicketCount: status?.activeTicketCount ?? 0,
        });
        showToast({
          type: "success",
          title: "Welcome back!",
          description: "You are now accepting new tickets.",
        });
      } else {
        showToast({
          type: "error",
          title: "Resume failed",
          description: "Could not update your availability.",
        });
      }
    } catch {
      showToast({
        type: "error",
        title: "Resume failed",
        description: "Something went wrong. Please try again.",
      });
    } finally {
      setActing(false);
    }
  }, [showToast, status]);

  // ---- Render ----

  if (loading) return null;

  return (
    <>
      <div className="mb-4 rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-5 shadow-sm">
        <h2 className="text-sm font-semibold text-[var(--bb-secondary)]">Availability</h2>
        <p className="mt-0.5 text-[11px] text-[var(--bb-text-tertiary)]">
          Pause to stop receiving new ticket assignments. Your existing work is
          not affected.
        </p>

        {status?.isPaused ? (
          /* ------- Currently paused ------- */
          <div className="mt-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-xs font-medium text-amber-800">
                You are currently paused
              </p>
              <p className="mt-1 text-[11px] text-amber-700">
                {status.pauseType === "MANUAL"
                  ? `Paused since ${formatDate(status.pausedAt)}. No expiry set.`
                  : status.remainingMs != null && status.remainingMs > 0
                    ? `Auto-resumes in ${formatRemaining(status.remainingMs)}.`
                    : "Pause has expired."}
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={handleResume}
              loading={acting}
              loadingText="Resuming…"
              className="mt-3"
            >
              Continue working
            </Button>
          </div>
        ) : (
          /* ------- Not paused ------- */
          <div className="mt-4 space-y-2">
            {PAUSE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-[var(--bb-bg-card)]/50"
              >
                <input
                  type="radio"
                  name="pauseType"
                  value={opt.value}
                  checked={selectedType === opt.value}
                  onChange={() => setSelectedType(opt.value)}
                  className="h-4 w-4 accent-[var(--bb-primary)]"
                />
                <div>
                  <p className="text-xs font-medium text-[var(--bb-secondary)]">
                    {opt.label}
                  </p>
                  <p className="text-[10px] text-[var(--bb-text-tertiary)]">
                    {opt.description}
                  </p>
                </div>
              </label>
            ))}
            <Button
              variant="secondary"
              size="sm"
              onClick={handlePauseClick}
              loading={acting}
              loadingText="Pausing…"
              className="mt-2"
            >
              Pause working
            </Button>
          </div>
        )}
      </div>

      {/* Confirmation dialog for active tickets */}
      <ConfirmDialog
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={executePause}
        title="Pause with active tickets?"
        description={`You have ${status?.activeTicketCount ?? 0} active ticket${
          (status?.activeTicketCount ?? 0) > 1 ? "s" : ""
        }. Pausing will prevent new assignments but won't affect your current work. Continue?`}
        confirmLabel="Pause"
        cancelLabel="Cancel"
        variant="warning"
        loading={acting}
      />
    </>
  );
}
