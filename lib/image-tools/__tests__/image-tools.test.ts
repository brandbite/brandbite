import { describe, expect, it } from "vitest";

import { SIZE_PLATFORMS } from "@/lib/sizes";

import {
  containTarget,
  coverSource,
  cropBackground,
  cropSource,
  DEFAULT_CROP,
  formatBytes,
  hasQuality,
  INPUT_IMAGE_MAX_BYTES,
  inputImageProblem,
  limitWidth,
  needsBackdrop,
  OUTPUT_FORMATS,
  outputFormat,
  panCrop,
  renameWithExtension,
  sizeChange,
  slugify,
  uniqueNames,
} from "../fit";
import {
  AI_EXTEND_DAILY_LIMIT,
  aiCanvas,
  aiResizePrompt,
  canvasId,
  fallbackCanvas,
  keptShare,
  parseTarget,
  worthResizing,
} from "../ai-extend";
import { defaultTargetKeys, socialFileName, socialPlatforms } from "../social-targets";

describe("coverSource", () => {
  it("takes the whole image when the shapes match", () => {
    expect(coverSource(2000, 1000, 400, 200)).toEqual({ x: 0, y: 0, width: 2000, height: 1000 });
  });

  it("cuts the sides of an image that is too wide, evenly", () => {
    expect(coverSource(2000, 1000, 500, 500)).toEqual({ x: 500, y: 0, width: 1000, height: 1000 });
  });

  it("cuts the top and bottom of an image that is too tall, evenly", () => {
    expect(coverSource(1000, 2000, 500, 500)).toEqual({ x: 0, y: 500, width: 1000, height: 1000 });
  });

  it("always takes a piece of the target's shape from inside the image", () => {
    for (const [sw, sh] of [
      [4000, 3000],
      [1080, 1920],
      [800, 800],
    ]) {
      for (const [tw, th] of [
        [1080, 1080],
        [1080, 1920],
        [1200, 627],
      ]) {
        const rect = coverSource(sw, sh, tw, th);
        expect(rect.width / rect.height).toBeCloseTo(tw / th, 8);
        expect(rect.x).toBeGreaterThanOrEqual(0);
        expect(rect.y).toBeGreaterThanOrEqual(0);
        expect(rect.x + rect.width).toBeLessThanOrEqual(sw + 1e-9);
        expect(rect.y + rect.height).toBeLessThanOrEqual(sh + 1e-9);
      }
    }
  });
});

describe("choosing the crop", () => {
  // A 2000 × 1000 image into a square: 1000 px of room to move sideways, none up and down.
  const wide = [2000, 1000, 500, 500] as const;

  it("keeps the middle until told otherwise", () => {
    expect(cropSource(...wide)).toEqual(coverSource(...wide));
    expect(cropSource(...wide, DEFAULT_CROP)).toEqual(coverSource(...wide));
  });

  it("slides the kept part to either edge", () => {
    expect(cropSource(...wide, { x: 0, y: 0.5, zoom: 1 })).toMatchObject({ x: 0, width: 1000 });
    expect(cropSource(...wide, { x: 1, y: 0.5, zoom: 1 })).toMatchObject({ x: 1000, width: 1000 });
  });

  it("zooms by keeping a smaller part of the same shape, which then has room both ways", () => {
    const rect = cropSource(...wide, { x: 0.5, y: 0, zoom: 2 });
    expect(rect).toEqual({ x: 750, y: 0, width: 500, height: 500 });
    expect(cropSource(...wide, { x: 0.5, y: 1, zoom: 2 }).y).toBe(500);
  });

  it("never leaves the image, whatever it is given", () => {
    for (const crop of [
      { x: -3, y: 9, zoom: 0.2 },
      { x: 0.3, y: 0.8, zoom: 99 },
      { x: Number.NaN, y: Number.NaN, zoom: Number.NaN },
    ]) {
      const rect = cropSource(...wide, crop);
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(2000 + 1e-9);
      expect(rect.y + rect.height).toBeLessThanOrEqual(1000 + 1e-9);
      expect(rect.width / rect.height).toBeCloseTo(1, 8);
    }
  });

  it("gives the preview the same crop in CSS numbers", () => {
    expect(cropBackground(...wide)).toEqual({
      sizeX: 200,
      sizeY: 100,
      positionX: 50,
      positionY: 50,
    });
    expect(cropBackground(...wide, { x: 0, y: 1, zoom: 2 })).toEqual({
      sizeX: 400,
      sizeY: 200,
      positionX: 0,
      positionY: 100,
    });
  });

  it("follows a drag: right shows more of the left, and stops at the edge", () => {
    // One frame of room sideways, so dragging half a frame right moves x by half.
    expect(panCrop(...wide, DEFAULT_CROP, 0.5, 0).x).toBeCloseTo(0);
    expect(panCrop(...wide, DEFAULT_CROP, -0.25, 0).x).toBeCloseTo(0.75);
    expect(panCrop(...wide, DEFAULT_CROP, 5, 0).x).toBe(0);
    // No room up and down at zoom 1: a vertical drag changes nothing.
    expect(panCrop(...wide, DEFAULT_CROP, 0, 0.4).y).toBe(0.5);
    // Zoomed in, there is room both ways.
    expect(panCrop(...wide, { x: 0.5, y: 0.5, zoom: 2 }, 0, 0.5).y).toBeCloseTo(0);
  });
});

