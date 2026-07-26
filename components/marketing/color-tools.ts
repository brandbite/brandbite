// -----------------------------------------------------------------------------
// @file: components/marketing/color-tools.ts
// @purpose: Single source of truth for the color-tool catalog used by the
//           /colors hub cards and the "more tools" strip on each tool page.
//           Copy comes from the Figma Color Tools design.
// -----------------------------------------------------------------------------

export type ColorTool = {
  href: string;
  title: string;
  description: string;
  icon: string;
};

export const COLOR_TOOLS: ColorTool[] = [
  {
    href: "/colors/tailwind-color-generator",
    title: "Tailwind Color Generator",
    // The Figma card carried placeholder copy here; this matches the tool.
    description: "Turn any color into a full Tailwind shade scale, 50 to 950.",
    icon: "/home/tool-tailwind.png",
  },
  {
    href: "/colors/color-palette-generator",
    title: "Palette Generator",
    description: "Create balanced palettes that feel just right, every time.",
    icon: "/home/tool-palette-gen.png",
  },
  {
    href: "/colors/color-wheel",
    title: "Color Wheel",
    description: "Find the perfect hue, match harmonies, and nail the vibe.",
    icon: "/home/tool-wheel.png",
  },
  {
    href: "/colors/color-palette-ideas",
    title: "Palette Ideas",
    description: "Curated combos for every mood, market, and moment.",
    icon: "/home/tool-ideas.png",
  },
  {
    href: "/colors/color-meanings",
    title: "Color Meanings",
    description: "The psychology and personality behind every shade.",
    icon: "/home/tool-meanings.png",
  },
];
