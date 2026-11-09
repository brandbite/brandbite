import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { PUBLIC_GUIDES } from "@/lib/guides";
import { getTemplate, TEMPLATES } from "@/lib/templates";

const publicFile = (p: string) => join(process.cwd(), "public", p);
/** A static page under app/, or a public guide (a dynamic /guides/[slug] page). */
const pageExists = (href: string) =>
  href.startsWith("/guides/")
    ? PUBLIC_GUIDES.some((guide) => `/guides/${guide.slug}` === href)
    : existsSync(join(process.cwd(), "app", ...href.split("/").filter(Boolean), "page.tsx"));

describe("free templates", () => {
  it("have unique slugs and point at real Office files", () => {
    const slugs = TEMPLATES.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const t of TEMPLATES) {
      expect(t.file.endsWith(`.${t.extension}`), t.slug).toBe(true);
      const path = publicFile(t.file);
      expect(existsSync(path), t.file).toBe(true);
      expect(statSync(path).size, t.file).toBeGreaterThan(5_000);
      // Office files are ZIP archives.
      expect(readFileSync(path).subarray(0, 2).toString("latin1"), t.file).toBe("PK");
    }
  });

  it("have previews, guides and tools that exist", () => {
    for (const t of TEMPLATES) {
      if (t.preview.kind === "image")
        expect(existsSync(publicFile(t.preview.src)), t.slug).toBe(true);
      for (const link of [t.guide, t.tool]) {
        if (link) expect(pageExists(link.href), `${t.slug} → ${link.href}`).toBe(true);
      }
      expect(t.inside.length).toBeGreaterThan(2);
      expect(t.howTo.length).toBeGreaterThan(1);
      expect(t.seoTitle.length, t.slug).toBeLessThanOrEqual(52);
    }
  });

  it("finds templates by slug", () => {
    expect(getTemplate("creative-brief-template")?.format).toBe("Word");
    expect(getTemplate("nope")).toBeNull();
  });
});
