// -----------------------------------------------------------------------------
// @file: components/dashboard/dashboard-nav.ts
// @purpose: The customer and creative shells' view over their nav configs:
//           active-item matching, breadcrumbs and the ⌘K page index.
// -----------------------------------------------------------------------------

import type { PageEntry } from "@/components/admin/v2/admin-nav";
import { getNavConfig, type NavConfig, type NavLeaf } from "@/components/navigation/nav-config";

export type DashboardRole = "customer" | "creative";

const WORKSPACE_LABELS: Record<DashboardRole, string> = {
  customer: "Customer workspace",
  creative: "Creative workspace",
};

/** Pages reachable from a dashboard that have no sidebar entry. */
const EXTRA_PAGES: Record<DashboardRole, PageEntry[]> = {
  customer: [
    { href: "/customer/tickets", section: "Workspace", label: "My requests" },
    { href: "/customer/tickets/new", section: "Workspace", label: "New request" },
  ],
  creative: [{ href: "/creative/tickets", section: "Workspace", label: "My jobs" }],
};

export function getDashboardNav(role: DashboardRole): NavConfig {
  return getNavConfig(role);
}

/** Every navigable page, for the command palette. */
export function getDashboardPageIndex(role: DashboardRole): PageEntry[] {
  const fromNav = getNavConfig(role).sections.flatMap((section) =>
    section.items.map((item) => ({
      href: item.href,
      section: section.label ?? "Workspace",
      label: item.label,
    })),
  );
  const seen = new Set<string>();
  return [...fromNav, ...EXTRA_PAGES[role]].filter(
    (page) => !seen.has(page.href) && seen.add(page.href),
  );
}

export function isDashboardLeafActive(item: NavLeaf, pathname: string, role: DashboardRole) {
  if (item.href === `/${role}`) return pathname === item.href;
  const matches = (path: string) => pathname === path || pathname.startsWith(`${path}/`);
  return matches(item.href) || (item.highlightOnPaths?.some(matches) ?? false);
}

/** Breadcrumb trail for a pathname: [workspace, page, (detail)]. */
export function getDashboardBreadcrumb(role: DashboardRole, pathname: string): string[] {
  const workspace = WORKSPACE_LABELS[role];
  if (pathname === `/${role}`) return [workspace, "Overview"];

  let best: PageEntry | null = null;
  for (const page of getDashboardPageIndex(role)) {
    if (page.href === `/${role}`) continue;
    if (pathname === page.href || pathname.startsWith(`${page.href}/`)) {
      if (!best || page.href.length > best.href.length) best = page;
    }
  }
  if (!best) return [workspace];
  return pathname === best.href ? [workspace, best.label] : [workspace, best.label, "Detail"];
}
