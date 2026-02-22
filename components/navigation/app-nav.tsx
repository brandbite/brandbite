// -----------------------------------------------------------------------------
// @file: components/navigation/app-nav.tsx
// @purpose: Unified navigation for all roles — admin, customer, creative
// -----------------------------------------------------------------------------

"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { NotificationBell } from "@/components/ui/notification-bell";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { authClient } from "@/lib/auth-client";

type NavItem = {
  href: string;
  label: string;
};

type AppNavRole = "admin" | "customer" | "creative";

const NAV_CONFIG: Record<AppNavRole, { items: NavItem[]; brandLabel: string; roleLabel?: string }> =
  {
    admin: {
      items: [
        { href: "/admin", label: "Dashboard" },
        { href: "/admin/companies", label: "Companies" },
        { href: "/admin/board", label: "Board" },
        { href: "/admin/tickets", label: "Tickets" },
        { href: "/admin/plans", label: "Plans" },
        { href: "/admin/job-types", label: "Job Types" },
        { href: "/admin/job-type-categories", label: "Categories" },
        { href: "/admin/payout-rules", label: "Payout Rules" },
        { href: "/admin/ledger", label: "Ledger" },
        { href: "/admin/token-analytics", label: "Analytics" },
        { href: "/admin/creative-analytics", label: "Creatives" },
        { href: "/admin/users", label: "Users" },
        { href: "/admin/withdrawals", label: "Withdrawals" },
        { href: "/admin/settings", label: "Settings" },
      ],
      brandLabel: "Brandbite",
      roleLabel: "Admin",
    },
    customer: {
      items: [
        { href: "/customer", label: "Overview" },
        { href: "/customer/services", label: "Services" },
        { href: "/customer/tokens", label: "Tokens" },
        { href: "/customer/board", label: "Board" },
        { href: "/customer/tickets", label: "Tickets" },
        { href: "/customer/members", label: "Members" },
        { href: "/customer/settings", label: "Settings" },
      ],
      brandLabel: "Brandbite",
    },
    creative: {
      items: [
        { href: "/creative", label: "Overview" },
        { href: "/creative/board", label: "Board" },
        { href: "/creative/tickets", label: "Tickets" },
        { href: "/creative/balance", label: "Balance" },
        { href: "/creative/withdrawals", label: "Withdrawals" },
        { href: "/creative/settings", label: "Settings" },
      ],
      brandLabel: "Brandbite \u00b7 Creative",
    },
  };

export function AppNav({ role }: { role: AppNavRole }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const config = NAV_CONFIG[role];
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  const handleSignOut = async () => {
    if (isDemoMode) {
      // In demo mode, redirect to persona picker
      router.push("/debug/demo-user");
      return;
    }
    await authClient.signOut();
    router.push("/login");
  };

  const isActive = (href: string) => {
    if (href === `/${role}`) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  };

  // Escape key closes mobile nav and restores focus
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileOpen) {
        setMobileOpen(false);
        hamburgerRef.current?.focus();
      }
    },
    [mobileOpen],
  );

  useEffect(() => {
    if (!mobileOpen) return;
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [mobileOpen, handleEscape]);

  return (
    <header className="relative mb-6 flex items-center justify-between">
      {/* Logo + brand */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <Image
            src="/brandbite-logo.svg"
            alt="Brandbite"
            width={140}
            height={35}
            priority
            className="h-7 w-auto"
          />
          {config.roleLabel && (
            <span className="font-brand text-lg font-light tracking-tight text-[var(--bb-text-muted)]">
              · {config.roleLabel}
            </span>
          )}
        </div>
      </div>

      {/* Desktop nav */}
      <div className="hidden items-center gap-6 md:flex">
        <nav className="flex items-center gap-6 text-sm text-[var(--bb-text-secondary)]">
          {config.items.map((item) => {
            const active = isActive(item.href);
            if (active) {
              return (
                <span
                  key={item.href}
                  aria-current="page"
                  className="font-semibold text-[var(--bb-secondary)]"
                >
                  {item.label}
                </span>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className="font-medium text-[var(--bb-text-secondary)] hover:text-[var(--bb-secondary)]"
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <ThemeToggle />
        {(role === "customer" || role === "creative") && <NotificationBell role={role} />}
        <button
          onClick={handleSignOut}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--bb-text-secondary)] transition-colors hover:bg-[var(--bb-bg-page)] hover:text-[var(--bb-secondary)]"
        >
          {isDemoMode ? "Switch" : "Sign out"}
        </button>
      </div>

      {/* Mobile: notification bell + hamburger */}
      <div className="flex items-center gap-2 md:hidden">
        <ThemeToggle />
        {(role === "customer" || role === "creative") && <NotificationBell role={role} />}

        {/* Mobile hamburger */}
        <button
          ref={hamburgerRef}
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex h-8 w-8 flex-col items-center justify-center gap-1"
          aria-label="Toggle navigation"
          aria-expanded={mobileOpen}
        >
          <span
            className={`block h-0.5 w-5 rounded-full bg-[var(--bb-secondary)] transition-transform duration-200 ${
              mobileOpen ? "translate-y-[6px] rotate-45" : ""
            }`}
          />
          <span
            className={`block h-0.5 w-5 rounded-full bg-[var(--bb-secondary)] transition-opacity duration-200 ${
              mobileOpen ? "opacity-0" : ""
            }`}
          />
          <span
            className={`block h-0.5 w-5 rounded-full bg-[var(--bb-secondary)] transition-transform duration-200 ${
              mobileOpen ? "-translate-y-[6px] -rotate-45" : ""
            }`}
          />
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <nav className="absolute top-full right-0 left-0 z-50 mt-2 rounded-xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-4 shadow-lg md:hidden">
          <div className="flex flex-col gap-3 text-sm">
            {config.items.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={
                    active
                      ? "font-semibold text-[var(--bb-secondary)]"
                      : "font-medium text-[var(--bb-text-secondary)] hover:text-[var(--bb-secondary)]"
                  }
                >
                  {item.label}
                </Link>
              );
            })}
            <div className="mt-2 border-t border-[var(--bb-border-subtle)] pt-3">
              <button
                onClick={() => {
                  setMobileOpen(false);
                  handleSignOut();
                }}
                className="text-sm font-medium text-[var(--bb-text-secondary)] hover:text-[var(--bb-secondary)]"
              >
                {isDemoMode ? "Switch persona" : "Sign out"}
              </button>
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
