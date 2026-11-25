// -----------------------------------------------------------------------------
// @file: lib/gradient/gradient.ts
// @purpose: The gradient generator's model: color stops, the CSS that draws
//           them, and the same gradient's geometry for a canvas (so the PNG
//           download matches the CSS preview). Pure.
// -----------------------------------------------------------------------------

import { hexToRgb, normalizeHex, rgbToHex } from "@/lib/colors/convert";

export type GradientKind = "linear" | "radial";
export type GradientStop = { id: string; color: string; position: number };
export type Gradient = { kind: GradientKind; angle: number; stops: GradientStop[] };

export const MIN_STOPS = 2;
export const MAX_STOPS = 6;

export const GRADIENT_SIZES = [
  { id: "wide", label: "1920 × 1080", width: 1920, height: 1080 },
  { id: "square", label: "1080 × 1080", width: 1080, height: 1080 },
  { id: "tall", label: "1080 × 1920", width: 1080, height: 1920 },
] as const;

export type GradientSizeId = (typeof GRADIENT_SIZES)[number]["id"];

let counter = 0;
const nextId = () => `stop-${++counter}`;

/** A gradient from a list of colors, spread evenly. */
export function gradientFromColors(colors: string[], kind: GradientKind = "linear"): Gradient {
  const valid = colors
    .map((color) => normalizeHex(color))
    .filter((c): c is NonNullable<typeof c> => !!c);
  const list = valid.length >= MIN_STOPS ? valid.slice(0, MAX_STOPS) : ["#fe5000", "#f0edff"];
  return {
    kind,
    angle: 135,
    stops: list.map((color, index) => ({
      id: nextId(),
      color,
      position: Math.round((index / (list.length - 1)) * 100),
    })),
  };
}

/** Stops in the order they are drawn. */
export function sortedStops(gradient: Gradient): GradientStop[] {
  return [...gradient.stops].sort((a, b) => a.position - b.position);
}

/** The color partway between two, mixed channel by channel. */
export function mixColors(a: string, b: string, amount: number): string {
  const from = hexToRgb(a);
  const to = hexToRgb(b);
  const t = Math.min(Math.max(amount, 0), 1);
  return rgbToHex({
    r: Math.round(from.r + (to.r - from.r) * t),
    g: Math.round(from.g + (to.g - from.g) * t),
    b: Math.round(from.b + (to.b - from.b) * t),
  });
}

/** Add a stop in the middle of the widest gap, colored halfway between its neighbors. */
export function addStop(gradient: Gradient): Gradient {
  if (gradient.stops.length >= MAX_STOPS) return gradient;
  const stops = sortedStops(gradient);
  let widest = 0;
  for (let i = 1; i < stops.length - 1; i++) {
    if (
      stops[i + 1].position - stops[i].position >
      stops[widest + 1].position - stops[widest].position
    ) {
      widest = i;
    }
  }
  const left = stops[widest];
  const right = stops[widest + 1];
  const added: GradientStop = {
    id: nextId(),
    color: mixColors(left.color, right.color, 0.5),
    position: Math.round((left.position + right.position) / 2),
  };
  return { ...gradient, stops: [...gradient.stops, added] };
}

export function removeStop(gradient: Gradient, id: string): Gradient {
  if (gradient.stops.length <= MIN_STOPS) return gradient;
  return { ...gradient, stops: gradient.stops.filter((stop) => stop.id !== id) };
}

export function updateStop(
  gradient: Gradient,
  id: string,
  change: Partial<Pick<GradientStop, "color" | "position">>,
): Gradient {
  return {
    ...gradient,
    stops: gradient.stops.map((stop) =>
      stop.id === id
        ? {
            ...stop,
            ...change,
            position:
              change.position === undefined
                ? stop.position
                : Math.min(Math.max(Math.round(change.position), 0), 100),
          }
        : stop,
    ),
  };
}

/** Keep an angle within 0..359. */
export function normalizeAngle(angle: number): number {
  return ((Math.round(angle) % 360) + 360) % 360;
}

/** The gradient as a CSS value: `linear-gradient(135deg, #fe5000 0%, #f0edff 100%)`. */
export function gradientCss(gradient: Gradient): string {
  const stops = sortedStops(gradient)
    .map((stop) => `${stop.color} ${stop.position}%`)
    .join(", ");
  return gradient.kind === "linear"
    ? `linear-gradient(${normalizeAngle(gradient.angle)}deg, ${stops})`
    : `radial-gradient(circle farthest-corner at center, ${stops})`;
}

/** A ready-to-paste CSS rule body. */
export function gradientDeclaration(gradient: Gradient): string {
  const first = sortedStops(gradient)[0]?.color ?? "#ffffff";
  // A plain color first, for anything that can't draw the gradient.
  return `background: ${first};\nbackground: ${gradientCss(gradient)};`;
}

/**
 * Where a CSS linear gradient starts and ends on a box, in pixels. CSS angles
 * run clockwise from "to top", and the line is long enough that the corners
 * get exactly the first and last colors.
 */
export function linearGradientLine(
  width: number,
  height: number,
  angle: number,
): { x0: number; y0: number; x1: number; y1: number } {
  const radians = (normalizeAngle(angle) * Math.PI) / 180;
  const dx = Math.sin(radians);
  const dy = -Math.cos(radians);
  const half = (Math.abs(width * dx) + Math.abs(height * dy)) / 2;
  const cx = width / 2;
  const cy = height / 2;
  return { x0: cx - dx * half, y0: cy - dy * half, x1: cx + dx * half, y1: cy + dy * half };
}

/** The radius of a "circle farthest-corner at center" radial gradient. */
export function radialGradientRadius(width: number, height: number): number {
  return Math.hypot(width / 2, height / 2);
}

export function gradientFileName(width: number, height: number): string {
  return `brandbite-gradient-${width}x${height}.png`;
}
