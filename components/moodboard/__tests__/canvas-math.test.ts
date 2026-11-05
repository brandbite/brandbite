import { describe, expect, it } from "vitest";

import {
  clampZoom,
  fitTransform,
  gridSpacing,
  resizeFromCorner,
  wheelDeltaPx,
  wheelZoomFactor,
  zoomAtPoint,
} from "../canvas-math";

describe("wheel input", () => {
  it("converts lines and pages to pixels", () => {
    expect(wheelDeltaPx(3, 0)).toBe(3);
    expect(wheelDeltaPx(3, 1)).toBe(48);
    expect(wheelDeltaPx(1, 2)).toBe(800);
  });

  it("limits a mouse notch to one modest step, in both directions", () => {
    const zoomIn = wheelZoomFactor(-100);
    expect(zoomIn).toBeGreaterThan(1);
    expect(zoomIn).toBeLessThan(1.3);
    expect(wheelZoomFactor(100)).toBeCloseTo(1 / zoomIn);
  });

  it("keeps small trackpad pinches proportional", () => {
    expect(wheelZoomFactor(-2)).toBeLessThan(wheelZoomFactor(-10));
    expect(wheelZoomFactor(0)).toBe(1);
  });
});

describe("zoomAtPoint", () => {
  const start = { panX: 40, panY: -20, zoom: 1 };

  it("keeps the canvas point under the cursor in place", () => {
    const x = 300;
    const y = 200;
    const before = { x: (x - start.panX) / start.zoom, y: (y - start.panY) / start.zoom };
    const t = zoomAtPoint(start, 1.7, x, y);
    expect((x - t.panX) / t.zoom).toBeCloseTo(before.x);
    expect((y - t.panY) / t.zoom).toBeCloseTo(before.y);
  });

  it("stops at the limits without moving the canvas", () => {
    const atMax = { panX: 10, panY: 10, zoom: clampZoom(99) };
    expect(zoomAtPoint(atMax, 200, 300, 200)).toEqual(atMax);
  });
});

describe("fitTransform", () => {
  it("centers content and doesn't zoom in past 100%", () => {
    const t = fitTransform([{ x: 100, y: 100, width: 200, height: 100 }], 1000, 800);
    expect(t.zoom).toBe(1);
    expect(t.panX + (100 + 100) * t.zoom).toBe(500);
    expect(t.panY + (100 + 50) * t.zoom).toBe(400);
  });

  it("zooms out to show content that doesn't fit, including negative positions", () => {
    const t = fitTransform(
      [
        { x: -2000, y: -1000, width: 300, height: 200 },
        { x: 2000, y: 1000, width: 300, height: 200 },
      ],
      1000,
      800,
    );
    expect(t.zoom).toBeLessThan(1);
    expect(-2000 * t.zoom + t.panX).toBeGreaterThanOrEqual(59.9);
    expect(2300 * t.zoom + t.panX).toBeLessThanOrEqual(940.1);
  });

  it("counts an auto-height card as 200 tall", () => {
    const fromZero = fitTransform([{ x: 0, y: 0, width: 100, height: 0 }], 1000, 800);
    const fromExplicit = fitTransform([{ x: 0, y: 0, width: 100, height: 200 }], 1000, 800);
    expect(fromZero).toEqual(fromExplicit);
  });

  it("returns the default view for an empty board", () => {
    expect(fitTransform([], 1000, 800)).toEqual({ panX: 0, panY: 0, zoom: 1 });
  });
});

describe("gridSpacing", () => {
  it.each([0.1, 0.25, 0.5, 1, 2, 4])("stays readable at %sx", (zoom) => {
    const spacing = gridSpacing(zoom);
    expect(spacing).toBeGreaterThanOrEqual(14);
    expect(spacing).toBeLessThanOrEqual(56);
  });
});

describe("resizeFromCorner", () => {
  const start = { x: 100, y: 100, width: 300, height: 200 };

  it("grows from the bottom-right without moving the card", () => {
    expect(resizeFromCorner(start, "se", 50, 20, 160, 80)).toEqual({
      x: 100,
      y: 100,
      width: 350,
      height: 220,
    });
  });

  it("moves the card when pulling the top-left", () => {
    expect(resizeFromCorner(start, "nw", -50, -20, 160, 80)).toEqual({
      x: 50,
      y: 80,
      width: 350,
      height: 220,
    });
  });

  it("keeps the opposite corner fixed when hitting the minimum size", () => {
    const r = resizeFromCorner(start, "nw", 1000, 1000, 160, 80);
    expect(r.width).toBe(160);
    expect(r.height).toBe(80);
    expect(r.x + r.width).toBe(400);
    expect(r.y + r.height).toBe(300);
  });
});
