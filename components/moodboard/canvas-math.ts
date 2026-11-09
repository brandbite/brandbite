// -----------------------------------------------------------------------------
// @file: components/moodboard/canvas-math.ts
// @purpose: Pure geometry for the moodboard canvas: wheel input, zoom around a
//           point, fit to content, grid spacing.
// -----------------------------------------------------------------------------

import { CANVAS_DEFAULTS } from "@/lib/moodboard";

const { MIN_ZOOM, MAX_ZOOM } = CANVAS_DEFAULTS;

export type CanvasTransform = { panX: number; panY: number; zoom: number };
export type CanvasRect = { x: number; y: number; width: number; height: number };

const LINE_HEIGHT_PX = 16;
const PAGE_HEIGHT_PX = 800;
/** A mouse notch reports ~100 and a pinch ~5; the clamp keeps a notch to one step. */
const MAX_ZOOM_DELTA = 20;
const ZOOM_SENSITIVITY = 0.01;
const GRID_BASE_PX = 24;
const GRID_MIN_PX = 14;

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** Wheel deltas in pixels, whatever unit the device reported them in. */
export function wheelDeltaPx(delta: number, deltaMode: number): number {
  if (deltaMode === 1) return delta * LINE_HEIGHT_PX;
  if (deltaMode === 2) return delta * PAGE_HEIGHT_PX;
  return delta;
}

/** Proportional, so each step feels the same at any zoom level. */
export function wheelZoomFactor(deltaPx: number): number {
  const delta = Math.max(-MAX_ZOOM_DELTA, Math.min(MAX_ZOOM_DELTA, deltaPx));
  return Math.exp(-delta * ZOOM_SENSITIVITY);
}

/** Change zoom while keeping the canvas point under (x, y) where it is. */
export function zoomAtPoint(
  t: CanvasTransform,
  nextZoom: number,
  x: number,
  y: number,
): CanvasTransform {
  const zoom = clampZoom(nextZoom);
  const scale = zoom / t.zoom;
  return { panX: x - (x - t.panX) * scale, panY: y - (y - t.panY) * scale, zoom };
}

/** Everything in view, centered, never zoomed in past 100%. */
export function fitTransform(
  rects: CanvasRect[],
  viewportWidth: number,
  viewportHeight: number,
  padding = 60,
): CanvasTransform {
  if (rects.length === 0) return { panX: 0, panY: 0, zoom: 1 };

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rects) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + (r.height || 200));
  }

  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const zoom = clampZoom(
    Math.min((viewportWidth - padding * 2) / width, (viewportHeight - padding * 2) / height, 1),
  );

  return {
    panX: (viewportWidth - width * zoom) / 2 - minX * zoom,
    panY: (viewportHeight - height * zoom) / 2 - minY * zoom,
    zoom,
  };
}

/** Whether `inner` lies wholly within `outer`. */
export function rectInside(
  inner: { x: number; y: number; width: number; height: number },
  outer: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

export function rectsIntersect(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** A drawing's path, moved. Every number in it is an x then a y, in canvas units. */
export function shiftPath(pathData: string, dx: number, dy: number): string {
  let isX = true;
  return pathData.replace(/-?\d+(?:\.\d+)?(?:e-?\d+)?/gi, (value) => {
    const moved = parseFloat(value) + (isX ? dx : dy);
    isX = !isX;
    return String(Math.round(moved * 100) / 100);
  });
}

/** Dot spacing on screen: doubles when zoomed out so the grid never turns to noise. */
export function gridSpacing(zoom: number): number {
  let spacing = GRID_BASE_PX * zoom;
  while (spacing < GRID_MIN_PX) spacing *= 2;
  while (spacing > GRID_MIN_PX * 4) spacing /= 2;
  return spacing;
}

/** Where a card lands after a resize from one corner, respecting minimum size. */
export function resizeFromCorner(
  start: CanvasRect,
  corner: "nw" | "ne" | "sw" | "se",
  dx: number,
  dy: number,
  minWidth: number,
  minHeight: number,
): CanvasRect {
  const fromLeft = corner === "nw" || corner === "sw";
  const fromTop = corner === "nw" || corner === "ne";
  const width = Math.max(minWidth, start.width + (fromLeft ? -dx : dx));
  const height = Math.max(minHeight, start.height + (fromTop ? -dy : dy));
  return {
    x: fromLeft ? start.x + start.width - width : start.x,
    y: fromTop ? start.y + start.height - height : start.y,
    width,
    height,
  };
}
