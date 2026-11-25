import { describe, expect, it } from "vitest";

import {
  addStop,
  gradientCss,
  gradientDeclaration,
  gradientFileName,
  gradientFromColors,
  linearGradientLine,
  MAX_STOPS,
  mixColors,
  normalizeAngle,
  radialGradientRadius,
  removeStop,
  sortedStops,
  updateStop,
} from "@/lib/gradient/gradient";

import {
  logoModules,
  QR_MARGIN,
  QR_MAX_LENGTH,
  qrColorWarning,
  qrMatrix,
  qrSvg,
  qrTextProblem,
} from "../qr";

const LINK = "https://brandbite.studio";

describe("qr text", () => {
  it("needs something to encode, and not too much of it", () => {
    expect(qrTextProblem("   ")).toMatch(/Type a link/);
    expect(qrTextProblem("x".repeat(QR_MAX_LENGTH + 1))).toMatch(/over 600 characters/);
    expect(qrTextProblem(LINK)).toBeNull();
  });
});

describe("qrMatrix", () => {
  it("makes a square grid with the three corner markers", () => {
    const matrix = qrMatrix(LINK, false);
    expect(matrix.size).toBeGreaterThanOrEqual(21);
    expect((matrix.size - 17) % 4).toBe(0);
    // Corners of the three finder patterns are dark; the fourth corner has none.
    expect(matrix.isDark(0, 0)).toBe(true);
    expect(matrix.isDark(0, matrix.size - 1)).toBe(true);
    expect(matrix.isDark(matrix.size - 1, 0)).toBe(true);
  });

  it("uses a sturdier, denser code when a logo will cover part of it", () => {
    expect(qrMatrix(LINK, true).size).toBeGreaterThan(qrMatrix(LINK, false).size);
  });

  it("is the same code every time", () => {
    const a = qrMatrix(LINK, false);
    const b = qrMatrix(LINK, false);
    for (let i = 0; i < a.size; i++) expect(a.isDark(i, 8)).toBe(b.isDark(i, 8));
  });
});

describe("qrSvg", () => {
  const matrix = qrMatrix(LINK, false);
  const base = {
    matrix,
    pixels: 512,
    foreground: "#1f3a5f",
    background: "#ffffff" as string | null,
  };

  it("draws on a canvas with the quiet margin, in the chosen colors", () => {
    const svg = qrSvg({ ...base, style: "square" });
    const total = matrix.size + QR_MARGIN * 2;
    expect(svg).toContain(`viewBox="0 0 ${total} ${total}"`);
    expect(svg).toContain('width="512" height="512"');
    expect(svg).toContain(`<rect width="${total}" height="${total}" fill="#ffffff"/>`);
    expect(svg).toContain('<g fill="#1f3a5f">');
  });

  it("leaves the background out when it should be see-through", () => {
    const svg = qrSvg({ ...base, background: null, style: "square" });
    expect(svg).not.toContain('fill="#ffffff"');
  });

  it("draws one shape per dark module outside the corner markers", () => {
    let dark = 0;
    const inFinder = (r: number, c: number) =>
      (r < 7 && c < 7) || (r < 7 && c >= matrix.size - 7) || (r >= matrix.size - 7 && c < 7);
    for (let r = 0; r < matrix.size; r++) {
      for (let c = 0; c < matrix.size; c++) if (matrix.isDark(r, c) && !inFinder(r, c)) dark++;
    }
    const dots = qrSvg({ ...base, style: "dots" });
    expect(dots.match(/<circle /g)?.length).toBe(dark);
    // Three corner markers, each a ring and a center.
    expect(dots.match(/stroke-width="1"/g)?.length).toBe(3);
  });

  it("clears a centered square for the logo and puts the logo in it", () => {
    const sturdy = qrMatrix(LINK, true);
    const plain = qrSvg({ ...base, matrix: sturdy, style: "dots" });
    const withLogo = qrSvg({
      ...base,
      matrix: sturdy,
      style: "dots",
      logoHref: "data:image/png;base64,AAAA",
    });
    expect(withLogo).toContain('<image href="data:image/png;base64,AAAA"');
    expect(withLogo.match(/<circle /g)!.length).toBeLessThan(plain.match(/<circle /g)!.length);
    const { start, count } = logoModules(sturdy.size);
    expect(start * 2 + count).toBe(sturdy.size);
    expect(count / sturdy.size).toBeLessThan(0.3);
  });
});

describe("the drawn code is the real code", () => {
  it("puts a dark shape on exactly the modules the QR standard makes dark", () => {
    const matrix = qrMatrix("https://brandbite.studio/mockups?ref=qr", false);
    const svg = qrSvg({
      matrix,
      pixels: 512,
      foreground: "#000000",
      background: "#ffffff",
      style: "square",
    });
    const drawn = new Set<string>();
    // Data modules: one 1.02-wide square each, at whole-number positions.
    for (const match of svg.matchAll(
      /<rect x="(\d+)" y="(\d+)" width="1\.02" height="1\.02"\/>/g,
    )) {
      drawn.add(`${Number(match[2]) - QR_MARGIN},${Number(match[1]) - QR_MARGIN}`);
    }
    // Corner markers: a one-module ring around a 7×7 box, and a 3×3 center.
    const rings = [...svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="6" height="6"/g)];
    expect(rings).toHaveLength(3);
    for (const ring of rings) {
      const column = Number(ring[1]) - 0.5 - QR_MARGIN;
      const row = Number(ring[2]) - 0.5 - QR_MARGIN;
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          const onRing = r === 0 || r === 6 || c === 0 || c === 6;
          const inCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          if (onRing || inCenter) drawn.add(`${row + r},${column + c}`);
        }
      }
    }
    const expected = new Set<string>();
    for (let r = 0; r < matrix.size; r++) {
      for (let c = 0; c < matrix.size; c++) if (matrix.isDark(r, c)) expected.add(`${r},${c}`);
    }
    expect([...drawn].sort()).toEqual([...expected].sort());
  });
});

