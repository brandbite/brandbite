// -----------------------------------------------------------------------------
// @file: lib/newsletter/render.ts
// @purpose: Turns a newsletter into HTML an email service can send: one
//           600 pixel column of tables with inline styles, web-safe fonts and
//           every value escaped. The builder's canvas draws each block with
//           the same functions, so what is edited is what is sent. Pure.
// -----------------------------------------------------------------------------

import {
  displayUrl,
  escapeHtml,
  safeColor,
  safeUrl,
  textOn,
} from "@/lib/email-signature/signature";
import { SITE_URL } from "@/lib/seo/structured-data";

import { fillPersonal } from "./personal";
import type { RichNode, RichRun } from "./rich";
import {
  blockHasContent,
  buttonLook,
  COLUMNS_LAYOUTS,
  headingAutoSize,
  NEWSLETTER_FONTS,
  SOCIAL_PLATFORMS,
  socialHref,
  unsubscribeHref,
  usableImage,
  videoThumbnail,
  type BlockColors,
  type ButtonLook,
  type ButtonSize,
  type ColumnsBlock,
  type ColumnsLayout,
  type HeadingBlock,
  type LeafBlock,
  type NewsletterBlock,
  type NewsletterData,
} from "./newsletter";

/** Width of the column, its side padding, and the room between two columns. */
export const NEWSLETTER_WIDTH = 600;
export const NEWSLETTER_SIDE = 40;
export const NEWSLETTER_INNER = NEWSLETTER_WIDTH - NEWSLETTER_SIDE * 2;
export const NEWSLETTER_GAP = 20;

const TABLE = '<table role="presentation" cellpadding="0" cellspacing="0" border="0"';
const PLACEHOLDER_FILL = "#e9e6e1";
const PLACEHOLDER_TEXT = "#8a8780";

export type RenderOptions = {
  /**
   * Where the builder loads a picture from, given its real address. The
   * newsletter that is copied, downloaded or sent never uses this.
   */
  imageSrc?: (url: string) => string;
  /** For the on-page preview: links don't open. */
  preview?: boolean;
  /** For the canvas and template pictures: empty blocks are drawn as stand-ins instead of left out. */
  placeholders?: boolean;
  /** For a test email: the unsubscribe link goes nowhere instead of carrying a service's tag. */
  test?: boolean;
  /** Where brandbite's own icon files are loaded from; the live site unless given. */
  assetBase?: string;
  /**
   * For a picked block on the canvas: the elements that hold a block's words
   * are marked (data-edit="<field>") and always drawn, even empty, so they can
   * be typed into in place. Text of several lines is drawn as it is stored.
   */
  editable?: boolean;
};

/** A block's own color as typed, when it is a hex color; "" for anything else, so nothing else reaches a style. */
const hex = (value: string) =>
  /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim().toLowerCase() : "";

/** Two colors mixed; `amount` 0 is `a`, 1 is `b`. */
export function blend(a: string, b: string, amount: number): string {
  const [x, y] = [a, b].map((hex) => Number.parseInt(safeColor(hex).slice(1), 16));
  const mix = (shift: number) =>
    Math.round(((x >> shift) & 255) + (((y >> shift) & 255) - ((x >> shift) & 255)) * amount);
  return `#${[16, 8, 0].map((s) => mix(s).toString(16).padStart(2, "0")).join("")}`;
}

/** The content width of each column of a layout inside `width` pixels. */
export function columnWidths(layout: ColumnsLayout, width: number): number[] {
  const parts = layout.split("-").map(Number);
  const usable = width - NEWSLETTER_GAP * (parts.length - 1);
  const total = parts.reduce((sum, part) => sum + part, 0);
  return parts.map((part) => Math.floor((usable * part) / total));
}

type Ctx = {
  data: NewsletterData;
  options: RenderOptions;
  accent: string;
  text: string;
  muted: string;
  rule: string;
  font: string;
  headingFont: string;
  buttonRadius: number;
  imageRadius: number;
  src: (url: string) => string;
  asset: (path: string) => string;
};

function context(data: NewsletterData, options: RenderOptions): Ctx {
  const theme = data.theme;
  const stack = (id: string) =>
    (NEWSLETTER_FONTS.find((font) => font.id === id) ?? NEWSLETTER_FONTS[0]).stack;
  const text = safeColor(theme.text);
  const card = safeColor(theme.card);
  const base = (options.assetBase ?? SITE_URL).replace(/\/$/, "");
  return {
    data,
    options,
    accent: safeColor(theme.accent),
    text,
    muted: blend(text, card, 0.38),
    rule: blend(text, card, 0.86),
    font: stack(theme.font),
    headingFont: stack(theme.headingFont),
    buttonRadius: theme.buttonShape === "square" ? 0 : theme.buttonShape === "pill" ? 999 : 8,
    imageRadius: theme.rounded ? 10 : 0,
    src: (url) => escapeHtml(options.imageSrc ? options.imageSrc(url) : url),
    asset: (path) => escapeHtml(`${base}${path}`),
  };
}

const type = (family: string, size: number, line: number, color: string, extra = "") =>
  `font-family:${family};font-size:${size}px;line-height:${line}px;color:${color};${extra}`;

const link = (href: string | null, content: string, style: string) =>
  href ? `<a href="${escapeHtml(href)}" style="${style}">${content}</a>` : content;

const paragraphs = (text: string) =>
  text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

/** Text as HTML: escaped, web addresses turned into links, single line breaks kept. */
function richText(text: string, linkColor: string): string {
  return text
    .split(/(https?:\/\/[^\s<]+)/g)
    .map((part, index) => {
      if (index % 2 === 0) return escapeHtml(part).replace(/\n/g, "<br>");
      // A full stop or comma after an address belongs to the sentence.
      const trailing = part.match(/[.,;:!?)\]]+$/)?.[0] ?? "";
      const address = trailing ? part.slice(0, -trailing.length) : part;
      const url = safeUrl(address);
      if (!url) return escapeHtml(part);
      return `<a href="${escapeHtml(url)}" style="color:${linkColor};text-decoration:underline;">${escapeHtml(displayUrl(url))}</a>${escapeHtml(trailing)}`;
    })
    .join("");
}

/** Paragraphs of one text, the last without space under it. */
function prose(text: string, style: string, align: string, linkColor: string): string {
  const parts = paragraphs(text);
  return parts
    .map(
      (paragraph, index) =>
        `<p style="margin:0 0 ${index === parts.length - 1 ? 0 : 12}px 0;text-align:${align};${style}">${richText(paragraph, linkColor)}</p>`,
    )
    .join("");
}

