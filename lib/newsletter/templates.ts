// -----------------------------------------------------------------------------
// @file: lib/newsletter/templates.ts
// @purpose: The ready-made newsletters in the builder's gallery. Each is a
//           look plus a list of blocks with stand-in words; pictures are left
//           empty for the customer to add. Templates that use columns or the
//           content blocks come with a plan, like those blocks. Pure.
// -----------------------------------------------------------------------------

import { previewLogoSrc } from "@/lib/email-signature/signature";

import {
  DEFAULT_ACCENT,
  EMPTY_NEWSLETTER,
  lookTheme,
  newBlock,
  usesProBlocks,
  type Align,
  type ColumnsLayout,
  type LeafBlock,
  type NewsletterBlock,
  type NewsletterBlockType,
  type NewsletterData,
  type NewsletterLook,
} from "./newsletter";

/**
 * Where the templates' own pictures live. An email can only show a picture
 * from a public https address, so they point at the live site whichever
 * environment built the newsletter; the builder itself loads them from its own
 * files (see builderImageSrc). The files are in public/newsletter/templates,
 * made by scripts/make-newsletter-template-images.mts.
 */
export const TEMPLATE_PICTURE_ORIGIN = "https://brandbite.studio";
export const TEMPLATE_PICTURES = [
  "offer",
  "welcome",
  "invitation",
  "launch",
  "case-study",
  "video",
  "story-1",
  "story-2",
  "story-3",
  "product-1",
  "product-2",
  "product-3",
  "product-4",
] as const;

const picture = (name: (typeof TEMPLATE_PICTURES)[number]) =>
  `${TEMPLATE_PICTURE_ORIGIN}/newsletter/templates/${name}.jpg`;

/**
 * Where the builder (canvas, preview, gallery) loads a picture from. brandbite's
 * own pictures come straight from this site's files, so they show on every
 * environment; any other address goes through our own fetching address, because
 * the site's policy stops the page loading pictures from other websites.
 */
export function builderImageSrc(url: string): string {
  const own = `${TEMPLATE_PICTURE_ORIGIN}/newsletter/`;
  return url.startsWith(own) ? url.slice(TEMPLATE_PICTURE_ORIGIN.length) : previewLogoSrc(url);
}

/** A block as a template writes it: its type and whatever differs from a new block. */
type Spec = { type: NewsletterBlockType } & Record<string, unknown>;

const h1 = (text: string, more: Record<string, unknown> = {}): Spec => ({
  type: "heading",
  text,
  level: 1,
  padTop: 32,
  ...more,
});
const h2 = (text: string, more: Record<string, unknown> = {}): Spec => ({
  type: "heading",
  text,
  level: 2,
  ...more,
});
const p = (text: string, more: Record<string, unknown> = {}): Spec => ({
  type: "text",
  text,
  ...more,
});
const img = (more: Record<string, unknown> = {}): Spec => ({ type: "image", ...more });
const btn = (label: string, more: Record<string, unknown> = {}): Spec => ({
  type: "button",
  label,
  ...more,
});
const line = (): Spec => ({ type: "divider" });
const cols = (
  layout: ColumnsLayout,
  cells: Spec[][],
  more: Record<string, unknown> = {},
): Spec => ({
  type: "columns",
  layout,
  cells,
  ...more,
});
const centered = (specs: Spec[]): Spec[] =>
  specs.map((spec) => ({ align: "center" as Align, ...spec }));

export type NewsletterTemplate = {
  id: string;
  name: string;
  note: string;
  look: NewsletterLook;
  blocks: Spec[];
};

