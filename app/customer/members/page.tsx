// -----------------------------------------------------------------------------
// @file: app/customer/members/page.tsx
// @purpose: Customer-facing company members & roles: invite form, member list with
//           a selected-member role panel, and pending invites.
// -----------------------------------------------------------------------------

"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { useUnsavedChanges } from "@/components/admin/v2/unsaved-changes";
import { IconUsers } from "@/components/admin/v2/icons";
import {
  Avatar,
  Badge,
  Button,
  Callout,
  Card,
  DetailPanel,
  EmptyState,
  Field,
  IconTile,
  PageHeader,
  PanelSection,
  SearchInput,
  Select,
  Skeleton,
  SplitView,
  Table,
  TableFooter,
  Tabs,
  TabPanel,
  Td,
  TextInput,
  Th,
  Tr,
} from "@/components/admin/v2/ui";
import { ListPager } from "@/components/dashboard/account/account-ui";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast-provider";
import type { CompanyRole as CompanyRoleString } from "@/lib/permissions/companyRoles";

type CompanyMembersResponse = {
  company: {
    id: string;
    name: string;
    slug: string;
  };
  currentUserId: string;
  members: Member[];
  pendingInvites: {
    id: string;
    email: string;
    roleInCompany: CompanyRoleString;
    status: "PENDING" | "ACCEPTED" | "EXPIRED" | "CANCELLED";
    createdAt: string;
    expiresAt: string | null;
    expired: boolean;
    invitedByName: string | null;
    invitedByEmail: string | null;
  }[];
};

type Member = {
  id: string;
  userId: string;
  name: string | null;
  email: string;
  roleInCompany: CompanyRoleString;
  joinedAt: string;
};

type ViewState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: CompanyMembersResponse };

type MembersTab = "members" | "invites";

const PAGE_SIZE = 10;
const ALL_ROLES = "ALL";
const TAB_PREFIX = "members";

/** What each role can do, from lib/permissions/companyRoles. */
const ROLE_DESCRIPTIONS: Record<CompanyRoleString, string> = {
  OWNER:
    "Full access: members and invites, the company profile, projects, tags, requests, and the plan and billing.",
  PM: "Manages members and invites, the company profile, projects and tags, and creates and edits requests. Can't manage the plan or billing.",
  BILLING:
    "Manages the plan, billing and token top-ups. Can see requests but can't create, edit or move them.",
  MEMBER:
    "Creates and edits requests and moves them on the board. Can't manage members, the company profile or billing.",
};

