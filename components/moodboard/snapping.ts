// -----------------------------------------------------------------------------
// @file: components/moodboard/snapping.ts
// @purpose: Alignment while moving objects, as in FigJam: the moving box's
//           left, centre and right line up with another object's left, centre
//           or right (and the same for top, middle, bottom) once they come
//           within a few screen pixels, and the matching guide lines are
//           returned for drawing. Pure functions, in canvas units.
// -----------------------------------------------------------------------------

export type Box = { x: number; y: number; width: number; height: number };

/** A guide line in canvas units: vertical at `at` from `from` to `to`, or horizontal. */
export type Guide = { axis: "x" | "y"; at: number; from: number; to: number };

/** How close, in screen pixels, an edge has to come before it snaps. */
export const SNAP_SCREEN_PX = 6;

const xLines = (b: Box) => [b.x, b.x + b.width / 2, b.x + b.width];
const yLines = (b: Box) => [b.y, b.y + b.height / 2, b.y + b.height];

/** The smallest box around all of these. */
export function unionBox(boxes: Box[]): Box | null {
  if (boxes.length === 0) return null;
  const left = Math.min(...boxes.map((b) => b.x));
  const top = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.width));
  const bottom = Math.max(...boxes.map((b) => b.y + b.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** The closest line-up on one axis within `threshold`, as the shift that makes it. */
function bestShift(moving: number[], others: number[][], threshold: number): number | null {
  let best: number | null = null;
  for (const lines of others) {
    for (const target of lines) {
      for (const line of moving) {
        const shift = target - line;
        if (Math.abs(shift) <= threshold && (best === null || Math.abs(shift) < Math.abs(best))) {
          best = shift;
        }
      }
    }
  }
  return best;
}

/**
 * Snaps `moving` (already at its dragged position) to `others`. Returns the
 * extra shift to apply, and the guides for every line that now matches, each
 * spanning the moving box and the objects it lines up with.
 */
export function snapBox(
  moving: Box,
  others: Box[],
  threshold: number,
): { dx: number; dy: number; guides: Guide[] } {
  const dx = bestShift(xLines(moving), others.map(xLines), threshold) ?? 0;
  const dy = bestShift(yLines(moving), others.map(yLines), threshold) ?? 0;
  const snapped = { ...moving, x: moving.x + dx, y: moving.y + dy };

  // Float noise must not hide a guide for lines that do meet.
  const same = (a: number, b: number) => Math.abs(a - b) < 0.01;
  const guides: Guide[] = [];
  for (const axis of ["x", "y"] as const) {
    const mine = axis === "x" ? xLines(snapped) : yLines(snapped);
    for (const at of mine) {
      const matching = others.filter((o) =>
        (axis === "x" ? xLines(o) : yLines(o)).some((l) => same(l, at)),
      );
      if (matching.length === 0) continue;
      const span = [snapped, ...matching];
      guides.push(
        axis === "x"
          ? {
              axis,
              at,
              from: Math.min(...span.map((b) => b.y)),
              to: Math.max(...span.map((b) => b.y + b.height)),
            }
          : {
              axis,
              at,
              from: Math.min(...span.map((b) => b.x)),
              to: Math.max(...span.map((b) => b.x + b.width)),
            },
      );
    }
  }
  return { dx, dy, guides };
}