export const NEWSLETTER_TEMPLATES: NewsletterTemplate[] = [
  {
    id: "announcement",
    name: "Announcement",
    note: "One piece of news and a button",
    look: "clean",
    blocks: [
      h1("Say the news in one line"),
      p(
        "Open with what changed and why it matters to the reader. Two or three sentences are enough.\n\nAdd the detail they need to act: when, where, for whom.",
      ),
      btn("See what's new"),
    ],
  },
  {
    id: "letter",
    name: "Personal letter",
    note: "Plain words from you, no pictures",
    look: "editorial",
    blocks: [
      p("Hello,", { padTop: 32, size: "large" }),
      p(
        "Write this one the way you would write to a single customer. Say what has been happening, what you learned and what comes next.\n\nShort paragraphs read best on a phone. Leave an empty line between them.",
        { size: "large" },
      ),
      p("Thank you for reading,\nYour name", { size: "large", padTop: 20 }),
    ],
  },
  {
    id: "offer",
    name: "Offer",
    note: "A promotion with a clear next step",
    look: "bold",
    blocks: [
      ...centered([
        h1("Name the offer"),
        img({
          url: picture("offer"),
          ratio: 2,
          alt: "Gift boxes wrapped in cream paper, one with an orange ribbon",
        }),
        p(
          "Say what the reader gets, what it costs or saves, and until when. Put any conditions here too.",
        ),
        btn("Get the offer"),
      ]),
    ],
  },
  {
    id: "welcome",
    name: "Welcome",
    note: "The first email after someone signs up",
    look: "card",
    blocks: [
      img({
        url: picture("welcome"),
        ratio: 2,
        alt: "A desk by a window with a cup of coffee and an open notebook",
      }),
      h1("Welcome aboard"),
      p(
        "Thank them for signing up and say in a sentence what they can expect from you, and how often.",
      ),
      h2("Start here"),
      p(
        "1. The first thing worth doing.\n2. The second.\n3. Where to find help when they need it.",
      ),
      btn("Take the first step"),
    ],
  },
  {
    id: "invitation",
    name: "Invitation",
    note: "An event with date, place and a button",
    look: "clean",
    blocks: [
      ...centered([
        p("YOU ARE INVITED", { size: "small", padTop: 36 }),
        h1("Name of the event", { padTop: 8 }),
        p("Day, date and time\nThe place or the link"),
        img({
          url: picture("invitation"),
          ratio: 2,
          alt: "A bright room with rows of chairs and a vase of dried flowers",
        }),
        p("Say who it is for and what they will take away from it. Mention if seats are limited."),
        btn("Save my seat"),
      ]),
    ],
  },
  {
    id: "feedback",
    name: "Feedback request",
    note: "Ask one question, thank them",
    look: "clean",
    blocks: [
      h1("How did we do?"),
      p(
        "Remind them what they bought or used, and ask for two minutes of their time. Say what you will do with the answers.",
      ),
      btn("Answer three questions"),
      line(),
      p("Prefer to reply? Just answer this email; it reaches a person.", { size: "small" }),
    ],
  },
  {
    id: "digest",
    name: "Monthly update",
    note: "A few stories, each with a link",
    look: "clean",
    blocks: [
      h1("What's new this month"),
      p("A sentence or two that sets up this issue."),
      {
        type: "story",
        imageUrl: picture("story-1"),
        imageRatio: 1.5,
        title: "First story",
        text: "What it is and why the reader should care, in a couple of lines.",
      },
      {
        type: "story",
        imageUrl: picture("story-2"),
        imageRatio: 1.5,
        title: "Second story",
        text: "Keep each story short and let the link carry the rest.",
      },
      {
        type: "story",
        imageUrl: picture("story-3"),
        imageRatio: 1.5,
        title: "Third story",
        text: "Three is plenty. More than that and none of them gets read.",
      },
      line(),
      p("A closing line, a thank you or what to expect next time."),
      { type: "social" },
    ],
  },
  {
    id: "launch",
    name: "Product launch",
    note: "A hero image and three reasons",
    look: "bold",
    blocks: [
      img({
        padTop: 0,
        padBottom: 0,
        url: picture("launch"),
        ratio: 2,
        alt: "A sculptural ceramic object on a stone plinth",
      }),
      ...centered([
        h1("Meet the new product"),
        p("One sentence on what it is and who it is for."),
        btn("See it in action"),
      ]),
      cols(
        "1-1-1",
        [
          [
            h2("First reason", { level: 3, padTop: 0 }),
            p("What it lets them do.", { size: "small", padTop: 6 }),
          ],
          [
            h2("Second reason", { level: 3, padTop: 0 }),
            p("What it saves them.", { size: "small", padTop: 6 }),
          ],
          [
            h2("Third reason", { level: 3, padTop: 0 }),
            p("Why it is different.", { size: "small", padTop: 6 }),
          ],
        ],
        { padTop: 36 },
      ),
    ],
  },
  {
    id: "shop",
    name: "Shop picks",
    note: "Four products in two columns",
    look: "card",
    blocks: [
      ...centered([h1("This week's picks"), p("A line that says why these, why now.")]),
      cols("1-1", [
        [
          {
            type: "product",
            imageUrl: picture("product-1"),
            imageRatio: 1.333,
            name: "First product",
            price: "$00",
            padTop: 0,
          },
        ],
        [
          {
            type: "product",
            imageUrl: picture("product-2"),
            imageRatio: 1.333,
            name: "Second product",
            price: "$00",
            padTop: 0,
          },
        ],
      ]),
      cols("1-1", [
        [
          {
            type: "product",
            imageUrl: picture("product-3"),
            imageRatio: 1.333,
            name: "Third product",
            price: "$00",
            padTop: 0,
          },
        ],
        [
          {
            type: "product",
            imageUrl: picture("product-4"),
            imageRatio: 1.333,
            name: "Fourth product",
            price: "$00",
            padTop: 0,
          },
        ],
      ]),
      btn("See the whole shop", { align: "center", padTop: 32 }),
    ],
  },
  {
    id: "events",
    name: "What's on",
    note: "Upcoming dates as a list",
    look: "clean",
    blocks: [
      h1("Coming up"),
      p("One line on what this season is about."),
      {
        type: "event",
        date: "12 Apr",
        title: "First event",
        text: "Time and place, in one line.",
      },
      {
        type: "event",
        date: "26 Apr",
        title: "Second event",
        text: "Time and place, in one line.",
      },
      {
        type: "event",
        date: "9 May",
        title: "Third event",
        text: "Time and place, in one line.",
      },
      line(),
      p("Say how to reach you with questions.", { size: "small" }),
    ],
  },
  {
    id: "case-study",
    name: "Customer story",
    note: "A quote, the result, a link",
    look: "editorial",
    blocks: [
      ...centered([
        p("CUSTOMER STORY", { size: "small", padTop: 36 }),
        h1("How a customer got a result", { padTop: 8 }),
      ]),
      img({
        url: picture("case-study"),
        ratio: 2,
        alt: "A design studio table with fabric swatches and pencils",
      }),
      p("Set the scene in two sentences: who they are and what they needed."),
      {
        type: "quote",
        text: "Their own words about what changed for them.",
        name: "Customer name",
        role: "Role, company",
      },
      p("Say what you did together and what came of it. Use a number if you have one."),
      btn("Read the full story", { align: "center" }),
    ],
  },
  {
    id: "video",
    name: "New video",
    note: "A thumbnail that opens your video",
    look: "dark",
    blocks: [
      h1("Watch: name of the video"),
      p("Say what they will see and how long it takes."),
      { type: "video", thumbnailUrl: picture("video"), thumbnailRatio: 1.778 },
      cols(
        "1-2",
        [
          [h2("In this one", { level: 3, padTop: 0 })],
          [p("• The first point\n• The second point\n• The third point", { padTop: 0 })],
        ],
        { padTop: 32 },
      ),
      { type: "social", tone: "light", padTop: 36 },
    ],
  },
];

