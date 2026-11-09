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

  const guides = [
    ...xLines(snapped).flatMap((at) => guideAt("x", at, snapped, others)),
    ...yLines(snapped).flatMap((at) => guideAt("y", at, snapped, others)),
  ];
  return { dx, dy, guides };
}

// Float noise must not hide a guide for lines that do meet.
const same = (a: number, b: number) => Math.abs(a - b) < 0.01;

/** The guide for one line of `box`, spanning it and every object on that line; none if no match. */
function guideAt(axis: "x" | "y", at: number, box: Box, others: Box[]): Guide[] {
  const matching = others.filter((o) =>
    (axis === "x" ? xLines(o) : yLines(o)).some((l) => same(l, at)),
  );
  if (matching.length === 0) return [];
  const span = [box, ...matching];
  return axis === "x"
    ? [
        {
          axis,
          at,
          from: Math.min(...span.map((b) => b.y)),
          to: Math.max(...span.map((b) => b.y + b.height)),
        },
      ]
    : [
        {
          axis,
          at,
          from: Math.min(...span.map((b) => b.x)),
          to: Math.max(...span.map((b) => b.x + b.width)),
        },
      ];
}

/**
 * Snaps the edges a resize is pulling (the dragged corner's two sides) to
 * nearby objects' lines, never below the minimum size. `rect` is the size
 * the pointer asks for.
 */
export function snapResize(
  rect: Box,
  corner: "nw" | "ne" | "sw" | "se",
  others: Box[],
  threshold: number,
  minWidth: number,
  minHeight: number,
): { box: Box; guides: Guide[] } {
  const fromLeft = corner === "nw" || corner === "sw";
  const fromTop = corner === "nw" || corner === "ne";
  let { x, y, width, height } = rect;

  const xEdge = fromLeft ? x : x + width;
  const sx = bestShift([xEdge], others.map(xLines), threshold);
  if (sx !== null) {
    const nextWidth = fromLeft ? width - sx : width + sx;
    if (nextWidth >= minWidth) {
      if (fromLeft) x += sx;
      width = nextWidth;
    }
  }

  const yEdge = fromTop ? y : y + height;
  const sy = bestShift([yEdge], others.map(yLines), threshold);
  if (sy !== null) {
    const nextHeight = fromTop ? height - sy : height + sy;
    if (nextHeight >= minHeight) {
      if (fromTop) y += sy;
      height = nextHeight;
    }
  }

  const box = { x, y, width, height };
  return {
    box,
    guides: [
      ...guideAt("x", fromLeft ? x : x + width, box, others),
      ...guideAt("y", fromTop ? y : y + height, box, others),
    ],
  };
}
