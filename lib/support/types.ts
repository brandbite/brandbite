// -----------------------------------------------------------------------------
// @file: lib/support/types.ts
// @purpose: Shape of the in-dashboard Support guides. Guides are typed content
//           kept in code (lib/support/guides/<role>.ts) so they ship with the
//           UI they describe and are reviewed in the same PR as UI changes.
//           Text fields accept **bold** only — no HTML, no Markdown links.
// -----------------------------------------------------------------------------

export type SupportRole = "customer" | "creative" | "admin";

export type GuideBlock =
  /** Plain paragraph. */
  | { type: "p"; text: string }
  /** Numbered how-to steps. */
  | { type: "steps"; items: string[] }
  /** Bulleted list. Use `term` for "Field — what it does" definitions. */
  | { type: "list"; items: (string | { term: string; text: string })[] }
  /** Helpful aside. */
  | { type: "tip"; text: string }
  /** Something that can't be undone, costs tokens/money, or surprises people. */
  | { type: "warning"; text: string };

export type GuideSection = {
  heading: string;
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
  sections: GuideSection[];
};
