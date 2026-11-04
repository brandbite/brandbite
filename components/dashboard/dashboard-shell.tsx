// -----------------------------------------------------------------------------
// @file: components/dashboard/dashboard-shell.tsx
// @purpose: Customer and creative chrome on the admin design language: a 224px
//           sidebar (icon rail when collapsed, drawer on mobile) and a 64px top bar
//           with breadcrumb, ⌘K page search, help, notifications and account menu.
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useCallback, useEffect, useState, type ReactNode } from "react";

import { CommandPalette } from "@/components/admin/v2/command-palette";
import { IconChevronDown, IconSearch } from "@/components/admin/v2/icons";
import { UnsavedChangesProvider } from "@/components/admin/v2/unsaved-changes";
import { useAdminSession } from "@/components/admin/v2/use-admin-session";
import { Avatar, UserMenu } from "@/components/admin/v2/user-menu";
import { IconChevronsLeft, IconMenu, IconX } from "@/components/navigation/nav-icons";
import { PageHelpLink } from "@/components/support/page-help-link";
import { BrandLogo, BrandMark } from "@/components/ui/brand-logo";
import { NotificationBell } from "@/components/ui/notification-bell";

import {
  getDashboardBreadcrumb,
  getDashboardNav,
  getDashboardPageIndex,
  isDashboardLeafActive,
  type DashboardRole,
} from "./dashboard-nav";

const LS_COLLAPSED_KEY = "bb.sidebar.collapsed";
const EXPANDED_WIDTH = "224px";
const COLLAPSED_WIDTH = "64px";

const FOCUS =
  "focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none";

function usePersistedCollapse(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(LS_COLLAPSED_KEY) === "1") setCollapsed(true);
    } catch {
      // Storage disabled: stay expanded.
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
        // Storage disabled: it just won't be remembered.
      }
      return next;
    });
  }, []);

  return [collapsed, toggle];
}

function itemClass(active: boolean, collapsed: boolean) {
  return [
    "relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
    FOCUS,
    collapsed ? "md:justify-center md:px-0" : "",
    active
      ? "bg-[var(--av2-selected)] font-semibold text-[var(--av2-link)]"
      : "font-medium text-[var(--av2-text)] hover:bg-[var(--av2-bg)]",
  ].join(" ");
}