describe("qrColorWarning", () => {
  it("is quiet for a dark code on a light background", () => {
    expect(qrColorWarning("#000000", "#ffffff")).toBeNull();
    expect(qrColorWarning("#1f3a5f", null)).toBeNull();
  });

  it("warns when the code is the lighter color, or the two are close", () => {
    expect(qrColorWarning("#ffffff", "#000000")).toMatch(/lighter than its background/);
    expect(qrColorWarning("#8a8a8a", "#ffffff")).toMatch(/close/);
  });

  it("says nothing about colors it can't read", () => {
    expect(qrColorWarning("nonsense", "#ffffff")).toBeNull();
  });
});

describe("gradient", () => {
  const gradient = gradientFromColors(["#000000", "#ffffff"]);

  it("spreads colors evenly and writes them as CSS", () => {
    const three = gradientFromColors(["#ff0000", "#00ff00", "#0000ff"]);
    expect(sortedStops(three).map((s) => s.position)).toEqual([0, 50, 100]);
    expect(gradientCss(three)).toBe(
      "linear-gradient(135deg, #ff0000 0%, #00ff00 50%, #0000ff 100%)",
    );
    expect(gradientCss({ ...three, kind: "radial" })).toBe(
      "radial-gradient(circle farthest-corner at center, #ff0000 0%, #00ff00 50%, #0000ff 100%)",
    );
  });

  it("gives a plain color first, for anything that can't draw gradients", () => {
    expect(gradientDeclaration(gradient)).toBe(
      "background: #000000;\nbackground: linear-gradient(135deg, #000000 0%, #ffffff 100%);",
    );
  });

  it("falls back to two colors when given fewer than two it can read", () => {
    expect(gradientFromColors(["nope"]).stops).toHaveLength(2);
  });

  it("orders stops by position whatever order they were added in", () => {
    const moved = updateStop(gradient, gradient.stops[0].id, { position: 100 });
    const back = updateStop(moved, gradient.stops[1].id, { position: 0 });
    expect(sortedStops(back).map((s) => s.color)).toEqual(["#ffffff", "#000000"]);
  });

  it("adds a stop in the widest gap, colored between its neighbors", () => {
    const added = addStop(gradient);
    const stops = sortedStops(added);
    expect(stops.map((s) => s.position)).toEqual([0, 50, 100]);
    expect(stops[1].color).toBe("#808080");
    const uneven = updateStop(added, stops[1].id, { position: 10 });
    expect(sortedStops(addStop(uneven)).map((s) => s.position)).toEqual([0, 10, 55, 100]);
  });

  it("keeps between two and six stops, and positions within 0 to 100", () => {
    expect(removeStop(gradient, gradient.stops[0].id).stops).toHaveLength(2);
    let many = gradient;
    for (let i = 0; i < 10; i++) many = addStop(many);
    expect(many.stops).toHaveLength(MAX_STOPS);
    expect(removeStop(many, many.stops[0].id).stops).toHaveLength(MAX_STOPS - 1);
    expect(updateStop(gradient, gradient.stops[0].id, { position: 140 }).stops[0].position).toBe(
      100,
    );
    expect(updateStop(gradient, gradient.stops[0].id, { position: -3 }).stops[0].position).toBe(0);
  });

  it("mixes colors and wraps angles", () => {
    expect(mixColors("#000000", "#ffffff", 0)).toBe("#000000");
    expect(mixColors("#ff0000", "#0000ff", 0.5)).toBe("#800080");
    expect(normalizeAngle(-90)).toBe(270);
    expect(normalizeAngle(720)).toBe(0);
  });

  it("draws a canvas gradient along the same line CSS uses", () => {
    // 90deg runs left to right across the full width.
    const right = linearGradientLine(200, 100, 90);
    expect(right.x0).toBeCloseTo(0);
    expect(right.x1).toBeCloseTo(200);
    expect(right.y0).toBeCloseTo(50);
    expect(right.y1).toBeCloseTo(50);
    // 180deg runs top to bottom; 0deg bottom to top.
    expect(linearGradientLine(200, 100, 180).y1).toBeCloseTo(100);
    expect(linearGradientLine(200, 100, 0).y1).toBeCloseTo(0);
    // A diagonal is long enough to reach the corners: |w·sin| + |h·cos|.
    const diagonal = linearGradientLine(200, 100, 45);
    const length = Math.hypot(diagonal.x1 - diagonal.x0, diagonal.y1 - diagonal.y0);
    expect(length).toBeCloseTo(200 * Math.SQRT1_2 + 100 * Math.SQRT1_2);
    expect(radialGradientRadius(600, 800)).toBe(500);
  });

  it("names the download by its size", () => {
    expect(gradientFileName(1080, 1920)).toBe("brandbite-gradient-1080x1920.png");
  });
});
