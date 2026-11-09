import { describe, expect, it } from "vitest";

import {
  getSizePlatform,
  popularFormats,
  SIZE_NAV,
  SIZE_NAV_MORE,
  SIZE_PLATFORMS,
} from "@/lib/sizes";
import { coveredAreas, templateFileName } from "@/lib/sizes/template";

describe("size data", () => {
  it("has unique platform slugs and unique format ids per platform", () => {
    const slugs = SIZE_PLATFORMS.map((platform) => platform.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const platform of SIZE_PLATFORMS) {
      const ids = platform.formats.map((format) => format.id);
      expect(new Set(ids).size, platform.slug).toBe(ids.length);
      for (const id of ids) expect(id, platform.slug).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("gives every platform formats, tips, sources and a check date", () => {
    for (const platform of SIZE_PLATFORMS) {
      expect(platform.formats.length, platform.slug).toBeGreaterThan(0);
      expect(platform.tips.length, platform.slug).toBeGreaterThan(0);
      expect(platform.sources.length, platform.slug).toBeGreaterThan(0);
      expect(platform.checkedOn, platform.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      for (const source of platform.sources) expect(source.url).toMatch(/^https:\/\//);
    }
  });

  it("states a ratio that matches each format's pixels", () => {
    for (const platform of SIZE_PLATFORMS) {
      for (const format of platform.formats) {
        const [rw, rh] = format.ratio.split(":").map(Number);
        const label = `${platform.slug}/${format.id}`;
        expect(format.width, label).toBeGreaterThan(0);
        expect(format.height, label).toBeGreaterThan(0);
        // Platforms round some ratios (1.91:1, 9:16 at odd pixel sizes), so allow 2%.
        const actual = format.width / format.height;
        expect(Math.abs(actual - rw / rh) / (rw / rh), label).toBeLessThan(0.02);
      }
    }
  });

  it("keeps safe zones inside the canvas", () => {
    for (const platform of SIZE_PLATFORMS) {
      for (const format of platform.formats) {
        for (const rect of coveredAreas(format.width, format.height, format.safeZone)) {
          expect(rect.x + rect.width).toBeLessThanOrEqual(format.width);
          expect(rect.y + rect.height).toBeLessThanOrEqual(format.height);
        }
      }
    }
  });

  it("lists every platform in the menu once", () => {
    const hrefs = [...SIZE_NAV, ...SIZE_NAV_MORE].map((item) => item.href);
    expect(hrefs).toContain("/sizes");
    for (const platform of SIZE_PLATFORMS) {
      expect(hrefs.filter((href) => href === `/sizes/${platform.slug}`)).toHaveLength(1);
    }
  });

  it("finds platforms and popular formats", () => {
    expect(getSizePlatform("instagram")?.name).toBe("Instagram");
    expect(getSizePlatform("nope")).toBeNull();
    expect(popularFormats().length).toBeGreaterThan(5);
  });
});

describe("templates", () => {
  it("shades top and bottom strips for edge safe zones", () => {
    expect(coveredAreas(1080, 1920, { kind: "edges", top: 250, bottom: 340, note: "" })).toEqual([
      { x: 0, y: 0, width: 1080, height: 250 },
      { x: 0, y: 1580, width: 1080, height: 340 },
    ]);
  });

  it("shades everything around a centred safe box", () => {
    const rects = coveredAreas(2560, 1440, { kind: "centre", width: 1546, height: 423, note: "" });
    const shaded = rects.reduce((sum, rect) => sum + rect.width * rect.height, 0);
    expect(shaded).toBe(2560 * 1440 - 1546 * 423);
  });

  it("has nothing to shade without a safe zone", () => {
    expect(coveredAreas(1080, 1080)).toEqual([]);
  });

  it("names template files after the platform, format and size", () => {
    expect(
      templateFileName("instagram", {
        id: "story",
        name: "Story",
        width: 1080,
        height: 1920,
        ratio: "9:16",
        use: "",
        verified: true,
      }),
    ).toBe("brandbite-instagram-story-1080x1920.png");
  });
});
