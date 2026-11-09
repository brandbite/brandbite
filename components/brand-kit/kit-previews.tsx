// -----------------------------------------------------------------------------
// @file: components/brand-kit/kit-previews.tsx
// @purpose: Shows a brand kit applied to real things: a wordmark, a business
//           card, a social post and a bit of website UI. Also used by the
//           font pairing pages.
// -----------------------------------------------------------------------------

import type { CSSProperties } from "react";

import { FONT_FAMILY } from "@/lib/brand-kit/font-faces";
import { contrastRatio } from "@/lib/colors";
import type { BrandColor, BrandColorRole } from "@/lib/brand-kit/palette";

export type KitStyle = {
  palette: BrandColor[];
  headingFontId: string;
  bodyFontId: string;
  name: string;
  tagline: string;
};

function pick(palette: BrandColor[], role: BrandColorRole): BrandColor {
  return palette.find((color) => color.role === role)!;
}

/**
 * The first brand color that reads on `background` at 3:1 (large text), so a
 * dark primary never disappears on the dark card. Falls back to black or white.
 */
function readableOn(background: BrandColor, candidates: BrandColor[]): string {
  return (
    candidates.find((candidate) => contrastRatio(candidate.hex, background.hex) >= 3)?.hex ??
    background.textOn
  );
}

export function fontStyle(fontId: string): CSSProperties {
  return { fontFamily: FONT_FAMILY[fontId] };
}

function Frame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <figure className="flex flex-col gap-2">
      {children}
      <figcaption className="text-sm leading-5 text-[var(--cs-muted)]">{label}</figcaption>
    </figure>
  );
}

export function KitPreviews({ kit }: { kit: KitStyle }) {
  const primary = pick(kit.palette, "primary");
  const secondary = pick(kit.palette, "secondary");
  const accent = pick(kit.palette, "accent");
  const dark = pick(kit.palette, "dark");
  const light = pick(kit.palette, "light");
  const heading = fontStyle(kit.headingFontId);
  const body = fontStyle(kit.bodyFontId);
  const name = kit.name.trim() || "Your brand";
  const tagline = kit.tagline.trim() || "A short line about what you do.";

  return (
    <div className="grid grid-cols-2 gap-6 max-[767px]:grid-cols-1">
      <Frame label="Wordmark">
        <div
          className="flex aspect-[16/9] flex-col items-center justify-center gap-2 rounded-xl p-6 text-center"
          style={{ backgroundColor: light.hex, color: dark.hex }}
        >
          <span
            className="text-4xl leading-tight font-bold break-words"
            style={{ ...heading, color: readableOn(light, [primary, secondary, dark]) }}
          >
            {name}
          </span>
          <span className="text-sm" style={body}>
            {tagline}
          </span>
        </div>
      </Frame>

      <Frame label="Business card">
        <div className="flex aspect-[16/9] items-center justify-center rounded-xl bg-[var(--cs-background)] p-4">
          <div
            className="flex aspect-[1.75] w-full max-w-[340px] flex-col justify-between rounded-lg p-5 shadow-sm"
            style={{ backgroundColor: dark.hex, color: dark.textOn }}
          >
            <span
              className="text-xl font-bold"
              style={{ ...heading, color: readableOn(dark, [primary, accent, secondary, light]) }}
            >
              {name}
            </span>
            <div className="text-xs leading-4" style={body}>
              <p className="font-semibold">Alex Morgan</p>
              <p className="opacity-80">Founder</p>
              <p className="mt-1 opacity-80">hello@yourbrand.com</p>
            </div>
            <span className="h-1 w-12 rounded-full" style={{ backgroundColor: accent.hex }} />
          </div>
        </div>
      </Frame>

      <Frame label="Social post">
        <div
          className="flex aspect-[4/5] flex-col justify-between overflow-hidden rounded-xl p-6"
          style={{ backgroundColor: primary.hex, color: primary.textOn }}
        >
          <span className="text-sm font-semibold" style={body}>
            {name}
          </span>
          <p className="text-3xl leading-tight font-bold break-words" style={heading}>
            {tagline}
          </p>
          <span
            className="self-start rounded-full px-4 py-2 text-sm font-semibold"
            style={{ ...body, backgroundColor: accent.hex, color: accent.textOn }}
          >
            Learn more
          </span>
        </div>
      </Frame>

      <Frame label="Website">
        <div
          className="flex aspect-[4/5] flex-col gap-4 overflow-hidden rounded-xl p-6"
          style={{ backgroundColor: light.hex, color: dark.hex }}
        >
          <div className="flex items-center justify-between">
            <span
              className="font-bold"
              style={{ ...heading, color: readableOn(light, [primary, secondary, dark]) }}
            >
              {name}
            </span>
            <span className="h-2 w-10 rounded-full" style={{ backgroundColor: secondary.hex }} />
          </div>
          <p className="text-2xl leading-tight font-bold" style={heading}>
            Headlines in your heading font.
          </p>
          <p className="text-sm leading-6" style={body}>
            Body text uses your body font. It should be easy to read at small sizes and in long
            paragraphs, on phones and on big screens.
          </p>
          <div className="mt-auto flex gap-2" style={body}>
            <span
              className="rounded-lg px-4 py-2 text-sm font-semibold"
              style={{ backgroundColor: primary.hex, color: primary.textOn }}
            >
              Get started
            </span>
            <span
              className="rounded-lg border px-4 py-2 text-sm font-semibold"
              style={{ borderColor: dark.hex }}
            >
              See how
            </span>
          </div>
        </div>
      </Frame>
    </div>
  );
}
