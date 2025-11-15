// -----------------------------------------------------------------------------
// @file: app/invite/[token]/InvitePageClient.tsx
// @purpose: Invite landing page for accepting company invites (client-side)
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-11-16
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type CompanyRoleString = "OWNER" | "PM" | "BILLING" | "MEMBER";
type InviteStatusString = "PENDING" | "ACCEPTED" | "EXPIRED" | "CANCELLED";

type InviteDetailsResponse = {
  invite: {
    id: string;
    email: string;
    roleInCompany: CompanyRoleString;
    status: InviteStatusString;
    createdAt: string;
  };
  company: {
    id: string;
    name: string;
    slug: string;
  };
  viewer: {
    id: string;
    email: string;
    role: string;
    activeCompanyId: string | null;
  } | null;
  canAccept: boolean;
  alreadyMember: boolean;
};

type ViewState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: InviteDetailsResponse };

type InvitePageClientProps = {
  token: string;
};

export default function InvitePageClient({ token }: InvitePageClientProps) {
  const router = useRouter();

  const [state, setState] = useState<ViewState>({ status: "loading" });
  const [acceptStatus, setAcceptStatus] =
    useState<"idle" | "submitting">("idle");
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [acceptSuccess, setAcceptSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setState({ status: "loading" });

      try {
        const res = await fetch(`/api/invite/${token}`, {
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
            data: json as InviteDetailsResponse,
          });
        }
      } catch (error) {
        console.error("[InvitePageClient] load error:", error);
        if (!cancelled) {
          setState({
            status: "error",
            message: "Unexpected error while loading invite",
          });
        }
      }
    };

    if (token) {
      load();
    } else {
      setState({
        status: "error",
        message: "Missing invite token in URL",
      });
    }

    return () => {
      cancelled = true;
    };
  }, [token]);

  // Helper: refresh invite after accept
  const refreshInvite = async () => {
    try {
      const res = await fetch(`/api/invite/${token}`, {
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
        data: json as InviteDetailsResponse,
      });
    } catch (error) {
      console.error("[InvitePageClient] refresh error:", error);
      setState({
        status: "error",
        message: "Unexpected error while refreshing invite",
      });
    }
  };

  const handleAccept = async () => {
    setAcceptError(null);
    setAcceptSuccess(false);
    setAcceptStatus("submitting");

    try {
      const res = await fetch(`/api/invite/${token}`, {
        method: "POST",
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const msg =
          json?.error || `Request failed with status ${res.status}`;
        setAcceptError(msg);
        return;
      }

      setAcceptSuccess(true);
      await refreshInvite();
    } catch (error) {
      console.error("[InvitePageClient] accept error:", error);
      setAcceptError("Unexpected error while accepting invite");
    } finally {
      setAcceptStatus("idle");
    }
  };

  if (state.status === "loading") {
    return <InviteSkeleton />;
  }

  if (state.status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f3f0] text-[#424143]">
        <div className="max-w-md rounded-3xl bg-white px-6 py-5 text-center shadow-sm shadow-[#e3ded4]">
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="mt-2 text-sm text-[#7a7a7a]">
            {state.message}
          </p>
          <a
            href="/"
            className="mt-4 inline-flex items-center justify-center rounded-full bg-[#f15b2b] px-4 py-2 text-sm font-medium text-white hover:bg-[#e44f20]"
          >
            Go to Brandbite
          </a>
        </div>
      </div>
    );
  }

  const { invite, company, viewer, canAccept, alreadyMember } =
    state.data;

  const statusLabel = formatInviteStatus(invite.status);
  const roleLabel = formatCompanyRole(invite.roleInCompany);

  const viewerLabel = viewer
    ? `${viewer.email} (${viewer.role.toLowerCase()})`
    : "Not signed in";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f3f0] text-[#424143]">
      <div className="mx-4 w-full max-w-md rounded-3xl bg-white px-6 py-6 shadow-sm shadow-[#e3ded4]">
        <header className="mb-4 border-b border-[#f0ece4] pb-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#b8b6b1]">
            Invite
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-[#424143]">
            Join {company.name} on Brandbite
          </h1>
          <p className="mt-1 text-xs text-[#7a7a7a]">
            You have been invited to join{" "}
            <span className="font-medium text-[#424143]">
              {company.name}
            </span>{" "}
            as a {roleLabel}.
          </p>
        </header>

        <section className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-[#7a7a7a]">Invite status</span>
            <span className="rounded-full bg-[#f5f3f0] px-2 py-0.5 text-[11px] font-medium text-[#7a7a7a]">
              {statusLabel}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#7a7a7a]">Invited email</span>
            <span className="text-[11px] font-medium text-[#424143]">
              {invite.email}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#7a7a7a]">You are browsing as</span>
            <span className="text-[11px] font-medium text-[#424143]">
              {viewerLabel}
            </span>
          </div>
        </section>

        {acceptError && (
          <div className="mt-3 rounded-lg border border-red-200 bg-[#fff7f7] px-3 py-2 text-xs text-red-700">
            {acceptError}
          </div>
        )}

        {acceptSuccess && (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-[#f0fbf4] px-3 py-2 text-xs text-emerald-700">
            You have joined{" "}
            <span className="font-semibold">{company.name}</span>. You
            can now access its workspace.
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2">
          {invite.status !== "PENDING" && (
            <p className="text-xs text-[#9a9892]">
              This invite is no longer pending (
              {statusLabel.toLowerCase()}).
            </p>
          )}

          {invite.status === "PENDING" && alreadyMember && (
            <p className="text-xs text-[#9a9892]">
              You are already a member of this company. Accepting is not
              necessary.
            </p>
          )}

          {invite.status === "PENDING" && !viewer && (
            <p className="text-xs text-[#9a9892]">
              To accept this invite, you need to browse Brandbite as a
              user. In this demo, use the{" "}
              <a
                href="/debug/demo-user"
                className="font-medium text-[#f15b2b] underline"
              >
                demo personas
              </a>{" "}
              to simulate the invited person.
            </p>
          )}

          {invite.status === "PENDING" &&
            viewer &&
            !alreadyMember && (
              <button
                type="button"
                disabled={!canAccept || acceptStatus === "submitting"}
                onClick={handleAccept}
                className="mt-1 inline-flex items-center justify-center rounded-full bg-[#f15b2b] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#e44f20] disabled:opacity-70"
              >
                {acceptStatus === "submitting"
                  ? "Joining…"
                  : `Join ${company.name}`}
              </button>
            )}

          <button
            type="button"
            onClick={() => router.push("/")}
            className="mt-1 inline-flex items-center justify-center rounded-full border border-[#ece5d8] px-4 py-2 text-[11px] font-medium text-[#7a7a7a] hover:bg-[#f5f3f0]"
          >
            Back to Brandbite
          </button>
        </div>
      </div>
    </div>
  );
}

function InviteSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f3f0] text-[#424143]">
      <div className="mx-4 w-full max-w-md rounded-3xl bg-white px-6 py-6 shadow-sm shadow-[#e3ded4]">
        <div className="mb-4 border-b border-[#f0ece4] pb-3">
          <div className="h-3 w-16 rounded bg-[#e3ded4]" />
          <div className="mt-2 h-5 w-48 rounded bg-[#e3ded4]" />
          <div className="mt-2 h-3 w-64 rounded bg-[#e3ded4]" />
        </div>
        <div className="space-y-3">
          <div className="h-4 w-full rounded bg-[#f5f3f0]" />
          <div className="h-4 w-3/4 rounded bg-[#f5f3f0]" />
          <div className="h-4 w-2/3 rounded bg-[#f5f3f0]" />
        </div>
        <div className="mt-5 h-9 w-full rounded-full bg-[#f5f3f0]" />
      </div>
    </div>
  );
}

function formatInviteStatus(status: InviteStatusString): string {
  switch (status) {
    case "PENDING":
      return "Pending";
    case "ACCEPTED":
      return "Accepted";
    case "EXPIRED":
      return "Expired";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
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
