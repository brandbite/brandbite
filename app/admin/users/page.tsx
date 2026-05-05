// -----------------------------------------------------------------------------
// @file: app/admin/users/page.tsx
// @purpose: Admin user directory — view all users, filter by role, change roles
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/toast-provider";
import { InlineAlert } from "@/components/ui/inline-alert";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmTypedPhraseModal } from "@/components/admin/confirm-typed-phrase-modal";
import { MfaChallengeModal, type MfaChallengeInfo } from "@/components/admin/mfa-challenge-modal";
import { useSessionRole } from "@/lib/hooks/use-session-role";

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

const ROLE_COLORS: Record<string, string> = {
  SITE_OWNER: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  SITE_ADMIN: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  DESIGNER: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  CUSTOMER: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
};

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [roleFilter, setRoleFilter] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Role editing
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [pendingRole, setPendingRole] = useState("");
  const [saving, setSaving] = useState(false);
  const [togglingNotesId, setTogglingNotesId] = useState<string | null>(null);

  // PR11 — inline cap editor. Tracks the row currently being edited
  // and the in-progress draft (string so the input doesn't clamp on
  // every keystroke).
  const [editingCapId, setEditingCapId] = useState<string | null>(null);
  const [pendingCap, setPendingCap] = useState<string>("");
  const [savingCap, setSavingCap] = useState(false);

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

        const res = await fetch(`/api/admin/users?${params}`, { cache: "no-store" });
        const json = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(json?.error || "Failed to load users");
        }
        if (!cancelled) setUsers(json.users ?? []);
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
  }, [roleFilter, debouncedSearch]);

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
      setEditingUserId(null);
    } finally {
      setSaving(false);
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
      setEditingCapId(null);
      setPendingCap("");
    } catch {
      showToast({ title: "Failed to save cap", type: "error" });
    } finally {
      setSavingCap(false);
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
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--bb-secondary)]">Users</h1>
        <p className="mt-1 text-sm text-[var(--bb-text-secondary)]">
          Manage platform users and their roles.
        </p>
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)] px-3.5 py-2 text-sm text-[var(--bb-secondary)] outline-none placeholder:text-[var(--bb-text-muted)] focus:border-[var(--bb-primary)] focus:ring-1 focus:ring-[var(--bb-primary)] sm:max-w-xs"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)] px-3.5 py-2 text-sm text-[var(--bb-secondary)] outline-none focus:border-[var(--bb-primary)] focus:ring-1 focus:ring-[var(--bb-primary)]"
        >
          <option value="">All roles</option>
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <span className="text-xs text-[var(--bb-text-muted)]">
          {users.length} user{users.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Content */}
      {loading && <LoadingState message="Loading users..." />}
      {error && <InlineAlert variant="error">{error}</InlineAlert>}

      {!loading && !error && users.length === 0 && (
        <EmptyState title="No users found" description="Try adjusting your search or filter." />
      )}

      {!loading && !error && users.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--bb-border-subtle)] text-[11px] font-semibold tracking-wider text-[var(--bb-text-muted)] uppercase">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="hidden px-4 py-3 sm:table-cell">Companies</th>
                <th className="hidden px-4 py-3 md:table-cell">Tickets</th>
                <th className="hidden px-4 py-3 md:table-cell">Joined</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-[var(--bb-border-subtle)] last:border-b-0"
                >
                  {/* User info */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--bb-bg-page)] text-xs font-semibold text-[var(--bb-text-secondary)]">
                        {(u.name || u.email)[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--bb-secondary)]">
                          {u.name || "\u2014"}
                        </p>
                        <p className="truncate text-xs text-[var(--bb-text-muted)]">{u.email}</p>
                      </div>
                    </div>
                  </td>

                  {/* Role badge */}
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${ROLE_COLORS[u.role] || "bg-gray-100 text-gray-700"}`}
                    >
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                    {u.role === "DESIGNER" && u.isPaused && (
                      <span className="ml-1.5 text-[10px] text-[var(--bb-text-muted)]">
                        (paused)
                      </span>
                    )}
                  </td>

                  {/* Companies */}
                  <td className="hidden px-4 py-3 text-sm text-[var(--bb-text-secondary)] sm:table-cell">
                    {u.companyCount}
                  </td>

                  {/* Tickets */}
                  <td className="hidden px-4 py-3 text-sm text-[var(--bb-text-secondary)] md:table-cell">
                    {u.assignedTickets}
                  </td>

                  {/* Joined */}
                  <td className="hidden px-4 py-3 text-xs text-[var(--bb-text-muted)] md:table-cell">
                    {new Date(u.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1.5">
                      {editingUserId === u.id ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={pendingRole}
                            onChange={(e) => setPendingRole(e.target.value)}
                            disabled={saving}
                            className="rounded-lg border border-[var(--bb-border)] bg-[var(--bb-bg-card)] px-2 py-1 text-xs text-[var(--bb-secondary)] outline-none focus:border-[var(--bb-primary)]"
                          >
                            {ROLE_OPTIONS.map((r) => (
                              <option key={r.value} value={r.value}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => {
                              // Privilege-escalation changes require the
                              // typed-phrase confirmation. Everything else
                              // runs direct.
                              const isPrivilegeChange =
                                pendingRole === "SITE_OWNER" ||
                                pendingRole === "SITE_ADMIN" ||
                                u.role === "SITE_OWNER";
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
                            }}
                            disabled={saving || pendingRole === u.role}
                            className="rounded-lg bg-[var(--bb-primary)] px-2.5 py-1 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                          >
                            {saving ? "..." : "Save"}
                          </button>
                          <button
                            onClick={() => setEditingUserId(null)}
                            disabled={saving}
                            className="text-xs text-[var(--bb-text-muted)] hover:text-[var(--bb-secondary)]"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingUserId(u.id);
                            setPendingRole(u.role);
                          }}
                          className="rounded-lg border border-[var(--bb-border)] px-2.5 py-1 text-xs font-medium text-[var(--bb-text-secondary)] transition-colors hover:border-[var(--bb-primary)] hover:text-[var(--bb-primary)]"
                        >
                          Change role
                        </button>
                      )}
                      {u.role === "DESIGNER" && (
                        <button
                          onClick={() =>
                            handleToggleRevisionNotes(u.id, u.creativeRevisionNotesEnabled)
                          }
                          disabled={togglingNotesId === u.id}
                          className="flex items-center gap-1.5 text-[10px] text-[var(--bb-text-muted)] transition-colors hover:text-[var(--bb-secondary)] disabled:opacity-50"
                        >
                          <span
                            className={`inline-block h-3 w-5 rounded-full transition-colors ${
                              u.creativeRevisionNotesEnabled
                                ? "bg-[var(--bb-primary)]"
                                : "bg-[var(--bb-border)]"
                            }`}
                          >
                            <span
                              className={`block h-2.5 w-2.5 translate-y-[1px] rounded-full bg-white transition-transform ${
                                u.creativeRevisionNotesEnabled
                                  ? "translate-x-[9px]"
                                  : "translate-x-[1px]"
                              }`}
                            />
                          </span>
                          Revision notes
                        </button>
                      )}
                      {/* PR11 — inline tasks/week cap editor for DESIGNER rows.
                          Read-only label until clicked; expands into a small
                          number input + Save / Cancel. Auto-assign in
                          lib/tickets/create-ticket.ts skips this creative when
                          their open count >= cap. Empty input clears (no cap). */}
                      {u.role === "DESIGNER" && editingCapId === u.id ? (
                        <div className="flex items-center gap-1 text-[10px]">
                          <input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={40}
                            value={pendingCap}
                            onChange={(e) => setPendingCap(e.target.value)}
                            placeholder="—"
                            className="h-6 w-12 rounded border border-[var(--bb-border)] px-1 text-center text-xs"
                            aria-label="Tasks per week cap"
                          />
                          <button
                            onClick={() => handleSaveCap(u.id)}
                            disabled={savingCap}
                            className="rounded bg-[var(--bb-primary)] px-2 py-0.5 text-[10px] font-medium text-white disabled:opacity-50"
                          >
                            {savingCap ? "…" : "Save"}
                          </button>
                          <button
                            onClick={() => {
                              setEditingCapId(null);
                              setPendingCap("");
                            }}
                            disabled={savingCap}
                            className="text-[10px] text-[var(--bb-text-muted)] hover:text-[var(--bb-secondary)] disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : u.role === "DESIGNER" ? (
                        <button
                          onClick={() => {
                            setEditingCapId(u.id);
                            setPendingCap(
                              u.tasksPerWeekCap == null ? "" : String(u.tasksPerWeekCap),
                            );
                          }}
                          className="flex items-center gap-1 text-[10px] text-[var(--bb-text-muted)] transition-colors hover:text-[var(--bb-secondary)]"
                          title="Auto-assign skips this creative when their open ticket count reaches this cap. Empty = no cap."
                        >
                          <span>Cap:</span>
                          <span
                            className={`rounded border border-[var(--bb-border)] px-1.5 py-0.5 ${
                              u.tasksPerWeekCap == null ? "text-[var(--bb-text-muted)]" : ""
                            }`}
                          >
                            {u.tasksPerWeekCap == null ? "—" : u.tasksPerWeekCap}
                          </span>
                        </button>
                      ) : null}
                      {/* Hard-delete — SITE_OWNER only. Hidden for site
                          owners themselves (the API blocks it too); they
                          must demote first via Change role. */}
                      {isSiteOwner && u.role !== "SITE_OWNER" && (
                        <button
                          onClick={() =>
                            setPendingDelete({
                              userId: u.id,
                              targetEmail: u.email,
                              targetRole: u.role,
                            })
                          }
                          className="text-[10px] font-medium text-red-600 transition-colors hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                          title="Permanently anonymize this user and revoke their access. Cannot be undone."
                        >
                          Delete user
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
              <p className="text-[var(--bb-text-secondary)]">
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
    </div>
  );
}
