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
import { AppNav } from "@/components/navigation/app-nav";

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

  // Change role
  const handleRoleChange = async (userId: string, newRole: string) => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        showToast({ title: json?.error || "Failed to update role", type: "error" });
        return;
      }

      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
      showToast({ title: `Role updated to ${ROLE_LABELS[newRole] || newRole}`, type: "success" });
      setEditingUserId(null);
    } catch {
      showToast({ title: "Failed to update role", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <AppNav role="admin" />

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
                          onClick={() => handleRoleChange(u.id, pendingRole)}
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
