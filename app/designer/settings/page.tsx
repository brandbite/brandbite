// -----------------------------------------------------------------------------
// @file: app/designer/settings/page.tsx
// @purpose: Designer settings page with skills & notification preferences
// -----------------------------------------------------------------------------

"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/toast-provider";
import { LoadingState } from "@/components/ui/loading-state";

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

const DESIGNER_PREFS: {
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

export default function DesignerSettingsPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState<PreferenceEntry[]>([]);
  const [togglingType, setTogglingType] = useState<string | null>(null);

  // Skills state
  const [jobTypes, setJobTypes] = useState<SkillJobType[]>([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [savingSkills, setSavingSkills] = useState(false);
  const skillSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load preferences + skills
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [prefsRes, skillsRes] = await Promise.all([
          fetch("/api/notifications/preferences"),
          fetch("/api/designer/skills"),
        ]);
        const prefsJson = await prefsRes.json().catch(() => null);
        const skillsJson = await skillsRes.json().catch(() => null);

        if (!cancelled) {
          if (prefsJson?.preferences) setPreferences(prefsJson.preferences);
          if (skillsJson?.jobTypes) setJobTypes(skillsJson.jobTypes);
          if (skillsJson?.selectedJobTypeIds)
            setSelectedSkillIds(skillsJson.selectedJobTypeIds);
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
          const res = await fetch("/api/designer/skills", {
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

  // Build a lookup for the designer-relevant types
  const prefMap = new Map(preferences.map((p) => [p.type, p.enabled]));
  const skillSet = new Set(selectedSkillIds);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-[#424143]">Settings</h1>
        <p className="mt-1 text-xs text-[#9a9892]">
          Manage your designer account preferences
        </p>
      </div>

      {/* Skills & expertise */}
      <div className="mb-4 rounded-2xl border border-[#e3e1dc] bg-white px-5 py-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#424143]">
              Skills &amp; expertise
            </h2>
            <p className="mt-0.5 text-[11px] text-[#9a9892]">
              Select the job types you can handle. You will only be
              auto-assigned tickets that match your skills.
            </p>
          </div>
          {savingSkills && (
            <span className="text-[10px] text-[#9a9892]">Saving...</span>
          )}
        </div>

        <div className="mt-4 space-y-1">
          {jobTypes.length === 0 && (
            <p className="px-3 py-3 text-xs text-[#9a9892]">
              No job types available yet.
            </p>
          )}
          {jobTypes.map((jt) => {
            const checked = skillSet.has(jt.id);
            return (
              <label
                key={jt.id}
                className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-[#f5f3f0]/50"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => handleSkillToggle(jt.id)}
                  className="h-4 w-4 shrink-0 rounded border-[#d0cec9] text-[#f15b2b] accent-[#f15b2b] focus:ring-[#f15b2b]"
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[#424143]">
                    {jt.name}
                  </p>
                  {jt.description && (
                    <p className="mt-0.5 text-[10px] text-[#9a9892]">
                      {jt.description}
                    </p>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Notification preferences */}
      <div className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-5 shadow-sm">
        <h2 className="text-sm font-semibold text-[#424143]">
          Notification preferences
        </h2>
        <p className="mt-0.5 text-[11px] text-[#9a9892]">
          Choose which events you want to be notified about
        </p>

        <div className="mt-4 space-y-1">
          {DESIGNER_PREFS.map((pref) => {
            const enabled = prefMap.get(pref.type) ?? true;
            const isToggling = togglingType === pref.type;

            return (
              <div
                key={pref.type}
                className="flex items-center justify-between rounded-xl px-3 py-3 transition-colors hover:bg-[#f5f3f0]/50"
              >
                <div className="mr-4 min-w-0">
                  <p className="text-xs font-medium text-[#424143]">
                    {pref.label}
                  </p>
                  <p className="mt-0.5 text-[10px] text-[#9a9892]">
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
                    enabled ? "bg-[#f15b2b]" : "bg-[#d0cec9]"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 translate-y-0.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
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
