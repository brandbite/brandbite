// -----------------------------------------------------------------------------
// @file: lib/colors/extract.ts
// @purpose: Client-side dominant-color extraction from an uploaded image via a
//           median-cut quantizer. Runs entirely in the browser — the image
//           never leaves the device; only the resulting hex array can be saved.
// -----------------------------------------------------------------------------

import { rgbToHsl, toPaletteColor } from "./convert";
import { relativeLuminance } from "./contrast";
import type { Palette, RGB } from "./types";

export interface ExtractOptions {
  /** Number of dominant colors to return (clamped 1–12). Default 6. */
  maxColors?: number;
  /** Longest edge the image is downsampled to before sampling. Default 256. */
  maxDimension?: number;
}

interface Bucket {
  pixels: RGB[];
}

function channelRange(pixels: RGB[], ch: keyof RGB): number {
  let min = 255;
  let max = 0;
  for (const p of pixels) {
    const v = p[ch];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return max - min;
}

function widestChannel(pixels: RGB[]): keyof RGB {
  const r = channelRange(pixels, "r");
  const g = channelRange(pixels, "g");
  const b = channelRange(pixels, "b");
  if (r >= g && r >= b) return "r";
  if (g >= r && g >= b) return "g";
  return "b";
}

function averageColor(pixels: RGB[]): RGB {
  const sum = pixels.reduce(
    (acc, p) => {
      acc.r += p.r;
      acc.g += p.g;
      acc.b += p.b;
      return acc;
    },
    { r: 0, g: 0, b: 0 },
  );
  const n = Math.max(1, pixels.length);
  return { r: Math.round(sum.r / n), g: Math.round(sum.g / n), b: Math.round(sum.b / n) };
}

/**
 * Median-cut quantization. Pure and testable — takes raw pixels, returns a
 * palette of `maxColors` representative colors sorted by luminance.
 */
export function quantize(pixels: RGB[], maxColors: number): Palette {
  const n = Math.max(1, Math.min(12, maxColors));
  if (pixels.length === 0) return [];

  let buckets: Bucket[] = [{ pixels }];

  // Repeatedly split the bucket with the widest channel range until we have N.
  while (buckets.length < n) {
    // Pick the bucket whose widest channel range is largest.
    let target = -1;
    let targetRange = -1;
    for (let i = 0; i < buckets.length; i++) {
      if (buckets[i].pixels.length < 2) continue;
      const ch = widestChannel(buckets[i].pixels);
      const range = channelRange(buckets[i].pixels, ch);
      if (range > targetRange) {
        targetRange = range;
        target = i;
      }
    }
    if (target === -1) break; // nothing left to split

    const bucket = buckets[target];
    const ch = widestChannel(bucket.pixels);
    const sorted = [...bucket.pixels].sort((a, b) => a[ch] - b[ch]);
    const mid = Math.floor(sorted.length / 2);
    const left = { pixels: sorted.slice(0, mid) };
    const right = { pixels: sorted.slice(mid) };
    buckets = buckets.filter((_, i) => i !== target).concat(left, right);
  }

  return buckets
    .filter((b) => b.pixels.length > 0)
    .map((b) => toPaletteColor(toHex(averageColor(b.pixels))))
    .sort((a, b) => relativeLuminance(a.rgb) - relativeLuminance(b.rgb));
}

function toHex(rgb: RGB): string {
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(rgb.r)}${h(rgb.g)}${h(rgb.b)}`;
}

/** Extract dominant colors directly from ImageData (pure, no DOM load step). */
export function extractFromImageData(data: ImageData, maxColors: number): Palette {
  const pixels: RGB[] = [];
  const { data: buf } = data;
  for (let i = 0; i < buf.length; i += 4) {
    const a = buf[i + 3];
    if (a < 128) continue; // skip (near-)transparent pixels
    pixels.push({ r: buf[i], g: buf[i + 1], b: buf[i + 2] });
  }
  return quantize(pixels, maxColors);
}

/**
 * Load a File into a downsampled canvas and extract its dominant colors.
 * Browser-only (uses createImageBitmap / canvas). No network activity.
 */
export async function extractPalette(file: File, opts: ExtractOptions = {}): Promise<Palette> {
  const maxColors = Math.max(1, Math.min(12, opts.maxColors ?? 6));
  const maxDimension = opts.maxDimension ?? 256;

  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);

  // Free the bitmap when possible.
  if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();

  return extractFromImageData(imageData, maxColors);
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // fall through to <img> fallback
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Convenience re-export so callers can turn an rgb into hsl for display. */
export { rgbToHsl };
