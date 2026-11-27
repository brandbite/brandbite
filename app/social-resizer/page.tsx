// -----------------------------------------------------------------------------
// @file: app/social-resizer/page.tsx
// @purpose: Social resizer: one image cropped to every social media size.
//           The tool is client-side; the steps and questions below it are in
//           the first HTML for search engines and readers.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { StudioShell } from "@/components/colors/studio/studio-shell";
import { SocialResizer } from "@/components/image-tools/social-resizer";
import { JsonLd } from "@/components/seo/json-ld";
import { SwitchTool } from "@/components/tools/switch-tool";
import { ToolFaq, ToolNote, ToolSteps, type ToolFaqItem } from "@/components/tools/tool-page";
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

const STRIP = [
  {
    title: "Upload an image",
    text: "Add your picture as a JPG, PNG or WebP.",
    // An arrow up out of a tray.
    icon: "M12 15V4M7 9l5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4",
  },
  {
    title: "Choose formats",
    text: "Pick the platforms and the sizes you need.",
    // Three stacked sheets.
    icon: "M12 3l9 5-9 5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5",
  },
  {
    title: "Adjust and download",
    text: "Fine-tune the crop and download your images.",
    // Crop marks.
    icon: "M7 3v14h14M3 7h14v14",
  },
];

const HOW_TO = [
  {
    title: "Choose your image",
    body: "A PNG, JPG or WebP. Start with the largest version you have; it is resized in your browser.",
  },
  {
    title: "Switch on your platforms",
    body: "Each platform ticks its most used sizes for you. Tick or untick any size in its list.",
  },
  {
    title: "Decide what happens to the edges",
    body: "Crop to fill cuts what doesn't fit: press Adjust crop on a size, then drag and zoom to choose the part it keeps. Fit inside keeps the whole image and fills the rest with a color.",
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

const LINK = "font-semibold text-[var(--cs-text)] underline";

const FAQ: ToolFaqItem[] = [
  {
    question: "Which formats are supported?",
    answer:
      "You can add a PNG, JPG or WebP of up to 25 MB, and download the sizes as JPG or PNG. Several sizes at once come as one zip.",
  },
  {
    question: "How does crop to fill work?",
    answer:
      "Crop to fill covers the whole size with your image and cuts what doesn't fit, evenly from both sides. Press Adjust crop on a size to drag and zoom to the part it should keep. Fit inside does the opposite: it keeps the whole image and fills the rest with a color you choose.",
  },
  {
    question: "What does AI resize do?",
    answer:
      "Resize with AI lays your design out again for the shape of a size instead of cutting it. It is included with every brandbite plan, with a daily limit per company. For this, the image is sent to our AI service; everything else stays in your browser. The AI redraws the picture, so read the text and look at faces and logos before you post it.",
  },
  {
    question: "Where do the sizes come from?",
    answer: (
      <>
        The sizes are the same ones as in our{" "}
        <Link href="/sizes" className={LINK}>
          social media size guide
        </Link>
        , which lists each platform&apos;s sources and when the numbers were last checked. When a
        platform changes a size, both update together.
      </>
    ),
  },
  {
    question: "How do I resize an image for social media?",
    answer: (
      <ol className="flex list-decimal flex-col gap-2 pl-5">
        {HOW_TO.map((step) => (
          <li key={step.title}>
            <span className="font-semibold text-[var(--cs-text)]">{step.title}.</span> {step.body}
          </li>
        ))}
      </ol>
    ),
  },
  {
    question: "How do I make an image that survives a crop?",
    answer: (
      <ul className="flex list-disc flex-col gap-2 pl-5">
        {TIPS.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
    ),
  },
];

export default function SocialResizerPage() {
  return (
    <StudioShell
      label="FREE TOOLS"
      nav={null}
      title="Social resizer."
      accent="One image, every format."
      accentBelow
      blurb="Resize your image for Instagram, Facebook, LinkedIn and more."
      action={<SwitchTool current="social-resizer" />}
      aside={
        <Image
          src="/tools/social-resizer-hero.webp"
          alt=""
          width={854}
          height={640}
          priority
          className="-my-4 h-[250px] w-auto max-[1023px]:h-[200px]"
        />
      }
      closing="ready"
    >
      <JsonLd
        data={[
          webApplicationJsonLd({ ...TOOL, category: "DesignApplication" }),
          breadcrumbJsonLd([{ name: TOOL.name, path: TOOL.path }]),
        ]}
      />

      <ToolNote
        title="Resizing happens in your browser."
        text="Your image is sent to us only if you use Resize with AI."
      />

      <SocialResizer />

      <ToolSteps steps={STRIP} labelId="resizer-steps-heading" />

      <ToolFaq items={FAQ} labelId="resizer-faq-heading" />
    </StudioShell>
  );
}
