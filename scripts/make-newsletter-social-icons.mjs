// -----------------------------------------------------------------------------
// @file: scripts/make-newsletter-social-icons.mjs
// @purpose: Draws the round social icons the newsletter builder's "Social"
//           block links to (public/newsletter/social/<platform>-<tone>.png).
//           An email can only show pictures from the web, so these are files
//           on our own site. Run by hand when a glyph changes:
//             node scripts/make-newsletter-social-icons.mjs
// -----------------------------------------------------------------------------

import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "newsletter", "social");
const SIZE = 96; // shown at 32, so it stays sharp on dense screens

/** Each glyph is drawn on a 24 by 24 grid; `fg` is the glyph color, `bg` the circle's. */
const GLYPHS = {
  instagram: (fg) =>
    `<rect x="5" y="5" width="14" height="14" rx="4.2" fill="none" stroke="${fg}" stroke-width="1.8"/><circle cx="12" cy="12" r="3.3" fill="none" stroke="${fg}" stroke-width="1.8"/><circle cx="16.1" cy="7.9" r="1.1" fill="${fg}"/>`,
  facebook: (fg) =>
    `<path fill="${fg}" d="M13.4 20v-6.9h2.3l.4-2.8h-2.7V8.6c0-.8.3-1.4 1.4-1.4h1.4V4.7c-.3 0-1.1-.1-2.1-.1-2.1 0-3.5 1.3-3.5 3.6v2.1H8.3v2.8h2.3V20z"/>`,
  linkedin: (fg) =>
    `<rect x="5.6" y="9.6" width="2.8" height="8.8" fill="${fg}"/><circle cx="7" cy="6.6" r="1.7" fill="${fg}"/><path fill="${fg}" d="M10.4 9.6h2.7v1.2c.5-.8 1.5-1.5 2.9-1.5 2.4 0 3.2 1.5 3.2 4v5.1h-2.8v-4.6c0-1.1-.4-1.9-1.4-1.9-1.1 0-1.8.8-1.8 2v4.5h-2.8z"/>`,
  x: (fg) =>
    `<path fill="${fg}" d="M5.2 5.2h4l3.3 4.6 4-4.6h1.9l-5 5.8 5.5 7.8h-4l-3.6-5-4.4 5H4.9l5.5-6.2z"/>`,
  youtube: (fg, bg) =>
    `<rect x="3.8" y="6.8" width="16.4" height="10.4" rx="3.2" fill="${fg}"/><path fill="${bg}" d="M10.3 9.6v4.8l4.3-2.4z"/>`,
  tiktok: (fg) =>
    `<path fill="${fg}" d="M13.3 4.6h2.4c.2 1.8 1.3 3 3.1 3.2v2.5c-1.2 0-2.2-.3-3.1-.9v5a4.6 4.6 0 1 1-4.6-4.6c.3 0 .5 0 .7.1v2.6a2.1 2.1 0 1 0 1.5 2z"/>`,
  website: (fg) =>
    `<g fill="none" stroke="${fg}" stroke-width="1.6"><circle cx="12" cy="12" r="7.2"/><ellipse cx="12" cy="12" rx="3.1" ry="7.2"/><path d="M4.8 12h14.4"/></g>`,
  email: (fg) =>
    `<g fill="none" stroke="${fg}" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"><rect x="4.6" y="6.8" width="14.8" height="10.4" rx="1.6"/><path d="M5.2 7.8l6.8 5 6.8-5"/></g>`,
};

const TONES = {
  dark: { bg: "#292827", fg: "#ffffff" },
  light: { bg: "#ffffff", fg: "#292827" },
};

await mkdir(OUT, { recursive: true });
for (const [platform, glyph] of Object.entries(GLYPHS)) {
  for (const [tone, { bg, fg }] of Object.entries(TONES)) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="${bg}"/>${glyph(fg, bg)}</svg>`;
    await sharp(Buffer.from(svg))
      .png({ compressionLevel: 9 })
      .toFile(join(OUT, `${platform}-${tone}.png`));
  }
}
console.log(`Wrote ${Object.keys(GLYPHS).length * 2} icons to ${OUT}`);
