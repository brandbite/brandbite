// -----------------------------------------------------------------------------
// @file: lib/blocks/__tests__/types.test.ts
// @purpose: Lock the Zod parse contracts for every block type. These
//           schemas guard both DB rows and admin save payloads, so a
//           regression here would mean either a saved block can't be
//           parsed back at render time (page silently drops the block)
//           or a malformed admin save lands in the DB.
// -----------------------------------------------------------------------------

import { describe, expect, it } from "vitest";

import { BLOCK_TYPES, isKnownBlockType, parseBlockData } from "../types";

describe("isKnownBlockType", () => {
  it("returns true for every BLOCK_TYPES value", () => {
    for (const t of Object.values(BLOCK_TYPES)) {
      expect(isKnownBlockType(t)).toBe(true);
    }
  });

  it("returns false for unknown strings", () => {
    expect(isKnownBlockType("UNKNOWN")).toBe(false);
    expect(isKnownBlockType("")).toBe(false);
    expect(isKnownBlockType("hero")).toBe(false); // case-sensitive
  });
});

describe("parseBlockData — HERO", () => {
  it("accepts the minimum valid centered hero", () => {
    const result = parseBlockData({
      type: BLOCK_TYPES.HERO,
      data: { variant: "centered", headline: "Hello world" },
    });
    expect(result).not.toBeNull();
    expect(result?.type).toBe(BLOCK_TYPES.HERO);
    if (result?.type === BLOCK_TYPES.HERO) {
      expect(result.data.headline).toBe("Hello world");
      expect(result.data.variant).toBe("centered");
    }
  });

  it("defaults variant to centered when omitted", () => {
    const result = parseBlockData({
      type: BLOCK_TYPES.HERO,
      data: { headline: "Hi" },
    });
    expect(result).not.toBeNull();
    if (result?.type === BLOCK_TYPES.HERO) {
      expect(result.data.variant).toBe("centered");
    }
  });

  it("rejects an empty headline", () => {
    expect(
      parseBlockData({
        type: BLOCK_TYPES.HERO,
        data: { headline: "" },
      }),
    ).toBeNull();
  });

  it("rejects an unknown variant", () => {
    expect(
      parseBlockData({
        type: BLOCK_TYPES.HERO,
        data: { headline: "X", variant: "diagonal" },
      }),
    ).toBeNull();
  });

  it("rejects javascript: ctaHref (XSS guard)", () => {
    expect(
      parseBlockData({
        type: BLOCK_TYPES.HERO,
        data: { headline: "X", ctaLabel: "Click", ctaHref: "javascript:alert(1)" },
      }),
    ).toBeNull();
  });

  it("rejects data: ctaHref (XSS guard)", () => {
    expect(
      parseBlockData({
        type: BLOCK_TYPES.HERO,
        data: {
          headline: "X",
          ctaLabel: "Click",
          ctaHref: "data:text/html,<script>alert(1)</script>",
        },
      }),
    ).toBeNull();
  });

  it("accepts an internal-path ctaHref", () => {
    const result = parseBlockData({
      type: BLOCK_TYPES.HERO,
      data: { headline: "X", ctaLabel: "Click", ctaHref: "/login" },
    });
    expect(result).not.toBeNull();
  });

  it("accepts an in-page anchor ctaHref", () => {
    const result = parseBlockData({
      type: BLOCK_TYPES.HERO,
      data: { headline: "X", ctaLabel: "Click", ctaHref: "#pricing" },
    });
    expect(result).not.toBeNull();
  });

  it("rejects a bare # without a target", () => {
    expect(
      parseBlockData({
        type: BLOCK_TYPES.HERO,
        data: { headline: "X", ctaLabel: "Click", ctaHref: "#" },
      }),
    ).toBeNull();
  });

  it("accepts an https ctaHref", () => {
    const result = parseBlockData({
      type: BLOCK_TYPES.HERO,
      data: { headline: "X", ctaLabel: "Click", ctaHref: "https://example.com" },
    });
    expect(result).not.toBeNull();
  });

  it("accepts a mailto ctaHref", () => {
    const result = parseBlockData({
      type: BLOCK_TYPES.HERO,
      data: { headline: "X", ctaLabel: "Email", ctaHref: "mailto:hi@brandbite.studio" },
    });
    expect(result).not.toBeNull();
  });
});

