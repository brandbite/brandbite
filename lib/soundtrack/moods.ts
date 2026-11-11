// -----------------------------------------------------------------------------
// @file: lib/soundtrack/moods.ts
// @purpose: The ten moods a request's soundtrack can have, and the simple
//           rules that pick one from the brief (service + keywords). The
//           creative can always change it. No AI yet, on purpose.
//           No server imports, so client components can share it.
// -----------------------------------------------------------------------------

export const MOODS = [
  "ENERGETIC",
  "MINIMAL",
  "LUXURY",
  "PLAYFUL",
  "WARM",
  "BOLD",
  "NOSTALGIC",
  "FUTURISTIC",
  "EARTHY",
  "DREAMY",
] as const;

export type Mood = (typeof MOODS)[number];

export const MOOD_LABELS: Record<Mood, string> = {
  ENERGETIC: "Energetic · Upbeat",
  MINIMAL: "Minimal · Calm",
  LUXURY: "Luxury · Elegant",
  PLAYFUL: "Playful · Fun",
  WARM: "Warm · Friendly",
  BOLD: "Bold · Confident",
  NOSTALGIC: "Nostalgic · Retro",
  FUTURISTIC: "Futuristic · Tech",
  EARTHY: "Earthy · Organic",
  DREAMY: "Dreamy · Soft",
};

export function isMood(value: unknown): value is Mood {
  return typeof value === "string" && (MOODS as readonly string[]).includes(value);
}

/** The AppSetting that holds a mood's playlist links. */
export function moodSettingKey(mood: Mood): string {
  return `SOUNDTRACK_PLAYLISTS_${mood}`;
}

export const SOUNDTRACK_SETTING_KEYS = MOODS.map(moodSettingKey);

const KEYWORDS: Record<Mood, string[]> = {
  ENERGETIC: [
    "energetic",
    "energy",
    "dynamic",
    "sport",
    "fitness",
    "launch",
    "sale",
    "campaign",
    "fast",
    "vibrant",
    "exciting",
    "youth",
    "festival",
    "promo",
  ],
  MINIMAL: [
    "minimal",
    "minimalist",
    "clean",
    "simple",
    "calm",
    "modern",
    "tech",
    "saas",
    "app",
    "dashboard",
    "wireframe",
    "ui",
    "ux",
    "neutral",
    "quiet",
  ],
  LUXURY: [
    "luxury",
    "luxurious",
    "premium",
    "elegant",
    "elegance",
    "high-end",
    "exclusive",
    "sophisticated",
    "jewelry",
    "jewellery",
    "fashion",
    "boutique",
    "gold",
    "refined",
  ],
  PLAYFUL: [
    "playful",
    "fun",
    "kids",
    "children",
    "cartoon",
    "illustration",
    "mascot",
    "quirky",
    "colorful",
    "colourful",
    "game",
    "sticker",
    "cute",
    "toy",
  ],
  WARM: [
    "warm",
    "friendly",
    "cozy",
    "cosy",
    "family",
    "community",
    "handmade",
    "cafe",
    "coffee",
    "bakery",
    "wellness",
    "care",
    "welcoming",
  ],
  BOLD: [
    "bold",
    "strong",
    "confident",
    "powerful",
    "impact",
    "statement",
    "striking",
    "disruptive",
    "rebrand",
    "billboard",
    "poster",
    "headline",
    "edgy",
  ],
  NOSTALGIC: [
    "nostalgic",
    "nostalgia",
    "retro",
    "vintage",
    "classic",
    "heritage",
    "throwback",
    "old-school",
    "70s",
    "80s",
    "90s",
  ],
  FUTURISTIC: [
    "futuristic",
    "future",
    "innovative",
    "innovation",
    "ai",
    "robot",
    "robotics",
    "crypto",
    "web3",
    "neon",
    "cyber",
    "sci-fi",
    "space",
  ],
  EARTHY: [
    "earthy",
    "organic",
    "natural",
    "nature",
    "eco",
    "sustainable",
    "sustainability",
    "botanical",
    "outdoor",
    "farm",
    "rustic",
    "vegan",
    "plant",
  ],
  DREAMY: [
    "dreamy",
    "dream",
    "soft",
    "romantic",
    "pastel",
    "ethereal",
    "delicate",
    "gentle",
    "wedding",
    "bridal",
    "floral",
    "whimsical",
  ],
};

/** Fallback when nothing in the brief points anywhere: calm focus music. */
export const DEFAULT_MOOD: Mood = "MINIMAL";

/**
 * Picks a mood from the request's text. Each keyword found as a whole word
 * scores one point for its mood; the highest score wins, ties go to the
 * earlier mood in MOODS, and no hits at all gives DEFAULT_MOOD.
 */
export function detectMood(...texts: (string | null | undefined)[]): Mood {
  const text = texts
    .filter(Boolean)
    .join(" ")
    .replace(/<[^>]*>/g, " ")
    .toLowerCase();
  let best: Mood = DEFAULT_MOOD;
  let bestScore = 0;
  for (const mood of MOODS) {
    let score = 0;
    for (const word of KEYWORDS[mood]) {
      if (new RegExp(`(^|[^a-z])${word}([^a-z]|$)`).test(text)) score += 1;
    }
    if (score > bestScore) {
      best = mood;
      bestScore = score;
    }
  }
  return best;
}
