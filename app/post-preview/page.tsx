// -----------------------------------------------------------------------------
// @file: app/post-preview/page.tsx
// @purpose: Post and ad preview. The tool is client-side; the guide below it
//           is in the first HTML for search engines and readers.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import Link from "next/link";

import { StudioShell } from "@/components/colors/studio/studio-shell";
import { PostPreview } from "@/components/post-preview/post-preview";
import { JsonLd } from "@/components/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, webApplicationJsonLd } from "@/lib/seo/structured-data";

const TOOL = {
  name: "Social Post Preview",
  path: "/post-preview",
  description:
    "See how an image and caption will sit in a social feed or a full-screen story before you post: where the caption is cut and which areas the app's own buttons cover. Free, in your browser.",
};

export const metadata: Metadata = pageMetadata({
  title: "Social Media Post Preview Tool",
  description: TOOL.description,
  path: TOOL.path,
});

const CHECKS = [
  {
    title: "Does the first line carry the message?",
    body: "Feeds show a line or two of the caption and hide the rest. If the offer or the date is in line four, most people never see it.",
  },
  {
    title: "Is anything important under a button?",
    body: "In stories and full-screen video, the top and bottom are covered by the account name, the reply box and action buttons. Keep text and logos in the middle.",
  },
  {
    title: "Does the image have the right shape?",
    body: "An image in another shape is cropped to fit. Check that faces, products and text survive the cut.",
  },
  {
    title: "Is it readable at phone size?",
    body: "Most people see the post a few centimeters wide. Text that looked fine on your monitor may be too small in a feed.",
  },
];

export default function PostPreviewPage() {
  return (
    <StudioShell
      label="POST PREVIEW"
      nav={null}
      title="See your post"
      accent="before you post it."
      blurb="Drop in the visual and the caption, pick where it will appear, and check how it lands."
      ctaHeading="Looks right."
      ctaHeadingAccent="Designed right."
      ctaBlurb="Need the post itself designed? Send a request to brandbite and get it back in every size."
    >
      <JsonLd
        data={[
          webApplicationJsonLd({ ...TOOL, category: "DesignApplication" }),
          breadcrumbJsonLd([{ name: TOOL.name, path: TOOL.path }]),
        ]}
      />

      <PostPreview />

      <section
        aria-labelledby="preview-checks-heading"
        className="mt-6 rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-8 max-[767px]:p-5"
      >
        <h2 id="preview-checks-heading" className="text-2xl leading-8 font-semibold">
          Four things to check before you post
        </h2>
        <ol className="mt-4 grid grid-cols-2 gap-x-8 gap-y-5 max-[767px]:grid-cols-1">
          {CHECKS.map((check, index) => (
            <li key={check.title} className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--cs-soft)] text-sm font-semibold text-[var(--cs-soft-text)]">
                {index + 1}
              </span>
              <div>
                <h3 className="text-base leading-6 font-semibold">{check.title}</h3>
                <p className="mt-1 text-base leading-6 text-[var(--cs-muted)]">{check.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <h2 className="mt-8 text-2xl leading-8 font-semibold">How close is the preview?</h2>
        <p className="mt-3 max-w-[760px] text-base leading-7">
          The frames are plain on purpose. They show the layout: the shape of the picture, where the
          caption sits and what is covered. They are not a copy of any app, and apps change their
          look often. The sizes and covered areas come from our{" "}
          <Link href="/sizes" className="font-semibold underline">
            social media size guide
          </Link>
          , which lists each platform&apos;s sources.
        </p>

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
