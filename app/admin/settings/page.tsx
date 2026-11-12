// -----------------------------------------------------------------------------
// @file: app/admin/settings/page.tsx
// @purpose: Admin-facing page for managing app-level platform settings.
//           Admin design language v1: one topic tab per domain (Finance,
//           Talent funnel, Notifications, Features) so only one group of
//           switches is visible at a time, with a "Related tools" card on the
//           right that links to the deeper admin tools that have their own
//           pages (Plans, Audit Log, Two-factor, etc.).
//
//           Save semantics are unchanged: every setting still has its own
//           Save button and sends one PATCH { key, value } to
//           /api/admin/settings. Drafts survive switching tabs.
//
//           Demo-only debug links (auto-assign, assignment-log, demo-user
//           switcher) only render under DEMO_MODE — those routes redirect
//           to "/" in real prod by design (proxy.ts), so showing them in
//           the prod settings page produced a confusing redirect.
// @version: v2.0.0
// @status: active
// @lastUpdate: 2026-11-01
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useState, type SVGProps } from "react";
import Link from "next/link";

import {
  Badge,
  Button,
  Callout,
  Card,
  CardTitle,
  PageHeader,
  Select,
  Skeleton,
  Switch,
  TabPanel,
  Tabs,
  TextInput,
} from "@/components/admin/v2/ui";
import { IconArrowUpRight } from "@/components/admin/v2/icons";
import { useUnsavedChanges } from "@/components/admin/v2/unsaved-changes";
import { useToast } from "@/components/ui/toast-provider";
import { ENGAGEMENT_LABELS } from "@/lib/engagement/switches";

type SettingsMap = Record<string, string | null>;

type SectionKey = "finance" | "talent" | "notifications" | "features" | "engagement";

type SettingMeta = {
  label: string;
  description: string;
  type: "number" | "text" | "boolean" | "select";
  section: SectionKey;
  /** Optional input width override for short numeric controls. */
  inputClassName?: string;
  /** Options for `type: "select"`. */
  options?: { value: string; label: string }[];
  /** Default value used when the AppSetting row is missing. */
  defaultValue?: string;
  /** Unit shown inside numeric inputs. */
  suffix?: string;
};

