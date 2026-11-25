// -----------------------------------------------------------------------------
// @file: components/dashboard/dashboard-nav.ts
// @purpose: The customer and creative shells' view over their nav configs:
//           active-item matching, breadcrumbs and the ⌘K page index.
// -----------------------------------------------------------------------------

import type { PageEntry } from "@/components/admin/v2/admin-nav";
import { getNavConfig, type NavConfig, type NavLeaf } from "@/components/navigation/nav-config";
import { toolHref, toolsForRole } from "@/lib/tools/registry";

export type DashboardRole = "customer" | "creative";

const WORKSPACE_LABELS: Record<DashboardRole, string> = {
  customer: "Customer workspace",
  creative: "Creative workspace",
};

/** Pages reachable from a dashboard that have no sidebar entry. */
const EXTRA_PAGES: Record<DashboardRole, PageEntry[]> = {
  customer: [
    { href: "/customer/tickets/drafts", label: "Drafts", section: "Workspace" },
    { href: "/customer/tickets", section: "Workspace", label: "My requests" },
    { href: "/customer/tickets/new", section: "Workspace", label: "New request" },
    { href: "/customer/profile", section: "Account", label: "Profile" },
    { href: "/customer/members", section: "Account", label: "Members" },
    { href: "/customer/faq", section: "Account", label: "FAQ" },
  ],
  creative: [
    { href: "/creative/tickets", section: "Workspace", label: "My requests" },
    { href: "/creative/profile", section: "Account", label: "Profile" },
    { href: "/creative/faq", section: "Account", label: "FAQ" },
  ],
};

export function getDashboardNav(role: DashboardRole): NavConfig {
  return getNavConfig(role);
}

/** Every navigable page, for the command palette. */
export function getDashboardPageIndex(role: DashboardRole): PageEntry[] {
  const nav = getNavConfig(role);
  const fromNav = [
    ...nav.sections.flatMap((section) =>
      section.items.map((item) => ({
        href: item.href,
        section: section.label ?? "Workspace",
        label: item.label,
      })),
    ),
    ...(nav.footerItems ?? []).map((item) => ({
      href: item.href,
      section: "Account",
      label: item.label,
    })),
  ];
  // Every built hub tool is a page too, pinned to the sidebar or not.
  const tools = toolsForRole(role).flatMap((tool) => {
    const href = toolHref(tool, role);
    return href ? [{ href, section: "Tools", label: tool.name }] : [];
  });
  const seen = new Set<string>();
  return [...fromNav, ...EXTRA_PAGES[role], ...tools].filter(
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
  if (pathname === `/${role}`) {
    const home = getNavConfig(role)
      .sections.flatMap((section) => section.items)
      .find((item) => item.href === pathname);
    return [workspace, home?.label ?? "Home"];
  }

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
