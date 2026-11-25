// -----------------------------------------------------------------------------
// @file: app/type-scale/page.tsx
// @purpose: Type scale generator. The tool is client-side; the guide below it
//           is in the first HTML for search engines and readers.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import Link from "next/link";

import { StudioShell } from "@/components/colors/studio/studio-shell";
import { JsonLd } from "@/components/seo/json-ld";
import { TypeScale } from "@/components/type-scale/type-scale";
import { pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, webApplicationJsonLd } from "@/lib/seo/structured-data";
import { RATIOS } from "@/lib/type-scale/scale";

const TOOL = {
  name: "Type Scale Generator",
  path: "/type-scale",
  description:
    "Pick a body size and a ratio and get heading and text sizes that fit together. Preview them, then copy the scale as CSS variables, fluid clamp() sizes or a Tailwind theme. Free, no sign-up.",
};

export const metadata: Metadata = pageMetadata({
  title: "Type Scale Generator: Font Sizes in CSS and Tailwind",
  description: TOOL.description,
  path: TOOL.path,
});

const RATIO_NOTES: Record<string, string> = {
  "minor-second": "Barely there. For dense screens such as dashboards and tables.",
  "major-second": "Gentle. Good for apps and long documents.",
  "minor-third": "A clear but calm hierarchy. A safe choice for most websites.",
  "major-third": "Confident headings. Common on marketing pages and blogs.",
  "perfect-fourth": "Strong contrast. Suits editorial pages with short headlines.",
  "augmented-fourth": "Dramatic. Works when headings are a few words long.",
  "perfect-fifth": "Very large headings. For landing pages with little text.",
  golden: "The largest steps. Use for posters and hero sections, with fluid sizes.",
};

const TIPS = [
  "Start from the body size. If paragraphs are comfortable to read, the rest of the scale has something solid to stand on.",
  "Use fewer sizes than the scale offers. Most pages need a title, one or two headings, body and small text.",
  "Tighten line height as text gets larger. Paragraphs want about 1.5; a large headline wants close to 1.1.",
  "Check the largest heading on a phone. If it breaks into four lines, lower the ratio or use fluid sizes.",
  "Keep sizes in rem, as the copied code does, so text follows the size a reader has set in their browser.",
];

export default function TypeScalePage() {
  return (
    <StudioShell
      label="TYPE SCALE"
      nav={null}
      title="Font sizes"
      accent="that fit together."
      blurb="One body size and one ratio give you every heading and text size, ready to copy."
      ctaHeading="Sizes sorted."
      ctaHeadingAccent="Need the design?"
      ctaBlurb="Send a web, brand or social design request to brandbite and get it back on one simple subscription."
    >
      <JsonLd
        data={[
          webApplicationJsonLd({ ...TOOL, category: "DesignApplication" }),
          breadcrumbJsonLd([{ name: TOOL.name, path: TOOL.path }]),
        ]}
      />

      <TypeScale />

      <section
        aria-labelledby="type-scale-what-heading"
        className="mt-6 rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-8 max-[767px]:p-5"
      >
        <h2 id="type-scale-what-heading" className="text-2xl leading-8 font-semibold">
          What is a type scale?
        </h2>
        <p className="mt-3 max-w-[760px] text-base leading-7">
          A type scale is a short list of font sizes that are related by one number, the ratio. You
          choose the size of your body text; each size above it is the one below multiplied by the
          ratio. Because every size comes from the same rule, headings and text look like they
          belong together, and you stop picking sizes by eye.
        </p>

        <h2 className="mt-8 text-2xl leading-8 font-semibold">Which ratio should I use?</h2>
        <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-4 max-[767px]:grid-cols-1">
          {RATIOS.map((ratio) => (
            <div key={ratio.id}>
              <dt className="text-base leading-6 font-semibold tabular-nums">
                {ratio.label} · {ratio.value}
              </dt>
              <dd className="mt-1 text-base leading-6 text-[var(--cs-muted)]">
                {RATIO_NOTES[ratio.id]}
              </dd>
            </div>
          ))}
        </dl>

        <h2 className="mt-8 text-2xl leading-8 font-semibold">What are fluid sizes?</h2>
        <p className="mt-3 max-w-[760px] text-base leading-7">
          A heading that looks right on a desktop is often too large on a phone. Fluid sizes use the
          CSS <code>clamp()</code> function so a heading grows smoothly with the width of the
          screen, between a smallest and a largest size, without breakpoints. The body size stays
          the same; only the steps between sizes change.
        </p>

        <h2 className="mt-8 text-2xl leading-8 font-semibold">Tips for using a scale</h2>
        <ul className="mt-4 flex max-w-[760px] list-disc flex-col gap-2 pl-5 text-base leading-7">
          {TIPS.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>

        <h2 className="mt-8 text-2xl leading-8 font-semibold">Related free tools</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {[
            { href: "/colors", label: "Color Studio" },
            { href: "/colors/contrast-checker", label: "Contrast checker" },
            { href: "/brand-kit", label: "Brand kit generator" },
          ].map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="flex h-11 items-center rounded-full border border-[var(--cs-border)] bg-[var(--cs-surface)] px-4 text-sm font-medium hover:border-[var(--cs-text)]"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </StudioShell>
  );
}
