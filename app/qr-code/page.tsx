// -----------------------------------------------------------------------------
// @file: app/qr-code/page.tsx
// @purpose: Branded QR code generator. The tool is client-side; the steps and
//           questions below it are in the first HTML for search engines and
//           readers.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import Image from "next/image";

import { StudioShell } from "@/components/colors/studio/studio-shell";
import { QrCodeGenerator } from "@/components/qr/qr-code-generator";
import { JsonLd } from "@/components/seo/json-ld";
import { SwitchTool } from "@/components/tools/switch-tool";
import { ToolFaq, ToolNote, ToolSteps, type ToolFaqItem } from "@/components/tools/tool-page";
import { pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, webApplicationJsonLd } from "@/lib/seo/structured-data";

const TOOL = {
  name: "QR Code Generator",
  path: "/qr-code",
  description:
    "Make a QR code in your brand colors, with your logo in the middle. Download it as SVG or PNG. Free, no sign-up; the code never expires and scans are not tracked.",
};

export const metadata: Metadata = pageMetadata({
  title: "Free QR Code Generator with Logo and Colors",
  description: TOOL.description,
  path: TOOL.path,
});

const STRIP = [
  {
    title: "Add a link or text",
    text: "Enter a web address or any text you want to share.",
    // A pencil.
    icon: "M4 20l4-1 11-11-3-3L5 16zM14 7l3 3",
  },
  {
    title: "Customize your code",
    text: "Choose the shape and colors, and add your logo.",
    // Three sliders.
    icon: "M4 6h16M4 12h16M4 18h16M14 4v4M8 10v4M16 16v4",
  },
  {
    title: "Export and test",
    text: "Download your QR code and test it on your phone.",
    // An arrow down into a tray.
    icon: "M12 4v11M7 10l5 5 5-5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4",
  },
];

const TIPS = [
  "Keep the code dark and the background light. Phone cameras read that fastest.",
  "Leave the empty margin around the code. Without it, scanners can't find the corners.",
  "Print it at least 2 cm (about 0.8 in) wide, and larger the farther away people stand.",
  "Shorter links make simpler codes that scan from farther away and survive small print.",
  "Test the printed proof with two different phones before the full print run.",
  "Use the SVG for print. It stays sharp on a business card and on a billboard.",
];

const FAQ: ToolFaqItem[] = [
  {
    question: "Will my code expire?",
    answer:
      "No. The link is stored in the picture itself, not on our servers, so the code keeps working for as long as the link it points to does.",
  },
  {
    question: "Which format should I download?",
    answer:
      "Use the SVG for print: it stays sharp at any size, from a business card to a billboard. Use a PNG for screens and documents; 1024px is enough for most, and 2048px is there when you need it larger.",
  },
  {
    question: "Can I add my logo?",
    answer:
      "Yes. Add a PNG, JPG, WebP or SVG of up to 2 MB and it sits in the middle of the code. The code is then made with the highest level of error correction, which lets it be read with part of it covered. Keep the colors high-contrast and test it before printing.",
  },
  {
    question: "Are scans tracked?",
    answer:
      "No. A phone that scans the code goes straight to your link. Nothing passes through brandbite, so we can't count scans. If you need numbers, add tracking parameters to the link and read them in your own analytics.",
  },
  {
    question: "Can I change the link after printing?",
    answer:
      "Not in the code itself. To keep that option, point the code at a page on your own site that you can redirect later.",
  },
  {
    question: "How do I make a QR code that always scans?",
    answer: (
      <ul className="flex list-disc flex-col gap-2 pl-5">
        {TIPS.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
    ),
  },
];

export default function QrCodePage() {
  return (
    <StudioShell
      label="FREE TOOLS"
      nav={null}
      title="QR code."
      accent="A clear connection."
      accentBelow
      blurb="Turn a link or text into a custom QR code for your brand."
      action={<SwitchTool current="qr-code" />}
      aside={
        <Image
          src="/tools/qr-code-hero.webp"
          alt=""
          width={600}
          height={640}
          priority
          className="-my-4 h-[250px] w-auto max-[1023px]:h-[200px]"
        />
      }
      closing="ready"
    >
      <JsonLd
        data={[
          webApplicationJsonLd({ ...TOOL, category: "UtilitiesApplication" }),
          breadcrumbJsonLd([{ name: TOOL.name, path: TOOL.path }]),
        ]}
      />

      <ToolNote
        title="Static codes. No tracking or expiry."
        text="The code is made in your browser; nothing is sent to us."
      />

      <QrCodeGenerator />

      <ToolSteps steps={STRIP} labelId="qr-steps-heading" />

      <ToolFaq items={FAQ} labelId="qr-faq-heading" />
    </StudioShell>
  );
}
