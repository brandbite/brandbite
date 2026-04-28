// -----------------------------------------------------------------------------
// @file: components/blocks/HeroBlock.tsx
// @purpose: Public-facing hero block. Renders one of four layout variants
//           keyed by data.variant. The currently-shipped landing-page hero
//           ("All your creatives, one subscription.") corresponds to the
//           "centered" variant with no image.
//
//           The non-centered variants (image-left, image-right, full-bleed)
//           are wired but the admin form for picking variants + uploading
//           the hero image lands in Phase 1 — Phase 0 only ships seed data
//           with the existing centered variant so the page looks identical.
// -----------------------------------------------------------------------------

import Link from "next/link";

import type { HeroData } from "@/lib/blocks/types";

type HeroBlockProps = {
  data: HeroData;
  /** Sign-in href injected from the page so the CTA can route to /login or
   *  /debug/demo-user depending on demo mode. Used as a fallback when
   *  data.ctaHref isn't set. */
  signInHref: string;
};

export function HeroBlock({ data, signInHref }: HeroBlockProps) {
  const variant = data.variant ?? "centered";
  const ctaHref = data.ctaHref ?? signInHref;

  switch (variant) {
    case "image-left":
    case "image-right":
      return <SplitHero data={data} ctaHref={ctaHref} mirror={variant === "image-left"} />;
    case "full-bleed":
      return <FullBleedHero data={data} ctaHref={ctaHref} />;
    case "centered":
    default:
      return <CenteredHero data={data} ctaHref={ctaHref} />;
  }
}

/* ---------------------------------------------------------------------------
 * Variant: Centered (the current landing-page look)
 *
 * Bitemark SVG sits behind as a section-wide decorative blob. The hero copy
 * + CTA are centered above it. This is the default and what existing
 * `app/page.tsx` ships with today.
 * ------------------------------------------------------------------------- */

function CenteredHero({ data, ctaHref }: { data: HeroData; ctaHref: string }) {
  return (
    <section className="relative overflow-hidden bg-white">
      {/* Bitemark organic blob — full-section background from Figma SVG.
          Pre-existing landing-page asset; intentionally a raw <img> to
          allow the absolute-positioned, object-fit-cover behaviour. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/bitemark.svg"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-0 h-full w-auto max-w-none object-cover object-left-top select-none"
      />

      <div className="relative px-6 pt-20 pb-16 text-center sm:pt-28 sm:pb-20">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-brand text-4xl leading-tight font-bold tracking-tight sm:text-5xl md:text-6xl">
            {data.headline}
          </h1>
          {data.subhead ? (
            <p className="mx-auto mt-5 max-w-xl text-base text-[var(--bb-text-secondary)] sm:text-lg">
              {data.subhead}
            </p>
          ) : null}
          {data.ctaLabel ? (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href={ctaHref}
                className="inline-block rounded-full bg-[var(--bb-primary)] px-8 py-3.5 text-sm font-bold tracking-wide text-white uppercase shadow-[var(--bb-primary)]/25 shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-[var(--bb-primary)]/30 hover:shadow-xl"
              >
                {data.ctaLabel}
              </Link>
              {data.secondaryCtaLabel && data.secondaryCtaHref ? (
                <Link
                  href={data.secondaryCtaHref}
                  className="inline-block rounded-full border border-[var(--bb-border)] bg-white px-8 py-3.5 text-sm font-bold tracking-wide text-[var(--bb-secondary)] uppercase transition-colors hover:bg-[var(--bb-bg-warm)]"
                >
                  {data.secondaryCtaLabel}
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------------
 * Variant: Split (image on one side, text on the other)
 * ------------------------------------------------------------------------- */

function SplitHero({
  data,
  ctaHref,
  mirror,
}: {
  data: HeroData;
  ctaHref: string;
  mirror: boolean;
}) {
  const imageUrl = data.image?.url ?? null;
  return (
    <section className="bg-white px-6 py-20 sm:py-24">
      <div
        className={`mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-2 ${
          mirror ? "" : "md:[&>*:first-child]:order-2"
        }`}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            aria-hidden="true"
            className="h-auto w-full rounded-3xl object-cover shadow-md"
          />
        ) : (
          <div
            aria-hidden="true"
            className="aspect-[4/3] w-full rounded-3xl bg-[var(--bb-bg-warm)]"
          />
        )}
        <div>
          <h1 className="font-brand text-4xl leading-tight font-bold tracking-tight sm:text-5xl">
            {data.headline}
          </h1>
          {data.subhead ? (
            <p className="mt-4 text-base text-[var(--bb-text-secondary)] sm:text-lg">
              {data.subhead}
            </p>
          ) : null}
          {data.ctaLabel ? (
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href={ctaHref}
                className="inline-block rounded-full bg-[var(--bb-primary)] px-8 py-3.5 text-sm font-bold tracking-wide text-white uppercase shadow-lg transition-all hover:-translate-y-0.5"
              >
                {data.ctaLabel}
              </Link>
              {data.secondaryCtaLabel && data.secondaryCtaHref ? (
                <Link
                  href={data.secondaryCtaHref}
                  className="inline-block rounded-full border border-[var(--bb-border)] bg-white px-8 py-3.5 text-sm font-bold tracking-wide text-[var(--bb-secondary)] uppercase transition-colors hover:bg-[var(--bb-bg-warm)]"
                >
                  {data.secondaryCtaLabel}
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------------
 * Variant: Full-bleed (background image with text overlay)
 * ------------------------------------------------------------------------- */

function FullBleedHero({ data, ctaHref }: { data: HeroData; ctaHref: string }) {
  const imageUrl = data.image?.url ?? null;
  return (
    <section className="relative overflow-hidden bg-[var(--bb-bg-warm)]">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}
      {/* Dark overlay so the text stays legible on any image */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent"
      />
      <div className="relative px-6 pt-32 pb-24 text-center sm:pt-40 sm:pb-32">
        <div className="mx-auto max-w-3xl text-white">
          <h1 className="font-brand text-4xl leading-tight font-bold tracking-tight sm:text-5xl md:text-6xl">
            {data.headline}
          </h1>
          {data.subhead ? (
            <p className="mx-auto mt-5 max-w-xl text-base text-white/90 sm:text-lg">
              {data.subhead}
            </p>
          ) : null}
          {data.ctaLabel ? (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href={ctaHref}
                className="inline-block rounded-full bg-[var(--bb-primary)] px-8 py-3.5 text-sm font-bold tracking-wide text-white uppercase shadow-lg transition-all hover:-translate-y-0.5"
              >
                {data.ctaLabel}
              </Link>
              {data.secondaryCtaLabel && data.secondaryCtaHref ? (
                <Link
                  href={data.secondaryCtaHref}
                  className="inline-block rounded-full border border-white/40 bg-transparent px-8 py-3.5 text-sm font-bold tracking-wide text-white uppercase transition-colors hover:bg-white/10"
                >
                  {data.secondaryCtaLabel}
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
