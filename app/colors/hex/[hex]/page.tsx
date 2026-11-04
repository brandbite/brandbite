// -----------------------------------------------------------------------------
// @file: app/colors/hex/[hex]/page.tsx
// @purpose: A page for one color: values, shades, contrast, pairings and meaning,
//           all computed and in the first HTML. Only named colors are indexed; any
//           other HEX still works, for visitors, but stays out of search results.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ColorActions, ColorValues } from "@/components/colors/studio/color-page-actions";
import { StudioShell, WorkspacePanel } from "@/components/colors/studio/studio-shell";
import {
  describeColor,
  evaluateContrast,
  formatContrastRatio,
  formatHex,
  formatHsl,
  formatRgb,
  hexToHsl,
  hexToRgb,
  parseOpaqueHex,
  readableTextOn,
  suggestPairings,
  tailwindScale,
} from "@/lib/colors";
import { COLOR_FAMILIES } from "@/lib/colors/color-families";
import { findNamedColor, NAMED_COLORS } from "@/lib/colors/named-colors";
import { MEANING_GUIDANCE } from "@/lib/colors/meaning-guidance";

type PageProps = { params: Promise<{ hex: string }> };

export function generateStaticParams() {
  return NAMED_COLORS.map((color) => ({ hex: color.hex.slice(1) }));
}

