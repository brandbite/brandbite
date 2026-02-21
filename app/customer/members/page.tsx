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
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import { useToast } from "@/components/ui/toast-provider";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormInput, FormSelect } from "@/components/ui/form-field";

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
  const { showToast } = useToast();
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

  // Confirmation dialog state
  const [inviteToCancel, setInviteToCancel] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<{
    id: string;
    name: string;
  } | null>(null);

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
        showToast({ type: "error", title: msg });
        return;
      }

      setInviteSuccess("Invitation sent successfully.");
      showToast({ type: "success", title: "Invitation sent successfully." });
      setInviteEmail("");
      setInviteRole("MEMBER");

      // Refresh members + invites after successful invite
      await refreshMembers();
    } catch (error) {
      console.error("Invite submit error:", error);
      const errMsg = "Unexpected error while creating the invitation.";
      setInviteError(errMsg);
      showToast({ type: "error", title: errMsg });
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
        showToast({ type: "error", title: msg });
        return;
      }

      showToast({ type: "success", title: "Invite cancelled." });
      // Refresh after cancelling
      await refreshMembers();
    } catch (error) {
      console.error("Cancel invite error:", error);
      const errMsg = "Unexpected error while cancelling the invite.";
      setCancelError(errMsg);
      showToast({ type: "error", title: errMsg });
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
        showToast({ type: "error", title: msg });
        return;
      }

      showToast({ type: "success", title: "Member role updated." });
      await refreshMembers();
    } catch (error) {
      console.error("Member role update error:", error);
      const errMsg = "Unexpected error while updating the member role.";
      setMemberActionError(errMsg);
      showToast({ type: "error", title: errMsg });
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
        showToast({ type: "error", title: msg });
        return;
      }

      showToast({ type: "success", title: "Member removed." });
      await refreshMembers();
    } catch (error) {
      console.error("Member removal error:", error);
      const errMsg = "Unexpected error while removing the member.";
      setMemberActionError(errMsg);
      showToast({ type: "error", title: errMsg });
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
    <>
      {/* Page header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Company members
            </h1>
            <p className="mt-1 text-sm text-[var(--bb-text-secondary)]">
              See who is part of your Brandbite workspace and what they
              can do.
            </p>
            {company && (
              <p className="mt-1 text-xs text-[var(--bb-text-tertiary)]">
                Company:{" "}
                <span className="font-medium text-[var(--bb-secondary)]">
                  {company.name}
                </span>{" "}
                ({company.slug})
              </p>
            )}
            {currentUserRole && (
              <p className="mt-1 text-xs text-[var(--bb-text-tertiary)]">
                You are browsing as{" "}
                <span className="font-medium text-[var(--bb-secondary)]">
                  {formatCompanyRole(currentUserRole)}
                </span>
                .
              </p>
            )}
          </div>
        </div>

        {/* Error state */}
        {error && (
          <InlineAlert
            variant="error"
            title={isPermissionError ? "You don't have access to manage members" : "Error"}
            className="mb-4"
          >
            <p>{error}</p>
            {isPermissionError && (
              <p className="mt-2 text-xs text-[var(--bb-text-secondary)]">
                Only company owners and project managers can view and
                manage the members list and invites for this workspace.
              </p>
            )}
          </InlineAlert>
        )}

        {/* Member action errors */}
        {memberActionError && !error && (
          <InlineAlert variant="warning" className="mb-4">
            {memberActionError}
          </InlineAlert>
        )}

        {/* Invite + lists only if we have data (no error) */}
        {!error && (
          <>
            {/* Invite form */}
            <section className="mt-4 rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-4 py-4 shadow-sm">
              <h2 className="text-sm font-semibold text-[var(--bb-secondary)]">
                Invite a new member
              </h2>
              <p className="mt-1 text-xs text-[var(--bb-text-secondary)]">
                Send an invite to someone on your team. They will join
                with the selected role once they accept the invitation.
              </p>

              {inviteError && (
                <InlineAlert variant="error" size="sm" className="mt-3">
                  {inviteError}
                </InlineAlert>
              )}

              {inviteSuccess && (
                <InlineAlert variant="success" size="sm" className="mt-3">
                  {inviteSuccess}
                </InlineAlert>
              )}

              {cancelError && (
                <InlineAlert variant="warning" size="sm" className="mt-3">
                  {cancelError}
                </InlineAlert>
              )}

              <form
                onSubmit={handleInviteSubmit}
                className="mt-3 flex flex-col gap-3 md:flex-row md:items-end"
              >
                <div className="flex-1">
                  <label className="text-[11px] font-medium text-[var(--bb-text-secondary)]">
                    Email
                  </label>
                  <FormInput
                    type="email"
                    value={inviteEmail}
                    onChange={(e) =>
                      setInviteEmail(e.target.value)
                    }
                    className="mt-1"
                    placeholder="creative@yourcompany.com"
                    required
                  />
                </div>

                <div className="w-full md:w-44">
                  <label className="text-[11px] font-medium text-[var(--bb-text-secondary)]">
                    Role
                  </label>
                  <FormSelect
                    className="mt-1"
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
                  </FormSelect>
                </div>

                <div className="flex w-full md:w-auto">
                  <Button
                    type="submit"
                    loading={inviteStatus === "submitting"}
                    loadingText="Sending…"
                    className="mt-2 w-full md:mt-[22px]"
                  >
                    Send invite
                  </Button>
                </div>
              </form>
            </section>

            {/* Pending invites */}
            <section className="mt-6">
              <h2 className="mb-2 text-sm font-semibold text-[var(--bb-secondary)]">
                Pending invites
              </h2>
              <p className="mb-3 text-xs text-[var(--bb-text-secondary)]">
                These people have been invited but have not joined yet.
              </p>

              {sortedInvites.length === 0 ? (
                <EmptyState
                  title="No pending invites."
                  description="When you invite someone, they will appear here until they join."
                />
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {sortedInvites.map((invite) => {
                    const isCanceling = cancelingId === invite.id;
                    return (
                      <article
                        key={invite.id}
                        className="flex items-center justify-between rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-4 py-3 text-sm shadow-sm"
                      >
                        <div>
                          <p className="font-semibold text-[var(--bb-secondary)]">
                            {invite.email}
                          </p>
                          <p className="text-[11px] text-[var(--bb-text-secondary)]">
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
                            <p className="mt-1 text-[11px] text-[var(--bb-text-tertiary)]">
                              Invited by{" "}
                              {invite.invitedByName ||
                                invite.invitedByEmail}
                            </p>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          loading={isCanceling}
                          loadingText="Cancelling…"
                          onClick={() =>
                            setInviteToCancel(invite.id)
                          }
                        >
                          Cancel
                        </Button>
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
                    className="flex flex-col rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-4 py-3 shadow-sm"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--bb-primary)]/10 text-sm font-semibold text-[var(--bb-primary)]">
                          {initialsForName(
                            member.name ?? member.email,
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[var(--bb-secondary)]">
                            {member.name || "Unnamed member"}
                            {isYou && (
                              <span className="ml-1 text-[11px] font-medium text-[var(--bb-primary)]">
                                (You)
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-[var(--bb-text-secondary)]">
                            {member.email}
                          </p>
                        </div>
                      </div>

                      {canEditThisMember ? (
                        <select
                          className="rounded-full border border-[var(--bb-border)] bg-[var(--bb-bg-card)] px-2 py-0.5 text-[11px] font-medium text-[var(--bb-secondary)] outline-none focus:border-[var(--bb-primary)] focus:ring-1 focus:ring-[var(--bb-primary)]/40"
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
                        <span className="rounded-full bg-[var(--bb-bg-card)] px-2 py-0.5 text-[11px] font-medium text-[var(--bb-text-secondary)]">
                          {formatCompanyRole(member.roleInCompany)}
                        </span>
                      )}
                    </div>

                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p className="text-xs text-[var(--bb-text-tertiary)]">
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
                            setMemberToRemove({
                              id: member.id,
                              name: member.name || member.email,
                            })
                          }
                          className="text-[11px] font-medium text-[var(--bb-danger-text)] hover:text-[var(--bb-danger-text)]"
                        >
                          {isRemoving ? "Removing…" : "Remove"}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}

              {sortedMembers.length === 0 && !error && (
                <EmptyState title="No members found for this company yet." />
              )}
            </section>
          </>
        )}

      {/* Cancel invite confirmation */}
      <ConfirmDialog
        open={inviteToCancel !== null}
        onClose={() => setInviteToCancel(null)}
        onConfirm={async () => {
          if (!inviteToCancel) return;
          await handleCancelInvite(inviteToCancel);
          setInviteToCancel(null);
        }}
        title="Cancel invite"
        description="This invite will be cancelled. You can always send a new one."
        confirmLabel="Cancel invite"
        variant="warning"
        loading={cancelingId === inviteToCancel}
      />

      {/* Remove member confirmation */}
      <ConfirmDialog
        open={memberToRemove !== null}
        onClose={() => setMemberToRemove(null)}
        onConfirm={async () => {
          if (!memberToRemove) return;
          await handleRemoveMember(memberToRemove.id);
          setMemberToRemove(null);
        }}
        title="Remove member"
        description={
          memberToRemove
            ? `${memberToRemove.name} will lose access to this workspace. This can't be undone.`
            : ""
        }
        confirmLabel="Remove"
        loading={removingMemberId === memberToRemove?.id}
      />
    </>
  );
}

function CustomerMembersSkeleton() {
  return (
    <>
      <div className="mb-4 h-5 w-40 rounded bg-[var(--bb-border)]" />
      <div className="mb-2 h-3 w-72 rounded bg-[var(--bb-border)]" />
      <div className="h-3 w-48 rounded bg-[var(--bb-border)]" />

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div
            key={idx}
            className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-4 py-3"
          >
            <div className="mb-3 flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-[var(--bb-bg-card)]" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 rounded bg-[var(--bb-bg-card)]" />
                <div className="h-3 w-40 rounded bg-[var(--bb-bg-card)]" />
              </div>
              <div className="h-5 w-16 rounded-full bg-[var(--bb-bg-card)]" />
            </div>
            <div className="h-3 w-28 rounded bg-[var(--bb-bg-card)]" />
          </div>
        ))}
      </div>
    </>
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
