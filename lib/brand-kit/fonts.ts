// -----------------------------------------------------------------------------
// @file: lib/brand-kit/fonts.ts
// @purpose: Font metadata and curated heading/body pairings for the brand kit
//           and the font pairing pages. Plain data (no next/font import) so
//           tests and the sitemap can read it.
// -----------------------------------------------------------------------------

export type FontCategory = "serif" | "sans-serif" | "display";

export type FontInfo = {
  id: string;
  name: string;
  category: FontCategory;
  /** Fallback stack after the font itself. */
  fallback: string;
};

const SANS = "system-ui, sans-serif";
const SERIF = "Georgia, serif";

export const FONTS: FontInfo[] = [
  { id: "archivo-black", name: "Archivo Black", category: "display", fallback: SANS },
  { id: "bebas-neue", name: "Bebas Neue", category: "display", fallback: SANS },
  {
    id: "bricolage-grotesque",
    name: "Bricolage Grotesque",
    category: "sans-serif",
    fallback: SANS,
  },
  { id: "cormorant-garamond", name: "Cormorant Garamond", category: "serif", fallback: SERIF },
  { id: "dm-sans", name: "DM Sans", category: "sans-serif", fallback: SANS },
  { id: "dm-serif-display", name: "DM Serif Display", category: "serif", fallback: SERIF },
  { id: "fraunces", name: "Fraunces", category: "serif", fallback: SERIF },
  { id: "fredoka", name: "Fredoka", category: "sans-serif", fallback: SANS },
  { id: "ibm-plex-sans", name: "IBM Plex Sans", category: "sans-serif", fallback: SANS },
  { id: "inter", name: "Inter", category: "sans-serif", fallback: SANS },
  { id: "karla", name: "Karla", category: "sans-serif", fallback: SANS },
  { id: "lato", name: "Lato", category: "sans-serif", fallback: SANS },
  { id: "lexend", name: "Lexend", category: "sans-serif", fallback: SANS },
  { id: "libre-baskerville", name: "Libre Baskerville", category: "serif", fallback: SERIF },
  { id: "lora", name: "Lora", category: "serif", fallback: SERIF },
  { id: "manrope", name: "Manrope", category: "sans-serif", fallback: SANS },
  { id: "merriweather", name: "Merriweather", category: "serif", fallback: SERIF },
  { id: "montserrat", name: "Montserrat", category: "sans-serif", fallback: SANS },
  { id: "nunito", name: "Nunito", category: "sans-serif", fallback: SANS },
  { id: "open-sans", name: "Open Sans", category: "sans-serif", fallback: SANS },
  { id: "outfit", name: "Outfit", category: "sans-serif", fallback: SANS },
  { id: "playfair-display", name: "Playfair Display", category: "serif", fallback: SERIF },
  { id: "poppins", name: "Poppins", category: "sans-serif", fallback: SANS },
  { id: "sora", name: "Sora", category: "sans-serif", fallback: SANS },
  { id: "source-sans-3", name: "Source Sans 3", category: "sans-serif", fallback: SANS },
  { id: "space-grotesk", name: "Space Grotesk", category: "sans-serif", fallback: SANS },
  { id: "syne", name: "Syne", category: "sans-serif", fallback: SANS },
  { id: "work-sans", name: "Work Sans", category: "sans-serif", fallback: SANS },
];

export function getFont(id: string): FontInfo {
  const font = FONTS.find((candidate) => candidate.id === id);
  if (!font) throw new Error(`Unknown font: ${id}`);
  return font;
}

/** Google Fonts page for a font, for people who want to download it. */
export function googleFontsUrl(font: FontInfo): string {
  return `https://fonts.google.com/specimen/${font.name.replace(/ /g, "+")}`;
}

export const PERSONALITIES = [
  "Modern",
  "Classic",
  "Playful",
  "Luxury",
  "Techy",
  "Friendly",
  "Bold",
] as const;

