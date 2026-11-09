// -----------------------------------------------------------------------------
// @file: app/brand-kit/font-pairings/[slug]/page.tsx
// @purpose: One font pairing: a type specimen, why it works, a brand preview,
//           CSS, and related pairings.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  BRAND_KIT_CTA,
  BRAND_KIT_LABEL,
  BrandKitNav,
  PairingCard,
} from "@/components/brand-kit/brand-kit-parts";
import { fontStyle, KitPreviews } from "@/components/brand-kit/kit-previews";
import { studioButtonClasses } from "@/components/colors/studio/studio-button";
import { StudioShell } from "@/components/colors/studio/studio-shell";
import { JsonLd } from "@/components/seo/json-ld";
import {
  FONT_PAIRINGS,
  getFont,
  getPairing,
  googleFontsUrl,
  pairingName,
  type Personality,
} from "@/lib/brand-kit/fonts";
import { brandPalette } from "@/lib/brand-kit/palette";
import { pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd } from "@/lib/seo/structured-data";

type PageProps = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return FONT_PAIRINGS.map((pairing) => ({ slug: pairing.slug }));
}

/** A sample base color per personality for the preview. */
const SAMPLE_COLOR: Record<Personality, string> = {
  Modern: "#3b5bdb",
  Classic: "#7a2e3a",
  Playful: "#ff6426",
  Luxury: "#1f3a33",
  Techy: "#6741d9",
  Friendly: "#2f9e44",
  Bold: "#e8590c",
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const pairing = getPairing((await params).slug);
  if (!pairing) return { title: "Font pairing", robots: { index: false, follow: false } };
  const name = pairingName(pairing);
  return pageMetadata({
    title: `${name} Font Pairing`,
    description: `${name}: ${pairing.why.split(". ")[0]}. Best for ${pairing.bestFor.charAt(0).toLowerCase()}${pairing.bestFor.slice(1)}`,
    path: `/brand-kit/font-pairings/${pairing.slug}`,
    image: `/brand-kit/font-pairings/${pairing.slug}/opengraph-image`,
  });
}

export default async function FontPairingPage({ params }: PageProps) {
  const pairing = getPairing((await params).slug);
  if (!pairing) notFound();

  const heading = getFont(pairing.heading);
  const body = getFont(pairing.body);
  const name = pairingName(pairing);
  const personality = pairing.personalities[0];
  const palette = brandPalette(SAMPLE_COLOR[personality], personality);
  const related = FONT_PAIRINGS.filter(
    (other) =>
      other.slug !== pairing.slug &&
      (other.heading === pairing.heading ||
        other.body === pairing.body ||
        other.personalities.some((p) => pairing.personalities.includes(p))),
  ).slice(0, 3);
  const css = [
    `/* Headings */`,
    `h1, h2, h3 { font-family: "${heading.name}", ${heading.fallback}; }`,
    ``,
    `/* Body text */`,
    `body { font-family: "${body.name}", ${body.fallback}; }`,
  ].join("\n");
  const kitHref = `/brand-kit?style=${personality}&fonts=${pairing.slug}&color=${SAMPLE_COLOR[personality].slice(1)}`;

  return (
    <StudioShell
      label={BRAND_KIT_LABEL}
      nav={<BrandKitNav />}
      title={name}
      accent="font pairing."
      blurb={`Best for ${pairing.bestFor.charAt(0).toLowerCase()}${pairing.bestFor.slice(1)}`}
      breadcrumb={name}
      {...BRAND_KIT_CTA}
    >
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Brand Kit Generator", path: "/brand-kit" },
          { name: "Font pairings", path: "/brand-kit/font-pairings" },
          { name, path: `/brand-kit/font-pairings/${pairing.slug}` },
        ])}
      />

      <section
        aria-label="Type specimen"
        className="rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-8 max-[767px]:p-5"
      >
        <p className="text-sm text-[var(--cs-muted)]">Heading · {heading.name}</p>
        <p
          className="mt-1 text-5xl leading-tight max-[767px]:text-4xl"
          style={fontStyle(heading.id)}
        >
          Make something people remember
        </p>
        <p className="mt-4 text-2xl leading-snug" style={fontStyle(heading.id)}>
          A second-level heading for sections
        </p>
        <p className="mt-6 text-sm text-[var(--cs-muted)]">Body · {body.name}</p>
        <p className="mt-1 max-w-[720px] text-lg leading-8" style={fontStyle(body.id)}>
          {pairing.why}
        </p>
        <p className="mt-3 max-w-[720px] text-sm leading-6" style={fontStyle(body.id)}>
          Small text, like captions and labels, should stay readable too. ABCDEFGHIJKLM
          abcdefghijklm 0123456789
        </p>
      </section>

      <section className="grid grid-cols-2 gap-6 max-[767px]:grid-cols-1">
        <div className="rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-6">
          <h2 className="text-lg leading-7 font-semibold">Why it works</h2>
          <p className="mt-2 text-base leading-7">{pairing.why}</p>
          <h2 className="mt-5 text-lg leading-7 font-semibold">Best for</h2>
          <p className="mt-2 text-base leading-7">{pairing.bestFor}</p>
          <div className="mt-5 flex flex-wrap gap-1.5">
            {pairing.personalities.map((p) => (
              <span
                key={p}
                className="rounded-full bg-[var(--cs-soft)] px-2.5 py-0.5 text-sm font-semibold text-[var(--cs-soft-text)]"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-6">
          <h2 className="text-lg leading-7 font-semibold">Use it</h2>
          <p className="mt-2 text-base leading-7">
            Both fonts are free on Google Fonts under open licenses that allow commercial use.
          </p>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-[var(--cs-background)] p-4 text-sm leading-6">
            <code>{css}</code>
          </pre>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={kitHref} className={studioButtonClasses("primary")}>
              Build a brand kit with it
            </Link>
            {[heading, body].map((font) => (
              <a
                key={font.id}
                href={googleFontsUrl(font)}
                className={studioButtonClasses("tertiary")}
                target="_blank"
                rel="noopener noreferrer"
              >
                {font.name} on Google Fonts
              </a>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="preview-heading">
        <h2 id="preview-heading" className="mb-4 text-2xl leading-8 font-semibold">
          On a brand
        </h2>
        <KitPreviews
          kit={{
            palette,
            headingFontId: heading.id,
            bodyFontId: body.id,
            name: "Northwind",
            tagline: "Make something people remember.",
          }}
        />
      </section>

      {related.length > 0 ? (
        <section aria-labelledby="related-heading">
          <h2 id="related-heading" className="mb-4 text-2xl leading-8 font-semibold">
            Similar pairings
          </h2>
          <ul className="grid grid-cols-3 gap-6 max-[1023px]:grid-cols-2 max-[639px]:grid-cols-1">
            {related.map((other) => (
              <PairingCard key={other.slug} pairing={other} />
            ))}
          </ul>
        </section>
      ) : null}
    </StudioShell>
  );
}
