// -----------------------------------------------------------------------------
// @file: lib/support/index.ts
// @purpose: Lookup helpers for the in-dashboard Support guides — list by role,
//           find by slug, resolve the guide for the current page ("?" link)
//           and plain-text search. Pure functions; safe on server and client.
// -----------------------------------------------------------------------------

import { ADMIN_GUIDES } from "./guides/admin";
import { CREATIVE_GUIDES } from "./guides/creative";
import { CUSTOMER_GUIDES } from "./guides/customer";
import type { GuideBlock, SupportGuide, SupportRole } from "./types";

export type { GuideBlock, GuideSection, SupportGuide, SupportRole } from "./types";

const GUIDES: Record<SupportRole, SupportGuide[]> = {
  customer: CUSTOMER_GUIDES,
  creative: CREATIVE_GUIDES,
  admin: ADMIN_GUIDES,
};

/** Hub category order per role; categories not listed sort after, A→Z. */
const CATEGORY_ORDER: Record<SupportRole, string[]> = {
  customer: ["Getting started", "Workspace", "Billing", "Account"],
  creative: ["Getting started", "Work", "Earnings", "Account"],
  admin: ["Getting started", "Workspace", "Catalog", "Finance", "People", "Content", "System"],
};

export function supportBasePath(role: SupportRole): string {
  return `/${role}/support`;
}

export function guideHref(role: SupportRole, slug: string): string {
  return `${supportBasePath(role)}/${slug}`;
}

export function getGuides(role: SupportRole, opts: { isSiteOwner?: boolean } = {}) {
  return GUIDES[role].filter((g) => !g.ownerOnly || opts.isSiteOwner);
}

export function getGuide(role: SupportRole, slug: string): SupportGuide | undefined {
  return GUIDES[role].find((g) => g.slug === slug);
}

/** Guides grouped by category, in the role's hub order. */
export function groupGuides(role: SupportRole, guides: SupportGuide[]) {
  const order = CATEGORY_ORDER[role];
  const groups = new Map<string, SupportGuide[]>();
  for (const g of guides) {
    const list = groups.get(g.category) ?? [];
    list.push(g);
    groups.set(g.category, list);
  }
  const rank = (c: string) => {
    const i = order.indexOf(c);
    return i === -1 ? order.length : i;
  };
  return [...groups.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([category, items]) => ({ category, items }));
}

function routeMatches(route: string, pathname: string, role: SupportRole): boolean {
  if (route === `/${role}`) return pathname === route;
  return pathname === route || pathname.startsWith(`${route}/`);
}

/** The guide documenting `pathname`, or undefined. Longest route wins. */
export function findGuideForPath(
  role: SupportRole,
  pathname: string,
  opts: { isSiteOwner?: boolean } = {},
): SupportGuide | undefined {
  let best: { guide: SupportGuide; len: number } | undefined;
  for (const guide of getGuides(role, opts)) {
    for (const r of guide.routes) {
      if (routeMatches(r, pathname, role) && (!best || r.length > best.len)) {
        best = { guide, len: r.length };
      }
    }
  }
  return best?.guide;
}

/** A guide's route is linkable when it has no dynamic segment. */
export function primaryRoute(guide: SupportGuide): string | undefined {
  const r = guide.routes[0];
  return r && !r.includes("[") ? r : undefined;
}

// --- Search ------------------------------------------------------------------

function blockText(b: GuideBlock): string {
  switch (b.type) {
    case "p":
    case "tip":
    case "warning":
      return b.text;
    case "steps":
      return b.items.join(" ");
    case "list":
      return b.items.map((i) => (typeof i === "string" ? i : `${i.term} ${i.text}`)).join(" ");
  }
}

const norm = (s: string) => s.toLowerCase().replace(/\*\*/g, "");

/**
 * Every term must appear somewhere in the guide. Title hits rank first, then
 * summary/keyword hits, then body-only hits.
 */
export function searchGuides(guides: SupportGuide[], query: string): SupportGuide[] {
  const terms = norm(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return guides;

  const scored: { guide: SupportGuide; score: number }[] = [];
  for (const guide of guides) {
    const title = norm(guide.title);
    const head = norm([guide.summary, ...(guide.keywords ?? [])].join(" "));
    const body = norm(
      guide.sections.map((s) => [s.heading, ...s.blocks.map(blockText)].join(" ")).join(" "),
    );
    let score = 0;
    let all = true;
    for (const t of terms) {
      if (title.includes(t)) score += 3;
      else if (head.includes(t)) score += 2;
      else if (body.includes(t)) score += 1;
      else {
        all = false;
        break;
      }
    }
    if (all) scored.push({ guide, score });
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.guide);
}