describe("parseBlockData — FAQ", () => {
  it("accepts a picker selection of Faq IDs", () => {
    const result = parseBlockData({
      type: BLOCK_TYPES.FAQ,
      data: {
        title: "Common questions",
        selectedFaqIds: ["faq_seed_gen_01", "faq_seed_pri_02"],
      },
    });
    expect(result).not.toBeNull();
  });

  it("accepts an empty selection (renderer shows defaults)", () => {
    const result = parseBlockData({
      type: BLOCK_TYPES.FAQ,
      data: { selectedFaqIds: [] },
    });
    expect(result).not.toBeNull();
  });

  it("defaults selectedFaqIds to [] when omitted", () => {
    const result = parseBlockData({
      type: BLOCK_TYPES.FAQ,
      data: { title: "Just framing copy" },
    });
    expect(result).not.toBeNull();
    if (result && result.type === BLOCK_TYPES.FAQ) {
      expect(result.data.selectedFaqIds).toEqual([]);
    }
  });

  it("rejects more than 40 selected IDs", () => {
    const tooMany = Array.from({ length: 41 }, (_, i) => `faq_${i}`);
    expect(
      parseBlockData({
        type: BLOCK_TYPES.FAQ,
        data: { selectedFaqIds: tooMany },
      }),
    ).toBeNull();
  });

  it("rejects non-array selectedFaqIds", () => {
    expect(
      parseBlockData({
        type: BLOCK_TYPES.FAQ,
        data: { selectedFaqIds: "faq_one" as unknown as string[] },
      }),
    ).toBeNull();
  });

  it("accepts a paired CTA (label + href)", () => {
    const result = parseBlockData({
      type: BLOCK_TYPES.FAQ,
      data: {
        selectedFaqIds: [],
        ctaLabel: "See all questions",
        ctaHref: "/faq",
      },
    });
    expect(result).not.toBeNull();
  });

  it("accepts no CTA (both fields omitted)", () => {
    const result = parseBlockData({
      type: BLOCK_TYPES.FAQ,
      data: { selectedFaqIds: [] },
    });
    expect(result).not.toBeNull();
  });

  it("rejects a CTA with label only (no destination)", () => {
    expect(
      parseBlockData({
        type: BLOCK_TYPES.FAQ,
        data: { selectedFaqIds: [], ctaLabel: "See all" },
      }),
    ).toBeNull();
  });

  it("rejects a CTA with href only (no label)", () => {
    expect(
      parseBlockData({
        type: BLOCK_TYPES.FAQ,
        data: { selectedFaqIds: [], ctaHref: "/faq" },
      }),
    ).toBeNull();
  });

  it("rejects a CTA with a javascript: href", () => {
    expect(
      parseBlockData({
        type: BLOCK_TYPES.FAQ,
        data: {
          selectedFaqIds: [],
          ctaLabel: "Click",
          ctaHref: "javascript:alert(1)",
        },
      }),
    ).toBeNull();
  });
});

describe("parseBlockData — FEATURE_GRID", () => {
  it("accepts at least one item", () => {
    const result = parseBlockData({
      type: BLOCK_TYPES.FEATURE_GRID,
      data: { items: [{ title: "Fast" }] },
    });
    expect(result).not.toBeNull();
  });

  it("rejects empty items array", () => {
    expect(
      parseBlockData({
        type: BLOCK_TYPES.FEATURE_GRID,
        data: { items: [] },
      }),
    ).toBeNull();
  });

  it("caps items at 12", () => {
    const items = Array.from({ length: 13 }, (_, i) => ({ title: `Item ${i}` }));
    expect(
      parseBlockData({
        type: BLOCK_TYPES.FEATURE_GRID,
        data: { items },
      }),
    ).toBeNull();
  });

  it("accepts items with optional emoji and body", () => {
    const result = parseBlockData({
      type: BLOCK_TYPES.FEATURE_GRID,
      data: {
        items: [
          { title: "Fast turnaround", body: "1 to 2 days per request", emoji: "⚡" },
          { title: "Direct comms" },
        ],
      },
    });
    expect(result).not.toBeNull();
  });

  it("accepts a paired CTA (label + href)", () => {
    const result = parseBlockData({
      type: BLOCK_TYPES.FEATURE_GRID,
      data: {
        items: [{ title: "Fast" }],
        ctaLabel: "Explore Pricing",
        ctaHref: "#pricing",
      },
    });
    expect(result).not.toBeNull();
  });

  it("rejects a CTA with label only", () => {
    expect(
      parseBlockData({
        type: BLOCK_TYPES.FEATURE_GRID,
        data: { items: [{ title: "Fast" }], ctaLabel: "Explore" },
      }),
    ).toBeNull();
  });

  it("rejects a CTA with href only", () => {
    expect(
      parseBlockData({
        type: BLOCK_TYPES.FEATURE_GRID,
        data: { items: [{ title: "Fast" }], ctaHref: "#pricing" },
      }),
    ).toBeNull();
  });

  it("rejects a CTA with javascript: href", () => {
    expect(
      parseBlockData({
        type: BLOCK_TYPES.FEATURE_GRID,
        data: {
          items: [{ title: "Fast" }],
          ctaLabel: "Click",
          ctaHref: "javascript:alert(1)",
        },
      }),
    ).toBeNull();
  });

  it("accepts an image reference", () => {
    const result = parseBlockData({
      type: BLOCK_TYPES.FEATURE_GRID,
      data: {
        items: [{ title: "Fast" }],
        image: { storageKey: "page-block/why.jpg", url: "https://r2.example/why.jpg" },
      },
    });
    expect(result).not.toBeNull();
  });
});

