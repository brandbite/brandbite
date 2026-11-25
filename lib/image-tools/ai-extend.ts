// -----------------------------------------------------------------------------
// @file: lib/image-tools/ai-extend.ts
// @purpose: The plan for "Resize with AI" in the social resizer. Instead of
//           cutting a design to fit a size, the image model is asked to lay
//           the same design out again on a canvas of that shape: same text,
//           same logo, same photo, spread across the new canvas.
//
//           This file decides the canvas to ask for and what the model is
//           told. Pure; shared by the browser and the route.
// -----------------------------------------------------------------------------

/** AI resizes a company may run in any 24 hours. They cost money per image and no tokens. */
export const AI_EXTEND_DAILY_LIMIT = 10;
export const AI_EXTEND_WINDOW_SECONDS = 24 * 60 * 60;

/** What the browser may send: the design, scaled down to travel quickly. */
export const AI_IMAGE_TYPES = ["image/png", "image/webp", "image/jpeg"];
export const AI_IMAGE_MAX_BYTES = 4 * 1024 * 1024;
/** The design is sent no larger than this on its long edge. */
export const AI_UPLOAD_EDGE = 1536;

/** Target sizes the route accepts. */
export const AI_TARGET_MIN = 64;
export const AI_TARGET_MAX = 8000;

/** The model's limits on a canvas it draws (current GPT Image models). */
const MODEL_EDGE_STEP = 16;
const MODEL_LONG_EDGE = 1536;
const MODEL_MAX_RATIO = 3;

/** The three sizes every GPT Image model takes, for models that take no others. */
export const AI_FALLBACK_SIZES = [
  { width: 1024, height: 1024 },
  { width: 1536, height: 1024 },
  { width: 1024, height: 1536 },
] as const;

export type Canvas = { width: number; height: number };

export const canvasId = (canvas: Canvas) => `${canvas.width}x${canvas.height}`;

const step = (value: number) =>
  Math.max(MODEL_EDGE_STEP, Math.round(value / MODEL_EDGE_STEP) * MODEL_EDGE_STEP);

/**
 * The canvas to ask the model for: the target's own shape, as closely as the
 * model's rules allow (edges in steps of 16, no shape past 3:1).
 */
export function aiCanvas(targetWidth: number, targetHeight: number): Canvas {
  const ratio = Math.min(
    Math.max(targetWidth / targetHeight, 1 / MODEL_MAX_RATIO),
    MODEL_MAX_RATIO,
  );
  return ratio >= 1
    ? { width: MODEL_LONG_EDGE, height: step(MODEL_LONG_EDGE / ratio) }
    : { width: step(MODEL_LONG_EDGE * ratio), height: MODEL_LONG_EDGE };
}

/** The fixed size closest in shape to the target, for a model that refuses a custom canvas. */
export function fallbackCanvas(targetWidth: number, targetHeight: number): Canvas {
  const wanted = Math.log(targetWidth / targetHeight);
  return AI_FALLBACK_SIZES.reduce<Canvas>(
    (best, size) =>
      Math.abs(Math.log(size.width / size.height) - wanted) <
      Math.abs(Math.log(best.width / best.height) - wanted)
        ? size
        : best,
    AI_FALLBACK_SIZES[0],
  );
}

/**
 * When the canvas can't have the target's exact shape, the result is cut to
 * it afterwards. This is the share of the canvas that survives the cut, so
 * the model can be told to keep everything inside it.
 */
export function keptShare(canvas: Canvas, targetWidth: number, targetHeight: number) {
  const canvasRatio = canvas.width / canvas.height;
  const targetRatio = targetWidth / targetHeight;
  return canvasRatio > targetRatio
    ? { width: targetRatio / canvasRatio, height: 1 }
    : { width: 1, height: canvasRatio / targetRatio };
}

/** Shapes this far apart are worth an AI run; closer than this, cropping loses almost nothing. */
export function worthResizing(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): boolean {
  return Math.abs(Math.log(sourceWidth / sourceHeight / (targetWidth / targetHeight))) > 0.08;
}

function shapeWord(canvas: Canvas): string {
  const ratio = canvas.width / canvas.height;
  if (ratio > 1.15) return "wide landscape";
  if (ratio < 0.87) return "tall portrait";
  return "square";
}

/** What the model is told for a canvas and the size it will be cut to. */
export function aiResizePrompt(canvas: Canvas, targetWidth: number, targetHeight: number): string {
  const kept = keptShare(canvas, targetWidth, targetHeight);
  const lines = [
    `Adapt this exact design to a ${shapeWord(canvas)} canvas of ${canvas.width} by ${canvas.height} pixels.`,
    "Lay the existing content out again so it uses the whole canvas in a balanced way that suits this shape: reposition and resize the elements, and extend the background to fill the canvas edge to edge.",
    "Do not change the content itself. Keep every piece of text exactly as written, with the same wording, spelling, language, typeface, weight and colors. Keep every logo and graphic element identical. Keep any photographed person identical: the same face, expression, hair, clothing and pose.",
    "Keep the same visual style, colors and background treatment.",
    "Do not add any new text, objects, people, logos, borders or decorations, and do not remove anything.",
    "Nothing may be cut off: every element must be fully visible, with a comfortable margin from the canvas edges.",
  ];
  const widthPercent = Math.round(kept.width * 100);
  const heightPercent = Math.round(kept.height * 100);
  if (widthPercent < 98) {
    lines.push(
      `Important: only the middle ${widthPercent}% of the width will be shown; the strips at the left and right will be cut away. Keep all text, logos and people inside that middle part, and put only background in the outer strips.`,
    );
  }
  if (heightPercent < 98) {
    lines.push(
      `Important: only the middle ${heightPercent}% of the height will be shown; the strips at the top and bottom will be cut away. Keep all text, logos and people inside that middle part, and put only background in the outer strips.`,
    );
  }
  return lines.join(" ");
}

/** A target size as the route accepts it, or null. */
export function parseTarget(width: unknown, height: unknown): Canvas | null {
  const w = Number.parseInt(String(width), 10);
  const h = Number.parseInt(String(height), 10);
  const ok = (n: number) => Number.isInteger(n) && n >= AI_TARGET_MIN && n <= AI_TARGET_MAX;
  return ok(w) && ok(h) ? { width: w, height: h } : null;
}
