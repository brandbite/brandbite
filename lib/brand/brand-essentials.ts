// -----------------------------------------------------------------------------
// @file: lib/brand/brand-essentials.ts
// @purpose: The five things a brand guide needs before a creative can work
//           from it: which tab of the brand guide page each one lives on, and
//           why it is worth filling in.
//           No server imports, so the page and its tests share it.
// @version: v1.1.0
// @status: active
// @lastUpdate: 2026-11-15
// -----------------------------------------------------------------------------

export type BrandGuideTab = "about" | "language" | "visual" | "files";

export type BrandEssentialKey = "about" | "language" | "colors" | "fonts" | "logo";

export type BrandEssential = {
  key: BrandEssentialKey;
  /** One or two words, under its part of the progress bar. */
  label: string;
  done: boolean;
  /** Where to fill it in. */
  tab: BrandGuideTab;
  /** What to do next when it isn't done. */
  action: string;
  /** What the customer gets out of filling it in. One sentence. */
  why: string;
};

export type BrandEssentialsInput = {
  description: string;
  toneWords: number;
  colors: number;
  fonts: number;
  hasPrimaryLogo: boolean;
};

/** Shown once all five are there. */
export const BRAND_ESSENTIALS_DONE =
  "Your creatives and our AI tools now work from this guide. Update it when the brand changes.";

export function brandEssentials(input: BrandEssentialsInput): BrandEssential[] {
  return [
    {
      key: "about",
      label: "About",
      done: input.description.trim().length > 0,
      tab: "about",
      action: "Describe what you do",
      why: "Every brief starts from this, so you don't explain your business again on each request.",
    },
    {
      key: "language",
      label: "Language",
      done: input.toneWords > 0,
      tab: "language",
      action: "Add tone words",
      why: "Copy and briefs come back sounding like your brand, not like a template.",
    },
    {
      key: "colors",
      label: "Colors",
      done: input.colors > 0,
      tab: "visual",
      action: "Add a brand color",
      why: "Creatives and AI visuals use your exact colors instead of guessing them.",
    },
    {
      key: "fonts",
      label: "Fonts",
      done: input.fonts > 0,
      tab: "visual",
      action: "Add a font",
      why: "Designs come in your own typefaces from the first draft.",
    },
    {
      key: "logo",
      label: "Logo",
      done: input.hasPrimaryLogo,
      tab: "files",
      action: "Add a primary logo",
      why: "Creatives download the original file here and never have to ask you for it.",
    },
  ];
}