export default function CustomerMembersPage() {
  const { showToast } = useToast();
  const [state, setState] = useState<ViewState>({ status: "loading" });

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<CompanyRoleString>("MEMBER");
  const [inviteStatus, setInviteStatus] = useState<"idle" | "submitting">("idle");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  // Cancel invite state
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  // Member actions (role change / remove)
  const [memberActionError, setMemberActionError] = useState<string | null>(null);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  // Confirmation dialog state
  const [inviteToCancel, setInviteToCancel] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // List state
  const [tab, setTab] = useState<MembersTab>("members");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>(ALL_ROLES);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftRole, setDraftRole] = useState<CompanyRoleString | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

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
          const msg = json?.error || `Request failed with status ${res.status}`;
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
            message: "Unexpected error while loading company members",
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
  const members = useMemo(() => data?.members ?? [], [data]);
  const pendingInvites = useMemo(() => data?.pendingInvites ?? [], [data]);
  const currentUserId = data?.currentUserId ?? "";

  const currentMember = useMemo(
    () => members.find((m) => m.userId === currentUserId) ?? null,
    [members, currentUserId],
  );
  const currentUserRole = currentMember?.roleInCompany ?? null;
  const isActorOwner = currentUserRole === "OWNER";
  const canManageMembersUI = isActorOwner || currentUserRole === "PM";

  const sortedMembers = useMemo(() => {
    if (!members.length) return [];
    return [...members].sort((a, b) => {
      const order = roleWeight(b.roleInCompany) - roleWeight(a.roleInCompany);
      if (order !== 0) return order;
      return a.joinedAt.localeCompare(b.joinedAt);
    });
  }, [members]);

  const sortedInvites = useMemo(() => {
    if (!pendingInvites.length) return [];
    return [...pendingInvites].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [pendingInvites]);

  const filteredMembers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sortedMembers.filter((m) => {
      if (roleFilter !== ALL_ROLES && m.roleInCompany !== roleFilter) return false;
      if (!q) return true;
      return m.email.toLowerCase().includes(q) || (m.name ?? "").toLowerCase().includes(q);
    });
  }, [sortedMembers, query, roleFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredMembers.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const visibleMembers = filteredMembers.slice(pageStart, pageStart + PAGE_SIZE);

  const selected = members.find((m) => m.id === selectedId) ?? null;
  const selectedIsYou = selected?.userId === currentUserId;
  const canEditSelected =
    !!selected && canManageMembersUI && (selected.roleInCompany !== "OWNER" || isActorOwner);
  const roleValue = draftRole ?? selected?.roleInCompany ?? "MEMBER";
  const roleDirty = !!selected && draftRole !== null && draftRole !== selected.roleInCompany;
  const selectionFiltered = !!selected && !filteredMembers.some((m) => m.id === selected.id);
  const filtering = query.trim() !== "" || roleFilter !== ALL_ROLES;

  const confirmDiscard = useUnsavedChanges(roleDirty, "Member role");

  // A filter change always starts again from the first page.
  useEffect(() => setPage(1), [query, roleFilter]);

  const selectMember = async (id: string) => {
    if (id === selectedId) return;
    if (!(await confirmDiscard())) return;
    setSelectedId(id);
    setDraftRole(null);
    setMemberActionError(null);
    // The panel stacks under the list on small screens.
    requestAnimationFrame(() => panelRef.current?.scrollIntoView?.({ block: "nearest" }));
  };

  const closePanel = async () => {
    if (!(await confirmDiscard())) return;
    setSelectedId(null);
    setDraftRole(null);
  };

  const switchTab = async (next: MembersTab) => {
    if (next === tab) return;
    // The role panel lives on the members tab.
    if (!(await confirmDiscard())) return;
    setDraftRole(null);
    setTab(next);
  };

  const clearFilters = () => {
    setQuery("");
    setRoleFilter(ALL_ROLES);
  };

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
        const msg = json?.error || `Request failed with status ${res.status}`;
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
      const res = await fetch(`/api/customer/members/invite/${inviteId}`, {
        method: "DELETE",
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = json?.error || `Request failed with status ${res.status}`;
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

  const handleMemberRoleChange = async (memberId: string, newRole: CompanyRoleString) => {
    setMemberActionError(null);
    setUpdatingMemberId(memberId);

    try {
      const res = await fetch(`/api/customer/members/${memberId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ roleInCompany: newRole }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = json?.error || `Request failed with status ${res.status}`;
        setMemberActionError(msg);
        showToast({ type: "error", title: msg });
        return;
      }

      showToast({ type: "success", title: "Member role updated." });
      setDraftRole(null);
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
      const res = await fetch(`/api/customer/members/${memberId}`, {
        method: "DELETE",
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = json?.error || `Request failed with status ${res.status}`;
        setMemberActionError(msg);
        showToast({ type: "error", title: msg });
        return;
      }

      showToast({ type: "success", title: "Member removed." });
      if (selectedId === memberId) {
        setSelectedId(null);
        setDraftRole(null);
      }
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
        const msg = json?.error || `Request failed with status ${res.status}`;
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
        message: "Unexpected error while refreshing company members",
      });
    }
  };

  const error = state.status === "error" ? state.message : null;
  const isPermissionError =
    !!error && error.toLowerCase().includes("only company owners or project managers");

  const isUpdating = !!selected && updatingMemberId === selected.id;
  const isRemoving = !!selected && removingMemberId === selected.id;

  // PMs can't grant OWNER (the API refuses it too), so don't offer it.
  const roleOptions: CompanyRoleString[] = isActorOwner
    ? ["OWNER", "PM", "MEMBER", "BILLING"]
    : ["PM", "MEMBER", "BILLING"];

  const panel =
    tab !== "members" ? undefined : selected ? (
      <div ref={panelRef} className="scroll-mt-24">
        <DetailPanel
          title={selected.name || selected.email}
          footer={
            canEditSelected ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  className="flex-1"
                  disabled={!roleDirty || isUpdating || isRemoving}
                  aria-busy={isUpdating || undefined}
                  onClick={() => {
                    if (draftRole) void handleMemberRoleChange(selected.id, draftRole);
                  }}
                >
                  {isUpdating ? "Saving…" : "Save changes"}
                </Button>
                <Button
                  onClick={() => {
                    if (roleDirty) setDraftRole(null);
                    else void closePanel();
                  }}
                  disabled={isUpdating}
                >
                  {roleDirty ? "Cancel" : "Close"}
                </Button>
              </div>
            ) : (
              <Button onClick={() => void closePanel()}>Close</Button>
            )
          }
        >
          <PanelSection>
            <p className="text-sm break-words text-[var(--av2-text-2)]">
              {selected.email}
              {selectedIsYou ? " (You)" : ""}
            </p>
            <p className="mt-1 text-sm text-[var(--av2-text-2)]">
              Joined {formatDate(selected.joinedAt)}
            </p>
          </PanelSection>

          <PanelSection title="Role">
            {canEditSelected ? (
              <>
                <Select
                  aria-label={`Role for ${selected.name || selected.email}`}
                  value={roleValue}
                  disabled={isUpdating || isRemoving}
                  onChange={(e) => setDraftRole(e.target.value as CompanyRoleString)}
                >
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {formatCompanyRole(role)}
                    </option>
                  ))}
                </Select>
                <p className="mt-1.5 text-xs text-[var(--av2-text-2)]">
                  Role changes apply after you save.
                </p>
              </>
            ) : (
              <>
                <Badge>{formatCompanyRole(selected.roleInCompany)}</Badge>
                <p className="mt-2 text-sm text-[var(--av2-text-2)]">
                  Only an owner can change an owner&apos;s role.
                </p>
              </>
            )}
          </PanelSection>

          <PanelSection title="Role description">
            <p className="text-sm text-[var(--av2-text-2)]">{ROLE_DESCRIPTIONS[roleValue]}</p>
          </PanelSection>

          {memberActionError && (
            <PanelSection>
              <Callout tone="error" title="That didn't work">
                {memberActionError}
              </Callout>
            </PanelSection>
          )}

          {canEditSelected && !selectedIsYou && (
            <PanelSection title="Remove from workspace">
              <p className="mb-3 text-sm text-[var(--av2-text-2)]">
                They lose access straight away. To bring them back, invite them again.
              </p>
              <Button
                variant="danger"
                disabled={isRemoving || isUpdating}
                onClick={() =>
                  setMemberToRemove({
                    id: selected.id,
                    name: selected.name || selected.email,
                  })
                }
              >
                {isRemoving ? "Removing…" : "Remove member"}
              </Button>
            </PanelSection>
          )}
        </DetailPanel>
      </div>
    ) : (
      <div className="hidden xl:block">
        <Card>
          <p className="text-base font-semibold">Select a member</p>
          <p className="mt-1 text-sm text-[var(--av2-text-2)]">
            Choose someone from the list to see what their role allows and change it.
          </p>
        </Card>
      </div>
    );

  return (
    <>
      <PageHeader
        title="Company members"
        description="See who is part of your brandbite workspace and what they can do."
        meta={
          company ? (
            <>
              <span className="font-medium text-[var(--av2-text)]">{company.name}</span> (
              {company.slug})
              {currentUserRole && (
                <>
                  {" · "}You are browsing as{" "}
                  <span className="font-medium text-[var(--av2-text)]">
                    {formatCompanyRole(currentUserRole)}
                  </span>
                </>
              )}
            </>
          ) : null
        }
      />

      {state.status === "loading" ? (
        <CustomerMembersSkeleton />
      ) : error ? (
        <Callout
          tone="error"
          title={isPermissionError ? "You don't have access to manage members" : "Error"}
        >
          {error}
        </Callout>
      ) : (
        <div className="space-y-6">
          {/* Member action errors reach the panel; without one open, show them here. */}
          {memberActionError && !selected && <Callout tone="warning">{memberActionError}</Callout>}

          <Card>
            <div className="flex items-start gap-4">
              <IconTile tone="peach" size={44}>
                <IconUsers />
              </IconTile>
              <div className="min-w-0">
                <h2 className="text-xl leading-7 font-semibold">Invite member</h2>
                <p className="mt-0.5 text-sm text-[var(--av2-text-2)]">
                  Send an invite to someone on your team. They will join with the selected role once
                  they accept the invitation.
                </p>
              </div>
            </div>

            {(inviteError || inviteSuccess || cancelError) && (
              <div className="mt-4 space-y-2">
                {inviteError && <Callout tone="error">{inviteError}</Callout>}
                {inviteSuccess && <Callout tone="success">{inviteSuccess}</Callout>}
                {cancelError && <Callout tone="warning">{cancelError}</Callout>}
              </div>
            )}

            <form
              onSubmit={handleInviteSubmit}
              className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,220px)_auto] md:items-end"
            >
              <Field label="Email" htmlFor="invite-email">
                <TextInput
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="creative@yourcompany.com"
                  required
                />
              </Field>
              <Field label="Role" htmlFor="invite-role">
                <Select
                  id="invite-role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as CompanyRoleString)}
                >
                  <option value="MEMBER">Member</option>
                  <option value="PM">Project manager</option>
                  <option value="BILLING">Billing</option>
                </Select>
              </Field>
              <Button
                type="submit"
                variant="primary"
                disabled={inviteStatus === "submitting"}
                aria-busy={inviteStatus === "submitting" || undefined}
              >
                {inviteStatus === "submitting" ? "Sending…" : "Send invite"}
              </Button>
            </form>
          </Card>

          <Tabs<MembersTab>
            label="Members and invitations"
            idPrefix={TAB_PREFIX}
            value={tab}
            onChange={(next) => void switchTab(next)}
            tabs={[
              {
                value: "members",
                label: (
                  <span className="inline-flex items-center gap-2">
                    Members{" "}
                    <Badge tone={tab === "members" ? "peach" : "neutral"}>{members.length}</Badge>
                  </span>
                ),
              },
              {
                value: "invites",
                label: (
                  <span className="inline-flex items-center gap-2">
                    Pending invitations{" "}
                    <Badge tone={tab === "invites" ? "peach" : "neutral"}>
                      {sortedInvites.length}
                    </Badge>
                  </span>
                ),
              },
            ]}
          />

          {tab === "members" ? (
            <TabPanel idPrefix={TAB_PREFIX} value="members">
              <SplitView panel={panel}>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,220px)]">
                  <SearchInput
                    value={query}
                    onChange={setQuery}
                    placeholder="Search members"
                    label="Search members"
                  />
                  <Select
                    aria-label="Filter by role"
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                  >
                    <option value={ALL_ROLES}>All roles</option>
                    <option value="OWNER">Owner</option>
                    <option value="PM">Project manager</option>
                    <option value="BILLING">Billing</option>
                    <option value="MEMBER">Member</option>
                  </Select>
                </div>

                {selectionFiltered && selected && (
                  <div className="mt-3">
                    <Callout
                      tone={roleDirty ? "warning" : "info"}
                      title={`${selected.name || selected.email} is hidden by this filter`}
                      action={<Button onClick={clearFilters}>Clear filters</Button>}
                    >
                      {roleDirty
                        ? "Your unsaved role change is still open in the panel. Save or cancel it there."
                        : "They stay selected in the panel until you choose someone else."}
                    </Callout>
                  </div>
                )}

                <Card padding="none" className="mt-4">
                  {sortedMembers.length === 0 ? (
                    <EmptyState title="No members found for this company yet." />
                  ) : filteredMembers.length === 0 ? (
                    <EmptyState
                      title="No members match these filters."
                      description="Try another name, email or role."
                      action={<Button onClick={clearFilters}>Clear filters</Button>}
                    />
                  ) : (
                    <>
                      <Table label="Company members">
                        <thead>
                          <tr>
                            <Th>Member</Th>
                            <Th className="hidden sm:table-cell">Role</Th>
                            <Th className="hidden md:table-cell">Joined</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleMembers.map((member) => {
                            const isYou = member.userId === currentUserId;
                            const name = member.name || "Unnamed member";
                            return (
                              <Tr
                                key={member.id}
                                selected={member.id === selectedId}
                                onSelect={() => void selectMember(member.id)}
                                label={`Select ${name}, ${formatCompanyRole(member.roleInCompany)}`}
                              >
                                <Td>
                                  <div className="flex items-center gap-3">
                                    <Avatar name={member.name ?? member.email} size={40} />
                                    <div className="min-w-0">
                                      <p className="font-semibold break-words">
                                        {name}
                                        {isYou && (
                                          <span className="ml-1 font-medium text-[var(--av2-link)]">
                                            (You)
                                          </span>
                                        )}
                                      </p>
                                      <p className="break-all text-[var(--av2-text-2)]">
                                        {member.email}
                                      </p>
                                      <div className="mt-1 sm:hidden">
                                        <Badge>{formatCompanyRole(member.roleInCompany)}</Badge>
                                      </div>
                                    </div>
                                  </div>
                                </Td>
                                <Td className="hidden sm:table-cell">
                                  <Badge>{formatCompanyRole(member.roleInCompany)}</Badge>
                                </Td>
                                <Td className="hidden whitespace-nowrap md:table-cell">
                                  {formatDate(member.joinedAt)}
                                </Td>
                              </Tr>
                            );
                          })}
                        </tbody>
                      </Table>
                      <TableFooter>
                        <span>
                          Showing {visibleMembers.length} of {filteredMembers.length}
                          {filtering ? ` (${sortedMembers.length} total)` : ""}
                        </span>
                        <ListPager page={safePage} pageCount={pageCount} onPage={setPage} />
                      </TableFooter>
                    </>
                  )}
                </Card>
              </SplitView>
            </TabPanel>
          ) : (
            <TabPanel idPrefix={TAB_PREFIX} value="invites">
              <Card padding="none">
                {sortedInvites.length === 0 ? (
                  <EmptyState
                    title="No pending invites."
                    description="When you invite someone, they will appear here until they join."
                  />
                ) : (
                  <ul className="divide-y divide-[var(--av2-border)]">
                    {sortedInvites.map((invite) => {
                      const isCanceling = cancelingId === invite.id;
                      return (
                        <li
                          key={invite.id}
                          className="flex flex-wrap items-center justify-between gap-3 px-6 py-4"
                        >
                          <div className="min-w-0">
                            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                              <span className="min-w-0 break-all">{invite.email}</span>
                              {invite.expired && <Badge tone="red">Expired</Badge>}
                            </p>
                            <p className="mt-0.5 text-sm text-[var(--av2-text-2)]">
                              {formatCompanyRole(invite.roleInCompany)} · invited{" "}
                              {formatDate(invite.createdAt)}
                              {invite.expiresAt && !invite.expired && (
                                <> · expires {formatDate(invite.expiresAt)}</>
                              )}
                            </p>
                            {invite.invitedByEmail && (
                              <p className="mt-0.5 text-sm text-[var(--av2-text-2)]">
                                Invited by {invite.invitedByName || invite.invitedByEmail}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="danger"
                            disabled={isCanceling}
                            aria-busy={isCanceling || undefined}
                            onClick={() => setInviteToCancel(invite.id)}
                          >
                            {isCanceling ? "Cancelling…" : "Cancel invite"}
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            </TabPanel>
          )}
        </div>
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
            ? `${memberToRemove.name} will lose access to this workspace. You can invite them again later.`
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
    <div aria-busy="true" aria-label="Loading company members" className="space-y-6">
      <Skeleton className="h-44 rounded-2xl" />
      <Skeleton className="h-9 w-80" />
      <Skeleton className="h-72 rounded-2xl" />
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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
