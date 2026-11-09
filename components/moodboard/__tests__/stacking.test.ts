import { describe, expect, it } from "vitest";

import { nextPosition, restack } from "../stacking";

const items = [
  { id: "a", position: 0 },
  { id: "b", position: 1 },
  { id: "c", position: 2 },
  { id: "d", position: 3 },
];

describe("stacking", () => {
  it("adds new objects on top", () => {
    expect(nextPosition(items)).toBe(4);
    expect(nextPosition([{ id: "x", position: -3 }])).toBe(-2);
    expect(nextPosition([])).toBe(0);
  });

  it("brings objects to the front, keeping their own order", () => {
    expect([...restack(items, ["c", "a"], "front")]).toEqual([
      ["a", 4],
      ["c", 5],
    ]);
  });

  it("sends objects to the back, below zero if needed", () => {
    expect([...restack(items, ["d", "b"], "back")]).toEqual([
      ["b", -2],
      ["d", -1],
    ]);
  });

  it("changes nothing when they're already there", () => {
    expect(restack(items, ["d"], "front").size).toBe(0);
    expect(restack(items, ["a"], "back").size).toBe(0);
    expect(restack(items, ["a", "b", "c", "d"], "front").size).toBe(0);
    expect(restack(items, ["zz"], "front").size).toBe(0);
  });
});
