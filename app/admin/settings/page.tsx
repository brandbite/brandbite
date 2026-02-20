// -----------------------------------------------------------------------------
// @file: app/admin/settings/page.tsx
// @purpose: Admin-facing page for managing app-level settings
// @version: v1.0.0
// @status: active
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/ui/toast-provider";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Button } from "@/components/ui/button";
import { FormInput } from "@/components/ui/form-field";
import { LoadingState } from "@/components/ui/loading-state";

type SettingsMap = Record<string, string | null>;

/** Human-readable labels and descriptions for each setting key. */
const SETTING_META: Record<
  string,
  { label: string; description: string; type: "number" | "text" }
> = {
  MIN_WITHDRAWAL_TOKENS: {
    label: "Minimum withdrawal (tokens)",
    description:
      "The minimum number of tokens a creative must request when creating a withdrawal. Creatives cannot submit a withdrawal below this amount.",
    type: "number",
  },
};

export default function AdminSettingsPage() {
  const { showToast } = useToast();

  const [settings, setSettings] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Local draft values for each setting (what the user types)
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // ---- Load settings ----
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/settings", { cache: "no-store" });
        const json = await res.json().catch(() => null);

        if (!res.ok) {
          if (res.status === 401)
            throw new Error("You must be signed in as an admin.");
          if (res.status === 403)
            throw new Error("You do not have permission to view settings.");
          throw new Error(
            json?.error || `Request failed with status ${res.status}`,
          );
        }

        if (!cancelled) {
          const map = (json?.settings ?? {}) as SettingsMap;
          setSettings(map);
          // Initialize drafts from current values
          const initial: Record<string, string> = {};
          for (const key of Object.keys(SETTING_META)) {
            initial[key] = map[key] ?? "";
          }
          setDrafts(initial);
        }
      } catch (err: any) {
        if (!cancelled) {
          const msg = err?.message || "Failed to load settings.";
          setError(msg);
          showToast({ type: "error", title: "Load failed", description: msg });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  // ---- Save a single setting ----
  const handleSave = async (key: string) => {
    const value = drafts[key]?.trim();
    if (!value) return;

    // Skip if nothing changed
    if (value === (settings[key] ?? "")) {
      showToast({
        type: "info",
        title: "No changes",
        description: "The value is already up to date.",
      });
      return;
    }

    setSavingKey(key);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          json?.error || `Request failed with status ${res.status}`,
        );
      }

      setSettings((prev) => ({ ...prev, [key]: value }));
      showToast({
        type: "success",
        title: "Setting updated",
        description: `${SETTING_META[key]?.label ?? key} has been saved.`,
      });
    } catch (err: any) {
      const msg = err?.message || "Failed to update setting.";
      showToast({ type: "error", title: "Save failed", description: msg });
    } finally {
      setSavingKey(null);
    }
  };

  const settingKeys = Object.keys(SETTING_META);

  return (
    <>
      {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-[#7a7a7a]">
            Global configuration for the Brandbite platform. Changes take effect
            immediately.
          </p>
        </div>

        {/* Error */}
        {error && (
          <InlineAlert variant="error" title="Something went wrong" className="mb-4">
            {error}
          </InlineAlert>
        )}

        {/* Settings cards */}
        {loading ? (
          <LoadingState message="Loading settings…" />
        ) : (
          <div className="space-y-4">
            {settingKeys.map((key) => {
              const meta = SETTING_META[key];
              const isSaving = savingKey === key;
              const currentValue = settings[key] ?? "";
              const draftValue = drafts[key] ?? "";
              const hasChanged = draftValue.trim() !== currentValue;

              return (
                <div
                  key={key}
                  className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-5 shadow-sm"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div className="flex-1">
                      <label
                        htmlFor={`setting-${key}`}
                        className="text-sm font-semibold text-[#424143]"
                      >
                        {meta.label}
                      </label>
                      <p className="mt-1 text-xs text-[#7a7a7a]">
                        {meta.description}
                      </p>
                      <FormInput
                        id={`setting-${key}`}
                        type={meta.type}
                        min={meta.type === "number" ? 1 : undefined}
                        value={draftValue}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [key]: e.target.value,
                          }))
                        }
                        className="mt-3 max-w-xs"
                      />
                      {currentValue && (
                        <p className="mt-1.5 text-[11px] text-[#9a9892]">
                          Current value:{" "}
                          <span className="font-semibold">{currentValue}</span>
                        </p>
                      )}
                    </div>

                    <Button
                      disabled={isSaving || !hasChanged || !draftValue.trim()}
                      onClick={() => handleSave(key)}
                      loading={isSaving}
                      loadingText="Saving…"
                    >
                      Save
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Debug tools */}
        <div className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight text-[#424143]">
            Debug tools
          </h2>
          <p className="mt-1 text-sm text-[#7a7a7a]">
            Internal tools for inspecting and configuring platform behaviour.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Link
              href="/debug/auto-assign"
              className="group rounded-2xl border border-[#e3e1dc] bg-white px-5 py-5 shadow-sm transition-colors hover:border-[#f15b2b]/40 hover:bg-[#fff5ef]"
            >
              <h3 className="text-sm font-semibold text-[#424143] group-hover:text-[#f15b2b]">
                Auto-assign configuration
              </h3>
              <p className="mt-1 text-xs text-[#7a7a7a]">
                View and toggle auto-assign settings at company and project
                level. Inspect per-project modes (inherit, on, off).
              </p>
            </Link>

            <Link
              href="/debug/assignment-log"
              className="group rounded-2xl border border-[#e3e1dc] bg-white px-5 py-5 shadow-sm transition-colors hover:border-[#f15b2b]/40 hover:bg-[#fff5ef]"
            >
              <h3 className="text-sm font-semibold text-[#424143] group-hover:text-[#f15b2b]">
                Assignment log
              </h3>
              <p className="mt-1 text-xs text-[#7a7a7a]">
                Review ticket assignment history and auto-assign decisions
                across the platform.
              </p>
            </Link>

            <Link
              href="/debug/demo-user"
              className="group rounded-2xl border border-[#e3e1dc] bg-white px-5 py-5 shadow-sm transition-colors hover:border-[#f15b2b]/40 hover:bg-[#fff5ef]"
            >
              <h3 className="text-sm font-semibold text-[#424143] group-hover:text-[#f15b2b]">
                Demo user switcher
              </h3>
              <p className="mt-1 text-xs text-[#7a7a7a]">
                Switch between demo personas to test different user roles and
                permissions.
              </p>
            </Link>
          </div>
        </div>
    </>
  );
}
