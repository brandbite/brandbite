// -----------------------------------------------------------------------------
// @file: components/navigation/app-sidebar.tsx
// @purpose: Unified fixed-left sidebar navigation for admin, customer, and
//           creative dashboards. Collapses to an icon rail on tablet widths
//           (and via a manual toggle on desktop); slides in from the left as
//           a drawer on mobile.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-04-20
// -----------------------------------------------------------------------------

"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { NotificationBell } from "@/components/ui/notification-bell";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useSessionRole } from "@/lib/hooks/use-session-role";
import { getNavConfig, type NavConfig, type NavLeaf, type NavRole } from "./nav-config";
import { IconChevronsLeft, IconLogout, IconMenu, IconX } from "./nav-icons";

const LS_COLLAPSED_KEY = "bb.sidebar.collapsed";
const EXPANDED_WIDTH = "240px";
const COLLAPSED_WIDTH = "64px";
const SIDEBAR_WIDTH_VAR = "--bb-sidebar-w";

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Persist the sidebar collapsed state across reloads and write the current
 * width to a CSS variable on the documentElement so content areas can
 * reserve matching left padding without prop-drilling.
 *
 * The initial render is always "expanded" to avoid a hydration mismatch; we
 * sync from localStorage on mount.
 */
function usePersistedCollapse(): [boolean, (next: boolean) => void] {
  const [collapsed, setCollapsed] = useState(false);

  // Initial sync from localStorage
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LS_COLLAPSED_KEY);
      if (raw === "1") setCollapsed(true);
    } catch {
      // private-mode / storage-disabled — fall back to default
    }
  }, []);

  // Keep the CSS var in sync with whatever state we end up in
  useEffect(() => {
    const width = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;
    document.documentElement.style.setProperty(SIDEBAR_WIDTH_VAR, width);
    return () => {
      // Don't clean up on unmount — nav is always present on dashboard
      // routes, and if it ever unmounts the default via the fallback in
      // layouts still applies.
    };
  }, [collapsed]);

  const set = useCallback((next: boolean) => {
    setCollapsed(next);
    try {
      window.localStorage.setItem(LS_COLLAPSED_KEY, next ? "1" : "0");
    } catch {
      // ignore
    }
  }, []);

  return [collapsed, set];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AppSidebar({ role }: { role: NavRole }) {
  const pathname = usePathname();
  const router = useRouter();
  const rawConfig = getNavConfig(role);
  const { isSiteOwner } = useSessionRole();

  // Owner-gated items. Hide them until we know the role; filter them out for
  // SITE_ADMIN and below. Server-side guards on the routes themselves remain
  // the real security boundary — this is purely UX hygiene.
  const config: NavConfig = {
    ...rawConfig,
    sections: rawConfig.sections.map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.ownerOnly || isSiteOwner),
    })),
  };

  const [collapsed, setCollapsed] = usePersistedCollapse();
  const [mobileOpen, setMobileOpen] = useState(false);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  const handleSignOut = async () => {
    if (isDemoMode) {
      router.push("/debug/demo-user");
      return;
    }
    await authClient.signOut();
    router.push("/login");
  };

  // ---- Close mobile drawer on route change + on Escape -------------------
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
        hamburgerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  // ---- Prevent body scroll while drawer is open --------------------------
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <>
      {/* Mobile topbar (brand + hamburger) */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--bb-border-subtle)] bg-[var(--bb-bg-page)]/95 px-4 py-2.5 backdrop-blur-sm md:hidden">
        <Link
          href={config.homeHref}
          className="flex items-center gap-1.5"
          aria-label={`${config.brand} home`}
        >
          <Image
            src="/brandbite-logo.svg"
            alt="Brandbite"
            width={120}
            height={30}
            priority
            className="h-6 w-auto"
          />
          {config.roleLabel && (
            <span className="font-brand text-sm font-light tracking-tight text-[var(--bb-text-muted)]">
              · {config.roleLabel}
            </span>
          )}
        </Link>
        <button
          ref={hamburgerRef}
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
          aria-expanded={mobileOpen}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--bb-secondary)] hover:bg-[var(--bb-bg-warm)]"
        >
          <IconMenu width={20} height={20} />
        </button>
      </div>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — fixed on md+, drawer on mobile. We intentionally do NOT
          set overflow-x-hidden on the aside because the notification popup
          is absolutely positioned and extends past the sidebar's right
          edge into the main content area; clipping here would hide it.
          The compact collapsed logo (below) + nav-level overflow-x-hidden
          (further down) cover the horizontal-overflow cases. */}
      <aside
        aria-label="Primary navigation"
        className={[
          "fixed top-0 left-0 z-50 flex h-full flex-col border-r border-[var(--bb-border)] bg-[var(--bb-bg-page)]",
          // Mobile drawer
          "w-[280px] transition-transform duration-200 ease-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          // Desktop: always visible, width based on collapsed state
          "md:translate-x-0",
          collapsed ? "md:w-[64px]" : "md:w-[240px]",
        ].join(" ")}
      >
        {/* Brand header */}
        <div
          className={[
            "flex items-center border-b border-[var(--bb-border-subtle)] px-3 py-3",
            collapsed ? "md:justify-center md:px-2" : "md:px-4",
          ].join(" ")}
        >
          <Link
            href={config.homeHref}
            className="flex min-w-0 items-center gap-1.5 outline-none focus-visible:ring-2 focus-visible:ring-[var(--bb-primary)]"
            aria-label={`${config.brand} home`}
          >
            {/*
              Collapsed rail is only 64px wide; the full brandbite-logo.svg
              at h-7 is ~112px wide and would overflow. We swap to the
              compact b-favicon mark in collapsed mode so the logo fills
              the rail sensibly and no horizontal scroll can appear.
            */}
            {collapsed ? (
              <Image
                src="/b-favicon.svg"
                alt="Brandbite"
                width={32}
                height={32}
                priority
                className="hidden h-7 w-7 shrink-0 md:block"
              />
            ) : null}
            <Image
              src="/brandbite-logo.svg"
              alt="Brandbite"
              width={120}
              height={30}
              priority
              className={[
                "h-7 w-auto shrink-0",
                // On md+ screens, hide the full logo when collapsed (the
                // compact mark above takes its place). On mobile drawer
                // we always show the full logo.
                collapsed ? "md:hidden" : "",
              ].join(" ")}
            />
            {!collapsed && config.roleLabel && (
              <span className="font-brand truncate text-base font-light tracking-tight text-[var(--bb-text-muted)]">
                · {config.roleLabel}
              </span>
            )}
          </Link>

          {/* Mobile close */}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-[var(--bb-secondary)] hover:bg-[var(--bb-bg-warm)] md:hidden"
          >
            <IconX width={18} height={18} />
          </button>
        </div>

        {/* Sections — overflow-x-hidden stops the collapsed 64px rail from
            picking up a horizontal scrollbar if any child ever extends
            beyond its content box. overflow-y-auto alone lets the browser
            auto-promote overflow-x to auto in that case. */}
        <nav className="flex-1 overflow-x-hidden overflow-y-auto px-2 py-3">
          <ul className="flex flex-col gap-4">
            {config.sections.map((section, sectionIdx) => (
              <li key={`${section.label ?? "main"}-${sectionIdx}`}>
                {section.label && !collapsed && (
                  <p className="mb-1.5 px-2 text-[10px] font-semibold tracking-[0.15em] text-[var(--bb-text-muted)] uppercase">
                    {section.label}
                  </p>
                )}
                <ul className="flex flex-col gap-0.5">
                  {section.items.map((item) => (
                    <li key={item.href}>
                      <SidebarLink
                        item={item}
                        pathname={pathname}
                        collapsed={collapsed}
                        onNavigate={() => setMobileOpen(false)}
                      />
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </nav>

        {/* Bottom rail */}
        <div className="border-t border-[var(--bb-border-subtle)] px-2 py-2">
          {/* Row 1 — notifications + sign out. Always visible. */}
          <div
            className={[
              "flex items-center gap-1",
              collapsed ? "md:flex-col md:items-stretch md:gap-0.5" : "",
            ].join(" ")}
          >
            <div
              className="flex items-center justify-center rounded-lg p-1 text-[var(--bb-text-secondary)]"
              title="Notifications"
            >
              {/* `top-right` placement: the bell lives in the bottom-left
                  corner of the fixed sidebar, so the panel needs to open
                  upward and align to the bell's left edge — otherwise it
                  disappears off-screen to the left (collapsed rail) or
                  below the viewport (short screens). */}
              <NotificationBell role={role} placement="top-right" />
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              title={isDemoMode ? "Switch persona" : "Sign out"}
              className={[
                "flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium text-[var(--bb-text-secondary)] hover:bg-[var(--bb-bg-warm)] hover:text-[var(--bb-secondary)]",
                collapsed ? "md:justify-center" : "ml-auto",
              ].join(" ")}
            >
              <IconLogout width={16} height={16} />
              {!collapsed && <span>{isDemoMode ? "Switch" : "Sign out"}</span>}
            </button>
          </div>

          {/* Row 2 — theme toggle (hidden when collapsed; too wide for the rail) */}
          {!collapsed && (
            <div className="mt-1 flex items-center justify-center px-1 py-1">
              <ThemeToggle />
            </div>
          )}

          {/* Collapse toggle (desktop only) */}
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={[
              "mt-1 hidden w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] font-medium text-[var(--bb-text-muted)] hover:bg-[var(--bb-bg-warm)] hover:text-[var(--bb-text-secondary)] md:flex",
              collapsed ? "md:justify-center" : "",
            ].join(" ")}
          >
            <IconChevronsLeft width={14} height={14} className={collapsed ? "rotate-180" : ""} />
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>
    </>
  );
}

// ---------------------------------------------------------------------------
// Subcomponent: a single nav leaf link
// ---------------------------------------------------------------------------

function SidebarLink({
  item,
  pathname,
  collapsed,
  onNavigate,
}: {
  item: NavLeaf;
  pathname: string;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const Icon = item.icon;

  const isActive = (() => {
    // Role-home routes (/admin, /customer, /creative) only match on exact
    // pathname — otherwise the Dashboard/Overview link would highlight on
    // every page within the role.
    const isRoleHome =
      item.href === "/admin" || item.href === "/customer" || item.href === "/creative";
    if (isRoleHome) {
      if (pathname === item.href) return true;
    } else {
      if (pathname === item.href) return true;
      if (pathname.startsWith(item.href + "/")) return true;
    }
    return (
      item.highlightOnPaths?.some((p) => pathname === p || pathname.startsWith(p + "/")) ?? false
    );
  })();

  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={[
        "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
        collapsed ? "md:justify-center md:px-2" : "",
        isActive
          ? "bg-[var(--bb-primary)]/10 font-semibold text-[var(--bb-primary)]"
          : "font-medium text-[var(--bb-text-secondary)] hover:bg-[var(--bb-bg-warm)] hover:text-[var(--bb-secondary)]",
      ].join(" ")}
    >
      <Icon
        width={17}
        height={17}
        className={[
          "shrink-0",
          isActive ? "text-[var(--bb-primary)]" : "text-[var(--bb-text-tertiary)]",
        ].join(" ")}
      />
      <span className={["truncate", collapsed ? "md:sr-only" : ""].join(" ")}>{item.label}</span>
      {/* Collapsed-mode label: the native `title` attribute set above
          handles hover tooltips. We intentionally don't render a custom
          tooltip here — absolutely-positioned descendants extending past
          the 64px rail would trigger a horizontal scrollbar on the parent
          nav (which has overflow-y-auto). */}
    </Link>
  );
}