/** Formatted text: paragraphs and lists whose words can be bold, italic, underlined or a link. */
function richHtml(nodes: RichNode[], style: string, align: string, linkColor: string): string {
  const run = (piece: RichRun) => {
    let html = escapeHtml(piece.text).replace(/\n/g, "<br>");
    if (piece.bold) html = `<strong>${html}</strong>`;
    if (piece.italic) html = `<em>${html}</em>`;
    if (piece.underline) html = `<u>${html}</u>`;
    if (piece.link) {
      html = `<a href="${escapeHtml(piece.link)}" style="color:${linkColor};text-decoration:underline;">${html}</a>`;
    }
    return html;
  };
  return nodes
    .map((node, index) => {
      const under = index === nodes.length - 1 ? 0 : 12;
      if (node.type === "p") {
        return `<p style="margin:0 0 ${under}px 0;text-align:${align};${style}">${node.runs.map(run).join("") || "&nbsp;"}</p>`;
      }
      const items = node.items
        .map((item) => `<li style="margin:0 0 4px 0;${style}">${item.map(run).join("")}</li>`)
        .join("");
      return `<${node.type} style="margin:0 0 ${under}px 0;padding:0 0 0 24px;list-style-type:${node.type === "ol" ? "decimal" : "disc"};text-align:${align};${style}">${items}</${node.type}>`;
    })
    .join("");
}

/** A grey box standing in for a picture that hasn't been chosen yet. */
function placeholderBox(width: number, height: number, label: string, c: Ctx): string {
  return `${TABLE} width="${width}" style="width:100%;max-width:${width}px;"><tr><td align="center" valign="middle" height="${height}" bgcolor="${PLACEHOLDER_FILL}" style="height:${height}px;background-color:${PLACEHOLDER_FILL};border-radius:${c.imageRadius}px;${type(c.font, 13, 18, PLACEHOLDER_TEXT)}">${escapeHtml(label)}</td></tr></table>`;
}

function picture(
  url: string,
  width: number,
  alt: string,
  c: Ctx,
  {
    radius = c.imageRadius,
    align = "left",
    ratio = 0,
    fill = true,
  }: { radius?: number; align?: string; ratio?: number; fill?: boolean } = {},
): string {
  // A picture that takes the whole width it has keeps doing so when its column
  // gets wider: columns that sat side by side go one under the other on a
  // phone, and a picture held at its narrow column width would sit small in a corner.
  const cls = fill ? ' class="nl-fill"' : "";
  // Outlook on Windows sizes a picture from its own file unless it is told both
  // measures, which stretches it; with the height given it keeps its shape.
  // Everywhere else the style below (height:auto) decides, so it still shrinks on a phone.
  const height = ratio > 0 ? ` height="${Math.max(1, Math.round(width / ratio))}"` : "";
  const margin =
    align === "center" ? "margin:0 auto;" : align === "right" ? "margin:0 0 0 auto;" : "";
  return `<img src="${c.src(url)}" alt="${escapeHtml(alt)}" width="${width}"${height}${cls} style="display:block;width:100%;max-width:${width}px;height:auto;border:0;${margin}${radius ? `border-radius:${radius}px;` : ""}">`;
}

const BUTTON_METRICS: Record<
  ButtonSize,
  { font: number; line: number; padY: number; padX: number }
> = {
  small: { font: 14, line: 18, padY: 10, padX: 20 },
  medium: { font: 16, line: 20, padY: 14, padX: 28 },
  large: { font: 18, line: 24, padY: 18, padX: 36 },
};
const OUTLINE_WIDTH = 2;

/** A button as plain measures and colors, with everything that follows the email's style worked out. */
export type DrawnButton = {
  /** The shape's color, or null for an outline button. */
  background: string | null;
  /** The line around an outline button, or null. */
  border: string | null;
  text: string;
  radius: number;
  fontSize: number;
  lineHeight: number;
  /** Space around the words, as a CSS value. */
  padding: string;
};

function drawnButton(look: ButtonLook, c: Ctx, fallbackFill = c.accent): DrawnButton {
  const fill = hex(look.fill) || fallbackFill;
  const m = BUTTON_METRICS[look.size];
  // An outline button's line takes room; its padding gives that room back, so both kinds are one size.
  const inset = look.outline ? OUTLINE_WIDTH : 0;
  return {
    background: look.outline ? null : fill,
    border: look.outline ? `${OUTLINE_WIDTH}px solid ${fill}` : null,
    text: hex(look.textColor) || (look.outline ? fill : textOn(fill)),
    radius: look.corner >= 0 ? look.corner : c.buttonRadius,
    fontSize: m.font,
    lineHeight: m.line,
    padding: `${m.padY - inset}px ${m.padX - inset}px`,
  };
}

function pill(
  label: string,
  href: string | null,
  look: ButtonLook,
  c: Ctx,
  full = false,
  fallbackFill = c.accent,
): string {
  const b = drawnButton(look, c, fallbackFill);
  const anchor = `<a${href ? ` href="${escapeHtml(href)}"` : ""} style="display:${full ? "block" : "inline-block"};padding:${b.padding};text-align:center;${type(c.font, b.fontSize, b.lineHeight, b.text, "font-weight:bold;text-decoration:none;")}">${label}</a>`;
  // Outlook on Windows ignores the padding of a link, which would shrink the
  // button to its words; mso-padding-alt gives the cell that padding there and
  // nowhere else. (Its corners stay square in that app: it has no rounded corners.)
  const shape = b.background
    ? ` bgcolor="${b.background}" style="background-color:${b.background};`
    : ` style="border:${b.border};`;
  return `${TABLE}${full ? ' width="100%"' : ""}><tr><td align="center"${shape}border-radius:${b.radius}px;mso-padding-alt:${b.padding};">${anchor}</td></tr></table>`;
}

/** A heading's size and line height: set by hand, or the pair that goes with its level. */
function headingMetrics(block: HeadingBlock, narrow: boolean): [number, number] {
  if (block.fontSize > 0) {
    return [block.fontSize, Math.round(block.fontSize * (block.fontSize >= 28 ? 1.25 : 1.4))];
  }
  const size = headingAutoSize(block.level, narrow);
  return [size, size >= 30 ? 38 : size === 17 ? 26 : 30];
}

/** A ready-made block's own colors put in place of the theme's, so everything drawn inside follows them. */
function toned(c: Ctx, block: BlockColors): Ctx {
  const accent = hex(block.accentColor);
  const text = hex(block.textColor);
  if (!accent && !text) return c;
  return {
    ...c,
    accent: accent || c.accent,
    text: text || c.text,
    muted: text ? blend(text, safeColor(c.data.theme.card), 0.38) : c.muted,
  };
}

