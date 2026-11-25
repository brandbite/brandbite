// -----------------------------------------------------------------------------
// @file: app/logo-pack/page.tsx
// @purpose: Logo pack generator. The tool is client-side; the guide below it
//           is in the first HTML for search engines and readers.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import Link from "next/link";

import { StudioShell } from "@/components/colors/studio/studio-shell";
import { LogoPack } from "@/components/logo-pack/logo-pack";
import { JsonLd } from "@/components/seo/json-ld";
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

export default function LogoPackPage() {
  return (
    <StudioShell
      label="LOGO PACK"
      nav={null}
      title="One logo,"
      accent="every file you need."
      blurb="Color, black and white versions, a favicon set and a profile image, in one zip."
      ctaHeading="Have the files."
      ctaHeadingAccent="Need the logo?"
      ctaBlurb="Send a logo or brand identity request to brandbite and get it back with every file, on one simple subscription."
    >
      <JsonLd
        data={[
          webApplicationJsonLd({ ...TOOL, category: "DesignApplication" }),
          breadcrumbJsonLd([{ name: TOOL.name, path: TOOL.path }]),
        ]}
      />

      <LogoPack />

      <section
        aria-labelledby="logo-pack-what-heading"
        className="mt-6 rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-8 max-[767px]:p-5"
      >
        <h2 id="logo-pack-what-heading" className="text-2xl leading-8 font-semibold">
          What is in a logo pack?
        </h2>
        <ul className="mt-4 grid grid-cols-2 gap-x-8 gap-y-5 max-[767px]:grid-cols-1">
          {FILES.map((item) => (
            <li key={item.title}>
              <h3 className="text-base leading-6 font-semibold">{item.title}</h3>
              <p className="mt-1 text-base leading-6 text-[var(--cs-muted)]">{item.body}</p>
            </li>
          ))}
        </ul>

        <h2 className="mt-8 text-2xl leading-8 font-semibold">Free and Pro</h2>
        <p className="mt-3 max-w-[760px] text-base leading-7">
          One 512 pixel PNG of your logo is free. The full pack, with every version and size in one
          zip, is included with every brandbite plan.
        </p>

        <h2 className="mt-8 text-2xl leading-8 font-semibold">Tips for a clean pack</h2>
        <ul className="mt-4 flex max-w-[760px] list-disc flex-col gap-2 pl-5 text-base leading-7">
          {TIPS.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>

        <h2 className="mt-8 text-2xl leading-8 font-semibold">Related free tools</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {[
            { href: "/brand-kit", label: "Brand kit generator" },
            { href: "/qr-code", label: "QR code generator" },
            { href: "/email-signature", label: "Email signature generator" },
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
