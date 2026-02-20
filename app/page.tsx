// -----------------------------------------------------------------------------
// @file: app/page.tsx
// @purpose: Homepage — role-based entry point with quick links to dashboards
// @version: v2.0.0
// @status: active
// @lastUpdate: 2025-12-13
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useState } from "react";

type SessionResponse = {
  ok: boolean;
  demoPersona: { id: string; label: string; role: string } | null;
  user: { name: string | null; email: string; role: string } | null;
};

const DASHBOARDS = [
  {
    role: "Admin",
    tagline: "Operations & oversight",
    description:
      "Manage companies, plans, tickets, withdrawals and platform settings across the entire system.",
    href: "/admin/board",
    color: "bg-[#f15b2b]",
    ringColor: "group-hover:ring-[#f15b2b]/20",
    pages: [
      { label: "Board", href: "/admin/board" },
      { label: "Companies", href: "/admin/companies" },
      { label: "Tickets", href: "/admin/tickets" },
      { label: "Settings", href: "/admin/settings" },
    ],
  },
  {
    role: "Customer",
    tagline: "Design requests & projects",
    description:
      "Create design requests, track progress on the kanban board, and manage your team and tokens.",
    href: "/customer/board",
    color: "bg-[#2b7ff1]",
    ringColor: "group-hover:ring-[#2b7ff1]/20",
    pages: [
      { label: "Board", href: "/customer/board" },
      { label: "Tokens", href: "/customer/tokens" },
      { label: "Tickets", href: "/customer/tickets" },
      { label: "Members", href: "/customer/members" },
    ],
  },
  {
    role: "Creative",
    tagline: "Assignments & earnings",
    description:
      "View assigned tickets, submit revisions, track earnings, and manage your withdrawal balance.",
    href: "/creative/board",
    color: "bg-[#8b5cf6]",
    ringColor: "group-hover:ring-[#8b5cf6]/20",
    pages: [
      { label: "Board", href: "/creative/board" },
      { label: "Tickets", href: "/creative/tickets" },
      { label: "Balance", href: "/creative/balance" },
      { label: "Withdrawals", href: "/creative/withdrawals" },
    ],
  },
];

const QUICK_STEPS = [
  {
    step: "1",
    title: "Pick a persona",
    description: "Choose a demo role — admin, customer, or creative — to explore the platform.",
  },
  {
    step: "2",
    title: "Navigate the dashboard",
    description: "Use the top nav to jump between boards, tickets, settings, and more.",
  },
  {
    step: "3",
    title: "Try the kanban board",
    description: "Drag tickets across columns, create new requests, and track progress visually.",
  },
];

