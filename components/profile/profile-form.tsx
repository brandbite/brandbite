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
//             1. Identity   — avatar upload (circle preview, Change /
//                             Remove) + name editor + email change
//                             (verify-via-email flow handled by
//                             BetterAuth's /change-email) + role pill.
//             2. Timezone   — IANA zone select + auto-detect.
//             2a. Workload (DESIGNER only) — working-hours text + cap on
//                             concurrent open tasks. Edits go to
//                             /api/profile which gates these fields to
//                             role=DESIGNER server-side.
//             3. Notifications — toggles per NotificationType, calling
//                             the existing /api/notifications/preferences
//                             endpoint so the change applies everywhere
//                             notifications are read.
//             4. Two-factor — TOTP enrollment (QR + backup codes) +
//                             disable. Driven by BetterAuth's twoFactor
//                             plugin. Once enabled, the email+password
//                             sign-in path requires a code; magic-link
//                             sign-in is refused (see lib/better-auth.ts
//                             hooks).
//             5. Active sessions — every browser the user is signed in
//                             from, with revoke-one and "sign out
//                             everywhere else" actions. Driven by
//                             BetterAuth's listSessions / revokeSession.
//                             "This device" badge is set by matching
//                             session ids against /api/session.
//             6. Delete account — typed-email confirm + DELETE on the
//                             role-specific endpoint. SITE_OWNER /
//                             SITE_ADMIN are out of scope here; admin
//                             deletion happens via /admin/users.
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { authClient } from "@/lib/auth-client";
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
  twoFactorEnabled: boolean;
  /** AuthUser.image — public R2 URL or null. Updated by /api/profile/avatar.
   *  Optional so older API responses (before this field shipped) don't
   *  break the type — treated as null when missing. */
  image: string | null;
  /** Creative-only: free-text working hours. Null on non-DESIGNER. */
  workingHours: string | null;
  /** Creative-only: max concurrent open tickets. 1..40 or null (no cap). */
  tasksPerWeekCap: number | null;
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

