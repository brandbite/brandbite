// -----------------------------------------------------------------------------
// @file: app/email-signature/page.tsx
// @purpose: Email signature generator. The tool is client-side; the steps and
//           questions below it are in the first HTML for search engines and
//           readers.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import Image from "next/image";

import { StudioShell } from "@/components/colors/studio/studio-shell";
import { EmailSignature } from "@/components/email-signature/email-signature";
import { JsonLd } from "@/components/seo/json-ld";
import { SwitchTool } from "@/components/tools/switch-tool";
import { ToolFaq, ToolNote, ToolSteps, type ToolFaqItem } from "@/components/tools/tool-page";
import { pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, webApplicationJsonLd } from "@/lib/seo/structured-data";

const TOOL = {
  name: "Email Signature Generator",
  path: "/email-signature",
  description:
    "Make a clean email signature in your brand color, with your logo, and paste it into Gmail, Outlook or Apple Mail. Free, no sign-up; nothing you type is saved.",
};

export const metadata: Metadata = pageMetadata({
  title: "Free Email Signature Generator",
  description: TOOL.description,
  path: TOOL.path,
});

const STEPS = [
  {
    title: "Add your details",
    text: "Enter your name, role, company and contact info.",
    // A pencil.
    icon: "M4 20l4-1 11-11-3-3L5 16zM14 7l3 3",
  },
  {
    title: "Choose a style",
    text: "Pick a template and set the color, font and size.",
    // A page split into blocks.
    icon: "M4 4h16v6H4zM4 14h7v6H4zM15 14h5v6h-5z",
  },
  {
    title: "Copy and install",
    text: "Copy the signature and add it to your email app.",
    // Two sheets, one over the other.
    icon: "M9 9h11v11H9zM5 15H4V4h11v1",
  },
];

const TIPS = [
  "Keep it to what someone needs to reach you: name, role, one phone number, your website.",
  "Use one accent color. A signature is read hundreds of times; restraint ages better.",
  "Host your logo on your own website and keep it small, around 300 pixels wide. Large images slow every email you send.",
  "Skip quotes, disclaimers nobody reads and rows of social icons. Each one makes the signature longer than the message.",
  "Send yourself a test and open it on a phone and in dark mode before you use it for real.",
];

const FAQ: ToolFaqItem[] = [
  {
    question: "How do I add this to Gmail?",
    answer:
      "Press Copy signature. In Gmail, open Settings, then See all settings, then General, and scroll to Signature. Choose Create new, paste, and save the changes at the bottom of the page.",
  },
  {
    question: "Why does my logo need a web address?",
    answer:
      "A picture placed inside a signature's text is removed by most mail apps. A logo shows reliably only when it is loaded from a web address, so the tool asks for the address of your logo on your own website.",
  },
  {
    question: "Which email apps are supported?",
    answer:
      "The signature is made for Gmail, Outlook and Apple Mail, and the steps for each are in step 3. Most other mail apps take it too: copy the signature and paste it into the app's signature setting, or use the HTML if the app asks for code.",
  },
  {
    question: "Why only four fonts?",
    answer:
      "The font has to exist on the device of whoever reads your email. Arial, Georgia, Verdana and Tahoma are on practically all of them; a brand font would be replaced by something else.",
  },
  {
    question: "Is what I type stored?",
    answer:
      "No. The signature is put together in your browser. Nothing is sent to brandbite and nothing is saved, so copy or download it before you close the page.",
  },
  {
    question: "What makes a good signature?",
    answer: (
      <ul className="flex list-disc flex-col gap-2 pl-5">
        {TIPS.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
    ),
  },
];

export default function EmailSignaturePage() {
  return (
    <StudioShell
      label="FREE TOOLS"
      nav={null}
      title="Email signature."
      accent="Sign off in your style."
      accentBelow
      blurb="Create a professional email signature for your brand."
      action={<SwitchTool current="email-signature" />}
      aside={
        <Image
          src="/tools/email-signature-hero.webp"
          alt=""
          width={611}
          height={640}
          priority
          className="-my-4 h-[250px] w-auto max-[1023px]:h-[200px]"
        />
      }
      closing="ready"
    >
      <JsonLd
        data={[
          webApplicationJsonLd({ ...TOOL, category: "BusinessApplication" }),
          breadcrumbJsonLd([{ name: TOOL.name, path: TOOL.path }]),
        ]}
      />

      <ToolNote
        title="Preview your signature, then copy it into your email app."
        text="Nothing you type is saved or sent to us."
      />

      <EmailSignature />

      <ToolSteps steps={STEPS} labelId="signature-steps-heading" />

      <ToolFaq items={FAQ} labelId="signature-faq-heading" />
    </StudioShell>
  );
}
