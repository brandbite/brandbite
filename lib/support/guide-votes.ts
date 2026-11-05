// -----------------------------------------------------------------------------
// @file: lib/support/guide-votes.ts
// @purpose: Rules for "Was this helpful?": which guides a person can answer on,
//           and the per-guide totals for /admin/guide-votes.
// -----------------------------------------------------------------------------

import { isSiteOwnerRole, type AppUserRole } from "@/lib/roles";

import { getGuides, type SupportRole } from "./index";

const AUDIENCES: SupportRole[] = ["customer", "creative", "admin"];

/** The guides a person reads are set by their role, never by the request. */
export function supportRoleOf(role: AppUserRole): SupportRole {
  if (role === "CUSTOMER") return "customer";
  if (role === "DESIGNER") return "creative";
  return "admin";
}

/** The audience to record a vote under, or null if this person can't see the guide. */
export function voteAudienceFor(role: AppUserRole, slug: string): SupportRole | null {
  const audience = supportRoleOf(role);
  const visible = getGuides(audience, { isSiteOwner: isSiteOwnerRole(role) });
  return visible.some((g) => g.slug === slug) ? audience : null;
}

export type GuideVoteCount = {
  audience: string;
  slug: string;
  helpful: boolean;
  count: number;
};

export type GuideVoteRow = {
  audience: SupportRole;
  slug: string;
  title: string;
  category: string;
  helpful: number;
  notHelpful: number;
  total: number;
};

/**
 * One row per guide the viewer can see, including guides nobody has answered.
 * Most "No" answers first, since those are the guides worth fixing.
 */
export function summarizeGuideVotes(
  counts: GuideVoteCount[],
  opts: { isSiteOwner: boolean },
): GuideVoteRow[] {
  const key = (audience: string, slug: string) => `${audience}/${slug}`;
  const tally = new Map(counts.map((c) => [key(c.audience, c.slug) + `/${c.helpful}`, c.count]));

  const rows = AUDIENCES.flatMap((audience) =>
    getGuides(audience, opts).map((guide) => {
      const base = key(audience, guide.slug);
      const helpful = tally.get(`${base}/true`) ?? 0;
      const notHelpful = tally.get(`${base}/false`) ?? 0;
      return {
        audience,
        slug: guide.slug,
        title: guide.title,
        category: guide.category,
        helpful,
        notHelpful,
        total: helpful + notHelpful,
      };
    }),
  );

  return rows.sort(
    (a, b) => b.notHelpful - a.notHelpful || b.total - a.total || a.title.localeCompare(b.title),
  );
}
