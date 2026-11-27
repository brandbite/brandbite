// -----------------------------------------------------------------------------
// @file: lib/newsletter/__tests__/block-looks.test.ts
// @purpose: The settings that change how one block looks: a button's colors,
//           size, corners and outline (on its own and inside a product or a
//           video block), a heading's size, a picture's corners, a divider's
//           line, the social icons' size and a ready-made block's colors.
//           Also that newsletters stored before these existed read back
//           looking as they did.
// -----------------------------------------------------------------------------

import { describe, expect, it } from "vitest";

import {
  buttonLook,
  EMPTY_NEWSLETTER,
  newBlock,
  readNewsletter,
  type NewsletterBlock,
  type NewsletterData,
} from "@/lib/newsletter/newsletter";
import { inlineEditStyle, newsletterHtml } from "@/lib/newsletter/render";

const withBlocks = (...blocks: NewsletterBlock[]): NewsletterData => ({
  ...EMPTY_NEWSLETTER,
  theme: { ...EMPTY_NEWSLETTER.theme, accent: "#fe5000", buttonShape: "rounded" },
  blocks,
});
const html = (...blocks: NewsletterBlock[]) => newsletterHtml(withBlocks(...blocks));

describe("a button's look", () => {
  const button = { ...newBlock("button", "b1"), label: "Shop", url: "https://example.com" };

  it("follows the email's style until it is set by hand", () => {
    const out = html(button);
    expect(out).toContain('bgcolor="#fe5000"');
    expect(out).toContain("border-radius:8px;mso-padding-alt:14px 28px;");
    expect(out).toContain("font-size:16px;line-height:20px;color:#ffffff;");
  });

  it("takes its own text color, size and corners", () => {
    const out = html({ ...button, textColor: "#112233", size: "large", corner: 20 });
    expect(out).toContain("border-radius:20px;mso-padding-alt:18px 36px;");
    expect(out).toContain("font-size:18px;line-height:24px;color:#112233;");
  });

  it("is drawn as a line around the words when it is an outline button", () => {
    const out = html({ ...button, color: "#0a7d38", outline: true });
    expect(out).toContain("border:2px solid #0a7d38;");
    expect(out).not.toContain('bgcolor="#0a7d38"');
    // The words take the button's color, and the padding gives back the room the line takes.
    expect(out).toContain("color:#0a7d38;");
    expect(out).toContain("mso-padding-alt:12px 26px;");
  });

  it("looks the same while its words are typed on the canvas", () => {
    const data = withBlocks({ ...button, textColor: "#112233", size: "small", corner: 0 });
    const style = inlineEditStyle(data, data.blocks[0] as typeof button, null);
    expect(style.text).toMatchObject({ fontSize: 14, lineHeight: "18px", color: "#112233" });
    expect(style.button).toMatchObject({
      background: "#fe5000",
      border: null,
      borderRadius: 0,
      padding: "10px 20px",
    });
  });

  it("can be set on the button inside a product and a video block", () => {
    const product = {
      ...newBlock("product", "p1"),
      name: "Mug",
      url: "https://example.com",
      buttonColor: "#222222",
      buttonTextColor: "#ffee00",
      buttonCorner: 0,
    };
    expect(buttonLook(product)).toMatchObject({ fill: "#222222", textColor: "#ffee00" });
    const out = html(product);
    expect(out).toContain('bgcolor="#222222"');
    expect(out).toContain("border-radius:0px;mso-padding-alt:14px 28px;");
    expect(out).toContain("color:#ffee00;");

    const video = {
      ...newBlock("video", "v1"),
      url: "https://example.com/watch",
      thumbnailUrl: "https://example.com/t.jpg",
      buttonOutline: true,
    };
    expect(html(video)).toContain("border:2px solid #fe5000;");
  });
});