/** Human-readable labels and descriptions for each setting key. */
const SETTING_META: Record<string, SettingMeta> = {
  MIN_WITHDRAWAL_TOKENS: {
    label: "Minimum withdrawal (tokens)",
    description:
      "The minimum number of tokens a creative must request when creating a withdrawal. Creatives cannot submit a withdrawal below this amount.",
    type: "number",
    section: "finance",
    suffix: "tokens",
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
    suffix: "tokens",
  },
  TALENT_APPLICATIONS_OPEN: {
    label: "Talent applications open",
    description:
      "Master switch for the public /talent submission form. When off, the form swaps to a closed-state banner and the API rejects new submissions with 503. Existing applications already in the queue are unaffected.",
    type: "boolean",
    section: "talent",
  },
  ADMIN_EVENT_EMAILS_ENABLED: {
    label: "Email site owners on system events",
    description:
      "When on, every SITE_OWNER receives an email when a meaningful event happens — new feedback submitted, new request created, new company finishes onboarding, new payment received, new talent application, new withdrawal request. Default on. Mute globally with this toggle when the inbox gets noisy.",
    type: "boolean",
    section: "notifications",
  },
  TAGS_ENABLED: {
    label: "Request tags",
    description:
      "Per-company tagging system on requests. When off, the TagMultiSelect is hidden on the new-request form, the tag-management section is hidden in /customer/settings, and tag chips don't render on any board card or detail page. Existing tag data is preserved — flipping back on restores everything instantly. Currently shipped off until the board filter UI lands.",
    type: "boolean",
    section: "features",
  },
  AI_TICKETS_MODE: {
    label: "AI request mode (Work with AI)",
    description:
      "Controls the 'Work with AI' option on the new-request form and the AI generation endpoints. Off = hidden for everyone (default — there's no working AI generation API yet). Test = visible to site admins only, so you can validate the AI provider before launch. On = available to all customers.",
    type: "select",
    section: "features",
    defaultValue: "off",
    options: [
      { value: "off", label: "Off — hidden for everyone" },
      { value: "on", label: "On — all customers" },
    ],
  },
  ENGAGEMENT_LIVE_PROGRESS: {
    label: ENGAGEMENT_LABELS.liveProgress,
    description:
      "Customers see a step tracker on each request (Queued, In progress, In review, Done) and a note with a running clock while their creative's timer is on.",
    type: "boolean",
    section: "engagement",
  },
  ENGAGEMENT_CREATIVE_PROGRESS: {
    label: ENGAGEMENT_LABELS.creativeProgress,
    description:
      "Creatives see their streak of requests approved without a revision on their overview, and how many requests are left to the next payout tier.",
    type: "boolean",
    section: "engagement",
  },
  ENGAGEMENT_THANK_YOUS: {
    label: ENGAGEMENT_LABELS.thankYous,
    description:
      "When approving a delivery, customers can add one-tap thank-you tags. The creative gets a notification and the tags collect on their profile. Tags already given are kept when this is off.",
    type: "boolean",
    section: "engagement",
  },
  ENGAGEMENT_BRIEF_STRENGTH: {
    label: ENGAGEMENT_LABELS.briefStrength,
    description:
      "The new-request form shows a meter that fills as the customer adds a reference, dimensions and a moodboard.",
    type: "boolean",
    section: "engagement",
  },
  ENGAGEMENT_BRAND_PROFILE: {
    label: ENGAGEMENT_LABELS.brandProfile,
    description:
      "Customers see a card on their overview showing how complete their brand setup is, with the next step to take.",
    type: "boolean",
    section: "engagement",
  },
  ENGAGEMENT_BRAND_SOUNDTRACK: {
    label: ENGAGEMENT_LABELS.brandSoundtrack,
    description:
      "Owners and project managers can add a Spotify playlist or album to their company. The assigned creative sees it on a request while it is in progress.",
    type: "boolean",
    section: "engagement",
  },
  ENGAGEMENT_FOCUS_PLAYLIST: {
    label: ENGAGEMENT_LABELS.focusPlaylist,
    description:
      "While a request is in progress, a card suggests a playlist that fits the request's mood. Each creative can turn the suggestions off for themselves.",
    type: "boolean",
    section: "engagement",
  },
  ENGAGEMENT_MONTHLY_RECAP: {
    label: ENGAGEMENT_LABELS.monthlyRecap,
    description:
      "Early each month customers see an overview card summing up last month (requests delivered, tokens used and an estimated agency equivalent), and owners and project managers get it by email. A company with nothing delivered gets nothing.",
    type: "boolean",
    section: "engagement",
  },
  SOUNDTRACK_PLAYLISTS_ENERGETIC: {
    label: "Extra playlists: Energetic · Upbeat",
    description:
      "Optional. brandbite already has its own playlist for energetic requests, so this can stay empty. Add Spotify playlist or album links here only if you want more choices for this mood; separate several with commas.",
    type: "text",
    section: "engagement",
    inputClassName: "max-w-none",
  },
  SOUNDTRACK_PLAYLISTS_MINIMAL: {
    label: "Extra playlists: Minimal · Calm",
    description:
      "Optional. brandbite already has its own playlist for minimal requests, so this can stay empty. Add Spotify playlist or album links here only if you want more choices for this mood; separate several with commas.",
    type: "text",
    section: "engagement",
    inputClassName: "max-w-none",
  },
  SOUNDTRACK_PLAYLISTS_LUXURY: {
    label: "Extra playlists: Luxury · Elegant",
    description:
      "Optional. brandbite already has its own playlist for luxury requests, so this can stay empty. Add Spotify playlist or album links here only if you want more choices for this mood; separate several with commas.",
    type: "text",
    section: "engagement",
    inputClassName: "max-w-none",
  },
  SOUNDTRACK_PLAYLISTS_PLAYFUL: {
    label: "Extra playlists: Playful · Fun",
    description:
      "Optional. brandbite already has its own playlist for playful requests, so this can stay empty. Add Spotify playlist or album links here only if you want more choices for this mood; separate several with commas.",
    type: "text",
    section: "engagement",
    inputClassName: "max-w-none",
  },
  SOUNDTRACK_PLAYLISTS_WARM: {
    label: "Extra playlists: Warm · Friendly",
    description:
      "Optional. brandbite already has its own playlist for warm requests, so this can stay empty. Add Spotify playlist or album links here only if you want more choices for this mood; separate several with commas.",
    type: "text",
    section: "engagement",
    inputClassName: "max-w-none",
  },
  SOUNDTRACK_PLAYLISTS_BOLD: {
    label: "Extra playlists: Bold · Confident",
    description:
      "Optional. brandbite already has its own playlist for bold requests, so this can stay empty. Add Spotify playlist or album links here only if you want more choices for this mood; separate several with commas.",
    type: "text",
    section: "engagement",
    inputClassName: "max-w-none",
  },
  SOUNDTRACK_PLAYLISTS_NOSTALGIC: {
    label: "Extra playlists: Nostalgic · Retro",
    description:
      "Optional. brandbite already has its own playlist for nostalgic requests, so this can stay empty. Add Spotify playlist or album links here only if you want more choices for this mood; separate several with commas.",
    type: "text",
    section: "engagement",
    inputClassName: "max-w-none",
  },
  SOUNDTRACK_PLAYLISTS_FUTURISTIC: {
    label: "Extra playlists: Futuristic · Tech",
    description:
      "Optional. brandbite already has its own playlist for futuristic requests, so this can stay empty. Add Spotify playlist or album links here only if you want more choices for this mood; separate several with commas.",
    type: "text",
    section: "engagement",
    inputClassName: "max-w-none",
  },
  SOUNDTRACK_PLAYLISTS_EARTHY: {
    label: "Extra playlists: Earthy · Organic",
    description:
      "Optional. brandbite already has its own playlist for earthy requests, so this can stay empty. Add Spotify playlist or album links here only if you want more choices for this mood; separate several with commas.",
    type: "text",
    section: "engagement",
    inputClassName: "max-w-none",
  },
  SOUNDTRACK_PLAYLISTS_DREAMY: {
    label: "Extra playlists: Dreamy · Soft",
    description:
      "Optional. brandbite already has its own playlist for dreamy requests, so this can stay empty. Add Spotify playlist or album links here only if you want more choices for this mood; separate several with commas.",
    type: "text",
    section: "engagement",
    inputClassName: "max-w-none",
  },
  ENGAGEMENT_PLAYLIST_TOOL: {
    label: ENGAGEMENT_LABELS.playlistTool,
    description:
      "The free public page /brand-playlist: visitors pick words for their brand and get the brandbite playlist for that mix of moods (ready-made playlists; nothing to fill in). When off, the page shows Not found.",
    type: "boolean",
    section: "engagement",
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
  notifications: {
    title: "Notifications",
    description:
      "What we email site owners about. Per-event opt-outs aren't here yet — flip the master switch off if it gets too noisy and we'll add granular toggles when you tell us which events matter.",
  },
  features: {
    title: "Features",
    description:
      "Product capabilities that can be toggled on/off without a code change. Existing data is preserved when a feature is disabled — flipping back on restores the surface instantly.",
  },
  engagement: {
    title: "Engagement",
    description:
      "The extras that set brandbite apart: progress, thank-yous and soundtracks. Each one is off until you switch it on, and switching it off hides it without deleting anything.",
  },
};

/** Cards in the "Related tools" block. Every link points at a page that
 *  already exists; this is a single index for the deeper workflows so
 *  admins don't have to hunt the sidebar. */
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
    description: "Per-service creative payout percentages.",
  },
  {
    href: "/admin/job-types",
    title: "Services & categories",
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

const SECTION_ORDER = Object.keys(SECTION_TITLES) as SectionKey[];

// ---------------------------------------------------------------------------
// Local building blocks
// ---------------------------------------------------------------------------

function IconCheck(p: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...p}
    >
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

/** Compact link list used by the Related tools / Demo tools cards. */
function LinkList({
  links,
}: {
  links: { href: string; title: string; description: string; ownerOnly?: boolean }[];
}) {
  return (
    <ul className="mt-4 divide-y divide-[var(--av2-border)] rounded-xl border border-[var(--av2-border)]">
      {links.map((link) => (
        <li key={link.href}>
          <Link
            href={link.href}
            className="group flex items-start gap-3 px-4 py-3 transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-[var(--av2-bg)] focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none focus-visible:ring-inset"
          >
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2 text-sm font-semibold group-hover:text-[var(--av2-link)]">
                {link.title}
                {link.ownerOnly && <Badge tone="amber">Owner only</Badge>}
              </span>
              <span className="mt-0.5 block text-xs text-[var(--av2-text-2)]">
                {link.description}
              </span>
            </span>
            <IconArrowUpRight className="mt-0.5 shrink-0 text-[var(--av2-link)]" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function LoadingSkeleton() {
  return (
    <div aria-busy="true" className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Skeleton className="h-[420px] rounded-2xl" />
      <Skeleton className="h-[420px] rounded-2xl" />
      <p className="sr-only" role="status">
        Loading settings…
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminSettingsPage() {
  const { showToast } = useToast();

  const [settings, setSettings] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<SectionKey>("finance");

  // Local draft values for each setting (what the user types)
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  // Drafts as first loaded — only used to tell "edited by you" apart from
  // "row missing, showing the documented default" for the dirty markers.
  const [initialDrafts, setInitialDrafts] = useState<Record<string, string>>({});
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
              // Defaults that should read as "true" when the row is
              // missing — keep this list in sync with the server-side
              // helpers that read each setting (see e.g.
              // lib/admin-event-email.ts eventEmailsEnabled).
              const ON_BY_DEFAULT = new Set([
                "TALENT_APPLICATIONS_OPEN",
                "ADMIN_EVENT_EMAILS_ENABLED",
              ]);
              initial[key] = ON_BY_DEFAULT.has(key) ? "true" : "false";
            } else if (meta.type === "select" && map[key] == null) {
              initial[key] = meta.defaultValue ?? meta.options?.[0]?.value ?? "";
            } else {
              initial[key] = map[key] ?? "";
            }
          }
          setDrafts(initial);
          setInitialDrafts(initial);
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
    // Soundtrack lists may be saved empty: that clears the mood.
    if (value === undefined || (!value && !key.startsWith("SOUNDTRACK_PLAYLISTS_"))) return;

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
      setInitialDrafts((prev) => ({ ...prev, [key]: value }));
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

  // Group settings by section for the tabbed render.
  const sectionedKeys = (Object.keys(SETTING_META) as Array<keyof typeof SETTING_META>).reduce(
    (acc, key) => {
      const sec = SETTING_META[key].section;
      if (!acc[sec]) acc[sec] = [];
      acc[sec].push(key as string);
      return acc;
    },
    {} as Record<SectionKey, string[]>,
  );

  // Trimmed, like the value handleSave sends, so a saved value with stray
  // whitespace in the input doesn't stay "edited".
  const isEdited = (key: string) =>
    (drafts[key] ?? "").trim() !== (initialDrafts[key] ?? "").trim();
  const editedIn = (section: SectionKey) => (sectionedKeys[section] ?? []).filter(isEdited);

  // Drafts are per setting and survive tab switches, so only leaving the page
  // can lose them.
  useUnsavedChanges(Object.keys(SETTING_META).some(isEdited), "Settings");

  const tabLabel = (section: SectionKey) => {
    const n = editedIn(section).length;
    return (
      <span className="inline-flex items-center gap-2">
        {SECTION_TITLES[section].title}
        {n > 0 && (
          <span
            className="h-2 w-2 rounded-full bg-[var(--av2-accent)]"
            aria-label="has unsaved changes"
          />
        )}
      </span>
    );
  };

  const tabPrefix = "admin-settings";
  const visibleSections = SECTION_ORDER.filter((s) => (sectionedKeys[s] ?? []).length > 0);
  const keys = sectionedKeys[tab] ?? [];
  const otherEdited = visibleSections
    .filter((s) => s !== tab && editedIn(s).length > 0)
    .map((s) => SECTION_TITLES[s].title);

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Global configuration for the brandbite platform. Each setting saves on its own and takes effect immediately."
      />

      {error && (
        <div className="mb-6">
          <Callout tone="error" title="Something went wrong">
            {error}
          </Callout>
        </div>
      )}

      {loading ? (
        <LoadingSkeleton />
      ) : (
        <>
          <div className="mb-6">
            <Tabs<SectionKey>
              label="Settings topics"
              idPrefix={tabPrefix}
              value={tab}
              onChange={setTab}
              tabs={visibleSections.map((s) => ({ value: s, label: tabLabel(s) }))}
            />
          </div>

          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <Card className="min-w-0">
              <TabPanel idPrefix={tabPrefix} value={tab}>
                <CardTitle description={SECTION_TITLES[tab].description}>
                  {SECTION_TITLES[tab].title}
                </CardTitle>

                <div className="mt-6 divide-y divide-[var(--av2-border)] border-t border-[var(--av2-border)]">
                  {keys.map((key) => {
                    const meta = SETTING_META[key];
                    const isSaving = savingKey === key;
                    const currentValue = settings[key] ?? "";
                    const draftValue = drafts[key] ?? "";
                    const hasChanged = draftValue.trim() !== currentValue;
                    const edited = isEdited(key);
                    const labelId = `setting-${key}-label`;
                    const hintId = `setting-${key}-hint`;

                    const status = isSaving ? (
                      "Saving…"
                    ) : edited ? (
                      <span className="font-semibold text-[var(--av2-link)]">Unsaved change</span>
                    ) : settings[key] == null ? (
                      "Not saved yet — showing the default"
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <IconCheck />
                        Saved
                      </span>
                    );

                    return (
                      <div key={key} className="py-6 last:pb-0">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="min-w-0 flex-1 basis-80">
                            <label
                              id={labelId}
                              htmlFor={meta.type === "boolean" ? undefined : `setting-${key}`}
                              className="text-base font-semibold"
                            >
                              {meta.label}
                            </label>
                            <p id={hintId} className="mt-1 text-sm text-[var(--av2-text-2)]">
                              {meta.description}
                            </p>
                          </div>
                          {meta.type === "boolean" && (
                            <span className="inline-flex items-center gap-3">
                              <Switch
                                checked={draftValue === "true"}
                                onChange={(v) =>
                                  setDrafts((prev) => ({
                                    ...prev,
                                    [key]: v ? "true" : "false",
                                  }))
                                }
                                labelledBy={labelId}
                                describedBy={hintId}
                              />
                              <span className="w-16 text-sm font-medium">
                                {draftValue === "true" ? "Enabled" : "Disabled"}
                              </span>
                            </span>
                          )}
                        </div>

                        {meta.type === "select" && (
                          <div className="mt-4 max-w-sm">
                            <Select
                              id={`setting-${key}`}
                              aria-describedby={hintId}
                              value={draftValue}
                              onChange={(e) =>
                                setDrafts((prev) => ({ ...prev, [key]: e.target.value }))
                              }
                            >
                              {meta.options?.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </Select>
                          </div>
                        )}
                        {(meta.type === "number" || meta.type === "text") && (
                          <div className={`mt-4 ${meta.inputClassName ?? "max-w-xs"}`}>
                            <TextInput
                              id={`setting-${key}`}
                              type={meta.type}
                              min={meta.type === "number" ? 1 : undefined}
                              suffix={meta.suffix}
                              aria-describedby={hintId}
                              value={draftValue}
                              onChange={(e) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [key]: e.target.value,
                                }))
                              }
                            />
                          </div>
                        )}

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--av2-bg)] px-4 py-3">
                          <p role="status" className="text-sm text-[var(--av2-text-2)]">
                            {status}
                            {currentValue && (
                              <>
                                {" · "}Current value:{" "}
                                <span className="font-semibold text-[var(--av2-text)]">
                                  {currentValue}
                                </span>
                              </>
                            )}
                          </p>
                          <Button
                            variant={edited ? "primary" : "secondary"}
                            size="sm"
                            disabled={
                              isSaving ||
                              !hasChanged ||
                              (!draftValue.trim() && !key.startsWith("SOUNDTRACK_PLAYLISTS_"))
                            }
                            onClick={() => handleSave(key)}
                            aria-label={`Save ${meta.label}`}
                          >
                            {isSaving ? "Saving…" : "Save"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {otherEdited.length > 0 && (
                  <p className="mt-6 text-sm text-[var(--av2-text-2)]">
                    Unsaved changes in other tabs: {otherEdited.join(", ")}.
                  </p>
                )}
              </TabPanel>
            </Card>

            <div className="space-y-6">
              {/* Related tools — quick links to the deeper config pages that
                  have their own routes already. */}
              <Card>
                <CardTitle description="Direct links to the deeper config pages.">
                  Related tools
                </CardTitle>
                <LinkList links={QUICK_LINKS} />
              </Card>

              {/* Demo-only tools. The /debug/* routes are demo-only by design
                  (proxy.ts redirects them to "/" in real prod), so we hide the
                  whole card unless we're on the demo build. */}
              {isDemoMode && (
                <Card>
                  <CardTitle description="Available only on the demo deployment.">
                    Demo tools
                  </CardTitle>
                  <LinkList links={DEMO_DEBUG_LINKS} />
                </Card>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
