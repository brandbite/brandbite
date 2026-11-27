// -----------------------------------------------------------------------------
// @file: lib/newsletter/newsletter.ts
// @purpose: What a newsletter is in the builder: a header, a list of blocks
//           and a footer, drawn with one theme. Blocks sit one under the
//           other; a "columns" block holds two or three lists of blocks side
//           by side (one level deep). This file has the types, the defaults,
//           the checks, the edits on the block tree and the reader that turns
//           stored or pasted data back into a clean newsletter. Pure; the
//           HTML is made in ./render.ts.
// -----------------------------------------------------------------------------

import {
  logoUrlProblem,
  safeColor,
  safeUrl,
  SIGNATURE_FONTS,
  type SignatureFontId,
} from "@/lib/email-signature/signature";

import { readRich, richToPlain, type RichNode } from "./rich";

/** The fonts every mail app has; the same four the email signature offers. */
export const NEWSLETTER_FONTS = SIGNATURE_FONTS;
export type NewsletterFontId = SignatureFontId;

export type Align = "left" | "center" | "right";
export const ALIGNS: { id: Align; label: string }[] = [
  { id: "left", label: "Left" },
  { id: "center", label: "Center" },
  { id: "right", label: "Right" },
];

export type ButtonShape = "square" | "rounded" | "pill";
export const BUTTON_SHAPES: { id: ButtonShape; label: string }[] = [
  { id: "square", label: "Square" },
  { id: "rounded", label: "Rounded" },
  { id: "pill", label: "Pill" },
];

export type ButtonSize = "small" | "medium" | "large";
export const BUTTON_SIZES: { id: ButtonSize; label: string }[] = [
  { id: "small", label: "Small" },
  { id: "medium", label: "Medium" },
  { id: "large", label: "Large" },
];

/**
 * How one button looks. Each value has a form that follows the email's style
 * (the Style tab), so a button changes with the theme until it is set by hand.
 */
export type ButtonLook = {
  /** The button's color; "" follows the accent color. */
  fill: string;
  /** The words' color; "" picks black or white, whichever reads better (the button's color on an outline button). */
  textColor: string;
  size: ButtonSize;
  /** Corner radius in pixels; -1 follows the theme's button shape. */
  corner: number;
  /** A line around the words instead of a filled shape. */
  outline: boolean;
};

export const BUTTON_CORNER_MAX = 40;

export type DividerLine = "solid" | "dashed" | "dotted";
export const DIVIDER_LINES: { id: DividerLine; label: string }[] = [
  { id: "solid", label: "Solid" },
  { id: "dashed", label: "Dashed" },
  { id: "dotted", label: "Dotted" },
];

export const SOCIAL_SIZES = [
  { id: 24, label: "Small" },
  { id: 32, label: "Medium" },
  { id: 40, label: "Large" },
] as const;
export type SocialSize = (typeof SOCIAL_SIZES)[number]["id"];

/** The sizes a heading can be set to by hand, in pixels. */
export const HEADING_SIZE_MIN = 14;
export const HEADING_SIZE_MAX = 56;
/** The corner radius a picture can be given, in pixels. */
export const IMAGE_CORNER_MAX = 48;

export type ColumnsLayout = "1-1" | "1-2" | "2-1" | "1-1-1" | "1-1-1-1";
export const COLUMNS_LAYOUTS: { id: ColumnsLayout; label: string; cells: number }[] = [
  { id: "1-1", label: "Two equal", cells: 2 },
  { id: "1-2", label: "Narrow, wide", cells: 2 },
  { id: "2-1", label: "Wide, narrow", cells: 2 },
  { id: "1-1-1", label: "Three equal", cells: 3 },
  { id: "1-1-1-1", label: "Four equal", cells: 4 },
];

/** Where a block is shown: everywhere, or only on one kind of screen. */
export type BlockShow = "all" | "desktop" | "phone";
export const BLOCK_SHOWS: { id: BlockShow; label: string }[] = [
  { id: "all", label: "Everywhere" },
  { id: "desktop", label: "Not on phones" },
  { id: "phone", label: "Phones only" },
];

export const SOCIAL_PLATFORMS = [
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "x", label: "X" },
  { id: "youtube", label: "YouTube" },
  { id: "tiktok", label: "TikTok" },
  { id: "website", label: "Website" },
  { id: "email", label: "Email" },
] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number]["id"];

/** What every block carries besides its own content. */
export type BlockBox = {
  id: string;
  align: Align;
  /** Space above and below, in pixels. */
  padTop: number;
  padBottom: number;
  /** A color behind the block, or "" for none. */
  background: string;
  /** A picture behind the block (a public https address), or "". Outlook on Windows shows the color instead. */
  backgroundImage: string;
  /** Drawn as a box inside the newsletter's margins, with its own padding, instead of edge to edge. */
  boxed: boolean;
  /** The box's border in pixels (0 for none), its color ("" for the theme's line color) and corner radius. */
  borderWidth: number;
  borderColor: string;
  radius: number;
  show: BlockShow;
};