/** The inside of one block at a given width, or null when there is nothing to draw. */
function leafHtml(block: LeafBlock, width: number, ctx: Ctx): string | null {
  const c = "accentColor" in block ? toned(ctx, block) : ctx;
  const standIn = Boolean(c.options.placeholders);
  if (!standIn && !blockHasContent(block)) return null;
  const align = block.align;
  const narrow = width < 300;
  const editing = Boolean(c.options.editable);
  /** Marks the element that holds one of the block's fields, for typing on the canvas. */
  const ed = (field: string, placeholder: string, lines = false) =>
    editing
      ? ` data-edit="${field}" data-placeholder="${escapeHtml(placeholder)}"${lines ? ' data-lines="1"' : ""}`
      : "";
  /** A short piece of text, wrapped so it can be typed into when the block is picked. */
  const mark = (field: string, placeholder: string, value: string) =>
    editing
      ? `<span${ed(field, placeholder)}>${escapeHtml(value)}</span>`
      : escapeHtml(value.trim());
  /** A block's text: formatted when it has formatting, plain paragraphs otherwise. */
  const body = (value: { text: string; rich: RichNode[] | null }, style: string, at: string) =>
    value.rich?.length
      ? richHtml(value.rich, style, at, c.accent)
      : prose(value.text, style, at, c.accent);
  /**
   * Where a picked block's formatted text is typed: an empty place the canvas
   * puts its text editor into. It carries the font, size and color, so the
   * editor inside looks like the email.
   */
  const richSlot = (style: string, at: string, quoted = false) =>
    `<div data-rich-slot="text"${quoted ? ' data-quoted="1"' : ""} style="text-align:${at};--nl-accent:${c.accent};${style}"></div>`;
  switch (block.type) {
    case "heading": {
      const [size, line] = headingMetrics(block, narrow);
      const empty = !block.text.trim();
      const color = empty ? PLACEHOLDER_TEXT : hex(block.color) || c.text;
      const tag = `h${block.level}`;
      return `<${tag}${block.level === 1 && size > 26 ? ' class="nl-h1"' : ""} style="margin:0;text-align:${align};${type(c.headingFont, size, line, color, "font-weight:bold;")}">${escapeHtml(empty ? "Heading" : block.text.trim())}</${tag}>`;
    }

    case "text": {
      const sizes = { small: [14, 22], medium: [16, 26], large: [18, 30] } as const;
      const [size, line] = sizes[block.size];
      if (!block.text.trim()) {
        return `<p style="margin:0;text-align:${align};${type(c.font, size, line, PLACEHOLDER_TEXT)}">Write your text here.</p>`;
      }
      if (block.rich?.length) {
        return richHtml(
          block.rich,
          type(c.font, size, line, hex(block.color) || c.text),
          align,
          c.accent,
        );
      }
      return prose(
        block.text,
        type(c.font, size, line, hex(block.color) || c.text),
        align,
        c.accent,
      );
    }

    case "image": {
      const shown = Math.round((width * block.width) / 100);
      const url = usableImage(block.url);
      if (!url) return placeholderBox(shown, Math.round(shown * 0.5), "Image", c);
      return link(
        safeUrl(block.link),
        picture(url, shown, block.alt.trim(), c, {
          ratio: block.ratio,
          fill: block.width === 100,
          radius:
            block.corner >= 0
              ? block.corner
              : block.rounded
                ? Math.max(c.imageRadius, 10)
                : c.imageRadius,
          align,
        }),
        "text-decoration:none;",
      );
    }

    case "button":
      return pill(
        escapeHtml(block.label.trim() || "Button"),
        safeUrl(block.url),
        buttonLook(block),
        c,
        block.full,
      );

    case "divider":
      return `${TABLE} width="100%"><tr><td style="border-top:${block.thickness}px ${block.line} ${hex(block.color) || c.rule};font-size:0;line-height:0;">&nbsp;</td></tr></table>`;

    case "spacer":
      return `${TABLE} width="100%"><tr><td height="${block.height}" style="height:${block.height}px;font-size:0;line-height:0;">&nbsp;</td></tr></table>`;

    case "social": {
      const icons = block.links.flatMap((item) => {
        const href = socialHref(item.platform, item.url);
        if (!href && !standIn) return [];
        const label = SOCIAL_PLATFORMS.find((p) => p.id === item.platform)?.label ?? "";
        const icon = `<img src="${c.asset(`/newsletter/social/${item.platform}-${block.tone}.png`)}" alt="${escapeHtml(label)}" width="${block.size}" height="${block.size}" style="display:block;width:${block.size}px;height:${block.size}px;border:0;">`;
        return [`<td style="padding:0 5px;">${link(href, icon, "text-decoration:none;")}</td>`];
      });
      return icons.length ? `${TABLE}><tr>${icons.join("")}</tr></table>` : null;
    }

    case "video": {
      const href = safeUrl(block.url);
      const thumbnail = videoThumbnail(block);
      const image = thumbnail
        ? link(
            href,
            picture(thumbnail, width, block.label.trim() || "Video", c, {
              ratio: block.thumbnailRatio,
            }),
            "text-decoration:none;",
          )
        : placeholderBox(width, Math.round(width * 0.5625), "Video thumbnail", c);
      const label = block.label.trim();
      const button =
        label || editing
          ? `${TABLE} width="100%"><tr><td align="${align}" style="padding-top:14px;">${pill(`&#9654;&#xFE0E;&nbsp; ${mark("label", "Watch the video", block.label)}`, href, buttonLook(block), c)}</td></tr></table>`
          : "";
      return image + button;
    }

    case "product": {
      // The frame's line and padding take room from the picture.
      const inner = block.frame ? width - 34 : width;
      const url = usableImage(block.imageUrl);
      const href = safeUrl(block.url);
      const parts: string[] = [];
      if (url)
        parts.push(
          link(
            href,
            picture(url, inner, block.name.trim(), c, { align, ratio: block.imageRatio }),
            "text-decoration:none;",
          ),
        );
      else if (standIn)
        parts.push(placeholderBox(inner, Math.round(inner * 0.75), "Product image", c));
      const name = editing ? block.name : block.name.trim() || (standIn ? "Product name" : "");
      if (name || editing) {
        parts.push(
          `<h3${ed("name", "Product name")} style="margin:${parts.length ? 14 : 0}px 0 0 0;text-align:${align};${type(c.headingFont, 18, 26, editing || block.name.trim() ? c.text : PLACEHOLDER_TEXT, "font-weight:bold;")}">${escapeHtml(name)}</h3>`,
        );
      }
      if (block.price.trim() || editing) {
        parts.push(
          `<p${ed("price", "Price")} style="margin:2px 0 0 0;text-align:${align};${type(c.font, 16, 24, c.accent, "font-weight:bold;")}">${escapeHtml(editing ? block.price : block.price.trim())}</p>`,
        );
      }
      if (editing) {
        parts.push(
          `<div style="padding-top:6px;">${richSlot(type(c.font, 15, 24, c.muted), align)}</div>`,
        );
      } else if (block.text.trim()) {
        parts.push(
          `<div style="padding-top:6px;">${body(block, type(c.font, 15, 24, c.muted), align)}</div>`,
        );
      }
      if (block.buttonLabel.trim() || editing) {
        parts.push(
          `${TABLE} width="100%"><tr><td align="${align}" style="padding-top:14px;">${pill(mark("buttonLabel", "Button", block.buttonLabel), href, buttonLook(block), c)}</td></tr></table>`,
        );
      }
      if (!block.frame) {
        return `${TABLE} width="100%"><tr><td align="${align}">${parts.join("")}</td></tr></table>`;
      }
      return `${TABLE} width="100%" style="border:1px solid ${c.rule};border-radius:12px;border-collapse:separate;"><tr><td align="${align}" style="padding:16px;">${parts.join("")}</td></tr></table>`;
    }

    case "quote": {
      const empty = !block.text.trim();
      const said = type(
        c.headingFont,
        18,
        28,
        empty ? PLACEHOLDER_TEXT : c.text,
        "font-style:italic;",
      );
      const frame = (words: string, who: string) =>
        `${TABLE} width="100%"><tr><td style="border-left:3px solid ${c.accent};padding:4px 0 4px 18px;">${words}${who}</td></tr></table>`;
      if (editing) {
        // The words are typed in the canvas's text editor, which draws the quotation marks itself.
        const person = `<p style="margin:10px 0 0 0;${type(c.font, 14, 20, c.muted)}"><span${ed("name", "Name")} style="font-weight:bold;color:${c.text};">${escapeHtml(block.name)}</span> &nbsp;·&nbsp; <span${ed("role", "Role or company")}>${escapeHtml(block.role)}</span></p>`;
        return frame(
          richSlot(type(c.headingFont, 18, 28, c.text, "font-style:italic;"), "left", true),
          person,
        );
      }
      let words: string;
      if (block.rich?.length) {
        // Formatted: the marks open the first paragraph and close the last one.
        // A list at either end goes without, since a mark has no place in it.
        words = richHtml(block.rich, said, "left", c.accent);
        if (block.rich[0].type === "p") words = words.replace(/^(<p [^>]*>)/, "$1&ldquo;");
        if (block.rich[block.rich.length - 1].type === "p") {
          words = words.replace(/<\/p>$/, "&rdquo;</p>");
        }
      } else {
        words = `<p style="margin:0;${said}">&ldquo;${escapeHtml(empty ? "What a customer said about you." : block.text.trim()).replace(/\n/g, "<br>")}&rdquo;</p>`;
      }
      const by = [block.name.trim(), block.role.trim()].filter(Boolean);
      const who = by.length
        ? `<p style="margin:10px 0 0 0;${type(c.font, 14, 20, c.muted)}"><span style="font-weight:bold;color:${c.text};">${escapeHtml(by[0])}</span>${by[1] ? ` &nbsp;·&nbsp; ${escapeHtml(by[1])}` : ""}</p>`
        : "";
      return frame(words, who);
    }

    case "event": {
      const href = safeUrl(block.url);
      const date = block.date.trim() || (standIn ? "20 Mar" : "");
      const [first, ...rest] = date.split(/\s+/);
      const badge = date
        ? `${TABLE} width="88"><tr><td align="center" bgcolor="${blend(c.accent, c.data.theme.card, 0.86)}" style="background-color:${blend(c.accent, c.data.theme.card, 0.86)};border-radius:12px;padding:12px 6px;"><div style="${type(c.headingFont, 26, 30, c.accent, "font-weight:bold;")}">${escapeHtml(first)}</div>${rest.length ? `<div style="${type(c.font, 12, 16, c.accent, "font-weight:bold;text-transform:uppercase;letter-spacing:1px;")}">${escapeHtml(rest.join(" "))}</div>` : ""}</td></tr></table>`
        : "";
      const empty = !block.title.trim();
      const words: string[] = [
        editing
          ? `<h3${ed("title", "Event name")} style="margin:0;${type(c.headingFont, 20, 28, c.text, "font-weight:bold;")}">${escapeHtml(block.title)}</h3>`
          : `<h3 style="margin:0;${type(c.headingFont, 20, 28, empty ? PLACEHOLDER_TEXT : c.text, "font-weight:bold;")}">${escapeHtml(empty ? "Event name" : block.title.trim())}</h3>`,
      ];
      if (editing) {
        words.push(
          `<div style="padding-top:4px;">${richSlot(type(c.font, 15, 24, c.muted), "left")}</div>`,
        );
      } else if (block.text.trim()) {
        words.push(
          `<div style="padding-top:4px;">${body(block, type(c.font, 15, 24, c.muted), "left")}</div>`,
        );
      }
      if (block.buttonLabel.trim() || editing) {
        words.push(
          `<p style="margin:8px 0 0 0;${type(c.font, 15, 24, c.accent, "font-weight:bold;")}">${link(href, `${mark("buttonLabel", "Link text", block.buttonLabel)} &rarr;`, `color:${c.accent};text-decoration:none;`)}</p>`,
        );
      }
      if (!badge) return words.join("");
      if (narrow) return `${badge}<div style="padding-top:12px;">${words.join("")}</div>`;
      return `${TABLE} width="100%"><tr><td class="nl-stack" width="88" valign="top" style="width:88px;padding:0 18px 0 0;">${badge}</td><td class="nl-stack" valign="middle" align="left">${words.join("")}</td></tr></table>`;
    }

    case "story": {
      const url = usableImage(block.imageUrl);
      const href = safeUrl(block.linkUrl);
      const words: string[] = [];
      const title = block.title.trim() || (standIn && !block.text.trim() ? "Story title" : "");
      if (editing) {
        words.push(
          `<h3${ed("title", "Story title")} style="margin:0;${type(c.headingFont, 18, 26, c.text, "font-weight:bold;")}">${escapeHtml(block.title)}</h3>`,
          `<div style="padding-top:6px;">${richSlot(type(c.font, 15, 24, c.text), "left")}</div>`,
          `<p style="margin:8px 0 0 0;${type(c.font, 15, 24, c.accent, "font-weight:bold;")}">${mark("linkLabel", "Read more", block.linkLabel)} &rarr;</p>`,
        );
      } else if (title) {
        words.push(
          `<h3 style="margin:0;${type(c.headingFont, 18, 26, block.title.trim() ? c.text : PLACEHOLDER_TEXT, "font-weight:bold;")}">${link(href, escapeHtml(title), `color:${c.text};text-decoration:none;`)}</h3>`,
        );
      }
      if (!editing && block.text.trim()) {
        words.push(
          `<div style="padding-top:6px;">${body(block, type(c.font, 15, 24, c.text), "left")}</div>`,
        );
      }
      if (!editing && block.linkLabel.trim() && (href || standIn)) {
        words.push(
          `<p style="margin:8px 0 0 0;${type(c.font, 15, 24, c.accent, "font-weight:bold;")}">${link(href, `${escapeHtml(block.linkLabel.trim())} &rarr;`, `color:${c.accent};text-decoration:none;`)}</p>`,
        );
      }
      const text = words.join("");
      const side = 180;
      if (!url && !standIn) return text;
      if (narrow || width < 400) {
        const top = url
          ? link(
              href,
              picture(url, width, "", c, { ratio: block.imageRatio }),
              "text-decoration:none;",
            )
          : placeholderBox(width, Math.round(width * 0.6), "Image", c);
        return `${top}<div style="padding-top:12px;">${text}</div>`;
      }
      const image = url
        ? link(
            href,
            `<img src="${c.src(url)}" alt="" width="${side}"${block.imageRatio > 0 ? ` height="${Math.round(side / block.imageRatio)}"` : ""} class="nl-story-img" style="display:block;width:${side}px;max-width:100%;height:auto;border:0;${c.imageRadius ? `border-radius:${c.imageRadius}px;` : ""}">`,
            "text-decoration:none;",
          )
        : placeholderBox(side, 120, "Image", c);
      return `${TABLE} width="100%"><tr><td class="nl-stack" width="${side}" valign="top" style="width:${side}px;padding:0 20px 0 0;">${image}</td><td class="nl-stack" valign="top" align="left">${text}</td></tr></table>`;
    }
  }
}

