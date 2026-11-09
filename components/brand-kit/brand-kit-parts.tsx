// -----------------------------------------------------------------------------
// @file: components/brand-kit/brand-kit-parts.tsx
// @purpose: Shared pieces of the brand kit section: its menu, CTA copy and a
//           font pairing card.
// -----------------------------------------------------------------------------

import Link from "next/link";

import { ToolNav } from "@/components/colors/studio/tool-nav";
import { getFont, type FontPairing } from "@/lib/brand-kit/fonts";

import { fontStyle } from "./kit-previews";

export const BRAND_KIT_LABEL = "BRAND KIT";

export const BRAND_KIT_CTA = {
  ctaHeading: "Good kit.",
  ctaHeadingAccent: "Better brand.",
  ctaBlurb: "Turn your kit into a logo, social posts and a website with brandbite.",
};

export function BrandKitNav() {
  return (
    <ToolNav
      items={[
        { href: "/brand-kit", label: "Brand kit generator" },
        { href: "/brand-kit/font-pairings", label: "Font pairings" },
      ]}
      moreTools={[]}
      saved={null}
      overviewHref="/brand-kit"
      ariaLabel="Brand kit tools"
    />
  );
}

export function PairingCard({ pairing }: { pairing: FontPairing }) {
  const heading = getFont(pairing.heading);
  const body = getFont(pairing.body);
  return (
    <li>
      <Link
        href={`/brand-kit/font-pairings/${pairing.slug}`}
        className="flex h-full flex-col gap-3 rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-5 hover:border-[var(--cs-text)]"
      >
        <span className="text-3xl leading-tight" style={fontStyle(heading.id)}>
          {heading.name}
        </span>
        <span className="text-base leading-6" style={fontStyle(body.id)}>
          with {body.name}. {pairing.bestFor}
        </span>
        <span className="mt-auto flex flex-wrap gap-1.5 pt-2">
          {pairing.personalities.map((personality) => (
            <span
              key={personality}
              className="rounded-full bg-[var(--cs-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--cs-soft-text)]"
            >
              {personality}
            </span>
          ))}
        </span>
      </Link>
    </li>
  );
}
