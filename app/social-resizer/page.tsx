// -----------------------------------------------------------------------------
// @file: app/social-resizer/page.tsx
// @purpose: Social resizer: one image cropped to every social media size.
//           The tool is client-side; the guide below it is in the first HTML
//           for search engines and readers.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import Link from "next/link";

import { StudioShell } from "@/components/colors/studio/studio-shell";
import { SocialResizer } from "@/components/image-tools/social-resizer";
import { JsonLd } from "@/components/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, webApplicationJsonLd } from "@/lib/seo/structured-data";

const TOOL = {
  name: "Social Media Image Resizer",
  path: "/social-resizer",
  description:
    "Resize one image to every social media size at once: Instagram, Facebook, LinkedIn, TikTok, YouTube, X and more. Download them one by one or as a zip. Free, in your browser.",
};

export const metadata: Metadata = pageMetadata({
  title: "Free Social Media Image Resizer",
  description: TOOL.description,
  path: TOOL.path,
});

const STEPS = [
  {
    title: "Choose your image",
    body: "A PNG, JPG or WebP. Start with the largest version you have; it is resized in your browser and never uploaded.",
  },
  {
    title: "Switch on your platforms",
    body: "Each platform ticks its most used sizes for you. Tick or untick any size in its list.",
  },
  {
    title: "Decide what happens to the edges",
    body: "Crop to fill cuts what doesn't fit: press Adjust on a size, then drag and zoom to choose the part it keeps. Fit inside keeps the whole image and fills the rest with a color.",
  },
  {
    title: "Download",
    body: "One size from its card, or all of them in a single zip with clear file names.",
  },
];

const TIPS = [
  "Keep the important part of the image in the middle. Tall and wide sizes cut opposite edges.",
  "Use an image at least as large as the biggest size you need. Scaling up makes it soft.",
  "Choose JPG for photos and PNG for graphics with text, flat color or sharp edges.",
  "Stories and reels are covered by buttons at the top and bottom. Leave those areas free of text.",
  "A logo on a colored background resizes best with Fit inside and your brand color as the fill.",
];

export default function SocialResizerPage() {
  return (
    <StudioShell
      label="SOCIAL RESIZER"
      nav={null}
      title="One image,"
      accent="every social size."
      blurb="Crop one image to the sizes each platform asks for, and download them together."
      ctaHeading="Right size."
      ctaHeadingAccent="Right design."
      ctaBlurb="Need the post itself designed? Send a request to brandbite and get it back in every size."
    >
      <JsonLd
        data={[
          webApplicationJsonLd({ ...TOOL, category: "DesignApplication" }),
          breadcrumbJsonLd([{ name: TOOL.name, path: TOOL.path }]),
        ]}
      />

      <SocialResizer />

      <section
        aria-labelledby="resizer-how-heading"
        className="mt-6 rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-8 max-[767px]:p-5"
      >
        <h2 id="resizer-how-heading" className="text-2xl leading-8 font-semibold">
          How to resize an image for social media
        </h2>
        <ol className="mt-4 grid grid-cols-2 gap-x-8 gap-y-5 max-[767px]:grid-cols-1">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--cs-soft)] text-sm font-semibold text-[var(--cs-soft-text)]">
                {index + 1}
              </span>
              <div>
                <h3 className="text-base leading-6 font-semibold">{step.title}</h3>
                <p className="mt-1 text-base leading-6 text-[var(--cs-muted)]">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <h2 className="mt-8 text-2xl leading-8 font-semibold">Where the sizes come from</h2>
        <p className="mt-3 max-w-[760px] text-base leading-7">
          The sizes are the same ones as in our{" "}
          <Link href="/sizes" className="font-semibold underline">
            social media size guide
          </Link>
          , which lists each platform&apos;s sources and when the numbers were last checked. When a
          platform changes a size, both update together.
        </p>

        <h2 className="mt-8 text-2xl leading-8 font-semibold">
          Tips for images that survive a crop
        </h2>
        <ul className="mt-4 flex max-w-[760px] list-disc flex-col gap-2 pl-5 text-base leading-7">
          {TIPS.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>

        <h2 className="mt-8 text-2xl leading-8 font-semibold">Related free tools</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {[
            { href: "/sizes", label: "Social media size guide" },
            { href: "/image-converter", label: "Image converter" },
            { href: "/mockups", label: "Mockup Studio" },
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
