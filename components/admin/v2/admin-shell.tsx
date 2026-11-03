// -----------------------------------------------------------------------------
// @file: components/admin/v2/admin-shell.tsx
// @purpose: Admin chrome for design language v1 — sidebar + 64px top bar
//           (breadcrumb, ⌘K page search, notifications, account menu)
//           around the page content. Owns the shared shell state: rail
//           collapse (persisted, mirrored to --bb-sidebar-w), mobile
//           drawer, palette, and the pending-withdrawals badge count.
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useCallback, useEffect, useState, type ReactNode } from "react";
import { BrandLogo } from "@/components/ui/brand-logo";
import { NotificationBell } from "@/components/ui/notification-bell";
import { IconMenu } from "@/components/navigation/nav-icons";
import { PageHelpLink } from "@/components/support/page-help-link";
import { useSessionRole } from "@/lib/hooks/use-session-role";
import { getAdminPageIndex, getBreadcrumb } from "./admin-nav";
import { AdminSidebar } from "./admin-sidebar";
import { CommandPalette } from "./command-palette";
import { IconSearch } from "./icons";
import { useAdminSession } from "./use-admin-session";
import { UnsavedChangesProvider } from "./unsaved-changes";
import { Avatar, UserMenu } from "./user-menu";

const LS_COLLAPSED_KEY = "bb.sidebar.collapsed";
const EXPANDED_WIDTH = "224px";
const COLLAPSED_WIDTH = "64px";

function usePersistedCollapse(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(LS_COLLAPSED_KEY) === "1") setCollapsed(true);
    } catch {
      // storage disabled — default expanded
    }
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--bb-sidebar-w",
      collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH,
    );
  }, [collapsed]);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(LS_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  return [collapsed, toggle];
}

/** Pending creative withdrawals, for the sidebar badge. Refreshed on navigation. */
function usePendingWithdrawals(pathname: string): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let alive = true;
    fetch("/api/admin/withdrawals", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive && typeof j?.stats?.pendingCount === "number") setCount(j.stats.pendingCount);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // Re-check when leaving / entering pages so approvals clear the badge.
  }, [pathname]);
  return count;
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { isSiteOwner } = useSessionRole();
  const user = useAdminSession();
  const [collapsed, toggleCollapsed] = usePersistedCollapse();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const pendingWithdrawals = usePendingWithdrawals(pathname);
  const crumbs = getBreadcrumb(pathname);

  useEffect(() => setMobileOpen(false), [pathname]);

  // ⌘K / Ctrl+K opens the page search from anywhere in admin.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <UnsavedChangesProvider>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <AdminSidebar
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        user={user}
        pendingWithdrawals={pendingWithdrawals}
      />

      <div className="md:pl-[var(--bb-sidebar-w,224px)] md:transition-[padding] md:duration-200">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-[var(--av2-border)] bg-[var(--av2-bg)]/90 px-4 backdrop-blur-sm md:px-8">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
            className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-[var(--av2-surface)] md:hidden"
          >
            <IconMenu width={20} height={20} />
          </button>
          <Link href="/admin" aria-label="Brandbite admin home" className="md:hidden">
            <BrandLogo width={110} priority className="h-6 w-auto" />
          </Link>

          <nav aria-label="Breadcrumb" className="hidden min-w-0 md:block">
            <ol className="flex items-center gap-2 text-sm">
              {crumbs.map((c, i) => (
                <Fragment key={`${c}-${i}`}>
                  {i > 0 && (
                    <li aria-hidden className="text-[var(--av2-text-2)]">
                      /
                    </li>
                  )}
                  <li
                    aria-current={i === crumbs.length - 1 ? "page" : undefined}
                    className={
                      i === crumbs.length - 1
                        ? "truncate font-medium text-[var(--av2-text)]"
                        : "text-[var(--av2-text-2)]"
                    }
                  >
                    {c}
                  </li>
                </Fragment>
              ))}
            </ol>
          </nav>

          <div className="ml-auto flex items-center gap-2 md:gap-4">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label="Search workspace"
              aria-keyshortcuts={isMac ? "Meta+K" : "Control+K"}
              className="flex h-10 items-center gap-3 rounded-lg border border-[var(--av2-border)] bg-[var(--av2-surface)] px-3 text-sm text-[var(--av2-text-2)] hover:border-[var(--av2-text-2)] focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none md:w-64"
            >
              <IconSearch width={18} height={18} />
              <span className="hidden md:inline">Search workspace</span>
              <kbd className="ml-auto hidden rounded border border-[var(--av2-border)] px-1.5 py-0.5 font-sans text-xs md:inline">
                {isMac ? "⌘K" : "Ctrl K"}
              </kbd>
            </button>

            <PageHelpLink
              role="admin"
              iconSize={20}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--av2-text)] hover:bg-[var(--av2-surface)] focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none"
            />

            <div className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--av2-text)]">
              <NotificationBell role="admin" placement="bottom-right" />
            </div>

            <UserMenu
              user={user}
              placement="down"
              triggerLabel="Account menu"
              triggerClassName="rounded-full focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:ring-offset-2 focus-visible:outline-none"
              trigger={<Avatar user={user} size={40} />}
            />
          </div>
        </header>

        <main id="main-content" className="px-4 py-6 md:p-8">
          {children}
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        pages={getAdminPageIndex(isSiteOwner)}
      />
    </UnsavedChangesProvider>
  );
}
