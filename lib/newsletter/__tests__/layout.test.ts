import { describe, expect, it } from "vitest";

import { cutSize, NEWSLETTER_IMAGE_SHAPES, newsletterImageFolder } from "@/lib/newsletter/images";

import {
  EMPTY_NEWSLETTER,
  newBlock,
  newsletterProblems,
  pictureSlots,
  readNewsletter,
  setColumnsLayout,
  withPictureRatios,
  type LeafBlock,
  type NewsletterBlock,
  type NewsletterData,
} from "@/lib/newsletter/newsletter";
import {
  fillPersonal,
  PERSONAL_FIELDS,
  personalToken,
  serviceTag,
  usesPersonal,
} from "@/lib/newsletter/personal";
import {
  columnWidths,
  contentWidth,
  editBoxStyle,
  newsletterHtml,
  newsletterInnerHtml,
  newsletterText,
} from "@/lib/newsletter/render";

const doc = (blocks: NewsletterBlock[], more: Partial<NewsletterData> = {}): NewsletterData => ({
  ...EMPTY_NEWSLETTER,
  subject: "Hi",
  blocks,
  ...more,
});
const text = (words: string, more: Partial<NewsletterBlock> = {}) =>
  ({ ...newBlock("text", "t"), text: words, ...more }) as NewsletterBlock;

describe("personal fields", () => {
  const data = doc([text("Hi {{first_name}}, we wrote to {{ email }}.")]);
  const service = (id: NewsletterData["footer"]["service"]) => ({
    ...data,
    footer: { ...data.footer, service: id },
  });

  it("become the chosen service's tags in what is sent", () => {
    expect(newsletterHtml(service("mailchimp"))).toContain("Hi *|FNAME|*, we wrote to *|EMAIL|*.");
    expect(newsletterHtml(service("klaviyo"))).toContain(
      "Hi {{ first_name }}, we wrote to {{ email }}.",
    );
    expect(newsletterHtml(service("brevo"))).toContain(
      "Hi {{ contact.FIRSTNAME }}, we wrote to {{ contact.EMAIL }}.",
    );
    expect(newsletterHtml(service("other"))).toContain("Hi {{first_name}}, we wrote to {{email}}.");
    expect(newsletterText(service("mailchimp"))).toContain("Hi *|FNAME|*");
  });

  it("show an example in the preview and in a test email", () => {
    expect(newsletterHtml(data, { preview: true })).toContain(
      "Hi Alex, we wrote to alex@example.com.",
    );
    expect(newsletterHtml(data, { test: true })).toContain("Hi Alex,");
  });

  it("stay as written on the canvas, where they are edited", () => {
    expect(newsletterInnerHtml(data, { placeholders: true })).toContain("Hi {{first_name}}");
  });

  it("are only the fields we know", () => {
    expect(PERSONAL_FIELDS.map((field) => personalToken(field.id))).toEqual([
      "{{first_name}}",
      "{{last_name}}",
      "{{email}}",
    ]);
    expect(usesPersonal("Dear {{ last_name }}")).toBe(true);
    expect(usesPersonal("Dear {{password}}")).toBe(false);
    expect(fillPersonal("{{password}} {{first_name}}", "mailchimp", "send")).toBe(
      "{{password}} *|FNAME|*",
    );
    expect(serviceTag("last_name", "brevo")).toBe("{{ contact.LASTNAME }}");
  });
});

