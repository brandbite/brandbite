// -----------------------------------------------------------------------------
// @file: components/marketing/color-tools.ts
// @purpose: Single source of truth for the Color Studio tool menu.
// -----------------------------------------------------------------------------

export type StudioNavItem = { href: string; label: string };

/** Color Studio tool menu. URLs stay as they were; only the labels are shorter. */
export const STUDIO_NAV: StudioNavItem[] = [
  { href: "/colors", label: "Overview" },
  { href: "/colors/tailwind-color-generator", label: "Tailwind shades" },
  { href: "/colors/color-palette-generator", label: "Palette generator" },
  { href: "/colors/color-wheel", label: "Color wheel" },
  { href: "/colors/color-palette-ideas", label: "Palette ideas" },
  { href: "/colors/color-meanings", label: "Color meanings" },
];

/** Tools under the "More tools" menu. The menu is hidden while this is empty. */
export const STUDIO_MORE_TOOLS: StudioNavItem[] = [
  { href: "/colors/contrast-checker", label: "Contrast checker" },
  { href: "/colors/image-to-palette", label: "Image to palette" },
  { href: "/colors/hex", label: "Color library" },
];

/** The "Saved" shortcut, shown on every Color Studio page. */
export const STUDIO_SAVED_LINK: StudioNavItem | null = { href: "/colors/saved", label: "Saved" };
