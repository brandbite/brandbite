// -----------------------------------------------------------------------------
// @file: lib/ai/__tests__/prompts.test.ts
// @purpose: Unit tests for copy-generation prompt builders (streaming + JSON).
// -----------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import {
  buildCopySystemPrompt,
  buildStreamingCopySystemPrompt,
  STREAM_VARIATION_DELIMITER,
} from "../prompts";

describe("buildCopySystemPrompt", () => {
  it("asks for a JSON array with the requested variation count", () => {
    const prompt = buildCopySystemPrompt("tagline", "playful", 4);
    expect(prompt).toContain("exactly 4 variations");
    expect(prompt).toContain("JSON array");
    expect(prompt).toContain("Tone: playful");
  });
});

describe("buildStreamingCopySystemPrompt", () => {
  it("instructs the model to emit the stream delimiter between variations", () => {
    const prompt = buildStreamingCopySystemPrompt("headline", "bold", 3);
    expect(prompt).toContain("exactly 3 variations");
    expect(prompt).toContain(STREAM_VARIATION_DELIMITER);
    expect(prompt).toContain("Tone: bold");
  });

  it("never asks for JSON output (would stall the stream UI)", () => {
    // The prompt may legitimately say "no JSON" as a negative instruction;
    // we only want to make sure it doesn't *request* JSON as the format.
    const prompt = buildStreamingCopySystemPrompt("ad_copy", "professional", 2);
    expect(prompt).not.toMatch(/return\s+.*json/i);
    expect(prompt).not.toMatch(/output\s+.*json\s+array/i);
  });

  it("stream delimiter is not accidentally emitted inside the instructions", () => {
    // The delimiter appears in the rules literally once — as the quoted
    // instruction value. If it showed up as free prose the model could echo
    // it too eagerly at the start of its output.
    const prompt = buildStreamingCopySystemPrompt("tagline", "casual", 3);
    const occurrences = prompt.split(STREAM_VARIATION_DELIMITER).length - 1;
    expect(occurrences).toBe(1);
  });
});
