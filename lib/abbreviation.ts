// -----------------------------------------------------------------------------
// @file: lib/abbreviation.ts
// @purpose: Auto-generate 3-character uppercase abbreviations for project codes
// -----------------------------------------------------------------------------

import { z } from "zod";

/**
 * Zod schema for validating a 3-character uppercase abbreviation.
 */
export const abbreviationSchema = z
  .string()
  .length(3, "Must be exactly 3 characters")
  .regex(/^[A-Z]{3}$/, "Must be 3 uppercase letters (A-Z)");

/**
 * Generate a 3-character uppercase abbreviation from a name.
 *
 * Strategy:
 * - 3+ words: first letter of each of the first 3 words ("New York Times" -> "NYT")
 * - 2 words: first 2 letters of word 1 + first letter of word 2 ("Web Design" -> "WED")
 * - 1 word: first 3 letters ("Website" -> "WEB")
 * - Pad with "X" if under 3 chars ("AI" -> "AIX")
 * - Always uppercase, letters only
 */
export function generateAbbreviation(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z\s]/g, "").trim();
  const words = cleaned.split(/\s+/).filter(Boolean);

  let abbr = "";

  if (words.length >= 3) {
    // First letter of each of the first 3 words
    abbr = words
      .slice(0, 3)
      .map((w) => w[0])
      .join("");
  } else if (words.length === 2) {
    // First 2 letters of word 1 + first letter of word 2
    abbr = words[0].slice(0, 2) + words[1][0];
  } else if (words.length === 1) {
    // First 3 letters of the single word
    abbr = words[0].slice(0, 3);
  }

  abbr = abbr.toUpperCase().replace(/[^A-Z]/g, "");

  // Pad to 3 chars if needed
  while (abbr.length < 3) {
    abbr += "X";
  }

  return abbr.slice(0, 3);
}

/**
 * Generate a unique 3-char project code within a company.
 * Cycles through the last character (A-Z) to resolve collisions.
 */
export async function generateUniqueProjectCode(
  name: string,
  companyId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: any,
): Promise<string> {
  const base = generateAbbreviation(name);
  let code = base;
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let attempt = 0;

  while (
    await prisma.project.findFirst({
      where: { companyId, code },
    })
  ) {
    attempt++;
    if (attempt <= 26) {
      // Cycle the last character
      const lastIdx = (chars.indexOf(base[2]) + attempt) % 26;
      code = base.slice(0, 2) + chars[lastIdx];
    } else {
      // Cycle the second character too
      const secondIdx = (chars.indexOf(base[1]) + Math.floor(attempt / 26)) % 26;
      const lastIdx = (chars.indexOf(base[2]) + attempt) % 26;
      code = base[0] + chars[secondIdx] + chars[lastIdx];
    }
  }

  return code;
}
