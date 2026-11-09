// -----------------------------------------------------------------------------
// @file: app/brand-kit/page.tsx
// @purpose: Free brand kit generator. The tool runs in the browser; the guide
//           below it is in the first HTML.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import Link from "next/link";

import {
  BRAND_KIT_CTA,
  BRAND_KIT_LABEL,
  BrandKitNav,
} from "@/components/brand-kit/brand-kit-parts";
import { BrandKitTool } from "@/components/brand-kit/brand-kit-tool";
import { StudioShell } from "@/components/colors/studio/studio-shell";
import { JsonLd } from "@/components/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, webApplicationJsonLd } from "@/lib/seo/structured-data";

const TOOL = {
  name: "Brand Kit Generator",
  path: "/brand-kit",
  description:
    "Make a simple brand kit from one color: a five-color palette, a font pairing and previews on a business card, social post and website. Free, no sign-up.",
};

export const metadata: Metadata = pageMetadata({
  title: "Free Brand Kit Generator: Colors and Fonts",
  description: TOOL.description,
  path: TOOL.path,
  image: "/brand-kit/opengraph-image",
});

const PARTS = [
  {
    title: "Logo",
    body: "Your name set in your heading font is a fine start. A designed logo comes later, and it should use the same colors.",
  },
  {
    title: "Color palette",
    body: "One main color people remember you by, a secondary and an accent for variety, plus a dark and a light for text and backgrounds.",
  },
  {
    title: "Fonts",
    body: "One font for headings and one for reading. Two is enough; more usually looks messy.",
  },
  {
    title: "How it's used",
    body: "Examples of the kit on real things, so anyone making a post, slide or page gets the same result.",
  },
];

export default function BrandKitPage() {
  return (
    <StudioShell
      label={BRAND_KIT_LABEL}
      nav={<BrandKitNav />}
      title="Make a brand kit"
      accent="in a minute."
      blurb="Pick a color and a personality. Get a palette, fonts and previews you can share."
      {...BRAND_KIT_CTA}
    >
      <JsonLd
        data={[
          webApplicationJsonLd(TOOL),
          breadcrumbJsonLd([{ name: TOOL.name, path: TOOL.path }]),
        ]}
      />

      <BrandKitTool />

      <section
        aria-labelledby="guide-heading"
        className="mt-6 rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-8 max-[767px]:p-5"
      >
        <h2 id="guide-heading" className="text-2xl leading-8 font-semibold">
          What is a brand kit?
        </h2>
        <p className="mt-3 max-w-[760px] text-base leading-7">
          A brand kit is the short set of rules that makes everything you publish look like it came
          from the same company: your logo, colors, fonts and a few examples. It is smaller than a
          full brand guide, and it is the first thing a designer or a new teammate asks for.
        </p>
        <h2 className="mt-8 text-2xl leading-8 font-semibold">What goes in a brand kit</h2>
        <ul className="mt-4 grid grid-cols-2 gap-x-8 gap-y-5 max-[767px]:grid-cols-1">
          {PARTS.map((part) => (
            <li key={part.title}>
              <h3 className="text-base leading-6 font-semibold">{part.title}</h3>
              <p className="mt-1 text-base leading-6 text-[var(--cs-muted)]">{part.body}</p>
            </li>
          ))}
        </ul>
        <h2 className="mt-8 text-2xl leading-8 font-semibold">How this generator works</h2>
        <p className="mt-3 max-w-[760px] text-base leading-7">
          Your main color stays exactly as you enter it. The personality decides how the secondary
          and accent relate to it on the color wheel, for example close neighbors for a modern look
          or opposites for a bold one, and suggests fonts that match. The dark and light colors are
          tinted with your main color so the palette feels like one family. Everything runs in your
          browser.
        </p>
        <p className="mt-4 text-base leading-7">
          Want more control? Fine-tune the palette in the{" "}
          <Link
            href="/colors/color-palette-generator"
            className="font-semibold text-[var(--cs-brand-strong)] hover:underline"
          >
            color palette generator
          </Link>
          , check text with the{" "}
          <Link
            href="/colors/contrast-checker"
            className="font-semibold text-[var(--cs-brand-strong)] hover:underline"
          >
            contrast checker
          </Link>
          , or browse all{" "}
          <Link
            href="/brand-kit/font-pairings"
            className="font-semibold text-[var(--cs-brand-strong)] hover:underline"
          >
            font pairings
          </Link>
          .
        </p>
      </section>
    </StudioShell>
  );
}
