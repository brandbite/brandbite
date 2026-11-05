import { describe, expect, it } from "vitest";

import {
  roundedPath,
  routeConnection,
  routeMidpoint,
  type Point,
  type RouteRect,
} from "../connection-routing";

const a: RouteRect = { x: 0, y: 0, w: 200, h: 200 };

/** No segment of the line may cross the inside of an object. */
function crosses(points: Point[], r: RouteRect) {
  for (let i = 1; i < points.length; i++) {
    for (let t = 0; t <= 1; t += 0.02) {
      const x = points[i - 1].x + (points[i].x - points[i - 1].x) * t;
      const y = points[i - 1].y + (points[i].y - points[i - 1].y) * t;
      if (x > r.x + 1 && x < r.x + r.w - 1 && y > r.y + 1 && y < r.y + r.h - 1) return true;
    }
  }
  return false;
}

const isOrthogonal = (points: Point[]) =>
  points.slice(1).every((p, i) => p.x === points[i].x || p.y === points[i].y);

describe("routeConnection", () => {
  it("draws a straight line between objects that line up", () => {
    const route = routeConnection(a, { x: 400, y: 5, w: 200, h: 200 });
    expect(route.source).toBe("right");
    expect(route.target).toBe("left");
    expect(route.points).toHaveLength(2);
    expect(route.points[0].y).toBe(route.points[1].y);
  });

  it("does the same vertically, whichever way the arrow points", () => {
    const route = routeConnection({ x: 3, y: 500, w: 200, h: 200 }, a);
    expect(route.source).toBe("top");
    expect(route.target).toBe("bottom");
    expect(route.points).toHaveLength(2);
    expect(route.points[0].x).toBe(route.points[1].x);
  });

  it("uses one bend for a diagonal, entering the far object from the near side", () => {
    const route = routeConnection(a, { x: 600, y: 400, w: 200, h: 200 });
    expect(route.source).toBe("right");
    expect(route.target).toBe("top");
    expect(route.points).toHaveLength(3);
    expect(isOrthogonal(route.points)).toBe(true);
  });

  it("uses a bend halfway between objects that face each other but don't line up", () => {
    const route = routeConnection(a, { x: 300, y: 120, w: 200, h: 200 });
    expect(route.points).toHaveLength(4);
    expect(route.points[1].x).toBe(250);
    expect(isOrthogonal(route.points)).toBe(true);
  });

  it("stops short of the target so the arrowhead shows", () => {
    const target = { x: 400, y: 0, w: 200, h: 200 };
    const route = routeConnection(a, target);
    expect(route.points.at(-1)!.x).toBeLessThan(target.x);
  });

  it.each([
    ["right", { x: 400, y: 0, w: 100, h: 100 }],
    ["far diagonal", { x: 900, y: 900, w: 100, h: 100 }],
    ["up and left", { x: -700, y: -500, w: 200, h: 300 }],
    ["tall neighbour", { x: 260, y: -300, w: 80, h: 900 }],
    ["wide neighbour", { x: -300, y: 300, w: 900, h: 50 }],
    ["close diagonal", { x: 230, y: 230, w: 100, h: 100 }],
  ])("never runs through either object: %s", (_name, b) => {
    const { points } = routeConnection(a, b);
    expect(crosses(points, a)).toBe(false);
    expect(crosses(points, b)).toBe(false);
  });

  it("still returns a line when objects overlap", () => {
    const { points } = routeConnection(a, { x: 100, y: 50, w: 200, h: 200 });
    expect(points).toHaveLength(2);
  });

  it("routes to a bare point, for the arrow being drawn", () => {
    const { points } = routeConnection(a, { x: 500, y: 100, w: 0, h: 0 });
    expect(points.at(-1)!.x).toBeLessThanOrEqual(500);
  });
});

describe("roundedPath", () => {
  it("is a plain line for two points", () => {
    expect(
      roundedPath([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ]),
    ).toBe("M 0 0 L 10 0");
  });

  it("rounds a corner, within what the segments allow", () => {
    const d = roundedPath([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 100 },
    ]);
    expect(d).toContain("Q 10 0 10 5");
  });

  it("has nothing to draw for one point", () => {
    expect(roundedPath([{ x: 0, y: 0 }])).toBe("");
  });
});

describe("routeMidpoint", () => {
  it("finds the middle along the line, not between the ends", () => {
    expect(
      routeMidpoint([
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ]),
    ).toEqual({ x: 100, y: 0 });
  });
});
