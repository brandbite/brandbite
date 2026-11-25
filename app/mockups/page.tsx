// -----------------------------------------------------------------------------
// @file: app/mockups/page.tsx
// @purpose: Mockup Studio: a free 3D device mockup generator. The tool is
//           client-side; the guide below it is in the first HTML for search
//           engines and readers.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import Link from "next/link";

import { StudioShell } from "@/components/colors/studio/studio-shell";
import { MockupStudio } from "@/components/mockups/mockup-studio";
import { JsonLd } from "@/components/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, webApplicationJsonLd } from "@/lib/seo/structured-data";

const TOOL = {
  name: "Mockup Studio",
  path: "/mockups",
  description:
    "Put a screenshot on a 3D phone, tablet or laptop, pick the angle and background, and download a PNG. Free, in your browser, no sign-up.",
};

export const metadata: Metadata = pageMetadata({
  title: "Free 3D Device Mockup Generator",
  description: TOOL.description,
  path: TOOL.path,
});

const STEPS = [
  {
    title: "Add your screenshot or screen recording",
    body: "Choose an image (PNG, JPG, WebP) or a video (MP4, WebM, MOV). It plays on the device's screen in your browser and is never uploaded.",
  },
  {
    title: "Choose the device and angle",
    body: "Phone, tablet or laptop. Start from a preset angle, then drag the device to turn it exactly how you want.",
  },
  {
    title: "Set the background",
    body: "A solid color, a soft gradient or none at all. Signed-in brandbite customers also see their brand guide colors.",
  },
  {
    title: "Download",
    body: "A 1080p PNG is free. Choose a transparent background to drop the device straight into a slide or a web page.",
  },
];

const TIPS = [
  "Use a screenshot at the device's real shape. Tall for a phone or tablet, wide for a laptop. Anything else is cropped to fit, keeping the top.",
  "Export larger than you need. A sharp image scaled down looks better than a small one scaled up.",
  "Pick a background from your own palette, so the mockup looks like it belongs to your brand.",
  "Keep the angle gentle for product pages. Steeper angles suit social posts, where the device is the subject.",
  "Turn the shadow off on a transparent background if you plan to add your own.",
];

export default function MockupStudioPage() {
  return (
    <StudioShell
      label="MOCKUP STUDIO"
      nav={null}
      title="3D device mockups"
      accent="from a screenshot."
      blurb="Put your screen on a phone, tablet or laptop. Turn it, set the background, download a PNG."
      ctaHeading="Good mockup."
      ctaHeadingAccent="Better design."
      ctaBlurb="Need the screen itself designed? Send a request to brandbite and get it back on one simple subscription."
    >
      <JsonLd
        data={[
          webApplicationJsonLd({ ...TOOL, category: "DesignApplication" }),
          breadcrumbJsonLd([{ name: TOOL.name, path: TOOL.path }]),
        ]}
      />

      <MockupStudio />

      <section
        aria-labelledby="mockup-what-heading"
        className="mt-6 rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-8 max-[767px]:p-5"
      >
        <h2 id="mockup-what-heading" className="text-2xl leading-8 font-semibold">
          What is a device mockup?
        </h2>
        <p className="mt-3 max-w-[760px] text-base leading-7">
          A device mockup shows your app, website or design on the screen of a phone, tablet or
          laptop. It turns a flat screenshot into a picture people understand at a glance: this is a
          real product, and this is what using it looks like. Mockups are used on landing pages, in
          app store listings, in pitch decks and in social posts.
        </p>

        <h2 className="mt-8 text-2xl leading-8 font-semibold">How to make a 3D mockup</h2>
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

        <h2 className="mt-8 text-2xl leading-8 font-semibold">Tips for a mockup that looks real</h2>
        <ul className="mt-4 flex max-w-[760px] list-disc flex-col gap-2 pl-5 text-base leading-7">
          {TIPS.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>

        <h2 className="mt-8 text-2xl leading-8 font-semibold">Free and Pro</h2>
        <p className="mt-3 max-w-[760px] text-base leading-7">
          Downloads at 1080p are free and carry a small brandbite mark in the corner. Customers on a
          brandbite plan also get 4K downloads, video and no mark. The devices are our own generic
          designs, so they are safe to use in your marketing.
        </p>

        <h2 className="mt-8 text-2xl leading-8 font-semibold">Related free tools</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {[
            { href: "/sizes", label: "Social media size guide" },
            { href: "/colors/color-palette-generator", label: "Color palette generator" },
            { href: "/brief-generator", label: "Creative brief generator" },
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
