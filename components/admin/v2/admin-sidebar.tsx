// -----------------------------------------------------------------------------
// @file: components/admin/v2/admin-sidebar.tsx
// @purpose: Admin sidebar for design language v1 — 224px, "Admin workspace"
//           brand lockup, collapsible section groups (persisted), withdrawal
//           badge, pinned Settings + user row + collapse toggle in the
//           footer. Collapses to a 64px icon rail; slides in as a drawer
//           below md. Customer and creative use DashboardShell.
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandLogo, BrandMark } from "@/components/ui/brand-logo";
import type { NavLeaf } from "@/components/navigation/nav-config";
import {
  IconChevronsLeft,
  IconSettings,
  IconSupport,
  IconX,
} from "@/components/navigation/nav-icons";
import { useSessionRole } from "@/lib/hooks/use-session-role";
import {
  DEFAULT_COLLAPSED_GROUPS,
  WORKSPACE_LABEL,
  getAdminSections,
  isLeafActive,
} from "./admin-nav";
import { IconChevronDown } from "./icons";
import { Avatar, UserMenu } from "./user-menu";
import type { AdminSessionUser } from "./use-admin-session";

const LS_GROUPS_KEY = "bb.admin.sidebar.collapsedGroups";

function useCollapsedGroups(): [Set<string>, (label: string) => void] {
  const [groups, setGroups] = useState<Set<string>>(() => new Set(DEFAULT_COLLAPSED_GROUPS));

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LS_GROUPS_KEY);
      if (raw) setGroups(new Set(JSON.parse(raw) as string[]));
    } catch {
      // storage disabled / bad JSON — keep defaults
    }
  }, []);

  const toggle = (label: string) =>
    setGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      try {
        window.localStorage.setItem(LS_GROUPS_KEY, JSON.stringify([...next]));
      } catch {
        // ignore
      }
      return next;
    });

  return [groups, toggle];
}

