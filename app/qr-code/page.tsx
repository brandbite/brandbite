// -----------------------------------------------------------------------------
// @file: app/qr-code/page.tsx
// @purpose: Branded QR code generator. The tool is client-side; the guide
//           below it is in the first HTML for search engines and readers.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import Link from "next/link";

import { StudioShell } from "@/components/colors/studio/studio-shell";
import { QrCodeGenerator } from "@/components/qr/qr-code-generator";
import { JsonLd } from "@/components/seo/json-ld";
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

const TIPS = [
  "Keep the code dark and the background light. Phone cameras read that fastest.",
  "Leave the empty margin around the code. Without it, scanners can't find the corners.",
  "Print it at least 2 cm (about 0.8 in) wide, and larger the farther away people stand.",
  "Shorter links make simpler codes that scan from farther away and survive small print.",
  "Test the printed proof with two different phones before the full print run.",
  "Use the SVG for print. It stays sharp on a business card and on a billboard.",
];

const FAQ = [
  {
    question: "Does the QR code expire?",
    answer:
      "No. The link is stored in the picture itself, not on our servers, so the code keeps working for as long as the link it points to does.",
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
    question: "Will it still scan with a logo on it?",
    answer:
      "Yes. When you add a logo, the code is made with the highest level of error correction, which lets it be read with part of it covered. Keep the colors high-contrast and test it before printing.",
  },
];

export default function QrCodePage() {
  return (
    <StudioShell
      label="QR CODE"
      nav={null}
      title="QR codes"
      accent="in your brand colors."
      blurb="Type a link, pick your colors, add your logo. Download it sharp at any size."
      ctaHeading="A code that fits."
      ctaHeadingAccent="A design that sells."
      ctaBlurb="Need the flyer, menu or packaging the code goes on? Send a request to brandbite."
    >
      <JsonLd
        data={[
          webApplicationJsonLd({ ...TOOL, category: "UtilitiesApplication" }),
          breadcrumbJsonLd([{ name: TOOL.name, path: TOOL.path }]),
        ]}
      />

      <QrCodeGenerator />

      <section
        aria-labelledby="qr-tips-heading"
        className="mt-6 rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-8 max-[767px]:p-5"
      >
        <h2 id="qr-tips-heading" className="text-2xl leading-8 font-semibold">
          Tips for a QR code that always scans
        </h2>
        <ul className="mt-4 flex max-w-[760px] list-disc flex-col gap-2 pl-5 text-base leading-7">
          {TIPS.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>

        <h2 className="mt-8 text-2xl leading-8 font-semibold">Questions</h2>
        <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-5 max-[767px]:grid-cols-1">
          {FAQ.map((item) => (
            <div key={item.question}>
              <dt className="text-base leading-6 font-semibold">{item.question}</dt>
              <dd className="mt-1 text-base leading-6 text-[var(--cs-muted)]">{item.answer}</dd>
            </div>
          ))}
        </dl>

        <h2 className="mt-8 text-2xl leading-8 font-semibold">Related free tools</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {[
            { href: "/colors/contrast-checker", label: "Contrast checker" },
            { href: "/colors/color-palette-generator", label: "Color palette generator" },
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