function colorFromParam(param: string) {
  const hex = parseOpaqueHex(param);
  if (!hex) return null;
  const named = findNamedColor(hex);
  const described = describeColor(hex);
  return {
    hex,
    label: formatHex(hex),
    name: named?.name ?? described.name,
    isNamed: named !== null,
    family: described.family,
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const color = colorFromParam((await params).hex);
  if (!color) return { title: "Color not found", robots: { index: false, follow: false } };

  const rgb = formatRgb(hexToRgb(color.hex));
  return {
    title: `${color.name} Hex Code ${color.label}`,
    description: `${color.name} is ${color.label}, or ${rgb}. See its shades, contrast with white and black, colors that pair with it, and what it can communicate.`,
    alternates: { canonical: `/colors/hex/${color.hex.slice(1)}` },
    robots: color.isNamed ? undefined : { index: false, follow: true },
  };
}

function Verdict({ label, ratio, passes }: { label: string; ratio: string; passes: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm leading-5">
      <span>{label}</span>
      <span className="font-medium">
        {ratio}, {passes ? "passes AA" : "below AA"} for normal text
      </span>
    </div>
  );
}

export default async function ColorPage({ params }: PageProps) {
  // proxy.ts has already redirected other spellings and answered 404 for bad values.
  const color = colorFromParam((await params).hex);
  if (!color) notFound();

  const rgb = formatRgb(hexToRgb(color.hex));
  const hsl = formatHsl(hexToHsl(color.hex));
  const onWhite = evaluateContrast(color.hex, "#ffffff");
  const onBlack = evaluateContrast(color.hex, "#000000");
  const family = COLOR_FAMILIES.find((f) => f.slug === color.family);
  const guidance = MEANING_GUIDANCE[color.family];
  const related = NAMED_COLORS.filter(
    (c) => c.hex !== color.hex && describeColor(c.hex).family === color.family,
  ).slice(0, 12);

  return (
    <StudioShell
      title={color.name}
      accent={color.label}
      blurb={`${color.name} has the HEX code ${color.label}, RGB value ${rgb} and HSL value ${hsl}.`}
      breadcrumb="Color library"
    >
      <WorkspacePanel>
        <div className="grid grid-cols-2 gap-6 max-[767px]:grid-cols-1">
          <div
            role="img"
            aria-label={`${color.name} color swatch`}
            className="flex min-h-48 items-end rounded-2xl border border-[var(--cs-border)] p-4 font-mono text-sm leading-5"
            style={{ backgroundColor: color.hex, color: readableTextOn(color.hex) }}
          >
            {color.label}
          </div>
          <div className="min-w-0">
            <h2 className="mb-3 text-2xl leading-8 font-semibold">Color values</h2>
            <ColorValues hex={color.label} rgb={rgb} hsl={hsl} />
            <ColorActions hex={color.hex} name={color.name} />
          </div>
        </div>
      </WorkspacePanel>

      <WorkspacePanel>
        <h2 className="text-2xl leading-8 font-semibold">{color.name} shades</h2>
        <p className="mt-1 mb-4 text-sm leading-5 text-[var(--cs-muted)]">
          A Tailwind-style scale built from {color.label}.
        </p>
        <ul className="grid grid-cols-11 gap-2 max-[1023px]:grid-cols-6 max-[479px]:grid-cols-3">
          {tailwindScale(color.hex).map((shade) => (
            <li
              key={shade.stop}
              className="min-w-0 overflow-hidden rounded-[10px] border border-[var(--cs-border)]"
            >
              <div
                className="h-14 p-1.5 text-sm leading-5 font-semibold"
                style={{ backgroundColor: shade.hex, color: readableTextOn(shade.hex) }}
              >
                {shade.stop}
              </div>
              <p className="px-1 py-1 text-center font-mono text-xs leading-4 break-all">
                {formatHex(shade.hex)}
              </p>
            </li>
          ))}
        </ul>
      </WorkspacePanel>

      <div className="grid grid-cols-2 gap-6 max-[767px]:grid-cols-1">
        <WorkspacePanel>
          <h2 className="text-2xl leading-8 font-semibold">Text contrast</h2>
          <p className="mt-1 mb-3 text-sm leading-5 text-[var(--cs-muted)]">
            How {color.name} reads as text, by WCAG 2.2.
          </p>
          <div className="divide-y divide-[var(--cs-border)]">
            <Verdict
              label="On white"
              ratio={formatContrastRatio(onWhite.ratio)}
              passes={onWhite.aaNormal}
            />
            <Verdict
              label="On black"
              ratio={formatContrastRatio(onBlack.ratio)}
              passes={onBlack.aaNormal}
            />
          </div>
        </WorkspacePanel>
        <WorkspacePanel>
          <h2 className="text-2xl leading-8 font-semibold">Colors that pair with it</h2>
          <p className="mt-1 mb-3 text-sm leading-5 text-[var(--cs-muted)]">
            Its complement, a neighbor, a light tint and a dark shade.
          </p>
          <ul className="grid grid-cols-4 gap-2">
            {suggestPairings(color.hex).map((pairing) => (
              <li key={pairing} className="min-w-0">
                <div
                  className="h-14 rounded-[10px] border border-[var(--cs-border)]"
                  style={{ backgroundColor: pairing }}
                />
                <p className="mt-1 text-center font-mono text-xs leading-4 break-all">
                  {formatHex(pairing)}
                </p>
              </li>
            ))}
          </ul>
        </WorkspacePanel>
      </div>

      {family ? (
        <WorkspacePanel>
          <h2 className="text-2xl leading-8 font-semibold">
            What {family.name.toLowerCase()} can communicate
          </h2>
          <p className="mt-2 text-base leading-6">{family.summary}</p>
          {guidance ? (
            <>
              <p className="mt-2 text-sm leading-5 text-[var(--cs-muted)]">
                {guidance.culturalContext}
              </p>
              <p className="mt-2 text-sm leading-5">
                Often used for: {guidance.worksWellFor.join(", ")}.
              </p>
            </>
          ) : null}
          <Link
            href={`/colors/color-meanings/${family.slug}`}
            className="mt-3 inline-block text-sm leading-5 font-medium text-[var(--cs-brand-strong)] underline"
          >
            More about {family.name.toLowerCase()}
          </Link>
        </WorkspacePanel>
      ) : null}

      {related.length > 0 ? (
        <WorkspacePanel>
          <h2 className="mb-4 text-2xl leading-8 font-semibold">Related colors</h2>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
            {related.map((c) => (
              <li key={c.hex}>
                <Link
                  href={`/colors/hex/${c.hex.slice(1)}`}
                  className="flex min-h-11 items-center gap-2 rounded-[10px] border border-[var(--cs-border)] p-2 text-sm leading-5 font-medium hover:border-[var(--cs-text)]"
                >
                  <span
                    className="h-6 w-6 shrink-0 rounded-md border border-[var(--cs-border)]"
                    style={{ backgroundColor: c.hex }}
                  />
                  <span className="min-w-0 truncate">{c.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </WorkspacePanel>
      ) : null}
    </StudioShell>
  );
}
