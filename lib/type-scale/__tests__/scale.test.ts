import { describe, expect, it } from "vitest";

import {
  cleanBase,
  cleanRatio,
  DEFAULT_FLUID,
  fluidSize,
  lineHeightFor,
  ratioPreset,
  scaleCss,
  scaleTailwind,
  scaleText,
  scaleValues,
  scaleWarning,
  STEPS,
  typeScale,
} from "../scale";

describe("type scale", () => {
  it("multiplies up and down from the body size", () => {
    const steps = typeScale(16, 1.25);
    expect(steps.map((s) => s.id)).toEqual(STEPS.map((s) => s.id));
    const px = Object.fromEntries(steps.map((s) => [s.id, s.px]));
    expect(px.base).toBe(16);
    expect(px.sm).toBe(12.8);
    expect(px.xs).toBe(10.24);
    expect(px.h6).toBe(20);
    expect(px.h5).toBe(25);
    expect(px.h1).toBe(61.04);
    expect(steps.find((s) => s.id === "h6")!.rem).toBe(1.25);
    // Sizes only ever grow.
    steps.reduce((previous, step) => {
      expect(step.px).toBeGreaterThan(previous);
      return step.px;
    }, 0);
  });

  it("keeps the inputs in a sensible range", () => {
    expect(cleanBase("16")).toBe(16);
    expect(cleanBase(4)).toBe(12);
    expect(cleanBase(90)).toBe(24);
    expect(cleanBase("abc")).toBe(16);
    expect(cleanRatio("1.3333")).toBe(1.333);
    expect(cleanRatio(1)).toBe(1.05);
    expect(cleanRatio(9)).toBe(2);
    expect(cleanRatio("")).toBe(1.05);
    expect(cleanRatio("x")).toBe(1.25);
  });

  it("tightens line height as text grows", () => {
    expect(lineHeightFor(16)).toBe(1.5);
    expect(lineHeightFor(25)).toBe(1.35);
    expect(lineHeightFor(48)).toBe(1.15);
    expect(lineHeightFor(90)).toBe(1.05);
  });

  it("names a preset ratio and warns about unusable scales", () => {
    expect(ratioPreset(1.333)?.id).toBe("perfect-fourth");
    expect(ratioPreset(1.3)).toBeNull();
    expect(scaleWarning(typeScale(16, 1.2))).toBeNull();
    expect(scaleWarning(typeScale(12, 1.3))).toMatch(/hard to read/);
    expect(scaleWarning(typeScale(24, 1.3))).toMatch(/overflow a phone/);
  });

  it("writes a fluid size that hits both ends exactly", () => {
    const value = fluidSize(32, 64, 360, 1280);
    expect(value).toBe("clamp(2rem, 1.217rem + 3.478vw, 4rem)");
    // At each end of the range the middle term equals that end's size.
    const at = (viewport: number) => 1.217 * 16 + (3.478 / 100) * viewport;
    expect(at(360)).toBeCloseTo(32, 0);
    expect(at(1280)).toBeCloseTo(64, 0);
    // No growth, no clamp.
    expect(fluidSize(16, 16, 360, 1280)).toBe("1rem");
  });

  it("keeps the body fixed and lets headings grow in a fluid scale", () => {
    const values = scaleValues(16, 1.333, DEFAULT_FLUID);
    const of = (id: string) => values.find((v) => v.step.id === id)!.value;
    expect(of("base")).toBe("1rem");
    expect(of("h1")).toMatch(/^clamp\(2\.986rem, .+vw, 5\.61rem\)$/);
    // A phone ratio above the main ratio is ignored rather than shrinking on desktop.
    expect(
      scaleValues(16, 1.2, { ...DEFAULT_FLUID, minRatio: 1.5 }).every(
        (v) => !v.value.includes("clamp"),
      ),
    ).toBe(true);
    expect(scaleValues(16, 1.25, null).find((v) => v.step.id === "h6")!.value).toBe("1.25rem");
  });

  it("writes CSS, a Tailwind theme and plain text", () => {
    const css = scaleCss(16, 1.25, null);
    expect(css).toContain("--text-base: 1rem;");
    expect(css).toContain("--text-h1: 3.815rem;");
    expect(css).toContain("--leading-h1: 1.15;");
    expect(css).toContain("h1 { font-size: var(--text-h1); line-height: var(--leading-h1); }");
    expect(css.indexOf("h1 {")).toBeLessThan(css.indexOf("h6 {"));
    expect(scaleCss(16, 1.25, DEFAULT_FLUID)).toContain("fluid from 360px to 1280px");

    const tailwind = scaleTailwind(16, 1.25, null);
    expect(tailwind.startsWith("@theme {")).toBe(true);
    expect(tailwind).toContain("--text-h2: 3.052rem;");
    expect(tailwind).toContain("--text-h2--line-height: 1.15;");

    const text = scaleText(16, 1.25);
    expect(text.split("\n")[0]).toBe("Heading 1: 61.04px (3.815rem), line height 1.15");
    expect(text).toContain("Body: 16px (1rem), line height 1.5");
  });
});
