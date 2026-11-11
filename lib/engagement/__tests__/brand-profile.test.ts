import { describe, expect, it } from "vitest";

import { buildBrandProfile } from "../brand-profile";

describe("buildBrandProfile", () => {
  it("is 67% ready with two of three steps done", () => {
    const profile = buildBrandProfile({ colors: true, moodboard: true }, [
      "colors",
      "moodboard",
      "storage",
    ]);
    expect(profile.percent).toBe(67);
    expect(profile.steps.map((s) => s.done)).toEqual([true, true, false]);
    expect(profile.steps[2]!.action.href).toBe("/customer/settings?tab=integrations");
  });

  it("only counts the steps that apply", () => {
    expect(buildBrandProfile({ soundtrack: true }, ["colors", "soundtrack"]).percent).toBe(50);
    expect(buildBrandProfile({}, []).percent).toBe(0);
  });
});