describe("parseBlockData — PRICING", () => {
  it("accepts an empty payload (all fields optional)", () => {
    const result = parseBlockData({ type: BLOCK_TYPES.PRICING, data: {} });
    expect(result).not.toBeNull();
  });

  it("accepts the full header shape (eyebrow/title/subtitle + contact triad)", () => {
    const result = parseBlockData({
      type: BLOCK_TYPES.PRICING,
      data: {
        eyebrow: "Start now your",
        title: "creative plan",
        subtitle: "Pause or cancel anytime.",
        contactNote: "Need a custom plan?",
        contactLabel: "Let's talk",
        contactHref: "mailto:hello@brandbite.io",
      },
    });
    expect(result).not.toBeNull();
  });

  it("rejects a partial contact triad (note + label, no href)", () => {
    expect(
      parseBlockData({
        type: BLOCK_TYPES.PRICING,
        data: { contactNote: "Need a custom plan?", contactLabel: "Let's talk" },
      }),
    ).toBeNull();
  });

  it("rejects a partial contact triad (label + href, no note)", () => {
    expect(
      parseBlockData({
        type: BLOCK_TYPES.PRICING,
        data: { contactLabel: "Let's talk", contactHref: "/contact" },
      }),
    ).toBeNull();
  });

  it("rejects a partial contact triad (note + href, no label)", () => {
    expect(
      parseBlockData({
        type: BLOCK_TYPES.PRICING,
        data: { contactNote: "Need a custom plan?", contactHref: "/contact" },
      }),
    ).toBeNull();
  });

  it("rejects javascript: contactHref", () => {
    expect(
      parseBlockData({
        type: BLOCK_TYPES.PRICING,
        data: {
          contactNote: "Click",
          contactLabel: "here",
          contactHref: "javascript:alert(1)",
        },
      }),
    ).toBeNull();
  });
});

describe("parseBlockData — SHOWCASE", () => {
  it("accepts an empty payload (all fields optional)", () => {
    const result = parseBlockData({ type: BLOCK_TYPES.SHOWCASE, data: {} });
    expect(result).not.toBeNull();
  });

  it("accepts the full header shape (title/subtitle + CTA pair)", () => {
    const result = parseBlockData({
      type: BLOCK_TYPES.SHOWCASE,
      data: {
        title: "Showcase",
        subtitle: "Creatives that speak louder than words.",
        ctaLabel: "View the full gallery",
        ctaHref: "/showcase",
      },
    });
    expect(result).not.toBeNull();
  });

  it("rejects a half-set CTA (label only)", () => {
    expect(
      parseBlockData({
        type: BLOCK_TYPES.SHOWCASE,
        data: { ctaLabel: "View the full gallery" },
      }),
    ).toBeNull();
  });

  it("rejects a half-set CTA (href only)", () => {
    expect(
      parseBlockData({
        type: BLOCK_TYPES.SHOWCASE,
        data: { ctaHref: "/showcase" },
      }),
    ).toBeNull();
  });

  it("rejects javascript: ctaHref", () => {
    expect(
      parseBlockData({
        type: BLOCK_TYPES.SHOWCASE,
        data: { ctaLabel: "Click", ctaHref: "javascript:alert(1)" },
      }),
    ).toBeNull();
  });
});

describe("parseBlockData — CALL_TO_ACTION", () => {
  it("accepts a complete CTA", () => {
    const result = parseBlockData({
      type: BLOCK_TYPES.CALL_TO_ACTION,
      data: { headline: "Ship it", ctaLabel: "Start", ctaHref: "/login" },
    });
    expect(result).not.toBeNull();
  });

  it("requires ctaHref", () => {
    expect(
      parseBlockData({
        type: BLOCK_TYPES.CALL_TO_ACTION,
        data: { headline: "Ship it", ctaLabel: "Start" },
      }),
    ).toBeNull();
  });
});

