// -----------------------------------------------------------------------------
// @file: components/admin/v2/admin-nav.ts
// @purpose: Admin-shell view over ADMIN_NAV (design language v1): visible
//           sidebar sections, the pinned bottom links, a flat page index for
//           the command palette, and breadcrumb resolution — including the
//           admin routes that are reachable but not in the sidebar.
// -----------------------------------------------------------------------------

import { ADMIN_NAV, type NavLeaf, type NavSection } from "@/components/navigation/nav-config";

/** Links pinned to the sidebar footer / user menu instead of the section list. */
export const PINNED_HREFS = new Set(["/admin/settings", "/admin/profile"]);

export const WORKSPACE_LABEL = "Workspace";

/** Sidebar sections with the first (unlabelled) one named and pinned links removed. */
export function getAdminSections(isSiteOwner: boolean): NavSection[] {
  return ADMIN_NAV.sections
    .map((s) => ({
      label: s.label ?? WORKSPACE_LABEL,
      items: s.items.filter((i) => !PINNED_HREFS.has(i.href) && (!i.ownerOnly || isSiteOwner)),
    }))
    .filter((s) => s.items.length > 0);
}

/** Groups collapsed on first visit (the design shows these folded). */
export const DEFAULT_COLLAPSED_GROUPS = ["Catalog", "Content", "System"];

/** Admin routes that exist but have no sidebar entry. [path, section, label] */
const EXTRA_PAGES: [string, string, string][] = [
  ["/admin/tickets", WORKSPACE_LABEL, "Tickets"],
  ["/admin/completed-jobs", "Finance", "Completed jobs"],
  ["/admin/consultations/settings", WORKSPACE_LABEL, "Consultation settings"],
  ["/admin/plan-assignment", "Catalog", "Plan assignment"],
  ["/admin/profile", "Account", "Profile"],
  ["/admin/settings", "System", "Settings"],
];

export type PageEntry = { href: string; section: string; label: string };

/** Every navigable admin page, for the command palette. */
export function getAdminPageIndex(isSiteOwner: boolean): PageEntry[] {
  const fromNav = getAdminSections(isSiteOwner).flatMap((s) =>
    s.items.map((i) => ({ href: i.href, section: s.label!, label: i.label })),
  );
  const extras = EXTRA_PAGES.map(([href, section, label]) => ({ href, section, label }));
  const seen = new Set<string>();
  return [...fromNav, ...extras].filter((p) => !seen.has(p.href) && seen.add(p.href));
}

export function isLeafActive(item: NavLeaf, pathname: string): boolean {
  if (item.href === "/admin") return pathname === "/admin";
  const match = (p: string) => pathname === p || pathname.startsWith(p + "/");
  return match(item.href) || (item.highlightOnPaths?.some(match) ?? false);
}

/**
 * Breadcrumb trail for a pathname: [section, page, (detail)].
 * Longest matching known path wins, so /admin/consultations/settings
 * resolves to its own entry rather than to Consultations.
 */
export function getBreadcrumb(pathname: string): string[] {
  if (pathname === "/admin") return [WORKSPACE_LABEL, "Overview"];

  const candidates = getAdminPageIndex(true);
  let best: PageEntry | null = null;
  for (const p of candidates) {
    if (p.href === "/admin") continue;
    if (pathname === p.href || pathname.startsWith(p.href + "/")) {
      if (!best || p.href.length > best.href.length) best = p;
    }
  }
  if (!best) return [WORKSPACE_LABEL];

  const trail = [best.section, best.label];
  if (pathname !== best.href) trail.push("Detail");
  return trail;
}
