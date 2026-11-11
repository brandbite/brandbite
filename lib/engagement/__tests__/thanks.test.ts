import { describe, expect, it } from "vitest";

import { cleanThanksTags, countThanks, thanksSentence } from "../thanks";

describe("thanks tags", () => {
  it("keeps known tags once, in the standard order", () => {
    expect(
      cleanThanksTags(["GREAT_COMMUNICATION", "nope", "NAILED_BRIEF", "NAILED_BRIEF"]),
    ).toEqual(["NAILED_BRIEF", "GREAT_COMMUNICATION"]);
    expect(cleanThanksTags("NAILED_BRIEF")).toEqual([]);
  });

  it("counts how often each tag was given", () => {
    expect(
      countThanks([{ tags: ["NAILED_BRIEF"] }, { tags: ["NAILED_BRIEF", "QUICK_TURNAROUND"] }]),
    ).toEqual({ NAILED_BRIEF: 2, QUICK_TURNAROUND: 1, GREAT_COMMUNICATION: 0 });
  });

  it("writes the tags as a sentence", () => {
    expect(thanksSentence(["NAILED_BRIEF"])).toBe("Nailed the brief");
    expect(thanksSentence(["NAILED_BRIEF", "QUICK_TURNAROUND", "GREAT_COMMUNICATION"])).toBe(
      "Nailed the brief, Quick turnaround and Great communication",
    );
  });
});