describe("other blocks' looks", () => {
  it("sets a heading's size by hand, with a line height to match", () => {
    const heading = { ...newBlock("heading", "h1"), text: "Hello", level: 1 as const };
    expect(html(heading)).toContain("font-size:30px;line-height:38px;");
    expect(html({ ...heading, fontSize: 44 })).toContain("font-size:44px;line-height:55px;");
    // A first heading set small by hand is not made bigger on a phone.
    expect(html({ ...heading, fontSize: 18 })).not.toContain('<h1 class="nl-h1"');
  });

  it("rounds a picture's corners by the number set", () => {
    const image = { ...newBlock("image", "i1"), url: "https://example.com/a.jpg", alt: "A" };
    expect(html(image)).not.toMatch(/<img[^>]*a\.jpg[^>]*border-radius/);
    expect(html({ ...image, corner: 24 })).toMatch(/<img[^>]*a\.jpg[^>]*border-radius:24px;/);
    // The old on/off choice still means what it did.
    expect(html({ ...image, rounded: true })).toMatch(/<img[^>]*a\.jpg[^>]*border-radius:10px;/);
  });

  it("draws a divider with its thickness and kind of line", () => {
    const divider = { ...newBlock("divider", "d1"), color: "#333333" };
    expect(html(divider)).toContain("border-top:1px solid #333333;");
    expect(html({ ...divider, thickness: 4, line: "dashed" as const })).toContain(
      "border-top:4px dashed #333333;",
    );
  });

  it("sizes the social icons", () => {
    const social = {
      ...newBlock("social", "s1"),
      links: [{ platform: "instagram" as const, url: "https://instagram.com/acme" }],
      size: 40 as const,
    };
    expect(html(social)).toContain('width="40" height="40"');
  });

  it("gives a ready-made block its own accent and text colors", () => {
    const product = {
      ...newBlock("product", "p1"),
      name: "Mug",
      price: "$24",
      url: "https://example.com",
      accentColor: "#0055aa",
      textColor: "#101010",
    };
    const out = html(product);
    // The price, and the button while it has no color of its own.
    expect(out).toContain("color:#0055aa;font-weight:bold;");
    expect(out).toContain('bgcolor="#0055aa"');
    expect(out).toContain("color:#101010;font-weight:bold;");

    const quote = { ...newBlock("quote", "q1"), text: "Great.", accentColor: "#0055aa" };
    expect(html(quote)).toContain("border-left:3px solid #0055aa;");
  });

  it("can leave the frame around a product out", () => {
    const product = { ...newBlock("product", "p1"), name: "Mug", url: "https://example.com" };
    expect(html(product)).toContain("border-radius:12px;border-collapse:separate;");
    expect(html({ ...product, frame: false })).not.toContain(
      "border-radius:12px;border-collapse:separate;",
    );
  });
});

describe("newsletters stored before these settings existed", () => {
  it("read back with every new setting following the email's style", () => {
    const old = {
      ...EMPTY_NEWSLETTER,
      blocks: [
        { type: "button", id: "b1", label: "Go", url: "https://example.com", color: "#123456" },
        { type: "heading", id: "h1", text: "Hi", level: 1 },
        { type: "image", id: "i1", url: "https://example.com/a.jpg", rounded: true },
        { type: "divider", id: "d1" },
        { type: "social", id: "s1", links: [] },
        { type: "product", id: "p1", name: "Mug" },
        { type: "video", id: "v1" },
        { type: "quote", id: "q1", text: "Great." },
      ],
    };
    const read = readNewsletter(old);
    const byId = Object.fromEntries((read?.blocks ?? []).map((block) => [block.id, block]));
    expect(byId.b1).toMatchObject({
      color: "#123456",
      textColor: "",
      size: "medium",
      corner: -1,
      outline: false,
    });
    expect(byId.h1).toMatchObject({ fontSize: 0 });
    expect(byId.i1).toMatchObject({ rounded: true, corner: -1 });
    expect(byId.d1).toMatchObject({ thickness: 1, line: "solid" });
    expect(byId.s1).toMatchObject({ size: 32 });
    expect(byId.p1).toMatchObject({
      frame: true,
      buttonColor: "",
      buttonSize: "medium",
      buttonCorner: -1,
      accentColor: "",
      textColor: "",
    });
    expect(byId.v1).toMatchObject({ buttonOutline: false, buttonCorner: -1 });
    expect(byId.q1).toMatchObject({ accentColor: "", textColor: "" });
  });

  it("drops values that are not a color or are out of range", () => {
    const read = readNewsletter({
      ...EMPTY_NEWSLETTER,
      blocks: [
        {
          type: "button",
          id: "b1",
          textColor: "red; background:url(x)",
          size: "huge",
          corner: 900,
        },
        { type: "heading", id: "h1", fontSize: 400 },
        { type: "divider", id: "d1", thickness: 99, line: "wavy" },
      ],
    });
    const [button, heading, divider] = read?.blocks ?? [];
    expect(button).toMatchObject({ textColor: "", size: "medium", corner: 40 });
    expect(heading).toMatchObject({ fontSize: 56 });
    expect(divider).toMatchObject({ thickness: 8, line: "solid" });
  });
});