describe("parseBlockData — unknown / malformed", () => {
  it("returns null for an unknown type", () => {
    expect(parseBlockData({ type: "UNKNOWN_TYPE", data: {} })).toBeNull();
  });

  it("returns null when data is the wrong shape", () => {
    expect(parseBlockData({ type: BLOCK_TYPES.HERO, data: 42 })).toBeNull();
    expect(parseBlockData({ type: BLOCK_TYPES.HERO, data: null })).toBeNull();
    expect(parseBlockData({ type: BLOCK_TYPES.HERO, data: "a string" })).toBeNull();
  });
});

describe("parseBlockData — SITE_HEADER", () => {
  it("accepts the minimum valid header", () => {
    const result = parseBlockData({
      type: BLOCK_TYPES.SITE_HEADER,
      data: { navLinks: [{ label: "Pricing", href: "/pricing" }] },
    });
    expect(result).not.toBeNull();
  });

  it("rejects an empty navLinks array", () => {
    expect(
      parseBlockData({
        type: BLOCK_TYPES.SITE_HEADER,
        data: { navLinks: [] },
      }),
    ).toBeNull();
  });

  it("caps navLinks at 10", () => {
    const navLinks = Array.from({ length: 11 }, (_, i) => ({
      label: `Link ${i}`,
      href: `/p${i}`,
    }));
    expect(
      parseBlockData({
        type: BLOCK_TYPES.SITE_HEADER,
        data: { navLinks },
      }),
    ).toBeNull();
  });

  it("rejects javascript: hrefs in navLinks", () => {
    expect(
      parseBlockData({
        type: BLOCK_TYPES.SITE_HEADER,
        data: { navLinks: [{ label: "Bad", href: "javascript:alert(1)" }] },
      }),
    ).toBeNull();
  });

  it("accepts external https hrefs", () => {
    const result = parseBlockData({
      type: BLOCK_TYPES.SITE_HEADER,
      data: { navLinks: [{ label: "Help", href: "https://help.example.com" }] },
    });
    expect(result).not.toBeNull();
  });
});

describe("parseBlockData — SITE_FOOTER", () => {
  it("accepts the minimum valid footer (one column, one link)", () => {
    const result = parseBlockData({
      type: BLOCK_TYPES.SITE_FOOTER,
      data: {
        columns: [
          {
            title: "Platform",
            links: [{ label: "Pricing", href: "/pricing" }],
          },
        ],
      },
    });
    expect(result).not.toBeNull();
  });

  it("accepts the full shape (brand statement + columns + legal links)", () => {
    const result = parseBlockData({
      type: BLOCK_TYPES.SITE_FOOTER,
      data: {
        brandStatement: "All your creatives, one subscription",
        columns: [
          {
            title: "Platform",
            links: [
              { label: "How It Works", href: "/how-it-works" },
              { label: "Pricing", href: "/pricing" },
            ],
          },
          {
            title: "Company",
            links: [{ label: "About", href: "/about" }],
          },
        ],
        legalLinks: [
          { label: "Privacy", href: "/privacy" },
          { label: "Terms", href: "/terms" },
        ],
      },
    });
    expect(result).not.toBeNull();
  });

  it("rejects an empty columns array", () => {
    expect(
      parseBlockData({
        type: BLOCK_TYPES.SITE_FOOTER,
        data: { columns: [] },
      }),
    ).toBeNull();
  });

  it("rejects a column with no links", () => {
    expect(
      parseBlockData({
        type: BLOCK_TYPES.SITE_FOOTER,
        data: { columns: [{ title: "Empty", links: [] }] },
      }),
    ).toBeNull();
  });

  it("caps columns at 6", () => {
    const columns = Array.from({ length: 7 }, (_, i) => ({
      title: `Col ${i}`,
      links: [{ label: "x", href: "/x" }],
    }));
    expect(
      parseBlockData({
        type: BLOCK_TYPES.SITE_FOOTER,
        data: { columns },
      }),
    ).toBeNull();
  });

  it("rejects javascript: hrefs in column links", () => {
    expect(
      parseBlockData({
        type: BLOCK_TYPES.SITE_FOOTER,
        data: {
          columns: [{ title: "Bad", links: [{ label: "x", href: "javascript:alert(1)" }] }],
        },
      }),
    ).toBeNull();
  });

  it("rejects javascript: hrefs in legalLinks", () => {
    expect(
      parseBlockData({
        type: BLOCK_TYPES.SITE_FOOTER,
        data: {
          columns: [{ title: "Ok", links: [{ label: "x", href: "/x" }] }],
          legalLinks: [{ label: "Bad", href: "javascript:alert(1)" }],
        },
      }),
    ).toBeNull();
  });
});
