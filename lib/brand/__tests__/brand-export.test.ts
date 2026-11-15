import { describe, expect, it } from "vitest";

import { brandExportFileName, brandToJson, brandToMarkdown } from "@/lib/brand/brand-export";

const BRAND = {
  name: "Northwind",
  tagline: "Coffee that shows up",
  description: "",
  audience: null,
  values: ["reliable", " warm ", ""],
  toneWords: ["friendly"],
  voiceDont: ["Hype"],
  colors: [
    { id: "a", hex: "#1f3a5f", name: "Harbor", role: "primary" as const, pantone: "534 C" },
    { id: "b", hex: "#3ddc97" },
  ],
  fonts: [{ id: "f", name: "Inter", role: "body" as const, url: "https://fonts.google.com" }],
};

describe("brandToMarkdown", () => {
  it("writes only the sections that have something in them", () => {
    const md = brandToMarkdown(BRAND, [{ name: "logo.svg", kind: "LOGO_PRIMARY" }]);
    expect(md.startsWith("# Northwind brand guide\n")).toBe(true);
    expect(md).toContain("**Tagline:** Coffee that shows up");
    expect(md).toContain("**Values:** reliable, warm");
    expect(md).toContain("**Never write like this:**\n- Hype");
    expect(md).toContain("- Harbor: #1f3a5f (primary, 534 C)");
    expect(md).toContain("- #3ddc97\n");
    expect(md).toContain("- Inter (body), https://fonts.google.com");
    expect(md).toContain("- logo.svg (Primary logo)");
    expect(md).not.toContain("## Imagery");
    expect(md).not.toContain("What they do");
  });

  it("is just a title for an empty brand", () => {
    expect(brandToMarkdown({ name: " " })).toBe(
      "# Brand brand guide\n\nFollow this guide for any visual or copy made for Brand.\n",
    );
  });
});

describe("brandToJson", () => {
  it("leaves out empty fields and editor ids", () => {
    const json = JSON.parse(brandToJson(BRAND));
    expect(json).toEqual({
      name: "Northwind",
      tagline: "Coffee that shows up",
      values: ["reliable", "warm"],
      toneWords: ["friendly"],
      voiceDont: ["Hype"],
      colors: [
        { hex: "#1f3a5f", name: "Harbor", role: "primary", pantone: "534 C" },
        { hex: "#3ddc97" },
      ],
      fonts: [{ name: "Inter", role: "body", url: "https://fonts.google.com" }],
    });
  });
});

describe("brandExportFileName", () => {
  it("makes a plain file name", () => {
    expect(brandExportFileName("Northwind & Co.", "json")).toBe("northwind-co-brand-guide.json");
    expect(brandExportFileName("???", "md")).toBe("brand-brand-guide.md");
  });
});
