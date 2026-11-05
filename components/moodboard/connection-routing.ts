// -----------------------------------------------------------------------------
// @file: components/moodboard/connection-routing.ts
// @purpose: Where an arrow between two objects runs: straight when they line up,
//           one bend when they're diagonal, two when they face each other, and
//           never through either object. Pure, so it can be tested on its own.
// -----------------------------------------------------------------------------

export type Side = "top" | "right" | "bottom" | "left";
export type Point = { x: number; y: number };
export type RouteRect = { x: number; y: number; w: number; h: number };
export type Route = { points: Point[]; source: Side; target: Side };

/** Space an object needs around it before an arrow can leave from that side. */
const MIN_GAP = 24;
/** Gap needed on both axes before a single-bend elbow reads well. */
const ELBOW_GAP = 40;
/** Centers this close count as lined up, so the arrow is drawn straight. */
const ALIGN_TOLERANCE = 12;
const START_INSET = 2;
const END_INSET = 6;

const center = (r: RouteRect): Point => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

function anchor(r: RouteRect, side: Side): Point {
  const c = center(r);
  if (side === "top") return { x: c.x, y: r.y };
  if (side === "bottom") return { x: c.x, y: r.y + r.h };
  if (side === "left") return { x: r.x, y: c.y };
  return { x: r.x + r.w, y: c.y };
}

/** Move a point away from an object's side, so the line doesn't touch its edge. */
function inset(p: Point, side: Side, by: number): Point {
  if (side === "top") return { x: p.x, y: p.y - by };
  if (side === "bottom") return { x: p.x, y: p.y + by };
  if (side === "left") return { x: p.x - by, y: p.y };
  return { x: p.x + by, y: p.y };
}

function finish(source: Side, target: Side, s: Point, t: Point, middle: Point[]): Route {
  return {
    source,
    target,
    points: [inset(s, source, START_INSET), ...middle, inset(t, target, END_INSET)],
  };
}

export function routeConnection(a: RouteRect, b: RouteRect): Route {
  const ca = center(a);
  const cb = center(b);

  const toRight = cb.x >= ca.x;
  const below = cb.y >= ca.y;
  const gapX = toRight ? b.x - (a.x + a.w) : a.x - (b.x + b.w);
  const gapY = below ? b.y - (a.y + a.h) : a.y - (b.y + b.h);

  const horizontal: [Side, Side] = toRight ? ["right", "left"] : ["left", "right"];
  const vertical: [Side, Side] = below ? ["bottom", "top"] : ["top", "bottom"];

  // Diagonal with room on both axes: leave along the longer axis, one bend.
  if (gapX >= ELBOW_GAP && gapY >= ELBOW_GAP) {
    if (gapX >= gapY) {
      const [source] = horizontal;
      const target = vertical[1];
      const s = anchor(a, source);
      const t = anchor(b, target);
      return finish(source, target, s, t, [{ x: t.x, y: s.y }]);
    }
    const [source] = vertical;
    const target = horizontal[1];
    const s = anchor(a, source);
    const t = anchor(b, target);
    return finish(source, target, s, t, [{ x: s.x, y: t.y }]);
  }

  // Side by side: straight if they line up, otherwise a bend halfway between.
  if (gapX >= MIN_GAP && gapX >= gapY) {
    const [source, target] = horizontal;
    const s = anchor(a, source);
    const t = anchor(b, target);
    if (Math.abs(s.y - t.y) <= ALIGN_TOLERANCE) {
      return finish(source, target, s, { x: t.x, y: s.y }, []);
    }
    const midX = (s.x + t.x) / 2;
    return finish(source, target, s, t, [
      { x: midX, y: s.y },
      { x: midX, y: t.y },
    ]);
  }

  // One above the other.
  if (gapY >= MIN_GAP) {
    const [source, target] = vertical;
    const s = anchor(a, source);
    const t = anchor(b, target);
    if (Math.abs(s.x - t.x) <= ALIGN_TOLERANCE) {
      return finish(source, target, s, { x: s.x, y: t.y }, []);
    }
    const midY = (s.y + t.y) / 2;
    return finish(source, target, s, t, [
      { x: s.x, y: midY },
      { x: t.x, y: midY },
    ]);
  }

  // Touching or overlapping: no room for bends, so a short direct line.
  const [source, target] = Math.abs(cb.x - ca.x) >= Math.abs(cb.y - ca.y) ? horizontal : vertical;
  return { source, target, points: [anchor(a, source), anchor(b, target)] };
}

/** An SVG path through the points, with rounded corners. */
export function roundedPath(points: Point[], radius = 16): string {
  if (points.length < 2) return "";
  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    const inLength = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    const outLength = Math.hypot(next.x - curr.x, next.y - curr.y);
    if (inLength === 0 || outLength === 0) continue;

    const r = Math.min(radius, inLength / 2, outLength / 2);
    const startX = curr.x - ((curr.x - prev.x) / inLength) * r;
    const startY = curr.y - ((curr.y - prev.y) / inLength) * r;
    const endX = curr.x + ((next.x - curr.x) / outLength) * r;
    const endY = curr.y + ((next.y - curr.y) / outLength) * r;
    d += ` L ${startX} ${startY} Q ${curr.x} ${curr.y} ${endX} ${endY}`;
  }

  const last = points[points.length - 1];
  return `${d} L ${last.x} ${last.y}`;
}

/** The point halfway along the line, for the delete button and labels. */
export function routeMidpoint(points: Point[]): Point {
  const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
  let remaining = lengths.reduce((sum, l) => sum + l, 0) / 2;
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i] && lengths[i] > 0) {
      const t = remaining / lengths[i];
      return {
        x: points[i].x + (points[i + 1].x - points[i].x) * t,
        y: points[i].y + (points[i + 1].y - points[i].y) * t,
      };
    }
    remaining -= lengths[i];
  }
  return points[0];
}