export type HeadingBlock = BlockBox & {
  type: "heading";
  text: string;
  level: 1 | 2 | 3;
  /** "" follows the theme's text color. */
  color: string;
  /** The size in pixels when set by hand; 0 takes the size that goes with the level. */
  fontSize: number;
};
export type TextBlock = BlockBox & {
  type: "text";
  /** The words without formatting. Always kept, also when `rich` holds the formatted form. */
  text: string;
  /** The words with their formatting (bold, links, lists); null while the text is plain. */
  rich: RichNode[] | null;
  size: "small" | "medium" | "large";
  color: string;
};
export type ImageBlock = BlockBox & {
  type: "image";
  url: string;
  alt: string;
  link: string;
  /** Share of the available width, in percent. */
  width: 100 | 75 | 50 | 25;
  rounded: boolean;
  /** Corner radius in pixels when set by hand; -1 follows `rounded` and the theme. */
  corner: number;
  /** The picture's width over its height, measured by the builder; 0 while unknown. Outlook on Windows needs it to size the picture. */
  ratio: number;
};
export type ButtonBlock = BlockBox & {
  type: "button";
  label: string;
  url: string;
  /** "" follows the theme's accent color. */
  color: string;
  full: boolean;
  /** The words' color; "" picks the readable one. */
  textColor: string;
  size: ButtonSize;
  /** Corner radius in pixels; -1 follows the theme's button shape. */
  corner: number;
  outline: boolean;
};
export type DividerBlock = BlockBox & {
  type: "divider";
  color: string;
  /** The line's height in pixels. */
  thickness: number;
  line: DividerLine;
};
/** The look of the button inside a ready-made block (product, video). */
export type InnerButton = {
  buttonColor: string;
  buttonTextColor: string;
  buttonSize: ButtonSize;
  buttonCorner: number;
  buttonOutline: boolean;
};
/** The two colors of a ready-made block; "" follows the theme. */
export type BlockColors = {
  /** The price, the link, the line beside a quote, the date badge. */
  accentColor: string;
  /** The title and the text. */
  textColor: string;
};
export type SpacerBlock = BlockBox & { type: "spacer"; height: number };
export type SocialBlock = BlockBox & {
  type: "social";
  links: { platform: SocialPlatform; url: string }[];
  tone: "dark" | "light";
  /** The icons' width and height in pixels. */
  size: SocialSize;
};
export type VideoBlock = BlockBox &
  InnerButton & {
    type: "video";
    /** Where the video plays (YouTube, Vimeo, your own page). */
    url: string;
    /** The picture shown in the email; found by itself for YouTube links. */
    thumbnailUrl: string;
    /** The picture's width over its height, measured by the builder; 0 while unknown. Outlook on Windows needs it to size the picture. */
    thumbnailRatio: number;
    label: string;
  };
export type ProductBlock = BlockBox &
  InnerButton &
  BlockColors & {
    /** The thin line and rounded corners around the product. */
    frame: boolean;
    type: "product";
    imageUrl: string;
    /** The picture's width over its height, measured by the builder; 0 while unknown. Outlook on Windows needs it to size the picture. */
    imageRatio: number;
    name: string;
    price: string;
    text: string;
    /** `text` with its formatting (bold, links, lists); null while the text is plain. */
    rich: RichNode[] | null;
    buttonLabel: string;
    url: string;
  };
export type QuoteBlock = BlockBox &
  BlockColors & {
    type: "quote";
    text: string;
    /** `text` with its formatting (bold, links, lists); null while the text is plain. */
    rich: RichNode[] | null;
    name: string;
    role: string;
  };
export type EventBlock = BlockBox &
  BlockColors & {
    type: "event";
    /** Short, as it should read on the badge: "20 Mar". */
    date: string;
    title: string;
    text: string;
    /** `text` with its formatting (bold, links, lists); null while the text is plain. */
    rich: RichNode[] | null;
    buttonLabel: string;
    url: string;
  };
export type StoryBlock = BlockBox &
  BlockColors & {
    type: "story";
    imageUrl: string;
    /** The picture's width over its height, measured by the builder; 0 while unknown. Outlook on Windows needs it to size the picture. */
    imageRatio: number;
    title: string;
    text: string;
    /** `text` with its formatting (bold, links, lists); null while the text is plain. */
    rich: RichNode[] | null;
    linkLabel: string;
    linkUrl: string;
  };
export type ColumnsBlock = BlockBox & {
  type: "columns";
  layout: ColumnsLayout;
  valign: "top" | "middle";
  /** On a phone the columns go one under the other; false keeps them side by side. */
  stack: boolean;
  /** One list of blocks per column. A column never holds another columns block. */
  cells: LeafBlock[][];
};

export type LeafBlock =
  | HeadingBlock
  | TextBlock
  | ImageBlock
  | ButtonBlock
  | DividerBlock
  | SpacerBlock
  | SocialBlock
  | VideoBlock
  | ProductBlock
  | QuoteBlock
  | EventBlock
  | StoryBlock;
export type NewsletterBlock = LeafBlock | ColumnsBlock;
export type NewsletterBlockType = NewsletterBlock["type"];

export const NEWSLETTER_BLOCK_TYPES: {
  id: NewsletterBlockType;
  label: string;
  note: string;
  group: "basic" | "layout" | "content";
  /** Comes with a brandbite plan; everything else is free. */
  pro: boolean;
}[] = [
  { id: "heading", label: "Heading", note: "A title or subtitle", group: "basic", pro: false },
  { id: "text", label: "Text", note: "Paragraphs", group: "basic", pro: false },
  { id: "image", label: "Image", note: "A picture, with a link", group: "basic", pro: false },
  { id: "button", label: "Button", note: "One clear next step", group: "basic", pro: false },
  { id: "divider", label: "Divider", note: "Separates two parts", group: "basic", pro: false },
  { id: "spacer", label: "Spacing", note: "Empty room", group: "basic", pro: false },
  { id: "columns", label: "Columns", note: "Blocks side by side", group: "layout", pro: true },
  { id: "story", label: "Story", note: "Picture, title, link", group: "content", pro: true },
  { id: "product", label: "Product", note: "Picture, price, button", group: "content", pro: true },
  { id: "quote", label: "Quote", note: "A customer's words", group: "content", pro: true },
  { id: "event", label: "Event", note: "Date, title, button", group: "content", pro: true },
  { id: "video", label: "Video", note: "A thumbnail that links", group: "content", pro: true },
  { id: "social", label: "Social", note: "Icons to your profiles", group: "content", pro: true },
];

