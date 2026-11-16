import { describe, expect, it } from "vitest";

import { buildBrandContext, type BrandContextSource } from "@/lib/brand/brand-context";
import { readBrandColors, readBrandFonts } from "@/lib/brand/brand-data";

const FULL: BrandContextSource = {
  name: "Northwind",
  tagline: "Coffee that shows up",
  description: "A coffee subscription for small offices.",
  audience: "Office managers at 10–50 person companies",
  values: ["reliable", "warm"],
  toneWords: ["friendly", "direct"],
  voiceNotes: "Short sentences. No jargon.",
  voiceDo: ["Say what happens next"],
  voiceDont: ["Hype"],
  wordsToUse: ["fresh"],
  wordsToAvoid: ["synergy"],
  sampleCopy: "Your beans land Monday.",
  colors: [
    { id: "a", hex: "#1f3a5f", name: "Harbor", role: "primary" },
    { id: "b", hex: "#3ddc97" },
  ],
  fonts: [{ id: "f", name: "Inter", role: "body" }],
  imageryNotes: "Natural light, real desks.",
};

describe("buildBrandContext", () => {
  it("returns null without a source or with only a name", () => {
    expect(buildBrandContext(null, "text")).toBeNull();
    expect(buildBrandContext({ name: "Northwind" }, "text")).toBeNull();
    expect(buildBrandContext({ name: "Northwind" }, "brief")).toBeNull();
    expect(buildBrandContext({ name: "Northwind" }, "image")).toBeNull();
  });

  it("gives image models one line about the look and tone", () => {
    const context = buildBrandContext(FULL, "image");
    expect(context).toBe(
      "Brand guide — Brand colors: Harbor #1f3a5f (primary), #3ddc97; Fonts: Inter (body); " +
        "Imagery: Natural light, real desks.; Tone: friendly, direct; Voice: Short sentences. No jargon..",
    );
    expect(context).not.toContain("synergy");
  });

  it("clips long values in image prompts", () => {
    const context = buildBrandContext({ voiceNotes: "x".repeat(900) }, "image")!;
    expect(context.length).toBeLessThan(340);
    expect(context).toContain("…");
  });

  it("gives copy the identity and language, not the look", () => {
    const context = buildBrandContext(FULL, "text")!;
    expect(context.split("\n")[0]).toBe("Brand guide (write in this brand's voice):");
    expect(context).toContain("Brand: Northwind");
    expect(context).toContain("Audience: Office managers at 10–50 person companies");
    expect(context).toContain("Words to avoid: synergy");
    expect(context).not.toContain("Brand colors");
  });

  it("gives briefs everything", () => {
    const context = buildBrandContext(FULL, "brief")!;
    expect(context).toContain("Brand colors: Harbor #1f3a5f (primary), #3ddc97");
    expect(context).toContain("Sample copy: Your beans land Monday.");
  });

  it("skips blank entries and collapses whitespace", () => {
    const context = buildBrandContext(
      { toneWords: [" calm ", "", "  "], voiceNotes: "Line one.\n\nLine two." },
      "text",
    )!;
    expect(context).toContain("Tone: calm");
    expect(context).toContain("Voice: Line one. Line two.");
  });
});

describe("brand JSON readers", () => {
  it("keeps valid colors and normalises the hex", () => {
    expect(
      readBrandColors([
        { id: "a", hex: "F60", name: " Sunset ", role: "accent", pantone: "165 C" },
        { hex: "not a color" },
        "#123456",
        { hex: "#123456", role: "hero" },
      ]),
    ).toEqual([
      { id: "a", hex: "#ff6600", name: "Sunset", role: "accent", pantone: "165 C" },
      { id: "color-3", hex: "#123456" },
    ]);
    expect(readBrandColors(null)).toEqual([]);
    expect(readBrandColors("x")).toEqual([]);
  });

  it("keeps named fonts and only https links", () => {
    expect(
      readBrandFonts([
        { id: "f", name: "Inter", role: "heading", url: "https://fonts.google.com/specimen/Inter" },
        { name: "Georgia", url: "javascript:alert(1)" },
        { role: "body" },
      ]),
    ).toEqual([
      {
        id: "f",
        name: "Inter",
        role: "heading",
        url: "https://fonts.google.com/specimen/Inter",
      },
      { id: "font-1", name: "Georgia" },
    ]);
    expect(readBrandFonts(undefined)).toEqual([]);
  });
});
