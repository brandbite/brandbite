// -----------------------------------------------------------------------------
// @file: app/designer/settings/page.tsx
// @purpose: Designer settings page with notification preferences
// -----------------------------------------------------------------------------

"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/toast-provider";
import { LoadingState } from "@/components/ui/loading-state";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PreferenceEntry = {
  type: string;
  enabled: boolean;
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

  // Load preferences
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/notifications/preferences");
        const json = await res.json().catch(() => null);
        if (!cancelled && json?.preferences) {
          setPreferences(json.preferences);
        }
      } catch {
        showToast({ type: "error", title: "Failed to load preferences" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [showToast]);

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

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-[#424143]">Settings</h1>
        <p className="mt-1 text-xs text-[#9a9892]">
          Manage your designer account preferences
        </p>
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
