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

/** Hand-picked for now: guide views aren't measured, so this isn't a usage ranking. */
const POPULAR_SLUGS: Record<SupportRole, string[]> = {
  customer: ["create-request", "review-and-approve", "tokens"],
  creative: ["deliver-work", "handle-feedback", "withdrawals"],
  admin: ["board-and-tickets", "companies", "withdrawals", "users"],
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

/** The role's popular guides that the viewer can open, in the listed order. */
export function popularGuides(
  role: SupportRole,
  opts: { isSiteOwner?: boolean } = {},
): SupportGuide[] {
  const visible = getGuides(role, opts);
  return POPULAR_SLUGS[role]
    .map((slug) => visible.find((g) => g.slug === slug))
    .filter((g): g is SupportGuide => !!g);
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

const isParam = (seg: string) => seg.startsWith("[") && seg.endsWith("]");

/**
 * Specificity score of `route` for `pathname`, or -1 when it doesn't match.
 * Literal segments weigh more than [param] segments so static routes win.
 */
function routeScore(route: string, pathname: string, role: SupportRole): number {
  if (route === `/${role}`) return pathname === route ? 100 : -1;
  const want = route.split("/").filter(Boolean);
  const have = pathname.split("/").filter(Boolean);
  if (have.length < want.length) return -1;
  let score = 0;
  for (let i = 0; i < want.length; i++) {
    if (isParam(want[i])) score += 1;
    else if (want[i] === have[i]) score += 100;
    else return -1;
  }
  return score;
}

/** The guide documenting `pathname`, or undefined. Most specific route wins. */
export function findGuideForPath(
  role: SupportRole,
  pathname: string,
  opts: { isSiteOwner?: boolean } = {},
): SupportGuide | undefined {
  let best: { guide: SupportGuide; score: number } | undefined;
  for (const guide of getGuides(role, opts)) {
    for (const r of guide.routes) {
      const score = routeScore(r, pathname, role);
      if (score >= 0 && (!best || score > best.score)) best = { guide, score };
    }
  }
  return best?.guide;
}

/** The first route without a dynamic segment — the "Open this page" target. */
export function primaryRoute(guide: SupportGuide): string | undefined {
  return guide.routes.find((r) => !r.includes("["));
}

/** Related guides that exist and are visible to the viewer. */
export function relatedGuides(
  role: SupportRole,
  guide: SupportGuide,
  opts: { isSiteOwner?: boolean } = {},
): SupportGuide[] {
  const visible = getGuides(role, opts);
  return (guide.related ?? [])
    .map((slug) => visible.find((g) => g.slug === slug))
    .filter((g): g is SupportGuide => !!g);
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
