// -----------------------------------------------------------------------------
// @file: app/tools/page.tsx
// @purpose: Every free brandbite tool on one public page, in the same three
//           groups the footer shows. The footer's "Explore all tools" leads
//           here. No account is needed for any of them.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import Link from "next/link";

import { StudioShell } from "@/components/colors/studio/studio-shell";
import { JsonLd } from "@/components/seo/json-ld";
import { TOOL_ICONS } from "@/components/tools/tool-icons";
import { pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd } from "@/lib/seo/structured-data";
import { PUBLIC_TOOL_GROUPS, PUBLIC_TOOL_TONES } from "@/lib/tools/public-tools";

const PAGE = {
  name: "Free Tools",
  path: "/tools",
  description:
    "Free design and marketing tools from brandbite: color palettes, mockups, image resizing and converting, QR codes, email signatures, newsletters, briefs and more. No sign-up.",
};

export const metadata: Metadata = pageMetadata({
  title: "Free Design and Marketing Tools",
  description: PAGE.description,
  path: PAGE.path,
});

const TOOL_COUNT = PUBLIC_TOOL_GROUPS.reduce((sum, group) => sum + group.tools.length, 0);

export default function ToolsPage() {
  return (
    <StudioShell
      label="FREE TOOLS"
      nav={null}
      title="Find your next"
      accent="creative shortcut."
      blurb={`${TOOL_COUNT} free tools for your brand, your images and your words. No sign-up needed.`}
      ctaHeading="Tools get you started."
      ctaHeadingAccent="A team gets it done."
      ctaBlurb="Need the design itself? Send a request to brandbite and get it on one subscription."
    >
      <JsonLd data={[breadcrumbJsonLd([{ name: PAGE.name, path: PAGE.path }])]} />

      {PUBLIC_TOOL_GROUPS.map((group) => {
        const tone = PUBLIC_TOOL_TONES[group.tone];
        const headingId = `tools-${group.id}`;
        return (
          <section
            key={group.id}
            aria-labelledby={headingId}
            className="rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-8 max-[767px]:p-5"
          >
            <h2 id={headingId} className="text-2xl leading-8 font-semibold">
              {group.title}
            </h2>
            <p className="mt-1 text-base leading-6 text-[var(--cs-muted)]">{group.note}</p>
            <ul className="mt-5 grid grid-cols-3 gap-4 max-[1023px]:grid-cols-2 max-[639px]:grid-cols-1">
              {group.tools.map((item) => {
                const Icon = TOOL_ICONS[item.icon];
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className="flex h-full items-start gap-4 rounded-xl border border-[var(--cs-border)] p-4 transition-colors hover:border-[var(--cs-text)]"
                    >
                      <span
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${tone.tile} ${tone.glyph}`}
                      >
                        <Icon width={22} height={22} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-base leading-6 font-semibold">
                          {item.label}
                        </span>
                        <span className="mt-0.5 block text-sm leading-5 text-[var(--cs-muted)]">
                          {item.description}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </StudioShell>
  );
}
