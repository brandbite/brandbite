import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { previewLogoSrc } from "@/lib/email-signature/signature";
import {
  cleanDraft,
  cleanRewrite,
  cleanSubjects,
  draftBlocks,
  NEWSLETTER_BRIEF_MAX,
  newsletterSystemPrompt,
  newsletterUserPrompt,
  parseNewsletterRequest,
  rewritePrompts,
  subjectPrompts,
} from "@/lib/newsletter/ai";
import { commit, HISTORY_JOIN_MS, redo, startHistory, undo } from "@/lib/newsletter/history";
import {
  NEWSLETTER_IMAGE_MAX_BYTES,
  newsletterImageKey,
  newsletterImageProblem,
} from "@/lib/newsletter/images";
import {
  allBlocks,
  canPlace,
  cloneBlock,
  countBlocks,
  EMPTY_NEWSLETTER,
  findBlock,
  hasContent,
  imageUrlProblem,
  insertBlock,
  isMergeTag,
  lookTheme,
  moveBlock,
  newBlock,
  NEWSLETTER_BLOCK_TYPES,
  NEWSLETTER_LOOKS,
  NEWSLETTER_MAX_BLOCKS,
  newsletterProblems,
  parseSlotId,
  readNewsletter,
  removeBlock,
  setColumnsLayout,
  slotId,
  socialHref,
  tint,
  unsubscribeHref,
  updateBlock,
  usesProBlocks,
  videoThumbnail,
  youtubeId,
  type ColumnsBlock,
  type NewsletterBlock,
  type NewsletterData,
} from "@/lib/newsletter/newsletter";
import {
  blend,
  blockFragmentHtml,
  columnWidths,
  newsletterHtml,
  newsletterInnerHtml,
  newsletterText,
} from "@/lib/newsletter/render";
import {
  builderImageSrc,
  findTemplate,
  fromTemplate,
  NEWSLETTER_TEMPLATES,
  TEMPLATE_PICTURE_ORIGIN,
  TEMPLATE_PICTURES,
  templateIsPro,
} from "@/lib/newsletter/templates";

const ids = () => {
  let n = 0;
  return () => `id${(n += 1)}`;
};

const columns: ColumnsBlock = {
  ...newBlock("columns", "cols"),
  cells: [
    [{ ...newBlock("heading", "c1"), text: "Left" }],
    [{ ...newBlock("text", "c2"), text: "Right" }],
  ],
};

const blocks: NewsletterBlock[] = [
  { ...newBlock("heading", "h"), text: "Spring menu <is> here", level: 1 },
  { ...newBlock("text", "t"), text: "First paragraph.\n\nSecond one, see https://acme.com/menu." },
  { ...newBlock("image", "i"), url: "https://acme.com/a.jpg?x=1&y=2", alt: 'A "plate"' },
  { ...newBlock("button", "b"), label: "Book a table", url: "acme.com/book" },
  columns,
  {
    ...newBlock("story", "s"),
    imageUrl: "https://acme.com/s.png",
    title: "New chef",
    text: "Meet Ada.",
    linkUrl: "https://acme.com/chef",
  },
];

const data: NewsletterData = {
  ...EMPTY_NEWSLETTER,
  name: "March issue",
  subject: "Our spring menu",
  preheader: "Three new dishes",
  theme: { ...EMPTY_NEWSLETTER.theme, accent: "#1f3a5f" },
  header: { ...EMPTY_NEWSLETTER.header, brandName: "Acme & Co" },
  blocks,
  footer: {
    ...EMPTY_NEWSLETTER.footer,
    note: "You signed up at acme.com.",
    address: "1 Mill Street, Leeds",
    website: "acme.com",
  },
};

