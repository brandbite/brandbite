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
    color: "bg-[var(--bb-primary)]",
    ringColor: "group-hover:ring-[var(--bb-primary)]/20",
    pages: [
      { label: "Board", href: "/admin/board" },
      { label: "Companies", href: "/admin/companies" },
      { label: "Tickets", href: "/admin/tickets" },
      { label: "Settings", href: "/admin/settings" },
    ],
  },
  {
    role: "Customer",
    tagline: "Creative requests & projects",
    description:
      "Create creative requests, track progress on the kanban board, and manage your team and tokens.",
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
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

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
  const hasSession = isDemoMode ? !!activePersona : !!activeUser;

  const roleLabel =
    activeUser?.role === "SITE_OWNER" || activeUser?.role === "SITE_ADMIN"
      ? "Admin"
      : activeUser?.role === "CUSTOMER"
        ? "Customer"
        : activeUser?.role === "DESIGNER"
          ? "Creative"
          : (activeUser?.role ?? "");

  return (
    <div className="min-h-screen bg-[var(--bb-bg-card)] text-[var(--bb-secondary)]">
      <div className="mx-auto max-w-5xl px-6 pt-12 pb-16">
        {/* ----------------------------------------------------------------- */}
        {/* Hero section                                                      */}
        {/* ----------------------------------------------------------------- */}
        <div className="mb-12 flex flex-col items-center text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--bb-primary)] text-2xl font-bold text-white shadow-[var(--bb-primary)]/20 shadow-lg">
            B
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Brandbite</h1>
          <p className="mt-2 max-w-md text-sm text-[var(--bb-text-secondary)]">
            Creative-as-a-service platform. Submit requests, track progress, and manage your
            creative pipeline — all in one place.
          </p>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* Session card                                                      */}
        {/* ----------------------------------------------------------------- */}
        {!loading && hasSession && activeUser && (
          <div className="mx-auto mb-10 max-w-xl">
            <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-4 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bb-bg-card)] text-sm font-semibold text-[var(--bb-secondary)]">
                    {(activeUser.name || activeUser.email)[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--bb-secondary)]">
                      {activeUser.name || activeUser.email}
                    </p>
                    <p className="text-[11px] text-[var(--bb-text-secondary)]">
                      {roleLabel} &middot; {activeUser.email}
                    </p>
                  </div>
                </div>
                <a
                  href={isDemoMode ? "/debug/demo-user" : "/login"}
                  className="rounded-full border border-[var(--bb-border)] bg-[var(--bb-bg-warm)] px-3 py-1.5 text-[11px] font-semibold text-[var(--bb-text-secondary)] transition-colors hover:border-[var(--bb-primary)] hover:text-[var(--bb-primary)]"
                >
                  {isDemoMode ? "Switch" : "Sign out"}
                </a>
              </div>
            </div>
          </div>
        )}

        {!loading && !hasSession && (
          <div className="mx-auto mb-10 max-w-xl">
            <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-5 shadow-sm">
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-sm dark:bg-amber-900/20">
                  ?
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--bb-secondary)]">
                    No active session
                  </p>
                  <p className="mt-0.5 text-[11px] text-[var(--bb-text-secondary)]">
                    {isDemoMode
                      ? "Pick a demo persona to start exploring Brandbite from different perspectives."
                      : "Sign in or create an account to get started with Brandbite."}
                  </p>
                </div>
                <a
                  href={isDemoMode ? "/debug/demo-user" : "/login"}
                  className="rounded-full bg-[var(--bb-primary)] px-5 py-2 text-sm font-semibold text-white shadow-sm transition-shadow hover:shadow-md"
                >
                  {isDemoMode ? "Choose persona" : "Sign in"}
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
            <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--bb-text-muted)] uppercase">
              Dashboards
            </p>
            <div className="h-px flex-1 bg-[var(--bb-border)]" />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {DASHBOARDS.map((d) => (
              <a
                key={d.role}
                href={d.href}
                className={`group flex flex-col rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] p-5 shadow-sm ring-4 ring-transparent transition-all hover:-translate-y-[1px] hover:shadow-md ${d.ringColor}`}
              >
                <div className="mb-3 flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${d.color} text-sm font-bold text-white shadow-sm`}
                  >
                    {d.role[0]}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--bb-secondary)] group-hover:text-[var(--bb-primary)]">
                      {d.role}
                    </h3>
                    <p className="text-[10px] text-[var(--bb-text-tertiary)]">{d.tagline}</p>
                  </div>
                </div>

                <p className="mb-4 flex-1 text-[11px] leading-relaxed text-[var(--bb-text-secondary)]">
                  {d.description}
                </p>

                <div className="flex flex-wrap gap-1.5">
                  {d.pages.map((pg) => (
                    <span
                      key={pg.label}
                      className="rounded-full bg-[var(--bb-bg-card)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--bb-text-secondary)]"
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
            <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--bb-text-muted)] uppercase">
              Getting started
            </p>
            <div className="h-px flex-1 bg-[var(--bb-border)]" />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {QUICK_STEPS.map((s) => (
              <div
                key={s.step}
                className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)]/80 p-5"
              >
                <span className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--bb-bg-card)] text-[11px] font-bold text-[var(--bb-text-tertiary)]">
                  {s.step}
                </span>
                <h3 className="mt-2 text-sm font-semibold text-[var(--bb-secondary)]">{s.title}</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-[var(--bb-text-secondary)]">
                  {s.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* Footer                                                            */}
        {/* ----------------------------------------------------------------- */}
        <footer className="flex flex-col items-center gap-2 border-t border-[var(--bb-border)] pt-6 text-center">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--bb-primary)] text-[10px] font-bold text-white">
              B
            </div>
            <span className="text-xs font-semibold text-[var(--bb-text-tertiary)]">Brandbite</span>
          </div>
          <p className="text-[10px] text-[var(--bb-text-muted)]">
            Creative subscription platform &middot; Demo environment
          </p>
        </footer>
      </div>
    </div>
  );
}
