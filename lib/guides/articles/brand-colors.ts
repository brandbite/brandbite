// -----------------------------------------------------------------------------
// @file: lib/guides/articles/brand-colors.ts
// @purpose: Public guide: how to choose brand colors. Pairs with Color Studio
//           and the brand kit generator.
// -----------------------------------------------------------------------------

import type { SupportGuide } from "@/lib/support/types";

export const BRAND_COLORS_GUIDE: SupportGuide = {
  slug: "how-to-choose-brand-colors",
  title: "How to choose brand colors",
  summary:
    "A practical way to pick a brand palette: one main color, a few supporting ones, and checks that keep it readable everywhere.",
  category: "Branding",
  routes: [],
  keywords: [
    "brand palette",
    "color palette",
    "brand color meaning",
    "color psychology",
    "brand identity colors",
  ],
  sections: [
    {
      heading: "Why brand colors matter",
      blocks: [
        {
          type: "p",
          text: "Color is often the first thing people notice and the easiest thing to remember. When the same colors show up on your website, your posts and your product, people start to recognize you before they read your name.",
        },
        {
          type: "p",
          text: "That only works if the palette is small and used consistently. The goal isn't to find the perfect color; it's to pick a sensible set and stick to it.",
        },
      ],
    },
    {
      heading: "The roles in a brand palette",
      blocks: [
        {
          type: "p",
          text: "Think in roles, not just colors. Five roles cover almost everything:",
        },
        {
          type: "list",
          items: [
            {
              term: "Primary",
              text: "The color people remember you by. Use it for your logo and key moments.",
            },
            { term: "Secondary", text: "Adds variety so everything doesn't look the same." },
            {
              term: "Accent",
              text: "A contrasting color for buttons, highlights and calls to action.",
            },
            { term: "Dark", text: "For text and dark backgrounds; rarely pure black." },
            { term: "Light", text: "For backgrounds and space; rarely pure white." },
          ],
        },
        {
          type: "tip",
          text: "Tint the dark and light colors slightly with your primary color. It makes the whole palette feel like one family.",
        },
      ],
    },
    {
      heading: "Step 1: Start from what you want people to feel",
      blocks: [
        {
          type: "p",
          text: "Write down three words for how your brand should come across, for example calm, trustworthy and modern, or playful, bold and warm. These words will guide every choice that follows.",
        },
        {
          type: "p",
          text: "Colors carry common associations, such as blue with trust and calm, green with growth and health, orange with energy and warmth. They are tendencies, not rules, and they vary by culture and context, so use them as a starting point rather than a formula.",
        },
      ],
    },
    {
      heading: "Step 2: Look at your category",
      blocks: [
        {
          type: "p",
          text: "Search for your competitors and note their colors. Many categories cluster around one or two: plenty of banks are blue, plenty of eco brands are green.",
        },
        {
          type: "p",
          text: "You can fit in, so people instantly understand what you are, or stand out, so people remember you. Both work. What doesn't work is choosing without knowing which one you're doing.",
        },
      ],
    },
    {
      heading: "Step 3: Pick your primary color",
      blocks: [
        {
          type: "steps",
          items: [
            "Shortlist three or four colors that match your three words.",
            "Put each one on a real thing: your logo, a social post, a button.",
            "Look at them small, on a phone, and next to your competitors.",
            "Pick the one that is distinctive and still works at small sizes.",
          ],
        },
        {
          type: "warning",
          text: "Very light or very bright colors, like pale yellow or neon green, look great large but are hard to read as text. If that's your primary, plan a darker version for text and small details.",
        },
      ],
    },
    {
      heading: "Step 4: Build the rest of the palette",
      blocks: [
        {
          type: "p",
          text: "Use the color wheel to find colors that relate to your primary. A few reliable patterns:",
        },
        {
          type: "list",
          items: [
            {
              term: "Analogous",
              text: "Neighbors on the wheel. Calm and cohesive; good for modern, understated brands.",
            },
            {
              term: "Complementary",
              text: "The opposite color. High contrast; good for bold brands and strong calls to action.",
            },
            {
              term: "Triadic",
              text: "Three evenly spaced colors. Lively and playful; harder to balance.",
            },
            {
              term: "Monochromatic",
              text: "Shades of one color. Simple and elegant; needs a strong accent to avoid feeling flat.",
            },
          ],
        },
        {
          type: "tip",
          text: "Don't use every color equally. A common split is about 60% neutral, 30% primary and secondary, and 10% accent.",
        },
      ],
    },
    {
      heading: "Step 5: Check that it's readable",
      blocks: [
        {
          type: "p",
          text: "A palette that looks good in a swatch can fail on a real page. Check every text and background pair you plan to use against the WCAG contrast guidelines: at least 4.5:1 for normal text and 3:1 for large text.",
        },
        {
          type: "p",
          text: "This isn't only about accessibility rules. Low contrast is hard for everyone to read on a phone in sunlight, so fixing it makes your design better for all your customers.",
        },
      ],
    },
    {
      heading: "Step 6: Write it down",
      blocks: [
        {
          type: "p",
          text: "Record each color's role and HEX code, and add RGB for screens and CMYK or a Pantone match if you print. Add a line on how to use each one, like \"accent: buttons and links only\". A palette that lives only in someone's head drifts within months.",
        },
      ],
    },
    {
      heading: "Common mistakes",
      blocks: [
        {
          type: "list",
          items: [
            "Too many colors. Five roles are plenty; more makes everything look unrelated.",
            "Choosing from a swatch instead of testing on real designs.",
            "Using pure black text on pure white everywhere, which can feel harsh.",
            "Picking a trendy color for a brand you want to last for years.",
          ],
        },
      ],
    },
    {
      heading: "Three starter palettes",
      blocks: [
        {
          type: "p",
          text: "To make the steps concrete, here is how one main color can grow into a palette for three different brands.",
        },
        {
          type: "list",
          items: [
            {
              term: "Calm and trustworthy (a finance app)",
              text: "Primary deep blue #1F3A5F, secondary muted teal #3D7A7A, accent warm amber #E0A030, dark #141A22, light #F2F5F8.",
            },
            {
              term: "Playful and warm (a snack brand)",
              text: "Primary orange #FF6426, secondary sunny yellow #FFC93C, accent bright violet #7B5CFF, dark #2B1A12, light #FFF6EF.",
            },
            {
              term: "Premium and quiet (a skincare line)",
              text: "Primary forest green #1F3A33, secondary soft sage #A9B8A6, accent brass #B08D57, dark #161A18, light #F6F4EF.",
            },
          ],
        },
        {
          type: "tip",
          text: "Notice the dark and light colors: none of them is pure black or white. A hint of the primary color makes each palette feel finished.",
        },
      ],
    },
    {
      heading: "Using your colors everywhere",
      blocks: [
        {
          type: "list",
          items: [
            {
              term: "Screens",
              text: "Use HEX or RGB values. Colors look slightly different on every screen, so judge them on a phone as well as a laptop.",
            },
            {
              term: "Print",
              text: "Ask your printer for CMYK values or a Pantone match; bright screen colors, especially oranges and greens, often print duller.",
            },
            {
              term: "Dark mode",
              text: "Plan a dark background version. Light text on your dark color, with the accent slightly brighter, usually works.",
            },
            {
              term: "Charts and data",
              text: "Your brand colors may not be enough for a chart with many series. Add a few neutral tints rather than new hues.",
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
              term: "How many brand colors should I have?",
              text: "Usually three to five: a primary, one or two supporting colors, and a dark and a light. More than that is hard to use consistently.",
            },
            {
              term: "Can I change my brand colors later?",
              text: "Yes, but each change has a cost: website, templates, signage and printed material. It's better to adjust shades than to switch colors entirely.",
            },
            {
              term: "Do I need Pantone colors?",
              text: "Only if you print a lot, especially packaging or merchandise. For a mostly digital brand, HEX and RGB are enough to start.",
            },
            {
              term: "Is color psychology real?",
              text: "Colors do carry common associations, but they depend on culture, context and the rest of the design. Use them as hints, and test with real people.",
            },
          ],
        },
      ],
    },
    {
      heading: "Try it",
      blocks: [
        {
          type: "p",
          text: "The free brand kit generator builds a five-role palette from one color and shows it on a business card, a social post and a website. To fine-tune it, use the palette generator, color wheel and contrast checker in Color Studio.",
        },
      ],
    },
  ],
};
