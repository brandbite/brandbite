import { describe, expect, it } from "vitest";

import {
  EMPTY_NEWSLETTER,
  newBlock,
  readNewsletter,
  type LeafBlock,
} from "@/lib/newsletter/newsletter";
import { blockFragmentHtml, newsletterHtml, newsletterText } from "@/lib/newsletter/render";
import {
  hasFormatting,
  plainToRich,
  readRich,
  RICH_MAX_CHARS,
  richFromEditor,
  richLink,
  richToEditor,
  richToPlain,
  type RichNode,
} from "@/lib/newsletter/rich";

const rich: RichNode[] = [
  {
    type: "p",
    runs: [
      { text: "Plain, " },
      { text: "bold", bold: true },
      { text: " and a " },
      { text: "link <here>", link: "https://acme.com/menu?a=1&b=2", italic: true },
      { text: ".\nSecond line", underline: true },
    ],
  },
  { type: "ul", items: [[{ text: "First" }], [{ text: "Second", bold: true }]] },
  { type: "ol", items: [[{ text: "One" }]] },
];

const withText = (nodes: RichNode[] | null) => ({
  ...EMPTY_NEWSLETTER,
  subject: "Hi",
  blocks: [
    { ...newBlock("text", "t"), rich: nodes, text: nodes ? richToPlain(nodes) : "Plain words." },
  ],
});

describe("formatted text", () => {
  it("reads back as it was stored", () => {
    expect(readRich(JSON.parse(JSON.stringify(rich)))).toEqual(rich);
  });

  it("drops what it doesn't know and anything that could carry code", () => {
    const cleaned = readRich([
      { type: "script", runs: [{ text: "alert(1)" }] },
      {
        type: "p",
        runs: [
          { text: "ok", bold: "yes", color: "red", onclick: "x" },
          { text: "bad link", link: "javascript:alert(1)" },
          { text: "mail", link: "mailto:hi@acme.com" },
          { text: 7 },
          "nope",
        ],
      },
      { type: "ul", items: [[], "x", [{ text: "kept" }]] },
      { type: "p", runs: [] },
    ]);
    // The two unformatted runs end up as one; the unsafe link is gone, the words stay.
    expect(cleaned).toEqual([
      {
        type: "p",
        runs: [{ text: "okbad link" }, { text: "mail", link: "mailto:hi@acme.com" }],
      },
      { type: "ul", items: [[{ text: "kept" }]] },
    ]);
    expect(readRich("text")).toBeNull();
    expect(readRich([{ type: "p", runs: [] }])).toBeNull();
    const long = readRich([{ type: "p", runs: [{ text: "x".repeat(RICH_MAX_CHARS + 500) }] }]);
    expect(richToPlain(long!)).toHaveLength(RICH_MAX_CHARS);
  });

  it("takes web and mail addresses as links, and nothing else", () => {
    expect(richLink("acme.com/a")).toBe("https://acme.com/a");
    expect(richLink("http://acme.com")).toBe("http://acme.com/");
    expect(richLink("mailto:hi@acme.com")).toBe("mailto:hi@acme.com");
    expect(richLink("mailto:not an address")).toBeNull();
    expect(richLink("javascript:alert(1)")).toBeNull();
    expect(richLink("data:text/html,x")).toBeNull();
    expect(richLink("")).toBeNull();
    expect(richLink(5)).toBeNull();
  });

  it("has a plain form, and plain text becomes paragraphs", () => {
    expect(richToPlain(rich)).toBe(
      "Plain, bold and a link <here>.\nSecond line\n\n- First\n- Second\n\n1. One",
    );
    expect(plainToRich("One.\n\n\nTwo\nlines. ")).toEqual([
      { type: "p", runs: [{ text: "One." }] },
      { type: "p", runs: [{ text: "Two\nlines." }] },
    ]);
    expect(hasFormatting(plainToRich("One."))).toBe(false);
    expect(hasFormatting(rich)).toBe(true);
    expect(hasFormatting(null)).toBe(false);
  });

  it("goes to the editor's document and back unchanged", () => {
    expect(richFromEditor(richToEditor(rich))).toEqual(rich);
    expect(richToEditor([])).toEqual({ type: "doc", content: [{ type: "paragraph" }] });
    expect(richFromEditor({ type: "doc", content: [{ type: "paragraph" }] })).toBeNull();
    // What the editor can hold beyond this (headings, code, other marks) never gets through.
    expect(
      richFromEditor({
        type: "doc",
        content: [
          { type: "heading", content: [{ type: "text", text: "No" }] },
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Yes", marks: [{ type: "code" }, { type: "bold" }] },
              { type: "hardBreak" },
              {
                type: "text",
                text: "next",
                marks: [{ type: "link", attrs: { href: "vbscript:x" } }],
              },
            ],
          },
        ],
      }),
    ).toEqual([{ type: "p", runs: [{ text: "Yes\n", bold: true }, { text: "next" }] }]);
  });
});

