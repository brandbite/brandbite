// -----------------------------------------------------------------------------
// @file: components/profile/profile-form.tsx
// @purpose: The shared "your account" form rendered under
//           /customer/profile, /creative/profile, and /admin/profile.
//           Role-agnostic: every UserAccount has the same handful of
//           personal fields, so a single component keeps the three
//           role-prefixed routes in lock-step. Anything role-specific
//           (creative working hours, customer company membership, admin
//           MFA enrollment) stays in the existing /<role>/settings page.
//
//           Sections:
//             1. Identity   — name editor + email + role pill (email is
//                             read-only in v1; the change-with-verify
//                             flow lands in a follow-up PR).
//             2. Timezone   — IANA zone select + auto-detect.
//             3. Notifications — toggles per NotificationType, calling
//                             the existing /api/notifications/preferences
//                             endpoint so the change applies everywhere
//                             notifications are read.
//             4. Delete account — typed-email confirm + DELETE on the
//                             role-specific endpoint. SITE_OWNER /
//                             SITE_ADMIN are out of scope here; admin
//                             deletion happens via /admin/users.
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormInput, FormSelect } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Modal, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast-provider";

// ---------------------------------------------------------------------------
// Types — kept narrow so the component compiles in any role's layout
// without leaking server-only Prisma types.
// ---------------------------------------------------------------------------

type Role = "SITE_OWNER" | "SITE_ADMIN" | "DESIGNER" | "CUSTOMER";

type ProfileUser = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  timezone: string | null;
};

type NotificationType =
  | "REVISION_SUBMITTED"
  | "FEEDBACK_SUBMITTED"
  | "TICKET_COMPLETED"
  | "TICKET_ASSIGNED"
  | "TICKET_STATUS_CHANGED"
  | "PIN_RESOLVED";

type NotificationPreference = {
  type: NotificationType;
  enabled: boolean;
  emailEnabled: boolean;
};

const ROLE_LABELS: Record<Role, string> = {
  SITE_OWNER: "Site Owner",
  SITE_ADMIN: "Site Admin",
  DESIGNER: "Creative",
  CUSTOMER: "Customer",
};

// Friendly descriptions for the notification toggle list. Keeping the
// copy here rather than fetching from the API means we can keep the
// list short and explanatory without a server round-trip.
const NOTIFICATION_LABELS: Record<NotificationType, { title: string; description: string }> = {
  REVISION_SUBMITTED: {
    title: "Revision submitted",
    description: "A creative submitted a new revision for one of your tickets.",
  },
  FEEDBACK_SUBMITTED: {
    title: "Feedback submitted",
    description: "A customer left feedback (pins or comments) on a revision.",
  },
  TICKET_COMPLETED: {
    title: "Ticket completed",
    description: "A ticket you're attached to has been marked as Done.",
  },
  TICKET_ASSIGNED: {
    title: "Ticket assigned",
    description: "A new ticket has been auto-assigned to you.",
  },
  TICKET_STATUS_CHANGED: {
    title: "Status changed",
    description: "Any other status transition on a ticket you're attached to.",
  },
  PIN_RESOLVED: {
    title: "Pin resolved",
    description: "A creative resolved a pin you placed on an asset.",
  },
};

// Stable order for rendering the toggle list. Matches the order of the
// candidate flow — ticket created → assigned → revisions → feedback →
// pins resolved → completed.
const NOTIFICATION_ORDER: NotificationType[] = [
  "TICKET_ASSIGNED",
  "TICKET_STATUS_CHANGED",
  "REVISION_SUBMITTED",
  "FEEDBACK_SUBMITTED",
  "PIN_RESOLVED",
  "TICKET_COMPLETED",
];

// ---------------------------------------------------------------------------
// Timezone helpers
// ---------------------------------------------------------------------------

/** Best-effort list of IANA zones via Intl.supportedValuesOf, with a
 *  conservative fallback for older runtimes that don't support it.
 *  Falling back to a small pinned list is intentional — it keeps the
 *  page useful (just not exhaustive) on browsers we never tested. */
