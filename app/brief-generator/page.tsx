// -----------------------------------------------------------------------------
// @file: app/brief-generator/page.tsx
// @purpose: Free creative brief generator. The tool is client-side; the guide
//           below it is in the first HTML for search engines and readers.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import Link from "next/link";

import { BriefGenerator } from "@/components/brief/brief-generator";
import { StudioShell } from "@/components/colors/studio/studio-shell";
import { JsonLd } from "@/components/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, webApplicationJsonLd } from "@/lib/seo/structured-data";

const TOOL = {
  name: "Creative Brief Generator",
  path: "/brief-generator",
  description:
    "Write a clear creative brief in minutes: answer a few guided questions, then copy it, download it or save it as a PDF. Free, no sign-up.",
};

export const metadata: Metadata = pageMetadata({
  title: "Free Creative Brief Generator and Template",
  description: TOOL.description,
  path: TOOL.path,
  image: "/brief-generator/opengraph-image",
});

const CONTENTS = [
  {
    title: "The project",
    body: "What you need and a one-line summary. If a designer can't repeat the summary back to you, it isn't clear yet.",
  },
  {
    title: "Background",
    body: "Who you are and who the work is for. Describe the audience as people: what they care about, what they already think of you, and what would make them stop scrolling.",
  },
  {
    title: "The goal",
    body: 'What should change because of this work, and how you will know. "More awareness" is hard to design for; "300 trial sign-ups in two weeks" is not.',
  },
  {
    title: "Message and tone",
    body: "The one thing people should remember, and three words for how it should feel. Add what must appear and anything to stay away from.",
  },
  {
    title: "Deliverables",
    body: "Every file you expect, with sizes and formats. This is where most back-and-forth comes from, so be specific.",
  },
  {
    title: "Brand",
    body: "Colors, fonts and references. Links to work you like help most when you say what you like about it.",
  },
  {
    title: "Timeline",
    body: "The deadline, how many rounds of revisions you expect and, if it matters, the budget.",
  },
];

const TIPS = [
  "Write it before you talk to a designer, not after. A brief is how you find out what you actually want.",
  "One brief, one goal. If you have two goals, you probably have two projects.",
  "Say what success looks like in numbers where you can.",
  "Show, don't only tell: a reference and one sentence about it beats a paragraph of adjectives.",
  "List the exact sizes. A post, a story and an ad are three different designs.",
  "Keep it to one page. If it's longer, the important parts get missed.",
];

export default function BriefGeneratorPage() {
  return (
    <StudioShell
      label="BRIEF GENERATOR"
      nav={null}
      title="Write a creative brief"
      accent="in minutes."
      blurb="Answer a few guided questions. Copy the brief, download it, or save it as a PDF."
      ctaHeading="Good brief."
      ctaHeadingAccent="Better creative."
      ctaBlurb="Send your brief to brandbite and get the design back, on one simple subscription."
    >
      <JsonLd
        data={[
          webApplicationJsonLd({ ...TOOL, category: "BusinessApplication" }),
          breadcrumbJsonLd([{ name: TOOL.name, path: TOOL.path }]),
        ]}
      />

      <BriefGenerator />

      <section
        aria-labelledby="what-heading"
        className="mt-6 rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-8 max-[767px]:p-5"
      >
        <h2 id="what-heading" className="text-2xl leading-8 font-semibold">
          What is a creative brief?
        </h2>
        <p className="mt-3 max-w-[760px] text-base leading-7">
          A creative brief is a short document that tells a designer what to make, who it&apos;s for
          and why. It is the starting point for a logo, a campaign, a website or a single social
          post. A good one saves rounds of revisions, because everyone agrees on the goal before the
          first draft.
        </p>

        <h2 className="mt-8 text-2xl leading-8 font-semibold">What to put in a creative brief</h2>
        <ol className="mt-4 grid grid-cols-2 gap-x-8 gap-y-5 max-[767px]:grid-cols-1">
          {CONTENTS.map((item, index) => (
            <li key={item.title} className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--cs-soft)] text-sm font-semibold text-[var(--cs-soft-text)]">
                {index + 1}
              </span>
              <div>
                <h3 className="text-base leading-6 font-semibold">{item.title}</h3>
                <p className="mt-1 text-base leading-6 text-[var(--cs-muted)]">{item.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <h2 className="mt-8 text-2xl leading-8 font-semibold">Tips for a brief designers love</h2>
        <ul className="mt-4 flex max-w-[760px] list-disc flex-col gap-2 pl-5 text-base leading-7">
          {TIPS.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>

        <h2 className="mt-8 text-2xl leading-8 font-semibold">Related free tools</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {[
            { href: "/sizes", label: "Social media size guide" },
            { href: "/colors/color-palette-generator", label: "Color palette generator" },
            { href: "/colors/contrast-checker", label: "Contrast checker" },
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
