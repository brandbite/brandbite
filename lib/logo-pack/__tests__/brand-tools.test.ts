import { describe, expect, it } from "vitest";

import {
  displayUrl,
  EMPTY_SIGNATURE,
  escapeHtml,
  hasContent,
  logoUrlProblem,
  safeColor,
  safeUrl,
  signatureHtml,
  signatureText,
  previewLogoSrc,
  SIGNATURE_TEMPLATES,
  withSampleDetails,
  type SignatureData,
} from "@/lib/email-signature/signature";
import { deviceForShape, fitWithin } from "@/lib/mockups/present";
import { wrapLines } from "@/lib/post-preview/draw";
import {
  cleanCount,
  formatCount,
  handleFrom,
  randomEngagement,
} from "@/lib/post-preview/engagement";
import { coveredEdges, fitNote, placements } from "@/lib/post-preview/placements";
import {
  canvasForHandoff,
  dataUrlToBlob,
  HANDOFF_MAX_CHARS,
  leaveForMockupStudio,
  returnLabel,
  takeMockupHandoff,
} from "@/lib/mockups/handoff";
import { getSizePlatform } from "@/lib/sizes";
import { forgetWork, keepWork, keptWork } from "@/lib/tools/keep";

import {
  FAVICON_SIZES,
  fitLongestEdge,
  icoFile,
  LOGO_INPUT_MAX_BYTES,
  LOGO_SIZES,
  LOGO_VARIANTS,
  logoInputProblem,
  packEntries,
  packReadme,
  placeInSquare,
} from "../pack";

