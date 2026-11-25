// -----------------------------------------------------------------------------
// @file: lib/logo-pack/pack.ts
// @purpose: What a logo pack holds: the logo in three colorings and three
//           sizes, a favicon set, an app icon and a social profile image, laid
//           out in folders. This file is the list and the arithmetic; the
//           drawing happens in the browser (components/logo-pack). Pure.
// -----------------------------------------------------------------------------

export type LogoVariant = "color" | "black" | "white";

export const LOGO_VARIANTS: { id: LogoVariant; label: string; fill: string | null }[] = [
  { id: "color", label: "Original colors", fill: null },
  { id: "black", label: "Black", fill: "#000000" },
  { id: "white", label: "White", fill: "#ffffff" },
];

/** Longest edge of each logo PNG, in pixels. */
export const LOGO_SIZES = [512, 1024, 2048];
export const FAVICON_SIZES = [16, 32, 48];
export const TOUCH_ICON_SIZE = 180;
export const PROFILE_SIZE = 1080;

/** The one file everyone gets; the full pack comes with a plan. */
export const FREE_FILE = { variant: "color" as LogoVariant, size: 512 };

/** How much of a square icon the logo may fill, leaving air around it. */
export const ICON_FILL = 0.72;
/** Favicons are tiny, so the logo fills nearly all of the square. */
export const FAVICON_FILL = 0.9;

export const LOGO_INPUT_TYPES = ["image/svg+xml", "image/png", "image/webp", "image/jpeg"];
export const LOGO_INPUT_MAX_BYTES = 10 * 1024 * 1024;

/** Why a chosen file can't be used, or null when it can. */
export function logoInputProblem(file: { type: string; size: number }): string | null {
  if (!LOGO_INPUT_TYPES.includes(file.type)) return "Use an SVG, PNG, WebP or JPG logo.";
  if (file.size > LOGO_INPUT_MAX_BYTES) return "That file is over 10 MB. Use a smaller one.";
  return null;
}

/** A logo scaled so its longest edge is `edge`, in whole pixels. */
export function fitLongestEdge(width: number, height: number, edge: number) {
  const scale = edge / Math.max(width, height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Where a logo sits in a square of `size`, filling `fill` of it, centered. */
export function placeInSquare(width: number, height: number, size: number, fill: number) {
  const box = fitLongestEdge(width, height, size * fill);
  return { x: (size - box.width) / 2, y: (size - box.height) / 2, ...box };
}

export type PackEntry =
  | { kind: "logo"; path: string; variant: LogoVariant; edge: number }
  | { kind: "favicon"; path: string; size: number }
  | { kind: "ico"; path: string }
  | { kind: "icon"; path: string; size: number }
  | { kind: "source"; path: string }
  | { kind: "readme"; path: string };

/** Every file in the pack, in the order it is listed and zipped. */
export function packEntries({ isSvg }: { isSvg: boolean }): PackEntry[] {
  const entries: PackEntry[] = [];
  for (const variant of LOGO_VARIANTS) {
    for (const edge of LOGO_SIZES) {
      entries.push({
        kind: "logo",
        variant: variant.id,
        edge,
        path: `logo/${variant.id}/logo-${variant.id}-${edge}.png`,
      });
    }
  }
  for (const size of FAVICON_SIZES) {
    entries.push({ kind: "favicon", size, path: `favicon/favicon-${size}.png` });
  }
  entries.push({ kind: "ico", path: "favicon/favicon.ico" });
  entries.push({ kind: "icon", size: TOUCH_ICON_SIZE, path: "favicon/apple-touch-icon.png" });
  entries.push({ kind: "icon", size: PROFILE_SIZE, path: "social/profile-image-1080.png" });
  if (isSvg) entries.push({ kind: "source", path: "source/logo.svg" });
  entries.push({ kind: "readme", path: "README.txt" });
  return entries;
}

/**
 * A .ico file holding several PNGs (the modern form of the format: each
 * picture is stored as a PNG, which every current browser and Windows read).
 */
export function icoFile(images: { size: number; png: Uint8Array }[]): Uint8Array {
  const headerSize = 6 + images.length * 16;
  const total = headerSize + images.reduce((sum, image) => sum + image.png.length, 0);
  const file = new Uint8Array(total);
  const view = new DataView(file.buffer);
  view.setUint16(0, 0, true); // reserved
  view.setUint16(2, 1, true); // type: icon
  view.setUint16(4, images.length, true);
  let offset = headerSize;
  images.forEach((image, index) => {
    const entry = 6 + index * 16;
    // Width and height: one byte each, where 0 means 256.
    file[entry] = image.size >= 256 ? 0 : image.size;
    file[entry + 1] = image.size >= 256 ? 0 : image.size;
    file[entry + 2] = 0; // no palette
    file[entry + 3] = 0; // reserved
    view.setUint16(entry + 4, 1, true); // color planes
    view.setUint16(entry + 6, 32, true); // bits per pixel
    view.setUint32(entry + 8, image.png.length, true);
    view.setUint32(entry + 12, offset, true);
    file.set(image.png, offset);
    offset += image.png.length;
  });
  return file;
}

/** The note that explains the pack to whoever opens the zip. */
export function packReadme({
  isSvg,
  iconBackground,
}: {
  isSvg: boolean;
  iconBackground: string;
}): string {
  return [
    "Your logo pack",
    "==============",
    "",
    "logo/color   Your logo in its own colors, on a see-through background.",
    "logo/black   The same logo in solid black, for light backgrounds.",
    "logo/white   The same logo in solid white, for dark backgrounds and photos.",
    `             Each comes ${LOGO_SIZES.join(", ")} pixels on its longest edge.`,
    "",
    "favicon      favicon.ico and PNGs for your website's browser tab, and",
    "             apple-touch-icon.png for phone home screens.",
    "social       profile-image-1080.png, a square for social media profiles.",
    `             The icons use the background ${iconBackground}.`,
    ...(isSvg ? ["source       Your original SVG. Send this one to printers and designers."] : []),
    "",
    "Use PNG on screens and in documents. For print, use the SVG if you have one.",
    isSvg
      ? ""
      : "This pack was made from a pixel image, so the largest sizes may look soft.\nIf you have the logo as an SVG, make the pack again from that.",
    "",
    "Made with brandbite.studio/logo-pack",
  ]
    .join("\n")
    .trimEnd()
    .concat("\n");
}
