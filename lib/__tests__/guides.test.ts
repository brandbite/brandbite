import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { GUIDE_META, PUBLIC_GUIDES, readMinutes, sectionAnchor, wordCount } from "@/lib/guides";
import { formatMoney } from "@/lib/cost/calculate";
import { RATES } from "@/lib/cost/rates";
import { guideCodeHash } from "@/lib/support/hash";
import { contentOf, parseGuideContent } from "@/lib/support/merge";

function pageExists(href: string): boolean {
  const dir = join(process.cwd(), "app", ...href.split("/").filter(Boolean));
  return existsSync(join(dir, "page.tsx"));
}

describe("public guides", () => {
  it("have unique, URL-safe slugs and unique section anchors", () => {
    const slugs = PUBLIC_GUIDES.map((g) => g.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const guide of PUBLIC_GUIDES) {
      expect(guide.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      const anchors = guide.sections.map((s) => sectionAnchor(s.heading));
      expect(new Set(anchors).size, guide.slug).toBe(anchors.length);
      expect(guide.routes).toEqual([]);
    }
  });

  it("each have metadata whose links point at real pages", () => {
    for (const guide of PUBLIC_GUIDES) {
      const meta = GUIDE_META[guide.slug];
      expect(meta, guide.slug).toBeDefined();
      expect(meta.updatedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      for (const href of [meta.tool.href, ...meta.links.map((l) => l.href)]) {
        expect(pageExists(href), `${guide.slug} links to ${href}`).toBe(true);
      }
    }
  });

  it("are substantial articles, not stubs", () => {
    for (const guide of PUBLIC_GUIDES) {
      expect(wordCount(guide), guide.slug).toBeGreaterThan(850);
      expect(readMinutes(guide)).toBeGreaterThanOrEqual(3);
    }
  });

  it("survive the CMS round trip unchanged", () => {
    for (const guide of PUBLIC_GUIDES) {
      expect(parseGuideContent(contentOf(guide))).toEqual(contentOf(guide));
    }
  });

  it("use the calculator's numbers, so a rate change flags edited copies", () => {
    const guide = PUBLIC_GUIDES.find(
      (g) => g.slug === "freelancer-vs-agency-vs-in-house-designer",
    )!;
    const text = JSON.stringify(guide.sections);
    expect(text).toContain(formatMoney(RATES.us.inHouseSalary, "USD"));
    expect(guideCodeHash(guide)).toMatch(/^[0-9a-f]{32}$/);
  });
});
