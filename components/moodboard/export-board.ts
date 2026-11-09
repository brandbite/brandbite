// -----------------------------------------------------------------------------
// @file: components/moodboard/export-board.ts
// @purpose: Download a moodboard as a PNG or a one-page PDF, made in the
//           browser: html-to-image (loaded only when someone exports) draws
//           the board's own DOM onto a canvas, and the PDF wraps that image
//           as a JPEG with no PDF library. Nothing runs on the server.
// -----------------------------------------------------------------------------

export type ExportFormat = "png" | "pdf";

type Box = { x: number; y: number; width: number; height: number };

/** Space around the objects in the picture, in canvas units. */
export const EXPORT_PADDING = 48;

/** Longest side of the picture in pixels; browsers refuse much larger canvases. */
const MAX_SIDE_PX = 8000;

/** The area to draw: every object, plus padding. Null for an empty board. */
export function exportBounds(boxes: Box[], padding = EXPORT_PADDING): Box | null {
  if (boxes.length === 0) return null;
  const left = Math.min(...boxes.map((b) => b.x)) - padding;
  const top = Math.min(...boxes.map((b) => b.y)) - padding;
  const right = Math.max(...boxes.map((b) => b.x + b.width)) + padding;
  const bottom = Math.max(...boxes.map((b) => b.y + b.height)) + padding;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** Sharp on high-density screens, but never past what a canvas can hold. */
export function exportPixelRatio(bounds: Box): number {
  return Math.min(2, MAX_SIDE_PX / Math.max(bounds.width, bounds.height));
}

/** Controls drawn over the board that don't belong in the picture. */
function keepNode(node: unknown): boolean {
  if (!(node instanceof Element)) return true;
  if (node.tagName === "IFRAME") return false;
  return !(
    node.hasAttribute("data-mb-handle") ||
    node.hasAttribute("data-mb-connector") ||
    node.hasAttribute("data-mb-card-toolbar") ||
    node.hasAttribute("data-mb-guide")
  );
}

/** Light grey square for a picture that can't be read (a broken or blocked link). */
const MISSING_IMAGE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/58BAwAI/AL+hc2rNAAAAABJRU5ErkJggg==";

/**
 * Draws the board's world layer (the element holding every object, in canvas
 * units) as an image file. `world` keeps its on-screen pan and zoom; the copy
 * that's drawn is moved so `bounds` starts at the top left.
 */
export async function renderBoard(
  world: HTMLElement,
  bounds: Box,
  format: ExportFormat,
): Promise<Blob> {
  const { toCanvas } = await import("html-to-image");
  const canvas = await toCanvas(world, {
    width: bounds.width,
    height: bounds.height,
    pixelRatio: exportPixelRatio(bounds),
    backgroundColor: "#ffffff",
    imagePlaceholder: MISSING_IMAGE,
    filter: keepNode,
    style: {
      transform: `translate(${-bounds.x}px, ${-bounds.y}px)`,
      width: `${bounds.width}px`,
      height: `${bounds.height}px`,
      visibility: "visible",
      // Outlines and labels drawn at screen size come out at their real size.
      ["--mb-inverse-zoom" as string]: "1",
    } as Partial<CSSStyleDeclaration>,
  });

  if (format === "png") return canvasBlob(canvas, "image/png");
  const jpeg = new Uint8Array(await (await canvasBlob(canvas, "image/jpeg", 0.92)).arrayBuffer());
  // 96 px to the inch on screen, 72 points to the inch on paper.
  const pdf = jpegToPdf(
    jpeg,
    canvas.width,
    canvas.height,
    bounds.width * 0.75,
    bounds.height * 0.75,
  );
  return new Blob([pdf as BlobPart], { type: "application/pdf" });
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("The picture couldn't be made."))),
      type,
      quality,
    ),
  );
}

/** PDF pages can't be larger than 200 inches a side. */
const MAX_PAGE_PT = 14400;

/**
 * A one-page PDF showing a JPEG across the whole page. `pageWidth` and
 * `pageHeight` are in points and scaled down together if over the PDF limit.
 */
export function jpegToPdf(
  jpeg: Uint8Array,
  pixelWidth: number,
  pixelHeight: number,
  pageWidth: number,
  pageHeight: number,
): Uint8Array {
  const shrink = Math.min(1, MAX_PAGE_PT / Math.max(pageWidth, pageHeight));
  const w = (pageWidth * shrink).toFixed(2);
  const h = (pageHeight * shrink).toFixed(2);
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (chunk: Uint8Array | string) => {
    const bytes = typeof chunk === "string" ? encoder.encode(chunk) : chunk;
    parts.push(bytes);
    length += bytes.length;
  };
  const object = (body: string) => {
    offsets.push(length);
    push(`${offsets.length} 0 obj\n${body}\nendobj\n`);
  };

  push("%PDF-1.4\n");
  object("<< /Type /Catalog /Pages 2 0 R >>");
  object("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  object(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
  );
  offsets.push(length);
  push(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${pixelWidth} /Height ${pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
  );
  push(jpeg);
  push("\nendstream\nendobj\n");
  const content = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;
  object(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);

  const xref = length;
  push(`xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n`);
  for (const offset of offsets) push(`${String(offset).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** A safe file name from the board's title. */
export function exportFileName(title: string, format: ExportFormat): string {
  const base =
    title
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "")
      .replace(/\s+/g, " ")
      .slice(0, 80) || "moodboard";
  return `${base}.${format}`;
}
