// -----------------------------------------------------------------------------
// @file: lib/colors/extract.ts
// @purpose: Client-side dominant-color extraction from an uploaded image via
//           k-means clustering. Runs entirely in the browser — the image
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

interface WeightedColor {
  r: number;
  g: number;
  b: number;
  weight: number;
}

function squaredDistance(a: RGB, b: RGB): number {
  return (a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2;
}

/** Group similar pixels into a compact weighted histogram (5 bits per channel). */
function toHistogram(pixels: RGB[]): WeightedColor[] {
  const bins = new Map<number, WeightedColor>();
  for (const { r, g, b } of pixels) {
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const bin = bins.get(key);
    if (bin) {
      bin.r += r;
      bin.g += g;
      bin.b += b;
      bin.weight += 1;
    } else {
      bins.set(key, { r, g, b, weight: 1 });
    }
  }
  return Array.from(bins.values(), (bin) => ({
    r: bin.r / bin.weight,
    g: bin.g / bin.weight,
    b: bin.b / bin.weight,
    weight: bin.weight,
  }));
}

/**
 * Dominant colors by k-means with a fixed start: the most common color, then
 * repeatedly the color that is both common and far from those already chosen.
 * Nothing is random, so the same pixels always give the same palette. Pure and
 * testable; returns colors sorted by luminance.
 */
export function quantize(pixels: RGB[], maxColors: number): Palette {
  const k = Math.max(1, Math.min(12, maxColors));
  if (pixels.length === 0) return [];

  const points = toHistogram(pixels);
  const centers: RGB[] = [];
  const nearest = new Array<number>(points.length).fill(Infinity);

  while (centers.length < Math.min(k, points.length)) {
    let bestIndex = 0;
    let bestScore = -1;
    points.forEach((point, index) => {
      const score = centers.length === 0 ? point.weight : point.weight * nearest[index];
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });
    const { r, g, b } = points[bestIndex];
    const center = { r, g, b };
    centers.push(center);
    points.forEach((point, index) => {
      nearest[index] = Math.min(nearest[index], squaredDistance(point, center));
    });
  }

  for (let iteration = 0; iteration < 12; iteration++) {
    const sums = centers.map(() => ({ r: 0, g: 0, b: 0, weight: 0 }));
    for (const point of points) {
      let closest = 0;
      let closestDistance = Infinity;
      centers.forEach((center, index) => {
        const distance = squaredDistance(point, center);
        if (distance < closestDistance) {
          closestDistance = distance;
          closest = index;
        }
      });
      const sum = sums[closest];
      sum.r += point.r * point.weight;
      sum.g += point.g * point.weight;
      sum.b += point.b * point.weight;
      sum.weight += point.weight;
    }
    sums.forEach((sum, index) => {
      if (sum.weight > 0) {
        centers[index] = {
          r: sum.r / sum.weight,
          g: sum.g / sum.weight,
          b: sum.b / sum.weight,
        };
      }
    });
  }

  const hexes = new Set(
    centers.map((c) => toHex({ r: Math.round(c.r), g: Math.round(c.g), b: Math.round(c.b) })),
  );
  return Array.from(hexes, (hex) => toPaletteColor(hex)).sort(
    (a, b) => relativeLuminance(a.rgb) - relativeLuminance(b.rgb),
  );
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

export const IMAGE_ACCEPT = ["image/jpeg", "image/png", "image/webp"];
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MIN_IMAGE_COLORS = 3;
export const MAX_IMAGE_COLORS = 8;

export type ImageFileProblem = "type" | "size";

/** Check a file before decoding it. Decoding can still fail on a mislabelled file. */
export function checkImageFile(file: Pick<File, "type" | "size">): ImageFileProblem | null {
  if (!IMAGE_ACCEPT.includes(file.type)) return "type";
  if (file.size > MAX_IMAGE_BYTES) return "size";
  return null;
}

export interface ColorLocation {
  /** Position of the closest matching pixel, as fractions of the image size. */
  x: number;
  y: number;
}

/**
 * Find where each color appears, for numbered markers: the matching pixel nearest
 * the middle of everything close to that color, kept away from the image edges.
 */
export function locateColors(data: ImageData, palette: Palette): ColorLocation[] {
  const { data: buf, width, height } = data;
  const MATCH_DISTANCE = 1600;
  const position = (byteIndex: number) => {
    const pixel = byteIndex / 4;
    return { x: pixel % width, y: Math.floor(pixel / width) };
  };

  return palette.map(({ rgb }) => {
    const distanceAt = (i: number) =>
      (buf[i] - rgb.r) ** 2 + (buf[i + 1] - rgb.g) ** 2 + (buf[i + 2] - rgb.b) ** 2;

    let closest = Infinity;
    for (let i = 0; i < buf.length; i += 4) {
      if (buf[i + 3] >= 128) closest = Math.min(closest, distanceAt(i));
    }
    const limit = closest + MATCH_DISTANCE;

    let sumX = 0;
    let sumY = 0;
    let count = 0;
    for (let i = 0; i < buf.length; i += 4) {
      if (buf[i + 3] < 128 || distanceAt(i) > limit) continue;
      const { x, y } = position(i);
      sumX += x;
      sumY += y;
      count += 1;
    }
    const middleX = sumX / Math.max(1, count);
    const middleY = sumY / Math.max(1, count);

    let best = { x: middleX, y: middleY };
    let bestGap = Infinity;
    for (let i = 0; i < buf.length; i += 4) {
      if (buf[i + 3] < 128 || distanceAt(i) > limit) continue;
      const { x, y } = position(i);
      const gap = (x - middleX) ** 2 + (y - middleY) ** 2;
      if (gap < bestGap) {
        bestGap = gap;
        best = { x, y };
      }
    }

    const clamp = (value: number) => Math.max(0.04, Math.min(0.96, value));
    return { x: clamp((best.x + 0.5) / width), y: clamp((best.y + 0.5) / height) };
  });
}

/**
 * Analyze a file in the browser: a 512px copy gives the same result for the same
 * image and settings. Throws when the file can't be decoded.
 */
export async function analyzeImage(
  file: File,
  colorCount: number,
): Promise<{ palette: Palette; locations: ColorLocation[] }> {
  const maxColors = Math.max(MIN_IMAGE_COLORS, Math.min(MAX_IMAGE_COLORS, colorCount));
  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const palette = extractFromImageData(imageData, maxColors);
  return { palette, locations: locateColors(imageData, palette) };
}

/** Convenience re-export so callers can turn an rgb into hsl for display. */
export { rgbToHsl };
