// -----------------------------------------------------------------------------
// @file: components/dashboard/account/notification-matrix.tsx
// @purpose: Personal notification preferences: one row per event, In-app and
//           Email columns. The same view appears under Profile and Settings, so
//           the event list and copy live here.
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useId, useState } from "react";

import { Callout, Skeleton, Switch } from "@/components/admin/v2/ui";
import { useToast } from "@/components/ui/toast-provider";

export type NotificationType =
  | "REVISION_SUBMITTED"
  | "FEEDBACK_SUBMITTED"
  | "TICKET_COMPLETED"
  | "TICKET_ASSIGNED"
  | "TICKET_STATUS_CHANGED"
  | "PIN_RESOLVED"
  | "WITHDRAWAL_UPDATED";

export type NotificationPreference = {
  type: NotificationType;
  enabled: boolean;
  emailEnabled: boolean;
};

export type NotificationPrefs = Record<NotificationType, NotificationPreference>;

export type NotificationChannel = "enabled" | "emailEnabled";

type AccountRole = "SITE_OWNER" | "SITE_ADMIN" | "DESIGNER" | "CUSTOMER";

export const NOTIFICATION_LABELS: Record<NotificationType, { title: string; description: string }> =
  {
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
    WITHDRAWAL_UPDATED: {
      title: "Withdrawal updates",
      description: "A withdrawal you requested was approved, rejected or paid.",
    },
  };

/** Types that only make sense for one role; others are shown to everyone. */
export const NOTIFICATION_ROLE_ONLY: Partial<Record<NotificationType, AccountRole>> = {
  WITHDRAWAL_UPDATED: "DESIGNER",
};

// Stable order for rendering. Matches the candidate flow: ticket created →
// assigned → revisions → feedback → pins resolved → completed.
export const NOTIFICATION_ORDER: NotificationType[] = [
  "TICKET_ASSIGNED",
  "TICKET_STATUS_CHANGED",
  "REVISION_SUBMITTED",
  "FEEDBACK_SUBMITTED",
  "PIN_RESOLVED",
  "TICKET_COMPLETED",
  "WITHDRAWAL_UPDATED",
];

export function notificationEventsFor(role: AccountRole): NotificationType[] {
  return NOTIFICATION_ORDER.filter(
    (type) => !NOTIFICATION_ROLE_ONLY[type] || NOTIFICATION_ROLE_ONLY[type] === role,
  );
}

/**
 * Index the API rows by type. A user with no row yet gets the schema default
 * (both channels on) so a fresh account doesn't see misleading "off" toggles.
 */
export function indexPreferences(rows: NotificationPreference[]): NotificationPrefs {
  const indexed = Object.fromEntries(
    NOTIFICATION_ORDER.map((t) => [t, { type: t, enabled: true, emailEnabled: true }]),
  ) as NotificationPrefs;
  for (const row of rows) indexed[row.type] = row;
  return indexed;
}

export function NotificationMatrix({
  role,
  prefs,
  isSaving,
  onToggle,
}: {
  role: AccountRole;
  prefs: NotificationPrefs;
  isSaving: (type: NotificationType, channel: NotificationChannel) => boolean;
  onToggle: (type: NotificationType, channel: NotificationChannel, next: boolean) => void;
}) {
  const id = useId();
  const inAppId = `${id}-in-app`;
  const emailId = `${id}-email`;
  return (
    <table className="w-full border-collapse text-left text-sm">
      <thead>
        <tr>
          <th
            scope="col"
            className="border-b border-[var(--av2-border)] py-3 pr-4 text-xs font-medium tracking-[0.08em] text-[var(--av2-text-2)] uppercase"
          >
            Event
          </th>
          <th
            scope="col"
            id={inAppId}
            className="w-16 border-b border-[var(--av2-border)] px-1 py-3 text-center text-xs font-medium tracking-[0.08em] whitespace-nowrap text-[var(--av2-text-2)] uppercase sm:w-24"
          >
            In-app
          </th>
          <th
            scope="col"
            id={emailId}
            className="w-16 border-b border-[var(--av2-border)] px-1 py-3 text-center text-xs font-medium tracking-[0.08em] whitespace-nowrap text-[var(--av2-text-2)] uppercase sm:w-24"
          >
            Email
          </th>
        </tr>
      </thead>
      <tbody>
        {notificationEventsFor(role).map((type) => {
          const meta = NOTIFICATION_LABELS[type];
          const pref = prefs[type];
          const titleId = `${id}-${type}`;
          return (
            <tr key={type} className="border-b border-[var(--av2-border)] last:border-b-0">
              <td className="py-3 pr-4 align-middle">
                <p id={titleId} className="text-sm font-semibold">
                  {meta.title}
                </p>
                <p className="mt-0.5 text-sm text-[var(--av2-text-2)]">{meta.description}</p>
              </td>
              <td className="px-1 py-3 text-center align-middle">
                <Switch
                  labelledBy={`${titleId} ${inAppId}`}
                  checked={pref.enabled}
                  disabled={isSaving(type, "enabled")}
                  onChange={(next) => onToggle(type, "enabled", next)}
                />
              </td>
              <td className="px-1 py-3 text-center align-middle">
                <Switch
                  labelledBy={`${titleId} ${emailId}`}
                  checked={pref.emailEnabled}
                  disabled={isSaving(type, "emailEnabled")}
                  onChange={(next) => onToggle(type, "emailEnabled", next)}
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/**
 * Load + per-channel save for the settings screens. One channel is patched at a
 * time, so a failure on Email doesn't also flip In-app back.
 */
export function useNotificationPreferences() {
  const { showToast } = useToast();
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/notifications/preferences", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!res.ok || !Array.isArray(json?.preferences)) {
          throw new Error(json?.error || `Request failed with status ${res.status}`);
        }
        if (!cancelled) setPrefs(indexPreferences(json.preferences));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load preferences.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = useCallback(
    async (type: NotificationType, channel: NotificationChannel, next: boolean) => {
      const key = `${type}:${channel}`;
      setSaving((prev) => new Set(prev).add(key));
      setPrefs((curr) => (curr ? { ...curr, [type]: { ...curr[type], [channel]: next } } : curr));
      try {
        const res = await fetch("/api/notifications/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, [channel]: next }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error || "Failed to update preference");
        }
      } catch (err) {
        setPrefs((curr) =>
          curr ? { ...curr, [type]: { ...curr[type], [channel]: !next } } : curr,
        );
        showToast({
          type: "error",
          title: err instanceof Error ? err.message : "Failed to update preference",
        });
      } finally {
        setSaving((prev) => {
          const copy = new Set(prev);
          copy.delete(key);
          return copy;
        });
      }
    },
    [showToast],
  );

  const isSaving = useCallback(
    (type: NotificationType, channel: NotificationChannel) => saving.has(`${type}:${channel}`),
    [saving],
  );

  return { prefs, loading, error, toggle, isSaving };
}

/** Loading / error / matrix, for screens using `useNotificationPreferences`. */
export function NotificationPreferencesBody({
  role,
  state,
}: {
  role: AccountRole;
  state: ReturnType<typeof useNotificationPreferences>;
}) {
  if (state.loading) {
    return (
      <div aria-busy="true" aria-label="Loading preferences" className="space-y-3">
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
      </div>
    );
  }
  if (!state.prefs) {
    return (
      <Callout tone="error" title="We couldn't load your preferences">
        {state.error}
      </Callout>
    );
  }
  return (
    <NotificationMatrix
      role={role}
      prefs={state.prefs}
      isSaving={state.isSaving}
      onToggle={(type, channel, next) => void state.toggle(type, channel, next)}
    />
  );
}
