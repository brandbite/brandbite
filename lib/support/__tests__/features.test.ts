import { describe, expect, it } from "vitest";

import { ALL_ENGAGEMENT_OFF, ENGAGEMENT_LABELS } from "@/lib/engagement/switches";
import { codeGuides, findGuideForPath, type SupportGuide, type SupportRole } from "@/lib/support";
import { PUBLIC_GUIDES } from "@/lib/guides";
import { applyFeatureSwitches, guideFeatures } from "@/lib/support/features";
import { parseGuideContent } from "@/lib/support/merge";

const guide = (over: Partial<SupportGuide>): SupportGuide => ({
  slug: "g",
  title: "G",
  summary: "",
  category: "Other",
  routes: [],
  sections: [{ heading: "One", blocks: [{ type: "p", text: "always" }] }],
  ...over,
});

const slugs = (guides: SupportGuide[]) => guides.map((g) => g.slug);

describe("applyFeatureSwitches", () => {
  const mixed = guide({
    slug: "mixed",
    sections: [
      {
        heading: "Always",
        blocks: [
          { type: "p", text: "always" },
          { type: "tip", text: "meter", feature: "briefStrength" },
        ],
      },
      { heading: "Recap", feature: "monthlyRecap", blocks: [{ type: "p", text: "recap" }] },
      {
        heading: "Only feature blocks",
        blocks: [{ type: "p", text: "progress", feature: "liveProgress" }],
      },
    ],
  });
  const whole = guide({ slug: "whole", feature: "monthlyRecap" });
  const plain = guide({ slug: "plain" });
  const merged = { guides: [mixed, whole, plain], hiddenSlugs: ["cms-hidden"] };

  it("hides everything about switched-off features and leaves the rest alone", () => {
    const out = applyFeatureSwitches(merged, ALL_ENGAGEMENT_OFF);
    expect(slugs(out.guides)).toEqual(["mixed", "plain"]);
    expect(out.hiddenSlugs).toEqual(["cms-hidden", "whole"]);
    expect(out.guides[0].sections).toEqual([
      { heading: "Always", blocks: [{ type: "p", text: "always" }] },
    ]);
    // Guides without feature text are passed through untouched.
    expect(out.guides[1]).toBe(plain);
  });

  it("shows the text as soon as its switch is on", () => {
    const out = applyFeatureSwitches(merged, {
      ...ALL_ENGAGEMENT_OFF,
      monthlyRecap: true,
      briefStrength: true,
    });
    expect(slugs(out.guides)).toEqual(["mixed", "whole", "plain"]);
    expect(out.hiddenSlugs).toEqual(["cms-hidden"]);
    expect(out.guides[0].sections.map((s) => s.heading)).toEqual(["Always", "Recap"]);
    expect(out.guides[0].sections[0].blocks).toHaveLength(2);
  });

  it("treats a guide left with no text as hidden", () => {
    const onlyFeature = guide({
      slug: "empty",
      sections: [{ heading: "X", feature: "thankYous", blocks: [{ type: "p", text: "x" }] }],
    });
    const out = applyFeatureSwitches(
      { guides: [onlyFeature], hiddenSlugs: [] },
      ALL_ENGAGEMENT_OFF,
    );
    expect(out.guides).toEqual([]);
    expect(out.hiddenSlugs).toEqual(["empty"]);
  });

  it("lists the switches a guide waits for", () => {
    expect(guideFeatures(mixed).sort()).toEqual(["briefStrength", "liveProgress", "monthlyRecap"]);
    expect(guideFeatures(plain)).toEqual([]);
  });
});

describe("feature marks in the CMS layer", () => {
  it("keeps valid marks on sections and blocks through an admin's edit and drops unknown ones", () => {
    const parsed = parseGuideContent({
      title: "T",
      sections: [
        {
          heading: "One",
          feature: "monthlyRecap",
          blocks: [
            { type: "p", text: "a", feature: "briefStrength" },
            { type: "p", text: "b", feature: "notAFeature" },
          ],
        },
        { heading: "Two", feature: "nope", blocks: [{ type: "p", text: "c" }] },
      ],
    });
    expect(parsed?.sections).toEqual([
      {
        heading: "One",
        feature: "monthlyRecap",
        blocks: [
          { type: "p", text: "a", feature: "briefStrength" },
          { type: "p", text: "b" },
        ],
      },
      { heading: "Two", blocks: [{ type: "p", text: "c" }] },
    ]);
  });
});

describe("feature text in the guides written in code", () => {
  const roles: SupportRole[] = ["customer", "creative", "admin"];
  const all = [...roles.flatMap((role) => codeGuides(role)), ...PUBLIC_GUIDES];

  it("only uses switches that exist", () => {
    for (const g of all) {
      for (const feature of guideFeatures(g)) expect(ENGAGEMENT_LABELS[feature]).toBeTruthy();
    }
  });

  it("every guide still has text with every switch off, unless the whole guide is about a feature", () => {
    for (const role of roles) {
      const out = applyFeatureSwitches(
        { guides: codeGuides(role), hiddenSlugs: [] },
        ALL_ENGAGEMENT_OFF,
      );
      const gone = codeGuides(role)
        .filter((g) => !g.feature)
        .filter((g) => !out.guides.some((shown) => shown.slug === g.slug));
      expect(slugs(gone)).toEqual([]);
    }
  });

  it("the per-page help link never points at a guide that may be switched off", () => {
    for (const role of roles) {
      for (const g of codeGuides(role).filter((x) => x.feature)) {
        for (const route of g.routes) {
          expect(findGuideForPath(role, route, { isSiteOwner: true })?.feature).toBeUndefined();
        }
      }
    }
  });
});