describe("containTarget", () => {
  it("centers a wide image with room above and below", () => {
    expect(containTarget(2000, 1000, 500, 500)).toEqual({ x: 0, y: 125, width: 500, height: 250 });
  });

  it("centers a tall image with room left and right", () => {
    expect(containTarget(1000, 2000, 500, 500)).toEqual({ x: 125, y: 0, width: 250, height: 500 });
  });

  it("keeps the image's own shape", () => {
    const rect = containTarget(4000, 3000, 1080, 1920);
    expect(rect.width / rect.height).toBeCloseTo(4 / 3, 8);
    expect(rect.width).toBeLessThanOrEqual(1080);
    expect(rect.height).toBeLessThanOrEqual(1920);
  });
});

describe("limitWidth", () => {
  it("scales wider images down and keeps their shape", () => {
    expect(limitWidth(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
  });

  it("leaves smaller images and missing limits alone", () => {
    expect(limitWidth(800, 600, 1600)).toEqual({ width: 800, height: 600 });
    expect(limitWidth(800, 600, null)).toEqual({ width: 800, height: 600 });
    expect(limitWidth(800, 600, 0)).toEqual({ width: 800, height: 600 });
  });
});

describe("formats and names", () => {
  it("knows which formats take a quality and which need a backdrop", () => {
    expect(OUTPUT_FORMATS.map((f) => [f.id, hasQuality(f.id), needsBackdrop(f.id)])).toEqual([
      ["jpeg", true, true],
      ["png", false, false],
      ["webp", true, false],
    ]);
    expect(outputFormat("jpeg").extension).toBe("jpg");
  });

  it("swaps the extension and survives odd names", () => {
    expect(renameWithExtension("photo.final.PNG", "webp")).toBe("photo.final.webp");
    expect(renameWithExtension("noextension", "jpg")).toBe("noextension.jpg");
    expect(renameWithExtension(".hidden", "png")).toBe(".hidden.png");
  });

  it("numbers names that repeat", () => {
    expect(uniqueNames(["a.jpg", "b.jpg", "a.jpg", "a.jpg", "noext", "noext"])).toEqual([
      "a.jpg",
      "b.jpg",
      "a-2.jpg",
      "a-3.jpg",
      "noext",
      "noext-2",
    ]);
  });

  it("makes file-safe slugs", () => {
    expect(slugify("Portrait post (4:5)")).toBe("portrait-post-4-5");
    expect(slugify("  ")).toBe("image");
  });

  it("writes sizes the way people read them", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(862_000)).toBe("842 KB");
    expect(formatBytes(1_500_000)).toBe("1.4 MB");
    expect(sizeChange(1000, 620)).toBe("38% smaller");
    expect(sizeChange(1000, 1120)).toBe("12% larger");
    expect(sizeChange(1000, 1001)).toBe("same size");
    expect(sizeChange(0, 10)).toBe("");
  });

  it("says why a file can't be used", () => {
    expect(inputImageProblem({ type: "image/webp", size: INPUT_IMAGE_MAX_BYTES })).toBeNull();
    expect(inputImageProblem({ type: "image/gif", size: 10 })).toMatch(/PNG, JPG or WebP/);
    expect(inputImageProblem({ type: "image/png", size: INPUT_IMAGE_MAX_BYTES + 1 })).toMatch(
      /over 25 MB/,
    );
  });
});