// Subset of BetterAuth's listSessions response shape we render. Token is
// included because /two-factor/revoke-session takes it; we never display
// it. Created/updated come back as ISO strings on the wire.
type SessionListItem = {
  id: string;
  token: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  ipAddress: string | null;
  userAgent: string | null;
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
// Session-row formatting helpers
// ---------------------------------------------------------------------------

/** Pick a friendly "Browser on OS" label from a User-Agent string. We
 *  do this client-side because we don't need the granularity of a
 *  full UA-parsing library and it'd be wasteful to pull one in. */
function describeUserAgent(ua: string | null): string {
  if (!ua) return "Unknown device";
  let browser = "Browser";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/OPR\//.test(ua)) browser = "Opera";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua)) browser = "Safari";
  let os = "Unknown";
  if (/Windows NT/.test(ua)) os = "Windows";
  else if (/Mac OS X/.test(ua)) os = "macOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/.test(ua)) os = "iOS";
  else if (/Linux/.test(ua)) os = "Linux";
  return `${browser} on ${os}`;
}

/** Mask the trailing octets of an IPv4 address for the UI. We have the
 *  full IP server-side for forensics; the user just needs enough to
 *  recognize their own address. IPv6 returns the first segment. */
function maskIp(ip: string | null): string {
  if (!ip) return "—";
  if (ip.includes(":")) {
    // IPv6 — keep the first hextet for the visual hint.
    const head = ip.split(":")[0];
    return `${head}:****`;
  }
  const parts = ip.split(".");
  if (parts.length !== 4) return "—";
  return `${parts[0]}.${parts[1]}.x.x`;
}

/** "5 minutes ago" / "2 days ago" — simple relative formatter so the
 *  session list reads naturally without bringing in date-fns just for
 *  this page. */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const sec = Math.round(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day} day${day === 1 ? "" : "s"} ago`;
  const mo = Math.round(day / 30);
  if (mo < 12) return `${mo} month${mo === 1 ? "" : "s"} ago`;
  const yr = Math.round(mo / 12);
  return `${yr} year${yr === 1 ? "" : "s"} ago`;
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

  // ---- avatar ----
  // Single-shot upload: file picker → POST multipart to
  // /api/profile/avatar → server uploads to R2 + updates AuthUser.image
  // → response carries the new URL → we mutate user.image in state. No
  // crop/preview step in v1; the image is shown as a circle so the user
  // notices any framing issue right away.
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ---- timezone edit ----
  const [timezoneDraft, setTimezoneDraft] = useState<string>("");
  const [savingTimezone, setSavingTimezone] = useState(false);

  // ---- workload (creative-only) ----
  // Two free-form fields. Working hours is text — we don't parse it
  // server-side; admins read it as a hint when scheduling. Cap is a
  // number 1..40 or null (no cap), matching the value the auto-assign
  // reads in lib/tickets/create-ticket.ts.
  const [workingHoursDraft, setWorkingHoursDraft] = useState<string>("");
  const [savingWorkingHours, setSavingWorkingHours] = useState(false);
  const [tasksCapDraft, setTasksCapDraft] = useState<string>("");
  const [savingTasksCap, setSavingTasksCap] = useState(false);

  // ---- notification prefs ----
  const [prefs, setPrefs] = useState<Record<NotificationType, NotificationPreference> | null>(null);
  const [prefsLoading, setPrefsLoading] = useState(true);
  // Tracks which (type, channel) pair is mid-save so we can disable
  // just that one toggle without locking the whole list.
  const [prefsSaving, setPrefsSaving] = useState<Set<string>>(new Set());

  // ---- email change ----
  // The flow: user types newEmail and submits, we POST BetterAuth's
  // /change-email endpoint. BetterAuth emails the new address with a
  // confirmation link; the actual swap happens when the user clicks
  // that link. Until they do, the field UI shows a "Pending — open the
  // link in {newEmail}'s inbox" hint so they don't think nothing
  // happened.
  const [emailDraft, setEmailDraft] = useState("");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  // ---- active sessions ----
  // Loaded once on mount via authClient.listSessions(); refreshed after
  // every revoke. Each session row shows a parsed device hint, last
  // activity, masked IP, and a "this device" badge derived by matching
  // against the current session id from /api/session.
  const [sessionsList, setSessionsList] = useState<SessionListItem[] | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [revokingTokens, setRevokingTokens] = useState<Set<string>>(new Set());
  const [revokingOthers, setRevokingOthers] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // ---- 2FA enrollment ----
  // Two-stage enrollment: click "Set up" → /two-factor/enable returns a
  // TOTP URI for the QR + the secret. User scans it, types a 6-digit
  // code → /two-factor/verify-totp commits the enrollment. Backup
  // codes show ONCE on success — the user is told to save them.
  //
  // Disable flow: typed-password confirm modal (BetterAuth requires
  // the password to disable as a safety check). On success we drop
  // the backup-code stash and flip the section state back.
  const [twoFaEnrollment, setTwoFaEnrollment] = useState<
    | { stage: "idle" }
    | {
        stage: "qr";
        uri: string;
        secret: string;
        codeDraft: string;
        saving: boolean;
        error: string | null;
      }
    | { stage: "codes"; backupCodes: string[] }
  >({ stage: "idle" });
  const [twoFaPassword, setTwoFaPassword] = useState("");
  const [twoFaDisableOpen, setTwoFaDisableOpen] = useState(false);
  const [twoFaDisabling, setTwoFaDisabling] = useState(false);
  const [twoFaDisableError, setTwoFaDisableError] = useState<string | null>(null);

  // ---- delete account modal ----
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // -----------------------------------------------------------------
  // Initial load — profile + notification prefs + active sessions in
  // parallel. /api/session also gives us the current session id so the
  // sessions list can flag the "this device" row.
  // -----------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const [profileRes, prefsRes, sessionRes, sessionsRes] = await Promise.all([
          fetch("/api/profile", { cache: "no-store" }),
          fetch("/api/notifications/preferences", { cache: "no-store" }),
          fetch("/api/session", { cache: "no-store" }),
          authClient.listSessions(),
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
        setEmailDraft(profileJson.user.email);
        setWorkingHoursDraft(profileJson.user.workingHours ?? "");
        setTasksCapDraft(
          profileJson.user.tasksPerWeekCap == null ? "" : String(profileJson.user.tasksPerWeekCap),
        );

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

        // Current session id — used to flag "this device" in the
        // sessions list. Skip silently on error; the list still renders
        // without a "this device" badge in that case.
        if (sessionRes.ok) {
          const json = (await sessionRes.json()) as { session?: { id?: string | null } | null };
          if (!cancelled) setCurrentSessionId(json.session?.id ?? null);
        }

        // Active sessions list. authClient.listSessions returns a
        // structured response; on error we surface to the section
        // (rather than the whole page) since the rest of the profile is
        // still useful.
        if (sessionsRes.error) {
          if (!cancelled) setSessionsError(sessionsRes.error.message ?? "Couldn't load sessions");
        } else if (sessionsRes.data) {
          if (!cancelled) setSessionsList(sessionsRes.data as unknown as SessionListItem[]);
        }
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Failed to load profile");
      } finally {
        if (!cancelled) {
          setLoading(false);
          setPrefsLoading(false);
          setSessionsLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // -----------------------------------------------------------------
  // Avatar upload + remove. The upload route returns the new public R2
  // URL we mirror into the user state. We pre-validate size + type
  // client-side so the server doesn't have to reject obvious mistakes
  // after a wasted upload — though both checks are duplicated server-
  // side as the source of truth.
  // -----------------------------------------------------------------
  const ALLOWED_AVATAR_TYPES = useMemo(
    () => new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]),
    [],
  );
  const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // keep in lockstep with the route

  const handleUploadAvatar = useCallback(
    async (file: File) => {
      if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
        showToast({ type: "error", title: "Use a PNG, JPEG, WebP, or GIF image." });
        return;
      }
      if (file.size > MAX_AVATAR_BYTES) {
        showToast({ type: "error", title: "Image must be 2 MB or smaller." });
        return;
      }
      setUploadingAvatar(true);
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/profile/avatar", { method: "POST", body: form });
        const body = (await res.json().catch(() => null)) as {
          user?: { image?: string | null };
          error?: string;
        } | null;
        if (!res.ok) {
          showToast({ type: "error", title: body?.error ?? "Failed to upload avatar." });
          return;
        }
        setUser((prev) => (prev ? { ...prev, image: body?.user?.image ?? null } : prev));
        showToast({ type: "success", title: "Avatar updated." });
      } catch (err) {
        showToast({
          type: "error",
          title: err instanceof Error ? err.message : "Failed to upload avatar.",
        });
      } finally {
        setUploadingAvatar(false);
      }
    },
    [ALLOWED_AVATAR_TYPES, MAX_AVATAR_BYTES, showToast],
  );

  const handleRemoveAvatar = useCallback(async () => {
    setRemovingAvatar(true);
    try {
      const res = await fetch("/api/profile/avatar", { method: "DELETE" });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        showToast({ type: "error", title: body?.error ?? "Failed to remove avatar." });
        return;
      }
      setUser((prev) => (prev ? { ...prev, image: null } : prev));
      showToast({ type: "success", title: "Avatar removed." });
    } finally {
      setRemovingAvatar(false);
    }
  }, [showToast]);

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
  // Request email change — POSTs BetterAuth's mounted /change-email
  // endpoint. BetterAuth handles the verification token + link;
  // sendChangeEmailVerification (lib/better-auth.ts) emails the new
  // address; clicking the link triggers the AuthUser update + our
  // databaseHooks mirror onto UserAccount.email.
  //
  // The user stays on this page with a "Pending — open the link in
  // {newEmail}" hint until they actually click. The hint is purely
  // local UI state — there's no server-side "pending" column to read
  // back, since BetterAuth's verification token row is the truth and
  // we don't expose it. A page refresh clears the hint and the user
  // sees their original email; that's fine because the token row
  // still exists and clicking the link still completes the swap.
  // -----------------------------------------------------------------
  const handleRequestEmailChange = useCallback(async () => {
    if (!user) return;
    const target = emailDraft.trim().toLowerCase();
    setEmailError(null);
    if (!target) {
      setEmailError("Enter the new email address.");
      return;
    }
    if (target === user.email.toLowerCase()) {
      setEmailError("That's already your current email.");
      return;
    }
    // Light client-side syntax check — BetterAuth does the real
    // validation server-side via Zod.
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(target)) {
      setEmailError("Enter a valid email address.");
      return;
    }
    setSavingEmail(true);
    try {
      const res = await fetch("/api/auth/change-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newEmail: target, callbackURL: "/profile?emailChanged=1" }),
      });
      const body = (await res.json().catch(() => null)) as {
        status?: boolean;
        message?: string;
      } | null;
      if (!res.ok) {
        // BetterAuth returns either a structured 400 with { message }
        // or a generic 500. Surface either as an inline error rather
        // than a toast — the modal-less flow makes inline more useful.
        throw new Error(body?.message || "Failed to start email change.");
      }
      setPendingEmail(target);
      showToast({
        type: "success",
        title: "Confirmation sent",
        description: `Open the link we sent to ${target} to complete the change.`,
      });
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Failed to start email change.");
    } finally {
      setSavingEmail(false);
    }
  }, [emailDraft, showToast, user]);

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

  // -----------------------------------------------------------------
  // Workload save handlers (creative-only). Each saves independently
  // so a creative can update only the field they meant to change.
  // Server enforces role=DESIGNER on these fields and rejects edits
  // from any other role with a 403 — that's defence-in-depth; the
  // section itself only renders for DESIGNER.
  // -----------------------------------------------------------------
  const handleSaveWorkingHours = useCallback(async () => {
    if (!user) return;
    const next = workingHoursDraft.trim();
    const current = user.workingHours ?? "";
    if (next === current) {
      showToast({ type: "info", title: "No changes to save." });
      return;
    }
    setSavingWorkingHours(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workingHours: next === "" ? null : next }),
      });
      const body = (await res.json().catch(() => null)) as {
        user?: ProfileUser;
        error?: string;
      } | null;
      if (!res.ok || !body?.user) {
        throw new Error(body?.error || "Failed to save");
      }
      setUser(body.user);
      setWorkingHoursDraft(body.user.workingHours ?? "");
      showToast({ type: "success", title: "Working hours updated" });
    } catch (err) {
      showToast({
        type: "error",
        title: err instanceof Error ? err.message : "Failed to save working hours",
      });
    } finally {
      setSavingWorkingHours(false);
    }
  }, [showToast, user, workingHoursDraft]);

  const handleSaveTasksCap = useCallback(async () => {
    if (!user) return;
    const trimmed = tasksCapDraft.trim();
    const current = user.tasksPerWeekCap == null ? "" : String(user.tasksPerWeekCap);
    if (trimmed === current) {
      showToast({ type: "info", title: "No changes to save." });
      return;
    }
    let nextCap: number | null;
    if (trimmed === "") {
      nextCap = null;
    } else {
      const parsed = Number.parseInt(trimmed, 10);
      if (!Number.isFinite(parsed) || parsed < 1 || parsed > 40) {
        showToast({
          type: "error",
          title: "Cap must be a whole number between 1 and 40, or empty.",
        });
        return;
      }
      nextCap = parsed;
    }
    setSavingTasksCap(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasksPerWeekCap: nextCap }),
      });
      const body = (await res.json().catch(() => null)) as {
        user?: ProfileUser;
        error?: string;
      } | null;
      if (!res.ok || !body?.user) {
        throw new Error(body?.error || "Failed to save");
      }
      setUser(body.user);
      setTasksCapDraft(body.user.tasksPerWeekCap == null ? "" : String(body.user.tasksPerWeekCap));
      showToast({
        type: "success",
        title: nextCap == null ? "Cap cleared" : `Cap set to ${nextCap}`,
      });
    } catch (err) {
      showToast({
        type: "error",
        title: err instanceof Error ? err.message : "Failed to save cap",
      });
    } finally {
      setSavingTasksCap(false);
    }
  }, [showToast, tasksCapDraft, user]);

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
  // Sessions: refresh, revoke one, revoke all others. We re-fetch the
  // list after each mutation so the UI reflects the truth rather than
  // optimistically guessing — sessions can also expire on their own
  // and a stale list would mislead the user.
  // -----------------------------------------------------------------
  const refreshSessions = useCallback(async () => {
    const res = await authClient.listSessions();
    if (res.error) {
      setSessionsError(res.error.message ?? "Couldn't refresh sessions");
      return;
    }
    setSessionsError(null);
    setSessionsList((res.data as unknown as SessionListItem[]) ?? []);
  }, []);

  const handleRevokeSession = useCallback(
    async (token: string) => {
      setRevokingTokens((prev) => new Set(prev).add(token));
      try {
        const { error } = await authClient.revokeSession({ token });
        if (error) {
          showToast({
            type: "error",
            title: error.message ?? "Couldn't sign that session out.",
          });
          return;
        }
        showToast({ type: "success", title: "Session signed out." });
        await refreshSessions();
      } finally {
        setRevokingTokens((prev) => {
          const copy = new Set(prev);
          copy.delete(token);
          return copy;
        });
      }
    },
    [refreshSessions, showToast],
  );

  const handleRevokeOtherSessions = useCallback(async () => {
    setRevokingOthers(true);
    try {
      const { error } = await authClient.revokeOtherSessions();
      if (error) {
        showToast({
          type: "error",
          title: error.message ?? "Couldn't sign out other sessions.",
        });
        return;
      }
      showToast({
        type: "success",
        title: "Signed out from all other devices.",
      });
      await refreshSessions();
    } finally {
      setRevokingOthers(false);
    }
  }, [refreshSessions, showToast]);

  // -----------------------------------------------------------------
  // 2FA enable — start. Asks BetterAuth for the TOTP URI; the user's
  // password is required because /two-factor/enable is a sensitive
  // change. The QR + secret are surfaced to the user immediately so
  // they can scan, then we stay open for the verify step.
  // -----------------------------------------------------------------
  const handleStart2FAEnable = useCallback(async () => {
    if (!user) return;
    if (!twoFaPassword) {
      setTwoFaEnrollment({
        stage: "qr",
        uri: "",
        secret: "",
        codeDraft: "",
        saving: false,
        error: "Enter your current password to continue.",
      });
      return;
    }
    try {
      const { data, error } = await authClient.twoFactor.enable({
        password: twoFaPassword,
        // Don't issue a backup-code-only redirect; we explicitly verify
        // a TOTP code in the next step before considering enrollment
        // complete. This avoids the user thinking they enrolled when
        // they actually skipped the QR-scan check.
      });
      if (error || !data) {
        setTwoFaEnrollment({
          stage: "qr",
          uri: "",
          secret: "",
          codeDraft: "",
          saving: false,
          error: error?.message ?? "Couldn't start two-factor enrollment. Check your password.",
        });
        return;
      }
      const totpURI = (data as { totpURI?: string }).totpURI ?? "";
      // BetterAuth's enable response includes `totpURI`; the secret is
      // embedded in it. We surface both so the user can either scan
      // the QR (preferred) or copy the raw secret manually.
      const secretMatch = /[?&]secret=([^&]+)/.exec(totpURI);
      const secret = secretMatch ? decodeURIComponent(secretMatch[1]) : "";
      setTwoFaEnrollment({
        stage: "qr",
        uri: totpURI,
        secret,
        codeDraft: "",
        saving: false,
        error: null,
      });
    } catch (err) {
      setTwoFaEnrollment({
        stage: "qr",
        uri: "",
        secret: "",
        codeDraft: "",
        saving: false,
        error: err instanceof Error ? err.message : "Couldn't start enrollment.",
      });
    }
  }, [twoFaPassword, user]);

  // -----------------------------------------------------------------
  // 2FA enable — confirm. The QR has been scanned; user enters the
  // 6-digit TOTP code from their app. On success BetterAuth flips
  // twoFactorEnabled and emits the backup codes we stash for the
  // user to save.
  // -----------------------------------------------------------------
  const handleConfirm2FAEnable = useCallback(async () => {
    if (twoFaEnrollment.stage !== "qr") return;
    const code = twoFaEnrollment.codeDraft.trim();
    if (!code) {
      setTwoFaEnrollment({ ...twoFaEnrollment, error: "Enter the 6-digit code." });
      return;
    }
    setTwoFaEnrollment({ ...twoFaEnrollment, saving: true, error: null });
    try {
      const { data, error } = await authClient.twoFactor.verifyTotp({ code });
      if (error || !data) {
        setTwoFaEnrollment({
          ...twoFaEnrollment,
          saving: false,
          error: error?.message ?? "Code didn't match. Check the time and try again.",
        });
        return;
      }
      // The enable + verify pair completed; AuthUser.twoFactorEnabled
      // is now true and a backup-code set was generated. Some plugin
      // versions return the codes alongside the verify response;
      // others require a follow-up to /two-factor/get-backup-codes.
      // We attempt the in-band path first.
      const backupFromResponse = (data as { backupCodes?: string[] }).backupCodes ?? [];
      let backupCodes: string[] = backupFromResponse;
      if (backupCodes.length === 0) {
        try {
          const stash = await authClient.twoFactor.generateBackupCodes({
            password: twoFaPassword,
          });
          const codes = (stash.data as { backupCodes?: string[] } | null)?.backupCodes ?? [];
          backupCodes = codes;
        } catch {
          // Non-fatal — the user can regenerate later from the same
          // section. We just don't have anything to display now.
        }
      }
      setUser((prev) => (prev ? { ...prev, twoFactorEnabled: true } : prev));
      setTwoFaPassword("");
      setTwoFaEnrollment({ stage: "codes", backupCodes });
      showToast({ type: "success", title: "Two-factor authentication is on." });
    } catch (err) {
      setTwoFaEnrollment({
        ...twoFaEnrollment,
        saving: false,
        error: err instanceof Error ? err.message : "Couldn't verify code.",
      });
    }
  }, [showToast, twoFaEnrollment, twoFaPassword]);

  // -----------------------------------------------------------------
  // 2FA disable — typed-password confirm. Re-uses the small modal
  // pattern the delete-account flow uses; password verification is
  // BetterAuth's safety gate.
  // -----------------------------------------------------------------
  const handleConfirm2FADisable = useCallback(async () => {
    setTwoFaDisableError(null);
    if (!twoFaPassword) {
      setTwoFaDisableError("Enter your current password.");
      return;
    }
    setTwoFaDisabling(true);
    try {
      const { error } = await authClient.twoFactor.disable({ password: twoFaPassword });
      if (error) {
        setTwoFaDisableError(error.message ?? "Couldn't disable two-factor.");
        setTwoFaDisabling(false);
        return;
      }
      setUser((prev) => (prev ? { ...prev, twoFactorEnabled: false } : prev));
      setTwoFaPassword("");
      setTwoFaDisableOpen(false);
      setTwoFaDisabling(false);
      setTwoFaEnrollment({ stage: "idle" });
      showToast({ type: "success", title: "Two-factor authentication turned off." });
    } catch (err) {
      setTwoFaDisableError(err instanceof Error ? err.message : "Couldn't disable two-factor.");
      setTwoFaDisabling(false);
    }
  }, [showToast, twoFaPassword]);

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

        {/* Avatar — circle, with initials fallback. Click anywhere on the
            row to swap, or use the explicit Change/Remove buttons. The
            file input is hidden and triggered programmatically so the
            UI can stay restrained. */}
        <div className="mb-5 flex flex-wrap items-center gap-4">
          <div
            className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[var(--bb-bg-page)] text-lg font-semibold text-[var(--bb-text-secondary)] ring-1 ring-[var(--bb-border)]"
            aria-label={user.image ? "Your avatar" : "Avatar placeholder with your initials"}
          >
            {user.image ? (
              // Rendered via <img> rather than next/image because the
              // source is a public R2 URL the optimizer can't help with
              // and we don't need a layout-shift placeholder.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.image} alt="" className="h-full w-full object-cover" />
            ) : (
              <span aria-hidden="true">{(user.name || user.email)[0]?.toUpperCase() ?? "?"}</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleUploadAvatar(f);
                // Reset so the same file can be re-selected (e.g. after
                // a failed upload).
                e.target.value = "";
              }}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar || removingAvatar}
              loading={uploadingAvatar}
              loadingText="Uploading…"
            >
              {user.image ? "Change avatar" : "Upload avatar"}
            </Button>
            {user.image && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void handleRemoveAvatar()}
                disabled={uploadingAvatar || removingAvatar}
                loading={removingAvatar}
                loadingText="Removing…"
              >
                Remove
              </Button>
            )}
          </div>
          <p className="basis-full text-[11px] text-[var(--bb-text-muted)]">
            PNG, JPEG, WebP, or GIF. 2&nbsp;MB max. Square images crop best.
          </p>
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
            <label
              className="block text-xs font-medium text-[var(--bb-text-secondary)]"
              htmlFor="profile-email"
            >
              Email
            </label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <FormInput
                id="profile-email"
                type="email"
                value={emailDraft}
                onChange={(e) => {
                  setEmailDraft(e.target.value);
                  if (emailError) setEmailError(null);
                }}
                autoComplete="email"
                placeholder="you@example.com"
                error={!!emailError}
                disabled={savingEmail}
                className="min-w-[200px] flex-1"
              />
              <Button
                onClick={() => void handleRequestEmailChange()}
                disabled={
                  savingEmail || emailDraft.trim().toLowerCase() === user.email.toLowerCase()
                }
                loading={savingEmail}
                loadingText="Sending…"
              >
                Change email
              </Button>
            </div>
            {emailError && (
              <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{emailError}</p>
            )}
            {pendingEmail && !emailError && (
              <p className="mt-1 text-[11px] text-[var(--bb-text-muted)]">
                Pending — we sent a confirmation link to <strong>{pendingEmail}</strong>. Open it
                from that inbox to complete the swap. Until then, you stay signed in as{" "}
                <strong>{user.email}</strong>.
              </p>
            )}
            {!pendingEmail && !emailError && (
              <p className="mt-1 text-[11px] text-[var(--bb-text-muted)]">
                We&apos;ll email a confirmation link to the new address. Your current email stays in
                effect until you open the link.
              </p>
            )}
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

      {/* ---- Workload (creative-only) ---- */}
      {user.role === "DESIGNER" && (
        <section className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)] p-6">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-[var(--bb-secondary)]">Workload</h2>
            <p className="mt-0.5 text-xs text-[var(--bb-text-muted)]">
              When you&apos;re available and how many tickets you&apos;re willing to hold at once.
              Auto-assign uses the cap to skip you when you&apos;re already at capacity; admins use
              the working-hours hint when scheduling rush work.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[var(--bb-text-secondary)]">
                Working hours
              </label>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <FormInput
                  value={workingHoursDraft}
                  onChange={(e) => setWorkingHoursDraft(e.target.value)}
                  placeholder="e.g. 9–18 weekdays, Europe/Istanbul"
                  maxLength={200}
                  className="min-w-[220px] flex-1"
                />
                <Button
                  onClick={() => void handleSaveWorkingHours()}
                  disabled={
                    savingWorkingHours || workingHoursDraft.trim() === (user.workingHours ?? "")
                  }
                  loading={savingWorkingHours}
                  loadingText="Saving…"
                >
                  Save
                </Button>
              </div>
              <p className="mt-1 text-[11px] text-[var(--bb-text-muted)]">
                Free-form text — describe the days and hours you&apos;re typically online. Anything
                an admin can read at a glance works.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--bb-text-secondary)]">
                Concurrent task cap
              </label>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <FormInput
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={40}
                  value={tasksCapDraft}
                  onChange={(e) => setTasksCapDraft(e.target.value)}
                  placeholder="No cap"
                  aria-label="Concurrent task cap"
                  className="w-32"
                />
                <Button
                  onClick={() => void handleSaveTasksCap()}
                  disabled={
                    savingTasksCap ||
                    tasksCapDraft.trim() ===
                      (user.tasksPerWeekCap == null ? "" : String(user.tasksPerWeekCap))
                  }
                  loading={savingTasksCap}
                  loadingText="Saving…"
                >
                  Save
                </Button>
                {user.tasksPerWeekCap != null && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setTasksCapDraft("");
                      void handleSaveTasksCap();
                    }}
                    disabled={savingTasksCap}
                  >
                    Clear
                  </Button>
                )}
              </div>
              <p className="mt-1 text-[11px] text-[var(--bb-text-muted)]">
                Auto-assign skips you when your open ticket count reaches this number. Empty means
                no cap (the legacy behavior). Admin can also adjust this.
              </p>
            </div>
          </div>
        </section>
      )}

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

      {/* ---- Two-factor authentication ---- */}
      <section className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)] p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--bb-secondary)]">
              Two-factor authentication
            </h2>
            <p className="mt-0.5 text-xs text-[var(--bb-text-muted)]">
              Require a one-time code from your authenticator app each time you sign in. Backup
              codes recover access if you lose your phone.
            </p>
          </div>
          <Badge variant={user.twoFactorEnabled ? "success" : "neutral"}>
            {user.twoFactorEnabled ? "Enabled" : "Disabled"}
          </Badge>
        </div>

        {/* Disabled — show enable CTA. The password field below is bound
            to twoFaPassword so the user types once and we forward it to
            BetterAuth's enable + (later) generate-backup-codes calls. */}
        {!user.twoFactorEnabled && twoFaEnrollment.stage === "idle" && (
          <div className="space-y-3">
            <p className="text-sm text-[var(--bb-text-secondary)]">
              We&apos;ll show you a QR code to scan with Google Authenticator, 1Password, Authy, or
              your password manager of choice.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[220px] flex-1">
                <label className="block text-xs font-medium text-[var(--bb-text-secondary)]">
                  Current password
                </label>
                <FormInput
                  type="password"
                  value={twoFaPassword}
                  onChange={(e) => setTwoFaPassword(e.target.value)}
                  autoComplete="current-password"
                  className="mt-1 w-full"
                />
              </div>
              <Button onClick={() => void handleStart2FAEnable()} disabled={!twoFaPassword}>
                Set up
              </Button>
            </div>
          </div>
        )}

        {/* Enrolling — QR + secret + verify code input. */}
        {twoFaEnrollment.stage === "qr" && (
          <div className="space-y-4">
            {twoFaEnrollment.uri ? (
              <>
                <p className="text-sm text-[var(--bb-text-secondary)]">
                  Scan this QR code in your authenticator app, then enter the 6-digit code below to
                  confirm.
                </p>
                <div className="flex flex-wrap items-start gap-4">
                  {/* QR rendered by our own /api/profile/two-factor/qr —
                      keeps the TOTP secret on our infrastructure. Using
                      <img> rather than next/image because the source is
                      a per-request server-rendered PNG, not a static
                      asset Next can optimize. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt="Two-factor QR code"
                    className="h-44 w-44 rounded-xl border border-[var(--bb-border)] bg-white p-2"
                    src={`/api/profile/two-factor/qr?uri=${encodeURIComponent(twoFaEnrollment.uri)}`}
                  />
                  <div className="min-w-[220px] flex-1 space-y-2">
                    <p className="text-xs text-[var(--bb-text-muted)]">
                      Or paste this secret manually:
                    </p>
                    <code className="block rounded-lg border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-3 py-2 text-xs break-all text-[var(--bb-secondary)]">
                      {twoFaEnrollment.secret}
                    </code>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--bb-text-secondary)]">
                    Code from your app
                  </label>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <FormInput
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="123 456"
                      value={twoFaEnrollment.codeDraft}
                      onChange={(e) =>
                        setTwoFaEnrollment({
                          ...twoFaEnrollment,
                          codeDraft: e.target.value,
                          error: null,
                        })
                      }
                      className="min-w-[160px] flex-1 tracking-widest"
                    />
                    <Button
                      onClick={() => void handleConfirm2FAEnable()}
                      disabled={twoFaEnrollment.saving}
                      loading={twoFaEnrollment.saving}
                      loadingText="Verifying…"
                    >
                      Confirm and enable
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setTwoFaEnrollment({ stage: "idle" });
                        setTwoFaPassword("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              twoFaEnrollment.error && (
                <InlineAlert variant="error">{twoFaEnrollment.error}</InlineAlert>
              )
            )}
            {twoFaEnrollment.uri && twoFaEnrollment.error && (
              <InlineAlert variant="error">{twoFaEnrollment.error}</InlineAlert>
            )}
          </div>
        )}

        {/* Backup codes — shown ONCE on enable success. The user is
            told to copy / print these somewhere safe. */}
        {twoFaEnrollment.stage === "codes" && (
          <div className="space-y-3">
            <InlineAlert variant="success" title="Two-factor is now on">
              Save these backup codes somewhere safe. Each one works exactly once and lets you sign
              in if you lose access to your authenticator app.
            </InlineAlert>
            {twoFaEnrollment.backupCodes.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {twoFaEnrollment.backupCodes.map((code) => (
                  <code
                    key={code}
                    className="rounded-lg border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-3 py-2 text-center text-xs tracking-widest"
                  >
                    {code}
                  </code>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--bb-text-muted)]">
                Backup codes weren&apos;t included in the response. Use the &quot;Regenerate backup
                codes&quot; option below to create a fresh set, then copy them to a safe place.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  if (twoFaEnrollment.backupCodes.length === 0) return;
                  void navigator.clipboard
                    .writeText(twoFaEnrollment.backupCodes.join("\n"))
                    .then(() => showToast({ type: "success", title: "Backup codes copied." }))
                    .catch(() =>
                      showToast({ type: "error", title: "Couldn't copy — copy manually." }),
                    );
                }}
                disabled={twoFaEnrollment.backupCodes.length === 0}
              >
                Copy codes
              </Button>
              <Button onClick={() => setTwoFaEnrollment({ stage: "idle" })}>
                I&apos;ve saved them
              </Button>
            </div>
          </div>
        )}

        {/* Enabled (and not mid-enrollment) — show status + disable CTA. */}
        {user.twoFactorEnabled && twoFaEnrollment.stage === "idle" && (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-[var(--bb-text-secondary)]">
              You&apos;re asked for an authenticator code every time you sign in.
            </p>
            <Button
              variant="ghost"
              onClick={() => {
                setTwoFaPassword("");
                setTwoFaDisableError(null);
                setTwoFaDisableOpen(true);
              }}
              className="text-red-600 hover:text-red-700 dark:text-red-400"
            >
              Disable
            </Button>
          </div>
        )}
      </section>

      {/* ---- 2FA disable confirm modal ---- */}
      <Modal
        open={twoFaDisableOpen}
        onClose={() => {
          if (twoFaDisabling) return;
          setTwoFaDisableOpen(false);
          setTwoFaPassword("");
          setTwoFaDisableError(null);
        }}
        size="md"
      >
        <ModalHeader
          title="Turn off two-factor authentication?"
          onClose={() => {
            if (twoFaDisabling) return;
            setTwoFaDisableOpen(false);
            setTwoFaPassword("");
            setTwoFaDisableError(null);
          }}
        />
        <div className="space-y-3 px-6 pb-4 text-sm text-[var(--bb-text-secondary)]">
          <p>
            Confirm your current password to disable 2FA. Your existing backup codes will be
            invalidated.
          </p>
          <FormInput
            type="password"
            value={twoFaPassword}
            onChange={(e) => setTwoFaPassword(e.target.value)}
            placeholder="Current password"
            autoComplete="current-password"
            aria-label="Current password"
          />
          {twoFaDisableError && <InlineAlert variant="error">{twoFaDisableError}</InlineAlert>}
        </div>
        <ModalFooter>
          <Button
            variant="ghost"
            disabled={twoFaDisabling}
            onClick={() => {
              setTwoFaDisableOpen(false);
              setTwoFaPassword("");
              setTwoFaDisableError(null);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => void handleConfirm2FADisable()}
            loading={twoFaDisabling}
            loadingText="Disabling…"
            disabled={twoFaDisabling || !twoFaPassword}
          >
            Disable 2FA
          </Button>
        </ModalFooter>
      </Modal>

      {/* ---- Active sessions ---- */}
      <section className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)] p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--bb-secondary)]">Active sessions</h2>
            <p className="mt-0.5 text-xs text-[var(--bb-text-muted)]">
              Every browser you&apos;re signed in with. Sign out individual devices, or everything
              except this one in a single click.
            </p>
          </div>
          {sessionsList && sessionsList.length > 1 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void handleRevokeOtherSessions()}
              loading={revokingOthers}
              loadingText="Signing out…"
              disabled={revokingOthers}
            >
              Sign out everywhere else
            </Button>
          )}
        </div>

        {sessionsLoading && (
          <p className="text-sm text-[var(--bb-text-muted)]">Loading sessions…</p>
        )}
        {!sessionsLoading && sessionsError && (
          <InlineAlert variant="error">{sessionsError}</InlineAlert>
        )}
        {!sessionsLoading && !sessionsError && sessionsList && (
          <ul className="divide-y divide-[var(--bb-border-subtle)]">
            {sessionsList
              // Newest first by last activity (updatedAt). Matches Gmail / GitHub UX.
              .slice()
              .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
              .map((s) => {
                const isCurrent = currentSessionId !== null && s.id === currentSessionId;
                const isRevoking = revokingTokens.has(s.token);
                return (
                  <li key={s.id} className="flex flex-wrap items-start gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-[var(--bb-secondary)]">
                          {describeUserAgent(s.userAgent)}
                        </p>
                        {isCurrent && <Badge variant="success">This device</Badge>}
                      </div>
                      <p className="mt-0.5 text-xs text-[var(--bb-text-muted)]">
                        Last active {relativeTime(s.updatedAt)} &middot; First seen{" "}
                        {relativeTime(s.createdAt)} &middot; IP {maskIp(s.ipAddress)}
                      </p>
                    </div>
                    {!isCurrent && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleRevokeSession(s.token)}
                        loading={isRevoking}
                        loadingText="Signing out…"
                        disabled={isRevoking}
                      >
                        Sign out
                      </Button>
                    )}
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