/** A template's blocks as real blocks, with ids from `makeId`. */
function build(specs: Spec[], makeId: () => string): NewsletterBlock[] {
  return specs.map((spec) => {
    const { type, cells, ...rest } = spec;
    if (type === "columns") {
      return {
        ...newBlock("columns", makeId()),
        ...rest,
        cells: ((cells as Spec[][]) ?? []).map((cell) => build(cell, makeId) as LeafBlock[]),
      } as NewsletterBlock;
    }
    return { ...newBlock(type, makeId()), ...rest } as NewsletterBlock;
  });
}

/** A new newsletter from a template, in the template's look around `accent`. */
export function fromTemplate(
  template: NewsletterTemplate,
  makeId: () => string,
  accent: string = DEFAULT_ACCENT,
): NewsletterData {
  const look = lookTheme(template.look, accent);
  return {
    ...EMPTY_NEWSLETTER,
    name: template.name,
    theme: look.theme,
    header: { ...EMPTY_NEWSLETTER.header, style: look.headerStyle },
    blocks: build(template.blocks, makeId),
    footer: { ...EMPTY_NEWSLETTER.footer },
  };
}

export function findTemplate(id: string | null | undefined): NewsletterTemplate | null {
  return NEWSLETTER_TEMPLATES.find((template) => template.id === id) ?? null;
}

/** Whether a template needs a plan: it uses columns or one of the content blocks. */
export function templateIsPro(template: NewsletterTemplate): boolean {
  let made = 0;
  return usesProBlocks(build(template.blocks, () => `t${(made += 1)}`));
}
