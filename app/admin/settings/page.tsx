// -----------------------------------------------------------------------------
// @file: app/admin/settings/page.tsx
// @purpose: Admin-facing page for managing app-level platform settings.
//           Sectioned by domain (Finance, Talent funnel) so the page reads
//           as a small index of switches rather than a flat list. Quick
//           links at the top jump to the deeper admin tools that have
//           their own pages (Plans, Audit Log, Two-factor, etc.).
//
//           Demo-only debug links (auto-assign, assignment-log, demo-user
//           switcher) only render under DEMO_MODE — those routes redirect
//           to "/" in real prod by design (proxy.ts), so showing them in
//           the prod settings page produced a confusing redirect.
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { FormInput } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { LoadingState } from "@/components/ui/loading-state";
import { useToast } from "@/components/ui/toast-provider";

type SettingsMap = Record<string, string | null>;

type SectionKey = "finance" | "talent";

type SettingMeta = {
  label: string;
  description: string;
  type: "number" | "text" | "boolean";
  section: SectionKey;
  /** Optional input width override for short numeric controls. */
  inputClassName?: string;
};

/** Human-readable labels and descriptions for each setting key. */
const SETTING_META: Record<string, SettingMeta> = {
  MIN_WITHDRAWAL_TOKENS: {
    label: "Minimum withdrawal (tokens)",
    description:
      "The minimum number of tokens a creative must request when creating a withdrawal. Creatives cannot submit a withdrawal below this amount.",
    type: "number",
    section: "finance",
  },
  AUTO_PAYOUT_ENABLED: {
    label: "Auto-create weekly payout requests",
    description:
      "When on, a scheduled cron runs every Monday and auto-creates a PENDING withdrawal for each creative whose balance is at or above the threshold below. Admins still review + mark paid.",
    type: "boolean",
    section: "finance",
  },
  AUTO_PAYOUT_THRESHOLD_TOKENS: {
    label: "Auto-payout threshold (tokens)",
    description:
      "Creatives at or above this balance get a PENDING withdrawal request auto-created during the weekly run.",
    type: "number",
    section: "finance",
  },
  TALENT_APPLICATIONS_OPEN: {
    label: "Talent applications open",
    description:
      "Master switch for the public /talent submission form. When off, the form swaps to a closed-state banner and the API rejects new submissions with 503. Existing applications already in the queue are unaffected.",
    type: "boolean",
    section: "talent",
  },
};

const SECTION_TITLES: Record<SectionKey, { title: string; description: string }> = {
  finance: {
    title: "Finance",
    description: "Withdrawal floors and the weekly auto-payout cron.",
  },
  talent: {
    title: "Talent funnel",
    description:
      "Controls for the public /talent application form. The funnel is independent from existing hires — pausing intake doesn't affect creatives already on the platform.",
  },
};

/** Cards in the "Admin tools" quick-links block. Every link points at a
 *  page that already exists; this is a single index for the deeper
 *  workflows so admins don't have to hunt the sidebar. */
const QUICK_LINKS: { href: string; title: string; description: string; ownerOnly?: boolean }[] = [
  {
    href: "/admin/users",
    title: "Users",
    description: "List, drill-down, role changes, workload caps, hard-delete.",
  },
  {
    href: "/admin/audit-log",
    title: "Audit log",
    description: "Every privileged admin action with actor, target, outcome, and metadata.",
    ownerOnly: true,
  },
  {
    href: "/admin/settings/mfa",
    title: "Two-factor (admin)",
    description: "Enroll TOTP for the money-action MFA gate.",
    ownerOnly: true,
  },
  {
    href: "/admin/plans",
    title: "Plans",
    description: "Stripe-backed subscription plans + token allocations.",
  },
  {
    href: "/admin/payout-rules",
    title: "Payout rules",
    description: "Per-job-type creative payout percentages.",
  },
  {
    href: "/admin/job-types",
    title: "Job types & categories",
    description: "Catalog of work the platform supports + token costs.",
  },
  {
    href: "/admin/ai-settings",
    title: "AI settings",
    description: "AI-tool defaults and per-feature pricing.",
  },
  {
    href: "/admin/consultations/settings",
    title: "Consultations",
    description: "Pricing + availability for the customer consultation booking flow.",
  },
];