describe("formatted text in the email", () => {
  it("is drawn with its formatting, every word escaped", () => {
    const html = newsletterHtml(withText(rich));
    expect(html).toContain("Plain, <strong>bold</strong> and a ");
    expect(html).toContain(
      '<a href="https://acme.com/menu?a=1&amp;b=2" style="color:#fe5000;text-decoration:underline;"><em>link &lt;here&gt;</em></a>',
    );
    expect(html).toContain("<u>.<br>Second line</u>");
    expect(html).toMatch(
      /<ul style="[^"]*list-style-type:disc;[^"]*"><li style="[^"]*">First<\/li>/,
    );
    expect(html).toMatch(/<ol style="[^"]*list-style-type:decimal;/);
    expect(html).toContain("<strong>Second</strong>");
    expect(newsletterText(withText(rich))).toContain("- First\n- Second");
  });

  it("is kept with a stored newsletter, its plain form worked out from it", () => {
    const stored = JSON.parse(JSON.stringify(withText(rich)));
    stored.blocks[0].text = "something else entirely";
    const back = readNewsletter(stored)!;
    const block = back.blocks[0];
    expect(block.type === "text" && block.rich).toEqual(rich);
    expect(block.type === "text" && block.text).toBe(richToPlain(rich));
  });

  it("leaves plain text blocks as they were", () => {
    const html = newsletterHtml(withText(null));
    expect(html).toContain(">Plain words.</p>");
    const back = readNewsletter(JSON.parse(JSON.stringify(withText(null))))!;
    expect(back.blocks[0]).toMatchObject({ type: "text", text: "Plain words.", rich: null });
  });
});

describe("formatted text inside story, product and event blocks", () => {
  const bold: RichNode[] = [
    { type: "p", runs: [{ text: "Now " }, { text: "bold", bold: true }] },
    { type: "ul", items: [[{ text: "A point" }]] },
  ];
  const data = {
    ...EMPTY_NEWSLETTER,
    subject: "Hi",
    blocks: [
      { ...newBlock("story", "s"), title: "Story", rich: bold, text: richToPlain(bold) },
      { ...newBlock("product", "p"), name: "Candle", rich: bold, text: richToPlain(bold) },
      { ...newBlock("event", "e"), title: "Workshop", rich: bold, text: richToPlain(bold) },
      { ...newBlock("story", "s2"), title: "Plain story", text: "Just words." },
    ],
  };

  it("is drawn with its formatting in the email", () => {
    const html = newsletterHtml(data);
    expect(html.match(/Now <strong>bold<\/strong>/g)).toHaveLength(3);
    expect(html.match(/<li style="[^"]*">A point<\/li>/g)).toHaveLength(3);
    expect(html).toContain(">Just words.</p>");
  });

  it("comes back from storage, and new blocks start plain", () => {
    const back = readNewsletter(JSON.parse(JSON.stringify(data)))!;
    expect(back).toEqual({ ...data, version: 2 });
    for (const type of ["story", "product", "event"] as const) {
      expect(newBlock(type, "x").rich).toBeNull();
    }
  });

  it("leaves room for the text editor when the block is picked on the canvas", () => {
    for (const block of data.blocks.slice(0, 3)) {
      const html = blockFragmentHtml(data, block as LeafBlock, null, { editable: true });
      expect(html, block.type).toContain('<div data-rich-slot="text"');
      expect(html, block.type).not.toContain("Now <strong>");
    }
  });
});

describe("a formatted quote", () => {
  const quote = (rich: RichNode[]) => ({
    ...EMPTY_NEWSLETTER,
    subject: "Hi",
    blocks: [{ ...newBlock("quote", "q"), rich, text: richToPlain(rich), name: "Ada" }],
  });

  it("opens its first paragraph and closes its last with quotation marks", () => {
    const html = newsletterHtml(
      quote([
        { type: "p", runs: [{ text: "First, " }, { text: "bold", bold: true }] },
        { type: "p", runs: [{ text: "Last." }] },
      ]),
    );
    expect(html).toMatch(
      /<p style="[^"]*font-style:italic;[^"]*">&ldquo;First, <strong>bold<\/strong><\/p>/,
    );
    expect(html).toContain("Last.&rdquo;</p>");
    expect(html.match(/&ldquo;/g)).toHaveLength(1);
    expect(html.match(/&rdquo;/g)).toHaveLength(1);
  });

  it("leaves the mark out where a list stands at the end", () => {
    const html = newsletterHtml(
      quote([
        { type: "p", runs: [{ text: "Three things:" }] },
        { type: "ul", items: [[{ text: "One" }]] },
      ]),
    );
    expect(html).toContain("&ldquo;Three things:");
    expect(html).not.toContain("&rdquo;");
  });

  it("stays as it was while plain, comes back from storage and is typed in the editor when picked", () => {
    const plain = {
      ...EMPTY_NEWSLETTER,
      subject: "Hi",
      blocks: [{ ...newBlock("quote", "q"), text: "Lovely." }],
    };
    expect(newsletterHtml(plain)).toContain("&ldquo;Lovely.&rdquo;</p>");
    const data = quote([{ type: "p", runs: [{ text: "Kept", italic: true }] }]);
    expect(readNewsletter(JSON.parse(JSON.stringify(data)))).toEqual(data);
    const picked = blockFragmentHtml(data, data.blocks[0] as LeafBlock, null, { editable: true });
    expect(picked).toContain('<div data-rich-slot="text" data-quoted="1"');
    expect(picked).toContain('data-edit="name"');
    expect(picked).not.toContain('data-edit="text"');
  });
});