describe("newsletter HTML", () => {
  it("is a whole email document with the content in order", () => {
    const html = newsletterHtml(data);
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<title>Our spring menu</title>");
    expect(html).toContain("Three new dishes");
    expect(html).toContain('width="600"');
    const order = [
      "Spring menu",
      "First paragraph.",
      "a.jpg",
      "Book a table",
      "Left",
      "Right",
      "New chef",
    ].map((piece) => html.indexOf(piece));
    expect(order.every((at) => at > 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("escapes everything that was typed", () => {
    const html = newsletterHtml(data);
    expect(html).toContain("Spring menu &lt;is&gt; here");
    expect(html).toContain("Acme &amp; Co");
    expect(html).toContain('alt="A &quot;plate&quot;"');
    expect(html).toContain('src="https://acme.com/a.jpg?x=1&amp;y=2"');
    const sneaky = newsletterHtml({
      ...data,
      theme: { ...data.theme, accent: "red;background:url(x)" },
      blocks: [
        { ...newBlock("button", "1"), label: "Go", url: "javascript:alert(1)" },
        { ...newBlock("text", "2"), text: '<script>alert(1)</script> "quoted"' },
        { ...newBlock("heading", "3"), text: "Hi", color: "url(x)", background: "expression(1)" },
      ],
    });
    expect(sneaky).not.toContain("javascript:");
    expect(sneaky).not.toContain("<script>");
    expect(sneaky).not.toContain("url(x)");
    expect(sneaky).not.toContain("expression");
  });

  it("links web addresses in text and keeps the sentence's full stop out of the link", () => {
    const html = newsletterHtml(data);
    expect(html).toContain('<a href="https://acme.com/menu"');
    expect(html).toContain(">acme.com/menu</a>.");
    expect(html).toContain('<a href="https://acme.com/book"');
  });

  it("puts columns side by side and lets them stack on a phone", () => {
    const html = newsletterHtml(data);
    // Boxes that sit side by side while there is room, with a plain table for Outlook on Windows.
    expect(html).toContain(
      '<div class="nl-col" style="display:inline-block;width:100%;max-width:270px;vertical-align:top;">',
    );
    expect(html).toContain('max-width:250px;vertical-align:top;">');
    expect(html).toContain('<!--[if mso]></td><td width="250" valign="top"><![endif]-->');
    expect(html).toContain(".nl-col{display:block!important;max-width:100%!important;}");
    expect(html).toContain("mso-padding-alt:14px 28px;");
    expect(html).toContain("<o:PixelsPerInch>96</o:PixelsPerInch>");
    expect(columnWidths("1-1", 520)).toEqual([250, 250]);
    expect(columnWidths("1-2", 520)).toEqual([166, 333]);
    expect(columnWidths("1-1-1", 520)).toEqual([160, 160, 160]);
  });

  it("leaves out empty blocks in the email but draws them as stand-ins in the builder", () => {
    const empty: NewsletterData = {
      ...data,
      blocks: [
        newBlock("heading", "1"),
        newBlock("image", "2"),
        newBlock("button", "3"),
        newBlock("product", "4"),
      ],
    };
    const sent = newsletterHtml(empty);
    expect(sent).not.toContain("<h2");
    expect(sent).not.toContain("Product name");
    const shown = newsletterInnerHtml(empty, { placeholders: true });
    expect(shown).toContain(">Heading</h2>");
    expect(shown).toContain(">Image</td>");
    expect(shown).toContain(">Button</a>");
    expect(shown).toContain("Product name");
    expect(blockFragmentHtml(empty, newBlock("text", "x"), 250)).toContain("Write your text here.");
  });

  it("applies each block's own spacing, alignment, background and color", () => {
    const html = newsletterHtml({
      ...data,
      blocks: [
        {
          ...newBlock("heading", "1"),
          text: "Styled",
          align: "center",
          padTop: 48,
          padBottom: 12,
          background: "#FFEEDD",
          color: "#112233",
        },
      ],
    });
    expect(html).toContain('align="center" bgcolor="#ffeedd" style="padding:48px 40px 12px 40px;');
    expect(html).toContain("text-align:center;");
    expect(html).toContain("color:#112233;");
  });

  it("draws every look and header style", () => {
    for (const look of NEWSLETTER_LOOKS) {
      const made = lookTheme(look.id, "#1f3a5f");
      const html = newsletterHtml({
        ...data,
        theme: made.theme,
        header: { ...data.header, style: made.headerStyle },
      });
      expect(html, look.id).toContain("Book a table");
      expect(html, look.id).toContain("Acme &amp; Co");
    }
    const bold = lookTheme("bold", "#1f3a5f");
    expect(
      newsletterHtml({ ...data, theme: bold.theme, header: { ...data.header, style: "band" } }),
    ).toContain('bgcolor="#1f3a5f" style="background-color:#1f3a5f;padding:24px');
    expect(newsletterHtml({ ...data, header: { ...data.header, show: false } })).not.toContain(
      "Acme &amp; Co</span>",
    );
    expect(
      newsletterHtml({ ...data, header: { ...data.header, logoUrl: "https://acme.com/logo.png" } }),
    ).toContain('src="https://acme.com/logo.png" alt="Acme &amp; Co" height="40"');
  });

  it("draws the ready-made blocks", () => {
    const html = newsletterHtml(
      {
        ...data,
        blocks: [
          { ...newBlock("product", "p"), name: "Candle", price: "$24", url: "acme.com/candle" },
          { ...newBlock("quote", "q"), text: "Lovely.", name: "Ada", role: "Chef" },
          { ...newBlock("event", "e"), date: "20 Mar", title: "Workshop", url: "acme.com/w" },
          { ...newBlock("video", "v"), url: "https://youtu.be/dQw4w9WgXcQ" },
          {
            ...newBlock("social", "so"),
            links: [
              { platform: "instagram", url: "instagram.com/acme" },
              { platform: "email", url: "hi@acme.com" },
              { platform: "x", url: "" },
            ],
          },
        ],
      },
      { assetBase: "https://brandbite.test" },
    );
    expect(html).toContain("Candle");
    expect(html).toContain("$24");
    expect(html).toContain("&ldquo;Lovely.&rdquo;");
    expect(html).toContain(">20</div>");
    expect(html).toContain("Workshop");
    expect(html).toContain('src="https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg"');
    expect(html).toContain('src="https://brandbite.test/newsletter/social/instagram-dark.png"');
    expect(html).toContain('href="mailto:hi@acme.com"');
    expect(html).not.toContain("x-dark.png");
  });

  it("loads pictures through our own address in the builder only, and stops its links", () => {
    const preview = newsletterHtml(data, { imageSrc: previewLogoSrc, preview: true });
    expect(preview).toContain(
      'src="/api/tools/signature-logo?url=https%3A%2F%2Facme.com%2Fa.jpg%3Fx%3D1%26y%3D2"',
    );
    expect(preview).toContain("a{pointer-events:none;}");
    const real = newsletterHtml(data);
    expect(real).not.toContain("/api/tools/signature-logo");
    expect(real).not.toContain("pointer-events");
  });
});

describe("unsubscribe link", () => {
  const withService = (service: NewsletterData["footer"]["service"], unsubscribe = "") => ({
    ...data,
    footer: { ...data.footer, service, unsubscribe },
  });

  it("carries the tag of the chosen service, and none in a test email", () => {
    expect(newsletterHtml(withService("mailchimp"))).toContain('href="*|UNSUB|*"');
    expect(newsletterHtml(withService("brevo"))).toContain('href="{{ unsubscribe }}"');
    const klaviyo = newsletterHtml(withService("klaviyo"));
    expect(klaviyo).toContain("{% unsubscribe %}");
    expect(klaviyo).not.toContain('href="{% unsubscribe %}"');
    const test = newsletterHtml(withService("mailchimp"), { test: true });
    expect(test).not.toContain("UNSUB");
    expect(test).toContain('<a href="#"');
  });

  it("takes a link or a tag for another service, and nothing else", () => {
    expect(unsubscribeHref(withService("other"))).toBeNull();
    expect(unsubscribeHref(withService("other", "acme.com/out"))).toBe("https://acme.com/out");
    expect(unsubscribeHref(withService("other", "{{ unsubscribe_url }}"))).toBe(
      "{{ unsubscribe_url }}",
    );
    expect(unsubscribeHref(withService("other", "javascript:alert(1)"))).toBeNull();
    expect(isMergeTag("[unsubscribe]")).toBe(true);
    expect(isMergeTag('{{ x }}"><script>')).toBe(false);
    expect(isMergeTag("just words")).toBe(false);
  });
});

describe("checks before sending", () => {
  it("says what is missing and where", () => {
    const problems = newsletterProblems({
      ...data,
      subject: "",
      blocks: [
        { ...newBlock("button", "b"), label: "Go" },
        { ...newBlock("image", "i"), url: "http://acme.com/a.jpg" },
        { ...newBlock("image", "i2"), url: "https://acme.com/a.jpg" },
        { ...newBlock("video", "v") },
      ],
      footer: { ...data.footer, address: "", service: "other" },
    });
    const at = (target: string) => problems.filter((p) => p.target === target).map((p) => p.text);
    expect(at("inbox")).toEqual(["Add a subject line."]);
    expect(at("b")[0]).toMatch(/button has no link/);
    expect(at("i")[0]).toMatch(/can't be used/);
    expect(at("i2")[0]).toMatch(/no description/);
    expect(at("v")[0]).toMatch(/no link/);
    expect(at("footer")).toHaveLength(2);
  });

  it("has nothing to say about a finished newsletter", () => {
    expect(newsletterProblems(data)).toEqual([]);
  });

  it("knows an empty newsletter from one with content", () => {
    expect(hasContent(EMPTY_NEWSLETTER)).toBe(false);
    expect(
      hasContent({ ...data, blocks: [newBlock("divider", "1"), newBlock("spacer", "2")] }),
    ).toBe(false);
    expect(hasContent({ ...data, blocks: [columns] })).toBe(true);
    expect(imageUrlProblem("")).toBeNull();
    expect(imageUrlProblem("https://acme.com/a.svg?v=2")).toMatch(/SVG/);
  });

  it("reads video and social addresses", () => {
    expect(youtubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://vimeo.com/123")).toBeNull();
    expect(videoThumbnail({ ...newBlock("video", "v"), url: "https://vimeo.com/123" })).toBeNull();
    expect(socialHref("email", "mailto:hi@acme.com")).toBe("mailto:hi@acme.com");
    expect(socialHref("email", "not an address")).toBeNull();
    expect(socialHref("instagram", "instagram.com/acme")).toBe("https://instagram.com/acme");
  });
});

describe("the block tree", () => {
  it("finds blocks at the top and inside columns", () => {
    expect(findBlock(blocks, "b")?.slot).toEqual({ columnsId: null, cell: 0, index: 3 });
    expect(findBlock(blocks, "c2")?.slot).toEqual({ columnsId: "cols", cell: 1, index: 0 });
    expect(findBlock(blocks, "nope")).toBeNull();
    expect(countBlocks(blocks)).toBe(8);
  });

  it("changes, removes and copies a block wherever it is", () => {
    const changed = updateBlock(blocks, "c1", (block) => ({ ...block, align: "right" }));
    expect(findBlock(changed, "c1")?.block.align).toBe("right");
    expect(findBlock(blocks, "c1")?.block.align).toBe("left");
    expect(findBlock(removeBlock(blocks, "c2"), "c2")).toBeNull();
    expect(removeBlock(blocks, "cols")).toHaveLength(5);
    const copy = cloneBlock(columns, ids()) as ColumnsBlock;
    expect(copy.id).toBe("id1");
    expect(copy.cells[0][0]).toMatchObject({ id: "id2", text: "Left" });
  });

  it("moves a block between the top list and a column, counting the place before it is taken out", () => {
    const down = moveBlock(blocks, "h", { columnsId: null, cell: 0, index: 3 });
    expect(down.map((b) => b.id)).toEqual(["t", "i", "h", "b", "cols", "s"]);
    const into = moveBlock(blocks, "b", { columnsId: "cols", cell: 0, index: 1 });
    expect(findBlock(into, "b")?.slot).toEqual({ columnsId: "cols", cell: 0, index: 1 });
    expect(into.map((b) => b.id)).toEqual(["h", "t", "i", "cols", "s"]);
    const out = moveBlock(blocks, "c2", { columnsId: null, cell: 0, index: 0 });
    expect(out[0].id).toBe("c2");
    // Either side of itself is no move at all.
    expect(moveBlock(blocks, "t", { columnsId: null, cell: 0, index: 1 })).toBe(blocks);
    expect(moveBlock(blocks, "t", { columnsId: null, cell: 0, index: 2 })).toBe(blocks);
  });

  it("never puts columns inside a column", () => {
    const inside = { columnsId: "cols", cell: 0, index: 0 };
    expect(canPlace("columns", inside)).toBe(false);
    expect(canPlace("text", inside)).toBe(true);
    expect(insertBlock(blocks, inside, newBlock("columns", "x"))).toBe(blocks);
    expect(moveBlock(blocks, "cols", inside)).toBe(blocks);
  });

  it("names drop places and reads the names back", () => {
    const nested = { columnsId: "cols", cell: 1, index: 2 };
    expect(parseSlotId(slotId(nested))).toEqual(nested);
    expect(parseSlotId(slotId({ columnsId: null, cell: 0, index: 4 }))).toEqual({
      columnsId: null,
      cell: 0,
      index: 4,
    });
    expect(parseSlotId("block:abc")).toBeNull();
  });

  it("keeps a dropped column's blocks when the layout gets fewer columns", () => {
    const three = setColumnsLayout(columns, "1-1-1");
    expect(three.cells).toHaveLength(3);
    const filled = {
      ...three,
      cells: [three.cells[0], three.cells[1], [newBlock("divider", "d")]],
    };
    const two = setColumnsLayout(filled, "2-1");
    expect(two.cells).toHaveLength(2);
    expect(two.cells[1].map((b) => b.id)).toEqual(["c2", "d"]);
  });
});

describe("stored newsletters", () => {
  it("come back as they were", () => {
    expect(readNewsletter(JSON.parse(JSON.stringify(data)))).toEqual(data);
  });

  it("drop what they don't know, cap the blocks and make ids unique", () => {
    const odd = readNewsletter({
      theme: { accent: "blue", font: "comic" },
      subject: 7,
      header: { style: "sideways", logoHeight: 9999 },
      blocks: [
        { type: "video-game" },
        { type: "heading", id: "same", text: "Kept", level: 9, padTop: -5, background: "url(x)" },
        { type: "text", id: "same", text: "Also kept" },
        {
          type: "columns",
          layout: "9-9",
          cells: [
            [{ type: "columns" }, { type: "text", text: "Inner" }],
            "nope",
            [{ type: "text" }],
          ],
        },
        ...Array.from({ length: 80 }, () => ({ type: "divider" })),
      ],
    });
    expect(odd?.theme.accent).toBe(EMPTY_NEWSLETTER.theme.accent);
    expect(odd?.theme.font).toBe("arial");
    expect(odd?.subject).toBe("");
    expect(odd?.header).toMatchObject({ style: "left", logoHeight: 96 });
    expect(odd?.blocks[0]).toMatchObject({
      type: "heading",
      text: "Kept",
      level: 2,
      padTop: 0,
      background: "",
    });
    const all = odd!.blocks.flatMap((b) => (b.type === "columns" ? [b, ...b.cells.flat()] : [b]));
    expect(new Set(all.map((b) => b.id)).size).toBe(all.length);
    const cols = odd!.blocks[2] as ColumnsBlock;
    expect(cols.layout).toBe("1-1");
    expect(cols.cells).toHaveLength(2);
    expect(cols.cells[0]).toHaveLength(1);
    expect(countBlocks(odd!.blocks)).toBe(NEWSLETTER_MAX_BLOCKS);
    expect(readNewsletter(null)).toBeNull();
    expect(readNewsletter({ blocks: "no" })).toBeNull();
  });
});

describe("templates and looks", () => {
  it("every template draws, and says honestly whether it needs a plan", () => {
    expect(NEWSLETTER_TEMPLATES.length).toBeGreaterThanOrEqual(10);
    for (const template of NEWSLETTER_TEMPLATES) {
      const made = fromTemplate(template, ids(), "#1f3a5f");
      expect(made.theme.accent, template.id).toBe("#1f3a5f");
      expect(readNewsletter(JSON.parse(JSON.stringify(made))), template.id).toEqual(made);
      expect(newsletterInnerHtml(made, { placeholders: true }), template.id).toContain("<table");
      expect(templateIsPro(template), template.id).toBe(usesProBlocks(made.blocks));
    }
    expect(NEWSLETTER_TEMPLATES.filter((t) => !templateIsPro(t)).length).toBeGreaterThanOrEqual(5);
    expect(findTemplate("announcement")?.name).toBe("Announcement");
    expect(findTemplate("nope")).toBeNull();
  });

  it("marks columns and the ready-made blocks as coming with a plan", () => {
    const free = NEWSLETTER_BLOCK_TYPES.filter((t) => !t.pro).map((t) => t.id);
    expect(free).toEqual(["heading", "text", "image", "button", "divider", "spacer"]);
    for (const type of NEWSLETTER_BLOCK_TYPES) expect(newBlock(type.id, "x").type).toBe(type.id);
  });

  it("mixes colors", () => {
    expect(tint("#000000", 1)).toBe("#ffffff");
    expect(tint("#ff0000", 0.5)).toBe("#ff8080");
    expect(blend("#000000", "#ffffff", 0.5)).toBe("#808080");
  });

  it("writes the newsletter as plain text", () => {
    const text = newsletterText(data);
    expect(text).toContain("SPRING MENU <IS> HERE");
    expect(text).toContain("Book a table: https://acme.com/book");
    expect(text).toContain("LEFT\n\nRight");
    expect(text).toContain("New chef\nMeet Ada.\nhttps://acme.com/chef");
    expect(text).toContain("Unsubscribe: *|UNSUB|*");
    expect(text).not.toContain("a.jpg");
  });
});

describe("undo and redo", () => {
  it("steps back and forward, and a new change drops what was undone", () => {
    let h = startHistory("a");
    h = commit(h, "b", null, 0);
    h = commit(h, "c", null, 10);
    h = undo(h);
    expect(h.present).toBe("b");
    h = redo(h);
    expect(h.present).toBe("c");
    h = commit(undo(h), "d", null, 20);
    expect(redo(h).present).toBe("d");
    expect(undo(undo(undo(h))).present).toBe("a");
  });

  it("counts a run of typing in one field as one step", () => {
    let h = startHistory("");
    h = commit(h, "h", "title", 0);
    h = commit(h, "he", "title", 300);
    h = commit(h, "hey", "title", 600);
    expect(h.past).toEqual([""]);
    h = commit(h, "hey!", "title", 600 + HISTORY_JOIN_MS + 1);
    h = commit(h, "x", "other", 600 + HISTORY_JOIN_MS + 2);
    expect(h.past).toEqual(["", "hey", "hey!"]);
    expect(commit(h, "x", null, 9999)).toBe(h);
  });
});

describe("AI writing", () => {
  it("accepts the three kinds of request and explains a bad one", () => {
    expect(
      parseNewsletterRequest({ kind: "offer", brief: "  20% off annual plans until Sunday.  " }),
    ).toEqual({ mode: "draft", kind: "offer", brief: "20% off annual plans until Sunday." });
    expect(parseNewsletterRequest({ kind: "poem", brief: "x".repeat(40) })).toHaveProperty("error");
    expect(parseNewsletterRequest({ kind: "offer", brief: "too short" })).toHaveProperty("error");
    expect(
      parseNewsletterRequest({ kind: "offer", brief: "x".repeat(NEWSLETTER_BRIEF_MAX + 1) }),
    ).toHaveProperty("error");
    expect(
      parseNewsletterRequest({
        mode: "rewrite",
        action: "shorten",
        text: " Long text. ",
        heading: true,
      }),
    ).toEqual({ mode: "rewrite", action: "shorten", text: "Long text.", heading: true });
    expect(
      parseNewsletterRequest({ mode: "rewrite", action: "sing", text: "Hello" }),
    ).toHaveProperty("error");
    expect(parseNewsletterRequest({ mode: "rewrite", action: "shorten", text: "" })).toHaveProperty(
      "error",
    );
    expect(parseNewsletterRequest({ mode: "subjects", content: "x".repeat(40) })).toMatchObject({
      mode: "subjects",
    });
    expect(parseNewsletterRequest({ mode: "subjects", content: "short" })).toHaveProperty("error");
    expect(parseNewsletterRequest(null)).toHaveProperty("error");
  });

  it("puts the brand's voice and the customer's words to the model as material, not instructions", () => {
    const brand = { toneWords: ["warm", "direct"] };
    const system = newsletterSystemPrompt("Acme", brand);
    expect(system).toContain("newsletter for Acme");
    expect(system).toContain("<brand_voice>\nTone: warm, direct\n</brand_voice>");
    expect(system).toMatch(/Never invent prices/);
    expect(newsletterSystemPrompt("", null)).toContain("has not described its voice");
    expect(newsletterUserPrompt({ kind: "digest", brief: "Three things." })).toContain(
      "<brief>\nThree things.\n</brief>",
    );
    const rewrite = rewritePrompts("Acme", brand, {
      action: "shorten",
      text: "Long.",
      heading: true,
    });
    expect(rewrite.system).toContain("Tone: warm, direct");
    expect(rewrite.user).toContain("<text>\nLong.\n</text>");
    expect(rewrite.user).toMatch(/clearly shorter/);
    expect(rewrite.user).toMatch(/It is a heading/);
    const subjects = subjectPrompts("Acme", null, "All of it.");
    expect(subjects.user).toContain("<newsletter>\nAll of it.\n</newsletter>");
    expect(subjects.system).toMatch(/at most 60 characters/);
  });

  it("tidies the model's answers and turns a draft into blocks", () => {
    const draft = cleanDraft({
      subject: '  "Spring is here"  ',
      preheader: "New   menu",
      headline: "Hello spring",
      intro: "One.\n\n\n\nTwo.",
      sections: [
        { title: "Menu", text: "Three dishes." },
        { title: "", text: "" },
        ...Array.from({ length: 9 }, (_, i) => ({ title: `Extra ${i}`, text: "More." })),
      ],
      buttonLabel: "See the menu",
    });
    expect(draft).toMatchObject({
      subject: "Spring is here",
      preheader: "New menu",
      intro: "One.\n\nTwo.",
    });
    expect(draft?.sections).toHaveLength(5);
    const made = draftBlocks(draft!, ids());
    expect(made[0]).toMatchObject({ type: "heading", text: "Hello spring", level: 1 });
    expect(made[1]).toMatchObject({ type: "text", text: "One.\n\nTwo." });
    expect(made[2]).toMatchObject({ type: "heading", text: "Menu", level: 2 });
    expect(made.at(-1)).toMatchObject({ type: "button", label: "See the menu", url: "" });
    expect(new Set(made.map((b) => b.id)).size).toBe(made.length);
    expect(cleanDraft({ subject: "Only a subject", sections: [] })).toBeNull();
    expect(cleanRewrite(['  "Shorter."  ', "second"], false)).toBe("Shorter.");
    expect(cleanRewrite(["Two\nlines"], true)).toBe("Two lines");
    expect(cleanRewrite([], false)).toBeNull();
    expect(cleanSubjects(["A", "a", " B ", 3, "C", "D"])).toEqual(["A", "B", "C"]);
  });
});

describe("uploaded images", () => {
  it("takes small PNG, JPG and GIF files only, each company in its own folder", () => {
    expect(newsletterImageProblem({ type: "image/png", size: 1000 })).toBeNull();
    expect(newsletterImageProblem({ type: "image/webp", size: 1000 })).toMatch(/PNG, JPG or GIF/);
    expect(newsletterImageProblem({ type: "image/jpeg", size: 0 })).toMatch(/empty/);
    expect(
      newsletterImageProblem({ type: "image/jpeg", size: NEWSLETTER_IMAGE_MAX_BYTES + 1 }),
    ).toMatch(/2 MB/);
    expect(newsletterImageKey("co-1", "abc", "image/jpeg")).toBe("newsletter-images/co-1/abc.jpg");
  });
});

describe("the templates' own pictures", () => {
  it("are files on this site, each used by a template with a description", () => {
    for (const name of TEMPLATE_PICTURES) {
      expect(
        existsSync(join(process.cwd(), "public", "newsletter", "templates", `${name}.jpg`)),
        name,
      ).toBe(true);
    }
    const used = new Set<string>();
    for (const template of NEWSLETTER_TEMPLATES) {
      for (const block of allBlocks(fromTemplate(template, ids()).blocks)) {
        const url =
          block.type === "image"
            ? block.url
            : block.type === "story" || block.type === "product"
              ? block.imageUrl
              : block.type === "video"
                ? block.thumbnailUrl
                : "";
        if (!url) continue;
        expect(imageUrlProblem(url), url).toBeNull();
        used.add(url.split("/").pop()!.replace(".jpg", ""));
        if (block.type === "image") expect(block.alt, url).not.toBe("");
      }
    }
    expect([...used].sort()).toEqual([...TEMPLATE_PICTURES].sort());
  });

  it("load from this site's own files in the builder, and from the live site in the email", () => {
    const url = `${TEMPLATE_PICTURE_ORIGIN}/newsletter/templates/offer.jpg`;
    expect(builderImageSrc(url)).toBe("/newsletter/templates/offer.jpg");
    expect(builderImageSrc("https://acme.com/a.jpg")).toBe(
      "/api/tools/signature-logo?url=https%3A%2F%2Facme.com%2Fa.jpg",
    );
    const offer = fromTemplate(findTemplate("offer")!, ids());
    expect(newsletterHtml(offer)).toContain(`src="${url}"`);
    expect(newsletterHtml(offer, { imageSrc: builderImageSrc })).toContain(
      'src="/newsletter/templates/offer.jpg"',
    );
  });
});