export default function HomePage() {
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/session", { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          setSession(json);
        }
      } catch {
        // Ignore — just means no active session
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const activePersona = session?.demoPersona;
  const activeUser = session?.user;

  const roleLabel =
    activeUser?.role === "SITE_OWNER" || activeUser?.role === "SITE_ADMIN"
      ? "Admin"
      : activeUser?.role === "CUSTOMER"
        ? "Customer"
        : activeUser?.role === "DESIGNER"
          ? "Creative"
          : activeUser?.role ?? "";

  return (
    <div className="min-h-screen bg-[#f5f3f0] text-[#424143]">
      <div className="mx-auto max-w-5xl px-6 pb-16 pt-12">
        {/* ----------------------------------------------------------------- */}
        {/* Hero section                                                      */}
        {/* ----------------------------------------------------------------- */}
        <div className="mb-12 flex flex-col items-center text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f15b2b] text-2xl font-bold text-white shadow-lg shadow-[#f15b2b]/20">
            B
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Brandbite
          </h1>
          <p className="mt-2 max-w-md text-sm text-[#7a7a7a]">
            Design-as-a-service platform. Submit requests, track progress, and
            manage your creative pipeline — all in one place.
          </p>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* Session card                                                      */}
        {/* ----------------------------------------------------------------- */}
        {!loading && activePersona && activeUser && (
          <div className="mx-auto mb-10 max-w-xl">
            <div className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f5f3f0] text-sm font-semibold text-[#424143]">
                    {(activeUser.name || activeUser.email)[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#424143]">
                      {activeUser.name || activeUser.email}
                    </p>
                    <p className="text-[11px] text-[#7a7a7a]">
                      {roleLabel} &middot; {activeUser.email}
                    </p>
                  </div>
                </div>
                <a
                  href="/debug/demo-user"
                  className="rounded-full border border-[#e3e1dc] bg-[#f7f5f0] px-3 py-1.5 text-[11px] font-semibold text-[#7a7a7a] transition-colors hover:border-[#f15b2b] hover:text-[#f15b2b]"
                >
                  Switch
                </a>
              </div>
            </div>
          </div>
        )}

        {!loading && !activePersona && (
          <div className="mx-auto mb-10 max-w-xl">
            <div className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-5 shadow-sm">
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-sm">
                  ?
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#424143]">
                    No active session
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#7a7a7a]">
                    Pick a demo persona to start exploring Brandbite from
                    different perspectives.
                  </p>
                </div>
                <a
                  href="/debug/demo-user"
                  className="rounded-full bg-[#f15b2b] px-5 py-2 text-sm font-semibold text-white shadow-sm transition-shadow hover:shadow-md"
                >
                  Choose persona
                </a>
              </div>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* Dashboard cards                                                   */}
        {/* ----------------------------------------------------------------- */}
        <div className="mb-12">
          <div className="mb-5 flex items-center gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b1afa9]">
              Dashboards
            </p>
            <div className="h-px flex-1 bg-[#e3e1dc]" />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {DASHBOARDS.map((d) => (
              <a
                key={d.role}
                href={d.href}
                className={`group flex flex-col rounded-2xl border border-[#e3e1dc] bg-white p-5 shadow-sm ring-4 ring-transparent transition-all hover:-translate-y-[1px] hover:shadow-md ${d.ringColor}`}
              >
                <div className="mb-3 flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${d.color} text-sm font-bold text-white shadow-sm`}
                  >
                    {d.role[0]}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#424143] group-hover:text-[#f15b2b]">
                      {d.role}
                    </h3>
                    <p className="text-[10px] text-[#9a9892]">{d.tagline}</p>
                  </div>
                </div>

                <p className="mb-4 flex-1 text-[11px] leading-relaxed text-[#7a7a7a]">
                  {d.description}
                </p>

                <div className="flex flex-wrap gap-1.5">
                  {d.pages.map((pg) => (
                    <span
                      key={pg.label}
                      className="rounded-full bg-[#f5f3f0] px-2.5 py-0.5 text-[10px] font-medium text-[#7a7a7a]"
                    >
                      {pg.label}
                    </span>
                  ))}
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* Quick-start guide                                                 */}
        {/* ----------------------------------------------------------------- */}
        <div className="mb-12">
          <div className="mb-5 flex items-center gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b1afa9]">
              Getting started
            </p>
            <div className="h-px flex-1 bg-[#e3e1dc]" />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {QUICK_STEPS.map((s) => (
              <div
                key={s.step}
                className="rounded-2xl border border-[#e3e1dc] bg-white/80 p-5"
              >
                <span className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#f5f3f0] text-[11px] font-bold text-[#9a9892]">
                  {s.step}
                </span>
                <h3 className="mt-2 text-sm font-semibold text-[#424143]">
                  {s.title}
                </h3>
                <p className="mt-1 text-[11px] leading-relaxed text-[#7a7a7a]">
                  {s.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* Footer                                                            */}
        {/* ----------------------------------------------------------------- */}
        <footer className="flex flex-col items-center gap-2 border-t border-[#e3e1dc] pt-6 text-center">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#f15b2b] text-[10px] font-bold text-white">
              B
            </div>
            <span className="text-xs font-semibold text-[#9a9892]">
              Brandbite
            </span>
          </div>
          <p className="text-[10px] text-[#b1afa9]">
            Design subscription platform &middot; Demo environment
          </p>
        </footer>
      </div>
    </div>
  );
}
