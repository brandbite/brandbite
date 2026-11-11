import { describe, expect, it } from "vitest";

import { briefStrength, briefStrengthCount, mentionsDimensions } from "../brief-strength";

describe("brief strength", () => {
  it.each([
    "Design 3 Instagram posts, 1080 × 1350 px.",
    "<p>Banner 300x250</p>",
    "A flyer, A5, double sided",
    "Video in 16:9",
    "Poster 50 cm wide",
    "Logo at 300 dpi",
  ])("sees dimensions in %s", (text) => {
    expect(mentionsDimensions(text)).toBe(true);
  });

  it.each(["Make it pop", "We need 3 posts by Friday", "<p>Call me at 10</p>"])(
    "sees none in %s",
    (text) => {
      expect(mentionsDimensions(text)).toBe(false);
    },
  );

  it("counts a file or a link as a reference", () => {
    const base = { briefHtml: "Make it pop", attachmentCount: 0, moodboardLinked: false };
    expect(briefStrength(base).reference).toBe(false);
    expect(briefStrength({ ...base, attachmentCount: 1 }).reference).toBe(true);
    expect(briefStrength({ ...base, briefHtml: "Like https://example.com/ad" }).reference).toBe(
      true,
    );
  });

  it("adds up the details", () => {
    const strength = briefStrength({
      briefHtml: "Posts at 1080x1350",
      attachmentCount: 2,
      moodboardLinked: false,
    });
    expect(briefStrengthCount(strength)).toBe(2);
  });
});
