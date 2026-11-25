// -----------------------------------------------------------------------------
// @file: lib/image-tools/fit.ts
// @purpose: The arithmetic behind the browser image tools (social resizer,
//           image converter): where an image lands on a canvas of another
//           shape, what a result is called and how sizes are written. Pure,
//           so it is tested without a browser.
// -----------------------------------------------------------------------------

export type Rect = { x: number; y: number; width: number; height: number };

/**
 * Fill the target completely and cut what doesn't fit, evenly from both
 * sides. Returns the part of the source to draw.
 */
export function coverSource(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): Rect {
  const sourceAspect = sourceWidth / sourceHeight;
  const targetAspect = targetWidth / targetHeight;
  if (sourceAspect > targetAspect) {
    const width = sourceHeight * targetAspect;
    return { x: (sourceWidth - width) / 2, y: 0, width, height: sourceHeight };
  }
  const height = sourceWidth / targetAspect;
  return { x: 0, y: (sourceHeight - height) / 2, width: sourceWidth, height };
}

/**
 * Which part of the image a size keeps. `x` and `y` say where the kept part
 * sits within the room it has to move: 0 is hard left or top, 1 hard right or
 * bottom, 0.5 the middle. `zoom` 1 keeps as much as fits; 2 keeps half of that.
 */
export type CropAdjust = { x: number; y: number; zoom: number };

export const DEFAULT_CROP: CropAdjust = { x: 0.5, y: 0.5, zoom: 1 };
export const MAX_CROP_ZOOM = 3;

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);

function saneCrop(crop: CropAdjust): CropAdjust {
  return {
    x: clamp01(Number.isFinite(crop.x) ? crop.x : 0.5),
    y: clamp01(Number.isFinite(crop.y) ? crop.y : 0.5),
    zoom: Math.min(Math.max(Number.isFinite(crop.zoom) ? crop.zoom : 1, 1), MAX_CROP_ZOOM),
  };
}

/** The part of the source a chosen crop keeps. With DEFAULT_CROP it is `coverSource`. */
export function cropSource(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  crop: CropAdjust = DEFAULT_CROP,
): Rect {
  const { x, y, zoom } = saneCrop(crop);
  const full = coverSource(sourceWidth, sourceHeight, targetWidth, targetHeight);
  const width = full.width / zoom;
  const height = full.height / zoom;
  return { x: (sourceWidth - width) * x, y: (sourceHeight - height) * y, width, height };
}

/**
 * The same crop as CSS background numbers (all in percent), for a box of the
 * target's shape: how large the image is drawn and where it is placed.
 */
export function cropBackground(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  crop: CropAdjust = DEFAULT_CROP,
): { sizeX: number; sizeY: number; positionX: number; positionY: number } {
  const { x, y } = saneCrop(crop);
  const rect = cropSource(sourceWidth, sourceHeight, targetWidth, targetHeight, crop);
  return {
    sizeX: (sourceWidth / rect.width) * 100,
    sizeY: (sourceHeight / rect.height) * 100,
    positionX: x * 100,
    positionY: y * 100,
  };
}

/**
 * A crop after dragging the image by a share of the frame (`dx` 0.1 = a tenth
 * of the frame's width to the right). Dragging right shows more of the left.
 */
export function panCrop(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  crop: CropAdjust,
  dx: number,
  dy: number,
): CropAdjust {
  const current = saneCrop(crop);
  const rect = cropSource(sourceWidth, sourceHeight, targetWidth, targetHeight, current);
  // Room to move, measured in frames: an image twice the frame's width has one frame of room.
  const roomX = sourceWidth / rect.width - 1;
  const roomY = sourceHeight / rect.height - 1;
  return {
    ...current,
    x: roomX > 1e-9 ? clamp01(current.x - dx / roomX) : current.x,
    y: roomY > 1e-9 ? clamp01(current.y - dy / roomY) : current.y,
  };
}

/**
 * Show the whole image inside the target, centered, with room left over on
 * two sides. Returns where on the target to draw it.
 */
export function containTarget(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): Rect {
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return { x: (targetWidth - width) / 2, y: (targetHeight - height) / 2, width, height };
}

/** New size when an image may be no wider than `maxWidth`; never scales up. */
export function limitWidth(
  width: number,
  height: number,
  maxWidth: number | null,
): { width: number; height: number } {
  if (!maxWidth || !(maxWidth > 0) || width <= maxWidth) return { width, height };
  return {
    width: Math.round(maxWidth),
    height: Math.max(1, Math.round((height * maxWidth) / width)),
  };
}

export type OutputFormat = "png" | "jpeg" | "webp";

export const OUTPUT_FORMATS: {
  id: OutputFormat;
  label: string;
  mime: string;
  extension: string;
}[] = [
  { id: "jpeg", label: "JPG", mime: "image/jpeg", extension: "jpg" },
  { id: "png", label: "PNG", mime: "image/png", extension: "png" },
  { id: "webp", label: "WebP", mime: "image/webp", extension: "webp" },
];

export function outputFormat(id: OutputFormat) {
  return OUTPUT_FORMATS.find((format) => format.id === id) ?? OUTPUT_FORMATS[0];
}

/** PNG keeps every pixel as it is, so it has no quality setting. */
export function hasQuality(id: OutputFormat): boolean {
  return id !== "png";
}

/** JPG has no transparency: see-through areas need a color behind them. */
export function needsBackdrop(id: OutputFormat): boolean {
  return id === "jpeg";
}

/** "photo.final.PNG" + "webp" → "photo.final.webp". */
export function renameWithExtension(fileName: string, extension: string): string {
  const dot = fileName.lastIndexOf(".");
  const stem = (dot > 0 ? fileName.slice(0, dot) : fileName).trim() || "image";
  return `${stem}.${extension}`;
}

/** Lowercase letters, digits and dashes, for file names built from labels. */
export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "image"
  );
}

/** Give each name in a zip its own spot: a repeat gets "-2", "-3", … before the extension. */
export function uniqueNames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const count = (seen.get(name) ?? 0) + 1;
    seen.set(name, count);
    if (count === 1) return name;
    const dot = name.lastIndexOf(".");
    return dot > 0 ? `${name.slice(0, dot)}-${count}${name.slice(dot)}` : `${name}-${count}`;
  });
}

/** "842 KB", "1.4 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** How a new size compares: "38% smaller", "12% larger", "same size". */
export function sizeChange(before: number, after: number): string {
  if (!(before > 0)) return "";
  const percent = Math.round(((after - before) / before) * 100);
  if (percent === 0) return "same size";
  return percent < 0 ? `${-percent}% smaller` : `${percent}% larger`;
}

/** Images the tools read, and the largest file they take. */
export const INPUT_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const INPUT_IMAGE_MAX_BYTES = 25 * 1024 * 1024;

/** Why a chosen file can't be used, or null when it can. */
export function inputImageProblem(file: { type: string; size: number }): string | null {
  if (!INPUT_IMAGE_TYPES.includes(file.type)) return "Use a PNG, JPG or WebP image.";
  if (file.size > INPUT_IMAGE_MAX_BYTES) return "That image is over 25 MB. Use a smaller one.";
  return null;
}