const DEMO_DEBUG_LINKS: { href: string; title: string; description: string }[] = [
  {
    href: "/debug/auto-assign",
    title: "Auto-assign configuration (demo only)",
    description:
      "View and toggle auto-assign at company / project level. Demo deploy only — real prod admins manage this per-company at /admin/companies.",
  },
  {
    href: "/debug/assignment-log",
    title: "Assignment log (demo only)",
    description:
      "Forensic view of recent auto-assign decisions. Demo deploy only — real prod admins use /admin/audit-log.",
  },
  {
    href: "/debug/demo-user",
    title: "Demo user switcher",
    description: "Switch between demo personas to test different role surfaces.",
  },
];

export default function AdminSettingsPage() {
  const { showToast } = useToast();

  const [settings, setSettings] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Local draft values for each setting (what the user types)
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Demo-debug section visibility — driven by the public env flag the
  // rest of the app already uses (e.g. lib/auth, demo-persona-banner).
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

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
          if (res.status === 401) throw new Error("You must be signed in as an admin.");
          if (res.status === 403) throw new Error("You do not have permission to view settings.");
          throw new Error(json?.error || `Request failed with status ${res.status}`);
        }

        if (!cancelled) {
          const map = (json?.settings ?? {}) as SettingsMap;
          setSettings(map);
          // Initialize drafts from current values, defaulting boolean
          // settings to "true" when the row is missing so the toggle
          // reflects the documented default rather than rendering an
          // empty / "false"-looking state.
          const initial: Record<string, string> = {};
          for (const key of Object.keys(SETTING_META)) {
            const meta = SETTING_META[key];
            if (meta.type === "boolean" && map[key] == null) {
              // TALENT_APPLICATIONS_OPEN defaults to "true" when unset;
              // AUTO_PAYOUT_ENABLED defaults to "false" historically.
              initial[key] = key === "TALENT_APPLICATIONS_OPEN" ? "true" : "false";
            } else {
              initial[key] = map[key] ?? "";
            }
          }
          setDrafts(initial);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Failed to load settings.";
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
        throw new Error(json?.error || `Request failed with status ${res.status}`);
      }

      setSettings((prev) => ({ ...prev, [key]: value }));
      showToast({
        type: "success",
        title: "Setting updated",
        description: `${SETTING_META[key]?.label ?? key} has been saved.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update setting.";
      showToast({ type: "error", title: "Save failed", description: msg });
    } finally {
      setSavingKey(null);
    }
  };

  // Group settings by section for the sectioned render.
  const sectionedKeys = (Object.keys(SETTING_META) as Array<keyof typeof SETTING_META>).reduce(
    (acc, key) => {
      const sec = SETTING_META[key].section;
      if (!acc[sec]) acc[sec] = [];
      acc[sec].push(key as string);
      return acc;
    },
    {} as Record<SectionKey, string[]>,
  );

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-[var(--bb-text-secondary)]">
          Global configuration for the Brandbite platform. Changes take effect immediately.
        </p>
      </div>

      {error && (
        <InlineAlert variant="error" title="Something went wrong" className="mb-4">
          {error}
        </InlineAlert>
      )}

      {loading ? (
        <LoadingState message="Loading settings…" />
      ) : (
        <div className="space-y-8">
          {(Object.keys(SECTION_TITLES) as SectionKey[]).map((section) => {
            const keys = sectionedKeys[section] ?? [];
            if (keys.length === 0) return null;
            return (
              <section key={section}>
                <header className="mb-3">
                  <h2 className="text-base font-semibold text-[var(--bb-secondary)]">
                    {SECTION_TITLES[section].title}
                  </h2>
                  <p className="mt-0.5 text-xs text-[var(--bb-text-muted)]">
                    {SECTION_TITLES[section].description}
                  </p>
                </header>
                <div className="space-y-3">
                  {keys.map((key) => {
                    const meta = SETTING_META[key];
                    const isSaving = savingKey === key;
                    const currentValue = settings[key] ?? "";
                    const draftValue = drafts[key] ?? "";
                    const hasChanged = draftValue.trim() !== currentValue;

                    return (
                      <div
                        key={key}
                        className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)] px-5 py-5 shadow-sm"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                          <div className="flex-1">
                            <label
                              htmlFor={`setting-${key}`}
                              className="text-sm font-semibold text-[var(--bb-secondary)]"
                            >
                              {meta.label}
                            </label>
                            <p className="mt-1 text-xs text-[var(--bb-text-secondary)]">
                              {meta.description}
                            </p>
                            {meta.type === "boolean" ? (
                              <label className="mt-3 flex items-center gap-2 text-xs text-[var(--bb-secondary)]">
                                <input
                                  type="checkbox"
                                  id={`setting-${key}`}
                                  checked={draftValue === "true"}
                                  onChange={(e) =>
                                    setDrafts((prev) => ({
                                      ...prev,
                                      [key]: e.target.checked ? "true" : "false",
                                    }))
                                  }
                                  className="h-3.5 w-3.5 rounded border-[var(--bb-border-input)] text-[var(--bb-primary)] focus:ring-[var(--bb-primary)]"
                                />
                                <span>{draftValue === "true" ? "Enabled" : "Disabled"}</span>
                              </label>
                            ) : (
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
                                className={`mt-3 ${meta.inputClassName ?? "max-w-xs"}`}
                              />
                            )}
                            {currentValue && (
                              <p className="mt-1.5 text-[11px] text-[var(--bb-text-tertiary)]">
                                Current value: <span className="font-semibold">{currentValue}</span>
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
              </section>
            );
          })}
        </div>
      )}

      {/* Admin tools — quick links to the deeper config pages that have
          their own routes already. Mirrors the sidebar but keeps related
          tools grouped on one screen so admins don't go hunting. */}
      <section className="mt-10">
        <h2 className="text-base font-semibold tracking-tight text-[var(--bb-secondary)]">
          Admin tools
        </h2>
        <p className="mt-1 text-sm text-[var(--bb-text-secondary)]">
          Direct links to the deeper config pages.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)] px-5 py-5 shadow-sm transition-colors hover:border-[var(--bb-primary)]/40 hover:bg-[var(--bb-primary-light)]"
            >
              <h3 className="text-sm font-semibold text-[var(--bb-secondary)] group-hover:text-[var(--bb-primary)]">
                {link.title}
                {link.ownerOnly && (
                  <span className="ml-1.5 align-middle text-[9px] font-medium text-[var(--bb-text-muted)]">
                    OWNER
                  </span>
                )}
              </h3>
              <p className="mt-1 text-xs text-[var(--bb-text-secondary)]">{link.description}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Demo-only tools. The /debug/* routes are demo-only by design
          (proxy.ts redirects them to "/" in real prod), so we hide the
          whole section unless we're on the demo build. The card on prod
          used to redirect to the landing page, which was confusing. */}
      {isDemoMode && (
        <section className="mt-10">
          <h2 className="text-base font-semibold tracking-tight text-[var(--bb-secondary)]">
            Demo tools
          </h2>
          <p className="mt-1 text-sm text-[var(--bb-text-secondary)]">
            Available only on the demo deployment.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {DEMO_DEBUG_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)] px-5 py-5 shadow-sm transition-colors hover:border-[var(--bb-primary)]/40 hover:bg-[var(--bb-primary-light)]"
              >
                <h3 className="text-sm font-semibold text-[var(--bb-secondary)] group-hover:text-[var(--bb-primary)]">
                  {link.title}
                </h3>
                <p className="mt-1 text-xs text-[var(--bb-text-secondary)]">{link.description}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
