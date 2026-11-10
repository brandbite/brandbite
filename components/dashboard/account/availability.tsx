// -----------------------------------------------------------------------------
// @file: components/dashboard/account/availability.tsx
// @purpose: Creative availability: pause new assignments for a chosen duration,
//           resume, and a one-line status strip. Same /api/creative/availability
//           calls and active-ticket confirmation as before,
//           on the dashboard design language.
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useState } from "react";

import { Button, Callout, Card, CardTitle, IconTile, Skeleton } from "@/components/admin/v2/ui";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast-provider";

type PauseType = "1_HOUR" | "7_DAYS" | "MANUAL";

type PauseStatus = {
  isPaused: boolean;
  pausedAt: string | null;
  pauseExpiresAt: string | null;
  pauseType: string | null;
  remainingMs: number | null;
  activeTicketCount: number;
};

const PAUSE_OPTIONS: { value: PauseType; label: string; description: string }[] = [
  { value: "1_HOUR", label: "1 hour", description: "Auto-resume after 1 hour" },
  { value: "7_DAYS", label: "7 days", description: "Auto-resume after 7 days" },
  {
    value: "MANUAL",
    label: "Until I resume",
    description: "Stay paused until you press Continue working",
  },
];

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

function pausedDescription(status: PauseStatus): string {
  if (status.pauseType === "MANUAL") {
    return `Paused since ${formatDate(status.pausedAt)}. No expiry set.`;
  }
  if (status.remainingMs != null && status.remainingMs > 0) {
    return `Auto-resumes in ${formatRemaining(status.remainingMs)}.`;
  }
  return "Pause has expired.";
}

export function useCreativeAvailability() {
  const { showToast } = useToast();
  const [status, setStatus] = useState<PauseStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [acting, setActing] = useState(false);
  const [selectedType, setSelectedType] = useState<PauseType>("1_HOUR");
  const [showConfirm, setShowConfirm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const res = await fetch("/api/creative/availability", { cache: "no-store" });
      if (!res.ok) throw new Error();
      setStatus(await res.json());
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
        setStatus(await res.json());
        showToast({
          type: "info",
          title: "Paused",
          description: "No new requests will be assigned to you.",
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

  const requestPause = useCallback(() => {
    // Active tickets stay with the creative, so make sure they know that first.
    if (status && status.activeTicketCount > 0) setShowConfirm(true);
    else void executePause();
  }, [status, executePause]);

  const resume = useCallback(async () => {
    setActing(true);
    try {
      const res = await fetch("/api/creative/availability", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resume" }),
      });
      if (res.ok) {
        const data = await res.json();
        setStatus((prev) => ({ ...data, activeTicketCount: prev?.activeTicketCount ?? 0 }));
        showToast({
          type: "success",
          title: "Welcome back!",
          description: "You are now accepting new requests.",
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
  }, [showToast]);

  return {
    status,
    loading,
    loadFailed,
    acting,
    selectedType,
    setSelectedType,
    showConfirm,
    setShowConfirm,
    load,
    executePause,
    requestPause,
    resume,
  };
}

type Availability = ReturnType<typeof useCreativeAvailability>;

/** One-line status above the settings tabs. Says nothing it doesn't know. */
export function AvailabilityStrip({
  availability,
  onManage,
}: {
  availability: Availability;
  onManage: () => void;
}) {
  const { status, loading, loadFailed, acting, resume } = availability;
  if (loading) return <Skeleton className="h-24 rounded-2xl" />;
  if (loadFailed || !status) return null;

  const paused = status.isPaused;
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <IconTile tone={paused ? "amber" : "green"} size={44} round>
            <span
              aria-hidden
              className="h-3 w-3 rounded-full"
              style={{ background: paused ? "var(--av2-fill-amber)" : "var(--av2-fill-green)" }}
            />
          </IconTile>
          <div className="min-w-0">
            <p className="text-base font-semibold">
              {paused ? "New assignments paused" : "Receiving new assignments"}
            </p>
            <p className="text-sm text-[var(--av2-text-2)]">
              {paused ? pausedDescription(status) : "You're available for new work."}
            </p>
          </div>
        </div>
        {paused ? (
          <Button onClick={() => void resume()} disabled={acting} aria-busy={acting || undefined}>
            {acting ? "Resuming…" : "Continue working"}
          </Button>
        ) : (
          <Button onClick={onManage}>Pause new assignments</Button>
        )}
      </div>
    </Card>
  );
}

export function AvailabilityPanel({ availability }: { availability: Availability }) {
  const {
    status,
    loading,
    loadFailed,
    acting,
    selectedType,
    setSelectedType,
    showConfirm,
    setShowConfirm,
    load,
    executePause,
    requestPause,
    resume,
  } = availability;

  const activeCount = status?.activeTicketCount ?? 0;

  return (
    <Card>
      <CardTitle description="Pause to stop receiving new request assignments. Your existing work is not affected.">
        Availability
      </CardTitle>

      <div className="mt-5">
        {loading ? (
          <Skeleton className="h-40" />
        ) : loadFailed || !status ? (
          <Callout
            tone="error"
            title="We couldn't load your availability"
            action={<Button onClick={() => void load()}>Try again</Button>}
          >
            Your current status is unknown, so nothing can be changed here yet.
          </Callout>
        ) : status.isPaused ? (
          <div className="space-y-4">
            <Callout tone="warning" title="You are currently paused">
              {pausedDescription(status)}
            </Callout>
            <Button
              variant="primary"
              onClick={() => void resume()}
              disabled={acting}
              aria-busy={acting || undefined}
            >
              {acting ? "Resuming…" : "Continue working"}
            </Button>
          </div>
        ) : (
          <fieldset className="max-w-xl">
            <legend className="mb-2 text-sm font-medium">Pause new assignments for</legend>
            <div className="space-y-2">
              {PAUSE_OPTIONS.map((opt) => {
                const checked = selectedType === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border px-4 py-2 transition-colors ${
                      checked
                        ? "border-[var(--av2-accent)] bg-[var(--av2-selected)]"
                        : "border-[var(--av2-border)] hover:bg-[var(--av2-bg)]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="pauseType"
                      value={opt.value}
                      checked={checked}
                      onChange={() => setSelectedType(opt.value)}
                      className="h-4 w-4 shrink-0 accent-[var(--av2-accent-strong)] dark:[color-scheme:dark]"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{opt.label}</span>
                      <span className="block text-sm text-[var(--av2-text-2)]">
                        {opt.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            <Button
              className="mt-4"
              onClick={requestPause}
              disabled={acting}
              aria-busy={acting || undefined}
            >
              {acting ? "Pausing…" : "Pause working"}
            </Button>
          </fieldset>
        )}
      </div>

      <ConfirmDialog
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={() => void executePause()}
        title="Pause with active requests?"
        description={`You have ${activeCount} active request${
          activeCount > 1 ? "s" : ""
        }. Pausing will prevent new assignments but won't affect your current work. Continue?`}
        confirmLabel="Pause"
        cancelLabel="Cancel"
        variant="warning"
        loading={acting}
      />
    </Card>
  );
}
