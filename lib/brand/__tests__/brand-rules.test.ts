import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import {
  brandAssetKey,
  brandFileContentType,
  brandFileProblem,
  BRAND_FILE_MAX_BYTES,
  isBrandFilePreviewable,
} from "@/lib/brand/brand-files";
import { updateBrandAssetSchema, updateBrandSchema } from "@/lib/brand/brand-schema";
import { colorsFromLegacy, fontsFromLegacy } from "@/lib/brand/brand.server";

describe("brand files", () => {
  it("accepts vector and design files, whatever the case", () => {
    for (const name of ["logo.svg", "Logo.AI", "mark.eps", "guide.pdf", "kit.zip", "a.b.PSD"]) {
      expect(brandFileProblem({ name, size: 10 })).toBeNull();
    }
  });

  it("rejects other types, empty files and files over the limit", () => {
    expect(brandFileProblem({ name: "run.exe", size: 10 })).toMatch(/isn't supported/);
    expect(brandFileProblem({ name: "page.html", size: 10 })).toMatch(/isn't supported/);
    expect(brandFileProblem({ name: "noextension", size: 10 })).toMatch(/isn't supported/);
    expect(brandFileProblem({ name: "logo.svg", size: 0 })).toMatch(/empty/);
    expect(brandFileProblem({ name: "logo.svg", size: BRAND_FILE_MAX_BYTES + 1 })).toMatch(
      /200 MB/,
    );
  });

  it("takes the content type from the extension only", () => {
    expect(brandFileContentType("logo.SVG")).toBe("image/svg+xml");
    expect(brandFileContentType("logo.ai")).toBe("application/octet-stream");
    expect(brandFileContentType("guide.pdf")).toBe("application/pdf");
  });

  it("previews only what an <img> can show", () => {
    expect(isBrandFilePreviewable("logo.svg")).toBe(true);
    expect(isBrandFilePreviewable("logo.png")).toBe(true);
    expect(isBrandFilePreviewable("logo.ai")).toBe(false);
    expect(isBrandFilePreviewable("guide.pdf")).toBe(false);
  });

  it("builds a storage key with no path tricks in it", () => {
    expect(brandAssetKey("b1", "a1", "../../My Logo (final).svg")).toBe(
      "brands/b1/a1_.._.._My_Logo__final_.svg",
    );
    expect(brandAssetKey("b1", "a1", "   ")).toBe("brands/b1/a1_file");
  });
});

describe("brand edits", () => {
  it("leaves fields that weren't sent alone", () => {
    const parsed = updateBrandSchema.parse({ tagline: "Hello" });
    expect(parsed).toEqual({ tagline: "Hello" });
  });

  it("clears a field on an empty string and tidies lists", () => {
    const parsed = updateBrandSchema.parse({
      tagline: "   ",
      toneWords: [" warm ", "", "warm", "direct"],
    });
    expect(parsed.tagline).toBeNull();
    expect(parsed.toneWords).toEqual(["warm", "direct"]);
  });

  it("normalises colors and refuses a bad hex", () => {
    const parsed = updateBrandSchema.parse({
      colors: [{ id: "a", hex: "F60", role: "primary" }],
    });
    expect(parsed.colors).toEqual([{ id: "a", hex: "#ff6600", role: "primary" }]);

    const bad = updateBrandSchema.safeParse({ colors: [{ id: "a", hex: "orange" }] });
    expect(bad.success).toBe(false);
  });

  it("refuses a font without a name and too many list entries", () => {
    expect(updateBrandSchema.safeParse({ fonts: [{ role: "body" }] }).success).toBe(false);
    const many = Array.from({ length: 13 }, (_, i) => `word ${i}`);
    expect(updateBrandSchema.safeParse({ toneWords: many }).success).toBe(false);
  });

  it("only allows known file kinds", () => {
    expect(updateBrandAssetSchema.safeParse({ kind: "LOGO_ICON" }).success).toBe(true);
    expect(updateBrandAssetSchema.safeParse({ kind: "VIRUS" }).success).toBe(false);
  });
});

describe("older project fields", () => {
  it("reads hex colors and skips anything else", () => {
    expect(colorsFromLegacy("#ff6600, #1E293B,navy, #ff6600")).toEqual([
      { id: "color-0", hex: "#ff6600" },
      { id: "color-1", hex: "#1e293b" },
    ]);
    expect(colorsFromLegacy(null)).toEqual([]);
  });

  it("reads font names", () => {
    expect(fontsFromLegacy("Inter, Source Serif 4, Inter")).toEqual([
      { id: "font-0", name: "Inter" },
      { id: "font-1", name: "Source Serif 4" },
    ]);
    expect(fontsFromLegacy("")).toEqual([]);
  });
});
