import { describe, expect, it } from "vitest";

import { rectInside } from "../canvas-math";
import { snapBox, snapResize, unionBox } from "../snapping";

const box = (x: number, y: number, width = 100, height = 100) => ({ x, y, width, height });

describe("snapBox", () => {
  it("lines up left edges within the threshold and draws one guide across both", () => {
    const { dx, dy, guides } = snapBox(box(4, 300), [box(0, 0)], 6);
    expect(dx).toBe(-4);
    expect(dy).toBe(0);
    expect(guides).toContainEqual({ axis: "x", at: 0, from: 0, to: 400 });
  });

  it("lines up centres and opposite edges too", () => {
    expect(snapBox(box(203, 0), [box(100, 300, 300)], 6).dx).toBe(-3); // centre 253 → 250
    expect(snapBox(box(0, 105), [box(300, 0)], 6).dy).toBe(-5); // top 105 → bottom 100
  });

  it("picks the closest line when several are in reach", () => {
    expect(snapBox(box(0, 0), [box(5, 300), box(-2, 600)], 6).dx).toBe(-2);
  });

  it("does nothing beyond the threshold", () => {
    expect(snapBox(box(10, 300), [box(0, 0)], 6)).toEqual({ dx: 0, dy: 0, guides: [] });
  });

  it("snaps each axis on its own", () => {
    const { dx, dy } = snapBox(box(3, 504), [box(0, 0), box(800, 500)], 6);
    expect(dx).toBe(-3);
    expect(dy).toBe(-4);
  });
});

describe("unionBox", () => {
  it("wraps every box, or gives null for none", () => {
    expect(unionBox([box(0, 0, 10, 10), box(20, 5, 10, 30)])).toEqual(box(0, 0, 30, 35));
    expect(unionBox([])).toBeNull();
  });
});

describe("rectInside", () => {
  it("is true only for a box wholly within another, edges included", () => {
    expect(rectInside(box(10, 10, 50, 50), box(0, 0, 100, 100))).toBe(true);
    expect(rectInside(box(0, 0, 100, 100), box(0, 0, 100, 100))).toBe(true);
    expect(rectInside(box(60, 10, 50, 50), box(0, 0, 100, 100))).toBe(false);
  });
});

describe("snapResize", () => {
  it("pulls the dragged right and bottom edges onto a neighbour's lines", () => {
    // Asked for 0..204 × 0..97; the neighbour's left is at 200 and its top at 100.
    const { box, guides } = snapResize(
      box0(0, 0, 204, 97),
      "se",
      [box0(200, 100, 50, 50)],
      6,
      40,
      40,
    );
    expect(box).toEqual(box0(0, 0, 200, 100));
    expect(guides.map((g) => [g.axis, g.at])).toEqual([
      ["x", 200],
      ["y", 100],
    ]);
  });

  it("moves the left edge for a left-side corner, keeping the right edge put", () => {
    const { box } = snapResize(box0(103, 0, 97, 100), "sw", [box0(100, 300, 50, 50)], 6, 40, 40);
    expect(box).toEqual(box0(100, 0, 100, 100));
  });

  it("never snaps below the minimum size", () => {
    const { box } = snapResize(box0(0, 0, 44, 44), "se", [box0(36, 36, 2, 2)], 6, 40, 40);
    expect(box).toEqual(box0(0, 0, 44, 44));
  });
});

function box0(x: number, y: number, width: number, height: number) {
  return { x, y, width, height };
}
