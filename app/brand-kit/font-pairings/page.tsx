// -----------------------------------------------------------------------------
// @file: app/brand-kit/font-pairings/page.tsx
// @purpose: Every curated font pairing, each previewed in its own fonts.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";

import {
  BRAND_KIT_CTA,
  BRAND_KIT_LABEL,
  BrandKitNav,
  PairingCard,
} from "@/components/brand-kit/brand-kit-parts";
import { StudioShell } from "@/components/colors/studio/studio-shell";
import { JsonLd } from "@/components/seo/json-ld";
import { FONT_PAIRINGS } from "@/lib/brand-kit/fonts";
import { pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd } from "@/lib/seo/structured-data";

export const metadata: Metadata = pageMetadata({
  title: "Google Font Pairings for Brands",
  description: `${FONT_PAIRINGS.length} hand-picked Google Font pairings for headings and body text, each with a live preview, what it suits and how to use it.`,
  path: "/brand-kit/font-pairings",
  image: "/brand-kit/opengraph-image",
});

export default function FontPairingsPage() {
  return (
    <StudioShell
      label={BRAND_KIT_LABEL}
      nav={<BrandKitNav />}
      title="Font pairings that"
      accent="work."
      blurb="Free Google Fonts, paired for headings and body text, and shown in their own type."
      breadcrumb="Font pairings"
      {...BRAND_KIT_CTA}
    >
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Brand Kit Generator", path: "/brand-kit" },
          { name: "Font pairings", path: "/brand-kit/font-pairings" },
        ])}
      />
      <ul className="grid grid-cols-3 gap-6 max-[1023px]:grid-cols-2 max-[639px]:grid-cols-1">
        {FONT_PAIRINGS.map((pairing) => (
          <PairingCard key={pairing.slug} pairing={pairing} />
        ))}
      </ul>
    </StudioShell>
  );
}
