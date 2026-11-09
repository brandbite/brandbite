// -----------------------------------------------------------------------------
// @file: lib/sizes/template.ts
// @purpose: Draws a blank, correctly sized PNG template for one format, with
//           the platform's safe zones marked, entirely in the browser.
// -----------------------------------------------------------------------------

import type { SafeZone, SizeFormat } from "./types";

export type Rect = { x: number; y: number; width: number; height: number };

/** The areas platform UI may cover, as rectangles on the full-size canvas. */
export function coveredAreas(width: number, height: number, zone?: SafeZone): Rect[] {
  if (!zone) return [];
  if (zone.kind === "centre") {
    const x = Math.max(0, Math.round((width - zone.width) / 2));
    const y = Math.max(0, Math.round((height - zone.height) / 2));
    return [
      { x: 0, y: 0, width, height: y },
      { x: 0, y: y + zone.height, width, height: height - y - zone.height },
      { x: 0, y, width: x, height: zone.height },
      { x: x + zone.width, y, width: width - x - zone.width, height: zone.height },
    ].filter((rect) => rect.width > 0 && rect.height > 0);
  }
  const rects: Rect[] = [];
  if (zone.top) rects.push({ x: 0, y: 0, width, height: zone.top });
  if (zone.bottom) rects.push({ x: 0, y: height - zone.bottom, width, height: zone.bottom });
  if (zone.left) rects.push({ x: 0, y: 0, width: zone.left, height });
  if (zone.right) rects.push({ x: width - zone.right, y: 0, width: zone.right, height });
  return rects;
}

export function templateFileName(platformSlug: string, format: SizeFormat): string {
  return `brandbite-${platformSlug}-${format.id}-${format.width}x${format.height}.png`;
}

const FONT = '"Plus Jakarta Sans Variable", "Plus Jakarta Sans", system-ui, sans-serif';

/** Renders the template and returns it as a PNG blob. */
export async function renderTemplate(
  platformName: string,
  format: SizeFormat,
): Promise<Blob | null> {
  const { width, height } = format;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#f7f5f2";
  ctx.fillRect(0, 0, width, height);

  // Covered areas: tinted, with a dashed edge toward the safe area.
  const unit = Math.max(2, Math.round(Math.min(width, height) / 400));
  ctx.fillStyle = "rgba(255, 100, 38, 0.14)";
  ctx.strokeStyle = "rgba(194, 65, 12, 0.7)";
  ctx.lineWidth = unit;
  ctx.setLineDash([unit * 6, unit * 4]);
  for (const rect of coveredAreas(width, height, format.safeZone)) {
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
  }
  ctx.setLineDash([]);

  const base = Math.min(width, height);
  const big = Math.max(14, Math.round(base / 12));
  const small = Math.max(10, Math.round(base / 28));
  const centreX = width / 2;
  const centreY = height / 2;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#242528";
  ctx.font = `800 ${big}px ${FONT}`;
  ctx.fillText(`${width} × ${height}`, centreX, centreY - big * 0.45, width * 0.9);
  ctx.fillStyle = "#6c6d75";
  ctx.font = `500 ${small}px ${FONT}`;
  ctx.fillText(`${platformName} · ${format.name}`, centreX, centreY + big * 0.55, width * 0.9);
  ctx.fillText("brandbite.studio/sizes", centreX, centreY + big * 0.55 + small * 1.6, width * 0.9);

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
}
