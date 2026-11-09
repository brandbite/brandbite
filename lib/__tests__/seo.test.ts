import { describe, expect, it } from "vitest";

import { pageMetadata } from "@/lib/seo/metadata";
import {
  absoluteUrl,
  blogPostingJsonLd,
  breadcrumbJsonLd,
  serializeJsonLd,
  SITE_URL,
  webApplicationJsonLd,
} from "@/lib/seo/structured-data";

describe("pageMetadata", () => {
  it("keeps the search title, canonical and share card in agreement", () => {
    const meta = pageMetadata({
      title: "Contrast Checker",
      description: "Check contrast.",
      path: "/colors/contrast-checker",
    });
    expect(meta.title).toBe("Contrast Checker");
    expect(meta.alternates?.canonical).toBe("/colors/contrast-checker");
    expect(meta.openGraph).toMatchObject({
      title: "Contrast Checker | brandbite",
      description: "Check contrast.",
      url: "/colors/contrast-checker",
      siteName: "brandbite",
    });
    expect(meta.twitter).toMatchObject({ title: "Contrast Checker | brandbite" });
    expect(meta.robots).toBeUndefined();
  });

  it("supports absolute titles and noindex", () => {
    const meta = pageMetadata({
      title: "brandbite | Home",
      description: "x",
      path: "/",
      absoluteTitle: true,
      noindex: true,
    });
    expect(meta.title).toEqual({ absolute: "brandbite | Home" });
    expect(meta.openGraph).toMatchObject({ title: "brandbite | Home" });
    expect(meta.robots).toEqual({ index: false, follow: true });
  });
});

describe("structured data", () => {
  it("builds absolute URLs from paths", () => {
    expect(absoluteUrl("/colors")).toBe(`${SITE_URL}/colors`);
    expect(absoluteUrl("colors")).toBe(`${SITE_URL}/colors`);
    expect(absoluteUrl("https://cdn.example.com/a.png")).toBe("https://cdn.example.com/a.png");
  });

  it("numbers breadcrumb items from one", () => {
    const crumbs = breadcrumbJsonLd([
      { name: "Color Studio", path: "/colors" },
      { name: "Color Wheel", path: "/colors/color-wheel" },
    ]);
    expect(crumbs.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Color Studio", item: `${SITE_URL}/colors` },
      {
        "@type": "ListItem",
        position: 2,
        name: "Color Wheel",
        item: `${SITE_URL}/colors/color-wheel`,
      },
    ]);
  });

  it("marks tools as free", () => {
    const tool = webApplicationJsonLd({
      name: "Wheel",
      path: "/colors/color-wheel",
      description: "d",
    });
    expect(tool).toMatchObject({
      "@type": "WebApplication",
      isAccessibleForFree: true,
      offers: { price: "0" },
    });
  });

  it("leaves out blog fields the CMS doesn't have", () => {
    const post = blogPostingJsonLd({ title: "Hello", path: "/blog/hello" });
    expect(post).not.toHaveProperty("image");
    expect(post).not.toHaveProperty("datePublished");
    expect(post.author).toEqual({ "@id": `${SITE_URL}/#organization` });
  });

  it("can't be closed early by CMS text", () => {
    const json = serializeJsonLd({ headline: "</script><script>alert(1)</script>" });
    expect(json).not.toContain("</script>");
    expect(JSON.parse(json).headline).toBe("</script><script>alert(1)</script>");
  });
});
