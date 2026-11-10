import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Every icon the frame can ask for must exist as a PNG in public/email-icons
// (scripts/build-email-icons.mjs). A missing one shows as a broken image.
const ICONS = [
  "ticket",
  "file",
  "file-text",
  "coins",
  "info",
  "alert",
  "calendar",
  "user",
  "lock",
  "check",
  "palette",
  "message",
];
const TONES = ["ink", "info", "warning", "admin", "creative", "customer"];

describe("email icons", () => {
  it("exist for every icon and tone", () => {
    const missing = ICONS.flatMap((i) => TONES.map((t) => `${i}-${t}.png`)).filter(
      (f) => !existsSync(join(process.cwd(), "public", "email-icons", f)),
    );
    expect(missing).toEqual([]);
  });
});
