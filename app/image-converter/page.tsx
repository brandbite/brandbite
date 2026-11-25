// -----------------------------------------------------------------------------
// @file: app/image-converter/page.tsx
// @purpose: Image converter and compressor (PNG, JPG, WebP). The tool is
//           client-side; the guide below it is in the first HTML for search
//           engines and readers.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import Link from "next/link";

import { StudioShell } from "@/components/colors/studio/studio-shell";
import { ImageConverter } from "@/components/image-tools/image-converter";
import { JsonLd } from "@/components/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, webApplicationJsonLd } from "@/lib/seo/structured-data";

const TOOL = {
  name: "Image Converter and Compressor",
  path: "/image-converter",
  description:
    "Convert and compress PNG, JPG and WebP images in your browser. Choose the format, quality and maximum width, then download them one by one or as a zip. Free, nothing is uploaded.",
};

export const metadata: Metadata = pageMetadata({
  title: "Free Image Converter: PNG, JPG, WebP",
  description: TOOL.description,
  path: TOOL.path,
});

const FORMATS = [
  {
    title: "WebP",
    body: "The smallest files for the web, for photos and graphics alike, with transparency. Every current browser shows it.",
  },
  {
    title: "JPG",
    body: "Photos, and anywhere WebP isn't accepted: email, older tools, print shops. No transparency; see-through areas become white.",
  },
  {
    title: "PNG",
    body: "Logos, screenshots and graphics with sharp edges or transparency, when every pixel must stay exact. The largest of the three.",
  },
];

const TIPS = [
  "Set a maximum width. A photo straight from a phone is far wider than any website shows it.",
  "For photos, quality 75 to 85 is hard to tell from the original and far smaller.",
  "Convert from the original, not from a copy that was already compressed. Each round of JPG or WebP loses a little more.",
  "Check text and logos after converting to JPG. If their edges look fuzzy, use PNG or WebP.",
  "A PNG converted to PNG won't shrink. To make it smaller, change the format or the width.",
];

export default function ImageConverterPage() {
  return (
    <StudioShell
      label="IMAGE CONVERTER"
      nav={null}
      title="Convert and compress"
      accent="images."
      blurb="PNG, JPG and WebP, at the quality and width you choose. Nothing leaves your browser."
      ctaHeading="Smaller files."
      ctaHeadingAccent="Same great design."
      ctaBlurb="Need the images themselves designed? Send a request to brandbite and get them back ready to use."
    >
      <JsonLd
        data={[
          webApplicationJsonLd({ ...TOOL, category: "MultimediaApplication" }),
          breadcrumbJsonLd([{ name: TOOL.name, path: TOOL.path }]),
        ]}
      />

      <ImageConverter />

      <section
        aria-labelledby="converter-formats-heading"
        className="mt-6 rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-8 max-[767px]:p-5"
      >
        <h2 id="converter-formats-heading" className="text-2xl leading-8 font-semibold">
          Which format should you choose?
        </h2>
        <ul className="mt-4 grid grid-cols-3 gap-x-8 gap-y-5 max-[767px]:grid-cols-1">
          {FORMATS.map((format) => (
            <li key={format.title}>
              <h3 className="text-base leading-6 font-semibold">{format.title}</h3>
              <p className="mt-1 text-base leading-6 text-[var(--cs-muted)]">{format.body}</p>
            </li>
          ))}
        </ul>

        <h2 className="mt-8 text-2xl leading-8 font-semibold">Is it private?</h2>
        <p className="mt-3 max-w-[760px] text-base leading-7">
          Yes. Your images are read and converted by your own browser, on your device. They are not
          uploaded to brandbite or anywhere else, which is also why converting is quick.
        </p>

        <h2 className="mt-8 text-2xl leading-8 font-semibold">Tips for smaller images</h2>
        <ul className="mt-4 flex max-w-[760px] list-disc flex-col gap-2 pl-5 text-base leading-7">
          {TIPS.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>

        <h2 className="mt-8 text-2xl leading-8 font-semibold">Related free tools</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {[
            { href: "/social-resizer", label: "Social media resizer" },
            { href: "/sizes", label: "Social media size guide" },
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