/** Padding inside a block drawn as a box. */
export const NEWSLETTER_BOX_PAD = 20;

/** The room a block's content has: less when the block is drawn as a box with padding and a border. */
export function contentWidth(
  block: { boxed: boolean; borderWidth: number },
  width: number,
): number {
  return block.boxed ? width - 2 * (NEWSLETTER_BOX_PAD + block.borderWidth) : width;
}

/**
 * The table cell around a block: its spacing, alignment, background color and
 * picture, and, when it is drawn as a box, the box with its border and corners.
 * Returns what goes before and after the block's own content.
 */
function frame(
  block: NewsletterBlock,
  side: number,
  align: string | null,
  c: Ctx,
): { open: string; close: string } {
  const color = hex(block.background);
  const image = usableImage(block.backgroundImage);
  // Outlook on Windows draws no background picture; it shows the color (or nothing) instead.
  const fillAttrs = `${color ? ` bgcolor="${color}"` : ""}${image ? ` background="${c.src(image)}"` : ""}`;
  const fill = `${color ? `background-color:${color};` : ""}${image ? `background-image:url(&quot;${c.src(image)}&quot;);background-size:cover;background-position:center;` : ""}`;
  const cls = side ? ' class="nl-pad"' : "";
  const alignAttr = align ? ` align="${align}"` : "";
  const padding = `padding:${block.padTop}px ${side}px ${block.padBottom}px ${side}px;`;
  if (!block.boxed) {
    return { open: `<td${cls}${alignAttr}${fillAttrs} style="${padding}${fill}">`, close: "</td>" };
  }
  const border = block.borderWidth
    ? `border:${block.borderWidth}px solid ${hex(block.borderColor) || c.rule};`
    : "";
  // The box's color, border and corners are on the cell, not on the table:
  // Outlook on Windows leaves a white strip under a table's own top border
  // (seen in a real test), and draws a cell's border cleanly.
  return {
    open: `<td${cls} style="${padding}">${TABLE} width="100%" style="border-collapse:separate;"><tr><td${alignAttr}${fillAttrs} style="padding:${NEWSLETTER_BOX_PAD}px;${fill}${border}border-radius:${block.radius}px;">`,
    close: "</td></tr></table></td>",
  };
}