export function blockTypeInfo(type: NewsletterBlockType) {
  return NEWSLETTER_BLOCK_TYPES.find((t) => t.id === type) ?? NEWSLETTER_BLOCK_TYPES[0];
}

export const HEADER_STYLES = [
  { id: "left", label: "Left" },
  { id: "center", label: "Centered" },
  { id: "band", label: "Color band" },
] as const;
export type HeaderStyle = (typeof HEADER_STYLES)[number]["id"];

export type NewsletterTheme = {
  accent: string;
  /** Behind the column. */
  page: string;
  /** The column itself. */
  card: string;
  text: string;
  font: NewsletterFontId;
  headingFont: NewsletterFontId;
  buttonShape: ButtonShape;
  /** Rounded corners on the column and its pictures. */
  rounded: boolean;
};

/**
 * Who sends the newsletter. Each service fills in its own unsubscribe link
 * where it finds its own tag, so the footer carries the tag of the chosen one.
 */
export type NewsletterService = "mailchimp" | "klaviyo" | "brevo" | "other";
export const NEWSLETTER_SERVICES: { id: NewsletterService; label: string }[] = [
  { id: "mailchimp", label: "Mailchimp" },
  { id: "klaviyo", label: "Klaviyo" },
  { id: "brevo", label: "Brevo" },
  { id: "other", label: "Another" },
];

export type NewsletterData = {
  version: 2;
  /** The newsletter's name in the customer's own list; never shown to readers. */
  name: string;
  /** The line in the inbox. Not part of the HTML body; services ask for it separately. */
  subject: string;
  /** The short text inboxes show after the subject. */
  preheader: string;
  theme: NewsletterTheme;
  header: {
    show: boolean;
    style: HeaderStyle;
    brandName: string;
    /** A public https address of the logo. */
    logoUrl: string;
    logoHeight: number;
    /** The logo's width over its height, measured by the builder; 0 while unknown. */
    logoRatio: number;
  };
  blocks: NewsletterBlock[];
  footer: {
    /** Why the reader gets this email, e.g. "You signed up at acme.com". */
    note: string;
    /** The sender's postal address; anti-spam laws ask for one in marketing email. */
    address: string;
    website: string;
    service: NewsletterService;
    /** For "another" service: its unsubscribe link or tag. */
    unsubscribe: string;
  };
};

export const NEWSLETTER_MAX_BLOCKS = 60;
export const NEWSLETTER_TEXT_MAX = 4000;
export const NEWSLETTER_MAX_SOCIAL = 8;
/** Stored newsletters a company can keep. */
export const NEWSLETTER_MAX_SAVED = 50;
/** Test emails a person can send themselves in a day. */
export const NEWSLETTER_TEST_DAILY_LIMIT = 15;
/** The largest stored newsletter, as JSON. */
export const NEWSLETTER_MAX_BYTES = 200_000;

export const DEFAULT_ACCENT = "#fe5000";

export const DEFAULT_THEME: NewsletterTheme = {
  accent: DEFAULT_ACCENT,
  page: "#f4f2ee",
  card: "#ffffff",
  text: "#292827",
  font: "arial",
  headingFont: "arial",
  buttonShape: "rounded",
  rounded: false,
};

export const EMPTY_NEWSLETTER: NewsletterData = {
  version: 2,
  name: "",
  subject: "",
  preheader: "",
  theme: DEFAULT_THEME,
  header: { show: true, style: "left", brandName: "", logoUrl: "", logoHeight: 40, logoRatio: 0 },
  blocks: [],
  footer: { note: "", address: "", website: "", service: "mailchimp", unsubscribe: "" },
};

// ---------------------------------------------------------------------------
// Looks: ready-made themes
// ---------------------------------------------------------------------------

