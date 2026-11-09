// -----------------------------------------------------------------------------
// Keeps Support guides in step with the app, so CI fails when a feature ships
// without docs or a guide outlives its page:
//   - every sidebar page has a guide (or is listed below with a reason),
//   - every route a guide documents exists under app/.
// -----------------------------------------------------------------------------

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ADMIN_NAV,
  CREATIVE_NAV,
  CUSTOMER_NAV,
  type NavConfig,
} from "@/components/navigation/nav-config";
import { codeGuides, findGuideForPath, type SupportRole } from "@/lib/support";

const NAV: Record<SupportRole, NavConfig> = {
  customer: CUSTOMER_NAV,
  creative: CREATIVE_NAV,
  admin: ADMIN_NAV,
};

/** Sidebar pages that deliberately have no guide, with the reason. */
const UNDOCUMENTED: Record<string, string> = {
  "/customer/faq": "The FAQ is its own page; guides link to it instead of repeating it.",
  "/creative/faq": "The FAQ is its own page; guides link to it instead of repeating it.",
};

const APP_DIR = join(process.cwd(), "app");

/** Sidebar links into the role's own dashboard; links out (e.g. /colors) aren't documented here. */
function navHrefs(role: SupportRole, nav: NavConfig): string[] {
  return nav.sections
    .flatMap((section) => section.items.map((item) => item.href))
    .filter((href) => href === `/${role}` || href.startsWith(`/${role}/`));
}

/** True if app/ has a page for this route; a [param] segment matches any dynamic folder. */
function routeExists(route: string): boolean {
  let dir = APP_DIR;
  for (const segment of route.split("/").filter(Boolean)) {
    if (segment.startsWith("[")) {
      const dynamic = readdirSync(dir, { withFileTypes: true }).find(
        (entry) => entry.isDirectory() && entry.name.startsWith("["),
      );
      if (!dynamic) return false;
      dir = join(dir, dynamic.name);
    } else {
      dir = join(dir, segment);
      if (!existsSync(dir)) return false;
    }
  }
  return existsSync(join(dir, "page.tsx")) || existsSync(join(dir, "page.ts"));
}

describe("Support guides cover the app", () => {
  for (const role of Object.keys(NAV) as SupportRole[]) {
    it(`${role}: every sidebar page has a guide`, () => {
      const missing = navHrefs(role, NAV[role])
        .filter((href) => !(href in UNDOCUMENTED))
        .filter((href) => !findGuideForPath(role, href, { isSiteOwner: true }));
      expect(
        missing,
        `Add a guide in lib/support/guides/${role}.ts for: ${missing.join(", ")}`,
      ).toEqual([]);
    });

    it(`${role}: every documented route exists`, () => {
      const gone = codeGuides(role)
        .flatMap((guide) => guide.routes.map((route) => ({ slug: guide.slug, route })))
        .filter(({ route }) => !routeExists(route))
        .map(({ slug, route }) => `${slug} → ${route}`);
      expect(gone, `Update or remove these guides: ${gone.join(", ")}`).toEqual([]);
    });
  }
});
