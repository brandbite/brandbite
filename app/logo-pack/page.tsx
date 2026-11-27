// -----------------------------------------------------------------------------
// @file: app/logo-pack/page.tsx
// @purpose: Logo pack generator. The tool is client-side; the steps and
//           questions below it are in the first HTML for search engines and
//           readers.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import Image from "next/image";

import { StudioShell } from "@/components/colors/studio/studio-shell";
import { LogoPack } from "@/components/logo-pack/logo-pack";
import { JsonLd } from "@/components/seo/json-ld";
import { SwitchTool } from "@/components/tools/switch-tool";
import { ToolFaq, ToolNote, ToolSteps, type ToolFaqItem } from "@/components/tools/tool-page";
import { pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, webApplicationJsonLd } from "@/lib/seo/structured-data";

const TOOL = {
  name: "Logo Pack Generator",
  path: "/logo-pack",
  description:
    "Turn one logo file into everything you need: PNGs in color, black and white, a favicon set, an app icon and a social profile image. Made in your browser; your logo is not uploaded.",
};

export const metadata: Metadata = pageMetadata({
  title: "Logo Pack Generator: PNG, Favicon, Profile Image",
  description: TOOL.description,
  path: TOOL.path,
});

const STRIP = [
  {
    title: "Upload your logo",
    text: "Add an SVG or a transparent PNG of your brand mark.",
    // An arrow up out of a tray.
    icon: "M12 15V4M7 9l5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4",
  },
  {
    title: "Review the variants",
    text: "See the color versions, sizes and key formats.",
    // Three stacked sheets.
    icon: "M12 3l9 5-9 5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5",
  },
  {
    title: "Download your pack",
    text: "Get a PNG for free, or the full pack with a plan.",
    // An arrow down into a tray.
    icon: "M12 4v11M7 10l5 5 5-5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4",
  },
];

const FILES = [
  {
    title: "Color, black and white",
    body: "Your logo as it is, plus a solid black version for light backgrounds and a solid white one for dark backgrounds and photos. Each at 512, 1024 and 2048 pixels, with a see-through background.",
  },
  {
    title: "Favicon set",
    body: "favicon.ico and PNGs at 16, 32 and 48 pixels for the browser tab, and a 180 pixel icon for phone home screens.",
  },
  {
    title: "Profile image",
    body: "A 1080 pixel square with your logo centered on your background color, ready for social media profiles.",
  },
  {
    title: "Your source file",
    body: "When you start from an SVG, the original goes into the pack too. That is the file to send to printers and designers.",
  },
];

const TIPS = [
  "Start from an SVG if you have one. It stays sharp at every size; a pixel image goes soft when enlarged.",
  "Use a logo file with a see-through background. A white box around the logo would show on every colored surface.",
  "Pick the icon background from your brand colors, so your favicon and profile image match the rest of your brand.",
  "The black and white versions are solid shapes. If your logo depends on several colors to be readable, check them before you use them.",
];

const FAQ: ToolFaqItem[] = [
  {
    question: "Which logo files can I upload?",
    answer:
      "An SVG, PNG, WebP or JPG of up to 10 MB. An SVG is best because it stays sharp at every size. A PNG with a see-through background works too. Your logo is drawn in your browser and is not uploaded.",
  },
  {
    question: "What is free?",
    answer:
      "One 512 pixel PNG of your logo in its own colors is free, with no sign-up. The full pack, with every version and size in one zip, is included with every brandbite plan.",
  },
  {
    question: "What is inside the full pack?",
    answer: (
      <>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          {FILES.map((item) => (
            <li key={item.title}>
              <span className="font-semibold text-[var(--cs-text)]">{item.title}.</span> {item.body}
            </li>
          ))}
        </ul>
        <p className="mt-3">A short note in the zip explains what each file is for.</p>
      </>
    ),
  },
  {
    question: "How do I get a clean pack?",
    answer: (
      <ul className="flex list-disc flex-col gap-2 pl-5">
        {TIPS.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
    ),
  },
];

export default function LogoPackPage() {
  return (
    <StudioShell
      label="FREE TOOLS"
      nav={null}
      title="Logo pack."
      accent="Ready for everywhere."
      accentBelow
      blurb="Turn one logo into a complete pack: color versions, sizes and formats in seconds."
      action={<SwitchTool current="logo-pack" />}
      aside={
        <Image
          src="/tools/logo-pack-hero.webp"
          alt=""
          width={743}
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
        title="Upload an SVG or transparent PNG for clean results."
        text="Your logo stays in your browser."
      />

      <LogoPack />

      <ToolSteps steps={STRIP} labelId="logo-pack-steps-heading" />

      <ToolFaq items={FAQ} labelId="logo-pack-faq-heading" />
    </StudioShell>
  );
}