describe("resize with AI: the plan", () => {
  it("asks for a canvas in the target's own shape, within the model's rules", () => {
    // 16:9-ish and 9:16 land on exact shapes; edges are multiples of 16, long edge 1536.
    expect(aiCanvas(1080, 1920)).toEqual({ width: 864, height: 1536 });
    expect(aiCanvas(1080, 1080)).toEqual({ width: 1536, height: 1536 });
    expect(aiCanvas(1080, 566)).toEqual({ width: 1536, height: 800 });
    for (const [w, h] of [
      [1080, 1350],
      [1200, 627],
      [1584, 396],
      [320, 320],
      [1000, 3000],
    ]) {
      const canvas = aiCanvas(w, h);
      expect(canvas.width % 16).toBe(0);
      expect(canvas.height % 16).toBe(0);
      expect(Math.max(canvas.width, canvas.height)).toBe(1536);
      const ratio = canvas.width / canvas.height;
      expect(ratio).toBeLessThanOrEqual(3 + 1e-9);
      expect(ratio).toBeGreaterThanOrEqual(1 / 3 - 1e-9);
      expect(canvas.width * canvas.height).toBeGreaterThanOrEqual(655_360);
    }
    expect(canvasId(aiCanvas(1080, 1920))).toBe("864x1536");
  });

  it("can't go past 3:1, so a very wide size gets the widest canvas the model draws", () => {
    expect(aiCanvas(1584, 396)).toEqual({ width: 1536, height: 512 });
  });

  it("has a fixed size ready for models that take no others", () => {
    expect(fallbackCanvas(1080, 1080)).toEqual({ width: 1024, height: 1024 });
    expect(fallbackCanvas(1080, 566)).toEqual({ width: 1536, height: 1024 });
    expect(fallbackCanvas(1080, 1920)).toEqual({ width: 1024, height: 1536 });
  });

  it("knows how much of a canvas survives the cut to the target", () => {
    expect(keptShare({ width: 864, height: 1536 }, 1080, 1920)).toEqual({ width: 1, height: 1 });
    // A 3:2 canvas cut to 1.91:1 loses about a fifth of its height.
    const wide = keptShare({ width: 1536, height: 1024 }, 1080, 566);
    expect(wide.width).toBe(1);
    expect(wide.height).toBeCloseTo(0.786, 2);
    // A 2:3 canvas cut to 9:16 loses about a sixth of its width.
    const tall = keptShare({ width: 1024, height: 1536 }, 1080, 1920);
    expect(tall.height).toBe(1);
    expect(tall.width).toBeCloseTo(0.844, 2);
  });

  it("tells the model to keep the design and use the whole canvas", () => {
    const prompt = aiResizePrompt({ width: 864, height: 1536 }, 1080, 1920);
    expect(prompt).toMatch(/tall portrait canvas of 864 by 1536 pixels/);
    expect(prompt).toMatch(/uses the whole canvas/);
    expect(prompt).toMatch(/Keep every piece of text exactly as written/);
    expect(prompt).toMatch(/same face/);
    expect(prompt).toMatch(/Nothing may be cut off/);
    // The canvas has the target's shape: nothing will be cut, so no warning about it.
    expect(prompt).not.toMatch(/will be cut away/);
  });

  it("warns the model about the part that will be cut when the shapes differ", () => {
    const wide = aiResizePrompt({ width: 1536, height: 1024 }, 1080, 566);
    expect(wide).toMatch(/only the middle 79% of the height will be shown/);
    expect(wide).not.toMatch(/of the width will be shown/);
    const tall = aiResizePrompt({ width: 1024, height: 1536 }, 1080, 1920);
    expect(tall).toMatch(/only the middle 84% of the width will be shown/);
  });

  it("is offered only when the shapes really differ", () => {
    expect(worthResizing(1080, 1350, 1080, 1920)).toBe(true);
    expect(worthResizing(1920, 1080, 1080, 1080)).toBe(true);
    expect(worthResizing(1080, 1080, 320, 320)).toBe(false);
    expect(worthResizing(3000, 2000, 1200, 800)).toBe(false);
  });

  it("accepts sensible target sizes only", () => {
    expect(parseTarget("1080", "1920")).toEqual({ width: 1080, height: 1920 });
    expect(parseTarget("0", "1920")).toBeNull();
    expect(parseTarget("1080", "90000")).toBeNull();
    expect(parseTarget("abc", null)).toBeNull();
  });

  it("allows ten runs a day", () => {
    expect(AI_EXTEND_DAILY_LIMIT).toBe(10);
  });
});

describe("social targets", () => {
  const platforms = socialPlatforms();

  it("offers every social platform in the size guide, and no ad platform", () => {
    expect(platforms.map((p) => p.slug)).toEqual(
      SIZE_PLATFORMS.filter((p) => p.group === "social").map((p) => p.slug),
    );
  });

  it("uses the size guide's own numbers", () => {
    const instagram = SIZE_PLATFORMS.find((p) => p.slug === "instagram")!;
    const square = instagram.formats.find((f) => f.id === "square-post")!;
    const target = platforms[0].targets.find((t) => t.key === "instagram:square-post")!;
    expect([target.width, target.height]).toEqual([square.width, square.height]);
  });

  it("has unique keys and real sizes", () => {
    const targets = platforms.flatMap((p) => p.targets);
    expect(new Set(targets.map((t) => t.key)).size).toBe(targets.length);
    for (const target of targets) {
      expect(target.width, target.key).toBeGreaterThan(0);
      expect(target.height, target.key).toBeGreaterThan(0);
    }
  });

  it("ticks something for every platform by default", () => {
    for (const platform of platforms) {
      const keys = defaultTargetKeys(platform);
      expect(keys.length, platform.slug).toBeGreaterThan(0);
      expect(platform.targets.map((t) => t.key)).toEqual(expect.arrayContaining(keys));
    }
  });

  it("names files by platform, size name and pixels", () => {
    const target = platforms[0].targets.find((t) => t.key === "instagram:square-post")!;
    expect(socialFileName(target, "jpg")).toBe("instagram-square-post-1080x1080.jpg");
  });
});
