// -----------------------------------------------------------------------------
// @file: lib/type-scale/scale.ts
// @purpose: A type scale: a body size and a ratio give every heading and small
//           text size, so the sizes on a page relate to each other. Also
//           writes the scale as CSS variables (fixed, or fluid between a
//           phone and a desktop width) and as a Tailwind theme block. Pure.
// -----------------------------------------------------------------------------

export const RATIOS = [
  { id: "minor-second", label: "Minor second", value: 1.067 },
  { id: "major-second", label: "Major second", value: 1.125 },
  { id: "minor-third", label: "Minor third", value: 1.2 },
  { id: "major-third", label: "Major third", value: 1.25 },
  { id: "perfect-fourth", label: "Perfect fourth", value: 1.333 },
  { id: "augmented-fourth", label: "Augmented fourth", value: 1.414 },
  { id: "perfect-fifth", label: "Perfect fifth", value: 1.5 },
  { id: "golden", label: "Golden ratio", value: 1.618 },
] as const;

export type RatioId = (typeof RATIOS)[number]["id"];

export const BASE_MIN = 12;
export const BASE_MAX = 24;
export const RATIO_MIN = 1.05;
export const RATIO_MAX = 2;
/** The browser's default text size; rem values are a share of it. */
export const ROOT_PX = 16;

/** The steps of the scale, from the smallest text to the largest heading. */
export const STEPS = [
  { id: "xs", label: "Caption", step: -2, role: "Fine print, labels" },
  { id: "sm", label: "Small", step: -1, role: "Secondary text" },
  { id: "base", label: "Body", step: 0, role: "Paragraphs" },
  { id: "h6", label: "Heading 6", step: 1, role: "Smallest heading" },
  { id: "h5", label: "Heading 5", step: 2, role: "Minor heading" },
  { id: "h4", label: "Heading 4", step: 3, role: "Card and section titles" },
  { id: "h3", label: "Heading 3", step: 4, role: "Sub-sections" },
  { id: "h2", label: "Heading 2", step: 5, role: "Sections" },
  { id: "h1", label: "Heading 1", step: 6, role: "Page title" },
] as const;

export type StepId = (typeof STEPS)[number]["id"];

export type ScaleStep = {
  id: StepId;
  label: string;
  role: string;
  step: number;
  px: number;
  rem: number;
  /** A line height that suits the size: roomy for text, tight for large headings. */
  lineHeight: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number, places: number) => {
  const f = 10 ** places;
  return Math.round(value * f) / f;
};

export function cleanBase(value: number | string): number {
  const n = Number(value);
  return Number.isFinite(n) ? clamp(round(n, 1), BASE_MIN, BASE_MAX) : ROOT_PX;
}

export function cleanRatio(value: number | string): number {
  const n = Number(value);
  return Number.isFinite(n) ? clamp(round(n, 3), RATIO_MIN, RATIO_MAX) : 1.25;
}

/** Large text needs less room between its lines than paragraph text. */
export function lineHeightFor(px: number): number {
  if (px <= 20) return 1.5;
  if (px <= 28) return 1.35;
  if (px <= 40) return 1.25;
  if (px <= 64) return 1.15;
  return 1.05;
}

export function typeScale(base: number, ratio: number): ScaleStep[] {
  const b = cleanBase(base);
  const r = cleanRatio(ratio);
  return STEPS.map((s) => {
    const px = round(b * r ** s.step, 2);
    return {
      id: s.id,
      label: s.label,
      role: s.role,
      step: s.step,
      px,
      rem: round(px / ROOT_PX, 3),
      lineHeight: lineHeightFor(px),
    };
  });
}

/** The preset a ratio matches, or null for a custom one. */
export function ratioPreset(ratio: number): (typeof RATIOS)[number] | null {
  return RATIOS.find((r) => Math.abs(r.value - ratio) < 0.0005) ?? null;
}

