// -----------------------------------------------------------------------------
// @file: app/mockups/page.tsx
// @purpose: Mockup Studio: a free 3D device mockup generator. The tool is
//           client-side; the steps and questions below it are in the first
//           HTML for search engines and readers.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import Image from "next/image";

import { StudioShell } from "@/components/colors/studio/studio-shell";
import { MockupStudio } from "@/components/mockups/mockup-studio";
import { JsonLd } from "@/components/seo/json-ld";
import { SwitchTool } from "@/components/tools/switch-tool";
import { ToolFaq, ToolNote, ToolSteps, type ToolFaqItem } from "@/components/tools/tool-page";
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

const STRIP = [
  {
    title: "Add your screen",
    text: "Upload a screenshot, an image or a short video.",
    // An arrow up out of a tray.
    icon: "M12 15V4M7 9l5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4",
  },
  {
    title: "Set the scene",
    text: "Choose a device, an angle and a background.",
    // A phone.
    icon: "M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM11 18h2",
  },
  {
    title: "Export your mockup",
    text: "Download an image or a video, ready to share.",
    // An arrow down into a tray.
    icon: "M12 4v11M7 10l5 5 5-5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4",
  },
];

const HOW_TO = [
  {
    title: "Add your screenshot or screen recording",
    body: "Choose an image (PNG, JPG, WebP) or a video (MP4, WebM, MOV). It plays on the device's screen in your browser and is never uploaded.",
  },
  {
    title: "Choose the device and angle",
    body: "Phone, tablet or laptop. Start from a preset angle, then drag the device to turn it exactly how you want.",
  },
  {
    title: "Set the scene",
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

const FAQ: ToolFaqItem[] = [
  {
    question: "Which files can I use?",
    answer:
      "An image (PNG, JPG or WebP, up to 15 MB) or a video (MP4, WebM or MOV, up to 200 MB). A video plays on the device's screen. The file stays in your browser and is never uploaded.",
  },
  {
    question: "What is included for free?",
    answer:
      "Every device, angle, scene and motion, and PNG downloads at 1080p. Free downloads carry a small brandbite mark in the corner. Customers on a brandbite plan also get 4K downloads, video and no mark.",
  },
  {
    question: "Can I export video?",
    answer:
      "Yes, on a brandbite plan. Pick a motion, or put a screen recording on the device, and download a 1080p video. It is saved as MP4 where your browser can record it and as WebM otherwise. Video has no transparency, so a transparent scene is recorded on white.",
  },
  {
    question: "What is a device mockup?",
    answer:
      "A device mockup shows your app, website or design on the screen of a phone, tablet or laptop. It turns a flat screenshot into a picture people understand at a glance: this is a real product, and this is what using it looks like. Mockups are used on landing pages, in app store listings, in pitch decks and in social posts.",
  },
  {
    question: "How do I make a 3D mockup?",
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
    question: "How do I make a mockup look real?",
    answer: (
      <ul className="flex list-disc flex-col gap-2 pl-5">
        {TIPS.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
    ),
  },
  {
    question: "Can I use the mockups in my marketing?",
    answer:
      "Yes. The devices are our own generic designs, not copies of a real product, so they are safe to use in your marketing.",
  },
];

export default function MockupStudioPage() {
  return (
    <StudioShell
      label="FREE TOOLS"
      nav={null}
      title="Mockup Studio."
      accent="Your screen, on show."
      accentBelow
      blurb="Choose a device, set the scene and export your mockup."
      action={<SwitchTool current="mockup-studio" />}
      aside={
        <Image
          src="/tools/mockup-studio-hero.webp"
          alt=""
          width={732}
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
        title="Images and video are processed in your browser."
        text="Your file is never uploaded."
      />

      <MockupStudio />

      <ToolSteps steps={STRIP} labelId="mockup-steps-heading" />

      <ToolFaq items={FAQ} labelId="mockup-faq-heading" />
    </StudioShell>
  );
}
