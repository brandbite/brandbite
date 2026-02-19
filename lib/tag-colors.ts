// -----------------------------------------------------------------------------
// @file: lib/tag-colors.ts
// @purpose: Fixed 8-color palette for ticket tags (company-scoped labels)
// -----------------------------------------------------------------------------

export type TagColorKey =
  | "GRAY"
  | "BLUE"
  | "GREEN"
  | "ORANGE"
  | "RED"
  | "PURPLE"
  | "PINK"
  | "YELLOW";

export type TagColorStyle = {
  label: string;
  bg: string;     // Tailwind bg class
  text: string;   // Tailwind text class
  border: string; // Tailwind border class
  dot: string;    // Solid hex color for dot/swatch in color picker
};

export const TAG_COLORS: Record<TagColorKey, TagColorStyle> = {
  GRAY: {
    label: "Gray",
    bg: "bg-[#f5f3f0]",
    text: "text-[#5a5953]",
    border: "border-[#d4d2ce]",
    dot: "#9a9892",
  },
  BLUE: {
    label: "Blue",
    bg: "bg-[#eaf4ff]",
    text: "text-[#1d72b8]",
    border: "border-[#c7d1f7]",
    dot: "#4c8ef7",
  },
  GREEN: {
    label: "Green",
    bg: "bg-[#f0fff6]",
    text: "text-[#137a3a]",
    border: "border-[#b9e2cd]",
    dot: "#32b37b",
  },
  ORANGE: {
    label: "Orange",
    bg: "bg-[#fff0ea]",
    text: "text-[#d6471b]",
    border: "border-[#f5c4ad]",
    dot: "#f15b2b",
  },
  RED: {
    label: "Red",
    bg: "bg-[#fde8e7]",
    text: "text-[#b13832]",
    border: "border-[#f7c7c0]",
    dot: "#d63a35",
  },
  PURPLE: {
    label: "Purple",
    bg: "bg-[#f3eeff]",
    text: "text-[#6b3fa0]",
    border: "border-[#d4c4f0]",
    dot: "#8b5cf6",
  },
  PINK: {
    label: "Pink",
    bg: "bg-[#fdf2f8]",
    text: "text-[#b4366a]",
    border: "border-[#f0c4da]",
    dot: "#ec4899",
  },
  YELLOW: {
    label: "Yellow",
    bg: "bg-[#fff7e0]",
    text: "text-[#8a6b1f]",
    border: "border-[#f7d0a9]",
    dot: "#f5a623",
  },
};

export const TAG_COLOR_KEYS: TagColorKey[] = Object.keys(
  TAG_COLORS,
) as TagColorKey[];

/** Check if a string is a valid TagColorKey */
export function isValidTagColor(value: unknown): value is TagColorKey {
  return (
    typeof value === "string" &&
    TAG_COLOR_KEYS.includes(value as TagColorKey)
  );
}