/** A color mixed toward white; `amount` 0 keeps it, 1 is white. */
export function tint(hex: string, amount: number): string {
  const n = Number.parseInt(safeColor(hex).slice(1), 16);
  const mix = (v: number) => Math.round(v + (255 - v) * amount);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(mix);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export type NewsletterLook = "clean" | "bold" | "card" | "editorial" | "dark";

export const NEWSLETTER_LOOKS: { id: NewsletterLook; label: string; note: string }[] = [
  { id: "clean", label: "Clean", note: "White page, logo on the left" },
  { id: "bold", label: "Bold", note: "Your color across the top" },
  { id: "card", label: "Card", note: "A white card on a tinted page" },
  { id: "editorial", label: "Editorial", note: "Centered, with serif headings" },
  { id: "dark", label: "Dark", note: "Light text on a dark page" },
];

/** The theme and header style of a look, around the accent color already chosen. */
export function lookTheme(
  look: NewsletterLook,
  accent: string,
): { theme: NewsletterTheme; headerStyle: HeaderStyle } {
  const base = { ...DEFAULT_THEME, accent: safeColor(accent) };
  switch (look) {
    case "bold":
      return { theme: { ...base, page: "#f4f2ee" }, headerStyle: "band" };
    case "card":
      return {
        theme: { ...base, page: tint(accent, 0.88), rounded: true, buttonShape: "pill" },
        headerStyle: "left",
      };
    case "editorial":
      return {
        theme: {
          ...base,
          page: "#faf8f4",
          card: "#faf8f4",
          headingFont: "georgia",
          buttonShape: "square",
        },
        headerStyle: "center",
      };
    case "dark":
      return {
        theme: { ...base, page: "#141414", card: "#1f1f1f", text: "#f4f2ee", rounded: true },
        headerStyle: "left",
      };
    case "clean":
    default:
      return { theme: { ...base, page: "#ffffff" }, headerStyle: "left" };
  }
}

// ---------------------------------------------------------------------------
// New blocks
// ---------------------------------------------------------------------------

const box = (id: string, padTop: number, padBottom = 0, align: Align = "left"): BlockBox => ({
  id,
  align,
  padTop,
  padBottom,
  background: "",
  backgroundImage: "",
  boxed: false,
  borderWidth: 0,
  borderColor: "",
  radius: 0,
  show: "all",
});

const INNER_BUTTON: InnerButton = {
  buttonColor: "",
  buttonTextColor: "",
  buttonSize: "medium",
  buttonCorner: -1,
  buttonOutline: false,
};
const BLOCK_COLORS: BlockColors = { accentColor: "", textColor: "" };

/** The look of a block's button, whichever kind of block carries it. */
export function buttonLook(block: ButtonBlock | ProductBlock | VideoBlock): ButtonLook {
  if (block.type === "button") {
    return {
      fill: block.color,
      textColor: block.textColor,
      size: block.size,
      corner: block.corner,
      outline: block.outline,
    };
  }
  return {
    fill: block.buttonColor,
    textColor: block.buttonTextColor,
    size: block.buttonSize,
    corner: block.buttonCorner,
    outline: block.buttonOutline,
  };
}

/** The size a heading has when none is set by hand: by its level, smaller in a narrow column. */
export function headingAutoSize(level: 1 | 2 | 3, narrow = false): number {
  return level === 1 ? (narrow ? 24 : 30) : level === 2 ? 22 : 17;
}

/** A new block of a type with its usual spacing and no content yet. */
export function newBlock<T extends NewsletterBlockType>(
  type: T,
  id: string,
): Extract<NewsletterBlock, { type: T }>;
export function newBlock(type: NewsletterBlockType, id: string): NewsletterBlock {
  switch (type) {
    case "heading":
      return { ...box(id, 28), type, text: "", level: 2, color: "", fontSize: 0 };
    case "text":
      return { ...box(id, 14), type, text: "", rich: null, size: "medium", color: "" };
    case "image":
      return {
        ...box(id, 24),
        type,
        url: "",
        alt: "",
        link: "",
        width: 100,
        rounded: false,
        corner: -1,
        ratio: 0,
      };
    case "button":
      return {
        ...box(id, 24),
        type,
        label: "",
        url: "",
        color: "",
        full: false,
        textColor: "",
        size: "medium",
        corner: -1,
        outline: false,
      };
    case "divider":
      return { ...box(id, 28), type, color: "", thickness: 1, line: "solid" };
    case "spacer":
      return { ...box(id, 0), type, height: 32 };
    case "social":
      return {
        ...box(id, 24, 0, "center"),
        type,
        tone: "dark",
        size: 32,
        links: [
          { platform: "instagram", url: "" },
          { platform: "linkedin", url: "" },
          { platform: "website", url: "" },
        ],
      };
    case "video":
      return {
        ...box(id, 24),
        type,
        url: "",
        thumbnailUrl: "",
        thumbnailRatio: 0,
        label: "Watch the video",
        ...INNER_BUTTON,
      };
    case "product":
      return {
        ...box(id, 24),
        type,
        imageUrl: "",
        imageRatio: 0,
        name: "",
        price: "",
        text: "",
        rich: null,
        buttonLabel: "Shop now",
        url: "",
        frame: true,
        ...INNER_BUTTON,
        ...BLOCK_COLORS,
      };
    case "quote":
      return { ...box(id, 28), type, text: "", rich: null, name: "", role: "", ...BLOCK_COLORS };
    case "event":
      return {
        ...box(id, 28),
        type,
        date: "",
        title: "",
        text: "",
        rich: null,
        buttonLabel: "Save my seat",
        url: "",
        ...BLOCK_COLORS,
      };
    case "story":
      return {
        ...box(id, 28),
        type,
        imageUrl: "",
        imageRatio: 0,
        title: "",
        text: "",
        rich: null,
        linkLabel: "Read more",
        linkUrl: "",
        ...BLOCK_COLORS,
      };
    case "columns":
      return { ...box(id, 24), type, layout: "1-1", valign: "top", stack: true, cells: [[], []] };
  }
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

/** A tag an email service swaps for a real link, e.g. `{{ unsubscribe }}` or `*|UNSUB|*`. */
export function isMergeTag(input: string): boolean {
  const value = input.trim();
  if (value.length > 80 || /["'<>]/.test(value)) return false;
  return (
    /^\{\{.+\}\}$/.test(value) ||
    /^\{%.+%\}$/.test(value) ||
    /^\*\|.+\|\*$/.test(value) ||
    /^\[[^\]]+\]$/.test(value) ||
    /^%%.+%%$/.test(value)
  );
}

/** Why an image address won't show in an email, or null when it will (or is empty). */
export function imageUrlProblem(input: string): string | null {
  const problem = logoUrlProblem(input);
  if (problem) return problem;
  if (/\.svg(\?|#|$)/i.test(input.trim())) return "Mail apps don't show SVG. Use a PNG or JPG.";
  return null;
}

/** The address of a picture an email can show, or null. */
export function usableImage(input: string): string | null {
  return input.trim() && !imageUrlProblem(input) ? safeUrl(input) : null;
}

/** The id of a YouTube video from any of its usual links, or null. */
export function youtubeId(input: string): string | null {
  const url = safeUrl(input);
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, "");
    let id: string | null = null;
    if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
    else if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (u.pathname === "/watch") id = u.searchParams.get("v");
      else id = u.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1] ?? null;
    }
    return id && /^[\w-]{6,20}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

/** The picture a video block shows: its own, or YouTube's for a YouTube link. */
export function videoThumbnail(block: VideoBlock): string | null {
  const own = usableImage(block.thumbnailUrl);
  if (own) return own;
  const id = youtubeId(block.url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

export function blockHasContent(block: NewsletterBlock): boolean {
  switch (block.type) {
    case "heading":
    case "text":
      return Boolean(block.text.trim());
    case "image":
      return Boolean(usableImage(block.url));
    case "button":
      return Boolean(block.label.trim());
    case "divider":
    case "spacer":
      return true;
    case "social":
      return block.links.some((link) => socialHref(link.platform, link.url));
    case "video":
      return Boolean(safeUrl(block.url) && videoThumbnail(block));
    case "product":
      return Boolean(block.name.trim() || usableImage(block.imageUrl));
    case "quote":
      return Boolean(block.text.trim());
    case "event":
      return Boolean(block.title.trim());
    case "story":
      return Boolean(block.title.trim() || block.text.trim() || usableImage(block.imageUrl));
    case "columns":
      return block.cells.some((cell) => cell.some(blockHasContent));
  }
}

/** Where a social icon points: a web address, or mailto: for the email one. */
export function socialHref(platform: SocialPlatform, input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  if (platform === "email") {
    const address = value.replace(/^mailto:/i, "");
    return /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(address) ? `mailto:${address}` : null;
  }
  return safeUrl(value);
}

/** One picture in a newsletter whose shape the builder measures: where it is, its address, the shape stored. */
export type PictureSlot = { key: string; url: string | null; ratio: number };

/** Every picture whose shape matters to how it is drawn: the logo and the pictures of blocks. */
export function pictureSlots(data: NewsletterData): PictureSlot[] {
  const slots: PictureSlot[] = [
    { key: "header", url: usableImage(data.header.logoUrl), ratio: data.header.logoRatio },
  ];
  for (const block of allBlocks(data.blocks)) {
    if (block.type === "image") {
      slots.push({ key: block.id, url: usableImage(block.url), ratio: block.ratio });
    } else if (block.type === "story" || block.type === "product") {
      slots.push({ key: block.id, url: usableImage(block.imageUrl), ratio: block.imageRatio });
    } else if (block.type === "video") {
      slots.push({ key: block.id, url: videoThumbnail(block), ratio: block.thumbnailRatio });
    }
  }
  return slots;
}

/** The newsletter with measured shapes written into the pictures named in `ratios` (by slot key). */
export function withPictureRatios(
  data: NewsletterData,
  ratios: Map<string, number>,
): NewsletterData {
  if (!ratios.size) return data;
  const set = (block: NewsletterBlock): NewsletterBlock => {
    const value = ratios.get(block.id);
    if (value === undefined) return block;
    if (block.type === "image") return { ...block, ratio: value };
    if (block.type === "story" || block.type === "product") return { ...block, imageRatio: value };
    if (block.type === "video") return { ...block, thumbnailRatio: value };
    return block;
  };
  const logo = ratios.get("header");
  return {
    ...data,
    header: logo === undefined ? data.header : { ...data.header, logoRatio: logo },
    blocks: data.blocks.map((block) =>
      block.type === "columns"
        ? {
            ...block,
            cells: block.cells.map((cell) => cell.map((inner) => set(inner) as LeafBlock)),
          }
        : set(block),
    ),
  };
}

/** Every block, with the blocks inside columns, in reading order. */
export function allBlocks(blocks: NewsletterBlock[]): NewsletterBlock[] {
  return blocks.flatMap((block) =>
    block.type === "columns" ? [block, ...block.cells.flat()] : [block],
  );
}

export function countBlocks(blocks: NewsletterBlock[]): number {
  return allBlocks(blocks).length;
}

/** True once there is something to send: a block with content that isn't just a line or space. */
export function hasContent(data: NewsletterData): boolean {
  return allBlocks(data.blocks).some(
    (block) =>
      block.type !== "divider" &&
      block.type !== "spacer" &&
      block.type !== "columns" &&
      blockHasContent(block),
  );
}

/** Whether a newsletter uses anything that comes with a plan. */
export function usesProBlocks(blocks: NewsletterBlock[]): boolean {
  return allBlocks(blocks).some((block) => blockTypeInfo(block.type).pro);
}

/** The unsubscribe link's address (or tag) for the chosen service; null when there is none. */
export function unsubscribeHref(data: NewsletterData): string | null {
  switch (data.footer.service) {
    case "mailchimp":
      return "*|UNSUB|*";
    case "brevo":
      return "{{ unsubscribe }}";
    case "klaviyo":
      // Klaviyo's tag writes the whole link itself; the footer prints it as it is.
      return "{% unsubscribe %}";
    case "other": {
      const value = data.footer.unsubscribe.trim();
      if (!value) return null;
      return isMergeTag(value) ? value : safeUrl(value);
    }
  }
}

export type NewsletterProblem = {
  text: string;
  /** What to select to fix it: a block's id, or a fixed part. */
  target: string | "header" | "footer" | "inbox";
};

/** What to fix before sending, in words for the person building it. */
export function newsletterProblems(data: NewsletterData): NewsletterProblem[] {
  const problems: NewsletterProblem[] = [];
  if (!data.subject.trim()) problems.push({ text: "Add a subject line.", target: "inbox" });
  if (data.header.logoUrl.trim() && imageUrlProblem(data.header.logoUrl)) {
    problems.push({ text: "The logo's address can't be used.", target: "header" });
  }
  for (const block of allBlocks(data.blocks)) {
    const add = (text: string) => problems.push({ text, target: block.id });
    if (block.backgroundImage.trim() && imageUrlProblem(block.backgroundImage)) {
      add("A background picture's address can't be used.");
    }
    switch (block.type) {
      case "button":
        if (block.label.trim() && !safeUrl(block.url)) add("A button has no link yet.");
        break;
      case "image":
        if (!block.url.trim()) add("An image block is empty.");
        else if (imageUrlProblem(block.url)) add("An image's address can't be used.");
        else if (!block.alt.trim()) add("An image has no description.");
        break;
      case "story":
        if (block.imageUrl.trim() && imageUrlProblem(block.imageUrl)) {
          add("A story's image address can't be used.");
        }
        if (blockHasContent(block) && block.linkUrl.trim() && !safeUrl(block.linkUrl)) {
          add("A story's link isn't a web address.");
        }
        break;
      case "product":
        if (block.imageUrl.trim() && imageUrlProblem(block.imageUrl)) {
          add("A product's image address can't be used.");
        }
        if (blockHasContent(block) && block.buttonLabel.trim() && !safeUrl(block.url)) {
          add("A product has no link yet.");
        }
        break;
      case "event":
        if (blockHasContent(block) && block.buttonLabel.trim() && !safeUrl(block.url)) {
          add("An event has no link yet.");
        }
        break;
      case "video":
        if (!safeUrl(block.url)) add("A video has no link yet.");
        else if (!videoThumbnail(block)) add("A video needs a thumbnail image.");
        break;
      case "social":
        if (!blockHasContent(block)) add("The social icons have no links yet.");
        break;
      default:
        break;
    }
  }
  if (data.footer.service === "other" && !unsubscribeHref(data)) {
    problems.push({
      text: "Add your email service's unsubscribe link or tag.",
      target: "footer",
    });
  }
  if (!data.footer.address.trim()) {
    problems.push({
      text: "Add your postal address to the footer; marketing email needs one.",
      target: "footer",
    });
  }
  return problems;
}

// ---------------------------------------------------------------------------
// The block tree: find, change, add, move, remove
// ---------------------------------------------------------------------------

/** A place in the tree: the top list, or one column of a columns block; `index` is the gap before that item. */
export type BlockSlot = { columnsId: string | null; cell: number; index: number };

export const slotId = (slot: BlockSlot) =>
  slot.columnsId ? `slot:${slot.columnsId}:${slot.cell}:${slot.index}` : `slot:root:${slot.index}`;

export function parseSlotId(id: string): BlockSlot | null {
  const parts = id.split(":");
  if (parts[0] !== "slot") return null;
  if (parts[1] === "root" && parts.length === 3) {
    return { columnsId: null, cell: 0, index: Number(parts[2]) };
  }
  if (parts.length === 4) {
    return { columnsId: parts[1], cell: Number(parts[2]), index: Number(parts[3]) };
  }
  return null;
}

export function findBlock(
  blocks: NewsletterBlock[],
  id: string,
): { block: NewsletterBlock; slot: BlockSlot } | null {
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    if (block.id === id) return { block, slot: { columnsId: null, cell: 0, index } };
    if (block.type !== "columns") continue;
    for (let cell = 0; cell < block.cells.length; cell += 1) {
      const at = block.cells[cell].findIndex((inner) => inner.id === id);
      if (at >= 0)
        return { block: block.cells[cell][at], slot: { columnsId: block.id, cell, index: at } };
    }
  }
  return null;
}

/** The tree with one block replaced by `change(block)`. */
export function updateBlock(
  blocks: NewsletterBlock[],
  id: string,
  change: (block: NewsletterBlock) => NewsletterBlock,
): NewsletterBlock[] {
  return blocks.map((block) => {
    if (block.id === id) return change(block);
    if (block.type !== "columns") return block;
    if (!block.cells.some((cell) => cell.some((inner) => inner.id === id))) return block;
    return {
      ...block,
      cells: block.cells.map((cell) =>
        cell.map((inner) => (inner.id === id ? (change(inner) as LeafBlock) : inner)),
      ),
    };
  });
}

export function removeBlock(blocks: NewsletterBlock[], id: string): NewsletterBlock[] {
  return blocks
    .filter((block) => block.id !== id)
    .map((block) =>
      block.type === "columns" && block.cells.some((cell) => cell.some((inner) => inner.id === id))
        ? { ...block, cells: block.cells.map((cell) => cell.filter((inner) => inner.id !== id)) }
        : block,
    );
}

/** Whether a block may be put in a slot: columns only go in the top list. */
export function canPlace(type: NewsletterBlockType, slot: BlockSlot): boolean {
  return type !== "columns" || slot.columnsId === null;
}

export function insertBlock(
  blocks: NewsletterBlock[],
  slot: BlockSlot,
  block: NewsletterBlock,
): NewsletterBlock[] {
  if (!canPlace(block.type, slot)) return blocks;
  if (slot.columnsId === null) {
    const at = Math.max(0, Math.min(slot.index, blocks.length));
    return [...blocks.slice(0, at), block, ...blocks.slice(at)];
  }
  return blocks.map((parent) => {
    if (parent.id !== slot.columnsId || parent.type !== "columns") return parent;
    return {
      ...parent,
      cells: parent.cells.map((cell, index) => {
        if (index !== slot.cell) return cell;
        const at = Math.max(0, Math.min(slot.index, cell.length));
        return [...cell.slice(0, at), block as LeafBlock, ...cell.slice(at)];
      }),
    };
  });
}

/** The tree with a block moved to a slot. The slot is counted before the block is taken out. */
export function moveBlock(
  blocks: NewsletterBlock[],
  id: string,
  slot: BlockSlot,
): NewsletterBlock[] {
  const found = findBlock(blocks, id);
  if (!found || !canPlace(found.block.type, slot)) return blocks;
  // A columns block can't be dropped into itself.
  if (slot.columnsId === id) return blocks;
  const from = found.slot;
  const sameList = from.columnsId === slot.columnsId && from.cell === slot.cell;
  // Dropping a block on either side of itself changes nothing.
  if (sameList && (slot.index === from.index || slot.index === from.index + 1)) return blocks;
  const index = sameList && slot.index > from.index ? slot.index - 1 : slot.index;
  return insertBlock(removeBlock(blocks, id), { ...slot, index }, found.block);
}

/** A copy of a block with fresh ids, for "Duplicate". */
export function cloneBlock(block: NewsletterBlock, makeId: () => string): NewsletterBlock {
  if (block.type === "columns") {
    return {
      ...block,
      id: makeId(),
      cells: block.cells.map((cell) => cell.map((inner) => ({ ...inner, id: makeId() }))),
    };
  }
  return { ...block, id: makeId() };
}

/** A columns block changed to another layout; blocks of a dropped column move into the last one kept. */
export function setColumnsLayout(block: ColumnsBlock, layout: ColumnsLayout): ColumnsBlock {
  const wanted = COLUMNS_LAYOUTS.find((l) => l.id === layout)?.cells ?? 2;
  const cells = block.cells.slice(0, wanted);
  while (cells.length < wanted) cells.push([]);
  const extra = block.cells.slice(wanted).flat();
  if (extra.length) cells[wanted - 1] = [...cells[wanted - 1], ...extra];
  return { ...block, layout, cells };
}

// ---------------------------------------------------------------------------
// Reading stored data back
// ---------------------------------------------------------------------------

const str = (value: unknown, max: number) => (typeof value === "string" ? value.slice(0, max) : "");
const num = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, Math.round(value)))
    : fallback;
/** A picture's width over its height as stored: a sane positive number, or 0 for unknown. */
const ratio = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0.05 && value <= 20
    ? Math.round(value * 1000) / 1000
    : 0;
const color = (value: unknown) =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value.trim())
    ? value.trim().toLowerCase()
    : "";
const oneOf = <T extends string>(value: unknown, options: readonly T[], fallback: T): T =>
  options.includes(value as T) ? (value as T) : fallback;

/** A block's text and its formatted form, read back: formatted text is the source, its plain form is worked out from it. */
function richText(
  b: Record<string, unknown>,
  max: number,
): { text: string; rich: RichNode[] | null } {
  const rich = readRich(b.rich);
  return { text: rich ? richToPlain(rich).slice(0, max) : str(b.text, max), rich };
}

const BUTTON_SIZE_IDS = ["small", "medium", "large"] as const;

/** The look of a ready-made block's button, read back; anything missing follows the email's style. */
function innerButton(b: Record<string, unknown>): InnerButton {
  return {
    buttonColor: color(b.buttonColor),
    buttonTextColor: color(b.buttonTextColor),
    buttonSize: oneOf(b.buttonSize, BUTTON_SIZE_IDS, "medium"),
    buttonCorner: num(b.buttonCorner, -1, BUTTON_CORNER_MAX, -1),
    buttonOutline: b.buttonOutline === true,
  };
}
const blockColors = (b: Record<string, unknown>): BlockColors => ({
  accentColor: color(b.accentColor),
  textColor: color(b.textColor),
});

function readBlock(raw: unknown, makeId: () => string, nested: boolean): NewsletterBlock | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  const type = NEWSLETTER_BLOCK_TYPES.find((t) => t.id === b.type)?.id;
  if (!type || (nested && type === "columns")) return null;
  const fresh = newBlock(type, /^[\w-]{1,60}$/.test(str(b.id, 60)) ? str(b.id, 60) : makeId());
  const base = {
    id: fresh.id,
    align: oneOf(b.align, ["left", "center", "right"] as const, fresh.align),
    padTop: num(b.padTop, 0, 96, fresh.padTop),
    padBottom: num(b.padBottom, 0, 96, fresh.padBottom),
    background: color(b.background),
    backgroundImage: str(b.backgroundImage, 500),
    boxed: b.boxed === true,
    borderWidth: num(b.borderWidth, 0, 8, 0),
    borderColor: color(b.borderColor),
    radius: num(b.radius, 0, 32, 0),
    show: oneOf(b.show, ["all", "desktop", "phone"] as const, "all"),
  };
  switch (type) {
    case "heading":
      return {
        ...base,
        type,
        text: str(b.text, 300),
        level: b.level === 1 || b.level === 3 ? b.level : 2,
        color: color(b.color),
        fontSize: b.fontSize ? num(b.fontSize, HEADING_SIZE_MIN, HEADING_SIZE_MAX, 0) : 0,
      };
    case "text": {
      const rich = readRich(b.rich);
      return {
        ...base,
        type,
        // Formatted text is the source; its plain form is worked out from it.
        text: rich
          ? richToPlain(rich).slice(0, NEWSLETTER_TEXT_MAX)
          : str(b.text, NEWSLETTER_TEXT_MAX),
        rich,
        size: oneOf(b.size, ["small", "medium", "large"] as const, "medium"),
        color: color(b.color),
      };
    }
    case "image":
      return {
        ...base,
        type,
        url: str(b.url, 500),
        alt: str(b.alt, 200),
        link: str(b.link, 500),
        width: b.width === 75 || b.width === 50 || b.width === 25 ? b.width : 100,
        rounded: b.rounded === true,
        corner: num(b.corner, -1, IMAGE_CORNER_MAX, -1),
        ratio: ratio(b.ratio),
      };
    case "button":
      return {
        ...base,
        type,
        label: str(b.label, 60),
        url: str(b.url, 500),
        color: color(b.color),
        full: b.full === true,
        textColor: color(b.textColor),
        size: oneOf(b.size, BUTTON_SIZE_IDS, "medium"),
        corner: num(b.corner, -1, BUTTON_CORNER_MAX, -1),
        outline: b.outline === true,
      };
    case "divider":
      return {
        ...base,
        type,
        color: color(b.color),
        thickness: num(b.thickness, 1, 8, 1),
        line: oneOf(b.line, ["solid", "dashed", "dotted"] as const, "solid"),
      };
    case "spacer":
      return { ...base, type, height: num(b.height, 4, 160, 32) };
    case "social": {
      const links = (Array.isArray(b.links) ? b.links : [])
        .map((link) => {
          const l = (link ?? {}) as Record<string, unknown>;
          const platform = SOCIAL_PLATFORMS.find((p) => p.id === l.platform)?.id;
          return platform ? { platform, url: str(l.url, 500) } : null;
        })
        .filter((link): link is SocialBlock["links"][number] => link !== null)
        .slice(0, NEWSLETTER_MAX_SOCIAL);
      return {
        ...base,
        type,
        links,
        tone: b.tone === "light" ? "light" : "dark",
        size: b.size === 24 || b.size === 40 ? b.size : 32,
      };
    }
    case "video":
      return {
        ...base,
        type,
        url: str(b.url, 500),
        thumbnailUrl: str(b.thumbnailUrl, 500),
        thumbnailRatio: ratio(b.thumbnailRatio),
        label: str(b.label, 60),
        ...innerButton(b),
      };
    case "product":
      return {
        ...base,
        type,
        imageUrl: str(b.imageUrl, 500),
        imageRatio: ratio(b.imageRatio),
        name: str(b.name, 200),
        price: str(b.price, 60),
        ...richText(b, 600),
        buttonLabel: str(b.buttonLabel, 60),
        url: str(b.url, 500),
        frame: b.frame !== false,
        ...innerButton(b),
        ...blockColors(b),
      };
    case "quote":
      return {
        ...base,
        type,
        ...richText(b, 1000),
        name: str(b.name, 120),
        role: str(b.role, 120),
        ...blockColors(b),
      };
    case "event":
      return {
        ...base,
        type,
        date: str(b.date, 30),
        title: str(b.title, 200),
        ...richText(b, 600),
        buttonLabel: str(b.buttonLabel, 60),
        url: str(b.url, 500),
        ...blockColors(b),
      };
    case "story":
      return {
        ...base,
        type,
        imageUrl: str(b.imageUrl, 500),
        imageRatio: ratio(b.imageRatio),
        title: str(b.title, 200),
        ...richText(b, NEWSLETTER_TEXT_MAX),
        linkLabel: str(b.linkLabel, 60),
        linkUrl: str(b.linkUrl, 500),
        ...blockColors(b),
      };
    case "columns": {
      const layout = oneOf(
        b.layout,
        COLUMNS_LAYOUTS.map((l) => l.id),
        "1-1",
      );
      const wanted = COLUMNS_LAYOUTS.find((l) => l.id === layout)?.cells ?? 2;
      const rawCells = Array.isArray(b.cells) ? b.cells : [];
      const cells = Array.from({ length: wanted }, (_, index) =>
        (Array.isArray(rawCells[index]) ? (rawCells[index] as unknown[]) : [])
          .map((inner) => readBlock(inner, makeId, true))
          .filter((inner): inner is LeafBlock => inner !== null),
      );
      return {
        ...base,
        type,
        layout,
        valign: b.valign === "middle" ? "middle" : "top",
        stack: b.stack !== false,
        cells,
      };
    }
  }
}

