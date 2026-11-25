import { describe, expect, it } from "vitest";

import { toolEntitlement } from "@/lib/tools/entitlement";

import {
  BACKGROUND_PRESETS,
  backgroundCss,
  coverFit,
  DEVICES,
  EXPORT_SIZES,
  exportFileName,
  hasWatermark,
  motionPose,
  MOTIONS,
  recordingSeconds,
  SCREEN_VIDEO_MAX_BYTES,
  screenMediaKind,
  SCREENSHOT_MAX_BYTES,
  screenshotProblem,
  VIDEO,
  videoFileName,
  videoType,
  VIEWS,
} from "../options";

describe("coverFit", () => {
  it("leaves an image of the screen's own shape alone", () => {
    expect(coverFit(0.5, 0.5)).toEqual({ repeatX: 1, repeatY: 1, offsetX: 0, offsetY: 0 });
  });

  it("cuts a wider image evenly left and right", () => {
    const fit = coverFit(2, 1);
    expect(fit).toEqual({ repeatX: 0.5, repeatY: 1, offsetX: 0.25, offsetY: 0 });
  });

  it("keeps the top of a taller image", () => {
    const fit = coverFit(0.25, 0.5);
    expect(fit.repeatX).toBe(1);
    expect(fit.repeatY).toBe(0.5);
    // Texture rows run bottom-up: showing the top means starting halfway.
    expect(fit.offsetY).toBe(0.5);
  });

  it("never stretches, whatever the shapes", () => {
    for (const image of [0.3, 0.46, 1, 1.6, 2.4]) {
      for (const screen of [0.46, 0.75, 1.55]) {
        const fit = coverFit(image, screen);
        // What is shown has the screen's shape.
        expect((image * fit.repeatX) / fit.repeatY).toBeCloseTo(screen, 10);
        expect(fit.offsetX + fit.repeatX).toBeLessThanOrEqual(1 + 1e-9);
        expect(fit.offsetY + fit.repeatY).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
  });

  it("falls back to the whole image when a shape is unknown", () => {
    expect(coverFit(Number.NaN, 0.5)).toEqual({ repeatX: 1, repeatY: 1, offsetX: 0, offsetY: 0 });
    expect(coverFit(1, 0)).toEqual({ repeatX: 1, repeatY: 1, offsetX: 0, offsetY: 0 });
  });
});

describe("screenshots", () => {
  it("takes PNG, JPG and WebP up to the size limit", () => {
    expect(screenshotProblem({ type: "image/png", size: 1000 })).toBeNull();
    expect(screenshotProblem({ type: "image/webp", size: SCREENSHOT_MAX_BYTES })).toBeNull();
  });

  it("says why a file can't be used", () => {
    expect(screenshotProblem({ type: "image/gif", size: 1000 })).toMatch(/PNG, JPG or WebP/);
    expect(screenshotProblem({ type: "image/jpeg", size: SCREENSHOT_MAX_BYTES + 1 })).toMatch(
      /over 15 MB/,
    );
  });
});

describe("screen recordings", () => {
  it("takes MP4, WebM and MOV as video", () => {
    expect(screenMediaKind({ type: "video/mp4" })).toBe("video");
    expect(screenMediaKind({ type: "video/quicktime" })).toBe("video");
    expect(screenMediaKind({ type: "image/png" })).toBe("image");
    expect(screenMediaKind({ type: "application/pdf" })).toBeNull();
    expect(screenshotProblem({ type: "video/webm", size: SCREEN_VIDEO_MAX_BYTES })).toBeNull();
    expect(screenshotProblem({ type: "video/mp4", size: SCREEN_VIDEO_MAX_BYTES + 1 })).toMatch(
      /over 200 MB/,
    );
  });

  it("makes the download as long as the recording, within 3 to 20 seconds", () => {
    expect(recordingSeconds(null)).toBe(VIDEO.seconds);
    expect(recordingSeconds(Number.NaN)).toBe(VIDEO.seconds);
    expect(recordingSeconds(1)).toBe(3);
    expect(recordingSeconds(11.5)).toBe(11.5);
    expect(recordingSeconds(90)).toBe(20);
  });
});

describe("exports", () => {
  it("offers 1080p free and 4K as Pro, both 16:9", () => {
    expect(EXPORT_SIZES.map((size) => [size.id, size.pro])).toEqual([
      ["hd", false],
      ["4k", true],
    ]);
    for (const size of EXPORT_SIZES) expect(size.width / size.height).toBeCloseTo(16 / 9);
  });

  it("marks free downloads only", () => {
    expect(hasWatermark(false)).toBe(true);
    expect(hasWatermark(true)).toBe(false);
  });

  it("names the file after the device and size", () => {
    expect(exportFileName("laptop", EXPORT_SIZES[1])).toBe("brandbite-mockup-laptop-4k.png");
    expect(exportFileName("phone", EXPORT_SIZES[0])).toBe("brandbite-mockup-phone-1080p.png");
  });
});

describe("motions", () => {
  it("keeps a still device still", () => {
    expect(motionPose("none", 2.3)).toEqual({ rotateX: 0, rotateY: 0, lift: 0 });
  });

  it("loops: every motion is back where it started after one video", () => {
    for (const { id } of MOTIONS) {
      const start = motionPose(id, 0);
      const again = motionPose(id, VIDEO.seconds);
      expect(again.rotateX).toBeCloseTo(start.rotateX, 10);
      expect(again.rotateY).toBeCloseTo(start.rotateY, 10);
      expect(again.lift).toBeCloseTo(start.lift, 10);
    }
  });

  it("turns side to side without spinning away", () => {
    const angles = Array.from({ length: 61 }, (_, i) => motionPose("turn", i / 10).rotateY);
    expect(Math.max(...angles)).toBeCloseTo(0.45, 2);
    expect(Math.min(...angles)).toBeCloseTo(-0.45, 2);
  });

  it("slides in from below, then rests in place", () => {
    expect(motionPose("slide", 0).lift).toBeCloseTo(-1.25);
    expect(motionPose("slide", 0.6).lift).toBeGreaterThan(-1.25);
    expect(motionPose("slide", 1.2)).toEqual({ rotateX: 0, rotateY: -0, lift: -0 });
    expect(motionPose("slide", 5).lift).toBeCloseTo(0);
  });

  it("floats gently around its place", () => {
    for (let t = 0; t <= 6; t += 0.25) {
      expect(Math.abs(motionPose("float", t).lift)).toBeLessThanOrEqual(0.025 + 1e-9);
    }
  });
});

describe("video", () => {
  it("prefers MP4, falls back to WebM, and says when nothing works", () => {
    expect(videoType(() => true)).toEqual({
      mime: "video/mp4;codecs=avc1.640028",
      extension: "mp4",
    });
    expect(videoType((mime) => mime.startsWith("video/webm"))).toEqual({
      mime: "video/webm;codecs=vp9",
      extension: "webm",
    });
    expect(videoType(() => false)).toBeNull();
  });

  it("names the file after the device and format", () => {
    expect(videoFileName("tablet", "mp4")).toBe("brandbite-mockup-tablet-1080p.mp4");
  });
});

describe("choices", () => {
  it("has unique ids", () => {
    for (const list of [DEVICES, VIEWS, BACKGROUND_PRESETS, MOTIONS]) {
      const ids = list.map((item) => item.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("paints each kind of background", () => {
    expect(backgroundCss({ kind: "solid", color: "#112233" })).toBe("#112233");
    expect(backgroundCss({ kind: "gradient", from: "#000000", to: "#ffffff" })).toBe(
      "linear-gradient(135deg, #000000, #ffffff)",
    );
    expect(backgroundCss({ kind: "transparent" })).toMatch(/conic-gradient/);
  });
});

describe("toolEntitlement", () => {
  it("gives Pro to a signed-in customer on an active plan, and says why not otherwise", () => {
    expect(toolEntitlement({ signedIn: true, plan: { isActive: true } })).toEqual({
      signedIn: true,
      pro: true,
      reason: null,
    });
    expect(toolEntitlement({ signedIn: true, plan: { isActive: false } })).toMatchObject({
      pro: false,
      reason: "noPlan",
    });
    expect(toolEntitlement({ signedIn: true, plan: null })).toMatchObject({
      pro: false,
      reason: "noPlan",
    });
    // A plan can't unlock anything for someone who isn't signed in.
    expect(toolEntitlement({ signedIn: false, plan: { isActive: true } })).toEqual({
      signedIn: false,
      pro: false,
      reason: "signedOut",
    });
  });
});
