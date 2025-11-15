// -----------------------------------------------------------------------------
// @file: app/customer/settings/page.tsx
// @purpose: Customer-facing settings page (account + company + plan overview)
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-11-15
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useState } from "react";

type UserRole = "SITE_OWNER" | "SITE_ADMIN" | "DESIGNER" | "CUSTOMER";

type CustomerSettingsResponse = {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: UserRole;
  };
  company: {
    id: string;
    name: string;
    slug: string;
    tokenBalance: number;
    createdAt: string;
    updatedAt: string;
    counts: {
      members: number;
      projects: number;
      tickets: number;
    };
  };
  plan: {
    id: string;
    name: string;
    monthlyTokens: number;
    priceCents: number | null;
    isActive: boolean;
  } | null;
};

export default function CustomerSettingsPage() {
  const [data, setData] = useState<CustomerSettingsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/customer/settings", {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);

        if (!res.ok) {
          const msg =
            json?.error || `Request failed with status ${res.status}`;
          throw new Error(msg);
        }

        if (!cancelled) {
          setData(json as CustomerSettingsResponse);
        }
      } catch (err: any) {
        console.error("Customer settings fetch error:", err);
        if (!cancelled) {
          setError(
            err?.message || "Failed to load settings.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const user = data?.user;
  const company = data?.company;
  const plan = data?.plan;

  const formatPrice = (priceCents: number | null) => {
    if (priceCents == null) return "—";
    const euros = priceCents / 100;
    return `€${euros.toFixed(2)}`;
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString();
  };

  const prettyRole = (role: UserRole) => {
    switch (role) {
      case "SITE_OWNER":
        return "Site owner";
      case "SITE_ADMIN":
        return "Site admin";
      case "DESIGNER":
        return "Designer";
      case "CUSTOMER":
        return "Customer";
      default:
        return role;
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f3f0] text-[#424143]">
      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* Top navigation */}
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
              onClick={() => (window.location.href = "/customer/board")}
            >
              Board
            </button>
            <button
              className="font-medium text-[#7a7a7a]"
              onClick={() => (window.location.href = "/customer/tickets")}
            >
              Tickets
            </button>
            <button
              className="font-medium text-[#7a7a7a]"
              onClick={() => (window.location.href = "/customer/tokens")}
            >
              Tokens
            </button>
            <button className="font-medium text-[#424143]">
              Settings
            </button>
          </nav>
        </header>

        {/* Page header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Settings
            </h1>
            <p className="mt-1 text-sm text-[#7a7a7a]">
              Your account, company and subscription information.
            </p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm text-red-700">
            <p className="font-medium">Error</p>
            <p className="mt-1">{error}</p>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="mt-6 text-sm text-[#7a7a7a]">
            Loading settings…
          </div>
        ) : !data ? (
          <div className="mt-6 text-sm text-[#9a9892]">
            No settings data found.
          </div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {/* Account card */}
            <section className="md:col-span-1 rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
              <h2 className="text-sm font-semibold tracking-tight">
                Account
              </h2>
              <p className="mt-1 text-xs text-[#7a7a7a]">
                Your personal profile inside Brandbite.
              </p>

              <div className="mt-3 space-y-2 text-xs text-[#424143]">
                <div>
                  <p className="text-[11px] font-medium text-[#9a9892]">
                    Name
                  </p>
                  <p className="mt-0.5">
                    {user?.name || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-[#9a9892]">
                    Email
                  </p>
                  <p className="mt-0.5">{user?.email}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-[#9a9892]">
                    Role
                  </p>
                  <p className="mt-0.5">
                    {user ? prettyRole(user.role) : "—"}
                  </p>
                </div>
              </div>
            </section>

            {/* Company card */}
            <section className="md:col-span-1 rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
              <h2 className="text-sm font-semibold tracking-tight">
                Company
              </h2>
              <p className="mt-1 text-xs text-[#7a7a7a]">
                The workspace your requests belong to.
              </p>

              <div className="mt-3 space-y-2 text-xs text-[#424143]">
                <div>
                  <p className="text-[11px] font-medium text-[#9a9892]">
                    Name
                  </p>
                  <p className="mt-0.5">{company?.name}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-[#9a9892]">
                    Slug
                  </p>
                  <p className="mt-0.5">{company?.slug}</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-[11px] font-medium text-[#9a9892]">
                      Members
                    </p>
                    <p className="mt-0.5">
                      {company?.counts.members ?? 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-[#9a9892]">
                      Projects
                    </p>
                    <p className="mt-0.5">
                      {company?.counts.projects ?? 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-[#9a9892]">
                      Tickets
                    </p>
                    <p className="mt-0.5">
                      {company?.counts.tickets ?? 0}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-[#9a9892]">
                    Created at
                  </p>
                  <p className="mt-0.5">
                    {company ? formatDate(company.createdAt) : "—"}
                  </p>
                </div>
              </div>
            </section>

            {/* Plan card */}
            <section className="md:col-span-1 rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
              <h2 className="text-sm font-semibold tracking-tight">
                Subscription plan
              </h2>
              <p className="mt-1 text-xs text-[#7a7a7a]">
                The plan that defines your monthly token allowance.
              </p>

              {plan ? (
                <div className="mt-3 space-y-2 text-xs text-[#424143]">
                  <div>
                    <p className="text-[11px] font-medium text-[#9a9892]">
                      Plan name
                    </p>
                    <p className="mt-0.5">{plan.name}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-[#9a9892]">
                      Monthly tokens
                    </p>
                    <p className="mt-0.5">
                      {plan.monthlyTokens} tokens
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-[#9a9892]">
                      Price
                    </p>
                    <p className="mt-0.5">
                      {formatPrice(plan.priceCents)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-[#9a9892]">
                      Status
                    </p>
                    <p className="mt-0.5">
                      {plan.isActive ? "Active" : "Inactive"}
                    </p>
                  </div>
                  <div className="mt-2 rounded-lg bg-[#fbfaf8] px-3 py-2 text-[11px] text-[#7a7a7a]">
                    Changes to your plan are currently handled by the
                    Brandbite team. Reach out to support if you want to
                    switch plans.
                  </div>
                </div>
              ) : (
                <div className="mt-3 rounded-lg bg-[#fbfaf8] px-3 py-2 text-[11px] text-[#7a7a7a]">
                  No subscription plan is assigned to your company yet.
                  Please contact support if this does not look correct.
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