/**
 * What hides a block on one kind of screen. Mail apps that ignore style
 * sheets show a "not on phones" block everywhere and never show a "phones
 * only" one. The builder's own canvas always shows every block.
 */
function shown(block: NewsletterBlock, kind: "row" | "table", c: Ctx): string {
  if (c.options.placeholders || block.show === "all") return "";
  if (block.show === "desktop") return ' class="nl-hide-m"';
  return ` class="nl-show-m-${kind}" style="display:none;mso-hide:all;"`;
}

/**
 * A "phones only" block is kept from Outlook on Windows altogether. Hiding it
 * there with a style isn't enough: a real test showed a button inside such a
 * block still drawn, because that app doesn't pass the hiding on to a table
 * within. Comments only that app reads cut the block out of what it sees.
 */
function forPhones(block: NewsletterBlock, html: string, c: Ctx): string {
  if (c.options.placeholders || block.show !== "phone") return html;
  return `<!--[if !mso]><!-->${html}<!--<![endif]-->`;
}

/** One block as a table cell with its spacing, background and alignment; null when it draws nothing. */
function blockCell(block: LeafBlock, width: number, side: number, c: Ctx): string | null {
  const inner = leafHtml(block, contentWidth(block, width), c);
  if (inner === null) return null;
  const around = frame(block, side, block.align, c);
  return `${around.open}${inner}${around.close}`;
}

function columnsCell(block: ColumnsBlock, c: Ctx): string | null {
  if (!c.options.placeholders && !blockHasContent(block)) return null;
  const widths = columnWidths(block.layout, contentWidth(block, NEWSLETTER_INNER));
  const around = frame(block, NEWSLETTER_SIDE, null, c);
  const cells = block.cells.map((cell, index) => {
    const last = index === block.cells.length - 1;
    const gap = last ? 0 : NEWSLETTER_GAP;
    const rows = cell
      .map((inner) => {
        const html = blockCell(inner, widths[index], 0, c);
        return html
          ? forPhones(
              inner,
              `${TABLE} width="100%"${shown(inner, "table", c)}><tr>${html}</tr></table>`,
              c,
            )
          : null;
      })
      .filter((html): html is string => html !== null);
    return {
      width: widths[index] + gap,
      html: `<div class="nl-col" style="display:inline-block;width:100%;max-width:${widths[index] + gap}px;vertical-align:${block.valign};"><div class="nl-col-in" style="padding:0 ${gap}px 0 0;">${rows.join("") || "&nbsp;"}</div></div>`,
    };
  });
  // Each column is a box that sits beside the last one while there is room and
  // drops under it when there isn't. That needs no style sheet, so it also
  // works in mail apps that throw style sheets away. Outlook on Windows doesn't
  // know such boxes; it gets a plain table instead, in comments only it reads.
  const outlook = (html: string) => `<!--[if mso]>${html}<![endif]-->`;
  const cell = (width: number) => `<td width="${width}" valign="${block.valign}">`;
  const columns =
    outlook(`${TABLE} width="100%"><tr>${cell(cells[0].width)}`) +
    cells
      .map((column, index) => (index ? outlook(`</td>${cell(column.width)}`) : "") + column.html)
      .join("") +
    outlook("</td></tr></table>");
  if (!block.stack) {
    // Kept side by side on every screen: a plain table whose columns share the width.
    const total = widths.reduce((sum, width) => sum + width, 0) || 1;
    // The room between the columns is shared out so every column's content
    // is equally wide: the first gives it all on its right, the last on its left.
    const count = block.cells.length;
    const room = 12;
    const kept = block.cells
      .map((_cell, index) => {
        const left = Math.round((room * index) / count);
        const right = Math.round((room * (count - 1 - index)) / count);
        const inside = cells[index].html
          .replace(/^<div class="nl-col"[^>]*><div class="nl-col-in"[^>]*>/, "")
          .replace(/<\/div><\/div>$/, "");
        return `<td width="${Math.round((widths[index] / total) * 100)}%" valign="${block.valign}" style="padding:0 ${right}px 0 ${left}px;">${inside}</td>`;
      })
      .join("");
    return `${around.open}${TABLE} width="100%"><tr>${kept}</tr></table>${around.close}`;
  }
  return `${around.open}${columns}${around.close}`;
}

