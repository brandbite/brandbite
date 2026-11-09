import { describe, expect, it } from "vitest";

import { snapBox, unionBox } from "../snapping";

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
