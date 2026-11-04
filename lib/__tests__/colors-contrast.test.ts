import { describe, expect, it } from "vitest";

import {
  contrastRatio,
  evaluateContrast,
  formatContrastRatio,
  isLargeText,
  parseOpaqueHex,
  suggestAccessibleColor,
} from "@/lib/colors";

describe("contrastRatio", () => {
  it("returns the WCAG extremes", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 10);
    expect(contrastRatio("#abcdef", "#abcdef")).toBe(1);
  });

  it("matches the design document's reference pairs", () => {
    expect(contrastRatio("#173B59", "#FFFFFF")).toBeCloseTo(11.63, 2);
    expect(contrastRatio("#FF6426", "#FFFFFF")).toBeCloseTo(2.96, 2);
    expect(contrastRatio("#C2410C", "#FFFFFF")).toBeCloseTo(5.18, 2);
  });

  it("is symmetric", () => {
    expect(contrastRatio("#173B59", "#F6E5D5")).toBe(contrastRatio("#F6E5D5", "#173B59"));
  });
});

describe("evaluateContrast", () => {
  it("reports each level independently", () => {
    expect(evaluateContrast("#FF6426", "#FFFFFF")).toMatchObject({
      aaNormal: false,
      aaLarge: false,
      aaaNormal: false,
      aaaLarge: false,
    });
    expect(evaluateContrast("#C2410C", "#FFFFFF")).toMatchObject({
      aaNormal: true,
      aaLarge: true,
      aaaNormal: false,
      aaaLarge: true,
    });
    expect(evaluateContrast("#173B59", "#FFFFFF")).toMatchObject({
      aaNormal: true,
      aaLarge: true,
      aaaNormal: true,
      aaaLarge: true,
    });
  });
});

describe("isLargeText", () => {
  it("applies the regular and bold limits", () => {
    expect(isLargeText(23.99, 400)).toBe(false);
    expect(isLargeText(24, 400)).toBe(true);
    expect(isLargeText(18.67, 600)).toBe(false);
    expect(isLargeText(18.6, 700)).toBe(false);
    expect(isLargeText(18.67, 700)).toBe(true);
  });
});

describe("formatContrastRatio", () => {
  it("never displays a failing ratio at or above a threshold", () => {
    expect(formatContrastRatio(4.499)).toBe("4.49:1");
    expect(formatContrastRatio(2.957)).toBe("2.95:1");
  });

  it("formats the extremes", () => {
    expect(formatContrastRatio(1)).toBe("1.00:1");
    expect(formatContrastRatio(21)).toBe("21.00:1");
  });
});

describe("suggestAccessibleColor", () => {
  it("keeps a passing color", () => {
    expect(suggestAccessibleColor("#173b59", "#ffffff")).toBe("#173b59");
  });

  it("returns a passing color with the same hue", () => {
    const suggestion = suggestAccessibleColor("#FF6426", "#FFFFFF");
    expect(suggestion).not.toBeNull();
    expect(contrastRatio(suggestion as string, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
    expect(suggestion).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("lightens when darkening cannot reach the target", () => {
    const suggestion = suggestAccessibleColor("#444444", "#000000");
    expect(suggestion).not.toBeNull();
    expect(contrastRatio(suggestion as string, "#000000")).toBeGreaterThanOrEqual(4.5);
  });

  it("returns null when no lightness can reach the target", () => {
    expect(suggestAccessibleColor("#777777", "#777777", 7)).toBeNull();
  });
});

describe("parseOpaqueHex", () => {
  it("normalizes #RGB and #RRGGBB", () => {
    expect(parseOpaqueHex("#ABC")).toBe("#aabbcc");
    expect(parseOpaqueHex(" ff6426 ")).toBe("#ff6426");
  });

  it("rejects alpha forms and invalid input", () => {
    expect(parseOpaqueHex("#abcd")).toBeNull();
    expect(parseOpaqueHex("#ff642680")).toBeNull();
    expect(parseOpaqueHex("orange")).toBeNull();
  });
});
