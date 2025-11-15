// -----------------------------------------------------------------------------
// @file: app/customer/members/page.tsx
// @purpose: Customer-facing company members & roles overview
// @version: v1.1.0
// @status: active
// @lastUpdate: 2025-11-16
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";

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
    roleInCompany: "OWNER" | "PM" | "BILLING" | "MEMBER";
    joinedAt: string;
  }[];
};

type ViewState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: CompanyMembersResponse };

export default function CustomerMembersPage() {
  const [state, setState] = useState<ViewState>({ status: "loading" });

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
  // Hooks MUST always run in the same order on every render.
  // So we derive data & sortedMembers BEFORE any early return.
  // ---------------------------------------------------------------------------

  const data = state.status === "ready" ? state.data : null;
  const company = data?.company ?? null;
  const members = data?.members ?? [];
  const currentUserId = data?.currentUserId ?? "";

  const sortedMembers = useMemo(() => {
    if (!members.length) return [];
    return [...members].sort((a, b) => {
      const order = roleWeight(b.roleInCompany) - roleWeight(a.roleInCompany);
      if (order !== 0) return order;
      return a.joinedAt.localeCompare(b.joinedAt);
    });
  }, [members]);

  // Skeleton için erken dönüş artık HOOK'lardan sonra geliyor
  if (state.status === "loading") {
    return <CustomerMembersSkeleton />;
  }

  const error = state.status === "error" ? state.message : null;

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
              onClick={() => (window.location.href = "/customer/tokens")}
            >
              Tokens
            </button>
            <button
              className="font-medium text-[#7a7a7a]"
              onClick={() => (window.location.href = "/customer/tickets")}
            >
              Tickets
            </button>
            <button
              className="font-medium text-[#7a7a7a]"
              onClick={() => (window.location.href = "/customer/board")}
            >
              Board
            </button>
            <button
              className="font-semibold text-[#424143]"
              onClick={() => (window.location.href = "/customer/members")}
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
              See who is part of your Brandbite workspace and what they can do.
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
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm text-red-700">
            <p className="font-medium">Error</p>
            <p className="mt-1">{error}</p>
          </div>
        )}

        {/* Members list */}
        <section className="mt-4 grid gap-4 md:grid-cols-2">
          {sortedMembers.map((member) => {
            const isYou = member.userId === currentUserId;
            return (
              <article
                key={member.id}
                className="flex flex-col rounded-2xl border border-[#ece5d8] bg-white px-4 py-3 shadow-sm"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f15b2b]/10 text-sm font-semibold text-[#f15b2b]">
                      {initialsForName(member.name ?? member.email)}
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
                  <span className="rounded-full bg-[#f5f3f0] px-2 py-0.5 text-[11px] font-medium text-[#7a7a7a]">
                    {formatCompanyRole(member.roleInCompany)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#9a9892]">
                  Joined{" "}
                  {new Date(member.joinedAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </article>
            );
          })}

          {sortedMembers.length === 0 && !error && (
            <div className="rounded-2xl border border-dashed border-[#d5cec0] bg-white/60 px-4 py-6 text-sm text-[#7a7a7a]">
              No members found for this company yet.
            </div>
          )}
        </section>
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

type CompanyRoleString = "OWNER" | "PM" | "BILLING" | "MEMBER";

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
