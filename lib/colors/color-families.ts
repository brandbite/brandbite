// -----------------------------------------------------------------------------
// @file: lib/colors/color-families.ts
// @purpose: Built-in color families for Color Meanings. CMS entries take priority
//           by slug; these fill the gaps, so every color a visitor looks up has a
//           family to describe it, including when the CMS can't be reached.
// -----------------------------------------------------------------------------

import type { ColorFamilySlug } from "./describe";

export interface ColorFamily {
  slug: ColorFamilySlug;
  name: string;
  hex: string;
  summary: string;
  associations: string[];
}

export const COLOR_FAMILIES: ColorFamily[] = [
  {
    slug: "red",
    name: "Red",
    hex: "#e63946",
    summary: "Energy, passion, and urgency.",
    associations: ["passion", "energy", "urgency"],
  },
  {
    slug: "orange",
    name: "Orange",
    hex: "#f4801f",
    summary: "Warm, upbeat, and full of energy.",
    associations: ["warmth", "enthusiasm", "creativity"],
  },
  {
    slug: "yellow",
    name: "Yellow",
    hex: "#ffd60a",
    summary: "Bright, optimistic, and attention-catching.",
    associations: ["optimism", "clarity", "attention"],
  },
  {
    slug: "green",
    name: "Green",
    hex: "#2a9d8f",
    summary: "Natural, balanced, and growing.",
    associations: ["growth", "health", "balance"],
  },
  {
    slug: "teal",
    name: "Teal",
    hex: "#14919b",
    summary: "Calm like blue, with some of green's freshness.",
    associations: ["clarity", "calm", "renewal"],
  },
  {
    slug: "blue",
    name: "Blue",
    hex: "#0077b6",
    summary: "Calm, trustworthy, and professional.",
    associations: ["trust", "calm", "professionalism"],
  },
  {
    slug: "purple",
    name: "Purple",
    hex: "#7b2cbf",
    summary: "Imaginative, with a sense of luxury.",
    associations: ["luxury", "creativity", "imagination"],
  },
  {
    slug: "pink",
    name: "Pink",
    hex: "#f472b6",
    summary: "Playful and warm, from soft and gentle to bold and modern.",
    associations: ["playfulness", "warmth", "care"],
  },
  {
    slug: "brown",
    name: "Brown",
    hex: "#8b5a2b",
    summary: "Grounded, natural, and dependable.",
    associations: ["reliability", "warmth", "craft"],
  },
  {
    slug: "gray",
    name: "Gray",
    hex: "#6b7280",
    summary: "Neutral and composed, and lets other colors stand out.",
    associations: ["balance", "restraint", "modernity"],
  },
  {
    slug: "black",
    name: "Black",
    hex: "#212529",
    summary: "Sophisticated, powerful, and elegant.",
    associations: ["sophistication", "power", "elegance"],
  },
  {
    slug: "white",
    name: "White",
    hex: "#f8f9fa",
    summary: "Simple, clean, and spacious.",
    associations: ["simplicity", "cleanliness", "space"],
  },
];
