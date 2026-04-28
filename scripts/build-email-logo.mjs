// -----------------------------------------------------------------------------
// @file: scripts/build-email-logo.mjs
// @purpose: Convert public/brandbite-logo.svg → public/brandbite-logo-email.png
//           at 2x retina width so the email layout has a sharp PNG to point
//           at. PNG is the only format universally supported across email
//           clients (Gmail, Outlook, and Yahoo all reject SVG).
//
//           Run on demand:  node scripts/build-email-logo.mjs
//           Re-run whenever the logo SVG is updated. The output PNG is
//           committed to the repo so production builds don't depend on
//           sharp at runtime.
// -----------------------------------------------------------------------------

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, "..");

const INPUT = join(REPO_ROOT, "public", "brandbite-logo.svg");
const OUTPUT = join(REPO_ROOT, "public", "brandbite-logo-email.png");

// Email displays the logo at ~140px wide; 2x source for retina sharpness.
const TARGET_WIDTH_PX = 280;

const svg = await readFile(INPUT);

const buffer = await sharp(svg, { density: 300 })
  .resize({ width: TARGET_WIDTH_PX })
  // Transparent background so the email's header color (whatever we end
  // up choosing) shows through cleanly.
  .png({ compressionLevel: 9 })
  .toBuffer();

await writeFile(OUTPUT, buffer);

const sizeKb = (buffer.byteLength / 1024).toFixed(1);
console.log(`✔ wrote ${OUTPUT} (${TARGET_WIDTH_PX}px wide, ${sizeKb} KB)`);
