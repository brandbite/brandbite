// -----------------------------------------------------------------------------
// @file: lib/qr/qr.ts
// @purpose: Branded QR codes: the code's grid (from the `qrcode` package) drawn
//           as an SVG in the visitor's colors, with a choice of module shape
//           and an optional logo in the middle. The codes are plain, static
//           QR codes: the link is in the picture itself, so there is nothing
//           to expire and nothing that counts scans.
// -----------------------------------------------------------------------------

import QRCode from "qrcode";

import { contrastRatio, relativeLuminance } from "@/lib/colors/contrast";
import { hexToRgb, normalizeHex } from "@/lib/colors/convert";

export type QrStyle = "square" | "rounded" | "dots";

export const QR_STYLES: { id: QrStyle; label: string }[] = [
  { id: "square", label: "Square" },
  { id: "rounded", label: "Rounded" },
  { id: "dots", label: "Dots" },
];

export type QrMatrix = { size: number; isDark: (row: number, column: number) => boolean };

/** The longest text the tool takes; far past this a code gets too dense to scan from a screen. */
export const QR_MAX_LENGTH = 600;

/** Quiet zone around the code, in modules. Scanners need it to find the code. */
export const QR_MARGIN = 4;

/** How much of the code's width a logo covers. More than this and the code stops scanning. */
export const QR_LOGO_FRACTION = 0.22;

/** Why this text can't become a code, or null when it can. */
export function qrTextProblem(text: string): string | null {
  if (!text.trim()) return "Type a link or some text to make a code.";
  if (text.length > QR_MAX_LENGTH) return `That is over ${QR_MAX_LENGTH} characters. Shorten it.`;
  return null;
}

/**
 * The code's grid. A logo hides part of the code, so a code with one is made
 * with the highest error correction; without one, medium keeps it less dense.
 */
export function qrMatrix(text: string, withLogo: boolean): QrMatrix {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: withLogo ? "H" : "M" });
  const { size, data } = modules;
  return { size, isDark: (row, column) => Boolean(data[row * size + column]) };
}

/** The three big corner squares scanners look for: top-left, top-right, bottom-left. */
function finderOrigins(size: number): [number, number][] {
  return [
    [0, 0],
    [0, size - 7],
    [size - 7, 0],
  ];
}

function inFinder(size: number, row: number, column: number): boolean {
  return finderOrigins(size).some(
    ([r, c]) => row >= r && row < r + 7 && column >= c && column < c + 7,
  );
}

/** The square of modules a logo covers, centered; null without a logo. */
export function logoModules(size: number): { start: number; count: number } {
  let count = Math.round(size * QR_LOGO_FRACTION);
  // Keep it centered on the grid: same parity as the grid.
  if ((size - count) % 2 !== 0) count += 1;
  return { start: (size - count) / 2, count };
}

const n = (value: number) => Number(value.toFixed(3)).toString();

/**
 * The code as an SVG. `pixels` is the picture's width and height. `logoHref`
 * is an image address (a data: URL when the picture must stand on its own).
 */
export function qrSvg({
  matrix,
  pixels,
  foreground,
  background,
  style,
  logoHref,
}: {
  matrix: QrMatrix;
  pixels: number;
  foreground: string;
  /** null leaves the background see-through. */
  background: string | null;
  style: QrStyle;
  logoHref?: string | null;
}): string {
  const { size } = matrix;
  const total = size + QR_MARGIN * 2;
  const logo = logoHref ? logoModules(size) : null;
  const covered = (row: number, column: number) =>
    logo !== null &&
    row >= logo.start &&
    row < logo.start + logo.count &&
    column >= logo.start &&
    column < logo.start + logo.count;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${pixels}" height="${pixels}" viewBox="0 0 ${total} ${total}" role="img" aria-label="QR code">`,
  );
  if (background) parts.push(`<rect width="${total}" height="${total}" fill="${background}"/>`);

  // Data modules.
  const modules: string[] = [];
  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      if (!matrix.isDark(row, column) || inFinder(size, row, column) || covered(row, column)) {
        continue;
      }
      const x = column + QR_MARGIN;
      const y = row + QR_MARGIN;
      if (style === "dots") {
        modules.push(`<circle cx="${n(x + 0.5)}" cy="${n(y + 0.5)}" r="0.45"/>`);
      } else if (style === "rounded") {
        modules.push(
          `<rect x="${n(x + 0.05)}" y="${n(y + 0.05)}" width="0.9" height="0.9" rx="0.3"/>`,
        );
      } else {
        // A hair wider than a module, so neighbors leave no hairline between them.
        modules.push(`<rect x="${x}" y="${y}" width="1.02" height="1.02"/>`);
      }
    }
  }
  parts.push(`<g fill="${foreground}">${modules.join("")}</g>`);

  // Finder patterns: a ring and a center, rounded to match the modules.
  const outer = style === "square" ? 0 : style === "rounded" ? 1.6 : 2.4;
  const inner = style === "square" ? 0 : style === "rounded" ? 0.7 : 1.5;
  for (const [row, column] of finderOrigins(size)) {
    const x = column + QR_MARGIN;
    const y = row + QR_MARGIN;
    parts.push(
      `<rect x="${n(x + 0.5)}" y="${n(y + 0.5)}" width="6" height="6" rx="${outer}" fill="none" stroke="${foreground}" stroke-width="1"/>`,
      `<rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx="${inner}" fill="${foreground}"/>`,
    );
  }

  if (logo && logoHref) {
    const at = logo.start + QR_MARGIN;
    const pad = 0.5;
    parts.push(
      `<rect x="${at}" y="${at}" width="${logo.count}" height="${logo.count}" rx="1" fill="${background ?? "#ffffff"}"/>`,
      `<image href="${logoHref}" x="${n(at + pad)}" y="${n(at + pad)}" width="${n(logo.count - pad * 2)}" height="${n(logo.count - pad * 2)}" preserveAspectRatio="xMidYMid meet"/>`,
    );
  }

  parts.push("</svg>");
  return parts.join("");
}

/**
 * Whether phones will read these colors. Scanners want a dark code on a light
 * background with clear contrast; anything else is a gamble.
 */
export function qrColorWarning(foreground: string, background: string | null): string | null {
  const fore = normalizeHex(foreground);
  const back = normalizeHex(background ?? "#ffffff");
  if (!fore || !back) return null;
  if (relativeLuminance(hexToRgb(fore)) > relativeLuminance(hexToRgb(back))) {
    return "The code is lighter than its background. Many phone cameras can't read that; make the code the darker color.";
  }
  if (contrastRatio(fore, back) < 4) {
    return "These two colors are close. Pick a darker code color or a lighter background so every phone can read it.";
  }
  return null;
}