describe("logo pack", () => {
  it("lists every coloring at every size, the icons and a note", () => {
    const entries = packEntries({ isSvg: false });
    const logos = entries.filter((entry) => entry.kind === "logo");
    expect(logos).toHaveLength(LOGO_VARIANTS.length * LOGO_SIZES.length);
    expect(entries.map((entry) => entry.path)).toEqual(
      expect.arrayContaining([
        "logo/color/logo-color-512.png",
        "logo/white/logo-white-2048.png",
        "favicon/favicon-16.png",
        "favicon/favicon.ico",
        "favicon/apple-touch-icon.png",
        "social/profile-image-1080.png",
        "README.txt",
      ]),
    );
    expect(new Set(entries.map((entry) => entry.path)).size).toBe(entries.length);
  });

  it("adds the original only when it is an SVG", () => {
    expect(packEntries({ isSvg: false }).some((entry) => entry.kind === "source")).toBe(false);
    expect(packEntries({ isSvg: true }).map((entry) => entry.path)).toContain("source/logo.svg");
  });

  it("scales by the longest edge and keeps the shape", () => {
    expect(fitLongestEdge(400, 100, 1024)).toEqual({ width: 1024, height: 256 });
    expect(fitLongestEdge(100, 400, 512)).toEqual({ width: 128, height: 512 });
  });

  it("centers a logo in a square with air around it", () => {
    expect(placeInSquare(400, 100, 100, 0.8)).toEqual({ x: 10, y: 40, width: 80, height: 20 });
    const tall = placeInSquare(100, 400, 180, 0.72);
    expect(tall.x + tall.width / 2).toBeCloseTo(90);
    expect(tall.y + tall.height / 2).toBeCloseTo(90);
    expect(tall.height).toBeLessThanOrEqual(180 * 0.72 + 1);
  });

  it("writes a valid .ico that holds each PNG", () => {
    const pngs = FAVICON_SIZES.map((size) => ({ size, png: new Uint8Array(size).fill(size) }));
    const ico = icoFile(pngs);
    const view = new DataView(ico.buffer);
    expect([view.getUint16(0, true), view.getUint16(2, true), view.getUint16(4, true)]).toEqual([
      0, 1, 3,
    ]);
    pngs.forEach((image, index) => {
      const entry = 6 + index * 16;
      expect(ico[entry]).toBe(image.size);
      expect(ico[entry + 1]).toBe(image.size);
      expect(view.getUint16(entry + 6, true)).toBe(32);
      const length = view.getUint32(entry + 8, true);
      const offset = view.getUint32(entry + 12, true);
      expect(length).toBe(image.png.length);
      expect([...ico.slice(offset, offset + length)]).toEqual([...image.png]);
    });
    expect(ico.length).toBe(6 + 3 * 16 + 16 + 32 + 48);
    // 256 px is written as 0, as the format asks.
    expect(icoFile([{ size: 256, png: new Uint8Array(1) }])[6]).toBe(0);
  });

  it("explains the pack, and says so when it was made from a pixel image", () => {
    expect(packReadme({ isSvg: true, iconBackground: "#ffffff" })).toMatch(
      /source\s+Your original SVG/,
    );
    const fromPng = packReadme({ isSvg: false, iconBackground: "#1f3a5f" });
    expect(fromPng).not.toMatch(/Your original SVG/);
    expect(fromPng).toMatch(/largest sizes may look soft/);
    expect(fromPng).toMatch(/background #1f3a5f/);
  });

  it("says why a file can't be used", () => {
    expect(logoInputProblem({ type: "image/svg+xml", size: 10 })).toBeNull();
    expect(logoInputProblem({ type: "application/pdf", size: 10 })).toMatch(
      /SVG, PNG, WebP or JPG/,
    );
    expect(logoInputProblem({ type: "image/png", size: LOGO_INPUT_MAX_BYTES + 1 })).toMatch(
      /over 10 MB/,
    );
  });
});

describe("email signature", () => {
  const data: SignatureData = {
    ...EMPTY_SIGNATURE,
    name: "Ada Lovelace",
    title: "Founder",
    company: "Acme & Sons",
    phone: "+1 (555) 010-0100",
    email: "ada@acme.com",
    website: "www.acme.com",
    accent: "#1F3A5F",
  };

  it("builds a table with the details, the links and the accent color", () => {
    const html = signatureHtml(data);
    expect(html.startsWith("<table")).toBe(true);
    expect(html).toContain("Ada Lovelace");
    expect(html).toContain("Founder · Acme &amp; Sons");
    expect(html).toContain('href="tel:+15550100100"');
    expect(html).toContain('href="mailto:ada@acme.com"');
    expect(html).toContain('href="https://www.acme.com/"');
    expect(html).toContain(">acme.com</a>");
    expect(html).toContain("#1f3a5f");
    expect(html).not.toContain("<img");
  });

  it("escapes everything typed, so nothing typed can become markup", () => {
    const html = signatureHtml({
      ...data,
      name: '<script>alert("x")</script>',
      title: "CEO <b>",
      email: '"><img src=x onerror=alert(1)>',
      accent: 'red;background:url("javascript:alert(1)")',
    });
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<b>");
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("javascript:");
    expect(html).toContain("&lt;script&gt;");
    // A color that isn't a hex color falls back to the default.
    expect(html).toContain(EMPTY_SIGNATURE.accent);
  });

  it("keeps unsafe addresses out of links and images", () => {
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("data:text/html,hi")).toBeNull();
    expect(safeUrl("acme.com")).toBe("https://acme.com/");
    expect(safeUrl("")).toBeNull();
    const html = signatureHtml({
      ...data,
      website: "javascript:alert(1)",
      logoUrl: "javascript:x",
    });
    expect(html).not.toContain("javascript:");
  });

  it("shows a logo only from an https address, and not in a text-only template", () => {
    expect(logoUrlProblem("")).toBeNull();
    expect(logoUrlProblem("http://acme.com/logo.png")).toMatch(/https/);
    expect(logoUrlProblem("not a url")).toMatch(/web address/);
    const withLogo = signatureHtml({ ...data, logoUrl: "https://acme.com/logo.png" });
    expect(withLogo).toContain('<img src="https://acme.com/logo.png"');
    expect(withLogo).toContain('alt="Acme &amp; Sons"');
    expect(signatureHtml({ ...data, logoUrl: "http://acme.com/logo.png" })).not.toContain("<img");
    expect(
      signatureHtml({ ...data, logoUrl: "https://acme.com/logo.png", template: "minimal" }),
    ).not.toContain("<img");
  });

  it("offers six templates that all carry the details and stay safe", () => {
    expect(SIGNATURE_TEMPLATES).toHaveLength(6);
    for (const template of SIGNATURE_TEMPLATES) {
      const html = signatureHtml({
        ...data,
        template: template.id,
        name: "Ada <i>Lovelace",
        logoUrl: "https://acme.com/logo.png",
        linkedin: "linkedin.com/in/ada",
        x: "javascript:alert(1)",
        extra: "12 Main St",
      });
      expect(html.startsWith("<table"), template.id).toBe(true);
      expect(html, template.id).toContain("Ada &lt;i&gt;Lovelace");
      expect(html, template.id).toContain("ada@acme.com");
      expect(html, template.id).toContain("12 Main St");
      expect(html, template.id).toContain('href="https://linkedin.com/in/ada"');
      expect(html, template.id).not.toContain("javascript:");
      expect(html.includes("<img"), template.id).toBe(template.logo);
      expect((html.match(/<table/g) ?? []).length).toBe((html.match(/<\/table>/g) ?? []).length);
    }
  });

  it("scales the text and the logo", () => {
    const small = signatureHtml({ ...data, size: "small" });
    const large = signatureHtml({ ...data, size: "large" });
    expect(small).toContain("font-size:14px");
    expect(large).toContain("font-size:18px");
    expect(
      signatureHtml({ ...data, logoUrl: "https://acme.com/logo.png", logoSize: "large" }),
    ).toContain('height="76"');
  });

  it("shows stand-in details only while nothing is typed", () => {
    expect(withSampleDetails(EMPTY_SIGNATURE).name).toBe("Alex Morgan");
    expect(withSampleDetails(data)).toBe(data);
  });

  it("loads the logo through our own address in the preview only", () => {
    const withLogo = { ...data, logoUrl: "https://acme.com/logo.png?v=1&x=2" };
    const preview = signatureHtml(withLogo, { logoSrc: previewLogoSrc });
    expect(preview).toContain(
      'src="/api/tools/signature-logo?url=https%3A%2F%2Facme.com%2Flogo.png%3Fv%3D1%26x%3D2"',
    );
    expect(signatureHtml(withLogo)).toContain('src="https://acme.com/logo.png?v=1&amp;x=2"');
  });

  it("has a plain-text version and knows when there is nothing to show", () => {
    expect(signatureText(data)).toBe(
      "Ada Lovelace\nFounder · Acme & Sons\n+1 (555) 010-0100\nada@acme.com\nacme.com",
    );
    expect(hasContent(EMPTY_SIGNATURE)).toBe(false);
    expect(hasContent(data)).toBe(true);
  });

  it("has small helpers that behave", () => {
    expect(escapeHtml(`<a href="x">'&`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;");
    expect(safeColor("#ABCDEF")).toBe("#abcdef");
    expect(safeColor("blue")).toBe(EMPTY_SIGNATURE.accent);
    expect(displayUrl("https://www.acme.com/")).toBe("acme.com");
  });
});

describe("post preview", () => {
  const list = placements();

  it("offers feeds and stories with the size guide's own numbers", () => {
    expect(list.length).toBeGreaterThanOrEqual(6);
    expect(new Set(list.map((p) => p.id)).size).toBe(list.length);
    const story = list.find((p) => p.id === "instagram:story")!;
    const guide = getSizePlatform("instagram")!.formats.find((f) => f.id === "story")!;
    expect([story.width, story.height, story.kind]).toEqual([guide.width, guide.height, "story"]);
    expect(list.filter((p) => p.kind === "feed").length).toBeGreaterThan(0);
  });

  it("turns a story's safe zone into the share of the picture that is covered", () => {
    const story = list.find((p) => p.id === "instagram:story")!;
    const covered = coveredEdges(story)!;
    const zone = story.safeZone as { top: number; bottom: number; left: number };
    expect(covered.top).toBeCloseTo((zone.top / story.height) * 100);
    expect(covered.bottom).toBeCloseTo((zone.bottom / story.height) * 100);
    expect(covered.left).toBeCloseTo((zone.left / story.width) * 100);
    expect(covered.top + covered.bottom).toBeLessThan(100);
    expect(coveredEdges({ width: 1080, height: 1080, safeZone: null })).toBeNull();
  });

  it("says how an image fits a placement", () => {
    const square = { width: 1080, height: 1080 };
    expect(fitNote(2000, 2000, square)).toMatch(/has this placement's shape/);
    expect(fitNote(2000, 1000, square)).toMatch(/about 50% is cut from the left and right/);
    expect(fitNote(1000, 2000, square)).toMatch(/about 50% is cut from the top and bottom/);
  });

  it("lays picture-first and text-first feeds out differently", () => {
    expect(list.find((p) => p.id === "instagram:square-post")!.style).toBe("photo");
    expect(list.find((p) => p.id === "linkedin:landscape-post")!.style).toBe("text");
  });

  it("shortens counts the way feeds do", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(1248)).toBe("1,248");
    expect(formatCount(15300)).toBe("15.3K");
    expect(formatCount(245000)).toBe("245K");
    expect(formatCount(999960)).toBe("1M");
    expect(formatCount(2400000)).toBe("2.4M");
  });

  it("makes up believable numbers and cleans typed ones", () => {
    let seed = 0.13;
    const random = () => (seed = (seed * 9301 + 0.49297) % 1);
    for (let i = 0; i < 50; i++) {
      const e = randomEngagement(random);
      expect(e.likes).toBeGreaterThanOrEqual(40);
      expect(e.likes).toBeLessThanOrEqual(40000);
      expect(e.comments).toBeGreaterThanOrEqual(1);
      expect(e.comments).toBeLessThan(e.likes);
      expect(e.shares).toBeLessThan(e.likes);
    }
    expect(cleanCount("12.9")).toBe(12);
    expect(cleanCount("-4")).toBe(0);
    expect(cleanCount("abc")).toBe(0);
    expect(cleanCount(1e12)).toBe(99_999_999);
  });

  it("guesses a username from a name", () => {
    expect(handleFrom("Acme Studio & Co.")).toBe("acmestudioco.");
    expect(handleFrom("")).toBe("yourbrand");
    expect(handleFrom("  ")).toBe("yourbrand");
  });

  it("wraps a caption and says when it was cut", () => {
    const measure = (text: string) => text.length * 10;
    expect(wrapLines(measure, "one two three", 200, 2)).toEqual({
      lines: ["one two three"],
      cut: false,
    });
    expect(wrapLines(measure, "aaaa bbbb cccc dddd eeee", 100, 2)).toEqual({
      lines: ["aaaa bbbb", "cccc dddd"],
      cut: true,
    });
    // Room is left on the first line for the name drawn before the caption.
    expect(wrapLines(measure, "aaaa bbbb cccc", 100, 3, 50).lines).toEqual(["aaaa", "bbbb cccc"]);
    // A new line in the caption starts a new line; text after the limit counts as cut.
    expect(wrapLines(measure, "first\nsecond\nthird", 200, 2)).toEqual({
      lines: ["first", "second"],
      cut: true,
    });
    expect(wrapLines(measure, "abcdefghijklmnop", 50, 2)).toEqual({
      lines: ["abcde", "fghij"],
      cut: true,
    });
  });
});

describe("handing a picture to Mockup Studio", () => {
  const store = new Map<string, string>();
  const sessionStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  };
  (globalThis as { window?: unknown }).window ??= globalThis;
  Object.defineProperty(globalThis, "sessionStorage", {
    value: sessionStorage,
    configurable: true,
  });

  const dataUrl = "data:image/png;base64,iVBORw0KGgo=";

  it("is picked up once", () => {
    expect(leaveForMockupStudio({ dataUrl, name: "logo.svg", device: "laptop" })).toBe(true);
    expect(takeMockupHandoff()).toEqual({ dataUrl, name: "logo.svg", device: "laptop" });
    expect(takeMockupHandoff()).toBeNull();
  });

  it("carries the way back, but only to a tool that hands pictures over", () => {
    expect(
      leaveForMockupStudio({ dataUrl, name: "p", device: "phone", returnTo: "/post-preview" }),
    ).toBe(true);
    expect(takeMockupHandoff()?.returnTo).toBe("/post-preview");
    expect(
      leaveForMockupStudio({
        dataUrl,
        name: "p",
        device: "phone",
        returnTo: "https://evil.example" as never,
      }),
    ).toBe(false);
  });

  it("offers the way back only to this site's own tool and dashboard pages", () => {
    expect(returnLabel("/post-preview")).toBe("Back to Post and ad preview");
    expect(returnLabel("/customer/tickets/abc123")).toBe("Back to the request");
    expect(returnLabel("/creative/tickets/abc-123_x")).toBe("Back to the request");
    expect(returnLabel("/customer/board")).toBe("Back to where you were");
    for (const path of [
      "",
      null,
      "/",
      "/pricing",
      "//evil.example/customer/board",
      "https://evil.example/customer/board",
      "/customer/board?next=https://evil.example",
      "/customer/../admin",
      "/customer/board#x",
      "javascript:alert(1)",
      "/customer",
    ]) {
      expect(returnLabel(path), String(path)).toBeNull();
    }
    expect(
      leaveForMockupStudio({
        dataUrl,
        name: "p",
        device: "laptop",
        returnTo: "/creative/tickets/abc123",
      }),
    ).toBe(true);
    expect(takeMockupHandoff()?.returnTo).toBe("/creative/tickets/abc123");
  });

  it("picks the device from the picture's shape and never enlarges it", () => {
    expect(deviceForShape(1080, 1920)).toBe("phone");
    expect(deviceForShape(1920, 1080)).toBe("laptop");
    expect(deviceForShape(1080, 1080)).toBe("tablet");
    expect(deviceForShape(1080, 1350)).toBe("tablet");
    expect(fitWithin(4800, 2400, 2400)).toEqual({ width: 2400, height: 1200 });
    expect(fitWithin(800, 600, 2400)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1, 9000, 2400)).toEqual({ width: 1, height: 2400 });
  });

  it("keeps a tool's work between pages", () => {
    expect(keptWork("t")).toBeNull();
    keepWork("t", { caption: "hello" });
    expect(keptWork<{ caption: string }>("t")).toEqual({ caption: "hello" });
    forgetWork("t");
    expect(keptWork("t")).toBeNull();
  });

  it("refuses what is too large or not a picture, and ignores a damaged note", () => {
    expect(
      leaveForMockupStudio({
        dataUrl: `data:image/png;base64,${"A".repeat(HANDOFF_MAX_CHARS)}`,
        name: "big",
        device: "phone",
      }),
    ).toBe(false);
    expect(
      leaveForMockupStudio({ dataUrl: "javascript:alert(1)", name: "x", device: "phone" }),
    ).toBe(false);
    expect(leaveForMockupStudio({ dataUrl, name: "x", device: "watch" as never })).toBe(false);
    store.set("bb.mockup.handoff", "{not json");
    expect(takeMockupHandoff()).toBeNull();
    store.set("bb.mockup.handoff", JSON.stringify({ dataUrl: "https://evil.example/x.png" }));
    expect(takeMockupHandoff()).toBeNull();
  });

  it("reads a data address back into a file", () => {
    const blob = dataUrlToBlob(dataUrl);
    expect(blob.type).toBe("image/png");
    expect(blob.size).toBe(8);
  });

  it("falls back to JPG, then gives up, when a screen is too heavy", () => {
    const canvas = (png: number, jpg: number) =>
      ({
        toDataURL: (type: string) => "x".repeat(type === "image/png" ? png : jpg),
      }) as unknown as HTMLCanvasElement;
    expect(canvasForHandoff(canvas(10, 5))).toHaveLength(10);
    expect(canvasForHandoff(canvas(HANDOFF_MAX_CHARS + 1, 5))).toHaveLength(5);
    expect(canvasForHandoff(canvas(HANDOFF_MAX_CHARS + 1, HANDOFF_MAX_CHARS + 1))).toBeNull();
  });
});
