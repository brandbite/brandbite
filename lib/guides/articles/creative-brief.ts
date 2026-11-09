// -----------------------------------------------------------------------------
// @file: lib/guides/articles/creative-brief.ts
// @purpose: Public guide: how to write a creative brief. Pairs with the free
//           brief generator at /brief-generator.
// -----------------------------------------------------------------------------

import type { SupportGuide } from "@/lib/support/types";

export const CREATIVE_BRIEF_GUIDE: SupportGuide = {
  slug: "how-to-write-a-creative-brief",
  title: "How to write a creative brief (with examples)",
  summary:
    "What a creative brief is, the seven parts every brief needs, and examples of weak and strong answers you can copy.",
  category: "Working with designers",
  routes: [],
  keywords: [
    "design brief",
    "brief template",
    "creative brief example",
    "project brief",
    "marketing brief",
  ],
  sections: [
    {
      heading: "What a creative brief is for",
      blocks: [
        {
          type: "p",
          text: "A creative brief is a short document that tells a designer what to make, who it is for and why it matters. It is written before any design work starts, and everyone involved agrees on it.",
        },
        {
          type: "p",
          text: "Most revision rounds don't happen because a designer got it wrong. They happen because the goal was never written down, so the first draft is also the first time anyone sees what the project was really about. A good brief moves that conversation to the start, where it is cheap.",
        },
        {
          type: "p",
          text: "A brief also helps you. Writing one forces you to decide what you actually want, which is often the hardest part of the project.",
        },
      ],
    },
    {
      heading: "The seven parts of a good brief",
      blocks: [
        {
          type: "list",
          items: [
            { term: "The project", text: "What you need and a one- or two-sentence summary." },
            { term: "Background", text: "Who you are and who the work is for." },
            {
              term: "The goal",
              text: "What should change because of this work, and how you will measure it.",
            },
            {
              term: "Message and tone",
              text: "The one thing people should remember, and how it should feel.",
            },
            { term: "Deliverables", text: "Every file you expect, with sizes and formats." },
            { term: "Brand", text: "Colors, fonts, logo files and references." },
            { term: "Timeline", text: "Deadline, rounds of revisions and, if it matters, budget." },
          ],
        },
        {
          type: "tip",
          text: "Keep it to one page. If a brief runs longer, the important parts get skimmed.",
        },
      ],
    },
    {
      heading: "1. The project",
      blocks: [
        {
          type: "p",
          text: "Name the project and write a summary a designer could repeat back to you in one breath. If you can't, the project probably isn't clear yet, or it is two projects.",
        },
        {
          type: "list",
          items: [
            { term: "Weak", text: '"We need some social posts for the launch."' },
            {
              term: "Strong",
              text: '"Six Instagram posts and six stories announcing our new team plan, running for two weeks from March 3."',
            },
          ],
        },
      ],
    },
    {
      heading: "2. Background and audience",
      blocks: [
        {
          type: "p",
          text: "Explain what your company does in plain words, then describe the audience as people rather than demographics: what they care about, what they already think of you, and what would make them stop scrolling.",
        },
        {
          type: "list",
          items: [
            { term: "Weak", text: '"Small businesses, 25 to 45."' },
            {
              term: "Strong",
              text: '"Founders of online stores with 5 to 50 people. Busy, skeptical of new tools, and tired of spreadsheets. Most have never heard of us."',
            },
          ],
        },
      ],
    },
    {
      heading: "3. The goal, and how you will know",
      blocks: [
        {
          type: "p",
          text: "This is the most important line in the brief. Say what should change because of the work, and be specific enough that you could tell afterwards whether it worked.",
        },
        {
          type: "list",
          items: [
            { term: "Weak", text: '"Raise awareness."' },
            {
              term: "Strong",
              text: '"Get 300 teams to start a free trial of the team plan, measured with campaign links."',
            },
          ],
        },
        {
          type: "tip",
          text: "One brief, one goal. If you find yourself writing two, split the project.",
        },
      ],
    },
    {
      heading: "4. Message and tone",
      blocks: [
        {
          type: "p",
          text: "Write the single message people should remember. Then pick about three words for how the work should feel, such as bold, friendly and minimal. Add anything that must appear, like a logo, a legal line or a product, and anything to avoid.",
        },
        {
          type: "p",
          text: '"Avoid" is underrated. "No stock photos of people pointing at laptops" or "no red, it reads as a loss in our product" saves a full round of revisions.',
        },
      ],
    },
    {
      heading: "5. Deliverables",
      blocks: [
        {
          type: "p",
          text: "List every file you expect, with exact sizes and formats. An Instagram post, a story and an ad are three different designs, even when they share an idea.",
        },
        {
          type: "list",
          items: [
            "Instagram post, 1080 × 1350",
            "Instagram story, 1080 × 1920",
            "LinkedIn post, 1200 × 627",
            "Editable source files",
          ],
        },
        {
          type: "tip",
          text: "Not sure of the sizes? The free social media size guide lists every platform's current formats.",
        },
      ],
    },
    {
      heading: "6. Brand and references",
      blocks: [
        {
          type: "p",
          text: "Share your logo files, brand colors as HEX codes and the fonts you use. If you have no brand guide yet, say so; that is useful information too.",
        },
        {
          type: "p",
          text: "References help most when you say what you like about them. \"The clean product shots in last year's launch posts\" gives a designer something to work with; a bare link to a competitor doesn't.",
        },
      ],
    },
    {
      heading: "7. Timeline and budget",
      blocks: [
        {
          type: "p",
          text: "Give the date you need the final files, how many rounds of revisions you expect, and any review steps, like a manager who has to sign off. If budget limits the scope, say so early.",
        },
        {
          type: "warning",
          text: "A deadline without review time is really an earlier deadline. If your manager needs two days to approve, the designer's deadline is two days before yours.",
        },
      ],
    },
    {
      heading: "Common mistakes",
      blocks: [
        {
          type: "list",
          items: [
            "Writing the brief after the first draft, as a list of corrections.",
            'Describing the design ("a blue banner with a photo") instead of the goal.',
            "Leaving out who approves the work, so feedback arrives late from someone new.",
            "Mixing must-haves and nice-to-haves without saying which is which.",
          ],
        },
      ],
    },
    {
      heading: "Questions to answer before you start",
      blocks: [
        {
          type: "list",
          items: [
            "Why are we doing this now, and what happens if we don't?",
            "Who has to say yes before this goes live?",
            "What has worked before, and what hasn't?",
            "Where will people see this, and for how long: a feed, a billboard, a pitch meeting?",
            "What is fixed (logo, product, legal text) and what is open?",
          ],
        },
        {
          type: "p",
          text: "If you can't answer one of these, find out before briefing. A designer can't fill that gap for you; they can only guess, and guesses cost revision rounds.",
        },
      ],
    },
    {
      heading: "A complete example",
      blocks: [
        {
          type: "p",
          text: "Here is a short brief for a social campaign. Notice that each line could be checked against the finished work.",
        },
        {
          type: "list",
          items: [
            {
              term: "Project",
              text: "Spring launch social campaign: six Instagram posts, six stories and four LinkedIn posts announcing the new team plan.",
            },
            {
              term: "Company",
              text: "Northwind Analytics, a dashboard that shows small online stores which products make money.",
            },
            {
              term: "Audience",
              text: "Founders and marketing leads at stores with 5 to 50 people in the US and UK. Busy, skeptical of new tools, tired of spreadsheets.",
            },
            {
              term: "Goal",
              text: "300 free trials of the team plan in two weeks, tracked with campaign links.",
            },
            { term: "Key message", text: "Your whole team, one view of what's selling." },
            { term: "Tone", text: "Friendly, bold, minimal." },
            {
              term: "Must include",
              text: 'Logo, the line "Free for 14 days", a product screenshot in at least half the posts.',
            },
            {
              term: "Avoid",
              text: "Stock photos of people pointing at laptops; red, which reads as losses in the product.",
            },
            {
              term: "Deliverables",
              text: "Instagram 1080 × 1350 and 1080 × 1920, LinkedIn 1200 × 627, editable source files.",
            },
            {
              term: "Timeline",
              text: "Final files by February 24 for a March 3 launch; two rounds of revisions; the CEO approves.",
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
              term: "How long should a creative brief be?",
              text: "One page. Long enough to answer the seven parts, short enough that everyone reads all of it.",
            },
            {
              term: "Who should write it?",
              text: "The person who owns the result, usually the marketer or founder asking for the work. Designers can help sharpen it, but shouldn't have to write it.",
            },
            {
              term: "Is a design brief different from a creative brief?",
              text: "People use the names interchangeably. A design brief sometimes goes deeper into formats and specs, but the seven parts are the same.",
            },
            {
              term: "Should I share a budget?",
              text: "If budget limits what's possible, yes. It helps a designer suggest the best result for the money instead of guessing.",
            },
            {
              term: "What do I do with the brief after the project starts?",
              text: 'Use it to give feedback. "Does this make the key message clear to our audience?" is far more useful than "I don\'t love it".',
            },
          ],
        },
      ],
    },
    {
      heading: "Write yours in a few minutes",
      blocks: [
        {
          type: "steps",
          items: [
            "Open the free brief generator; it walks through all seven parts.",
            'Use "Fill with an example" to see a finished brief.',
            "Copy it, download it, or save it as a PDF to share.",
          ],
        },
      ],
    },
  ],
};