function headerRow(c: Ctx): string | null {
  const { header, theme } = c.data;
  if (!header.show) return null;
  const name = header.brandName.trim();
  const logoUrl = usableImage(header.logoUrl);
  const band = header.style === "band";
  const center = header.style === "center";
  const color = band ? textOn(c.accent) : c.text;
  const height = header.logoHeight;
  const brand = logoUrl
    ? `<img src="${c.src(logoUrl)}" alt="${escapeHtml(name || "Logo")}" height="${height}"${header.logoRatio > 0 ? ` width="${Math.round(height * header.logoRatio)}"` : ""} style="display:${center ? "inline-block" : "block"};height:${height}px;width:auto;border:0;">`
    : c.options.editable
      ? // Picked on the canvas: the name is typed where it stands.
        `<span data-edit="brandName" data-placeholder="Your brand" style="${type(c.headingFont, 20, 28, color, "font-weight:bold;")}">${escapeHtml(header.brandName)}</span>`
      : name || c.options.placeholders
        ? `<span style="${type(c.headingFont, 20, 28, name ? color : band ? color : PLACEHOLDER_TEXT, "font-weight:bold;")}">${escapeHtml(name || "Your brand")}</span>`
        : "";
  if (!brand) return null;
  const align = center ? "center" : "left";
  if (band) {
    return `<tr><td class="nl-pad" align="left" bgcolor="${c.accent}" style="background-color:${c.accent};padding:24px ${NEWSLETTER_SIDE}px;${theme.rounded ? "border-radius:16px 16px 0 0;" : ""}">${brand}</td></tr>`;
  }
  const rule = center
    ? `${TABLE} width="100%"><tr><td style="padding-top:20px;"><div style="border-top:1px solid ${c.rule};font-size:0;line-height:0;">&nbsp;</div></td></tr></table>`
    : "";
  return `<tr><td class="nl-pad" align="${align}" style="padding:32px ${NEWSLETTER_SIDE}px 0 ${NEWSLETTER_SIDE}px;">${brand}${rule}</td></tr>`;
}

function footerRow(c: Ctx): string {
  const { footer, header } = c.data;
  const small = type(c.font, 13, 20, c.muted);
  const lines: string[] = [];
  const sender = [header.brandName.trim(), footer.address.trim()].filter(Boolean).join(" · ");
  if (c.options.editable) {
    // Picked on the canvas: the note, the name and the address are typed where they stand.
    const piece = (field: string, placeholder: string, value: string) =>
      `<span data-edit="${field}" data-placeholder="${escapeHtml(placeholder)}">${escapeHtml(value)}</span>`;
    lines.push(
      piece("note", "Why they get this email", footer.note),
      `${piece("brandName", "Your company", header.brandName)} · ${piece("address", "Your postal address", footer.address)}`,
    );
  } else {
    if (footer.note.trim()) lines.push(escapeHtml(footer.note.trim()));
    if (sender) lines.push(escapeHtml(sender));
    else if (c.options.placeholders) lines.push("Your company · your postal address");
  }
  const links: string[] = [];
  const website = safeUrl(footer.website);
  const linkStyle = `color:${c.muted};text-decoration:underline;`;
  if (website) links.push(link(website, escapeHtml(displayUrl(website)), linkStyle));
  const unsubscribe = unsubscribeHref(c.data);
  if (unsubscribe) {
    links.push(
      c.options.test || c.options.placeholders || c.options.preview
        ? link("#", "Unsubscribe", linkStyle)
        : c.data.footer.service === "klaviyo"
          ? unsubscribe
          : link(unsubscribe, "Unsubscribe", linkStyle),
    );
  }
  if (links.length) lines.push(links.join(" &nbsp;·&nbsp; "));
  const body = lines.length
    ? `${TABLE} width="100%"><tr><td align="center" style="border-top:1px solid ${c.rule};padding-top:20px;${small}">${lines.join("<br>")}</td></tr></table>`
    : "";
  return `<tr><td class="nl-pad" align="center" style="padding:36px ${NEWSLETTER_SIDE}px 36px ${NEWSLETTER_SIDE}px;">${body}</td></tr>`;
}

function blockRow(block: NewsletterBlock, c: Ctx): string | null {
  const cell =
    block.type === "columns"
      ? columnsCell(block, c)
      : blockCell(block, NEWSLETTER_INNER, NEWSLETTER_SIDE, c);
  return cell ? forPhones(block, `<tr${shown(block, "row", c)}>${cell}</tr>`, c) : null;
}

function cardTable(rows: string[], c: Ctx, radius = true): string {
  const card = safeColor(c.data.theme.card);
  return `${TABLE} width="${NEWSLETTER_WIDTH}" bgcolor="${card}" style="width:100%;max-width:${NEWSLETTER_WIDTH}px;background-color:${card};${radius && c.data.theme.rounded ? "border-radius:16px;border-collapse:separate;" : ""}">${rows.join("\n")}</table>`;
}

// ---------------------------------------------------------------------------
// Pieces for the builder's canvas
// ---------------------------------------------------------------------------

/** Blocks whose words can be typed straight on the canvas. */
export type InlineBlock = Extract<LeafBlock, { type: "heading" | "text" | "button" }>;