export function AdminSidebar({
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
  user,
  pendingWithdrawals,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  user: AdminSessionUser | null;
  pendingWithdrawals: number;
}) {
  const pathname = usePathname();
  const { isSiteOwner } = useSessionRole();
  const sections = getAdminSections(isSiteOwner);
  const [collapsedGroups, toggleGroup] = useCollapsedGroups();

  const badges: Record<string, number> = { "/admin/withdrawals": pendingWithdrawals };
  const settingsActive = pathname === "/admin/settings";
  const supportActive = pathname === "/admin/support" || pathname.startsWith("/admin/support/");

  return (
    <aside
      aria-label="Admin navigation"
      className={[
        "fixed top-0 left-0 z-50 flex h-full flex-col border-r border-[var(--av2-border)] bg-[var(--av2-surface)]",
        "w-[280px] transition-[transform,width] duration-200 ease-out",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
        "md:translate-x-0",
        collapsed ? "md:w-16" : "md:w-56",
      ].join(" ")}
    >
      {/* Brand */}
      <div
        className={[
          "flex h-16 shrink-0 items-center px-5",
          collapsed ? "md:justify-center md:px-2" : "",
        ].join(" ")}
      >
        <Link
          href="/admin"
          aria-label="brandbite admin home"
          className="rounded focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none"
        >
          {collapsed && (
            <span className="hidden md:block">
              <BrandMark size={32} priority className="h-7 w-7" />
            </span>
          )}
          <span className={["block", collapsed ? "md:hidden" : ""].join(" ")}>
            <BrandLogo width={120} priority className="h-7 w-auto" />
            <span className="mt-1 block text-[11px] font-medium tracking-[0.16em] text-[var(--av2-text-2)] uppercase">
              Admin workspace
            </span>
          </span>
        </Link>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation"
          className="ml-auto flex h-10 w-10 items-center justify-center rounded-lg hover:bg-[var(--av2-bg)] md:hidden"
        >
          <IconX width={18} height={18} />
        </button>
      </div>

      {/* Sections */}
      <nav className="flex-1 overflow-x-hidden overflow-y-auto px-3 pt-4 pb-3">
        <ul className="flex flex-col gap-4">
          {sections.map((section) => {
            const label = section.label!;
            const hasActive = section.items.some((i) => isLeafActive(i, pathname));
            const collapsible = label !== WORKSPACE_LABEL;
            // The group holding the current page is always shown open; the
            // icon rail has no headers, so it always lists every item.
            const open = collapsed || !collapsible || hasActive || !collapsedGroups.has(label);
            const listId = `admin-nav-${label.toLowerCase()}`;

            return (
              <li key={label}>
                {!collapsed &&
                  (collapsible ? (
                    <button
                      type="button"
                      onClick={() => toggleGroup(label)}
                      aria-expanded={open}
                      aria-controls={listId}
                      disabled={hasActive}
                      className="flex w-full items-center justify-between rounded-md px-3 py-1 text-[11px] font-semibold tracking-[0.14em] text-[var(--av2-text-2)] uppercase hover:text-[var(--av2-text)] focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none disabled:cursor-default disabled:hover:text-[var(--av2-text-2)] max-md:py-3"
                    >
                      {label}
                      <IconChevronDown
                        className={`transition-transform ${open ? "rotate-180" : ""} ${hasActive ? "opacity-0" : ""}`}
                      />
                    </button>
                  ) : (
                    <p className="px-3 py-1 text-[11px] font-semibold tracking-[0.14em] text-[var(--av2-text-2)] uppercase">
                      {label}
                    </p>
                  ))}
                {open && (
                  <ul id={listId} className="mt-1 flex flex-col gap-0.5">
                    {section.items.map((item) => (
                      <li key={item.href}>
                        <SidebarItem
                          item={item}
                          active={isLeafActive(item, pathname)}
                          collapsed={collapsed}
                          badge={badges[item.href] ?? 0}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="shrink-0 border-t border-[var(--av2-border)] px-3 py-3">
        <Link
          href="/admin/support"
          aria-current={supportActive ? "page" : undefined}
          title={collapsed ? "Support" : undefined}
          className={itemClass(supportActive, collapsed)}
        >
          <IconSupport width={20} height={20} className="shrink-0" />
          <span className={collapsed ? "md:sr-only" : ""}>Support</span>
        </Link>
        <Link
          href="/admin/settings"
          aria-current={settingsActive ? "page" : undefined}
          title={collapsed ? "Settings" : undefined}
          className={itemClass(settingsActive, collapsed)}
        >
          <IconSettings width={20} height={20} className="shrink-0" />
          <span className={collapsed ? "md:sr-only" : ""}>Settings</span>
        </Link>

        <div className="mt-1">
          <UserMenu
            user={user}
            placement="up"
            triggerLabel="Account menu"
            triggerClassName={[
              "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-[var(--av2-bg)] focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none",
              collapsed ? "md:justify-center md:px-0" : "",
            ].join(" ")}
            trigger={
              <>
                <Avatar user={user} size={36} />
                <span className={["min-w-0 flex-1", collapsed ? "md:hidden" : ""].join(" ")}>
                  <span className="block truncate text-sm font-medium">
                    {user?.roleLabel ?? " "}
                  </span>
                </span>
                <IconChevronDown className={collapsed ? "md:hidden" : ""} />
              </>
            }
          />
        </div>

        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={[
            "mt-1 hidden w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[var(--av2-text-2)] hover:bg-[var(--av2-bg)] hover:text-[var(--av2-text)] md:flex",
            collapsed ? "md:justify-center md:px-0" : "",
          ].join(" ")}
        >
          <IconChevronsLeft width={16} height={16} className={collapsed ? "rotate-180" : ""} />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}

function itemClass(active: boolean, collapsed: boolean) {
  return [
    "relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none",
    collapsed ? "md:justify-center md:px-0" : "",
    active
      ? "bg-[var(--av2-selected)] font-semibold text-[var(--av2-link)]"
      : "font-medium text-[var(--av2-text)] hover:bg-[var(--av2-bg)]",
  ].join(" ");
}

function SidebarItem({
  item,
  active,
  collapsed,
  badge,
}: {
  item: NavLeaf;
  active: boolean;
  collapsed: boolean;
  badge: number;
}) {
  const Icon = item.icon;
  const badgeLabel = badge > 0 ? `, ${badge} pending` : "";
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      aria-label={badge > 0 ? `${item.label}${badgeLabel}` : undefined}
      title={collapsed ? `${item.label}${badgeLabel}` : undefined}
      className={itemClass(active, collapsed)}
    >
      <Icon
        width={20}
        height={20}
        className={`shrink-0 ${active ? "" : "text-[var(--av2-text-2)]"}`}
      />
      <span className={["truncate", collapsed ? "md:sr-only" : ""].join(" ")}>{item.label}</span>
      {badge > 0 &&
        (collapsed ? (
          <span
            aria-hidden
            className="absolute top-2 right-3 hidden h-2 w-2 rounded-full bg-[var(--av2-accent)] md:block"
          />
        ) : (
          <span
            aria-hidden
            className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--av2-selected)] px-1.5 text-xs font-semibold text-[var(--av2-link)] tabular-nums"
          >
            {badge}
          </span>
        ))}
    </Link>
  );
}
