// -----------------------------------------------------------------------------
// @file: app/email-signature/page.tsx
// @purpose: Email signature generator. The tool is client-side; the guide
//           below it is in the first HTML for search engines and readers.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import Link from "next/link";

import { StudioShell } from "@/components/colors/studio/studio-shell";
import { EmailSignature } from "@/components/email-signature/email-signature";
import { JsonLd } from "@/components/seo/json-ld";
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

const TIPS = [
  "Keep it to what someone needs to reach you: name, role, one phone number, your website.",
  "Use one accent color. A signature is read hundreds of times; restraint ages better.",
  "Host your logo on your own website and keep it small, around 300 pixels wide. Large images slow every email you send.",
  "Skip quotes, disclaimers nobody reads and rows of social icons. Each one makes the signature longer than the message.",
  "Send yourself a test and open it on a phone and in dark mode before you use it for real.",
];

const FAQ = [
  {
    question: "Why can't I upload my logo here?",
    answer:
      "A picture placed inside a signature's text is removed by most mail apps. A logo shows reliably only when it is loaded from a web address, so the tool asks for the address of your logo on your own website.",
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
];

export default function EmailSignaturePage() {
  return (
    <StudioShell
      label="EMAIL SIGNATURE"
      nav={null}
      title="An email signature"
      accent="in your brand."
      blurb="Fill in a few fields, pick your color, copy it into your mail app."
      ctaHeading="A signature that fits."
      ctaHeadingAccent="A brand that lasts."
      ctaBlurb="Need the brand behind it? Send a request to brandbite and get logos, templates and more on one subscription."
    >
      <JsonLd
        data={[
          webApplicationJsonLd({ ...TOOL, category: "BusinessApplication" }),
          breadcrumbJsonLd([{ name: TOOL.name, path: TOOL.path }]),
        ]}
      />

      <EmailSignature />

      <section
        aria-labelledby="signature-tips-heading"
        className="mt-6 rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-8 max-[767px]:p-5"
      >
        <h2 id="signature-tips-heading" className="text-2xl leading-8 font-semibold">
          Tips for a signature people don&apos;t skip
        </h2>
        <ul className="mt-4 flex max-w-[760px] list-disc flex-col gap-2 pl-5 text-base leading-7">
          {TIPS.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>

        <h2 className="mt-8 text-2xl leading-8 font-semibold">Questions</h2>
        <dl className="mt-4 grid grid-cols-3 gap-x-8 gap-y-5 max-[1023px]:grid-cols-1">
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
            { href: "/logo-pack", label: "Logo pack generator" },
            { href: "/qr-code", label: "QR code generator" },
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
