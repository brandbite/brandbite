// -----------------------------------------------------------------------------
// @file: lib/__tests__/abbreviation.test.ts
// @purpose: Unit tests for abbreviation generation and validation
// -----------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { generateAbbreviation, abbreviationSchema } from "../abbreviation";

describe("generateAbbreviation", () => {
  it("generates from a single word (first 3 letters)", () => {
    expect(generateAbbreviation("Website")).toBe("WEB");
  });

  it("generates from a single short word", () => {
    expect(generateAbbreviation("Brandbite")).toBe("BRA");
  });

  it("generates from two words (2 letters + 1 letter)", () => {
    expect(generateAbbreviation("Web Design")).toBe("WED");
  });

  it("generates from three words (first letter of each)", () => {
    expect(generateAbbreviation("New York Times")).toBe("NYT");
  });

  it("generates from more than three words (first 3 initials)", () => {
    expect(generateAbbreviation("The Quick Brown Fox")).toBe("TQB");
  });

  it("pads short names with X", () => {
    expect(generateAbbreviation("AI")).toBe("AIX");
  });

  it("pads single-character names", () => {
    expect(generateAbbreviation("A")).toBe("AXX");
  });

  it("strips non-alpha characters", () => {
    expect(generateAbbreviation("Web-2.0 App")).toBe("WEA");
  });

  it("handles empty string", () => {
    expect(generateAbbreviation("")).toBe("XXX");
  });

  it("always returns uppercase", () => {
    expect(generateAbbreviation("hello world")).toBe("HEW");
  });

  it("always returns exactly 3 characters", () => {
    const names = [
      "A",
      "AB",
      "Website",
      "Brand Design Studio",
      "The Quick Brown Fox Jumps",
      "",
      "123",
    ];
    for (const name of names) {
      const result = generateAbbreviation(name);
      expect(result).toHaveLength(3);
      expect(result).toMatch(/^[A-Z]{3}$/);
    }
  });
});

describe("abbreviationSchema", () => {
  it("accepts valid 3-char uppercase", () => {
    expect(abbreviationSchema.safeParse("WEB").success).toBe(true);
    expect(abbreviationSchema.safeParse("NYT").success).toBe(true);
    expect(abbreviationSchema.safeParse("ABC").success).toBe(true);
  });

  it("rejects lowercase", () => {
    expect(abbreviationSchema.safeParse("web").success).toBe(false);
  });

  it("rejects wrong length", () => {
    expect(abbreviationSchema.safeParse("WE").success).toBe(false);
    expect(abbreviationSchema.safeParse("WEBS").success).toBe(false);
  });

  it("rejects numbers", () => {
    expect(abbreviationSchema.safeParse("W3B").success).toBe(false);
  });

  it("rejects empty string", () => {
    expect(abbreviationSchema.safeParse("").success).toBe(false);
  });
});