describe("blocks shown on one kind of screen", () => {
  const data = doc([
    text("Everywhere"),
    text("Big screens", { id: "d", show: "desktop" }),
    text("Phones", { id: "p", show: "phone" }),
    {
      ...newBlock("columns", "c"),
      cells: [[{ ...newBlock("text", "n"), text: "Nested phone", show: "phone" }], []],
    },
  ]);

  it("are hidden with a class on the other kind, and phone-only ones start hidden", () => {
    const html = newsletterHtml(data);
    expect(html).toMatch(/<tr class="nl-hide-m"><td[^>]*>.*Big screens/);
    expect(html).toMatch(
      /<tr class="nl-show-m-row" style="display:none;mso-hide:all;"><td[^>]*>.*Phones/,
    );
    expect(html).toMatch(
      /<table[^>]*class="nl-show-m-table" style="display:none;mso-hide:all;"><tr><td[^>]*>.*Nested phone/,
    );
    // Outlook on Windows never gets a phones-only block at all.
    expect(html).toContain('<!--[if !mso]><!--><tr class="nl-show-m-row"');
    expect(html.match(/<!--\[if !mso\]><!-->/g)).toHaveLength(2);
    expect(html.match(/<!--<!\[endif\]-->/g)).toHaveLength(2);
    expect(html).toContain(".nl-hide-m{display:none!important;}");
    expect(html).toContain(".nl-show-m-row{display:table-row!important;}");
    expect(html.match(/<tr><td class="nl-pad" align="left" style="padding:14px/g)).toHaveLength(1);
  });

  it("are all shown on the canvas", () => {
    const canvas = newsletterInnerHtml(data, { placeholders: true });
    expect(canvas).not.toContain("nl-hide-m");
    expect(canvas).not.toContain("display:none");
  });

  it("come back from storage, and anything else means everywhere", () => {
    const back = readNewsletter(JSON.parse(JSON.stringify(data)))!;
    expect(back.blocks.map((block) => block.show)).toEqual(["all", "desktop", "phone", "all"]);
    expect(readNewsletter({ blocks: [{ type: "text", show: "tv" }] })!.blocks[0].show).toBe("all");
  });
});

describe("columns", () => {
  it("come four in a row, and keep a dropped column's blocks", () => {
    expect(columnWidths("1-1-1-1", 520)).toEqual([115, 115, 115, 115]);
    const four = setColumnsLayout(newBlock("columns", "c"), "1-1-1-1");
    expect(four.cells).toHaveLength(4);
    const back = readNewsletter({ blocks: [four] })!.blocks[0];
    expect(back.type === "columns" && back.cells).toHaveLength(4);
  });

  it("can stay side by side on a phone, as a plain table", () => {
    const columns = {
      ...newBlock("columns", "c"),
      stack: false,
      cells: [
        [{ ...newBlock("text", "a"), text: "Left" }],
        [{ ...newBlock("text", "b"), text: "Right" }],
      ],
    };
    const html = newsletterHtml(doc([columns]));
    // The room between them is shared, so both columns' contents are equally wide.
    expect(html).toMatch(/<td width="50%" valign="top" style="padding:0 6px 0 0px;">.*Left/);
    expect(html).toMatch(/<td width="50%" valign="top" style="padding:0 0px 0 6px;">.*Right/);
    expect(html).not.toContain('class="nl-col"');
    expect(newsletterHtml(doc([{ ...columns, stack: true }]))).toContain('class="nl-col"');
  });
});

describe("a block drawn as a box", () => {
  const boxed = text("Inside", {
    boxed: true,
    borderWidth: 2,
    borderColor: "#112233",
    radius: 12,
    background: "#FFEEDD",
    align: "center",
  });

  it("keeps its background, border and corners inside the margins, with room around the words", () => {
    const html = newsletterHtml(doc([boxed]));
    expect(html).toContain(
      '<td class="nl-pad" style="padding:14px 40px 0px 40px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:separate;"><tr><td align="center" bgcolor="#ffeedd" style="padding:20px;background-color:#ffeedd;border:2px solid #112233;border-radius:12px;">',
    );
    expect(contentWidth(boxed, 520)).toBe(520 - 2 * 22);
    expect(contentWidth(text("x"), 520)).toBe(520);
  });

  it("narrows what is inside it, columns too", () => {
    const columns = {
      ...newBlock("columns", "c"),
      boxed: true,
      cells: [[{ ...newBlock("text", "a"), text: "L" }], [{ ...newBlock("text", "b"), text: "R" }]],
    };
    // 520 - 2 x 20 of padding = 480, less the 20 between the columns, halved.
    expect(newsletterHtml(doc([columns]))).toContain("max-width:250px;vertical-align:top;");
    expect(editBoxStyle(doc([columns]), columns, null).width).toBe(480);
  });

  it("looks the same on the canvas", () => {
    const style = editBoxStyle(doc([boxed]), boxed, null);
    expect(style.outer).toMatchObject({
      padding: "14px 40px 0px 40px",
      backgroundColor: "#ffffff",
    });
    expect(style.inner).toMatchObject({
      backgroundColor: "#ffeedd",
      border: "2px solid #112233",
      borderRadius: 12,
      padding: 20,
    });
    expect(editBoxStyle(doc([text("x")]), text("x"), 250)).toMatchObject({
      inner: null,
      outer: { padding: "14px 0px 0px 0px", backgroundColor: "transparent" },
    });
  });
});

describe("a picture behind a block", () => {
  const url = 'https://acme.com/bg.jpg?a=1&b="2"';
  const block = text("Over a picture", { backgroundImage: url, background: "#000000" });

  it("is set with the color under it for apps that draw no background picture", () => {
    const html = newsletterHtml(doc([block]));
    expect(html).toContain(
      'bgcolor="#000000" background="https://acme.com/bg.jpg?a=1&amp;b=%222%22"',
    );
    expect(html).toContain(
      "background-color:#000000;background-image:url(&quot;https://acme.com/bg.jpg?a=1&amp;b=%222%22&quot;);background-size:cover;background-position:center;",
    );
  });

  it("is left out when its address can't be used, and the editor says so", () => {
    const bad = text("Words", { backgroundImage: "http://acme.com/bg.jpg" });
    expect(newsletterHtml(doc([bad]))).not.toContain("background-image");
    expect(newsletterProblems(doc([bad])).map((problem) => problem.text)).toContain(
      "A background picture's address can't be used.",
    );
    const script = text("Words", { backgroundImage: "javascript:alert(1)" });
    expect(newsletterHtml(doc([script]))).not.toContain("javascript");
  });

  it("loads through the builder's own address on the canvas", () => {
    const style = editBoxStyle(
      doc([block]),
      block,
      null,
      (address) => `/proxy?u=${address.length}`,
    );
    expect(String(style.outer.backgroundImage)).toMatch(/^url\("\/proxy\?u=\d+"\)$/);
  });
});

describe("a picture cut before upload", () => {
  it("is saved no wider than an email needs, and never larger than what was cut", () => {
    expect(cutSize({ width: 3000, height: 1500 })).toEqual({ width: 1200, height: 600 });
    expect(cutSize({ width: 800, height: 800 })).toEqual({ width: 800, height: 800 });
    expect(cutSize({ width: 0, height: 0 })).toEqual({ width: 1, height: 1 });
    expect(NEWSLETTER_IMAGE_SHAPES.map((shape) => shape.id)).toContain("square");
    expect(newsletterImageFolder("co-1")).toBe("newsletter-images/co-1/");
  });
});

describe("a picture's height", () => {
  const image = (more: Partial<NewsletterBlock> = {}) =>
    ({
      ...newBlock("image", "i"),
      url: "https://acme.com/a.jpg",
      alt: "A",
      ...more,
    }) as NewsletterBlock;

  it("is written into the email once the builder has measured the picture, so Outlook keeps its shape", () => {
    expect(newsletterHtml(doc([image({ ratio: 2 })]))).toContain(
      'width="520" height="260" class="nl-fill" style="',
    );
    expect(newsletterHtml(doc([image({ ratio: 2, width: 50 })]))).toContain(
      // Set narrower than its room: it keeps that share on a phone too.
      'width="260" height="130" style="',
    );
    // Not measured yet: no height, as before.
    expect(newsletterHtml(doc([image()]))).toContain(
      'width="520" class="nl-fill" style="display:block;width:100%;',
    );
    // On a phone a picture fills a column that has become as wide as the screen.
    expect(newsletterHtml(doc([image()]))).toContain(".nl-fill{max-width:100%!important;}");
    // The style still lets it shrink on a narrow screen.
    expect(newsletterHtml(doc([image({ ratio: 2 })]))).toContain("max-width:520px;height:auto;");
  });

  it("is kept for stories, products, video thumbnails and the logo", () => {
    const html = newsletterHtml(
      doc(
        [
          {
            ...newBlock("story", "s"),
            title: "S",
            imageUrl: "https://acme.com/s.jpg",
            imageRatio: 1.5,
          },
          {
            ...newBlock("product", "p"),
            name: "P",
            imageUrl: "https://acme.com/p.jpg",
            imageRatio: 1.333,
          },
          {
            ...newBlock("video", "v"),
            url: "https://acme.com/v",
            thumbnailUrl: "https://acme.com/v.jpg",
            thumbnailRatio: 1.778,
          },
        ],
        {
          header: {
            ...EMPTY_NEWSLETTER.header,
            logoUrl: "https://acme.com/logo.png",
            logoRatio: 3,
          },
        },
      ),
    );
    expect(html).toContain('width="180" height="120" class="nl-story-img"');
    expect(html).toContain('width="486" height="365" class="nl-fill"');
    expect(html).toContain('width="520" height="292" class="nl-fill"');
    expect(html).toContain('height="40" width="120"');
  });

  it("is found for every picture, written back, and survives storage", () => {
    const data = doc([
      image(),
      { ...newBlock("story", "s"), title: "S", imageUrl: "https://acme.com/s.jpg" },
      { ...newBlock("video", "v"), url: "https://youtu.be/dQw4w9WgXcQ" },
      { ...newBlock("columns", "c"), cells: [[image({ id: "n" }) as LeafBlock], []] },
    ]);
    expect(pictureSlots(data).map((slot) => [slot.key, slot.url, slot.ratio])).toEqual([
      ["header", null, 0],
      ["i", "https://acme.com/a.jpg", 0],
      ["s", "https://acme.com/s.jpg", 0],
      ["v", "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg", 0],
      ["n", "https://acme.com/a.jpg", 0],
    ]);
    const measured = withPictureRatios(
      data,
      new Map([
        ["i", 2],
        ["s", 1.5],
        ["v", 1.333],
        ["n", 0.75],
        ["header", 3],
      ]),
    );
    expect(pictureSlots(measured).map((slot) => slot.ratio)).toEqual([3, 2, 1.5, 1.333, 0.75]);
    expect(withPictureRatios(data, new Map())).toBe(data);
    expect(
      pictureSlots(readNewsletter(JSON.parse(JSON.stringify(measured)))!).map((slot) => slot.ratio),
    ).toEqual([3, 2, 1.5, 1.333, 0.75]);
    expect(readNewsletter({ blocks: [{ type: "image", ratio: -4 }] })!.blocks[0]).toMatchObject({
      ratio: 0,
    });
  });
});
