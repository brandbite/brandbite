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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type NavItem = {
  href: string;
  label: string;
};

type NavGroup = {
  label: string;
  children: NavItem[];
};

type NavEntry = NavItem | NavGroup;

function isNavGroup(entry: NavEntry): entry is NavGroup {
  return "children" in entry;
}

type AppNavRole = "admin" | "customer" | "creative";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const NAV_CONFIG: Record<
  AppNavRole,
  { items: NavEntry[]; brandLabel: string; roleLabel?: string }
> = {
  admin: {
    items: [
      { href: "/admin", label: "Dashboard" },
      { href: "/admin/companies", label: "Companies" },
      { href: "/admin/board", label: "Board" },
      { href: "/admin/tickets", label: "Tickets" },
      {
        label: "Catalog",
        children: [
          { href: "/admin/plans", label: "Plans" },
          { href: "/admin/job-types", label: "Job Types" },
          { href: "/admin/job-type-categories", label: "Categories" },
        ],
      },
      {
        label: "Finance",
        children: [
          { href: "/admin/payout-rules", label: "Payout Rules" },
          { href: "/admin/ledger", label: "Ledger" },
          { href: "/admin/token-analytics", label: "Analytics" },
          { href: "/admin/withdrawals", label: "Withdrawals" },
        ],
      },
      {
        label: "People",
        children: [
          { href: "/admin/creative-analytics", label: "Creatives" },
          { href: "/admin/users", label: "Users" },
        ],
      },
      {
        label: "Content",
        children: [
          { href: "/admin/pages", label: "Pages" },
          { href: "/admin/showcase", label: "Showcase" },
          { href: "/admin/blog", label: "Blog" },
          { href: "/admin/news", label: "News" },
        ],
      },
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

// ---------------------------------------------------------------------------
// Chevron icon (shared between desktop triggers)
// ---------------------------------------------------------------------------

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`ml-0.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AppNav({ role }: { role: AppNavRole }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const config = NAV_CONFIG[role];
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  const handleSignOut = async () => {
    if (isDemoMode) {
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

  /** Returns true when any child of a group is the current page */
  const isGroupActive = (group: NavGroup) => group.children.some((c) => isActive(c.href));

  // ---- Escape key closes mobile nav / desktop dropdown ----
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (openDropdown) {
        setOpenDropdown(null);
        return;
      }
      if (mobileOpen) {
        setMobileOpen(false);
        hamburgerRef.current?.focus();
      }
    },
    [mobileOpen, openDropdown],
  );

  useEffect(() => {
    if (!mobileOpen && !openDropdown) return;
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [mobileOpen, openDropdown, handleEscape]);

  // ---- Click outside closes desktop dropdown ----
  useEffect(() => {
    if (!openDropdown) return;
    const handler = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openDropdown]);

  // ---- Close dropdown on route change ----
  useEffect(() => {
    setOpenDropdown(null);
  }, [pathname]);

  // -----------------------------------------------------------------------
  // Render helpers
  // -----------------------------------------------------------------------

  /** Desktop: render a single NavItem (link or active span) */
  const renderDesktopLink = (item: NavItem) => {
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
  };

  /** Desktop: render a NavGroup dropdown */
  const renderDesktopGroup = (group: NavGroup) => {
    const isOpen = openDropdown === group.label;
    const groupActive = isGroupActive(group);

    return (
      <div key={group.label} className="relative">
        <button
          type="button"
          aria-haspopup="true"
          aria-expanded={isOpen}
          onClick={() => setOpenDropdown(isOpen ? null : group.label)}
          className={`inline-flex items-center gap-0.5 transition-colors ${
            groupActive
              ? "font-semibold text-[var(--bb-secondary)]"
              : "font-medium text-[var(--bb-text-secondary)] hover:text-[var(--bb-secondary)]"
          }`}
        >
          {group.label}
          <ChevronDown open={isOpen} />
        </button>

        {isOpen && (
          <div className="absolute top-full left-1/2 z-50 mt-2 min-w-[160px] -translate-x-1/2 rounded-xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] py-2 shadow-lg">
            {group.children.map((child) => {
              const active = isActive(child.href);
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  onClick={() => setOpenDropdown(null)}
                  className={`block px-4 py-1.5 text-sm transition-colors ${
                    active
                      ? "font-semibold text-[var(--bb-secondary)]"
                      : "font-medium text-[var(--bb-text-secondary)] hover:bg-[var(--bb-bg-warm)] hover:text-[var(--bb-secondary)]"
                  }`}
                >
                  {child.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  };

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
      <div ref={navRef} className="hidden items-center gap-6 md:flex">
        <nav className="flex items-center gap-6 text-sm text-[var(--bb-text-secondary)]">
          {config.items.map((entry) =>
            isNavGroup(entry) ? renderDesktopGroup(entry) : renderDesktopLink(entry),
          )}
        </nav>
        <ThemeToggle />
        <NotificationBell role={role} />
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
        <NotificationBell role={role} />

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
            {config.items.map((entry) => {
              if (isNavGroup(entry)) {
                return (
                  <div key={entry.label}>
                    <span className="mb-1 block text-[10px] font-semibold tracking-wider text-[var(--bb-text-muted)] uppercase">
                      {entry.label}
                    </span>
                    <div className="flex flex-col gap-2 pl-2">
                      {entry.children.map((child) => {
                        const active = isActive(child.href);
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={() => setMobileOpen(false)}
                            className={
                              active
                                ? "font-semibold text-[var(--bb-secondary)]"
                                : "font-medium text-[var(--bb-text-secondary)] hover:text-[var(--bb-secondary)]"
                            }
                          >
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              const active = isActive(entry.href);
              return (
                <Link
                  key={entry.href}
                  href={entry.href}
                  onClick={() => setMobileOpen(false)}
                  className={
                    active
                      ? "font-semibold text-[var(--bb-secondary)]"
                      : "font-medium text-[var(--bb-text-secondary)] hover:text-[var(--bb-secondary)]"
                  }
                >
                  {entry.label}
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
