// -----------------------------------------------------------------------------
// @file: components/ui/brand-logo.tsx
// @purpose: Theme-aware Brandbite logo + "b" mark. Renders the standard
//           (orange + charcoal) artwork in light mode and the negative
//           (all-white) artwork in dark mode via Tailwind's `dark:` variant
//           so the wordmark stays legible on --bb-bg-page in both themes.
//
//           Source SVGs live in /public and come from
//           G:/Works/brandbite/_logo (brandbite-logo*.svg, b-icon*.svg).
//           Use <BrandLogo> for the full wordmark and <BrandMark> for the
//           square "b" bite icon (collapsed sidebar rail, avatars, etc.).
//
//           On light-only surfaces (static homepage, dark footers) keep
//           using a plain <Image> with the explicit variant instead.
// -----------------------------------------------------------------------------

import Image from "next/image";

// Intrinsic aspect ratio of brandbite-logo.svg (viewBox 878.4 × 181.7).
export const BRAND_LOGO_RATIO = 878.4 / 181.7;

type BrandLogoProps = {
  /** Rendered width in px; height is derived from the SVG aspect ratio. */
  width?: number;
  /** Applied to both <img> variants (sizing, e.g. "h-7 w-auto"). */
  className?: string;
  priority?: boolean;
};

export function BrandLogo({ width = 140, className = "", priority }: BrandLogoProps) {
  const height = Math.round(width / BRAND_LOGO_RATIO);
  return (
    <>
      <Image
        src="/brandbite-logo.svg"
        alt="Brandbite"
        width={width}
        height={height}
        priority={priority}
        className={`${className} dark:hidden`.trim()}
      />
      <Image
        src="/brandbite-logo-negative.svg"
        alt="Brandbite"
        width={width}
        height={height}
        priority={priority}
        className={`${className} hidden dark:block`.trim()}
      />
    </>
  );
}

type BrandMarkProps = {
  size?: number;
  className?: string;
  priority?: boolean;
};

export function BrandMark({ size = 32, className = "", priority }: BrandMarkProps) {
  return (
    <>
      <Image
        src="/b-icon.svg"
        alt="Brandbite"
        width={size}
        height={size}
        priority={priority}
        className={`${className} dark:hidden`.trim()}
      />
      <Image
        src="/b-icon-negative.svg"
        alt="Brandbite"
        width={size}
        height={size}
        priority={priority}
        className={`${className} hidden dark:block`.trim()}
      />
    </>
  );
}
