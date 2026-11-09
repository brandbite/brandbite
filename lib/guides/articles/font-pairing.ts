// -----------------------------------------------------------------------------
// @file: lib/guides/articles/font-pairing.ts
// @purpose: Public guide: how to pair fonts for a brand. Pairs with the font
//           pairing pages under /brand-kit/font-pairings.
// -----------------------------------------------------------------------------

import type { SupportGuide } from "@/lib/support/types";

export const FONT_PAIRING_GUIDE: SupportGuide = {
  slug: "how-to-pair-fonts-for-a-brand",
  title: "How to pair fonts for a brand",
  summary:
    "How to choose a heading font and a body font that work together, with simple rules, examples and the mistakes to avoid.",
  category: "Branding",
  routes: [],
  keywords: [
    "font pairing",
    "font combinations",
    "brand typography",
    "google fonts",
    "heading and body font",
  ],
  sections: [
    {
      heading: "Why two fonts are usually enough",
      blocks: [
        {
          type: "p",
          text: "Most brands need exactly two fonts: one for headings and one for everything people read. The heading font gives you personality; the body font keeps long text comfortable. A third font, if any, is usually for something specific like code or numbers.",
        },
        {
          type: "p",
          text: "Each extra font makes pages slower to load and harder to keep consistent. If you think you need more variety, use more weights of the fonts you have first.",
        },
      ],
    },
    {
      heading: "Start with the body font",
      blocks: [
        {
          type: "p",
          text: "It's tempting to start with an exciting headline font, but the body font does most of the work. Pick something that is easy to read at small sizes, on phones, in long paragraphs and in forms.",
        },
        {
          type: "list",
          items: [
            "Clear letters that are easy to tell apart, like I, l and 1.",
            "A good range of weights, at least regular and bold.",
            "Support for the languages you write in.",
            "Comfortable at 16px, the usual size for body text on the web.",
          ],
        },
        {
          type: "tip",
          text: "Sans-serifs such as Inter, Source Sans 3 or Open Sans are safe body choices for screens. Serifs such as Lora or Merriweather work well for long-form reading.",
        },
      ],
    },
    {
      heading: "Then add a heading font with contrast",
      blocks: [
        {
          type: "p",
          text: "The best pairs are different enough to tell apart but share something underneath. Contrast can come from a few places:",
        },
        {
          type: "list",
          items: [
            {
              term: "Category",
              text: "A serif heading over a sans-serif body is the classic pairing.",
            },
            { term: "Weight", text: "A heavy display face over a light, open body font." },
            { term: "Width", text: "A wide or condensed heading next to a normal-width body." },
            { term: "Personality", text: "A characterful heading with a neutral, quiet body." },
          ],
        },
        {
          type: "p",
          text: "Pick one or two kinds of contrast. Fonts that differ in every way at once tend to look unrelated rather than paired.",
        },
      ],
    },
    {
      heading: "Look for a shared trait",
      blocks: [
        {
          type: "p",
          text: "Pairs feel right when something connects them: similar letter proportions, a similar x-height (the height of lowercase letters), or a similar mood. Set your brand name and a paragraph side by side; if the two fonts feel like they belong to the same company, you're close.",
        },
        {
          type: "tip",
          text: "Superfamilies, like DM Serif Display and DM Sans, are designed to work together, which makes them an easy, safe choice.",
        },
      ],
    },
    {
      heading: "Match the pairing to your brand",
      blocks: [
        {
          type: "list",
          items: [
            {
              term: "Classic and trustworthy",
              text: "A traditional serif heading with a clean sans body, for example Libre Baskerville and Lato.",
            },
            {
              term: "Modern and technical",
              text: "A geometric or grotesk sans with an interface font, for example Space Grotesk and Inter.",
            },
            { term: "Friendly", text: "Rounded or soft shapes, for example Outfit and Nunito." },
            {
              term: "Luxury",
              text: "A high-contrast serif with plenty of space, for example Playfair Display and Lato.",
            },
            {
              term: "Bold",
              text: "A heavy or condensed display face, for example Archivo Black and Karla.",
            },
          ],
        },
      ],
    },
    {
      heading: "Set a simple type scale",
      blocks: [
        {
          type: "p",
          text: "Decide a handful of sizes and reuse them everywhere: for example 48px for page titles, 32px and 24px for section headings, 16px for body and 14px for small print. A consistent scale does more for a polished look than any single font choice.",
        },
      ],
    },
    {
      heading: "Check licensing and loading",
      blocks: [
        {
          type: "p",
          text: "Google Fonts are free under open licenses that allow commercial use. Fonts from foundries often need a separate license for the web, apps and print, so check before you commit.",
        },
        {
          type: "warning",
          text: "Loading fonts directly from Google's servers sends visitors' IP addresses to Google, which European regulators have treated as a privacy issue. Self-hosting the font files on your own domain avoids it, and is usually faster too.",
        },
      ],
    },
    {
      heading: "Common mistakes",
      blocks: [
        {
          type: "list",
          items: [
            "Two fonts that are almost the same, so the pairing looks like a mistake.",
            "A decorative font for body text, which is tiring to read.",
            "Using too many weights and styles in one design.",
            "Testing only the headline and never a full paragraph.",
          ],
        },
      ],
    },
    {
      heading: "Test a pairing in ten minutes",
      blocks: [
        {
          type: "steps",
          items: [
            "Set your brand name and a real headline in the heading font, at the size you'd use on your homepage.",
            "Below it, paste three or four paragraphs of real copy in the body font at 16px.",
            "Add a button, a caption and a form label, the small text most people forget to test.",
            "Look at it on a phone, then print it or view it in grayscale to judge it without color.",
            "Show it to someone who hasn't seen it and ask what kind of company it feels like.",
          ],
        },
        {
          type: "p",
          text: "If the answer matches the three words you chose for your brand, you've found your pairing. If not, change one font at a time, starting with the heading.",
        },
      ],
    },
    {
      heading: "Fonts beyond the website",
      blocks: [
        {
          type: "list",
          items: [
            {
              term: "Presentations",
              text: "PowerPoint and Keynote need the fonts installed on every computer that opens the file, or they fall back to a default. Google Slides only shows fonts from Google Fonts, which is another reason to choose from it.",
            },
            {
              term: "Documents and email",
              text: "Email clients mostly ignore custom fonts. Pick a fallback, such as Arial or Georgia, that's close to your body font.",
            },
            {
              term: "Social posts",
              text: "Your designers or design tool need the same fonts; share the font files or names along with your logo.",
            },
          ],
        },
      ],
    },
    {
      heading: "Frequently asked questions",
      blocks: [
        {
          type: "list",
          items: [
            {
              term: "How many fonts should a brand use?",
              text: "Two: one for headings, one for body text. Use weights like bold and italic for variety before adding a third font.",
            },
            {
              term: "Should my logo use my brand font?",
              text: "Not necessarily. Logos are often custom lettering. Your heading font should feel related to the logo, not identical.",
            },
            {
              term: "Serif or sans-serif?",
              text: "Both read well on modern screens. Serifs tend to feel more traditional and editorial, sans-serifs more modern and neutral. Choose by personality, then check readability.",
            },
            {
              term: "Are Google Fonts good enough for a professional brand?",
              text: "Yes. Many well-known companies use them, and they come with licenses that allow commercial use.",
            },
          ],
        },
      ],
    },
    {
      heading: "Try some pairings",
      blocks: [
        {
          type: "p",
          text: "Browse 24 hand-picked Google Font pairings, each shown in its own fonts with what it suits and the CSS to use it. Or open the brand kit generator to see a pairing together with your colors.",
        },
      ],
    },
  ],
};