export function DashboardShell({ role, children }: { role: DashboardRole; children: ReactNode }) {
  const pathname = usePathname();
  const user = useAdminSession();
  const [collapsed, toggleCollapsed] = usePersistedCollapse();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const nav = getDashboardNav(role);
  const crumbs = getDashboardBreadcrumb(role, pathname);
  const menuHrefs = { profileHref: `/${role}/profile`, settingsHref: `/${role}/settings` };

  useEffect(() => setMobileOpen(false), [pathname]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setMobileOpen(false);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <UnsavedChangesProvider>
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside
        aria-label="Primary navigation"
        className={[
          "fixed top-0 left-0 z-50 flex h-full flex-col border-r border-[var(--av2-border)] bg-[var(--av2-surface)]",
          "w-[280px] transition-[transform,width] duration-200 ease-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "md:translate-x-0",
          collapsed ? "md:w-16" : "md:w-56",
        ].join(" ")}
      >
        <div
          className={[
            "flex h-16 shrink-0 items-center px-5",
            collapsed ? "md:justify-center md:px-2" : "",
          ].join(" ")}
        >
          <Link href={nav.homeHref} aria-label="Brandbite home" className={`rounded ${FOCUS}`}>
            {collapsed ? (
              <span className="hidden md:block">
                <BrandMark size={32} priority className="h-7 w-7" />
              </span>
            ) : null}
            <span className={collapsed ? "block md:hidden" : "block"}>
              <BrandLogo width={120} priority className="h-7 w-auto" />
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg hover:bg-[var(--av2-bg)] md:hidden"
          >
            <IconX width={18} height={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-x-hidden overflow-y-auto px-3 pt-4 pb-3">
          <ul className="flex flex-col gap-4">
            {nav.sections.map((section, index) => (
              <li key={section.label ?? index}>
                {section.label && !collapsed ? (
                  <p className="px-3 py-1 text-[11px] font-semibold tracking-[0.14em] text-[var(--av2-text-2)] uppercase">
                    {section.label}
                  </p>
                ) : null}
                <ul className="mt-1 flex flex-col gap-0.5">
                  {section.items.map((item) => {
                    const active = isDashboardLeafActive(item, pathname, role);
                    const Icon = item.icon;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          title={collapsed ? item.label : undefined}
                          className={itemClass(active, collapsed)}
                        >
                          <Icon
                            width={20}
                            height={20}
                            className={`shrink-0 ${active ? "" : "text-[var(--av2-text-2)]"}`}
                          />
                          <span className={`truncate ${collapsed ? "md:sr-only" : ""}`}>
                            {item.label}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </nav>

        <div className="shrink-0 border-t border-[var(--av2-border)] px-3 py-3">
          <UserMenu
            user={user}
            placement="up"
            triggerLabel="Account menu"
            {...menuHrefs}
            triggerClassName={[
              "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-[var(--av2-bg)]",
              FOCUS,
              collapsed ? "md:justify-center md:px-0" : "",
            ].join(" ")}
            trigger={
              <>
                <Avatar user={user} size={36} />
                <span className={`min-w-0 flex-1 ${collapsed ? "md:hidden" : ""}`}>
                  <span className="block truncate text-sm font-medium">{user?.name ?? " "}</span>
                </span>
                <IconChevronDown className={collapsed ? "md:hidden" : ""} />
              </>
            }
          />
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={[
              "mt-1 hidden w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[var(--av2-text-2)] hover:bg-[var(--av2-bg)] hover:text-[var(--av2-text)] md:flex",
              collapsed ? "md:justify-center md:px-0" : "",
            ].join(" ")}
          >
            <IconChevronsLeft width={16} height={16} className={collapsed ? "rotate-180" : ""} />
            {collapsed ? null : <span>Collapse</span>}
          </button>
        </div>
      </aside>

      <div className="md:pl-[var(--bb-sidebar-w,224px)] md:transition-[padding] md:duration-200">
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
          <Link href={nav.homeHref} aria-label="Brandbite home" className="md:hidden">
            <BrandLogo width={110} priority className="h-6 w-auto" />
          </Link>

          <nav aria-label="Breadcrumb" className="hidden min-w-0 md:block">
            <ol className="flex items-center gap-2 text-sm">
              {crumbs.map((crumb, index) => {
                const last = index === crumbs.length - 1;
                return (
                  <Fragment key={`${crumb}-${index}`}>
                    {index > 0 ? (
                      <li aria-hidden className="text-[var(--av2-text-2)]">
                        /
                      </li>
                    ) : null}
                    <li
                      aria-current={last ? "page" : undefined}
                      className={
                        last
                          ? "truncate font-medium text-[var(--av2-text)]"
                          : index === 0
                            ? "text-xs font-medium tracking-[0.12em] whitespace-nowrap text-[var(--av2-text-2)] uppercase"
                            : "text-[var(--av2-text-2)]"
                      }
                    >
                      {crumb}
                    </li>
                  </Fragment>
                );
              })}
            </ol>
          </nav>

          <div className="ml-auto flex items-center gap-2 md:gap-4">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label="Search workspace"
              aria-keyshortcuts={isMac ? "Meta+K" : "Control+K"}
              className={`flex h-10 items-center gap-3 rounded-lg border border-[var(--av2-border)] bg-[var(--av2-surface)] px-3 text-sm text-[var(--av2-text-2)] hover:border-[var(--av2-text-2)] md:w-64 ${FOCUS}`}
            >
              <IconSearch width={18} height={18} />
              <span className="hidden md:inline">Search workspace</span>
              <kbd className="ml-auto hidden rounded border border-[var(--av2-border)] px-1.5 py-0.5 font-sans text-xs md:inline">
                {isMac ? "⌘K" : "Ctrl K"}
              </kbd>
            </button>

            <PageHelpLink
              role={role}
              iconSize={20}
              className={`flex h-10 w-10 items-center justify-center rounded-lg text-[var(--av2-text)] hover:bg-[var(--av2-surface)] ${FOCUS}`}
            />

            <div className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--av2-text)]">
              <NotificationBell role={role} placement="bottom-right" />
            </div>

            <UserMenu
              user={user}
              placement="down"
              triggerLabel="Account menu"
              {...menuHrefs}
              triggerClassName={`rounded-full focus-visible:ring-offset-2 ${FOCUS}`}
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
        pages={getDashboardPageIndex(role)}
      />
    </UnsavedChangesProvider>
  );
}
