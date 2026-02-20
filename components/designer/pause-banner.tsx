// -----------------------------------------------------------------------------
// @file: components/designer/pause-banner.tsx
// @purpose: Prominent banner shown on designer pages when paused
// @version: v1.0.0
// @status: active
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/toast-provider";
import { Button } from "@/components/ui/button";

type PauseStatus = {
  isPaused: boolean;
  pausedAt: string | null;
  pauseExpiresAt: string | null;
  pauseType: string | null;
  remainingMs: number | null;
  activeTicketCount: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRemainingTime(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "unknown";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PauseBanner() {
  const { showToast } = useToast();
  const [status, setStatus] = useState<PauseStatus | null>(null);
  const [resuming, setResuming] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/designer/availability", {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch {
      // silent — banner is non-critical
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    // Poll every 60s to detect auto-expiry
    const interval = setInterval(fetchStatus, 60_000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleResume = useCallback(async () => {
    setResuming(true);
    try {
      const res = await fetch("/api/designer/availability", {
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
      setResuming(false);
    }
  }, [showToast, status]);

  // Don't render anything if not paused or status not loaded yet
  if (!status?.isPaused) return null;

  const pausedSince = formatDate(status.pausedAt);

  const remaining =
    status.remainingMs != null && status.remainingMs > 0
      ? formatRemainingTime(status.remainingMs)
      : null;

  const message =
    status.pauseType === "MANUAL"
      ? `Paused since ${pausedSince}. Press Continue to resume accepting new tickets.`
      : remaining
        ? `Paused since ${pausedSince}. Auto-resumes in ${remaining}.`
        : "Pause expired. Press Continue to update your status.";

  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-amber-800">
            You are currently paused
          </p>
          <p className="mt-0.5 text-[11px] text-amber-700">{message}</p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={handleResume}
          loading={resuming}
          loadingText="Resuming…"
        >
          Continue working
        </Button>
      </div>
    </div>
  );
}
