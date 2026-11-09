// -----------------------------------------------------------------------------
// @file: lib/seo/og-image.tsx
// @purpose: Shared layout for the social share images (Open Graph / X cards).
//           Every card uses the brand cream background, Plus Jakarta Sans and
//           the orange accent; colour pages add a row of swatches.
//
//           Fonts are static WOFF files in assets/fonts (Satori, which renders
//           these images, can't read the variable WOFF2 the site itself uses).
// -----------------------------------------------------------------------------

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

const CREAM = "#F7F4F1";
const INK = "#2B2D33";
const ORANGE = "#FF6426";

async function loadFonts() {
  const dir = join(process.cwd(), "assets/fonts");
  const [extraBold, medium] = await Promise.all([
    readFile(join(dir, "plus-jakarta-sans-latin-800-normal.woff")),
    readFile(join(dir, "plus-jakarta-sans-latin-500-normal.woff")),
  ]);
  return [
    { name: "Jakarta", data: extraBold, weight: 800 as const, style: "normal" as const },
    { name: "Jakarta", data: medium, weight: 500 as const, style: "normal" as const },
  ];
}

export type OgCardInput = {
  /** Small label above the title, e.g. "Color palette". */
  eyebrow?: string;
  title: string;
  /** Rendered in orange after the title, e.g. "different." */
  accent?: string;
  subtitle?: string;
  /** Hex colours shown as a swatch strip along the bottom. */
  swatches?: string[];
};

export async function renderOgCard({ eyebrow, title, accent, subtitle, swatches }: OgCardInput) {
  const fonts = await loadFonts();
  const hasSwatches = Boolean(swatches && swatches.length > 0);
  const titleSize = title.length > 40 ? 64 : 80;
  // A long title puts the accent on its own line, so a wrap never leaves it indented.
  const accentOnOwnLine = Boolean(accent) && title.length + (accent?.length ?? 0) > 24;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: CREAM,
        fontFamily: "Jakarta",
        color: INK,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
          padding: "64px 72px",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {eyebrow ? (
            <div
              style={{
                display: "flex",
                fontSize: 28,
                fontWeight: 500,
                color: ORANGE,
                textTransform: "uppercase",
                letterSpacing: 2,
              }}
            >
              {eyebrow}
            </div>
          ) : null}
          <div
            style={{
              display: "flex",
              flexDirection: accentOnOwnLine ? "column" : "row",
              flexWrap: "wrap",
              fontSize: titleSize,
              fontWeight: 800,
              lineHeight: 1.05,
              maxWidth: 1000,
            }}
          >
            <span>{title}</span>
            {accent ? (
              <span style={{ color: ORANGE, marginLeft: accentOnOwnLine ? 0 : 20 }}>{accent}</span>
            ) : null}
          </div>
          {subtitle ? (
            <div style={{ display: "flex", fontSize: 32, fontWeight: 500, maxWidth: 960 }}>
              {subtitle}
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", fontSize: 40, fontWeight: 800 }}>
          brand<span style={{ color: ORANGE }}>bite</span>
        </div>
      </div>
      {hasSwatches ? (
        <div style={{ display: "flex", height: 150 }}>
          {swatches!.map((hex, index) => (
            <div key={`${hex}-${index}`} style={{ flexGrow: 1, backgroundColor: hex }} />
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", height: 24, backgroundColor: ORANGE }} />
      )}
    </div>,
    { ...OG_SIZE, fonts },
  );
}
