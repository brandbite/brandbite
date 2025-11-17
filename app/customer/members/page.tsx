// -----------------------------------------------------------------------------
// @file: app/customer/members/page.tsx
// @purpose: Customer-facing company members & roles overview + invite form + pending invites
// @version: v1.5.0
// @status: active
// @lastUpdate: 2025-11-17
// -----------------------------------------------------------------------------

"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { CompanyRole as CompanyRoleString } from "@/lib/permissions/companyRoles";

type CompanyMembersResponse = {
  company: {
    id: string;
    name: string;
    slug: string;
  };
  currentUserId: string;
  members: {
    id: string;
    userId: string;
    name: string | null;
    email: string;
    roleInCompany: CompanyRoleString;
    joinedAt: string;
  }[];
  pendingInvites: {
    id: string;
    email: string;
    roleInCompany: CompanyRoleString;
    status: "PENDING" | "ACCEPTED" | "EXPIRED" | "CANCELLED";
    createdAt: string;
    invitedByName: string | null;
    invitedByEmail: string | null;
  }[];
};

type ViewState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: CompanyMembersResponse };

export default function CustomerMembersPage() {
  const [state, setState] = useState<ViewState>({ status: "loading" });

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] =
    useState<CompanyRoleString>("MEMBER");
  const [inviteStatus, setInviteStatus] =
    useState<"idle" | "submitting">("idle");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  // Cancel invite state
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  // Member actions (role change / remove)
  const [memberActionError, setMemberActionError] =
    useState<string | null>(null);
  const [updatingMemberId, setUpdatingMemberId] =
    useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] =
    useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setState({ status: "loading" });

      try {
        const res = await fetch("/api/customer/members", {
          method: "GET",
          cache: "no-store",
        });

        const json = await res.json().catch(() => null);

        if (!res.ok) {
          const msg =
            json?.error || `Request failed with status ${res.status}`;
          if (!cancelled) {
            setState({ status: "error", message: msg });
          }
          return;
        }

        if (!cancelled) {
          setState({
            status: "ready",
            data: json as CompanyMembersResponse,
          });
        }
      } catch (error: any) {
        console.error("Customer members fetch error:", error);
        if (!cancelled) {
          setState({
            status: "error",
            message:
              "Unexpected error while loading company members",
          });
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Derived data + sorting
  // ---------------------------------------------------------------------------

  const data = state.status === "ready" ? state.data : null;
  const company = data?.company ?? null;
  const members = data?.members ?? [];
  const pendingInvites = data?.pendingInvites ?? [];
  const currentUserId = data?.currentUserId ?? "";

  const currentMember = useMemo(
    () =>
      members.find((m) => m.userId === currentUserId) ?? null,
    [members, currentUserId],
  );
  const currentUserRole = currentMember?.roleInCompany ?? null;

  const canManageMembersUI =
    currentUserRole === "OWNER" || currentUserRole === "PM";

  const sortedMembers = useMemo(() => {
    if (!members.length) return [];
    return [...members].sort((a, b) => {
      const order =
        roleWeight(b.roleInCompany) - roleWeight(a.roleInCompany);
      if (order !== 0) return order;
      return a.joinedAt.localeCompare(b.joinedAt);
    });
  }, [members]);

  const sortedInvites = useMemo(() => {
    if (!pendingInvites.length) return [];
    return [...pendingInvites].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
  }, [pendingInvites]);

  // ---------------------------------------------------------------------------
  // Invite form handler
  // ---------------------------------------------------------------------------

  const handleInviteSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    setInviteSuccess(null);
    setCancelError(null);
    setMemberActionError(null);

    const email = inviteEmail.trim();
    if (!email) {
      setInviteError("Please enter an email address.");
      return;
    }

    setInviteStatus("submitting");

    try {
      const res = await fetch("/api/customer/members/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          roleInCompany: inviteRole,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const msg =
          json?.error || `Request failed with status ${res.status}`;
        setInviteError(msg);
        return;
      }

      setInviteSuccess(
        "Invitation created. In a future step, this will be used to onboard the member.",
      );
      setInviteEmail("");
      setInviteRole("MEMBER");

      // Refresh members + invites after successful invite
      await refreshMembers();
    } catch (error) {
      console.error("Invite submit error:", error);
      setInviteError(
        "Unexpected error while creating the invitation.",
      );
    } finally {
      setInviteStatus("idle");
    }
  };

  // ---------------------------------------------------------------------------
  // Cancel invite handler
  // ---------------------------------------------------------------------------

  const handleCancelInvite = async (inviteId: string) => {
    setCancelError(null);
    setMemberActionError(null);
    setCancelingId(inviteId);

    try {
      const res = await fetch(
        `/api/customer/members/invite/${inviteId}`,
        {
          method: "DELETE",
        },
      );

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const msg =
          json?.error || `Request failed with status ${res.status}`;
        setCancelError(msg);
        return;
      }

      // Refresh after cancelling
      await refreshMembers();
    } catch (error) {
      console.error("Cancel invite error:", error);
      setCancelError(
        "Unexpected error while cancelling the invite.",
      );
    } finally {
      setCancelingId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Member role change handler
  // ---------------------------------------------------------------------------

  const handleMemberRoleChange = async (
    memberId: string,
    newRole: CompanyRoleString,
  ) => {
    setMemberActionError(null);
    setUpdatingMemberId(memberId);

    try {
      const res = await fetch(
        `/api/customer/members/${memberId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ roleInCompany: newRole }),
        },
      );

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const msg =
          json?.error || `Request failed with status ${res.status}`;
        setMemberActionError(msg);
        return;
      }

      await refreshMembers();
    } catch (error) {
      console.error("Member role update error:", error);
      setMemberActionError(
        "Unexpected error while updating the member role.",
      );
    } finally {
      setUpdatingMemberId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Member removal handler
  // ---------------------------------------------------------------------------

  const handleRemoveMember = async (memberId: string) => {
    setMemberActionError(null);
    setRemovingMemberId(memberId);

    try {
      const res = await fetch(
        `/api/customer/members/${memberId}`,
        {
          method: "DELETE",
        },
      );

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const msg =
          json?.error || `Request failed with status ${res.status}`;
        setMemberActionError(msg);
        return;
      }

      await refreshMembers();
    } catch (error) {
      console.error("Member removal error:", error);
      setMemberActionError(
        "Unexpected error while removing the member.",
      );
    } finally {
      setRemovingMemberId(null);
    }
  };

  // Helper to refresh members & invites without breaking hooks
  const refreshMembers = async () => {
    try {
      const res = await fetch("/api/customer/members", {
        method: "GET",
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          json?.error || `Request failed with status ${res.status}`;
        setState({ status: "error", message: msg });
        return;
      }
      setState({
        status: "ready",
        data: json as CompanyMembersResponse,
      });
    } catch (error) {
      console.error("Refresh members error:", error);
      setState({
        status: "error",
        message:
          "Unexpected error while refreshing company members",
      });
    }
  };

  // Skeleton early return (HOOK'lardan sonra)
  if (state.status === "loading") {
    return <CustomerMembersSkeleton />;
  }

  const error = state.status === "error" ? state.message : null;
  const isPermissionError =
    !!error &&
    error
      .toLowerCase()
      .includes("only company owners or project managers");

  return (
    <div className="min-h-screen bg-[#f5f3f0] text-[#424143]">
      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* Top navigation (Brandbite style) */}
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f15b2b] text-sm font-semibold text-white">
              B
            </div>
            <span className="text-lg font-semibold tracking-tight">
              Brandbite
            </span>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-[#7a7a7a] md:flex">
            <button
              className="font-medium text-[#7a7a7a]"
              onClick={() =>
                (window.location.href = "/customer/tokens")
              }
            >
              Tokens
            </button>
            <button
              className="font-medium text-[#7a7a7a]"
              onClick={() =>
                (window.location.href = "/customer/tickets")
              }
            >
              Tickets
            </button>
            <button
              className="font-medium text-[#7a7a7a]"
              onClick={() =>
                (window.location.href = "/customer/board")
              }
            >
              Board
            </button>
            <button
              className="font-semibold text-[#424143]"
              onClick={() =>
                (window.location.href = "/customer/members")
              }
            >
              Members
            </button>
          </nav>
        </header>

        {/* Page header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Company members
            </h1>
            <p className="mt-1 text-sm text-[#7a7a7a]">
              See who is part of your Brandbite workspace and what they
              can do.
            </p>
            {company && (
              <p className="mt-1 text-xs text-[#9a9892]">
                Company:{" "}
                <span className="font-medium text-[#424143]">
                  {company.name}
                </span>{" "}
                ({company.slug})
              </p>
            )}
            {currentUserRole && (
              <p className="mt-1 text-xs text-[#9a9892]">
                You are browsing as{" "}
                <span className="font-medium text-[#424143]">
                  {formatCompanyRole(currentUserRole)}
                </span>
                .
              </p>
            )}
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm text-red-700">
            <p className="font-medium">
              {isPermissionError
                ? "You don’t have access to manage members"
                : "Error"}
            </p>
            <p className="mt-1">{error}</p>
            {isPermissionError && (
              <p className="mt-2 text-xs text-[#7a7a7a]">
                Only company owners and project managers can view and
                manage the members list and invites for this workspace.
              </p>
            )}
          </div>
        )}

        {/* Member action errors */}
        {memberActionError && !error && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-[#fffaf2] px-4 py-3 text-xs text-amber-800">
            {memberActionError}
          </div>
        )}

        {/* Invite + lists only if we have data (no error) */}
        {!error && (
          <>
            {/* Invite form */}
            <section className="mt-4 rounded-2xl border border-[#ece5d8] bg-white px-4 py-4 shadow-sm">
              <h2 className="text-sm font-semibold text-[#424143]">
                Invite a new member
              </h2>
              <p className="mt-1 text-xs text-[#7a7a7a]">
                Send an invite to someone on your team. They will join
                with the selected role once they accept the invitation.
              </p>

              {inviteError && (
                <div className="mt-3 rounded-lg border border-red-200 bg-[#fff7f7] px-3 py-2 text-xs text-red-700">
                  {inviteError}
                </div>
              )}

              {inviteSuccess && (
                <div className="mt-3 rounded-lg border border-emerald-200 bg-[#f0fbf4] px-3 py-2 text-xs text-emerald-700">
                  {inviteSuccess}
                </div>
              )}

              {cancelError && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-[#fffaf2] px-3 py-2 text-xs text-amber-800">
                  {cancelError}
                </div>
              )}

              <form
                onSubmit={handleInviteSubmit}
                className="mt-3 flex flex-col gap-3 md:flex-row md:items-end"
              >
                <div className="flex-1">
                  <label className="text-[11px] font-medium text-[#7a7a7a]">
                    Email
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) =>
                      setInviteEmail(e.target.value)
                    }
                    className="mt-1 w-full rounded-lg border border-[#d5cec0] bg-[#fdfaf5] px-3 py-2 text-sm text-[#424143] outline-none focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]/40"
                    placeholder="designer@yourcompany.com"
                    required
                  />
                </div>

                <div className="w-full md:w-44">
                  <label className="text-[11px] font-medium text-[#7a7a7a]">
                    Role
                  </label>
                  <select
                    className="mt-1 w-full rounded-lg border border-[#d5cec0] bg-[#fdfaf5] px-3 py-2 text-sm text-[#424143] outline-none focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]/40"
                    value={inviteRole}
                    onChange={(e) =>
                      setInviteRole(
                        e.target.value as CompanyRoleString,
                      )
                    }
                  >
                    <option value="MEMBER">Member</option>
                    <option value="PM">Project manager</option>
                    <option value="BILLING">Billing</option>
                  </select>
                </div>

                <div className="flex w-full md:w-auto">
                  <button
                    type="submit"
                    disabled={inviteStatus === "submitting"}
                    className="mt-2 w-full rounded-lg bg-[#f15b2b] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#e44f20] disabled:opacity-70 md:mt-[22px]"
                  >
                    {inviteStatus === "submitting"
                      ? "Sending…"
                      : "Send invite"}
                  </button>
                </div>
              </form>
            </section>

            {/* Pending invites */}
            <section className="mt-6">
              <h2 className="mb-2 text-sm font-semibold text-[#424143]">
                Pending invites
              </h2>
              <p className="mb-3 text-xs text-[#7a7a7a]">
                These people have been invited but have not joined yet.
              </p>

              {sortedInvites.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#d5cec0] bg-white/60 px-4 py-4 text-xs text-[#7a7a7a]">
                  No pending invites. When you invite someone, they will
                  appear here until they join.
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {sortedInvites.map((invite) => {
                    const isCanceling = cancelingId === invite.id;
                    return (
                      <article
                        key={invite.id}
                        className="flex items-center justify-between rounded-2xl border border-[#ece5d8] bg-white px-4 py-3 text-sm shadow-sm"
                      >
                        <div>
                          <p className="font-semibold text-[#424143]">
                            {invite.email}
                          </p>
                          <p className="text-[11px] text-[#7a7a7a]">
                            {formatCompanyRole(
                              invite.roleInCompany,
                            )}{" "}
                            • invited{" "}
                            {new Date(
                              invite.createdAt,
                            ).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </p>
                          {invite.invitedByEmail && (
                            <p className="mt-1 text-[11px] text-[#9a9892]">
                              Invited by{" "}
                              {invite.invitedByName ||
                                invite.invitedByEmail}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={isCanceling}
                          onClick={() =>
                            handleCancelInvite(invite.id)
                          }
                          className="rounded-full border border-[#f5d1c4] px-3 py-1 text-[11px] font-medium text-[#c5431a] hover:bg-[#fff4f0] disabled:opacity-60"
                        >
                          {isCanceling ? "Cancelling…" : "Cancel"}
                        </button>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Members list */}
            <section className="mt-8 grid gap-4 md:grid-cols-2">
              {sortedMembers.map((member) => {
                const isYou = member.userId === currentUserId;
                const isTargetOwner =
                  member.roleInCompany === "OWNER";
                const isActorOwner = currentUserRole === "OWNER";

                const canEditThisMember =
                  canManageMembersUI &&
                  (!isTargetOwner || isActorOwner);
                const canRemoveThisMember = canEditThisMember;

                const isUpdating = updatingMemberId === member.id;
                const isRemoving = removingMemberId === member.id;

                return (
                  <article
                    key={member.id}
                    className="flex flex-col rounded-2xl border border-[#ece5d8] bg-white px-4 py-3 shadow-sm"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f15b2b]/10 text-sm font-semibold text-[#f15b2b]">
                          {initialsForName(
                            member.name ?? member.email,
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#424143]">
                            {member.name || "Unnamed member"}
                            {isYou && (
                              <span className="ml-1 text-[11px] font-medium text-[#f15b2b]">
                                (You)
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-[#7a7a7a]">
                            {member.email}
                          </p>
                        </div>
                      </div>

                      {canEditThisMember ? (
                        <select
                          className="rounded-full border border-[#e1d9cc] bg-[#f5f3f0] px-2 py-0.5 text-[11px] font-medium text-[#424143] outline-none focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]/40"
                          value={member.roleInCompany}
                          disabled={isUpdating || isRemoving}
                          onChange={(e) =>
                            handleMemberRoleChange(
                              member.id,
                              e.target.value as CompanyRoleString,
                            )
                          }
                        >
                          <option value="OWNER">Owner</option>
                          <option value="PM">Project manager</option>
                          <option value="MEMBER">Member</option>
                          <option value="BILLING">Billing</option>
                        </select>
                      ) : (
                        <span className="rounded-full bg-[#f5f3f0] px-2 py-0.5 text-[11px] font-medium text-[#7a7a7a]">
                          {formatCompanyRole(member.roleInCompany)}
                        </span>
                      )}
                    </div>

                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p className="text-xs text-[#9a9892]">
                        Joined{" "}
                        {new Date(
                          member.joinedAt,
                        ).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>

                      {canRemoveThisMember && !isYou && (
                        <button
                          type="button"
                          disabled={isRemoving || isUpdating}
                          onClick={() =>
                            handleRemoveMember(member.id)
                          }
                          className="text-[11px] font-medium text-[#c5431a] hover:text-[#a83a16]"
                        >
                          {isRemoving ? "Removing…" : "Remove"}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}

              {sortedMembers.length === 0 && !error && (
                <div className="rounded-2xl border border-dashed border-[#d5cec0] bg:white/60 px-4 py-6 text-sm text-[#7a7a7a]">
                  No members found for this company yet.
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function CustomerMembersSkeleton() {
  return (
    <div className="min-h-screen bg-[#f5f3f0] text-[#424143]">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-[#e3ded4]" />
            <div className="h-4 w-24 rounded bg-[#e3ded4]" />
          </div>
          <div className="hidden gap-4 md:flex">
            <div className="h-4 w-16 rounded bg-[#e3ded4]" />
            <div className="h-4 w-16 rounded bg-[#e3ded4]" />
            <div className="h-4 w-16 rounded bg-[#e3ded4]" />
            <div className="h-4 w-20 rounded bg-[#e3ded4]" />
          </div>
        </div>

        <div className="mb-4 h-5 w-40 rounded bg-[#e3ded4]" />
        <div className="mb-2 h-3 w-72 rounded bg-[#e3ded4]" />
        <div className="h-3 w-48 rounded bg-[#e3ded4]" />

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-[#ece5d8] bg-white px-4 py-3"
            >
              <div className="mb-3 flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-[#f5f3f0]" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-32 rounded bg-[#f5f3f0]" />
                  <div className="h-3 w-40 rounded bg-[#f5f3f0]" />
                </div>
                <div className="h-5 w-16 rounded-full bg-[#f5f3f0]" />
              </div>
              <div className="h-3 w-28 rounded bg-[#f5f3f0]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function roleWeight(role: CompanyRoleString): number {
  switch (role) {
    case "OWNER":
      return 4;
    case "PM":
      return 3;
    case "BILLING":
      return 2;
    case "MEMBER":
    default:
      return 1;
  }
}

function formatCompanyRole(role: CompanyRoleString): string {
  switch (role) {
    case "OWNER":
      return "Owner";
    case "PM":
      return "Project manager";
    case "BILLING":
      return "Billing";
    case "MEMBER":
      return "Member";
    default:
      return role;
  }
}

function initialsForName(nameOrEmail: string): string {
  const namePart = nameOrEmail.split("@")[0];
  const parts = namePart.trim().split(/\s+/);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