/** Blocks made of several pieces of text, each typed into where it is drawn. */
export const FIELD_BLOCK_FIELDS = {
  story: ["title", "linkLabel"],
  product: ["name", "price", "buttonLabel"],
  quote: ["name", "role"],
  event: ["title", "buttonLabel"],
  video: ["label"],
} as const;
export type FieldBlock = Extract<LeafBlock, { type: keyof typeof FIELD_BLOCK_FIELDS }>;

export function isFieldBlock(block: NewsletterBlock): block is FieldBlock {
  return block.type in FIELD_BLOCK_FIELDS;
}

/** Whether `field` is one of a block's own text fields that can be typed on the canvas. */
export function isBlockTextField(block: NewsletterBlock, field: string): boolean {
  return (
    isFieldBlock(block) && (FIELD_BLOCK_FIELDS[block.type] as readonly string[]).includes(field)
  );
}

/** Blocks whose longer text can be formatted: typed in the canvas's text editor. */
export type RichFieldBlock = Extract<LeafBlock, { type: "story" | "product" | "event" | "quote" }>;

export function isRichFieldBlock(block: NewsletterBlock): block is RichFieldBlock {
  return (
    block.type === "story" ||
    block.type === "product" ||
    block.type === "event" ||
    block.type === "quote"
  );
}

export const RICH_FIELD_PLACEHOLDER: Record<RichFieldBlock["type"], string> = {
  story: "Two or three lines about it",
  product: "A line on why it is worth having",
  event: "Time and place",
  quote: "What a customer said about you.",
};

export function isInlineBlock(block: NewsletterBlock): block is InlineBlock {
  return block.type === "heading" || block.type === "text" || block.type === "button";
}

/** Style values for the canvas, in the shape the page's own elements take them. */
export type BoxStyle = Record<string, string | number>;

/**
 * A block's spacing, background and (when it is drawn as a box) its box, as
 * style values for the canvas: `outer` is the row, `inner` the box inside it,
 * `width` the room left for the content. Kept beside frame(): the same rules.
 */
export function editBoxStyle(
  data: NewsletterData,
  block: NewsletterBlock,
  nestedWidth: number | null,
  imageSrc: (url: string) => string = (url) => url,
): { outer: BoxStyle; inner: BoxStyle | null; width: number } {
  const c = context(data, {});
  const side = nestedWidth === null ? NEWSLETTER_SIDE : 0;
  const color = hex(block.background);
  const image = usableImage(block.backgroundImage);
  const fill: BoxStyle = {
    ...(color ? { backgroundColor: color } : {}),
    ...(image
      ? {
          backgroundImage: `url("${imageSrc(image).replace(/"/g, "%22")}")`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }
      : {}),
  };
  const base: BoxStyle = {
    padding: `${block.padTop}px ${side}px ${block.padBottom}px ${side}px`,
    backgroundColor: nestedWidth === null ? safeColor(data.theme.card) : "transparent",
  };
  const width = contentWidth(block, nestedWidth ?? NEWSLETTER_INNER);
  if (!block.boxed) return { outer: { ...base, ...fill }, inner: null, width };
  return {
    outer: base,
    inner: {
      ...fill,
      padding: NEWSLETTER_BOX_PAD,
      borderRadius: block.radius,
      ...(block.borderWidth
        ? { border: `${block.borderWidth}px solid ${hex(block.borderColor) || c.rule}` }
        : {}),
    },
    width,
  };
}

export type InlineEditStyle = {
  /** The row around the words: the block's own spacing and background. */
  box: BoxStyle;
  /** The box inside the row, when the block is drawn as one. */
  inner: BoxStyle | null;
  /** The words themselves, exactly as the email sets them. */
  text: {
    fontFamily: string;
    fontSize: number;
    lineHeight: string;
    color: string;
    fontWeight: "bold" | "normal";
    textAlign: "left" | "center" | "right";
  };
  /** For a button: the shape the words sit on. */
  button: {
    /** The shape's color; "transparent" for an outline button. */
    background: string;
    /** The line around an outline button, or null. */
    border: string | null;
    borderRadius: number;
    padding: string;
    full: boolean;
  } | null;
};

/**
 * How a heading, text or button block looks in the email, as plain style
 * values, so the canvas can put a text field in its place that looks the same.
 * Kept beside leafHtml: the sizes here are the sizes there.
 */
export function inlineEditStyle(
  data: NewsletterData,
  block: InlineBlock,
  nestedWidth: number | null,
  imageSrc?: (url: string) => string,
): InlineEditStyle {
  const c = context(data, {});
  const around = editBoxStyle(data, block, nestedWidth, imageSrc);
  const box = around.outer;
  const inner = around.inner;
  if (block.type === "heading") {
    const [fontSize, line] = headingMetrics(block, around.width < 300);
    return {
      box,
      inner,
      text: {
        fontFamily: c.headingFont,
        fontSize,
        lineHeight: `${line}px`,
        color: hex(block.color) || c.text,
        fontWeight: "bold",
        textAlign: block.align,
      },
      button: null,
    };
  }
  if (block.type === "text") {
    const sizes = { small: [14, 22], medium: [16, 26], large: [18, 30] } as const;
    const [fontSize, line] = sizes[block.size];
    return {
      box,
      inner,
      text: {
        fontFamily: c.font,
        fontSize,
        lineHeight: `${line}px`,
        color: hex(block.color) || c.text,
        fontWeight: "normal",
        textAlign: block.align,
      },
      button: null,
    };
  }
  const drawn = drawnButton(buttonLook(block), c);
  return {
    box,
    inner,
    text: {
      fontFamily: c.font,
      fontSize: drawn.fontSize,
      lineHeight: `${drawn.lineHeight}px`,
      color: drawn.text,
      fontWeight: "bold",
      textAlign: block.align,
    },
    button: {
      background: drawn.background ?? "transparent",
      border: drawn.border,
      borderRadius: drawn.radius,
      padding: drawn.padding,
      full: block.full,
    },
  };
}

/**
 * One block exactly as the email draws it, for the canvas. A top-level block
 * comes as a full-width row of the column; a block inside a column comes at
 * that column's width. Columns blocks are laid out by the canvas itself.
 */
export function blockFragmentHtml(
  data: NewsletterData,
  block: LeafBlock,
  nestedWidth: number | null,
  options: RenderOptions = {},
): string {
  const c = context(data, { ...options, placeholders: true });
  if (nestedWidth !== null) {
    return `${TABLE} width="100%"><tr>${blockCell(block, nestedWidth, 0, c) ?? "<td></td>"}</tr></table>`;
  }
  return cardTable([blockRow(block, c) ?? ""], c, false);
}

export function headerFragmentHtml(data: NewsletterData, options: RenderOptions = {}): string {
  const c = context(data, { ...options, placeholders: true });
  return cardTable([headerRow(c) ?? ""], c, false);
}

