// -----------------------------------------------------------------------------
// @file: lib/support/types.ts
// @purpose: Shape of the in-dashboard Support guides. Guides are typed content
//           kept in code (lib/support/guides/<role>.ts) so they ship with the
//           UI they describe and are reviewed in the same PR as UI changes.
//           Text fields accept **bold** only — no HTML, no Markdown links.
// -----------------------------------------------------------------------------

import type { EngagementFeature } from "@/lib/engagement/switches";

export type SupportRole = "customer" | "creative" | "admin";

/**
 * An owner switch (/admin/settings, Engagement) that a guide, section or
 * block describes. Text marked with one is written ahead of time and only
 * shows while that switch is on, so guides never describe a feature people
 * can't see. Unmarked text always shows.
 */
export type GuideFeature = EngagementFeature;

export type GuideBlock = GuideBlockBody & {
  /** Only shown while this feature is switched on. */
  feature?: GuideFeature;
};

type GuideBlockBody =
  /** Plain paragraph. */
  | { type: "p"; text: string }
  /** Numbered how-to steps. */
  | { type: "steps"; items: string[] }
  /** Bulleted list. Use `term` for "Field — what it does" definitions. */
  | { type: "list"; items: (string | { term: string; text: string })[] }
  /** Helpful aside. */
  | { type: "tip"; text: string }
  /** Something that can't be undone, costs tokens/money, or surprises people. */
  | { type: "warning"; text: string }
  /**
   * A screenshot or picture. Without `image` it is a slot waiting for one:
   * admin guides show a placeholder (so admins can see where a screenshot
   * goes), other pages show nothing until an admin adds the image in
   * Support content. `mobileImage` is the same screen on a phone: phones show
   * it instead of `image` (with a switch back), wider screens never do. It
   * only shows when `image` is set too.
   */
  | { type: "figure"; caption: string; image?: string; mobileImage?: string; alt?: string };

export type GuideSection = {
  heading: string;
  /** Only shown while this feature is switched on. */
  feature?: GuideFeature;
  blocks: GuideBlock[];
};

export type SupportGuide = {
  /** URL slug under /<role>/support/<slug>. Unique per role. */
  slug: string;
  title: string;
  /** One sentence shown on the hub card and under the guide title. */
  summary: string;
  /** Hub grouping, e.g. "Workspace", "Billing", "Account". */
  category: string;
  /**
   * Dashboard paths this guide documents. Drives the per-page "?" help link:
   * a path matches itself and its children (/customer/tickets matches
   * /customer/tickets/abc), except the role root (/customer), which only
   * matches exactly. A `[param]` segment matches any one segment
   * (/customer/tickets/[ticketId]). The most specific match wins: more
   * literal segments beat fewer, so /customer/tickets/new beats
   * /customer/tickets/[ticketId]. The first route without a `[param]` is the
   * "Open this page" target. Empty for topic guides that span pages.
   */
  routes: string[];
  /** Slugs of guides listed under "Related guides" at the end. */
  related?: string[];
  /** Extra search terms that don't appear in the text (synonyms, old names). */
  keywords?: string[];
  /** Admin only: hide from SITE_ADMIN (mirrors ownerOnly nav items). */
  ownerOnly?: boolean;
  /**
   * The whole guide is about this feature and only shows while it is switched
   * on. Such a guide is a topic guide: the per-page "?" link never picks it.
   */
  feature?: GuideFeature;
  sections: GuideSection[];
};
