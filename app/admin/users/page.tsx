// -----------------------------------------------------------------------------
// @file: app/admin/users/page.tsx
// @purpose: Admin user directory — view all users, filter by role, change roles.
//           Paginated list on the left; selecting a user opens a "Manage user"
//           panel holding identity, the platform-role control (explicit Apply,
//           typed-phrase + MFA guards for privilege changes), creative-only
//           settings and the owner-only delete action.
// @version: v2.0.0
// @status: active
// @lastUpdate: 2026-11-01
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState, type SVGProps } from "react";
import { useToast } from "@/components/ui/toast-provider";
import { ConfirmTypedPhraseModal } from "@/components/admin/confirm-typed-phrase-modal";
import { MfaChallengeModal, type MfaChallengeInfo } from "@/components/admin/mfa-challenge-modal";
import { useSessionRole } from "@/lib/hooks/use-session-role";
import { useUnsavedChanges } from "@/components/admin/v2/unsaved-changes";
import {
  Avatar,
  Badge,
  Button,
  Callout,
  Card,
  DASH,
  DetailPanel,
  EmptyState,
  Field,
  FilterBar,
  IconTile,
  PageHeader,
  Pager,
  PanelSection,
  SaveBar,
  SearchInput,
  Select,
  Skeleton,
  SplitView,
  Switch,
  Table,
  TableFooter,
  Td,
  TextInput,
  TextLink,
  Th,
  Tr,
  fmt,
  plural,
  type Tone,
} from "@/components/admin/v2/ui";
import { IconBuilding, IconTicket, IconUsers } from "@/components/admin/v2/icons";
import {
  WorkScheduleEditor,
  workScheduleProblem,
} from "@/components/work-schedule/work-schedule-editor";
import { WorkScheduleSummary } from "@/components/work-schedule/work-schedule-summary";
import { defaultWorkSchedule, sameWorkSchedule, type WorkSchedule } from "@/lib/work-schedule";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
  isPaused: boolean;
  creativeRevisionNotesEnabled: boolean;
  // PR11 — capacity cap. Null = no cap (legacy default).
  tasksPerWeekCap: number | null;
  // Old free-text note, shown read-only until a schedule is set.
  workingHours: string | null;
  workSchedule: WorkSchedule | null;
  workScheduleUpdatedAt: string | null;
  // Set when the account is soft-deleted (anonymized tombstone kept for
  // ledger / audit integrity). Rows with this set render read-only.
  deletedAt: string | null;
  companyCount: number;
  assignedTickets: number;
};

const ROLE_OPTIONS = [
  { value: "SITE_OWNER", label: "Site Owner" },
  { value: "SITE_ADMIN", label: "Site Admin" },
  { value: "DESIGNER", label: "Creative" },
  { value: "CUSTOMER", label: "Customer" },
];

const ROLE_LABELS: Record<string, string> = {
  SITE_OWNER: "Site Owner",
  SITE_ADMIN: "Site Admin",
  DESIGNER: "Creative",
  CUSTOMER: "Customer",
};

const ROLE_TONES: Record<string, Tone> = {
  SITE_OWNER: "amber",
  SITE_ADMIN: "blue",
  DESIGNER: "green",
  CUSTOMER: "lavender",
};

const ROLE_HINTS: Record<string, string> = {
  SITE_OWNER: "Full access, including owner-only money-moving actions.",
  SITE_ADMIN: "Runs the admin workspace. No owner-only money actions.",
  DESIGNER: "Works on assigned tickets in the creative workspace.",
  CUSTOMER: "Uses the customer portal for their companies.",
};

const PAGE_SIZES = [10, 25, 50];

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const displayName = (u: Pick<UserRow, "name" | "email">) => u.name || u.email;