export function footerFragmentHtml(data: NewsletterData, options: RenderOptions = {}): string {
  const c = context(data, { ...options, placeholders: true });
  return cardTable([footerRow(c)], c, false);
}

// ---------------------------------------------------------------------------
// The whole newsletter
// ---------------------------------------------------------------------------

/** The newsletter without the document around it: the page color and the column. */
export function newsletterInnerHtml(data: NewsletterData, options: RenderOptions = {}): string {
  const c = context(data, options);
  const page = safeColor(data.theme.page);
  const rows = [
    headerRow(c),
    ...data.blocks.map((block) => blockRow(block, c)),
    footerRow(c),
  ].filter((row): row is string => row !== null);
  const flush = page === safeColor(data.theme.card);
  return `${TABLE} width="100%" bgcolor="${page}" style="background-color:${page};"><tr><td class="nl-outer" align="center" style="padding:${flush ? 0 : 24}px 12px;">${cardTable(rows, c)}</td></tr></table>`;
}

/** The newsletter as a whole HTML document, ready to paste into an email service. */
export function newsletterHtml(data: NewsletterData, options: RenderOptions = {}): string {
  const page = safeColor(data.theme.page);
  const preheader = data.preheader.trim()
    ? `<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:${page};">${escapeHtml(data.preheader.trim())}</div>`
    : "";
  const css = [
    ":root{color-scheme:light only;}",
    "body{margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}",
    // Outlook on Windows adds room around tables and smooths scaled pictures badly unless told not to.
    "table,td{mso-table-lspace:0pt;mso-table-rspace:0pt;}",
    "img{-ms-interpolation-mode:bicubic;}",
    `@media only screen and (max-width:${NEWSLETTER_WIDTH + 20}px){`,
    ".nl-outer{padding:0!important;}",
    ".nl-pad{padding-left:20px!important;padding-right:20px!important;}",
    ".nl-stack{display:block!important;width:100%!important;padding:0 0 16px 0!important;}",
    ".nl-col{display:block!important;max-width:100%!important;}",
    ".nl-col-in{padding:0 0 16px 0!important;}",
    ".nl-story-img{width:100%!important;}",
    ".nl-fill{max-width:100%!important;}",
    ".nl-h1{font-size:26px!important;line-height:32px!important;}",
    ".nl-hide-m{display:none!important;}",
    ".nl-show-m-row{display:table-row!important;}",
    ".nl-show-m-table{display:table!important;}",
    "}",
    options.preview ? "a{pointer-events:none;}" : "",
  ].join("");
  const title = data.subject.trim() || data.header.brandName.trim() || "Newsletter";
  const document = [
    "<!doctype html>",
    '<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta http-equiv="X-UA-Compatible" content="IE=edge">',
    '<meta name="x-apple-disable-message-reformatting">',
    '<meta name="format-detection" content="telephone=no,date=no,address=no,email=no">',
    // Outlook on Windows scales everything on high-density screens unless it is told the picture density.
    "<!--[if mso]><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->",
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="color-scheme" content="light">',
    '<meta name="supported-color-schemes" content="light">',
    `<title>${escapeHtml(title)}</title>`,
    `<style>${css}</style>`,
    "</head>",
    `<body style="margin:0;padding:0;background-color:${page};">`,
    preheader,
    newsletterInnerHtml(data, options),
    "</body>",
    "</html>",
  ]
    .filter(Boolean)
    .join("\n");
  return fillPersonal(
    document,
    data.footer.service,
    options.preview || options.test ? "sample" : "send",
  );
}

function blockText(block: NewsletterBlock): string {
  if (!blockHasContent(block)) return "";
  const withLink = (label: string, url: string) => {
    const href = safeUrl(url);
    return href ? `${label}: ${href}` : label;
  };
  switch (block.type) {
    case "heading":
      return block.text.trim().toUpperCase();
    case "text":
      return paragraphs(block.text).join("\n\n");
    case "button":
      return withLink(block.label.trim(), block.url);
    case "divider":
      return "---";
    case "spacer":
    case "image":
      return "";
    case "social":
      return block.links
        .flatMap((item) => {
          const href = socialHref(item.platform, item.url);
          const label = SOCIAL_PLATFORMS.find((p) => p.id === item.platform)?.label ?? "";
          return href ? [`${label}: ${href.replace(/^mailto:/, "")}`] : [];
        })
        .join("\n");
    case "video":
      return withLink(block.label.trim() || "Watch the video", block.url);
    case "product":
      return [
        [block.name.trim(), block.price.trim()].filter(Boolean).join(" · "),
        paragraphs(block.text).join("\n\n"),
        block.buttonLabel.trim()
          ? withLink(block.buttonLabel.trim(), block.url)
          : (safeUrl(block.url) ?? ""),
      ]
        .filter(Boolean)
        .join("\n");
    case "quote":
      return [
        `"${block.text.trim()}"`,
        [block.name.trim(), block.role.trim()].filter(Boolean).join(", "),
      ]
        .filter(Boolean)
        .join("\n");
    case "event":
      return [
        [block.date.trim(), block.title.trim()].filter(Boolean).join(" · "),
        paragraphs(block.text).join("\n\n"),
        block.buttonLabel.trim()
          ? withLink(block.buttonLabel.trim(), block.url)
          : (safeUrl(block.url) ?? ""),
      ]
        .filter(Boolean)
        .join("\n");
    case "story":
      return [block.title.trim(), paragraphs(block.text).join("\n\n"), safeUrl(block.linkUrl) ?? ""]
        .filter(Boolean)
        .join("\n");
    case "columns":
      return block.cells.flat().map(blockText).filter(Boolean).join("\n\n");
  }
}

/** The same newsletter as plain text, for the plain-text version email services ask for. */
export function newsletterText(data: NewsletterData): string {
  const parts: string[] = [];
  const name = data.header.brandName.trim();
  if (data.header.show && name) parts.push(name);
  for (const block of data.blocks) parts.push(blockText(block));
  const footer = [
    data.footer.note.trim(),
    [name, data.footer.address.trim()].filter(Boolean).join(" · "),
    safeUrl(data.footer.website) ?? "",
  ].filter(Boolean);
  const unsubscribe = unsubscribeHref(data);
  if (unsubscribe) {
    footer.push(data.footer.service === "klaviyo" ? unsubscribe : `Unsubscribe: ${unsubscribe}`);
  }
  if (footer.length) parts.push(footer.join("\n"));
  return fillPersonal(parts.filter(Boolean).join("\n\n"), data.footer.service, "send");
}

/** How many columns a layout has. */
export function layoutCells(layout: ColumnsLayout): number {
  return COLUMNS_LAYOUTS.find((l) => l.id === layout)?.cells ?? 2;
}
