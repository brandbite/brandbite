// -----------------------------------------------------------------------------
// @file: app/colors/palettes/[slug]/page.tsx
// @purpose: A page for one curated palette, in the first HTML, linking to related
//           palettes and back to the gallery.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PaletteActions, PaletteSwatches } from "@/components/colors/studio/color-page-actions";
import { PalettePreview } from "@/components/colors/studio/palette-preview";
import { StudioShell, WorkspacePanel } from "@/components/colors/studio/studio-shell";
import { formatHex, normalizeHex, type StudioPalette } from "@/lib/colors";
import { getPaletteIdea, getPaletteIdeas, type PaletteIdea } from "@/lib/colors/content";
import { findNamedColor } from "@/lib/colors/named-colors";
import { PALETTE_IDEA_CATALOG } from "@/lib/colors/palette-idea-catalog";

// Next.js needs a literal here: CMS changes show up within 5 minutes.
export const revalidate = 300;

type PageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return PALETTE_IDEA_CATALOG.map((idea) => ({ slug: idea.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const idea = await getPaletteIdea((await params).slug);
  if (!idea) return { title: "Palette not found", robots: { index: false, follow: false } };
  const hexes = idea.colors.map((hex) => formatHex(hex)).join(", ");
  return {
    title: `${idea.title} Color Palette`,
    description: `${idea.summary ?? `The ${idea.title} color palette.`} Hex codes: ${hexes}.`,
    alternates: { canonical: `/colors/palettes/${idea.slug}` },
  };
}

function toPalette(idea: PaletteIdea): StudioPalette {
  return {
    id: `idea-${idea.slug}`,
    name: idea.title,
    colors: idea.colors.map((hex, index) => ({
      id: `color-${index}`,
      hex: normalizeHex(hex) ?? "#000000",
      locked: false,
    })),
    roles: {},
    sourceTool: "ideas",
    tags: idea.tags,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

export default async function PalettePage({ params }: PageProps) {
  const { slug } = await params;
  const ideas = await getPaletteIdeas();
  const idea = ideas.find((candidate) => candidate.slug === slug);
  if (!idea) notFound();

  const palette = toPalette(idea);
  const hexes = palette.colors.map((color) => color.hex);
  const related = ideas
    .filter((other) => other.slug !== idea.slug && other.tags.some((t) => idea.tags.includes(t)))
    .slice(0, 6);

  return (
    <StudioShell
      title={idea.title}
      accent="palette."
      blurb={idea.summary ?? "A curated color palette to make your own."}
      breadcrumb="Palette ideas"
    >
      <WorkspacePanel>
        <PaletteSwatches hexes={hexes} />
        <PaletteActions palette={palette} />
      </WorkspacePanel>

      <div className="grid grid-cols-2 gap-6 max-[1023px]:grid-cols-1">
        <WorkspacePanel>
          <h2 className="mb-4 text-2xl leading-8 font-semibold">See it in a design</h2>
          <PalettePreview palette={palette} />
        </WorkspacePanel>
        <WorkspacePanel>
          <h2 className="mb-4 text-2xl leading-8 font-semibold">Colors in this palette</h2>
          <ul className="flex flex-col gap-2">
            {hexes.map((hex, index) => {
              const named = findNamedColor(hex);
              return (
                <li key={`${hex}-${index}`}>
                  <Link
                    href={`/colors/hex/${hex.slice(1)}`}
                    className="flex min-h-11 items-center gap-3 rounded-[10px] border border-[var(--cs-border)] p-2 hover:border-[var(--cs-text)]"
                  >
                    <span
                      className="h-7 w-7 shrink-0 rounded-md border border-[var(--cs-border)]"
                      style={{ backgroundColor: hex }}
                    />
                    <span className="font-mono text-sm leading-5">{formatHex(hex)}</span>
                    {named ? <span className="text-sm leading-5">{named.name}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
          {idea.tags.length > 0 ? (
            <p className="mt-4 text-sm leading-5 text-[var(--cs-muted)]">
              Style: {idea.tags.join(", ")}
            </p>
          ) : null}
        </WorkspacePanel>
      </div>

      {related.length > 0 ? (
        <WorkspacePanel>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-2xl leading-8 font-semibold">Similar palettes</h2>
            <Link
              href="/colors/color-palette-ideas"
              className="text-sm leading-5 font-medium text-[var(--cs-brand-strong)] underline"
            >
              All palette ideas
            </Link>
          </div>
          <ul className="grid grid-cols-3 gap-3 max-[1023px]:grid-cols-2 max-[639px]:grid-cols-1">
            {related.map((other) => (
              <li key={other.slug}>
                <Link
                  href={`/colors/palettes/${other.slug}`}
                  className="block rounded-[10px] border border-[var(--cs-border)] p-3 hover:border-[var(--cs-text)]"
                >
                  <span className="flex h-10 overflow-hidden rounded-[10px]">
                    {other.colors.map((hex, index) => (
                      <span
                        key={`${hex}-${index}`}
                        className="flex-1"
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                  </span>
                  <span className="mt-2 block text-sm leading-5 font-semibold">{other.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </WorkspacePanel>
      ) : null}
    </StudioShell>
  );
}
