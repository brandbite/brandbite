// -----------------------------------------------------------------------------
// @file: lib/tickets/__tests__/select-creative.test.ts
// @purpose: Unit tests for selectCreativeByLoadThenRating — the auto-assign
//           algorithm that picks a creative by lowest load, with rating as
//           a tie-breaker.
// -----------------------------------------------------------------------------

import { describe, expect, it } from "vitest";

import type { CreativeRatingSummary } from "@/lib/ratings/creative-ratings";
import { selectCreativeByLoadThenRating } from "../auto-assign";

function rating(overall: number | null, count = 1): CreativeRatingSummary {
  return { count, overall, quality: overall, communication: overall, speed: overall };
}
const unrated: CreativeRatingSummary = {
  count: 0,
  overall: null,
  quality: null,
  communication: null,
  speed: null,
};

describe("selectCreativeByLoadThenRating", () => {
  it("returns null when candidate list is empty", () => {
    expect(
      selectCreativeByLoadThenRating({
        candidateIds: [],
        loadByCreative: new Map(),
        ratingByCreative: new Map(),
      }),
    ).toBeNull();
  });

  it("returns the single candidate when only one exists", () => {
    expect(
      selectCreativeByLoadThenRating({
        candidateIds: ["only"],
        loadByCreative: new Map([["only", 42]]),
        ratingByCreative: new Map([["only", rating(3)]]),
      }),
    ).toBe("only");
  });

  it("picks lowest load regardless of rating", () => {
    const pick = selectCreativeByLoadThenRating({
      candidateIds: ["a", "b"],
      loadByCreative: new Map([
        ["a", 10],
        ["b", 5],
      ]),
      ratingByCreative: new Map([
        ["a", rating(5)],
        ["b", rating(1)],
      ]),
    });
    expect(pick).toBe("b");
  });

  it("on tied loads, picks higher overall rating", () => {
    const pick = selectCreativeByLoadThenRating({
      candidateIds: ["a", "b"],
      loadByCreative: new Map([
        ["a", 7],
        ["b", 7],
      ]),
      ratingByCreative: new Map([
        ["a", rating(3.5)],
        ["b", rating(4.8)],
      ]),
    });
    expect(pick).toBe("b");
  });

  it("on tied loads, a rated creative beats an unrated one", () => {
    const pick = selectCreativeByLoadThenRating({
      candidateIds: ["a", "b"],
      loadByCreative: new Map([
        ["a", 7],
        ["b", 7],
      ]),
      ratingByCreative: new Map([
        ["a", unrated],
        ["b", rating(2)],
      ]),
    });
    expect(pick).toBe("b");
  });

  it("on fully equal (both unrated), keeps first-seen for determinism", () => {
    const pick = selectCreativeByLoadThenRating({
      candidateIds: ["first", "second"],
      loadByCreative: new Map([
        ["first", 5],
        ["second", 5],
      ]),
      ratingByCreative: new Map([
        ["first", unrated],
        ["second", unrated],
      ]),
    });
    expect(pick).toBe("first");
  });

  it("on tied loads and tied ratings, keeps first-seen", () => {
    const pick = selectCreativeByLoadThenRating({
      candidateIds: ["first", "second"],
      loadByCreative: new Map([
        ["first", 5],
        ["second", 5],
      ]),
      ratingByCreative: new Map([
        ["first", rating(4)],
        ["second", rating(4)],
      ]),
    });
    expect(pick).toBe("first");
  });

  it("treats missing map entries as load=0 / unrated", () => {
    const pick = selectCreativeByLoadThenRating({
      candidateIds: ["a", "b"],
      loadByCreative: new Map(), // both missing → both 0
      ratingByCreative: new Map(), // both missing → both unrated
    });
    expect(pick).toBe("a");
  });

  it("threaded scenario: three candidates, mixed loads + ratings", () => {
    // a: load 10, rating 5 (best rating, but overloaded)
    // b: load 5,  rating 3
    // c: load 5,  rating 4.5
    // Lowest load = b & c tied at 5; rating breaks tie in favor of c.
    const pick = selectCreativeByLoadThenRating({
      candidateIds: ["a", "b", "c"],
      loadByCreative: new Map([
        ["a", 10],
        ["b", 5],
        ["c", 5],
      ]),
      ratingByCreative: new Map([
        ["a", rating(5)],
        ["b", rating(3)],
        ["c", rating(4.5)],
      ]),
    });
    expect(pick).toBe("c");
  });
});