export type Personality = (typeof PERSONALITIES)[number];

export type FontPairing = {
  slug: string;
  heading: string;
  body: string;
  personalities: Personality[];
  /** Why the two work together; unique copy per pairing. */
  why: string;
  bestFor: string;
};

function pairing(
  heading: string,
  body: string,
  personalities: Personality[],
  why: string,
  bestFor: string,
): FontPairing {
  return { slug: `${heading}-and-${body}`, heading, body, personalities, why, bestFor };
}

export const FONT_PAIRINGS: FontPairing[] = [
  pairing(
    "playfair-display",
    "source-sans-3",
    ["Classic", "Luxury"],
    "Playfair Display's sharp contrast between thick and thin strokes gives headlines an editorial feel. Source Sans 3 is plain and open, so long paragraphs stay easy to read next to it.",
    "Magazines, boutique hotels, fashion and lifestyle brands.",
  ),
  pairing(
    "playfair-display",
    "lato",
    ["Luxury", "Classic"],
    "A high-contrast serif over a warm, rounded sans. Lato softens Playfair's formality, which suits brands that want to feel premium without feeling cold.",
    "Wedding and event businesses, interior design, skincare.",
  ),
  pairing(
    "montserrat",
    "merriweather",
    ["Classic", "Modern"],
    "A geometric sans for headlines and a sturdy serif built for screens. The contrast between the two makes it obvious which text is a heading and which is reading text.",
    "Blogs, consultancies, nonprofits and publishing.",
  ),
  pairing(
    "montserrat",
    "open-sans",
    ["Modern", "Friendly"],
    "Two clean sans-serifs with different personalities: Montserrat is wide and geometric, Open Sans is neutral and compact. A safe, flexible choice that works almost everywhere.",
    "Startups, agencies, corporate sites and apps.",
  ),
  pairing(
    "space-grotesk",
    "inter",
    ["Techy", "Modern"],
    "Space Grotesk has quirky details, like its distinctive lowercase forms, that give headlines character. Inter was designed for interfaces, so body text and small labels stay crisp.",
    "SaaS, developer tools, fintech and product sites.",
  ),
  pairing(
    "space-grotesk",
    "lora",
    ["Techy", "Classic"],
    "A technical grotesk paired with a calligraphic serif. The mix reads as smart and human at once, which helps tech brands that want to sound less like a machine.",
    "Research labs, climate tech, thoughtful newsletters.",
  ),
  pairing(
    "dm-serif-display",
    "dm-sans",
    ["Modern", "Luxury"],
    "Two members of the same family, drawn to work together. The serif brings drama to large headings while the sans keeps everything else tidy and consistent.",
    "Restaurants, galleries, premium e-commerce.",
  ),
  pairing(
    "poppins",
    "lora",
    ["Friendly", "Classic"],
    "Poppins' round geometric shapes feel approachable; Lora's gentle curves make paragraphs feel personal. Together they are warm without being childish.",
    "Coaches, wellness brands, education.",
  ),
  pairing(
    "poppins",
    "inter",
    ["Modern", "Friendly"],
    "A friendly geometric display face over a highly legible interface font. It looks current and keeps forms, tables and buttons easy to scan.",
    "Apps, marketplaces, B2B SaaS dashboards.",
  ),
  pairing(
    "fraunces",
    "work-sans",
    ["Playful", "Classic"],
    "Fraunces is a soft, slightly wonky serif with an old-style feel; Work Sans is simple and grounded. The pair feels crafted and a little cheeky.",
    "Bakeries, coffee brands, independent shops.",
  ),
  pairing(
    "fraunces",
    "inter",
    ["Modern", "Classic"],
    "A characterful serif for big moments and a neutral sans for everything else. It gives a modern product a touch of warmth and tradition.",
    "Fintech for consumers, publishing platforms, food delivery.",
  ),
  pairing(
    "bricolage-grotesque",
    "inter",
    ["Modern", "Playful"],
    "Bricolage Grotesque changes shape as it gets bigger, so large headlines look expressive while Inter keeps the details calm and readable.",
    "Creative studios, launches, event sites.",
  ),
  pairing(
    "bricolage-grotesque",
    "lora",
    ["Playful", "Classic"],
    "An expressive grotesk and a bookish serif. The pairing suits brands that want to feel creative but still trustworthy.",
    "Podcasts, cultural organizations, design schools.",
  ),
  pairing(
    "syne",
    "manrope",
    ["Techy", "Bold"],
    "Syne's wide, unusual letterforms make headlines stand out; Manrope's even rhythm keeps body text clean. Bold and a bit futuristic.",
    "Web3, music, fashion tech and agencies.",
  ),
  pairing(
    "syne",
    "inter",
    ["Bold", "Modern"],
    "A striking display face balanced by a quiet workhorse. Use Syne sparingly for headlines and let Inter do the rest.",
    "Portfolios, product launches, startups that want to look different.",
  ),
  pairing(
    "archivo-black",
    "karla",
    ["Bold", "Playful"],
    "Archivo Black is heavy and confident; Karla is a friendly grotesk with a little quirk. The weight difference makes headlines impossible to miss.",
    "Sports, food trucks, campaigns and posters.",
  ),
  pairing(
    "bebas-neue",
    "open-sans",
    ["Bold", "Modern"],
    "Bebas Neue's tall, all-caps letters fit long headlines in a narrow space. Open Sans is calm enough to sit underneath without competing.",
    "Fitness, events, streetwear and ads.",
  ),
  pairing(
    "libre-baskerville",
    "lato",
    ["Classic", "Friendly"],
    "Libre Baskerville is a traditional book serif adapted for screens. Lato keeps it from feeling stuffy, so the pair reads as established and approachable.",
    "Law firms, accountants, universities.",
  ),
  pairing(
    "cormorant-garamond",
    "montserrat",
    ["Luxury", "Classic"],
    "Cormorant Garamond is delicate and elegant at large sizes; Montserrat adds structure and works well in small caps for labels and navigation.",
    "Jewelry, perfume, high-end real estate.",
  ),
  pairing(
    "sora",
    "ibm-plex-sans",
    ["Techy", "Modern"],
    "Sora is geometric and precise; IBM Plex Sans has engineered details and great readability. A serious, technical pair.",
    "Developer platforms, AI products, B2B infrastructure.",
  ),
  pairing(
    "outfit",
    "nunito",
    ["Friendly", "Playful"],
    "Outfit is clean and geometric; Nunito has rounded ends that feel soft and kind. A cheerful pair that stays readable.",
    "Kids' products, health apps, pet brands.",
  ),
  pairing(
    "fredoka",
    "nunito",
    ["Playful", "Friendly"],
    "Fredoka's bubbly, rounded letters set a fun tone in headlines, and Nunito carries the same softness into body text.",
    "Toys, snacks, games and family brands.",
  ),
  pairing(
    "lexend",
    "lora",
    ["Friendly", "Modern"],
    "Lexend was designed with reading ease in mind; Lora adds warmth to longer text. Clear and kind, good for brands that explain things.",
    "Healthcare, edtech, public services.",
  ),
  pairing(
    "manrope",
    "merriweather",
    ["Modern", "Classic"],
    "A modern sans for headings and a sturdy serif for reading. It suits brands that publish a lot and want to look current.",
    "Media, research, B2B content brands.",
  ),
];

export function getPairing(slug: string): FontPairing | null {
  return FONT_PAIRINGS.find((candidate) => candidate.slug === slug) ?? null;
}

export function pairingsFor(personality: Personality): FontPairing[] {
  return FONT_PAIRINGS.filter((candidate) => candidate.personalities.includes(personality));
}

export function pairingName(pairing: FontPairing): string {
  return `${getFont(pairing.heading).name} and ${getFont(pairing.body).name}`;
}