/**
 * Stored or pasted data read back as a newsletter. Anything unexpected is
 * dropped or replaced by its default, ids are made unique and the number of
 * blocks is capped. Null when the data isn't a newsletter at all.
 */
export function readNewsletter(raw: unknown, makeId?: () => string): NewsletterData | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  if (!Array.isArray(d.blocks)) return null;
  let made = 0;
  const nextId = makeId ?? (() => `r${(made += 1)}`);

  const seen = new Set<string>();
  let left = NEWSLETTER_MAX_BLOCKS;
  const unique = <T extends NewsletterBlock>(block: T): T => {
    let id = block.id;
    while (seen.has(id)) id = `${nextId()}x`;
    seen.add(id);
    return id === block.id ? block : { ...block, id };
  };
  const blocks: NewsletterBlock[] = [];
  for (const item of d.blocks) {
    if (left <= 0) break;
    const block = readBlock(item, nextId, false);
    if (!block) continue;
    left -= 1;
    if (block.type !== "columns") {
      blocks.push(unique(block));
      continue;
    }
    const cells = block.cells.map((cell) => {
      const kept: LeafBlock[] = [];
      for (const inner of cell) {
        if (left <= 0) break;
        left -= 1;
        kept.push(unique(inner));
      }
      return kept;
    });
    blocks.push(unique({ ...block, cells }));
  }

  const t = (d.theme ?? {}) as Record<string, unknown>;
  const h = (d.header ?? {}) as Record<string, unknown>;
  const f = (d.footer ?? {}) as Record<string, unknown>;
  const fonts = NEWSLETTER_FONTS.map((font) => font.id);
  return {
    version: 2,
    name: str(d.name, 120),
    subject: str(d.subject, 150),
    preheader: str(d.preheader, 150),
    theme: {
      accent: color(t.accent) || DEFAULT_THEME.accent,
      page: color(t.page) || DEFAULT_THEME.page,
      card: color(t.card) || DEFAULT_THEME.card,
      text: color(t.text) || DEFAULT_THEME.text,
      font: oneOf(t.font, fonts, DEFAULT_THEME.font),
      headingFont: oneOf(t.headingFont, fonts, DEFAULT_THEME.headingFont),
      buttonShape: oneOf(
        t.buttonShape,
        BUTTON_SHAPES.map((s) => s.id),
        DEFAULT_THEME.buttonShape,
      ),
      rounded: t.rounded === true,
    },
    header: {
      show: h.show !== false,
      style: oneOf(
        h.style,
        HEADER_STYLES.map((s) => s.id),
        "left",
      ),
      brandName: str(h.brandName, 120),
      logoUrl: str(h.logoUrl, 500),
      logoHeight: num(h.logoHeight, 20, 96, 40),
      logoRatio: ratio(h.logoRatio),
    },
    blocks,
    footer: {
      note: str(f.note, 300),
      address: str(f.address, 200),
      website: str(f.website, 200),
      service: oneOf(
        f.service,
        NEWSLETTER_SERVICES.map((s) => s.id),
        "mailchimp",
      ),
      unsubscribe: str(f.unsubscribe, 500),
    },
  };
}
