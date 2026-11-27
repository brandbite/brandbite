// -----------------------------------------------------------------------------
// @file: app/image-converter/page.tsx
// @purpose: Image converter and compressor (PNG, JPG, WebP). The tool is
//           client-side; the steps and questions below it are in the first
//           HTML for search engines and readers.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import Image from "next/image";

import { StudioShell } from "@/components/colors/studio/studio-shell";
import { ImageConverter } from "@/components/image-tools/image-converter";
import { JsonLd } from "@/components/seo/json-ld";
import { SwitchTool } from "@/components/tools/switch-tool";
import { ToolFaq, ToolNote, ToolSteps, type ToolFaqItem } from "@/components/tools/tool-page";
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

const STEPS = [
  {
    title: "Add your images",
    text: "Choose JPG, PNG or WebP files.",
    // An arrow up out of a tray.
    icon: "M12 15V4M7 9l5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4",
  },
  {
    title: "Set your options",
    text: "Choose format, quality and maximum width.",
    // Three sliders.
    icon: "M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4",
  },
  {
    title: "Convert and download",
    text: "Get files individually or in one ZIP.",
    // An arrow down into a tray.
    icon: "M12 4v11M7 10l5 5 5-5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4",
  },
];

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

const FAQ: ToolFaqItem[] = [
  {
    question: "Which image formats are supported?",
    answer:
      "PNG, JPG and WebP, both to convert from and to convert to. You can add up to 30 images at a time, each up to 25 MB.",
  },
  {
    question: "Will this upscale small images?",
    answer:
      "No. The maximum width only makes wider images smaller. An image that is already narrower keeps its size, and every image keeps its proportions.",
  },
  {
    question: "Are my images uploaded to a server?",
    answer:
      "No. Your images are read and converted by your own browser, on your device. They are not uploaded to brandbite or anywhere else, which is also why converting is quick.",
  },
  {
    question: "Which format should I choose?",
    answer: (
      <dl className="flex flex-col gap-3">
        {FORMATS.map((format) => (
          <div key={format.title}>
            <dt className="font-semibold text-[var(--cs-text)]">{format.title}</dt>
            <dd>{format.body}</dd>
          </div>
        ))}
      </dl>
    ),
  },
  {
    question: "How do I get smaller files?",
    answer: (
      <ul className="flex list-disc flex-col gap-2 pl-5">
        {TIPS.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
    ),
  },
];

export default function ImageConverterPage() {
  return (
    <StudioShell
      label="FREE TOOLS"
      nav={null}
      title="Image converter."
      accent="Ready to go."
      accentBelow
      blurb="Convert JPG, PNG and WebP in your browser."
      action={<SwitchTool current="image-converter" />}
      aside={
        <Image
          src="/tools/image-converter-hero.webp"
          alt=""
          width={683}
          height={640}
          priority
          className="-my-4 h-[250px] w-auto max-[1023px]:h-[200px]"
        />
      }
      closing="ready"
    >
      <JsonLd
        data={[
          webApplicationJsonLd({ ...TOOL, category: "MultimediaApplication" }),
          breadcrumbJsonLd([{ name: TOOL.name, path: TOOL.path }]),
        ]}
      />

      <ToolNote
        title="Your images stay in your browser."
        text="We don't upload or store your files on our servers."
      />

      <ImageConverter />

      <ToolSteps steps={STEPS} labelId="converter-steps-heading" />

      <ToolFaq items={FAQ} labelId="converter-faq-heading" />
    </StudioShell>
  );
}