function listTimezones(): string[] {
  const intl = Intl as unknown as {
    supportedValuesOf?: (key: "timeZone") => string[];
  };
  if (typeof intl.supportedValuesOf === "function") {
    try {
      return intl.supportedValuesOf("timeZone");
    } catch {
      // fallthrough
    }
  }
  return [
    "UTC",
    "Europe/Istanbul",
    "Europe/London",
    "Europe/Berlin",
    "Europe/Madrid",
    "America/New_York",
    "America/Los_Angeles",
    "Asia/Dubai",
    "Asia/Singapore",
    "Asia/Tokyo",
  ];
}

function detectBrowserTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProfileForm() {
  const { showToast } = useToast();

  // ---- core profile load ----
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ---- identity edits ----
  const [nameDraft, setNameDraft] = useState("");
  const [savingIdentity, setSavingIdentity] = useState(false);

  // ---- timezone edit ----
  const [timezoneDraft, setTimezoneDraft] = useState<string>("");
  const [savingTimezone, setSavingTimezone] = useState(false);

  // ---- notification prefs ----
  const [prefs, setPrefs] = useState<Record<NotificationType, NotificationPreference> | null>(null);
  const [prefsLoading, setPrefsLoading] = useState(true);
  // Tracks which (type, channel) pair is mid-save so we can disable
  // just that one toggle without locking the whole list.
  const [prefsSaving, setPrefsSaving] = useState<Set<string>>(new Set());

  // ---- delete account modal ----
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // -----------------------------------------------------------------
  // Initial load — profile + notification prefs in parallel.
  // -----------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const [profileRes, prefsRes] = await Promise.all([
          fetch("/api/profile", { cache: "no-store" }),
          fetch("/api/notifications/preferences", { cache: "no-store" }),
        ]);

        if (!profileRes.ok) {
          const body = (await profileRes.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error || `HTTP ${profileRes.status}`);
        }
        const profileJson = (await profileRes.json()) as { user: ProfileUser };
        if (cancelled) return;
        setUser(profileJson.user);
        setNameDraft(profileJson.user.name ?? "");
        setTimezoneDraft(profileJson.user.timezone ?? "");

        if (prefsRes.ok) {
          const json = (await prefsRes.json()) as { preferences: NotificationPreference[] };
          if (cancelled) return;
          // Index by type for O(1) lookups when toggling. Defaulting to
          // enabled=true / emailEnabled=true mirrors the schema default
          // so a fresh user with no rows yet doesn't see misleading
          // "off" toggles.
          const indexed: Record<NotificationType, NotificationPreference> = Object.fromEntries(
            NOTIFICATION_ORDER.map((t) => [t, { type: t, enabled: true, emailEnabled: true }]),
          ) as Record<NotificationType, NotificationPreference>;
          for (const p of json.preferences) {
            indexed[p.type] = p;
          }
          setPrefs(indexed);
        }
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Failed to load profile");
      } finally {
        if (!cancelled) {
          setLoading(false);
          setPrefsLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // -----------------------------------------------------------------
  // Save name — only fires if the value actually changed.
  // -----------------------------------------------------------------
  const handleSaveIdentity = useCallback(async () => {
    if (!user) return;
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      showToast({ type: "error", title: "Name cannot be empty." });
      return;
    }
    if (trimmed === (user.name ?? "")) {
      showToast({ type: "info", title: "No changes to save." });
      return;
    }
    setSavingIdentity(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const body = (await res.json().catch(() => null)) as {
        user?: ProfileUser;
        error?: string;
      } | null;
      if (!res.ok || !body?.user) {
        throw new Error(body?.error || "Failed to save");
      }
      setUser(body.user);
      setNameDraft(body.user.name ?? "");
      showToast({ type: "success", title: "Name updated" });
    } catch (err) {
      showToast({
        type: "error",
        title: err instanceof Error ? err.message : "Failed to save name",
      });
    } finally {
      setSavingIdentity(false);
    }
  }, [nameDraft, showToast, user]);

  // -----------------------------------------------------------------
  // Save timezone — accepts the empty string as "clear".
  // -----------------------------------------------------------------
  const handleSaveTimezone = useCallback(
    async (nextTz: string | null) => {
      if (!user) return;
      const current = user.timezone ?? "";
      const target = (nextTz ?? "").trim();
      if (target === current) {
        showToast({ type: "info", title: "No changes to save." });
        return;
      }
      setSavingTimezone(true);
      try {
        const res = await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ timezone: target === "" ? null : target }),
        });
        const body = (await res.json().catch(() => null)) as {
          user?: ProfileUser;
          error?: string;
        } | null;
        if (!res.ok || !body?.user) {
          throw new Error(body?.error || "Failed to save");
        }
        setUser(body.user);
        setTimezoneDraft(body.user.timezone ?? "");
        showToast({
          type: "success",
          title: target === "" ? "Timezone cleared" : `Timezone set to ${target}`,
        });
      } catch (err) {
        showToast({
          type: "error",
          title: err instanceof Error ? err.message : "Failed to save timezone",
        });
      } finally {
        setSavingTimezone(false);
      }
    },
    [showToast, user],
  );

  const handleAutoDetectTimezone = useCallback(() => {
    const tz = detectBrowserTimezone();
    if (!tz) {
      showToast({ type: "error", title: "Couldn't detect your timezone." });
      return;
    }
    setTimezoneDraft(tz);
    void handleSaveTimezone(tz);
  }, [handleSaveTimezone, showToast]);

  // -----------------------------------------------------------------
  // Toggle a notification preference. We patch one channel at a time
  // (mirrors the existing /api/notifications/preferences PATCH contract)
  // so a network failure on the email channel doesn't accidentally
  // also flip the in-app channel back to its previous value.
  // -----------------------------------------------------------------
  const handleTogglePref = useCallback(
    async (type: NotificationType, channel: "enabled" | "emailEnabled", next: boolean) => {
      if (!prefs) return;
      const key = `${type}:${channel}`;
      setPrefsSaving((prev) => new Set(prev).add(key));
      // Optimistic update — flip locally first so the toggle responds
      // instantly. Roll back on failure.
      const previous = prefs[type];
      setPrefs({ ...prefs, [type]: { ...previous, [channel]: next } });
      try {
        const res = await fetch("/api/notifications/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, [channel]: next }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error || "Failed to save preference");
        }
      } catch (err) {
        setPrefs((curr) => (curr ? { ...curr, [type]: previous } : curr));
        showToast({
          type: "error",
          title: err instanceof Error ? err.message : "Failed to save preference",
        });
      } finally {
        setPrefsSaving((prev) => {
          const copy = new Set(prev);
          copy.delete(key);
          return copy;
        });
      }
    },
    [prefs, showToast],
  );

  // -----------------------------------------------------------------
  // Delete account — re-uses the existing role-specific endpoints
  // that wrap lib/account-deletion.ts. Customer + creative only;
  // admins/owners have to go through /admin/users.
  // -----------------------------------------------------------------
  const canSelfDelete = user?.role === "CUSTOMER" || user?.role === "DESIGNER";
  const deleteEndpoint =
    user?.role === "CUSTOMER"
      ? "/api/customer/account"
      : user?.role === "DESIGNER"
        ? "/api/creative/account"
        : null;

  const handleDelete = useCallback(async () => {
    if (!user || !deleteEndpoint) return;
    setDeleteError(null);
    if (deleteEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
      setDeleteError("Confirmation email does not match the account email.");
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(deleteEndpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmEmail: deleteEmail.trim() }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(body?.error || "Failed to delete account.");
      }
      // The cookie is dropped by the API; bounce to the marketing root
      // rather than /login so the user lands on a friendly page rather
      // than an empty form prompting them to sign back in.
      window.location.href = "/";
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete account.");
      setDeleting(false);
    }
  }, [deleteEmail, deleteEndpoint, user]);

  // -----------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------

  const timezones = useMemo(() => listTimezones(), []);

  if (loading) {
    return <div className="text-sm text-[var(--bb-text-muted)]">Loading your profile…</div>;
  }
  if (loadError || !user) {
    return (
      <InlineAlert variant="error" title="Couldn't load profile">
        {loadError ?? "Unknown error."}
      </InlineAlert>
    );
  }

  const browserTz = detectBrowserTimezone();
  const browserTzMatchesSaved = !!user.timezone && browserTz === user.timezone;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header>
        <h1 className="text-xl font-bold text-[var(--bb-secondary)]">Your profile</h1>
        <p className="mt-1 text-sm text-[var(--bb-text-secondary)]">
          Personal details, timezone, and what we can email you about. Company-level settings (plan,
          members, billing) stay in your dashboard.
        </p>
      </header>

      {/* ---- Identity ---- */}
      <section className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)] p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--bb-secondary)]">Identity</h2>
            <p className="mt-0.5 text-xs text-[var(--bb-text-muted)]">
              Your name appears on tickets, comments, and emails creatives receive.
            </p>
          </div>
          <Badge variant="neutral">{ROLE_LABELS[user.role]}</Badge>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--bb-text-secondary)]">
              Full name
            </label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <FormInput
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder="Your full name"
                autoComplete="name"
                maxLength={80}
                className="min-w-[200px] flex-1"
              />
              <Button
                onClick={() => void handleSaveIdentity()}
                disabled={savingIdentity || nameDraft.trim() === (user.name ?? "")}
                loading={savingIdentity}
                loadingText="Saving…"
              >
                Save name
              </Button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--bb-text-secondary)]">
              Email
            </label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <FormInput
                value={user.email}
                readOnly
                aria-readonly="true"
                className="min-w-[200px] flex-1 bg-[var(--bb-bg-page)]"
              />
            </div>
            <p className="mt-1 text-[11px] text-[var(--bb-text-muted)]">
              Email changes need verification and will land in a follow-up release. Reach out to
              support if you need to switch addresses now.
            </p>
          </div>
        </div>
      </section>

      {/* ---- Timezone ---- */}
      <section className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)] p-6">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-[var(--bb-secondary)]">Timezone</h2>
          <p className="mt-0.5 text-xs text-[var(--bb-text-muted)]">
            Used to render due dates and notification timestamps in your local time. Falls back to
            UTC when not set.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1">
            <label className="block text-xs font-medium text-[var(--bb-text-secondary)]">
              IANA timezone
            </label>
            <FormSelect
              value={timezoneDraft}
              onChange={(e) => setTimezoneDraft(e.target.value)}
              className="mt-1 w-full"
              aria-label="IANA timezone"
            >
              <option value="">— Not set (UTC) —</option>
              {timezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </FormSelect>
          </div>
          <Button
            onClick={() => void handleSaveTimezone(timezoneDraft)}
            disabled={savingTimezone || timezoneDraft === (user.timezone ?? "")}
            loading={savingTimezone}
            loadingText="Saving…"
          >
            Save
          </Button>
          <Button
            variant="secondary"
            onClick={handleAutoDetectTimezone}
            disabled={savingTimezone || browserTzMatchesSaved}
            title={
              browserTzMatchesSaved
                ? "Already matches your browser's timezone"
                : "Use your browser's detected timezone"
            }
          >
            Auto-detect
          </Button>
        </div>
        {browserTz && !browserTzMatchesSaved && (
          <p className="mt-2 text-[11px] text-[var(--bb-text-muted)]">
            Your browser thinks you&apos;re in <strong>{browserTz}</strong>.
          </p>
        )}
      </section>

      {/* ---- Notifications ---- */}
      <section className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)] p-6">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-[var(--bb-secondary)]">Notifications</h2>
          <p className="mt-0.5 text-xs text-[var(--bb-text-muted)]">
            Pick which events show up in your inbox and which also email you. Auth and security
            messages always send.
          </p>
        </div>

        {prefsLoading || !prefs ? (
          <div className="text-sm text-[var(--bb-text-muted)]">Loading preferences…</div>
        ) : (
          <ul className="divide-y divide-[var(--bb-border-subtle)]">
            {NOTIFICATION_ORDER.map((type) => {
              const pref = prefs[type];
              const meta = NOTIFICATION_LABELS[type];
              const inAppKey = `${type}:enabled`;
              const emailKey = `${type}:emailEnabled`;
              return (
                <li key={type} className="flex flex-wrap items-start gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--bb-secondary)]">{meta.title}</p>
                    <p className="mt-0.5 text-xs text-[var(--bb-text-muted)]">{meta.description}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[var(--bb-text-secondary)]">
                    <ToggleSwitch
                      label="In-app"
                      checked={pref.enabled}
                      disabled={prefsSaving.has(inAppKey)}
                      onChange={(next) => void handleTogglePref(type, "enabled", next)}
                    />
                    <ToggleSwitch
                      label="Email"
                      checked={pref.emailEnabled}
                      disabled={prefsSaving.has(emailKey)}
                      onChange={(next) => void handleTogglePref(type, "emailEnabled", next)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ---- Delete account ---- */}
      {canSelfDelete && (
        <section className="rounded-2xl border border-red-200 bg-red-50/50 p-6 dark:border-red-900/40 dark:bg-red-950/20">
          <h2 className="text-base font-semibold text-red-700 dark:text-red-300">Delete account</h2>
          <p className="mt-0.5 text-xs text-red-700/80 dark:text-red-300/80">
            Permanently anonymize your account. Tickets and ledger entries you&apos;re attached to
            stay for our financial records, but your name, email, and login credentials are removed.
            This cannot be undone.
          </p>
          <div className="mt-3">
            <Button variant="danger" onClick={() => setDeleteOpen(true)}>
              Delete my account…
            </Button>
          </div>
        </section>
      )}

      {/* ---- Delete modal ---- */}
      <Modal
        open={deleteOpen}
        onClose={() => {
          if (deleting) return;
          setDeleteOpen(false);
          setDeleteEmail("");
          setDeleteError(null);
        }}
        size="md"
      >
        <ModalHeader
          title="Delete your account?"
          onClose={() => {
            if (deleting) return;
            setDeleteOpen(false);
            setDeleteEmail("");
            setDeleteError(null);
          }}
        />
        <div className="space-y-3 px-6 pb-4 text-sm text-[var(--bb-text-secondary)]">
          <p>
            Type your email <strong>{user.email}</strong> to confirm. Your auth credentials will be
            revoked and your identity will be anonymized immediately.
          </p>
          <FormInput
            type="email"
            value={deleteEmail}
            onChange={(e) => setDeleteEmail(e.target.value)}
            placeholder={user.email}
            autoComplete="off"
            aria-label="Type your email to confirm deletion"
          />
          {deleteError && <InlineAlert variant="error">{deleteError}</InlineAlert>}
        </div>
        <ModalFooter>
          <Button
            variant="ghost"
            disabled={deleting}
            onClick={() => {
              setDeleteOpen(false);
              setDeleteEmail("");
              setDeleteError(null);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => void handleDelete()}
            loading={deleting}
            loadingText="Deleting…"
            disabled={deleting || deleteEmail.trim().toLowerCase() !== user.email.toLowerCase()}
          >
            Delete account
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ToggleSwitch — small inline component because the rest of the app
// uses one-off button-with-pill toggles and bringing in a shared
// component for a single page is overkill. Kept WCAG-conformant via
// role="switch" + aria-checked + keyboard-accessible default <button>.
// ---------------------------------------------------------------------------

function ToggleSwitch({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-1.5 disabled:opacity-50"
    >
      <span
        className={[
          "inline-block h-3.5 w-6 rounded-full transition-colors",
          checked ? "bg-[var(--bb-primary)]" : "bg-[var(--bb-border)]",
        ].join(" ")}
      >
        <span
          className={[
            "block h-3 w-3 translate-y-[1px] rounded-full bg-white transition-transform",
            checked ? "translate-x-[11px]" : "translate-x-[1px]",
          ].join(" ")}
        />
      </span>
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  );
}
