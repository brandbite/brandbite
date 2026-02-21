// -----------------------------------------------------------------------------
// @file: app/creative/settings/page.tsx
// @purpose: Creative settings page with skills & notification preferences
// -----------------------------------------------------------------------------

"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/toast-provider";
import { LoadingState } from "@/components/ui/loading-state";
import { PauseControl } from "@/components/creative/pause-control";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PreferenceEntry = {
  type: string;
  enabled: boolean;
};

type SkillJobType = {
  id: string;
  name: string;
  description: string | null;
};

type PayoutTier = {
  id: string;
  name: string;
  description: string | null;
  minCompletedTickets: number;
  timeWindowDays: number;
  payoutPercent: number;
  completedInWindow: number;
  qualified: boolean;
};

const CREATIVE_PREFS: {
  type: string;
  label: string;
  description: string;
}[] = [
  {
    type: "FEEDBACK_SUBMITTED",
    label: "Customer submitted feedback",
    description: "Get notified when a customer submits revision notes on your work",
  },
  {
    type: "TICKET_ASSIGNED",
    label: "New ticket assigned",
    description: "Get notified when a new ticket is assigned to you",
  },
  {
    type: "TICKET_STATUS_CHANGED",
    label: "Ticket status changed",
    description: "Get notified when a ticket's status is updated",
  },
  {
    type: "TICKET_COMPLETED",
    label: "Ticket completed",
    description: "Get notified when a ticket is marked as done",
  },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CreativeSettingsPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState<PreferenceEntry[]>([]);
  const [togglingType, setTogglingType] = useState<string | null>(null);

  // Skills state
  const [jobTypes, setJobTypes] = useState<SkillJobType[]>([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [savingSkills, setSavingSkills] = useState(false);
  const skillSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Payout tiers state
  const [payoutTiers, setPayoutTiers] = useState<PayoutTier[]>([]);
  const [currentPayoutPercent, setCurrentPayoutPercent] = useState<number>(60);
  const [currentTierName, setCurrentTierName] = useState<string | null>(null);
  const [basePayoutPercent, setBasePayoutPercent] = useState<number>(60);

  // Load preferences + skills
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [prefsRes, skillsRes, tierRes] = await Promise.all([
          fetch("/api/notifications/preferences"),
          fetch("/api/creative/skills"),
          fetch("/api/creative/payout-tier"),
        ]);
        const prefsJson = await prefsRes.json().catch(() => null);
        const skillsJson = await skillsRes.json().catch(() => null);
        const tierJson = await tierRes.json().catch(() => null);

        if (!cancelled) {
          if (prefsJson?.preferences) setPreferences(prefsJson.preferences);
          if (skillsJson?.jobTypes) setJobTypes(skillsJson.jobTypes);
          if (skillsJson?.selectedJobTypeIds)
            setSelectedSkillIds(skillsJson.selectedJobTypeIds);
          if (tierJson?.tiers) {
            setPayoutTiers(tierJson.tiers);
            setCurrentPayoutPercent(tierJson.currentPayoutPercent ?? 60);
            setCurrentTierName(tierJson.currentTierName ?? null);
            setBasePayoutPercent(tierJson.basePayoutPercent ?? 60);
          }
        }
      } catch {
        showToast({ type: "error", title: "Failed to load settings" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [showToast]);

  // Save skills (debounced)
  const saveSkills = useCallback(
    (nextIds: string[]) => {
      if (skillSaveTimer.current) clearTimeout(skillSaveTimer.current);
      skillSaveTimer.current = setTimeout(async () => {
        setSavingSkills(true);
        try {
          const res = await fetch("/api/creative/skills", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobTypeIds: nextIds }),
          });
          if (!res.ok) throw new Error();
          const json = await res.json();
          if (json?.selectedJobTypeIds)
            setSelectedSkillIds(json.selectedJobTypeIds);
        } catch {
          showToast({ type: "error", title: "Failed to save skills" });
        } finally {
          setSavingSkills(false);
        }
      }, 400);
    },
    [showToast],
  );

  // Toggle a skill
  const handleSkillToggle = useCallback(
    (jobTypeId: string) => {
      setSelectedSkillIds((prev) => {
        const next = prev.includes(jobTypeId)
          ? prev.filter((id) => id !== jobTypeId)
          : [...prev, jobTypeId];
        saveSkills(next);
        return next;
      });
    },
    [saveSkills],
  );

  // Toggle preference
  const handleToggle = useCallback(
    async (type: string, currentEnabled: boolean) => {
      setTogglingType(type);
      const newEnabled = !currentEnabled;

      // Optimistic update
      setPreferences((prev) =>
        prev.map((p) => (p.type === type ? { ...p, enabled: newEnabled } : p)),
      );

      try {
        const res = await fetch("/api/notifications/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, enabled: newEnabled }),
        });
        if (!res.ok) throw new Error();
      } catch {
        // Revert on failure
        setPreferences((prev) =>
          prev.map((p) =>
            p.type === type ? { ...p, enabled: currentEnabled } : p,
          ),
        );
        showToast({ type: "error", title: "Failed to update preference" });
      } finally {
        setTogglingType(null);
      }
    },
    [showToast],
  );

  if (loading) {
    return <LoadingState message="Loading settings..." />;
  }

  // Build a lookup for the creative-relevant types
  const prefMap = new Map(preferences.map((p) => [p.type, p.enabled]));
  const skillSet = new Set(selectedSkillIds);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-[var(--bb-secondary)]">Settings</h1>
        <p className="mt-1 text-xs text-[var(--bb-text-tertiary)]">
          Manage your creative account preferences
        </p>
      </div>

      {/* Availability / Pause control */}
      <PauseControl />

      {/* Skills & expertise */}
      <div className="mb-4 rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[var(--bb-secondary)]">
              Skills &amp; expertise
            </h2>
            <p className="mt-0.5 text-[11px] text-[var(--bb-text-tertiary)]">
              Select the job types you can handle. You will only be
              auto-assigned tickets that match your skills.
            </p>
          </div>
          {savingSkills && (
            <span className="text-[10px] text-[var(--bb-text-tertiary)]">Saving...</span>
          )}
        </div>

        <div className="mt-4 space-y-1">
          {jobTypes.length === 0 && (
            <p className="px-3 py-3 text-xs text-[var(--bb-text-tertiary)]">
              No job types available yet.
            </p>
          )}
          {jobTypes.map((jt) => {
            const checked = skillSet.has(jt.id);
            return (
              <label
                key={jt.id}
                className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-[var(--bb-bg-card)]/50"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => handleSkillToggle(jt.id)}
                  className="h-4 w-4 shrink-0 rounded border-[var(--bb-border-input)] text-[var(--bb-primary)] accent-[var(--bb-primary)] focus:ring-[var(--bb-primary)]"
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[var(--bb-secondary)]">
                    {jt.name}
                  </p>
                  {jt.description && (
                    <p className="mt-0.5 text-[10px] text-[var(--bb-text-tertiary)]">
                      {jt.description}
                    </p>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Payout tiers */}
      <div className="mb-4 rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[var(--bb-secondary)]">Payout tiers</h2>
            <p className="mt-0.5 text-[11px] text-[var(--bb-text-tertiary)]">
              Complete more tickets to unlock higher payout rates. Your current rate
              is{" "}
              <span className="font-semibold text-[var(--bb-secondary)]">
                {currentPayoutPercent}%
              </span>
              {currentTierName && (
                <span>
                  {" "}
                  (<span className="font-medium text-[#8B5CF6]">{currentTierName}</span>)
                </span>
              )}
              .
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {/* Base rate */}
          <div
            className={`flex items-center justify-between rounded-xl px-3 py-3 transition-colors ${
              !currentTierName
                ? "border border-[#8B5CF6]/30 bg-purple-50 dark:bg-purple-950/30"
                : "bg-[var(--bb-bg-card)]/50"
            }`}
          >
            <div className="min-w-0">
              <p className="text-xs font-medium text-[var(--bb-secondary)]">Base Rate</p>
              <p className="mt-0.5 text-[10px] text-[var(--bb-text-tertiary)]">
                Default payout for all creatives
              </p>
            </div>
            <span
              className={`text-sm font-bold ${
                !currentTierName ? "text-[#8B5CF6]" : "text-[var(--bb-text-tertiary)]"
              }`}
            >
              {basePayoutPercent}%
            </span>
          </div>

          {payoutTiers.map((tier) => {
            const progress = Math.min(
              Math.round(
                (tier.completedInWindow / tier.minCompletedTickets) * 100,
              ),
              100,
            );
            const windowLabel =
              tier.timeWindowDays % 365 === 0
                ? `${tier.timeWindowDays / 365} year${tier.timeWindowDays / 365 > 1 ? "s" : ""}`
                : tier.timeWindowDays % 30 === 0
                  ? `${tier.timeWindowDays / 30} month${tier.timeWindowDays / 30 > 1 ? "s" : ""}`
                  : `${tier.timeWindowDays} days`;

            return (
              <div
                key={tier.id}
                className={`rounded-xl px-3 py-3 transition-colors ${
                  tier.qualified
                    ? "border border-[#8B5CF6]/30 bg-purple-50 dark:bg-purple-950/30"
                    : "bg-[var(--bb-bg-card)]/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium text-[var(--bb-secondary)]">
                        {tier.name}
                      </p>
                      {tier.qualified && (
                        <span className="inline-flex rounded-full bg-[#8B5CF6] px-2 py-0.5 text-[9px] font-semibold text-white">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[10px] text-[var(--bb-text-tertiary)]">
                      {tier.minCompletedTickets} tickets in {windowLabel}
                    </p>
                  </div>
                  <span
                    className={`text-sm font-bold ${
                      tier.qualified ? "text-[#8B5CF6]" : "text-[var(--bb-text-tertiary)]"
                    }`}
                  >
                    {tier.payoutPercent}%
                  </span>
                </div>

                {/* Progress bar */}
                {!tier.qualified && (
                  <div className="mt-2">
                    <div className="h-1.5 w-full rounded-full bg-[var(--bb-border)]">
                      <div
                        className="h-full rounded-full bg-[#8B5CF6] transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-[var(--bb-text-tertiary)]">
                      {tier.completedInWindow} / {tier.minCompletedTickets}{" "}
                      tickets completed
                    </p>
                  </div>
                )}
              </div>
            );
          })}

          {payoutTiers.length === 0 && (
            <p className="px-3 py-3 text-xs text-[var(--bb-text-tertiary)]">
              No payout tiers configured yet.
            </p>
          )}
        </div>
      </div>

      {/* Notification preferences */}
      <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-5 shadow-sm">
        <h2 className="text-sm font-semibold text-[var(--bb-secondary)]">
          Notification preferences
        </h2>
        <p className="mt-0.5 text-[11px] text-[var(--bb-text-tertiary)]">
          Choose which events you want to be notified about
        </p>

        <div className="mt-4 space-y-1">
          {CREATIVE_PREFS.map((pref) => {
            const enabled = prefMap.get(pref.type) ?? true;
            const isToggling = togglingType === pref.type;

            return (
              <div
                key={pref.type}
                className="flex items-center justify-between rounded-xl px-3 py-3 transition-colors hover:bg-[var(--bb-bg-card)]/50"
              >
                <div className="mr-4 min-w-0">
                  <p className="text-xs font-medium text-[var(--bb-secondary)]">
                    {pref.label}
                  </p>
                  <p className="mt-0.5 text-[10px] text-[var(--bb-text-tertiary)]">
                    {pref.description}
                  </p>
                </div>

                {/* Toggle switch */}
                <button
                  type="button"
                  role="switch"
                  aria-label={pref.label}
                  aria-checked={enabled}
                  disabled={isToggling}
                  onClick={() => handleToggle(pref.type, enabled)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
                    enabled ? "bg-[var(--bb-primary)]" : "bg-[var(--bb-border-input)]"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 translate-y-0.5 rounded-full bg-[var(--bb-bg-page)] shadow-sm transition-transform duration-200 ${
                      enabled ? "translate-x-[18px]" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
