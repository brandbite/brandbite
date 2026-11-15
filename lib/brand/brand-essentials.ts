// -----------------------------------------------------------------------------
// @file: lib/brand/brand-essentials.ts
// @purpose: The five things a brand guide needs before a creative can work
//           from it, and which tab of the brand guide page each one lives on.
//           No server imports, so the page and its tests share it.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-11-15
// -----------------------------------------------------------------------------

export type BrandGuideTab = "about" | "language" | "visual" | "files";

export type BrandEssentialKey = "about" | "language" | "colors" | "fonts" | "logo";

export type BrandEssential = {
  key: BrandEssentialKey;
  done: boolean;
  /** Where to fill it in. */
  tab: BrandGuideTab;
  /** What to do next when it isn't done. */
  action: string;
};

export type BrandEssentialsInput = {
  description: string;
  toneWords: number;
  colors: number;
  fonts: number;
  hasPrimaryLogo: boolean;
};

export function brandEssentials(input: BrandEssentialsInput): BrandEssential[] {
  return [
    {
      key: "about",
      done: input.description.trim().length > 0,
      tab: "about",
      action: "Describe what you do",
    },
    { key: "language", done: input.toneWords > 0, tab: "language", action: "Add tone words" },
    { key: "colors", done: input.colors > 0, tab: "visual", action: "Add a brand color" },
    { key: "fonts", done: input.fonts > 0, tab: "visual", action: "Add a font" },
    { key: "logo", done: input.hasPrimaryLogo, tab: "files", action: "Add a primary logo" },
  ];
}