/** A note when a scale will be hard to use, or null. */
export function scaleWarning(steps: ScaleStep[]): string | null {
  const largest = steps[steps.length - 1];
  const smallest = steps[0];
  if (smallest.px < 10) {
    return `The smallest size is ${smallest.px}px, which is hard to read. Use a larger body size or a smaller ratio.`;
  }
  if (largest.px > 96) {
    return `Heading 1 is ${Math.round(largest.px)}px, which will overflow a phone screen. Use a smaller ratio, or turn on fluid sizes.`;
  }
  return null;
}

export type FluidOptions = {
  /** The ratio on the narrowest screen; headings grow less there. */
  minRatio: number;
  minViewport: number;
  maxViewport: number;
};

export const DEFAULT_FLUID: FluidOptions = { minRatio: 1.2, minViewport: 360, maxViewport: 1280 };

/**
 * A size that grows with the screen: `clamp(min, intercept + slope, max)`.
 * Sizes are in rem, so they still follow the reader's own text size setting.
 */
export function fluidSize(
  minPx: number,
  maxPx: number,
  minViewport: number,
  maxViewport: number,
): string {
  const lo = Math.min(minPx, maxPx);
  const hi = Math.max(minPx, maxPx);
  if (hi - lo < 0.05 || maxViewport <= minViewport) return `${round(hi / ROOT_PX, 3)}rem`;
  const slope = (maxPx - minPx) / (maxViewport - minViewport);
  const intercept = minPx - slope * minViewport;
  return `clamp(${round(lo / ROOT_PX, 3)}rem, ${round(intercept / ROOT_PX, 3)}rem + ${round(slope * 100, 3)}vw, ${round(hi / ROOT_PX, 3)}rem)`;
}

/** Each step's CSS value: fixed rem, or a fluid clamp() when `fluid` is given. */
export function scaleValues(
  base: number,
  ratio: number,
  fluid: FluidOptions | null,
): { step: ScaleStep; value: string }[] {
  const steps = typeScale(base, ratio);
  if (!fluid) return steps.map((step) => ({ step, value: `${step.rem}rem` }));
  const small = typeScale(base, Math.min(cleanRatio(fluid.minRatio), cleanRatio(ratio)));
  return steps.map((step, i) => ({
    step,
    value: fluidSize(small[i].px, step.px, fluid.minViewport, fluid.maxViewport),
  }));
}

export function scaleCss(base: number, ratio: number, fluid: FluidOptions | null): string {
  const values = scaleValues(base, ratio, fluid);
  const lines = [
    `/* Type scale: ${cleanBase(base)}px body, ratio ${cleanRatio(ratio)}${fluid ? `, fluid from ${fluid.minViewport}px to ${fluid.maxViewport}px` : ""} */`,
    ":root {",
    ...values.map(({ step, value }) => `  --text-${step.id}: ${value};`),
    ...values.map(({ step }) => `  --leading-${step.id}: ${step.lineHeight};`),
    "}",
    "",
    "body { font-size: var(--text-base); line-height: var(--leading-base); }",
    "small { font-size: var(--text-sm); }",
    ...values
      .filter(({ step }) => step.id.startsWith("h"))
      .reverse()
      .map(
        ({ step }) =>
          `${step.id} { font-size: var(--text-${step.id}); line-height: var(--leading-${step.id}); }`,
      ),
  ];
  return `${lines.join("\n")}\n`;
}

/** The scale as a Tailwind v4 `@theme` block (`text-h1`, `text-base`, …). */
export function scaleTailwind(base: number, ratio: number, fluid: FluidOptions | null): string {
  const values = scaleValues(base, ratio, fluid);
  const lines = [
    "@theme {",
    ...values.flatMap(({ step, value }) => [
      `  --text-${step.id}: ${value};`,
      `  --text-${step.id}--line-height: ${step.lineHeight};`,
    ]),
    "}",
  ];
  return `${lines.join("\n")}\n`;
}

/** The scale as a table of text, for pasting into a brief or a brand guide. */
export function scaleText(base: number, ratio: number): string {
  return `${typeScale(base, ratio)
    .slice()
    .reverse()
    .map((s) => `${s.label}: ${s.px}px (${s.rem}rem), line height ${s.lineHeight}`)
    .join("\n")}\n`;
}
