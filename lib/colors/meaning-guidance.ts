// -----------------------------------------------------------------------------
// @file: lib/colors/meaning-guidance.ts
// @purpose: "Works well for" and cultural notes for the Color Meanings panel, by
//           ColorMeaning slug. Associations vary by culture, so the notes describe
//           tendencies and never state them as rules. A slug without an entry
//           simply hides these sections.
// -----------------------------------------------------------------------------

export interface MeaningGuidance {
  worksWellFor: string[];
  culturalContext: string;
}

export const MEANING_GUIDANCE: Record<string, MeaningGuidance> = {
  red: {
    worksWellFor: ["Food", "Sales", "Entertainment"],
    culturalContext:
      "Associations vary by audience and culture. Red can suggest luck and celebration in parts of East Asia, while elsewhere it may read as danger or urgency.",
  },
  orange: {
    worksWellFor: ["Food", "Creative", "Lifestyle"],
    culturalContext:
      "Associations vary by audience and culture. For some audiences orange suggests change, affordability or a sense of fun, and in some traditions it carries spiritual meaning.",
  },
  yellow: {
    worksWellFor: ["Retail", "Kids", "Travel"],
    culturalContext:
      "Associations vary by audience and culture. Yellow often reads as cheerful, but it can also signal caution, and in some places it is linked with royalty or mourning.",
  },
  green: {
    worksWellFor: ["Health", "Finance", "Sustainability"],
    culturalContext:
      "Associations vary by audience and culture. Green commonly suggests nature and growth, and in some regions it also has religious or national significance.",
  },
  blue: {
    worksWellFor: ["Technology", "Finance", "Healthcare"],
    culturalContext:
      "Associations vary by audience and culture. Blue is widely seen as calm and dependable, though in some traditions it is also tied to sadness or protection.",
  },
  purple: {
    worksWellFor: ["Beauty", "Creative", "Premium"],
    culturalContext:
      "Associations vary by audience and culture. Purple often suggests luxury or imagination, and in some places it is associated with mourning.",
  },
  black: {
    worksWellFor: ["Fashion", "Luxury", "Technology"],
    culturalContext:
      "Associations vary by audience and culture. Black can feel elegant and powerful, and in many places it is also the color of mourning.",
  },
  white: {
    worksWellFor: ["Healthcare", "Technology", "Minimal brands"],
    culturalContext:
      "Associations vary by audience and culture. White often suggests simplicity and cleanliness, while in parts of Asia it can be associated with mourning.",
  },
};