function IconChevronRight() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function IconCalendar(p: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...p}
    >
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminUsersPage() {
  const { showToast } = useToast();
  // The Delete-user action is SITE_OWNER only. SITE_ADMIN sees the
  // rest of the page exactly as before; the delete button never renders
  // for them. Server-side enforcement still gates the API.
  const { isSiteOwner } = useSessionRole();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [roleFilter, setRoleFilter] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  // Soft-deleted (anonymized) accounts are hidden by default; this toggle
  // includes them so an admin can trace audit rows back to a tombstone.
  const [showDeleted, setShowDeleted] = useState(false);

  // Client-side pagination over the fetched list.
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);

  // Selection (drives the Manage user panel). `?user=<id>` preselects —
  // the detail page's "Manage user" button links here with it.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preselectId, setPreselectId] = useState<string | null>(null);

  // Role editing — draft role for the selected user; Apply commits it.
  const [pendingRole, setPendingRole] = useState("");
  const [saving, setSaving] = useState(false);
  const [togglingNotesId, setTogglingNotesId] = useState<string | null>(null);

  // PR11 — cap editor draft (string so the input doesn't clamp on every
  // keystroke). Workload PR — working-hours draft. Both belong to the
  // selected user and are reset whenever the selection changes.
  const [pendingCap, setPendingCap] = useState<string>("");
  const [savingCap, setSavingCap] = useState(false);
  const [pendingSchedule, setPendingSchedule] = useState<WorkSchedule>(() => defaultWorkSchedule());
  const [savingHours, setSavingHours] = useState(false);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("user");
    if (id) setPreselectId(id);
  }, []);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Fetch users
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (roleFilter) params.set("role", roleFilter);
        if (debouncedSearch) params.set("q", debouncedSearch);
        if (showDeleted) params.set("includeDeleted", "1");

        const res = await fetch(`/api/admin/users?${params}`, { cache: "no-store" });
        const json = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(json?.error || "Failed to load users");
        }
        if (!cancelled) {
          setUsers(json.users ?? []);
          setLoaded(true);
          setPage(1);
        }
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load users");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();

    return () => {
      cancelled = true;
    };
  }, [roleFilter, debouncedSearch, showDeleted]);

  // Open the panel for a `?user=` id once the list is in, on the right page.
  useEffect(() => {
    if (!preselectId || !loaded) return;
    const idx = users.findIndex((u) => u.id === preselectId);
    if (idx >= 0) {
      setSelectedId(preselectId);
      setPage(Math.floor(idx / pageSize) + 1);
    }
    setPreselectId(null);
  }, [preselectId, loaded, users, pageSize]);

  const selected = users.find((u) => u.id === selectedId) ?? null;

  // Drafts belong to the selected user only; switching user resets them.
  const roleDirty = selected != null && pendingRole !== "" && pendingRole !== selected.role;
  const capDirty =
    selected != null &&
    pendingCap.trim() !==
      (selected.tasksPerWeekCap == null ? "" : String(selected.tasksPerWeekCap));
  // A creative with no schedule yet starts from a default, which isn't an edit.
  const scheduleBaseline = selected?.workSchedule ?? defaultWorkSchedule();
  const hoursDirty =
    selected?.role === "DESIGNER" && !sameWorkSchedule(pendingSchedule, scheduleBaseline);
  const canSaveSchedule =
    selected?.role === "DESIGNER" &&
    workScheduleProblem(pendingSchedule) === null &&
    (hoursDirty || !selected.workSchedule);
  const confirmDiscard = useUnsavedChanges(roleDirty || capDirty || hoursDirty, "Manage user");

  const resetDrafts = (u: UserRow | null) => {
    if (!u) return;
    setPendingRole(u.role);
    setPendingCap(u.tasksPerWeekCap == null ? "" : String(u.tasksPerWeekCap));
    setPendingSchedule(u.workSchedule ?? defaultWorkSchedule());
  };

  // Below xl the panel stacks under the list — bring it into view.
  const selectUser = async (id: string) => {
    if (id === selectedId) return;
    if (!(await confirmDiscard())) return;
    setSelectedId(id);
    if (window.matchMedia("(max-width: 1279px)").matches) {
      requestAnimationFrame(() =>
        document
          .getElementById("manage-user-panel")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }
  };

  const closePanel = async () => {
    if (!(await confirmDiscard())) return;
    setSelectedId(null);
  };

  // Filters reload the list and can drop the selected user (and the panel),
  // so ask first and clear the drafts once the user agrees.
  const confirmFilterChange = async () => {
    if (!(await confirmDiscard())) return false;
    resetDrafts(selected);
    return true;
  };

  // Reset the drafts whenever a different user is selected.
  useEffect(() => {
    resetDrafts(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset on selection change only
  }, [selected?.id]);

  // Confirmation-modal state for privilege-escalation role changes (L2).
  // Non-privilege role swaps (e.g. CUSTOMER <-> DESIGNER) skip the modal
  // and run directly through the same code path.
  const [pendingPromote, setPendingPromote] = useState<{
    userId: string;
    targetEmail: string;
    currentRole: string;
    newRole: string;
  } | null>(null);

  // L4 MFA state for privilege escalations (shares the MONEY_ACTION
  // trust window with withdrawals + token grants).
  const [pendingMfa, setPendingMfa] = useState<{
    challenge: MfaChallengeInfo;
    retry: () => Promise<void>;
  } | null>(null);

  // Hard-delete (SITE_OWNER only). Two-stage: first the typed-phrase
  // modal collects "DELETE", then if the server demands fresh MFA the
  // shared MFA challenge fires and re-runs on success.
  const [pendingDelete, setPendingDelete] = useState<{
    userId: string;
    targetEmail: string;
    targetRole: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteUser = async (userId: string, confirmation: string) => {
    setDeleting(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, confirmation }),
      });
      const json = await res.json().catch(() => null);

      // Server is asking for MFA — stash a retry that re-runs delete
      // once the MFA modal verifies. Same shape as the role-change flow.
      if (res.status === 202 && json?.requiresMfa) {
        setPendingMfa({
          challenge: {
            method: json.method,
            challengeId: json.challengeId,
            maskedEmail: json.maskedEmail,
            expiresAt: json.expiresAt,
            actionTag: json.actionTag,
          },
          retry: () => handleDeleteUser(userId, confirmation),
        });
        return;
      }

      if (!res.ok) {
        const msg = json?.error || "Failed to delete user";
        showToast({ title: msg, type: "error" });
        throw new Error(msg); // surface to the modal so it stays open
      }

      // Soft-delete = remove from the list. The row is anonymized
      // server-side; a subsequent reload would show "deleted-…" if we
      // didn't filter, which would be confusing.
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setSelectedId((prev) => (prev === userId ? null : prev));
      showToast({ title: "User deleted", type: "success" });
    } finally {
      setDeleting(false);
    }
  };

  // Change role. `confirmation` is passed through to the API when the
  // change involves a SITE_OWNER or SITE_ADMIN on either side.
  const handleRoleChange = async (userId: string, newRole: string, confirmation?: string) => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole, confirmation }),
      });
      const json = await res.json().catch(() => null);

      // L4 — 202 means server is asking for MFA. Stash retry and let the
      // modal drive re-submission once verified.
      if (res.status === 202 && json?.requiresMfa) {
        setPendingMfa({
          challenge: {
            method: json.method,
            challengeId: json.challengeId,
            maskedEmail: json.maskedEmail,
            expiresAt: json.expiresAt,
            actionTag: json.actionTag,
          },
          retry: () => handleRoleChange(userId, newRole, confirmation),
        });
        return;
      }

      if (!res.ok) {
        const msg = json?.error || "Failed to update role";
        showToast({ title: msg, type: "error" });
        throw new Error(msg); // surface to the modal if one is open
      }

      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
      showToast({ title: `Role updated to ${ROLE_LABELS[newRole] || newRole}`, type: "success" });
    } finally {
      setSaving(false);
    }
  };

  // Apply the drafted role. Privilege-escalation changes require the
  // typed-phrase confirmation; everything else runs direct.
  const applyRole = (u: UserRow) => {
    if (pendingRole === u.role) return;
    const isPrivilegeChange =
      pendingRole === "SITE_OWNER" || pendingRole === "SITE_ADMIN" || u.role === "SITE_OWNER";
    if (isPrivilegeChange) {
      setPendingPromote({
        userId: u.id,
        targetEmail: u.email,
        currentRole: u.role,
        newRole: pendingRole,
      });
    } else {
      void handleRoleChange(u.id, pendingRole).catch(() => {
        // error toast already shown
      });
    }
  };

  // PR11 — save the cap edit. Empty string clears (sends null);
  // otherwise sends a number. Server validates 1..40.
  const handleSaveCap = async (userId: string) => {
    setSavingCap(true);
    try {
      const trimmed = pendingCap.trim();
      let nextCap: number | null;
      if (trimmed === "") {
        nextCap = null;
      } else {
        const parsed = Number.parseInt(trimmed, 10);
        if (!Number.isFinite(parsed) || parsed < 1 || parsed > 40) {
          showToast({
            title: "Cap must be a whole number between 1 and 40, or empty.",
            type: "error",
          });
          setSavingCap(false);
          return;
        }
        nextCap = parsed;
      }

      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, tasksPerWeekCap: nextCap }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        showToast({ title: json?.error || "Failed to save cap", type: "error" });
        return;
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, tasksPerWeekCap: nextCap } : u)),
      );
      showToast({
        title: nextCap == null ? "Cap cleared" : `Cap set to ${nextCap}`,
        type: "success",
      });
      setPendingCap(nextCap == null ? "" : String(nextCap));
    } catch {
      showToast({ title: "Failed to save cap", type: "error" });
    } finally {
      setSavingCap(false);
    }
  };

  const handleSaveHours = async (userId: string) => {
    setSavingHours(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, workSchedule: pendingSchedule }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        showToast({ title: json?.error || "Failed to save working hours", type: "error" });
        return;
      }
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? {
                ...u,
                workSchedule: json.user.workSchedule,
                workScheduleUpdatedAt: json.user.workScheduleUpdatedAt,
              }
            : u,
        ),
      );
      showToast({ title: "Working hours updated", type: "success" });
    } catch {
      showToast({ title: "Failed to save working hours", type: "error" });
    } finally {
      setSavingHours(false);
    }
  };

  // Toggle revision notes
  const handleToggleRevisionNotes = async (userId: string, currentValue: boolean) => {
    setTogglingNotesId(userId);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, creativeRevisionNotesEnabled: !currentValue }),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        showToast({ title: json?.error || "Failed to update setting", type: "error" });
        return;
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, creativeRevisionNotesEnabled: !currentValue } : u,
        ),
      );
      showToast({
        title: `Revision notes ${!currentValue ? "enabled" : "disabled"}`,
        type: "success",
      });
    } catch {
      showToast({ title: "Failed to update setting", type: "error" });
    } finally {
      setTogglingNotesId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Derived list state
  // ---------------------------------------------------------------------------

  const filtersActive = roleFilter !== "" || debouncedSearch.trim() !== "" || showDeleted;
  const resetFilters = async () => {
    if (!(await confirmFilterChange())) return;
    setRoleFilter("");
    setSearch("");
    setDebouncedSearch("");
    setShowDeleted(false);
  };

  const pageCount = Math.max(1, Math.ceil(users.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = useMemo(
    () => users.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [users, currentPage, pageSize],
  );
  const rangeStart = users.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, users.length);

  // ---------------------------------------------------------------------------
  // Manage user panel
  // ---------------------------------------------------------------------------

  const panel = selected ? (
    <div id="manage-user-panel" className="min-w-0 scroll-mt-24">
      <DetailPanel
        title="Manage user"
        onClose={() => void closePanel()}
        closeLabel="Close user panel"
        footer={
          selected.deletedAt ? undefined : (
            <SaveBar
              dirty={roleDirty}
              status={
                saving
                  ? "Applying role…"
                  : roleDirty
                    ? `Role will change to ${ROLE_LABELS[pendingRole] || pendingRole}`
                    : undefined
              }
            >
              {roleDirty && (
                <Button
                  variant="ghost"
                  onClick={() => setPendingRole(selected.role)}
                  disabled={saving}
                >
                  Reset
                </Button>
              )}
              <Button
                variant="primary"
                onClick={() => applyRole(selected)}
                disabled={!roleDirty || saving}
                aria-busy={saving}
              >
                {saving ? "Applying…" : "Apply role"}
              </Button>
            </SaveBar>
          )
        }
      >
        <PanelSection>
          <div className="flex items-start gap-4">
            <Avatar name={displayName(selected)} size={64} tone="neutral" />
            <div className="min-w-0">
              <p className="truncate text-xl leading-7 font-bold">{selected.name || DASH}</p>
              <p className="truncate text-sm text-[var(--av2-text-2)]">{selected.email}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge tone={ROLE_TONES[selected.role] ?? "neutral"}>
                  {ROLE_LABELS[selected.role] || selected.role}
                </Badge>
                {selected.role === "DESIGNER" && selected.isPaused && (
                  <Badge tone="amber">Paused</Badge>
                )}
                {selected.deletedAt && <Badge tone="red">Deleted</Badge>}
              </div>
              <div className="mt-3">
                <TextLink href={`/admin/users/${selected.id}`}>Open user profile</TextLink>
              </div>
            </div>
          </div>
        </PanelSection>

        {selected.deletedAt ? (
          <PanelSection>
            {/* Tombstone — auth is revoked and the identity is anonymized,
              so every action here would 400. Show when it happened instead. */}
            <Callout tone="info" title={`Deleted ${formatDate(selected.deletedAt)}`}>
              This account was anonymized. Its tickets, ledger entries and audit rows are kept, but
              it can no longer be edited.
            </Callout>
          </PanelSection>
        ) : (
          <PanelSection title="Platform role">
            <Field
              label={<span className="sr-only">Platform role</span>}
              htmlFor="user-role"
              hint={
                ROLE_HINTS[pendingRole] ??
                "This role controls what the person can access across the platform."
              }
            >
              <Select
                id="user-role"
                value={pendingRole}
                onChange={(e) => setPendingRole(e.target.value)}
                disabled={saving}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </Field>
            {roleDirty &&
              (pendingRole === "SITE_OWNER" ||
                pendingRole === "SITE_ADMIN" ||
                selected.role === "SITE_OWNER") && (
                <p className="mt-3 text-xs text-[var(--av2-text-2)]">
                  Admin-level change: you&apos;ll be asked to type PROMOTE, and may need to verify
                  with MFA.
                </p>
              )}
          </PanelSection>
        )}

        <PanelSection title="Activity">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3 rounded-xl border border-[var(--av2-border)] p-3">
              <IconTile tone="lavender" size={40}>
                <IconBuilding width={20} height={20} />
              </IconTile>
              <div className="min-w-0">
                <p className="text-xs text-[var(--av2-text-2)]">Companies</p>
                <p className="text-xl leading-7 font-bold tabular-nums">
                  {fmt(selected.companyCount)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-[var(--av2-border)] p-3">
              <IconTile tone="peach" size={40}>
                <IconTicket width={20} height={20} />
              </IconTile>
              <div className="min-w-0">
                <p className="text-xs text-[var(--av2-text-2)]">Assigned tickets</p>
                <p className="text-xl leading-7 font-bold tabular-nums">
                  {fmt(selected.assignedTickets)}
                </p>
              </div>
            </div>
          </div>
          <p className="mt-4 flex items-center gap-2 text-sm text-[var(--av2-text-2)]">
            <IconCalendar width={18} height={18} className="shrink-0" />
            Joined {formatDate(selected.createdAt)}
          </p>
        </PanelSection>

        {selected.role === "DESIGNER" && !selected.deletedAt && (
          <PanelSection title="Creative settings">
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p id="revision-notes-label" className="text-sm font-medium">
                    Revision notes
                  </p>
                  <p id="revision-notes-hint" className="mt-0.5 text-xs text-[var(--av2-text-2)]">
                    Let this creative attach notes when submitting a revision.
                  </p>
                </div>
                <Switch
                  checked={selected.creativeRevisionNotesEnabled}
                  onChange={() =>
                    handleToggleRevisionNotes(selected.id, selected.creativeRevisionNotesEnabled)
                  }
                  labelledBy="revision-notes-label"
                  describedBy="revision-notes-hint"
                  disabled={togglingNotesId === selected.id}
                />
              </div>

              {/* PR11 — tasks/week cap. Auto-assign in lib/tickets/create-ticket.ts
                skips this creative when their open count >= cap. Empty = no cap. */}
              <Field
                label="Open task cap"
                htmlFor="user-cap"
                hint="Auto-assign skips this creative once their open tickets reach the cap. 1–40, empty for no cap."
              >
                <div className="flex gap-2">
                  <div className="w-28">
                    <TextInput
                      id="user-cap"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={40}
                      value={pendingCap}
                      onChange={(e) => setPendingCap(e.target.value)}
                      placeholder="No cap"
                    />
                  </div>
                  <Button
                    onClick={() => handleSaveCap(selected.id)}
                    disabled={!capDirty || savingCap}
                    aria-busy={savingCap}
                  >
                    {savingCap ? "Saving…" : "Save cap"}
                  </Button>
                </div>
              </Field>

              <div>
                <h3 className="mb-1.5 text-sm font-medium">Working hours</h3>
                <WorkScheduleSummary
                  schedule={selected.workSchedule}
                  legacyNote={selected.workingHours}
                  updatedAt={selected.workScheduleUpdatedAt}
                />
                <div className="mt-4">
                  <WorkScheduleEditor
                    idPrefix="user-schedule"
                    value={pendingSchedule}
                    onChange={setPendingSchedule}
                    disabled={savingHours}
                  />
                </div>
                <Button
                  className="mt-3"
                  onClick={() => handleSaveHours(selected.id)}
                  disabled={!canSaveSchedule || savingHours}
                  aria-busy={savingHours}
                >
                  {savingHours ? "Saving…" : "Save working hours"}
                </Button>
              </div>
            </div>
          </PanelSection>
        )}

        {/* Hard-delete — SITE_OWNER only. Hidden for site owners themselves
          (the API blocks it too); they must demote first via the role. */}
        {isSiteOwner && selected.role !== "SITE_OWNER" && !selected.deletedAt && (
          <PanelSection title="Account actions">
            <p className="text-sm text-[var(--av2-text-2)]">
              Permanently anonymize this user and revoke their access. Cannot be undone.
            </p>
            <Button
              variant="danger"
              size="sm"
              className="mt-3"
              onClick={() =>
                setPendingDelete({
                  userId: selected.id,
                  targetEmail: selected.email,
                  targetRole: selected.role,
                })
              }
            >
              Delete user
            </Button>
          </PanelSection>
        )}
      </DetailPanel>
    </div>
  ) : null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <PageHeader title="Users" description="Find people and manage their platform roles." />

      <SplitView panel={panel}>
        <Card padding="none">
          <div className="px-6 pt-5">
            <FilterBar
              trailing={
                loaded && !error
                  ? `${fmt(users.length)} ${plural(users.length, "user", "users")}`
                  : null
              }
            >
              <SearchInput
                className="min-w-[200px] flex-1"
                value={search}
                onChange={setSearch}
                placeholder="Search name or email"
                label="Search users by name or email"
              />
              <div className="w-full sm:w-40">
                <Select
                  aria-label="Filter by role"
                  value={roleFilter}
                  onChange={(e) => {
                    const next = e.target.value;
                    void confirmFilterChange().then((ok) => ok && setRoleFilter(next));
                  }}
                >
                  <option value="">All roles</option>
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </Select>
              </div>
              <Switch
                checked={showDeleted}
                onChange={(v) => void confirmFilterChange().then((ok) => ok && setShowDeleted(v))}
                label="Show deleted"
              />
            </FilterBar>
          </div>

          {error ? (
            <div className="border-t border-[var(--av2-border)] px-6 py-5">
              <Callout tone="error" title="Couldn't load users">
                {error}
              </Callout>
            </div>
          ) : loading && !loaded ? (
            <div className="space-y-3 border-t border-[var(--av2-border)] px-6 py-5" role="status">
              <span className="sr-only">Loading users…</span>
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="border-t border-[var(--av2-border)]">
              {filtersActive ? (
                <EmptyState
                  title="No users match these filters"
                  description="Try a different name, email or role."
                  action={<Button onClick={() => void resetFilters()}>Clear filters</Button>}
                />
              ) : (
                <EmptyState
                  icon={<IconUsers width={28} height={28} />}
                  title="No users yet"
                  description="People appear here once they sign up or are invited."
                />
              )}
            </div>
          ) : (
            <div aria-busy={loading} className={loading ? "opacity-60 transition-opacity" : ""}>
              <Table label="Users">
                <thead>
                  <tr>
                    <Th>User</Th>
                    <Th>Role</Th>
                    <Th align="right" className="hidden sm:table-cell">
                      Companies
                    </Th>
                    <Th align="right" className="hidden md:table-cell">
                      Tickets
                    </Th>
                    <Th className="hidden md:table-cell">Joined</Th>
                    {!selected && (
                      <Th align="right">
                        <span className="sr-only">Open</span>
                      </Th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((u) => (
                    <Tr
                      key={u.id}
                      selected={u.id === selectedId}
                      onSelect={() => void selectUser(u.id)}
                      label={`${displayName(u)}, ${ROLE_LABELS[u.role] || u.role}`}
                    >
                      <Td>
                        <div
                          className={`flex items-center gap-3 ${u.deletedAt ? "opacity-60" : ""}`}
                        >
                          <Avatar name={displayName(u)} size={40} tone="neutral" />
                          <div className="min-w-0">
                            <div className="truncate font-semibold">{u.name || DASH}</div>
                            <div className="truncate text-xs text-[var(--av2-text-2)]">
                              {u.email}
                            </div>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge tone={ROLE_TONES[u.role] ?? "neutral"}>
                            {ROLE_LABELS[u.role] || u.role}
                          </Badge>
                          {u.role === "DESIGNER" && u.isPaused && (
                            <Badge tone="amber">Paused</Badge>
                          )}
                          {u.deletedAt && <Badge tone="red">Deleted</Badge>}
                        </div>
                      </Td>
                      <Td align="right" className="hidden sm:table-cell">
                        {fmt(u.companyCount)}
                      </Td>
                      <Td align="right" className="hidden md:table-cell">
                        {fmt(u.assignedTickets)}
                      </Td>
                      <Td className="hidden whitespace-nowrap text-[var(--av2-text-2)] md:table-cell">
                        {formatDate(u.createdAt)}
                      </Td>
                      {!selected && (
                        <Td align="right" className="text-[var(--av2-text-2)]">
                          <span className="inline-flex">
                            <IconChevronRight />
                          </span>
                        </Td>
                      )}
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}

          {loaded && !error && users.length > 0 && (
            <TableFooter>
              <span className="tabular-nums">
                {fmt(rangeStart)}–{fmt(rangeEnd)} of {fmt(users.length)}{" "}
                {plural(users.length, "user", "users")}
              </span>
              <Pager page={currentPage} pageCount={pageCount} onPage={setPage} />
              <div className="flex items-center gap-3">
                {filtersActive && (
                  <Button size="sm" variant="ghost" onClick={() => void resetFilters()}>
                    Clear filters
                  </Button>
                )}
                <div className="w-32">
                  <Select
                    aria-label="Rows per page"
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                  >
                    {PAGE_SIZES.map((n) => (
                      <option key={n} value={n}>
                        {n} per page
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </TableFooter>
          )}
        </Card>

        {!selected && loaded && !error && users.length > 0 && (
          <p className="mt-6 flex items-center gap-2 text-sm text-[var(--av2-text-2)]">
            <IconUsers width={18} height={18} className="shrink-0" />
            Select a user to view details and change their role.
          </p>
        )}
      </SplitView>

      {/* Typed-phrase confirmation for privilege-escalation role changes. */}
      <ConfirmTypedPhraseModal
        open={pendingPromote !== null}
        onClose={() => setPendingPromote(null)}
        title="Change admin role?"
        description={
          pendingPromote ? (
            <p>
              You are about to change <strong>{pendingPromote.targetEmail}</strong> from{" "}
              <strong>
                {ROLE_LABELS[pendingPromote.currentRole] || pendingPromote.currentRole}
              </strong>{" "}
              to <strong>{ROLE_LABELS[pendingPromote.newRole] || pendingPromote.newRole}</strong>.
              This grants or removes access to owner-only money-moving actions (withdrawal
              approvals, plan edits, token grants).
            </p>
          ) : null
        }
        requiredPhrase="PROMOTE"
        submitLabel="Change role"
        submitTone="danger"
        onSubmit={async () => {
          if (!pendingPromote) return;
          await handleRoleChange(pendingPromote.userId, pendingPromote.newRole, "PROMOTE");
          setPendingPromote(null);
        }}
      />

      {/* L4 MFA second factor for privilege-escalation role changes. */}
      <MfaChallengeModal
        open={pendingMfa !== null}
        challenge={pendingMfa?.challenge ?? null}
        onClose={() => setPendingMfa(null)}
        onVerified={async () => {
          if (!pendingMfa) return;
          const retry = pendingMfa.retry;
          setPendingMfa(null);
          await retry();
        }}
      />

      {/* Hard-delete confirmation. The MFA challenge (if required) is
          handled by the same shared MfaChallengeModal above — the delete
          handler stashes a retry there when the server returns 202. */}
      <ConfirmTypedPhraseModal
        open={pendingDelete !== null}
        onClose={() => {
          if (deleting) return;
          setPendingDelete(null);
        }}
        title="Delete user account?"
        description={
          pendingDelete ? (
            <div className="space-y-2">
              <p>
                You are about to permanently delete <strong>{pendingDelete.targetEmail}</strong> (
                {ROLE_LABELS[pendingDelete.targetRole] || pendingDelete.targetRole}).
              </p>
              <p>
                Their auth credentials are revoked, their identity is anonymized, and any tickets or
                audit rows they were attached to remain — labelled as a deleted account. This cannot
                be undone.
              </p>
            </div>
          ) : null
        }
        requiredPhrase="DELETE"
        submitLabel="Delete user"
        submitTone="danger"
        onSubmit={async () => {
          if (!pendingDelete) return;
          await handleDeleteUser(pendingDelete.userId, "DELETE");
          setPendingDelete(null);
        }}
      />
    </>
  );
}
