// -----------------------------------------------------------------------------
// @file: app/type-scale/page.tsx
// @purpose: Type scale generator. The tool is client-side; the steps and
//           questions below it are in the first HTML for search engines and
//           readers.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import Image from "next/image";

import { StudioShell } from "@/components/colors/studio/studio-shell";
import { JsonLd } from "@/components/seo/json-ld";
import { SwitchTool } from "@/components/tools/switch-tool";
import { ToolFaq, ToolNote, ToolSteps, type ToolFaqItem } from "@/components/tools/tool-page";
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

const STRIP = [
  {
    title: "Set your base",
    text: "Choose a base size and a ratio that fit your brand.",
    // Three sliders.
    icon: "M4 6h16M4 12h16M4 18h16M14 4v4M8 10v4M16 16v4",
  },
  {
    title: "Preview the hierarchy",
    text: "See a complete type scale, from H1 to caption.",
    // Three stacked sheets.
    icon: "M12 3l9 5-9 5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5",
  },
  {
    title: "Copy your scale",
    text: "Export clean CSS, Tailwind or a plain text list.",
    // Code brackets.
    icon: "M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16",
  },
];

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

const FAQ: ToolFaqItem[] = [
  {
    question: "What is a type scale?",
    answer:
      "A type scale is a short list of font sizes that are related by one number, the ratio. You choose the size of your body text; each size above it is the one below multiplied by the ratio. Because every size comes from the same rule, headings and text look like they belong together, and you stop picking sizes by eye.",
  },
  {
    question: "What does the ratio change?",
    answer: (
      <>
        <p>
          The ratio sets how far apart the sizes are. A small ratio keeps headings close to the body
          text; a large one makes them much bigger.
        </p>
        <dl className="mt-3 flex flex-col gap-2">
          {RATIOS.map((ratio) => (
            <div key={ratio.id}>
              <dt className="inline font-semibold text-[var(--cs-text)] tabular-nums">
                {ratio.label} ({ratio.value}).
              </dt>{" "}
              <dd className="inline">{RATIO_NOTES[ratio.id]}</dd>
            </div>
          ))}
        </dl>
      </>
    ),
  },
  {
    question: "Can I export Tailwind values?",
    answer:
      "Yes. Choose Tailwind in step 3 to get a Tailwind v4 @theme block, with classes such as text-h1 and text-base and a line height for each. CSS gives the same sizes as variables, and Text gives a plain list for a brief or a brand guide.",
  },
  {
    question: "What are fluid sizes?",
    answer: (
      <>
        A heading that looks right on a desktop is often too large on a phone. Fluid sizes use the
        CSS <code>clamp()</code> function so a heading grows smoothly with the width of the screen,
        between a smallest and a largest size, without breakpoints. The body size stays the same;
        only the steps between sizes change.
      </>
    ),
  },
  {
    question: "How do I use a type scale well?",
    answer: (
      <ul className="flex list-disc flex-col gap-2 pl-5">
        {TIPS.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
    ),
  },
];

export default function TypeScalePage() {
  return (
    <StudioShell
      label="FREE TOOLS"
      nav={null}
      title="Type scale."
      accent="Find your rhythm."
      accentBelow
      blurb="Set a base size and preview a complete hierarchy."
      action={<SwitchTool current="type-scale" />}
      aside={
        <Image
          src="/tools/type-scale-hero.webp"
          alt=""
          width={761}
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
        title="Everything runs in your browser."
        text="Nothing you set is saved or sent to us."
      />

      <TypeScale />

      <ToolSteps steps={STRIP} labelId="type-scale-steps-heading" />

      <ToolFaq items={FAQ} labelId="type-scale-faq-heading" />
    </StudioShell>
  );
}
