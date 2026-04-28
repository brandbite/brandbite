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
  it("accepts a single-Q FAQ", () => {
    const result = parseBlockData({
      type: BLOCK_TYPES.FAQ,
      data: { qas: [{ q: "Q?", a: "A." }] },
    });
    expect(result).not.toBeNull();
  });

  it("rejects FAQ with no questions", () => {
    expect(
      parseBlockData({
        type: BLOCK_TYPES.FAQ,
        data: { qas: [] },
      }),
    ).toBeNull();
  });

  it("rejects FAQ with empty question text", () => {
    expect(
      parseBlockData({
        type: BLOCK_TYPES.FAQ,
        data: { qas: [{ q: "", a: "A" }] },
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
